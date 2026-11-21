import 'package:flutter/material.dart';

import '../api.dart';
import '../i18n.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/eye.dart';

// Same enums as the server (used until /api/meta answers).
const kCategories = ['fake_fine', 'bank_otp', 'parcel', 'prize', 'investment', 'job', 'impersonation', 'family_emergency', 'shopping', 'other'];
const kChannels = ['sms', 'whatsapp', 'call', 'email', 'social', 'website', 'other'];
const kEmirates = ['abu_dhabi', 'dubai', 'sharjah', 'ajman', 'umm_al_quwain', 'ras_al_khaimah', 'fujairah'];

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key});
  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final _value = TextEditingController();
  final _amount = TextEditingController();
  final _desc = TextEditingController();
  String _type = 'message';
  String? _category, _channel, _emirate, _error;
  bool _busy = false;
  Map<String, dynamic>? _done;

  @override
  void initState() {
    super.initState();
    AppState.I.addListener(_takePrefill);
    final p = AppState.I.prefill;
    if (p != null) {
      AppState.I.prefill = null;
      _type = p['type'] ?? 'message';
      _value.text = p['value'] ?? '';
    }
  }

  @override
  void dispose() {
    AppState.I.removeListener(_takePrefill);
    super.dispose();
  }

  void _takePrefill() {
    final p = AppState.I.prefill;
    if (p == null) return;
    AppState.I.prefill = null;
    setState(() {
      _type = p['type'] ?? 'message';
      _value.text = p['value'] ?? '';
      _done = null;
    });
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (_value.text.trim().isEmpty) return setState(() => _error = t('e_empty_value'));
    if (_category == null) return setState(() => _error = t('e_invalid_category'));
    if (_channel == null) return setState(() => _error = t('e_invalid_channel'));
    setState(() => _busy = true);
    try {
      final out = await Api.I.report({
        'type': _type,
        'value': _value.text.trim(),
        'category': _category,
        'channel': _channel,
        if (_emirate != null) 'emirate': _emirate,
        if (_amount.text.trim().isNotEmpty) 'amount_lost': num.tryParse(_amount.text.trim()) ?? _amount.text.trim(),
        if (_type != 'message' && _desc.text.trim().isNotEmpty) 'description': _desc.text.trim(),
      });
      setState(() => _done = out);
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _reset() => setState(() {
        _done = null;
        _value.clear();
        _amount.clear();
        _desc.clear();
        _category = _channel = _emirate = null;
      });

  @override
  Widget build(BuildContext context) {
    if (_done != null) {
      return Pad(children: [
        H1(t('report_title')),
        Container(
          color: C.safeBg,
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t('report_ok'), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: C.safe)),
            const SizedBox(height: 8),
            Text(t('report_ok_d'), style: const TextStyle(fontSize: 16, height: 1.5)),
            if (_done!['redacted'] == true) ...[
              const SizedBox(height: 10),
              Container(color: C.bg, padding: const EdgeInsets.all(12), child: Text(t('report_redacted'))),
            ],
            const SizedBox(height: 14),
            TextButton(onPressed: _reset, child: Text(t('report_another'), style: const TextStyle(color: C.ink, decoration: TextDecoration.underline))),
          ]),
        ),
      ]);
    }
    return Pad(children: [
      H1(t('report_title')),
      Lead(t('report_sub')),
      EnumField(label: t('f_type'), values: const ['message', 'url', 'phone'], prefix: 't_', value: _type, onChanged: (v) => setState(() => _type = v ?? 'message')),
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: TextField(
          controller: _value,
          minLines: _type == 'message' ? 4 : 1,
          maxLines: _type == 'message' ? 8 : 1,
          keyboardType: _type == 'phone' ? TextInputType.phone : _type == 'url' ? TextInputType.url : TextInputType.multiline,
          decoration: InputDecoration(labelText: t('f_value_$_type'), alignLabelWithHint: true),
        ),
      ),
      EnumField(label: t('f_category'), values: kCategories, prefix: 'cat_', value: _category, onChanged: (v) => setState(() => _category = v)),
      EnumField(label: t('f_channel'), values: kChannels, prefix: 'ch_', value: _channel, onChanged: (v) => setState(() => _channel = v)),
      EnumField(label: t('f_emirate'), values: kEmirates, prefix: 'em_', value: _emirate, optional: true, onChanged: (v) => setState(() => _emirate = v)),
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: TextField(controller: _amount, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: InputDecoration(labelText: t('f_amount'))),
      ),
      if (_type != 'message')
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: TextField(controller: _desc, minLines: 2, maxLines: 4, decoration: InputDecoration(labelText: t('f_desc'))),
        ),
      if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(_error!, style: const TextStyle(color: C.danger, fontWeight: FontWeight.w600))),
      Row(children: [EyeButton(label: t('submit_report'), onPressed: _submit, busy: _busy, color: C.ink)]),
      const SizedBox(height: 28),
      Container(
        color: C.ink,
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t('privacy_title'), style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          for (final k in ['privacy_1', 'privacy_2', 'privacy_3'])
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Padding(padding: EdgeInsets.only(top: 7), child: EyeDot(color: C.accent)),
                const SizedBox(width: 10),
                Expanded(child: Text(t(k), style: const TextStyle(color: Colors.white, height: 1.45))),
              ]),
            ),
        ]),
      ),
    ]);
  }
}
