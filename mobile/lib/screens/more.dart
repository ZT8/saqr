import 'package:flutter/material.dart';

import '../i18n.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/eye.dart';
import 'elder.dart';
import 'family.dart';
import 'help.dart';
import 'settings.dart';
import 'tips.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    Widget tile(String title, String sub, Widget page, {Color bg = C.surface, Color fg = C.ink}) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Material(
            color: bg,
            child: InkWell(
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page)),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Row(children: [
                  EyeDot(color: fg == C.ink ? C.accent : Colors.white, width: 22),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(title, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: fg)),
                      if (sub.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(sub, style: TextStyle(fontSize: 14, height: 1.4, color: fg == C.ink ? C.muted : Colors.white70)),
                      ],
                    ]),
                  ),
                  Icon(Directionality.of(context) == TextDirection.rtl ? Icons.chevron_left : Icons.chevron_right, color: fg),
                ]),
              ),
            ),
          ),
        );
    return Pad(children: [
      H1(t('app_more')),
      const SizedBox(height: 8),
      tile(t('nav_help'), t('app_help_d'), const HelpScreen(), bg: C.accent, fg: Colors.white),
      tile(t('fam_title'), t('app_family_d'), const FamilyScreen()),
      tile(t('app_elder_mode'), t('app_elder_d'), const ElderScreen()),
      tile(t('tips_title'), '', const TipsScreen()),
      tile(t('app_settings'), '', const SettingsScreen()),
    ]);
  }
}
