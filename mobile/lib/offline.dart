// On-device copy of Saqr's detection engine, used when the server cannot be reached.
// It is a line-by-line port of src/engine (Naive Bayes language model + tactic rules + static
// URL and phone analysis). Its data comes from assets/offline/engine.json, which
// `npm run mobile:export` generates from the server engine, and test/offline_parity_test.dart
// checks that both engines give the same verdicts. The community registry and threat feeds need
// the server, so offline verdicts never include them.
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/services.dart' show rootBundle;

class OfflineEngine {
  OfflineEngine._(Map<String, dynamic> d) {
    final lists = Map<String, dynamic>.from(d['lists'] as Map);
    List<String> l(String k) => List<String>.from(lists[k] as List);
    _multiSuffixes = l('MULTI_SUFFIXES').toSet();
    _officialSuffixes = l('OFFICIAL_SUFFIXES');
    _trusted = l('TRUSTED_DOMAINS').toSet();
    _brands = l('BRANDS');
    _authorities = l('AUTHORITIES');
    _shorteners = l('SHORTENERS').toSet();
    _tlds = l('SUSPICIOUS_TLDS').toSet();
    _freeHosting = l('FREE_HOSTING');
    _phishWords = l('PHISH_WORDS');
    _emergency = Map<String, String>.from(d['emergency'] as Map);
    _premium = List<String>.from(d['premiumRanges'] as List);
    _urlRe = RegExp(d['urlRe'] as String, caseSensitive: false);
    _phoneRe = RegExp(d['phoneRe'] as String);
    _stop = List<String>.from(d['stopwords'] as List).toSet();
    _protective = List<String>.from(d['protective'] as List);
    final tactics = Map<String, dynamic>.from(d['tactics'] as Map);
    for (final e in tactics.entries) {
      final v = Map<String, dynamic>.from(e.value as Map);
      _tactics[e.key] = _Tactic(
        (v['points'] as num).toInt(),
        (v['floor'] as num?)?.toInt() ?? 0,
        v['severity'] as String,
        List<String>.from(v['words'] as List).map(_compile).toList(),
      );
    }
    final m = Map<String, dynamic>.from(d['model'] as Map);
    _docsScam = (m['docs']['scam'] as num).toInt();
    _docsHam = (m['docs']['ham'] as num).toInt();
    _totScam = (m['totals']['scam'] as num).toInt();
    _totHam = (m['totals']['ham'] as num).toInt();
    _vocabSize = (m['vocab'] as num).toInt();
    _scam = Map<String, dynamic>.from(m['scam'] as Map).map((k, v) => MapEntry(k, (v as num).toInt()));
    _ham = Map<String, dynamic>.from(m['ham'] as Map).map((k, v) => MapEntry(k, (v as num).toInt()));
  }

  static OfflineEngine? _instance;

  /// Loads the bundled engine data once.
  static Future<OfflineEngine> load() async =>
      _instance ??= OfflineEngine.fromJson(await rootBundle.loadString('assets/offline/engine.json'));

  factory OfflineEngine.fromJson(String json) => OfflineEngine._(Map<String, dynamic>.from(jsonDecode(json) as Map));

  late final Set<String> _multiSuffixes, _trusted, _shorteners, _tlds, _stop;
  late final List<String> _officialSuffixes, _brands, _authorities, _freeHosting, _phishWords, _premium, _protective;
  late final Map<String, String> _emergency;
  late final RegExp _urlRe, _phoneRe;
  final Map<String, _Tactic> _tactics = {};
  late final int _docsScam, _docsHam, _totScam, _totHam, _vocabSize;
  late final Map<String, int> _scam, _ham;

  static const _advice = {
    'safe': ['advice_stay_alert', 'advice_official_channels'],
    'suspicious': ['advice_dont_click', 'advice_verify_official', 'advice_never_share_otp', 'advice_report'],
    'dangerous': ['advice_dont_click', 'advice_never_share_otp', 'advice_block', 'advice_report', 'advice_if_paid'],
  };

