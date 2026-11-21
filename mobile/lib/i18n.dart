import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:intl/intl.dart' as intl;

/// The same dictionary the web app uses (exported by the server at /api/i18n and
/// bundled as an asset so the app works before it ever reaches the server).
class Strings {
  Strings._();
  static final Strings I = Strings._();

  Map<String, dynamic> _all = {};
  String lang = 'ar';

  bool get isRtl => lang == 'ar';

  Future<void> load() async {
    final raw = await rootBundle.loadString('assets/i18n/strings.json');
    _all = jsonDecode(raw) as Map<String, dynamic>;
  }

  /// Replace with a fresher copy from the server, if it has every language.
  void update(Map<String, dynamic> fresh) {
    if (fresh['ar'] is Map && fresh['en'] is Map) _all = fresh;
  }

  static const _counted = {'reports_n', 'list_reports', 'camp_reports'};

  String t(String key, [Map<String, Object?> params = const {}]) {
    if (_counted.contains(key) && params.containsKey('n')) return plural(params['n']);
    final table = (_all[lang] as Map?) ?? const {};
    final fallback = (_all['ar'] as Map?) ?? const {};
    var s = (table[key] ?? fallback[key] ?? key).toString();
    return s.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) {
      final v = params[m[1]];
      if (v is List) return v.join(lang == 'ar' ? '، ' : ', ');
      return v?.toString() ?? '';
    });
  }

  /// Arabic has six plural forms; English two.
  String plural(Object? n) {
    final count = int.tryParse(n.toString().replaceAll(RegExp(r'[^\d-]'), '')) ?? 0;
    final shown = n is String ? n : fmt(count);
    if (lang == 'en') {
      if (count == 0) return 'No reports';
      return count == 1 ? '1 report' : '$shown reports';
    }
    if (count == 0) return 'لا بلاغات';
    if (count == 1) return 'بلاغ واحد';
    if (count == 2) return 'بلاغان';
    final mod = count % 100;
    if (mod >= 3 && mod <= 10) return '$shown بلاغات';
    if (mod >= 11 && mod <= 99) return '$shown بلاغاً';
    return '$shown بلاغ';
  }

  /// Latin digits with grouping, same as the web app.
  String fmt(num n) => intl.NumberFormat.decimalPattern('en').format(n);

  String date(String iso) {
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return iso;
    return intl.DateFormat('d MMM, HH:mm', lang == 'ar' ? 'ar' : 'en').format(d);
  }

  /// Reason text for an engine reason code (same templates as the web app).
  String reason(Map<String, dynamic> r) {
    final p = Map<String, Object?>.from((r['params'] as Map?) ?? {});
    final code = r['code'] as String;
    if (code == 'ml_scam_language') {
      final terms = p['terms'];
      p['terms_part'] = terms is List && terms.isNotEmpty ? t('terms_part', {'terms': terms}) : '';
    }
    if (code == 'official_emergency' && p['service'] != null) p['service'] = t('svc_${p['service']}');
    return t('r_$code', p);
  }
}

String t(String key, [Map<String, Object?> params = const {}]) => Strings.I.t(key, params);
