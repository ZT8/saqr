import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';

import '../api.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/eye.dart';

/// Elder mode: very large type, one action, the verdict read aloud, and a family alert button.
class ElderScreen extends StatefulWidget {
  const ElderScreen({super.key});
  @override
  State<ElderScreen> createState() => _ElderScreenState();
}

class _ElderScreenState extends State<ElderScreen> {
  final _input = TextEditingController();
  final _pair = TextEditingController();
  final _tts = FlutterTts();
  String? _token, _label, _error;
  Map<String, dynamic>? _result;
  bool _share = false, _busy = false, _helpSent = false;

  @override
  void initState() {
    super.initState();
    _token = Api.I.pref('elder');
    _check();
  }

  Future<void> _check() async {
    if (_token == null) return;
    try {
      final info = await Api.I.elderInfo(_token!);
      if (mounted) setState(() => _label = info['label'] as String?);
    } catch (_) {
      if (mounted) setState(() => _label = null);
    }
  }

  /// Accepts the full link (…/elder#pair=TOKEN) or the bare token.
  Future<void> _doPair() async {
    final raw = _pair.text.trim();
    final m = RegExp(r'pair=([\w-]+)').firstMatch(raw);
    final token = m != null ? m.group(1)! : raw;
    if (token.length < 16) return setState(() => _error = t('e_family_not_found'));
    try {
      final info = await Api.I.elderInfo(token);
      await Api.I.setPref('elder', token);
      setState(() {
        _token = token;
        _label = info['label'] as String?;
        _error = null;
      });
      if (mounted) toast(context, t('app_paired_ok'));
    } catch (e) {
      setState(() => _error = errText(e));
    }
  }

  Future<void> _speak(String text) async {
    await _tts.setLanguage(Strings.I.lang == 'ar' ? 'ar' : 'en-GB');
    await _tts.setSpeechRate(0.45);
    await _tts.speak(text);
  }

  Future<void> _scan() async {
    final v = _input.text.trim();
    if (v.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await Api.I.scan(v, elderToken: _label != null ? _token : null, share: _share);
      setState(() => _result = r);
      _speak('${t('level_${r['level']}')}. ${t('eld_${r['level']}')}');
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _help() async {
    try {
      await Api.I.elderHelp(_token!);
      setState(() => _helpSent = true);
      _speak(t('eld_help_sent'));
      Future<void>.delayed(const Duration(seconds: 5), () {
        if (mounted) setState(() => _helpSent = false);
      });
    } catch (e) {
      setState(() => _error = errText(e));
    }
  }

  @override
  void dispose() {
    _tts.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const big = TextStyle(fontSize: 22, height: 1.5);
    final level = _result?['level'] as String?;
    return Scaffold(
      appBar: AppBar(),
      body: MediaQuery(
        // Elder mode always uses a large, readable scale.
        data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.15)),
        child: Pad(children: [
          Text(_label != null ? t('eld_paired', {'label': _label}) : t('eld_unpaired'),
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: _label != null ? C.safe : C.muted)),
          const SizedBox(height: 12),
          Text(t('eld_title'), style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w700, height: 1.15)),
          const SizedBox(height: 16),
          SizedBox(
            height: 72,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(shape: const RoundedRectangleBorder(), backgroundColor: C.surface, side: BorderSide.none, foregroundColor: C.ink),
              icon: const Icon(Icons.content_paste, size: 28),
              label: Text(t('eld_paste'), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
              onPressed: () async {
                final d = await Clipboard.getData(Clipboard.kTextPlain);
                if (d?.text != null) setState(() => _input.text = d!.text!);
              },
            ),
          ),
          const SizedBox(height: 12),
          TextField(controller: _input, minLines: 4, maxLines: 8, style: big, decoration: InputDecoration(hintText: t('eld_ph'))),
          if (_label != null)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _share,
              activeColor: C.accent,
              controlAffinity: ListTileControlAffinity.leading,
              title: Text(t('eld_share'), style: const TextStyle(fontSize: 18)),
              onChanged: (v) => setState(() => _share = v ?? false),
            ),
          const SizedBox(height: 12),
          EyeButton(label: t('eld_check'), onPressed: _scan, busy: _busy, height: 96, expand: true),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: C.danger, fontSize: 18))),
          if (_result != null) ...[
            const SizedBox(height: 16),
            Container(
              color: level == 'dangerous' ? C.danger : C.levelBg(level),
              padding: const EdgeInsets.all(22),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t('level_$level'), style: TextStyle(fontSize: 32, fontWeight: FontWeight.w700, color: level == 'dangerous' ? Colors.white : C.level(level))),
                const SizedBox(height: 8),
                Text(t('eld_$level'), style: big.copyWith(color: level == 'dangerous' ? Colors.white : C.ink)),
                if (_result!['familyAlerted'] == true) ...[
                  const SizedBox(height: 8),
                  Text(t('eld_family_told'), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: level == 'dangerous' ? Colors.white : C.ink)),
                ],
                const SizedBox(height: 8),
                TextButton.icon(
                  icon: Icon(Icons.volume_up, color: level == 'dangerous' ? Colors.white : C.ink),
                  label: Text(t('eld_listen'), style: TextStyle(fontSize: 18, color: level == 'dangerous' ? Colors.white : C.ink)),
                  onPressed: () => _speak('${t('level_$level')}. ${t('eld_$level')}'),
                ),
              ]),
            ),
          ],
          if (_label != null) ...[
            const SizedBox(height: 20),
            SizedBox(
              height: 84,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: C.ink, shape: const RoundedRectangleBorder()),
                onPressed: _help,
                child: Text(_helpSent ? t('eld_help_sent') : t('eld_help'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w700)),
              ),
            ),
          ] else ...[
            const SizedBox(height: 28),
            Text(t('app_pair'), style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(t('app_pair_d')),
            const SizedBox(height: 10),
            Directionality(textDirection: TextDirection.ltr, child: TextField(controller: _pair, decoration: InputDecoration(hintText: t('app_pair_ph')))),
            const SizedBox(height: 10),
            Row(children: [EyeButton(label: t('app_pair'), onPressed: _doPair, color: C.ink, height: 56)]),
          ],
        ]),
      ),
    );
  }
}