  static String levelOf(int score) => score <= 29 ? 'safe' : (score <= 64 ? 'suspicious' : 'dangerous');

  // ---------------------------------------------------------------- normalisation
  static final _diacritics = RegExp('[ؐ-ًؚ-ٰٟۖ-ۭ]');

  static String normalizeDigits(String s) => s.replaceAllMapped(RegExp('[٠-٩۰-۹]'), (m) {
        final c = m[0]!.codeUnitAt(0);
        return String.fromCharCode(48 + (c >= 0x06F0 ? c - 0x06F0 : c - 0x0660));
      });

  static String normalizeText(String s) => normalizeDigits(s)
      .replaceAll(_diacritics, '')
      .replaceAll('ـ', '')
      .replaceAll(RegExp('[إأآٱ]'), 'ا')
      .replaceAll('ى', 'ي')
      .replaceAll('ة', 'ه')
      .replaceAll('ؤ', 'و')
      .replaceAll('ئ', 'ي')
      .toLowerCase();

  _Word _compile(String word) {
    final w = normalizeText(word);
    if (RegExp(r'^[a-z0-9 ]+$').hasMatch(w)) {
      return _Word(w, RegExp('(^|[^a-z0-9])${w.replaceAll(' ', r'\s+')}([^a-z0-9]|\$)'));
    }
    if (w.length <= 4 && !w.contains(' ')) {
      return _Word(w, RegExp('(^|[^\\p{L}])(و|ف|ب|ل|ال|وال|بال)?$w([^\\p{L}]|\$)', unicode: true));
    }
    return _Word(w, null);
  }

  List<String> _extractUrls(String text) {
    final t = normalizeDigits(text);
    final out = <String>{};
    for (final m in _urlRe.allMatches(t)) {
      out.add(m[1]!.replaceAll(RegExp(r'[).,!?؛؟]+$'), ''));
    }
    return out.toList();
  }

  List<String> _extractPhones(String text) {
    final t = normalizeDigits(text).replaceAll(_urlRe, ' ');
    final out = <String>{};
    for (final m in _phoneRe.allMatches(t)) {
      final raw = m[0]!.trim();
      final digits = raw.replaceAll(RegExp(r'\D'), '');
      if (digits.length < 8 || digits.length > 15) continue;
      if (RegExp(r'^784\d{12}$').hasMatch(digits)) continue;
      out.add(raw);
    }
    return out.toList();
  }

  List<String> _tokenize(String text) {
    var t = normalizeText(text);
    t = t.replaceAll(_urlRe, ' __url__ ');
    t = t.replaceAll(_phoneRe, ' __phone__ ');
    t = t.replaceAll(RegExp(r'\d+'), ' __num__ ');
    final words = t.split(RegExp(r'[^\p{L}\p{N}_]+', unicode: true)).where((w) => w.length > 1 && !_stop.contains(w)).toList();
    return [...words, for (var i = 0; i < words.length - 1; i++) '${words[i]}_${words[i + 1]}'];
  }

  // ---------------------------------------------------------------- language model
  ({double probability, List<String> topTerms}) _predict(String text) {
    final tokens = _tokenize(text);
    final nDocs = (_docsScam + _docsHam) == 0 ? 1 : _docsScam + _docsHam;
    var s = math.log((_docsScam == 0 ? 1 : _docsScam) / nDocs);
    var h = math.log((_docsHam == 0 ? 1 : _docsHam) / nDocs);
    final contrib = <(String, double, int)>[];
    var known = 0;
    for (final tok in tokens) {
      if (!_scam.containsKey(tok) && !_ham.containsKey(tok)) continue;
      known++;
      final ls = math.log(((_scam[tok] ?? 0) + 1) / (_totScam + _vocabSize));
      final lh = math.log(((_ham[tok] ?? 0) + 1) / (_totHam + _vocabSize));
      s += ls;
      h += lh;
      contrib.add((tok, ls - lh, contrib.length));
    }
    final diff = (s - h).clamp(-50.0, 50.0);
    var p = 1 / (1 + math.exp(-diff));
    if (known < 2) p = 0.5 + (p - 0.5) * 0.3;
    final top = contrib.where((c) => c.$2 > 0.4 && !c.$1.contains('_') && !c.$1.startsWith('__')).toList()
      ..sort((a, b) => b.$2 != a.$2 ? b.$2.compareTo(a.$2) : a.$3.compareTo(b.$3));
    return (probability: p, topTerms: top.take(5).map((c) => c.$1).toList());
  }

