import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/config.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

enum _Step { phone, code, name }

class _LoginScreenState extends State<LoginScreen> {
  final phone = TextEditingController();
  final code = TextEditingController();
  final name = TextEditingController();
  _Step step = _Step.phone;
  bool busy = false;
  String? devCode;

  Future<void> run(Future<void> Function() f) async {
    setState(() => busy = true);
    try {
      await f();
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> requestCode() => run(() async {
        final r = await api.post('/auth/otp/request', {'phone': phone.text.trim()});
        devCode = (r as Map)['dev_code'] as String?;
        setState(() => step = _Step.code);
      });

  Future<void> verify() => run(() async {
        final r = await api.post('/auth/otp/verify', {'phone': phone.text.trim(), 'code': code.text.trim()}) as Map;
        final user = Map<String, dynamic>.from(r['user'] as Map);
        if (r['is_new'] == true) {
          // Keep the token for the name call, but only show the app once the name is saved.
          api.token = r['token'] as String;
          pending = {'token': r['token'], 'user': user};
          setState(() => step = _Step.name);
        } else {
          await session.signIn(r['token'] as String, user);
        }
      });

  Map<String, dynamic>? pending;

  Future<void> saveName() => run(() async {
        final n = name.text.trim();
        if (n.isEmpty) throw ApiException('اكتب اسمك', 400);
        final u = await api.patch('/auth/me', {'name': n}) as Map;
        await session.signIn(pending!['token'] as String, Map<String, dynamic>.from(u));
        await session.refresh();
      });

  Future<void> serverDialog() async {
    final c = TextEditingController(text: apiBase);
    final v = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('عنوان الخادم'),
        content: TextField(
          controller: c,
          autofocus: true,
          keyboardType: TextInputType.url,
          textDirection: TextDirection.ltr,
          decoration: const InputDecoration(hintText: 'https://xxxx.trycloudflare.com'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          TextButton(onPressed: () => Navigator.pop(ctx, c.text), child: const Text('حفظ')),
        ],
      ),
    );
    if (v == null) return;
    await saveServer(v);
    if (!mounted) return;
    setState(() {});
    toast(context, 'تم حفظ الخادم');
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      backgroundColor: AppColors.deep,
      body: Column(children: [
        Expanded(
          child: SafeArea(
            bottom: false,
            child: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                GestureDetector(
                  onLongPress: serverDialog,
                  child: Container(
                  width: 92,
                  height: 92,
                  decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 7)),
                  child: Align(
                    alignment: const Alignment(.75, -.75),
                    child: Container(width: 22, height: 22, decoration: const BoxDecoration(color: AppColors.accent, shape: BoxShape.circle)),
                  ),
                )),
                const SizedBox(height: 18),
                Text('around', style: t.displaySmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w700, letterSpacing: -1)),
                const SizedBox(height: 6),
                Text('طلبك يوصل قبلك', style: t.titleMedium?.copyWith(color: Colors.white70)),
              ]),
            ),
          ),
        ),
        Container(
          width: double.infinity,
          padding: EdgeInsets.fromLTRB(24, 28, 24, 24 + MediaQuery.of(context).viewInsets.bottom),
          decoration: const BoxDecoration(color: AppColors.ground, borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
          child: SafeArea(top: false, child: _form(t)),
        ),
      ]),
    );
  }

  Widget _form(TextTheme t) {
    switch (step) {
      case _Step.phone:
        return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('سجّل دخولك', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text('نرسل لك رمز تحقق على رقم هاتفك', style: t.bodyMedium?.copyWith(color: AppColors.muted)),
          const SizedBox(height: 18),
          TextField(
            controller: phone,
            keyboardType: TextInputType.phone,
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(hintText: '5X XXX XXXX', prefixText: '+971  '),
            onSubmitted: (_) => requestCode(),
          ),
          const SizedBox(height: 14),
          FilledButton(onPressed: busy ? null : requestCode, child: const Text('أرسل الرمز')),
        ]);
      case _Step.code:
        return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('رمز التحقق', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text('أرسلنا رمز من 4 أرقام إلى ${phone.text.trim()}', style: t.bodyMedium?.copyWith(color: AppColors.muted)),
          if (devCode != null) Text('وضع التطوير: الرمز $devCode', style: t.bodySmall?.copyWith(color: AppColors.muted)),
          const SizedBox(height: 18),
          TextField(
            controller: code,
            keyboardType: TextInputType.number,
            maxLength: 4,
            textAlign: TextAlign.center,
            textDirection: TextDirection.ltr,
            style: t.headlineMedium?.copyWith(letterSpacing: 12),
            decoration: const InputDecoration(counterText: ''),
            onSubmitted: (_) => verify(),
          ),
          const SizedBox(height: 14),
          FilledButton(onPressed: busy ? null : verify, child: const Text('تأكيد')),
          TextButton(onPressed: () => setState(() => step = _Step.phone), child: const Text('تغيير الرقم')),
        ]);
      case _Step.name:
        return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('وش اسمك؟', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 18),
          TextField(controller: name, maxLength: 40, decoration: const InputDecoration(hintText: 'الاسم', counterText: ''), onSubmitted: (_) => saveName()),
          const SizedBox(height: 14),
          FilledButton(onPressed: busy ? null : saveName, child: const Text('ابدأ')),
        ]);
    }
  }
}
