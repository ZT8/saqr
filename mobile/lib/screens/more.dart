import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../widgets.dart';
import 'checkout.dart' show emirates;
import 'gifts.dart';
import 'loyalty.dart';
import 'orders.dart';
import 'social.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SafeArea(
      child: Loader<Map<String, dynamic>>(
        load: () async {
          await session.refresh();
          return session.user ?? {};
        },
        builder: (context, me, reload) {
          final tier = me['tier'] as Map?;
          final unread = (me['unread_notifications'] as num?)?.toInt() ?? 0;
          void go(Widget w) async {
            await Navigator.push(context, MaterialPageRoute(builder: (_) => w));
            reload();
          }

          final rows = <List<Object>>[
            [Icons.star_rounded, 'الولاء والعضوية', 'العضوية ${tier?['name'] ?? ''}', const LoyaltyScreen()],
            [Icons.card_giftcard_rounded, 'الهدايا', 'رصيدك ${aed((me['gift_balance'] as num?) ?? 0)}', const GiftsScreen()],
            [Icons.directions_car_rounded, 'سياراتي', 'عشان الفرع يعرفك', const CarsScreen()],
            [Icons.receipt_long_rounded, 'طلباتي', '', const Scaffold(body: OrdersScreen())],
            [Icons.emoji_events_rounded, 'ملفي في Around Social', '${me['posts'] ?? 0} منشور · ${me['followers'] ?? 0} متابِع', UserProfileScreen(id: (me['id'] as num).toInt())],
            [Icons.notifications_none_rounded, 'الإشعارات', unread > 0 ? '$unread جديدة' : '', const NotificationsScreen()],
            [Icons.person_outline_rounded, 'تعديل الملف', '', const EditProfileScreen()],
          ];
          return ListView(padding: const EdgeInsets.fromLTRB(20, 12, 20, 24), children: [
            Text('المزيد', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(children: [
                  UserAvatar(me, size: 56),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${me['name'] ?? ''}', style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      Text('${me['phone'] ?? ''}${me['username'] != null ? ' · @${me['username']}' : ''}', textDirection: TextDirection.ltr, style: t.bodySmall?.copyWith(color: AppColors.muted)),
                    ]),
                  ),
                  if (tier != null) Pill('${tier['name']}', bg: AppColors.accentSoft, fg: AppColors.accentInk),
                ]),
              ),
            ),
            const SizedBox(height: 14),
            Card(
              child: Column(children: [
                for (final r in rows)
                  ListTile(
                    onTap: () => go(r[3] as Widget),
                    leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.accentSoft, borderRadius: BorderRadius.circular(12)), child: Icon(r[0] as IconData, color: AppColors.deep)),
                    title: Text(r[1] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: (r[2] as String).isEmpty ? null : Text(r[2] as String),
                    trailing: const Icon(Icons.chevron_left_rounded, color: AppColors.muted),
                  ),
              ]),
            ),
            const SizedBox(height: 18),
            OutlinedButton.icon(onPressed: () => session.signOut(), icon: const Icon(Icons.logout_rounded), label: const Text('تسجيل الخروج')),
            const SizedBox(height: 14),
            Center(child: Text('Around · الإصدار 1.0', style: t.labelSmall?.copyWith(color: AppColors.muted))),
          ]);
        },
      ),
    );
  }
}

// ----------------------------------------------------------------------- cars

class CarsScreen extends StatefulWidget {
  const CarsScreen({super.key});
  @override
  State<CarsScreen> createState() => _CarsScreenState();
}