  // ---------------------------------------------------------------- public API
  String detectType(String value) {
    final v = normalizeDigits(value).trim();
    if (RegExp(r'^\+?[\d\s()-]{3,20}$').hasMatch(v) && v.replaceAll(RegExp(r'\D'), '').length >= 3) return 'phone';
    if (!RegExp(r'\s').hasMatch(v) &&
        (RegExp(r'^[a-z]+://', caseSensitive: false).hasMatch(v) ||
            RegExp(r'^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$', caseSensitive: false).hasMatch(v))) {
      return 'url';
    }
    return 'message';
  }

  /// Same response shape as POST /api/scan, plus `offline: true`.
  Map<String, dynamic> analyze(String value, {String type = 'auto'}) {
    final v = value.length > 5000 ? value.substring(0, 5000) : value;
    final t = type == 'auto' ? detectType(v) : type;
    final r = t == 'url' ? _url(v.trim()) : (t == 'phone' ? _phone(v) : _message(v));
    final level = levelOf(r['score'] as int);
    return {...r, 'detectedType': t, 'level': level, 'advice': _advice[level], 'offline': true};
  }

  Map<String, dynamic> _result(String type, String input, int score, List<Map<String, dynamic>> reasons, [Map<String, dynamic> extra = const {}]) {
    final s = score.clamp(0, 100).toInt();
    return {
      'type': type,
      'input': input,
      'score': s,
      'level': levelOf(s),
      'reasons': [for (final r in reasons) {'code': r['code'], 'severity': r['severity'], 'params': r['params'] ?? <String, dynamic>{}}],
      ...extra,
    };
  }

