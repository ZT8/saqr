import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../i18n.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/eye.dart';
import 'report.dart' show kEmirates;

const kPlatforms = ['instagram', 'snapchat', 'whatsapp', 'tiktok', 'telegram', 'x', 'facebook', 'other'];
const kDemands = ['money', 'more_images', 'meeting', 'other'];

/// Pick up to 5 images/PDFs (≤ 5 MB each) and return them base64-encoded for the API.
Future<List<Map<String, String>>> pickEvidence() async {
  final res = await FilePicker.platform.pickFiles(allowMultiple: true, withData: true, type: FileType.custom, allowedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf']);
  if (res == null) return [];
  return res.files
      .where((f) => f.bytes != null && f.size <= 5 * 1024 * 1024)
      .take(5)
      .map((f) => {'name': f.name, 'data': base64Encode(f.bytes!)})
      .toList();
}

/// Confidential extortion help. "Quick exit" closes the screen immediately.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});
  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  bool _track = false;
  // new case
  String? _platform, _demand, _emirate, _error;
  bool _paid = false, _busy = false;
  final _desc = TextEditingController(), _extorter = TextEditingController(), _contact = TextEditingController();
  List<Map<String, String>> _files = [];
  Map<String, dynamic>? _created;
  // tracking
  final _ref = TextEditingController(), _code = TextEditingController();
  Map<String, dynamic>? _status;
  bool _armed = false;

  Future<void> _submit() async {
    setState(() => _error = null);
    if (_platform == null) return setState(() => _error = t('e_invalid_platform'));
    if (_demand == null) return setState(() => _error = t('e_invalid_demand'));
    if (_desc.text.trim().length < 10) return setState(() => _error = t('e_description_short'));
    setState(() => _busy = true);
    try {
      final out = await Api.I.createCase({
        'platform': _platform,
        'demand': _demand,
        'paid': _paid ? 'yes' : 'no',
        if (_emirate != null) 'emirate': _emirate,
        'description': _desc.text.trim(),
        'extorter': _extorter.text.trim(),
        'contact': _contact.text.trim(),
        'files': _files,
      });
      setState(() => _created = out);
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _check() async {
    setState(() => _error = null);
    try {
      final s = await Api.I.caseStatus(_ref.text.trim(), _code.text.trim());
      setState(() {
        _status = s;
        _armed = false;
      });
    } catch (e) {
      setState(() {
        _status = null;
        _error = errText(e);
      });
    }
  }

  Future<void> _addEvidence() async {
    final files = await pickEvidence();
    if (files.isEmpty) return;
    try {
      final s = await Api.I.caseEvidence(_ref.text.trim(), _code.text.trim(), files);
      setState(() => _status = s);
    } catch (e) {
      setState(() => _error = errText(e));
    }
  }

  Future<void> _withdraw() async {
    if (!_armed) return setState(() => _armed = true);
    try {
      await Api.I.caseWithdraw(_ref.text.trim(), _code.text.trim());
      setState(() => _status = {'withdrawn': true});
    } catch (e) {
      setState(() => _error = errText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(actions: [
        Padding(
          padding: const EdgeInsetsDirectional.only(end: 12),
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: C.ink, shape: const RoundedRectangleBorder()),
            // Quick exit: leave this screen at once and land on the neutral scan tab.
            onPressed: () {
              Navigator.of(context).popUntil((r) => r.isFirst);
              AppState.I.go(0);
            },
            child: Text(t('quick_exit')),
          ),
        ),
      ]),
      body: Pad(children: [
        H1(t('help_title')),
        Lead(t('help_sub')),
        for (var i = 1; i <= 4; i++)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(16),
            color: i == 1 ? C.accent : C.surface,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t('hs${i}_t'), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: i == 1 ? Colors.white : C.ink)),
              const SizedBox(height: 4),
              Text(t('hs${i}_d'), style: TextStyle(height: 1.45, color: i == 1 ? Colors.white : C.ink)),
            ]),
          ),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: EyeButton(label: t('app_call999'), color: C.ink, height: 52, onPressed: () => launchUrl(Uri.parse('tel:999')))),
        ]),
        const SizedBox(height: 20),
        SegmentedButton<bool>(
          segments: [ButtonSegment(value: false, label: Text(t('tab_new_case'))), ButtonSegment(value: true, label: Text(t('tab_track_case')))],
          selected: {_track},
          showSelectedIcon: false,
          onSelectionChanged: (s) => setState(() {
            _track = s.first;
            _error = null;
          }),
        ),
        const SizedBox(height: 16),
        if (!_track) ..._newCase() else ..._trackCase(),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_error!, style: const TextStyle(color: C.danger, fontWeight: FontWeight.w600))),
        const SizedBox(height: 20),
        Container(
          color: C.ink,
          padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t('help_safe_t'), style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            for (final k in ['help_safe_1', 'help_safe_2', 'help_safe_3'])
              Padding(padding: const EdgeInsets.only(bottom: 8), child: Text('• ${t(k)}', style: const TextStyle(color: Colors.white, height: 1.45))),
          ]),
        ),
      ]),
    );
  }

  List<Widget> _newCase() {
    if (_created != null) {
      final ref = _created!['ref'] as String, code = _created!['code'] as String;
      return [
        Container(
          color: C.safeBg,
          padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t('case_ok_t'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: C.safe)),
            const SizedBox(height: 12),
            _secret(t('case_ref'), ref),
            const SizedBox(height: 8),
            _secret(t('case_code'), code),
            const SizedBox(height: 10),
            TextButton.icon(
              icon: const Icon(Icons.copy, color: C.ink),
              label: Text(t('copy'), style: const TextStyle(color: C.ink)),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: '${t('case_ref')}: $ref\n${t('case_code')}: $code'));
                toast(context, t('copied'));
              },
            ),
            Text(t('case_ok_d'), style: const TextStyle(height: 1.5)),
          ]),
        ),
      ];
    }
    return [
      EnumField(label: t('f_platform'), values: kPlatforms, prefix: 'pl_', value: _platform, onChanged: (v) => setState(() => _platform = v)),
      EnumField(label: t('f_demand'), values: kDemands, prefix: 'dm_', value: _demand, onChanged: (v) => setState(() => _demand = v)),
      SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(t('f_paid')), value: _paid, activeColor: C.accent, onChanged: (v) => setState(() => _paid = v)),
      EnumField(label: t('f_emirate'), values: kEmirates, prefix: 'em_', value: _emirate, optional: true, onChanged: (v) => setState(() => _emirate = v)),
      TextField(controller: _desc, minLines: 4, maxLines: 8, maxLength: 3000, decoration: InputDecoration(labelText: t('f_case_desc'), alignLabelWithHint: true)),
      const SizedBox(height: 8),
      TextField(controller: _extorter, maxLength: 200, decoration: InputDecoration(labelText: t('f_extorter'))),
      TextField(controller: _contact, maxLength: 200, decoration: InputDecoration(labelText: t('f_contact'), helperText: t('f_contact_hint'), helperMaxLines: 3)),
      const SizedBox(height: 12),
      OutlinedButton.icon(
        style: OutlinedButton.styleFrom(shape: const RoundedRectangleBorder(), foregroundColor: C.ink, side: const BorderSide(color: C.ink)),
        icon: const Icon(Icons.attach_file),
        label: Text(_files.isEmpty ? t('app_pick_files') : t('app_files_n', {'n': _files.length})),
        onPressed: () async {
          final f = await pickEvidence();
          setState(() => _files = f);
        },
      ),
      const SizedBox(height: 6),
      Text(t('files_note'), style: const TextStyle(fontSize: 13, color: C.muted)),
      const SizedBox(height: 16),
      Row(children: [EyeButton(label: t('submit_case'), onPressed: _submit, busy: _busy)]),
    ];
  }

  Widget _secret(String label, String value) => Container(
        width: double.infinity,
        color: C.bg,
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: C.muted, fontSize: 13)),
          Directionality(textDirection: TextDirection.ltr, child: SelectableText(value, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, letterSpacing: 1))),
        ]),
      );

  List<Widget> _trackCase() {
    final s = _status;
    return [
      Directionality(textDirection: TextDirection.ltr, child: TextField(controller: _ref, textCapitalization: TextCapitalization.characters, decoration: InputDecoration(labelText: t('case_ref'), hintText: 'SQR-XXXXXX'))),
      const SizedBox(height: 10),
      Directionality(textDirection: TextDirection.ltr, child: TextField(controller: _code, textCapitalization: TextCapitalization.characters, decoration: InputDecoration(labelText: t('case_code'), hintText: 'XXXX-XXXX'))),
      const SizedBox(height: 14),
      Row(children: [EyeButton(label: t('track'), onPressed: _check, color: C.ink, height: 52)]),
      if (s != null && s['withdrawn'] == true) Padding(padding: const EdgeInsets.only(top: 16), child: Text(t('withdrawn'))),
      if (s != null && s['ref'] != null) ...[
        const SizedBox(height: 16),
        Container(
          color: C.surface,
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${t('case_status')}: ${t('cs_${s['status']}')}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
            const SizedBox(height: 6),
            Text('${t('case_evidence')}: ${s['evidence']} · ${t('case_updated')}: ${Strings.I.date(s['updated_at'] as String)}'),
            if (s['note'] != null) ...[
              const SizedBox(height: 12),
              Container(
                color: C.infoBg,
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(t('case_note'), style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(s['note'].toString()),
                ]),
              ),
            ],
            const SizedBox(height: 12),
            TextButton.icon(icon: const Icon(Icons.attach_file, color: C.ink), label: Text(t('add_evidence'), style: const TextStyle(color: C.ink)), onPressed: _addEvidence),
            TextButton(onPressed: _withdraw, child: Text(_armed ? t('withdraw_confirm') : t('withdraw'), style: const TextStyle(color: C.danger))),
          ]),
        ),
      ],
    ];
  }
}