class _CarsScreenState extends State<CarsScreen> {
  List<Map<String, dynamic>>? cars;
  Object? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final c = maps(await api.get('/auth/cars'));
      if (mounted) setState(() { cars = c; error = null; });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _add() async {
    final make = TextEditingController();
    final color = TextEditingController();
    final code = TextEditingController();
    final number = TextEditingController();
    var emirate = emirates.first;
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.ground,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (c) => StatefulBuilder(
        builder: (c, setS) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(c).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('إضافة سيارة', style: Theme.of(c).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            TextField(controller: make, decoration: const InputDecoration(labelText: 'النوع (مثلاً تويوتا لاندكروزر)')),
            const SizedBox(height: 10),
            TextField(controller: color, decoration: const InputDecoration(labelText: 'اللون')),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              value: emirate,
              decoration: const InputDecoration(labelText: 'إمارة اللوحة'),
              items: [for (final e in emirates) DropdownMenuItem(value: e, child: Text(e))],
              onChanged: (v) => setS(() => emirate = v ?? emirate),
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: TextField(controller: code, textDirection: TextDirection.ltr, maxLength: 3, decoration: const InputDecoration(labelText: 'الرمز', counterText: ''))),
              const SizedBox(width: 10),
              Expanded(flex: 2, child: TextField(controller: number, keyboardType: TextInputType.number, maxLength: 5, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'رقم اللوحة', counterText: ''))),
            ]),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () async {
                try {
                  await api.post('/auth/cars', {'make': make.text, 'color': color.text, 'plate_emirate': emirate, 'plate_code': code.text, 'plate_number': number.text});
                  if (c.mounted) Navigator.pop(c, true);
                } catch (e) {
                  if (c.mounted) toast(c, e);
                }
              },
              child: const Text('حفظ السيارة'),
            ),
          ]),
        ),
      ),
    );
    if (saved == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('سياراتي')),
      floatingActionButton: FloatingActionButton.extended(onPressed: _add, backgroundColor: AppColors.accent, foregroundColor: AppColors.accentInk, icon: const Icon(Icons.add_rounded), label: const Text('أضف سيارة')),
      body: cars == null
          ? (error != null ? ErrorView(error!, _load) : const Center(child: CircularProgressIndicator(color: AppColors.deep)))
          : cars!.isEmpty
              ? const EmptyState(Icons.directions_car_outlined, 'ما أضفت سيارة بعد', hint: 'أضف سيارتك عشان الفرع يعرفك وقت الاستلام')
              : ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 90), children: [
                  for (final c in cars!)
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
                                _load();
                              } catch (e) {
                                if (context.mounted) toast(context, e);
                              }
                            },
                          ),
                        ),
                      ),
                    ),
                ]),
    );
  }
}

// -------------------------------------------------------------- notifications

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الإشعارات')),
      body: Loader<List<Map<String, dynamic>>>(
        load: () async {
          final r = maps(await api.get('/auth/notifications'));
          session.refresh().catchError((_) {});
          return r;
        },
        builder: (context, list, reload) => list.isEmpty
            ? const EmptyState(Icons.notifications_none_rounded, 'ما فيه إشعارات')
            : RefreshIndicator(
                color: AppColors.deep,
                onRefresh: reload,
                child: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 24), children: [
                  for (final n in list)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Card(
                        child: ListTile(
                          leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.accentSoft, borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.notifications_rounded, color: AppColors.deep)),
                          title: Text('${n['title']}', style: TextStyle(fontWeight: n['is_read'] == 1 ? FontWeight.w500 : FontWeight.w700)),
                          subtitle: Text([if ((n['body'] as String? ?? '').isNotEmpty) n['body'], ago(n['created_at'] as String?)].join('\n')),
                          isThreeLine: (n['body'] as String? ?? '').isNotEmpty,
                        ),
                      ),
                    ),
                ]),
              ),
      ),
    );
  }
}

// ---------------------------------------------------------------- edit profile

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});
  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final name = TextEditingController(text: session.user?['name'] as String? ?? '');
  late final username = TextEditingController(text: session.user?['username'] as String? ?? '');
  bool busy = false;

  Future<void> _avatar() async {
    try {
      final f = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 800, imageQuality: 85);
      if (f == null) return;
      setState(() => busy = true);
      await api.upload('/auth/me/avatar', f.path);
      await session.refresh();
      if (mounted) toast(context, 'تغيّرت صورتك');
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _save() async {
    setState(() => busy = true);
    try {
      final u = username.text.trim();
      await api.patch('/auth/me', {'name': name.text.trim(), 'username': u.isEmpty ? null : u});
      await session.refresh();
      if (!mounted) return;
      toast(context, 'حفظنا التعديلات');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('تعديل الملف')),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        Center(
          child: InkWell(
            onTap: busy ? null : _avatar,
            customBorder: const CircleBorder(),
            child: Column(children: [
              UserAvatar(session.user, size: 96),
              const SizedBox(height: 8),
              Text('تغيير الصورة', style: Theme.of(context).textTheme.labelLarge?.copyWith(color: AppColors.deep, fontWeight: FontWeight.w700)),
            ]),
          ),
        ),
        const SizedBox(height: 20),
        TextField(controller: name, maxLength: 40, decoration: const InputDecoration(labelText: 'الاسم', counterText: '')),
        const SizedBox(height: 12),
        TextField(
          controller: username,
          maxLength: 20,
          textDirection: TextDirection.ltr,
          decoration: const InputDecoration(labelText: 'اسم المستخدم', prefixText: '@', counterText: ''),
          onChanged: (v) {
            final c = v.toLowerCase().replaceAll(RegExp(r'[^a-z0-9_.]'), '');
            if (c != v) username.value = TextEditingValue(text: c, selection: TextSelection.collapsed(offset: c.length));
          },
        ),
        const SizedBox(height: 20),
        FilledButton(onPressed: busy ? null : _save, child: const Text('حفظ')),
      ]),
    );
  }
}
