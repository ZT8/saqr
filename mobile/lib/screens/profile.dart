import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../widgets.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SafeArea(
      child: Loader<List<Map<String, dynamic>>>(
        load: () async {
          await session.refresh();
          return (await api.get('/auth/cars') as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        },
        builder: (context, cars, reload) {
          final u = session.user ?? {};
          final balance = (u['gift_balance'] as num?) ?? 0;
          return ListView(padding: const EdgeInsets.fromLTRB(20, 12, 20, 24), children: [
            Row(children: [
              CircleAvatar(radius: 32, backgroundColor: AppColors.accentSoft, child: const Icon(Icons.person_rounded, size: 32, color: AppColors.deep)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(session.name, style: t.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                  Text('${u['phone'] ?? ''}', textDirection: TextDirection.ltr, style: t.bodyMedium?.copyWith(color: AppColors.muted)),
                ]),
              ),
            ]),
            if (balance > 0) ...[
              const SizedBox(height: 16),
              Card(child: ListTile(leading: const Icon(Icons.card_giftcard_rounded, color: AppColors.deep), title: const Text('رصيد الهدايا'), trailing: Text(aed(balance)))),
            ],
            const SizedBox(height: 20),
            Text('سياراتي', style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (cars.isEmpty) Text('ما أضفت سيارة بعد. تقدر تضيفها وقت الطلب.', style: t.bodyMedium?.copyWith(color: AppColors.muted)),
            for (final c in cars)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  child: ListTile(
                    leading: const Icon(Icons.directions_car_rounded, color: AppColors.deep),
                    title: Text(c['label'] as String? ?? ''),
                    subtitle: Text(c['plate'] as String? ?? ''),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline_rounded),
                      onPressed: () async {
                        try {
                          await api.delete('/auth/cars/${c['id']}');
                          reload();
                        } catch (e) {
                          if (context.mounted) toast(context, e);
                        }
                      },
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 24),
            OutlinedButton.icon(onPressed: () => session.signOut(), icon: const Icon(Icons.logout_rounded), label: const Text('تسجيل الخروج')),
          ]);
        },
      ),
    );
  }
}
