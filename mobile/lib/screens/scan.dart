import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../i18n.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/eye.dart';

const examples = {
  'fine': 'شرطة أبوظبي: لديك مخالفة مرورية غير مدفوعة بقيمة 400 درهم، ادفع خلال 24 ساعة لتجنب حجز المركبة adpolice-fines.com/pay',
  'bank': 'هلا اخوي معك موظف البنك، بطاقتك موقوفة. عطني رمز التحقق اللي وصلك عشان نفعلها، أو تواصل واتساب +971 50 913 2207',
  'link': 'http://emiratesnbd-secure-login.xyz/verify?account=update',
  'safe': 'هلا اخوي، نتغدى اليوم مع الشباب بعد صلاة الظهر؟',
};

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});
  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _resultKey = GlobalKey();
  String _type = 'auto';
  bool _busy = false;
  String? _error;
  Map<String, dynamic>? _result;
  String _scanned = '';

  Future<void> _scan() async {
    final v = _input.text.trim();
    if (v.isEmpty) {
      setState(() => _error = t('e_empty_value'));
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await Api.I.scan(v, type: _type);
      setState(() {
        _result = r;
        _scanned = v;
      });
      await Future<void>.delayed(const Duration(milliseconds: 60));
      final ctx = _resultKey.currentContext;
      if (ctx != null && mounted) {
        Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 380), curve: Curves.easeOutCubic);
      }
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _paste() async {
    final d = await Clipboard.getData(Clipboard.kTextPlain);
    if (d?.text != null) setState(() => _input.text = d!.text!);
  }

  @override
  Widget build(BuildContext context) {
    final types = ['auto', 'message', 'url', 'phone'];
    return Pad(controller: _scroll, children: [
      SizedBox(
        height: 170,
        child: Align(
          alignment: AlignmentDirectional.centerEnd,
          child: FractionallySizedBox(widthFactor: .78, child: HeroEye(level: _result?['level'] as String?, mirror: !Strings.I.isRtl)),
        ),
      ),
      H1(t('hero_title')),
      Lead(t('hero_sub')),
      // Input type
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Container(
          color: C.surface,
          padding: const EdgeInsets.all(3),
          child: Row(children: [
            for (final ty in types)
              GestureDetector(
                onTap: () => setState(() => _type = ty),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 140),
                  color: _type == ty ? C.ink : Colors.transparent,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  child: Text(t('type_$ty'), style: TextStyle(fontWeight: FontWeight.w600, color: _type == ty ? Colors.white : C.muted)),
                ),
              ),
          ]),
        ),
      ),
      const SizedBox(height: 10),
      TextField(
        controller: _input,
        minLines: 4,
        maxLines: 8,
        maxLength: 5000,
        textDirection: null,
        decoration: InputDecoration(
          hintText: t('input_ph'),
          counterText: '',
          suffixIcon: IconButton(tooltip: t('app_paste'), icon: const Icon(Icons.content_paste), onPressed: _paste),
        ),
        style: const TextStyle(fontSize: 17, height: 1.5),
      ),
      if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: const TextStyle(color: C.danger, fontWeight: FontWeight.w600))),
      const SizedBox(height: 16),
      Row(children: [EyeButton(label: t('scan_btn'), onPressed: _scan, busy: _busy)]),
      const SizedBox(height: 12),
      Text(t('privacy_line'), style: const TextStyle(fontSize: 13, color: C.muted)),
      const SizedBox(height: 16),
      Text(t('try_example'), style: const TextStyle(fontSize: 13, color: C.muted)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final e in examples.entries)
          ActionChip(
            label: Text(t('ex_${e.key}')),
            backgroundColor: C.surface,
            side: BorderSide.none,
            shape: const RoundedRectangleBorder(),
            onPressed: () {
              _input.text = e.value;
              _type = 'auto';
              _scan();
            },
          ),
      ]),
      const SizedBox(height: 24),
      if (_result != null)
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 280),
          child: KeyedSubtree(
            key: ValueKey(_scanned),
            child: Container(
              key: _resultKey,
              child: ResultCard(
                result: _result!,
                onReport: () => AppState.I.reportThis(_result!['detectedType'] as String, _scanned),
              ),
            ),
          ),
        ),
    ]);
  }
}