  Map<String, dynamic> _message(String text) {
    final reasons = <Map<String, dynamic>>[];
    void add(String code, String severity, [Map<String, dynamic>? params]) => reasons.add({'code': code, 'severity': severity, 'params': params});

    final pred = _predict(text);
    final mlPoints = (pred.probability * 50).round();
    if (pred.probability >= 0.6) {
      add('ml_scam_language', pred.probability >= 0.85 ? 'high' : 'medium', {'pct': (pred.probability * 100).round(), 'terms': pred.topTerms});
    } else if (pred.probability <= 0.35) {
      add('ml_normal_language', 'safe', {'pct': ((1 - pred.probability) * 100).round()});
    }

    final nt = normalizeText(text);
    final tactics = <String, List<String>>{};
    for (final e in _tactics.entries) {
      final matched = <String>{};
      for (final w in e.value.words) {
        if (w.re != null ? w.re!.hasMatch(nt) : nt.contains(w.w)) matched.add(w.w);
      }
      if (matched.isNotEmpty) tactics[e.key] = matched.take(3).toList();
    }
    final links = _extractUrls(text);
    if (_protective.any(nt.contains) && !tactics.containsKey('payment') && !tactics.containsKey('prize') && !tactics.containsKey('threat') && links.isEmpty) {
      tactics.remove('credentials');
      tactics.remove('impersonation');
      add('protective_notice', 'safe');
    }
    var rulePoints = 0;
    for (final e in tactics.entries) {
      final tac = _tactics[e.key]!;
      rulePoints += tac.points;
      add('tactic_${e.key}', tac.severity, {'terms': e.value});
    }

    final linkRes = links.map(_url).toList();
    final phoneRes = _extractPhones(text).map(_phone).toList();
    final maxLink = linkRes.fold<int>(0, (m, l) => math.max<int>(m, l['score'] as int));
    final maxPhone = phoneRes.fold<int>(0, (m, p) => math.max<int>(m, p['score'] as int));
    if (linkRes.isNotEmpty) add(maxLink >= 50 ? 'contains_risky_link' : 'contains_link', maxLink >= 50 ? 'high' : 'low', {'count': linkRes.length});
    if (phoneRes.isNotEmpty) add(maxPhone >= 50 ? 'contains_risky_phone' : 'contains_phone', maxPhone >= 50 ? 'high' : 'low', {'count': phoneRes.length});

    final official = tactics.containsKey('impersonation');
    if (official && (tactics.containsKey('credentials') || tactics.containsKey('payment') || tactics.containsKey('personal_data') || tactics.containsKey('threat') || linkRes.isNotEmpty)) {
      add('combo_impersonation', 'high');
      rulePoints += 15;
    }
    if (official && phoneRes.any((p) => p['kind'] == 'uae_mobile' || p['kind'] == 'international')) {
      add('combo_official_personal_number', 'medium');
      rulePoints += 10;
    }

    var score = mlPoints + math.min<int>(rulePoints, 50) + (maxLink * 0.5).round() + (maxPhone * 0.35).round();
    if (tactics.isEmpty && linkRes.isEmpty && phoneRes.isEmpty && pred.probability < 0.6) score = math.min<int>(score, 25);
    final floor = tactics.keys.fold<int>(0, (m, k) => math.max<int>(m, _tactics[k]!.floor));
    score = math.max<int>(score, floor);
    final strong = tactics.keys.where((k) => !const ['impersonation', 'parcel', 'off_platform'].contains(k)).length;
    if (strong >= 2) score = math.max<int>(score, 55 + 8 * (strong - 2));

    return _result('message', text, score, reasons, {
      'model': {'probability': double.parse(pred.probability.toStringAsFixed(3))},
      'tactics': tactics.keys.toList(),
      'entities': [...linkRes, ...phoneRes],
    });
  }

  // ---------------------------------------------------------------- links
  String _registrable(String host) {
    final parts = host.split('.').where((p) => p.isNotEmpty).toList();
    if (parts.length <= 2) return parts.join('.');
    final lastTwo = parts.sublist(parts.length - 2).join('.');
    return _multiSuffixes.contains(lastTwo) ? parts.sublist(parts.length - 3).join('.') : lastTwo;
  }

  bool _isOfficial(String host) => _officialSuffixes.any((s) => host == s || host.endsWith('.$s'));

