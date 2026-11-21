import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../i18n.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/eye.dart';

class TipsScreen extends StatelessWidget {
  const TipsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Pad(children: [
        H1(t('tips_title')),
        for (var i = 1; i <= 6; i++)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(18),
            color: i == 6 ? C.accent : C.surface,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t('tip${i}_t'), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: i == 6 ? Colors.white : C.ink)),
              const SizedBox(height: 6),
              Text(t('tip${i}_d'), style: TextStyle(fontSize: 15, height: 1.5, color: i == 6 ? Colors.white : C.ink)),
            ]),
          ),
        const SizedBox(height: 8),
        Row(children: [EyeButton(label: t('app_call999'), color: C.ink, onPressed: () => launchUrl(Uri.parse('tel:999')))]),
      ]),
    );
  }
}
