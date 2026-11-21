import 'package:flutter/material.dart';

import '../api.dart';
import '../i18n.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/eye.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final _server = TextEditingController(text: Api.I.base);
  String? _status;

  Future<void> _save() async {
    await Api.I.setBase(_server.text);
    try {
      await Api.I.stats();
      final m = await Api.I.i18n();
      Strings.I.update(m);
      AppState.I.refresh();
      setState(() => _status = t('app_saved'));
    } catch (e) {
      setState(() => _status = errText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Pad(children: [
        H1(t('app_settings')),
        const SizedBox(height: 8),
        Text(t('app_language'), style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        SegmentedButton<String>(
          segments: const [ButtonSegment(value: 'ar', label: Text('العربية')), ButtonSegment(value: 'en', label: Text('English'))],
          selected: {Strings.I.lang},
          showSelectedIcon: false,
          onSelectionChanged: (s) {
            AppState.I.setLang(s.first);
            setState(() {});
          },
        ),
        const SizedBox(height: 24),
        Text(t('app_server'), style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Directionality(
          textDirection: TextDirection.ltr,
          child: TextField(controller: _server, keyboardType: TextInputType.url, autocorrect: false, decoration: const InputDecoration(hintText: 'https://')),
        ),
        const SizedBox(height: 6),
        Text(t('app_server_hint'), style: const TextStyle(fontSize: 13, color: C.muted)),
        const SizedBox(height: 16),
        Row(children: [EyeButton(label: t('app_save'), onPressed: _save, color: C.ink)]),
        if (_status != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_status!)),
        const SizedBox(height: 32),
        Text('${t('app_version')} 1.0.0', style: const TextStyle(color: C.muted, fontSize: 13)),
        const SizedBox(height: 6),
        Text(t('foot_demo'), style: const TextStyle(color: C.muted, fontSize: 13, height: 1.5)),
      ]),
    );
  }
}
