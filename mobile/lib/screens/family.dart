import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../api.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/eye.dart';

/// Guardian side: create a protection link for a parent's phone and see their alerts.
class FamilyScreen extends StatefulWidget {
  const FamilyScreen({super.key});
  @override
  State<FamilyScreen> createState() => _FamilyScreenState();
}

class _FamilyScreenState extends State<FamilyScreen> {
  Map<String, dynamic>? _g; // {token, label, elderLink}
  Map<String, dynamic>? _data;
  final _label = TextEditingController();
  String? _error;
  bool _busy = false, _armed = false, _showLink = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    final raw = Api.I.pref('guardian');
    if (raw != null) _g = Map<String, dynamic>.from(jsonDecode(raw) as Map);
    _poll();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _poll());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _poll() async {
    if (_g == null) return;
    try {
      final d = await Api.I.familyAlerts(_g!['token'] as String);
      if (mounted) setState(() => _data = d);
    } on ApiError catch (e) {
      if (e.status == 401) {
        await Api.I.setPref('guardian', null);
        if (mounted) setState(() => _g = null);
      }
    } catch (_) {}
  }

  Future<void> _create() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final out = await Api.I.familyCreate(_label.text.trim());
      final g = {'token': out['guardianToken'], 'label': out['label'], 'elderLink': out['elderLink']};
      await Api.I.setPref('guardian', jsonEncode(g));
      setState(() {
        _g = g;
        _showLink = true;
      });
      _poll();
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _unlink() async {
    if (!_armed) return setState(() => _armed = true);
    try {
      await Api.I.familyDelete(_g!['token'] as String);
    } catch (_) {}
    await Api.I.setPref('guardian', null);
    setState(() {
      _g = null;
      _data = null;
      _armed = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: RefreshIndicator(
        onRefresh: _poll,
        child: Pad(children: [
          H1(t('fam_title')),
          Lead(t('fam_sub')),
          if (_g == null) ...[
            TextField(controller: _label, maxLength: 40, decoration: InputDecoration(labelText: t('fam_label'))),
            if (_error != null) Text(_error!, style: const TextStyle(color: C.danger)),
            const SizedBox(height: 12),
            Row(children: [EyeButton(label: t('fam_create'), onPressed: _create, busy: _busy)]),
          ] else ...[
            if (_showLink) _pairCard(),
            Row(children: [
              Expanded(child: Text(t('fam_alerts'), style: Theme.of(context).textTheme.headlineMedium)),
              if ((_data?['unseen'] ?? 0) > 0) Badge2('${_data!['unseen']}', bg: C.accent, fg: Colors.white),
            ]),
            const SizedBox(height: 8),
            Wrap(spacing: 4, children: [
              TextButton(onPressed: () async {
                await Api.I.familySeen(_g!['token'] as String).catchError((_) {});
                _poll();
              }, child: Text(t('fam_mark_seen'), style: const TextStyle(color: C.ink))),
              TextButton(onPressed: () => setState(() => _showLink = !_showLink), child: Text(t('fam_show_link'), style: const TextStyle(color: C.ink))),
            ]),
            const SizedBox(height: 8),
            if (_data == null) const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator(color: C.accent))),
            if (_data != null && (_data!['items'] as List).isEmpty)
              Container(color: C.surface, padding: const EdgeInsets.all(24), child: Text(t('fam_none'), textAlign: TextAlign.center)),
            if (_data != null) for (final a in _data!['items'] as List) _Alert(Map<String, dynamic>.from(a as Map), _data!['label'] as String),
            const SizedBox(height: 12),
            Text(t('fam_privacy'), style: const TextStyle(fontSize: 13, color: C.muted, height: 1.5)),
            const SizedBox(height: 12),
            TextButton(onPressed: _unlink, child: Text(_armed ? t('fam_delete_confirm') : t('fam_delete'), style: const TextStyle(color: C.danger))),
          ],
        ]),
      ),
    );
  }

  Widget _pairCard() {
    final link = _g!['elderLink'] as String;
    return Container(
      color: C.surface,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(t('fam_pair_t', {'label': _g!['label']}), style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        Text(t('fam_pair_d')),
        const SizedBox(height: 12),
        Center(child: Container(color: Colors.white, padding: const EdgeInsets.all(10), child: QrImageView(data: link, size: 200))),
        const SizedBox(height: 10),
        Directionality(textDirection: TextDirection.ltr, child: SelectableText(link, style: const TextStyle(fontSize: 12))),
        const SizedBox(height: 8),
        Wrap(spacing: 8, children: [
          TextButton.icon(icon: const Icon(Icons.copy, color: C.ink), label: Text(t('copy'), style: const TextStyle(color: C.ink)), onPressed: () {
            Clipboard.setData(ClipboardData(text: link));
            toast(context, t('copied'));
          }),
          TextButton.icon(icon: const Icon(Icons.share, color: C.ink), label: Text(t('app_share_link'), style: const TextStyle(color: C.ink)), onPressed: () => SharePlus.instance.share(ShareParams(text: link))),
        ]),
      ]),
    );
  }
}

class _Alert extends StatelessWidget {
  const _Alert(this.a, this.label);
  final Map<String, dynamic> a;
  final String label;
  @override
  Widget build(BuildContext context) {
    final help = a['kind'] == 'help';
    final level = a['level'] as String?;
    final text = help ? t('al_help', {'label': label}) : t('al_scan', {'label': label, 'type': t('t_${a['input_type']}'), 'level': t('level_$level')});
    final fg = help ? Colors.white : C.ink;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      color: help ? C.accent : (a['seen'] == true ? C.surface : const Color(0xFFFFF3F2)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (a['seen'] != true) const Padding(padding: EdgeInsetsDirectional.only(top: 6, end: 8), child: EyeDot(color: C.accent, width: 16)),
          Expanded(child: Text(text, style: TextStyle(fontWeight: FontWeight.w700, color: fg))),
          if (a['score'] != null) Badge2('${a['score']}', bg: C.levelBg(level), fg: C.level(level)),
        ]),
        if (a['shared_text'] != null) ...[
          const SizedBox(height: 8),
          Container(color: C.bg, padding: const EdgeInsets.all(10), child: Text(a['shared_text'].toString(), maxLines: 4, overflow: TextOverflow.ellipsis)),
        ],
        const SizedBox(height: 6),
        Text(Strings.I.date(a['created_at'] as String), style: TextStyle(fontSize: 12, color: help ? Colors.white70 : C.muted)),
      ]),
    );
  }
}