  static int levenshtein(String a, String b) {
    if (a == b) return 0;
    if (a.isEmpty) return b.length;
    if (b.isEmpty) return a.length;
    var prev = List<int>.generate(b.length + 1, (i) => i);
    for (var i = 1; i <= a.length; i++) {
      final cur = <int>[i];
      for (var j = 1; j <= b.length; j++) {
        cur.add([prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1)].reduce((x, y) => x < y ? x : y));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  static String _deHomoglyph(String s) => s
      .replaceAll('rn', 'm')
      .replaceAll('vv', 'w')
      .replaceAll('0', 'o')
      .replaceAll('1', 'l')
      .replaceAll('3', 'e')
      .replaceAll('5', 's')
      .replaceAll('4', 'a')
      .replaceAll('7', 't')
      .replaceAll('8', 'b');

  Map<String, dynamic> _url(String raw) {
    final reasons = <Map<String, dynamic>>[];
    var points = 0;
    void add(String code, int p, String severity, [Map<String, dynamic>? params]) {
      points += p;
      reasons.add({'code': code, 'severity': severity, 'params': params});
    }

    var s = normalizeDigits(raw.trim());
    final explicit = RegExp(r'^[a-z][a-z0-9+.-]*://', caseSensitive: false).hasMatch(s);
    if (!explicit) s = 'http://$s';
    Uri? url;
    try {
      url = Uri.parse(s);
      if (!(url.scheme == 'http' || url.scheme == 'https') || url.host.isEmpty) url = null;
    } catch (_) {
      url = null;
    }
    if (url == null) {
      add('url_invalid', 20, 'medium');
      return _result('url', raw, points + 8, reasons, {'host': null, 'domain': null});
    }

    final host = url.host.toLowerCase().replaceFirst(RegExp(r'^www\.'), '').replaceFirst(RegExp(r'\.$'), '');
    final reg = _registrable(host);
    final regLabel = reg.split('.').first;
    final official = _isOfficial(host);
    final trusted = official || _trusted.contains(reg) || _trusted.contains(host);
    final tokens = host.split(RegExp(r'[.-]')).where((x) => x.isNotEmpty).toList();
    final subLabels = host.substring(0, math.max<int>(0, host.length - reg.length)).split('.').where((x) => x.isNotEmpty).toList();
    final isHttp = explicit && url.scheme == 'http';

    if (trusted) {
      add(official ? 'official_domain' : 'trusted_domain', -10, 'safe', {'domain': reg});
      if (isHttp) add('no_https', 10, 'low');
      return _result('url', raw, points + 5, reasons, {'host': host, 'domain': reg});
    }

    if (RegExp(r'^\d{1,3}(\.\d{1,3}){3}$').hasMatch(host) || host.startsWith('[')) add('ip_host', 30, 'high');
    if (host.split('.').any((l) => l.startsWith('xn--')) || RegExp(r'[^\x00-\x7f]').hasMatch(raw)) add('punycode', 30, 'high');

    if (RegExp(r'(^|[.-])gov[.-]?ae([.-]|$)').hasMatch(host) || host.contains('govae') || subLabels.join('.').contains('gov.ae')) {
      add('gov_spoof', 45, 'high', {'domain': reg});
    }
    final auth = _authorities.where((a) => tokens.contains(a) || (a.length >= 6 && host.contains(a))).firstOrNull;
    if (auth != null && !reasons.any((r) => r['code'] == 'gov_spoof')) add('authority_unofficial', 45, 'high', {'name': auth, 'domain': reg});
    final brand = _brands.where((b) => tokens.contains(b) || (b.length >= 5 && host.contains(b))).firstOrNull;
    if (brand != null) add('brand_unofficial', 48, 'high', {'name': brand, 'domain': reg});

    if (brand == null) {
      final clean = _deHomoglyph(regLabel);
      final look = _brands.where((b) => b.length >= 4).where((b) {
        if (clean == b && regLabel != b) return true;
        final d = levenshtein(regLabel, b);
        return d > 0 && d <= (b.length >= 8 ? 2 : 1);
      }).firstOrNull;
      if (look != null) add('lookalike_domain', 60, 'high', {'name': look, 'domain': reg});
    }

    final tld = host.split('.').last;
    if (_tlds.contains(tld)) add('suspicious_tld', 18, 'medium', {'tld': tld});
    if (_shorteners.contains(host)) add('shortener', 25, 'medium', {'domain': host});
    if (_freeHosting.any((f) => host == f || host.endsWith('.$f'))) add('free_hosting', 20, 'medium', {'domain': reg});
    if (isHttp) add('no_https', 10, 'low');
    final authority = raw.replaceFirst(RegExp(r'^[a-z]+://', caseSensitive: false), '').split('/').first;
    if (url.userInfo.isNotEmpty || authority.contains('@')) add('at_symbol', 25, 'high');
    if (subLabels.length >= 3) add('many_subdomains', 10, 'low', {'count': subLabels.length});
    if ('-'.allMatches(host).length >= 3) add('many_hyphens', 8, 'low');
    if (raw.length > 100) add('long_url', 5, 'low');
    if (url.hasPort && url.port != 80 && url.port != 443) add('odd_port', 10, 'low', {'port': '${url.port}'});

    final full = '$host${url.path.isEmpty ? '/' : url.path}${url.hasQuery ? '?${url.query}' : ''}'.toLowerCase();
    final words = _phishWords.where((w) => RegExp('(^|[^a-z])$w([^a-z]|\$)').hasMatch(full)).toList();
    if (words.isNotEmpty) add('phish_words', math.min<int>(30, words.length * 11), words.length > 1 ? 'medium' : 'low', {'terms': words.take(4).toList()});
    if (tokens.contains('uae') || tokens.contains('ae') || RegExp('emirates|dubai|abudhabi').hasMatch(host)) {
      if (words.isNotEmpty && !reasons.any((r) => const ['gov_spoof', 'authority_unofficial', 'brand_unofficial'].contains(r['code']))) {
        add('uae_service_lookalike', 22, 'high', {'domain': reg});
      }
    }
    add('unknown_domain', 10, 'info', {'domain': reg});
    return _result('url', raw, points + 8, reasons, {'host': host, 'domain': reg});
  }

  // ---------------------------------------------------------------- phone numbers
  Map<String, dynamic> _phone(String raw) {
    final reasons = <Map<String, dynamic>>[];
    var score = 8;
    void add(String code, int p, String severity, [Map<String, dynamic>? params]) {
      score += p;
      reasons.add({'code': code, 'severity': severity, 'params': params});
    }

    final s = normalizeDigits(raw).trim();
    final plus = s.startsWith('+');
    var d = s.replaceAll(RegExp(r'\D'), '');
    var local = false;
    String? e164;
    if (d.isNotEmpty) {
      if (_emergency.containsKey(d) || RegExp(r'^(800|600)\d{3,7}$').hasMatch(d)) {
        local = true;
        e164 = d;
      } else {
        if (!plus && d.startsWith('00')) {
          d = d.substring(2);
        } else if (!plus && d.startsWith('0') && (d.length == 10 || d.length == 9)) {
          d = '971${d.substring(1)}';
        } else if (!plus && d.length == 9 && d.startsWith('5')) {
          d = '971$d';
        }
        e164 = '+$d';
      }
    }

    var kind = 'invalid';
    if (e164 == null) {
      add('phone_invalid', 25, 'medium');
    } else if (local && _emergency.containsKey(d)) {
      kind = 'emergency';
      add('official_emergency', -8, 'safe', {'service': _emergency[d]});
    } else if (local) {
      kind = d.startsWith('800') ? 'uae_tollfree' : 'uae_600';
      add('uae_service_number', -3, 'safe');
    } else if (d.startsWith('971')) {
      final rest = d.substring(3);
      if (RegExp(r'^5[024568]\d{7}$').hasMatch(rest)) {
        kind = 'uae_mobile';
        add('uae_mobile', 0, 'info');
      } else if (RegExp(r'^[234679]\d{7}$').hasMatch(rest)) {
        kind = 'uae_landline';
        add('uae_landline', -3, 'info');
      } else {
        add('phone_invalid', 25, 'medium');
      }
    } else {
      kind = 'international';
      final premium = _premium.where(d.startsWith).firstOrNull;
      if (premium != null) {
        add('premium_range', 50, 'high', {'prefix': '+$premium'});
      } else {
        add('international', 24, 'medium', {'prefix': '+${d.substring(0, math.min<int>(3, d.length))}'});
      }
      if (d.length < 8 || d.length > 15) add('phone_invalid', 20, 'medium');
    }
    if (kind != 'emergency' && kind != 'invalid') add('phone_no_reports', 0, 'info');
    return _result('phone', raw, score, reasons, {'kind': kind});
  }

  /// Every practice question with the engine's explanation (generated from the server bank).
  static Future<List<Map<String, dynamic>>> trainingBank(String lang) async {
    final all = Map<String, dynamic>.from(jsonDecode(await rootBundle.loadString('assets/offline/training.json')) as Map);
    final list = (all[lang] ?? all['ar']) as List;
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }
}

class _Tactic {
  const _Tactic(this.points, this.floor, this.severity, this.words);
  final int points, floor;
  final String severity;
  final List<_Word> words;
}

class _Word {
  const _Word(this.w, this.re);
  final String w;
  final RegExp? re;
}
