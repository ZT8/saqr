import 'package:flutter/material.dart';

import '../api.dart';
import '../i18n.dart';
import '../theme.dart';
import 'eye.dart';

/// Error text for an exception thrown by the API client.
String errText(Object e) {
  if (e is ApiError) return e.code == 'network' ? t('app_offline') : t('e_${e.code}');
  return t('e_server_error');
}

void toast(BuildContext context, String msg) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg, style: const TextStyle(fontFamily: 'Saqr'))));

class Pad extends StatelessWidget {
  const Pad({super.key, required this.children, this.controller});
  final List<Widget> children;
  final ScrollController? controller;
  @override
  Widget build(BuildContext context) => ListView(controller: controller, padding: const EdgeInsets.fromLTRB(20, 8, 20, 40), children: children);
}

class H1 extends StatelessWidget {
  const H1(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 8),
        child: Text(text, style: Theme.of(context).textTheme.displaySmall),
      );
}

class Lead extends StatelessWidget {
  const Lead(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: Text(text, style: const TextStyle(fontSize: 17, height: 1.5, color: C.ink)),
      );
}

class Badge2 extends StatelessWidget {
  const Badge2(this.text, {super.key, this.bg = C.surface2, this.fg = C.ink});
  final String text;
  final Color bg, fg;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        color: bg,
        child: Text(text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: fg)),
      );
}

/// A reason row: severity-coloured eye bullet + text.
class ReasonRow extends StatelessWidget {
  const ReasonRow(this.r, {super.key});
  final Map<String, dynamic> r;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(top: 7), child: EyeDot(color: C.severity(r['severity'] as String?))),
          const SizedBox(width: 10),
          Expanded(child: Text(Strings.I.reason(r), style: const TextStyle(fontSize: 15, height: 1.45))),
        ]),
      );
}

const _sevOrder = {'high': 0, 'medium': 1, 'low': 2, 'info': 3, 'safe': 4};
List<Map<String, dynamic>> sortedReasons(List<dynamic> rs) {
  final l = rs.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  l.sort((a, b) => (_sevOrder[a['severity']] ?? 5).compareTo(_sevOrder[b['severity']] ?? 5));
  return l;
}

/// The full verdict card, shared by the scan screen and elder mode.
class ResultCard extends StatelessWidget {
  const ResultCard({super.key, required this.result, this.onReport});
  final Map<String, dynamic> result;
  final VoidCallback? onReport;

  @override
  Widget build(BuildContext context) {
    final level = result['level'] as String;
    final score = (result['score'] as num).toInt();
    final entities = (result['entities'] as List?) ?? const [];
    final advice = List<String>.from((result['advice'] as List?) ?? const []);
    return Container(
      color: C.surface,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          color: C.levelBg(level),
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            VerdictEye(score: score, level: level),
            const SizedBox(height: 14),
            Text(t('level_$level'), style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: C.level(level), height: 1.15)),
            const SizedBox(height: 6),
            Text(t('level_${level}_d'), style: const TextStyle(fontSize: 16, height: 1.45)),
            const SizedBox(height: 6),
            Text(t('result_meta', {'s': score, 'type': t('t_${result['detectedType']}')}), style: const TextStyle(fontSize: 13, color: C.muted)),
            if (result['offline'] == true) ...[
              const SizedBox(height: 8),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.cloud_off_outlined, size: 16, color: C.muted),
                const SizedBox(width: 6),
                Expanded(child: Text(t('app_offline_result'), style: const TextStyle(fontSize: 13, color: C.muted, height: 1.4))),
              ]),
            ],
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t('why'), style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            for (final r in sortedReasons(result['reasons'] as List)) ReasonRow(r),
            if (entities.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(t('inside'), style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              for (final e in entities) _Entity(Map<String, dynamic>.from(e as Map)),
            ],
            const SizedBox(height: 12),
            Text(t('what_to_do'), style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            for (var i = 0; i < advice.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SizedBox(width: 22, child: Text('${i + 1}.', style: const TextStyle(fontWeight: FontWeight.w700))),
                  Expanded(child: Text(t(advice[i]), style: const TextStyle(fontSize: 15, height: 1.45))),
                ]),
              ),
            if (onReport != null && level != 'safe') ...[
              const SizedBox(height: 16),
              EyeButton(label: t('report_this'), onPressed: onReport, color: C.danger),
            ],
          ]),
        ),
      ]),
    );
  }
}

class _Entity extends StatelessWidget {
  const _Entity(this.e);
  final Map<String, dynamic> e;
  @override
  Widget build(BuildContext context) {
    final level = e['level'] as String;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      color: C.bg,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Badge2(t('t_${e['type']}')),
          const Spacer(),
          Badge2('${e['score']}', bg: C.levelBg(level), fg: C.level(level)),
        ]),
        const SizedBox(height: 8),
        Directionality(
          textDirection: TextDirection.ltr,
          child: Text(e['input'].toString(), maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
        ),
        const SizedBox(height: 8),
        for (final r in sortedReasons(e['reasons'] as List)) ReasonRow(r),
      ]),
    );
  }
}

/// A dropdown of enum values with translated labels.
class EnumField extends StatelessWidget {
  const EnumField({super.key, required this.label, required this.values, required this.prefix, required this.value, required this.onChanged, this.optional = false});
  final String label, prefix;
  final List<String> values;
  final String? value;
  final ValueChanged<String?> onChanged;
  final bool optional;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: DropdownButtonFormField<String>(
          value: value,
          isExpanded: true,
          decoration: InputDecoration(labelText: label),
          items: [
            if (optional) DropdownMenuItem<String>(value: null, child: Text(t('f_none'))),
            for (final v in values) DropdownMenuItem<String>(value: v, child: Text(t('$prefix$v'))),
          ],
          onChanged: onChanged,
        ),
      );
}
