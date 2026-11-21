import 'package:flutter/material.dart';

import '../api.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/eye.dart';

/// "Scam or safe?" — explanations come from the live detection engine.
class TrainScreen extends StatefulWidget {
  const TrainScreen({super.key});
  @override
  State<TrainScreen> createState() => _TrainScreenState();
}

class _TrainScreenState extends State<TrainScreen> {
  List<Map<String, dynamic>> _qs = [];
  int _i = 0, _score = 0, _correct = 0, _streak = 0;
  String? _picked, _error, _lang;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    setState(() {
      _loading = true;
      _error = null;
      _i = _score = _correct = _streak = 0;
      _picked = null;
      _lang = Strings.I.lang;
    });
    try {
      final q = await Api.I.training(Strings.I.lang);
      setState(() => _qs = q.map((e) => Map<String, dynamic>.from(e as Map)).toList());
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _answer(String c) {
    if (_picked != null) return;
    final ok = c == _qs[_i]['answer'];
    setState(() {
      _picked = c;
      if (ok) {
        _correct++;
        _streak++;
        _score += 10 + (_streak >= 3 ? 5 : 0);
      } else {
        _streak = 0;
      }
    });
  }

  Future<void> _next() async {
    setState(() {
      _picked = null;
      _i++;
    });
    if (_i >= _qs.length) {
      final best = int.tryParse(Api.I.pref('best') ?? '0') ?? 0;
      if (_score > best) await Api.I.setPref('best', '$_score');
      if (mounted) setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_lang != null && _lang != Strings.I.lang && !_loading) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _start());
    }
    final children = <Widget>[H1(t('train_title')), Lead(t('train_sub'))];
    if (_loading || (_qs.isEmpty && _error == null)) {
      children.add(Container(height: 220, color: C.surface));
    } else if (_error != null) {
      children.add(Text(_error!, style: const TextStyle(color: C.danger)));
    } else if (_i >= _qs.length) {
      children.add(_finish());
    } else {
      children.add(_question());
    }
    children.add(Padding(padding: const EdgeInsets.only(top: 12), child: Text(t('train_local'), style: const TextStyle(fontSize: 13, color: C.muted))));
    return Pad(children: children);
  }

  Widget _hud() {
    final total = _qs.length;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(t('question_n', {'n': (_i + 1).clamp(1, total), 't': total})),
        Text('${t('points')}: $_score'),
        Text('${t('streak')}: $_streak'),
      ]),
      const SizedBox(height: 10),
      TweenAnimationBuilder<double>(
        tween: Tween(end: (_i + (_picked != null ? 1 : 0)) / total),
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
        builder: (context, v, _) => LinearProgressIndicator(value: v, minHeight: 6, color: C.accent, backgroundColor: C.surface2),
      ),
      const SizedBox(height: 18),
    ]);
  }

  Widget _question() {
    final q = _qs[_i];
    final a = q['analysis'] as Map;
    final reasons = sortedReasons(a['reasons'] as List).where((r) => r['severity'] != 'info').take(4).toList();
    final ok = _picked == q['answer'];
    Widget choice(String c, Color color) {
      final picked = _picked == c;
      return Expanded(
        child: GestureDetector(
          onTap: () => _answer(c),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            height: 64,
            alignment: Alignment.center,
            color: picked ? color : (_picked != null ? C.bg.withValues(alpha: .5) : C.bg),
            child: Text(t(c == 'scam' ? 'is_scam' : 'is_safe'), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: picked ? Colors.white : C.ink)),
          ),
        ),
      );
    }

    return Container(
      color: C.surface,
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _hud(),
        Container(color: C.bg, padding: const EdgeInsets.all(16), child: Text(q['text'] as String, style: const TextStyle(fontSize: 17, height: 1.6))),
        const SizedBox(height: 16),
        Row(children: [choice('scam', C.danger), const SizedBox(width: 10), choice('safe', C.safe)]),
        if (_picked != null) ...[
          const SizedBox(height: 16),
          Container(
            color: ok ? C.safeBg : C.dangerBg,
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${t(ok ? 'correct' : 'wrong')}${Strings.I.isRtl ? '، ' : ' '}${t(q['answer'] == 'scam' ? 'it_was_scam' : 'it_was_safe')}',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17, color: ok ? C.safe : C.danger)),
              const SizedBox(height: 12),
              for (final r in reasons) ReasonRow(r),
              const SizedBox(height: 8),
              EyeButton(label: t('next_q'), onPressed: _next, color: C.ink, height: 52),
            ]),
          ),
        ],
      ]),
    );
  }

  Widget _finish() {
    final total = _qs.length;
    final ratio = total == 0 ? 0 : _correct / total;
    final b = ratio >= .87 ? 'falcon' : ratio >= .5 ? 'guard' : 'novice';
    final color = b == 'falcon' ? C.accent : b == 'guard' ? C.ink : C.surface2;
    return Container(
      color: C.surface,
      padding: const EdgeInsets.all(20),
      child: Column(children: [
        ClipPath(
          clipper: const EyeClipper(),
          child: Container(
            width: 220,
            height: 100,
            color: color,
            alignment: Alignment.center,
            child: Text(t('badge_$b'), style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: b == 'novice' ? C.ink : Colors.white)),
          ),
        ),
        const SizedBox(height: 16),
        Text(t('finish_t'), style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 6),
        Text('${t('finish_d', {'c': _correct, 't': total})} · ${t('points')}: $_score', textAlign: TextAlign.center),
        const SizedBox(height: 6),
        Text('${t('badge_${b}_d')} · ${t('best')}: ${Api.I.pref('best') ?? _score}', textAlign: TextAlign.center, style: const TextStyle(color: C.muted)),
        const SizedBox(height: 16),
        EyeButton(label: t('play_again'), onPressed: _start),
      ]),
    );
  }
}
