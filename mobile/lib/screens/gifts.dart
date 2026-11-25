import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/cart.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../widgets.dart';
import 'checkout.dart';

const _designs = {
  'green': [AppColors.deep, AppColors.accent],
  'orange': [AppColors.accent, AppColors.accentInk],
  'sand': [Color(0xFFE8E4D6), AppColors.ink],
};

class GiftCard extends StatelessWidget {
  final Map<String, dynamic> g;
  final bool compact;
  const GiftCard(this.g, {super.key, this.compact = false});
  @override
  Widget build(BuildContext context) {
    final c = _designs[g['design']] ?? _designs['green']!;
    final sender = (g['sender'] as Map?)?['name'] ?? 'Around';
    final title = g['kind'] == 'item' ? '${(g['item'] as Map?)?['name'] ?? ''} عليّ' : aed((g['amount'] as num?) ?? 0);
    final msg = (g['message'] as String?) ?? '';
    return Container(
      width: double.infinity,
      constraints: BoxConstraints(minHeight: compact ? 150 : 200),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: c[0], borderRadius: BorderRadius.circular(26)),
      child: DefaultTextStyle.merge(
        style: TextStyle(color: c[1]),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Expanded(child: Text('هدية من $sender', style: const TextStyle(fontWeight: FontWeight.w600))), Icon(Icons.card_giftcard_rounded, color: c[1])]),
          const SizedBox(height: 22),
          Text(title, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, height: 1.2)),
          if (msg.isNotEmpty) ...[const SizedBox(height: 8), Text('«$msg»')],
        ]),
      ),
    );
  }
}

class GiftsScreen extends StatefulWidget {
  const GiftsScreen({super.key});
  @override
  State<GiftsScreen> createState() => _GiftsScreenState();
}

class _GiftsScreenState extends State<GiftsScreen> {
  String tab = 'received';
  List<Map<String, dynamic>>? received;
  List<Map<String, dynamic>>? sent;
  Object? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = maps(await api.get('/gifts/received'));
      final s = maps(await api.get('/gifts/sent'));
      await session.refresh();
      if (mounted) setState(() { received = r; sent = s; error = null; });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _use(Map<String, dynamic> g) async {
    try {
      final s = Map<String, dynamic>.from(await api.get('/stores/${(g['merchant'] as Map)['id']}') as Map);
      final b = maps(s['branches']).first;
      cart.start(s['id'] as int, b['id'] as int, s['name'] as String);
      cart.giftId = g['id'] as int;
      if (mounted) {
        await Navigator.push(context, MaterialPageRoute(builder: (_) => const CheckoutScreen()));
        _load();
      }
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = tab == 'received' ? received : sent;
    final balance = (session.user?['gift_balance'] as num?) ?? 0;
    return Scaffold(
      appBar: AppBar(title: const Text('الهدايا')),
      body: received == null
          ? (error != null ? ErrorView(error!, _load) : const Center(child: CircularProgressIndicator(color: AppColors.deep)))
          : RefreshIndicator(
              color: AppColors.deep,
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 24), children: [
                Card(
                  color: AppColors.accentSoft,
                  child: ListTile(
                    leading: const Icon(Icons.account_balance_wallet_rounded, color: AppColors.accentInk),
                    title: const Text('رصيد الهدايا', style: TextStyle(fontSize: 13, color: AppColors.accentInk)),
                    subtitle: Text(aed(balance), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.ink)),
                    trailing: const Text('ينخصم عند الدفع', style: TextStyle(fontSize: 11, color: AppColors.accentInk)),
                  ),
                ),
                const SizedBox(height: 12),
                Material(
                  color: AppColors.deep,
                  borderRadius: BorderRadius.circular(24),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(24),
                    onTap: () async {
                      await Navigator.push(context, MaterialPageRoute(builder: (_) => const SendGiftScreen()));
                      _load();
                    },
                    child: const Padding(
                      padding: EdgeInsets.all(22),
                      child: Column(children: [
                        Icon(Icons.card_giftcard_rounded, color: AppColors.accent, size: 38),
                        SizedBox(height: 8),
                        Text('أرسل هدية', style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w700)),
                        SizedBox(height: 4),
                        Text('مبلغ، أو مشروب وأكل من محلك المفضل، لأي رقم هاتف أو حساب', textAlign: TextAlign.center, style: TextStyle(color: Colors.white70, fontSize: 13)),
                      ]),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                SegmentedButton<String>(
                  segments: const [ButtonSegment(value: 'received', label: Text('وصلتني')), ButtonSegment(value: 'sent', label: Text('أرسلتها'))],
                  selected: {tab},
                  onSelectionChanged: (s) => setState(() => tab = s.first),
                  showSelectedIcon: false,
                ),
                const SizedBox(height: 14),
                if (list == null || list.isEmpty)
                  EmptyState(Icons.card_giftcard_rounded, tab == 'received' ? 'ما وصلتك هدايا للحين' : 'ما أرسلت هدايا للحين')
                else
                  for (final g in list)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        GestureDetector(onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => GiftViewScreen(id: g['id'] as int))), child: GiftCard(g, compact: true)),
                        const SizedBox(height: 6),
                        Row(children: [
                          Expanded(
                            child: Text(
                              tab == 'sent' ? 'إلى ${(g['recipient'] as Map?)?['name'] ?? g['recipient_phone']}' : ago(g['created_at'] as String?),
                              style: const TextStyle(fontSize: 13, color: AppColors.muted),
                            ),
                          ),
                          if (tab == 'received' && g['kind'] == 'item')
                            g['status'] == 'sent'
                                ? FilledButton(onPressed: () => _use(g), style: FilledButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 16)), child: const Text('استخدم الهدية'))
                                : const Pill('مستخدمة'),
                          if (tab == 'received' && g['kind'] == 'amount') const Pill('انضافت لرصيدك', bg: AppColors.accentSoft, fg: AppColors.accentInk),
                        ]),
                      ]),
                    ),
              ]),
            ),
    );
  }
}

class GiftViewScreen extends StatelessWidget {
  final int id;
  const GiftViewScreen({super.key, required this.id});
  @override
  Widget build(BuildContext context) {
    Widget row(String l, Widget v) => Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(l, style: const TextStyle(color: AppColors.muted)), v]));
    return Scaffold(
      appBar: AppBar(title: const Text('هدية')),
      body: Loader<Map<String, dynamic>>(
        load: () async => Map<String, dynamic>.from(await api.get('/gifts/$id') as Map),
        builder: (context, g, _) => ListView(padding: const EdgeInsets.all(20), children: [
          GiftCard(g),
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(children: [
                row('من', Text('${(g['sender'] as Map?)?['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700))),
                row('إلى', Text('${(g['recipient'] as Map?)?['name'] ?? g['recipient_phone'] ?? ''}', textDirection: TextDirection.ltr, style: const TextStyle(fontWeight: FontWeight.w700))),
                if (g['kind'] == 'item') row('المحل', Text('${(g['merchant'] as Map?)?['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700))),
                row('صالحة حتى', Text(g['expires_at'] != null ? dateShort(g['expires_at'] as String?) : '—', style: const TextStyle(fontWeight: FontWeight.w700))),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

class SendGiftScreen extends StatefulWidget {
  const SendGiftScreen({super.key});
  @override
  State<SendGiftScreen> createState() => _SendGiftScreenState();
}

class _SendGiftScreenState extends State<SendGiftScreen> {
  String kind = 'item';
  int amount = 50;
  String design = 'green';
  String by = 'phone';
  final to = TextEditingController();
  final msg = TextEditingController();
  String method = 'apple_pay';
  List<Map<String, dynamic>> stores = [];
  int? storeId;
  Map<String, dynamic>? store;
  int? itemId;
  bool busy = false;
  Map<String, dynamic>? done;

  @override
  void initState() {
    super.initState();
    _stores();
  }

  Future<void> _stores() async {
    try {
      final s = maps(await api.get('/stores'));
      if (!mounted) return;
      setState(() => stores = s);
      if (s.isNotEmpty) _pickStore(s.first['id'] as int);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _pickStore(int id) async {
    setState(() { storeId = id; itemId = null; store = null; });
    try {
      final d = Map<String, dynamic>.from(await api.get('/stores/$id') as Map);
      if (mounted && storeId == id) setState(() => store = d);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  List<Map<String, dynamic>> get items => store == null ? [] : maps(store!['menu']).expand((c) => maps(c['items'])).where((i) => i['is_available'] == true).toList();
  Map<String, dynamic>? get item {
    final l = items;
    if (l.isEmpty) return null;
    return l.firstWhere((i) => i['id'] == itemId, orElse: () => l.first);
  }

  int get price => kind == 'item' ? ((item?['price'] as num?)?.toInt() ?? 0) : amount * 100;

  Future<void> _send() async {
    if (to.text.trim().isEmpty || price == 0) return;
    setState(() => busy = true);
    try {
      final g = Map<String, dynamic>.from(await api.post('/gifts', {
        'kind': kind,
        'amount': amount,
        if (kind == 'item') 'item_id': item?['id'],
        'message': msg.text.trim(),
        'design': design,
        'payment_method': method,
        if (by == 'phone') 'recipient_phone': to.text.trim() else 'recipient_username': to.text.trim(),
      }) as Map);
      if (mounted) setState(() => done = g);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = done;
    if (d != null) {
      return Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(width: 88, height: 88, decoration: const BoxDecoration(color: AppColors.deep, shape: BoxShape.circle), child: const Icon(Icons.check_rounded, color: AppColors.accent, size: 44)),
              const SizedBox(height: 18),
              Text('وصلت هديتك', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              Text(
                '${d['kind'] == 'item' ? 'أهديته ${(d['item'] as Map?)?['name']} من ${(d['merchant'] as Map?)?['name']}. يطلبه متى ما بغى ويستلمه من سيارته.' : 'أرسلت له ${aed((d['amount'] as num?) ?? 0)} يستخدمها في أي محل على Around.'}'
                '${d['delivered_to'] == 'sms' ? ' ما عنده Around للحين، فأرسلنا له رابط برسالة نصية.' : ''}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 28),
              FilledButton(onPressed: () => Navigator.pop(context), child: const Text('تم')),
            ]),
          ),
        ),
      );
    }
    final c = _designs[design]!;
    final it = item;
    final title = kind == 'item' ? '${it?['name'] ?? '…'} عليّ' : aed(amount * 100);
    return Scaffold(
      appBar: AppBar(title: const Text('أرسل هدية')),
      body: Column(children: [
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 20), children: [
            SegmentedButton<String>(
              segments: const [ButtonSegment(value: 'item', label: Text('مشروب أو أكل')), ButtonSegment(value: 'amount', label: Text('مبلغ'))],
              selected: {kind},
              onSelectionChanged: (s) => setState(() => kind = s.first),
              showSelectedIcon: false,
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: c[0], borderRadius: BorderRadius.circular(26)),
              child: DefaultTextStyle.merge(
                style: TextStyle(color: c[1]),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Expanded(child: Text('هدية من Around', style: TextStyle(fontWeight: FontWeight.w600))),
                    for (final k in _designs.keys)
                      GestureDetector(
                        onTap: () => setState(() => design = k),
                        child: Container(
                          width: 26,
                          height: 26,
                          margin: const EdgeInsetsDirectional.only(start: 6),
                          decoration: BoxDecoration(color: _designs[k]![0], shape: BoxShape.circle, border: Border.all(color: design == k ? c[1] : Colors.grey.shade400, width: design == k ? 3 : 1.5)),
                        ),
                      ),
                  ]),
                  const SizedBox(height: 18),
                  Text(title, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, height: 1.2)),
                  const SizedBox(height: 6),
                  Text(msg.text.isEmpty ? ' ' : '«${msg.text}»'),
                ]),
              ),
            ),
            const SizedBox(height: 14),
            if (kind == 'item') ...[
              SizedBox(
                height: 44,
                child: ListView(scrollDirection: Axis.horizontal, children: [
                  for (final s in stores)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(end: 8),
                      child: ChoiceChip(
                        label: Text('${s['name']}'),
                        selected: s['id'] == storeId,
                        onSelected: (_) => _pickStore(s['id'] as int),
                        showCheckmark: false,
                        selectedColor: AppColors.accent,
                        backgroundColor: Colors.white,
                        shape: const StadiumBorder(),
                        side: const BorderSide(color: AppColors.line),
                      ),
                    ),
                ]),
              ),
              const SizedBox(height: 10),
              if (store == null) const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator(color: AppColors.deep))),
              for (final i in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Material(
                    color: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: BorderSide(color: it != null && it['id'] == i['id'] ? AppColors.deep : AppColors.line, width: it != null && it['id'] == i['id'] ? 2 : 1)),
                    child: ListTile(
                      onTap: () => setState(() => itemId = i['id'] as int),
                      title: Text('${i['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      trailing: Text(aed(i['price'] as num), style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.deep)),
                    ),
                  ),
                ),
            ] else
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final n in const [25, 50, 100, 200])
                  ChoiceChip(
                    label: Text('$n د.إ'),
                    selected: amount == n,
                    onSelected: (_) => setState(() => amount = n),
                    showCheckmark: false,
                    selectedColor: AppColors.accent,
                    backgroundColor: Colors.white,
                    shape: const StadiumBorder(),
                    side: const BorderSide(color: AppColors.line),
                  ),
              ]),
            const SizedBox(height: 18),
            Text('لمين الهدية؟', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [ButtonSegment(value: 'phone', label: Text('هاتف')), ButtonSegment(value: 'user', label: Text('حساب'))],
              selected: {by},
              onSelectionChanged: (s) => setState(() { by = s.first; to.clear(); }),
              showSelectedIcon: false,
            ),
            const SizedBox(height: 8),
            TextField(
              controller: to,
              textDirection: TextDirection.ltr,
              keyboardType: by == 'phone' ? TextInputType.phone : TextInputType.text,
              decoration: InputDecoration(hintText: by == 'phone' ? '5X XXX XXXX' : 'username', prefixText: by == 'phone' ? '+971 ' : '@'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            TextField(controller: msg, maxLength: 120, decoration: const InputDecoration(hintText: 'اكتب له كلمتين…', counterText: ''), onChanged: (_) => setState(() {})),
            const SizedBox(height: 12),
            Wrap(spacing: 8, children: [
              for (final m in const [['apple_pay', 'Apple Pay'], ['google_pay', 'Google Pay'], ['card', 'بطاقة']])
                ChoiceChip(
                  label: Text(m[1]),
                  selected: method == m[0],
                  onSelected: (_) => setState(() => method = m[0]),
                  showCheckmark: false,
                  selectedColor: AppColors.accent,
                  backgroundColor: Colors.white,
                  shape: const StadiumBorder(),
                  side: const BorderSide(color: AppColors.line),
                ),
            ]),
            const SizedBox(height: 8),
            Text('الهدية صالحة 6 شهور. الدفع في وضع تجريبي.', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.muted)),
          ]),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: FilledButton(
              onPressed: busy || to.text.trim().isEmpty || price == 0 ? null : _send,
              child: busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.accentInk)) : Text('أرسل الهدية · ${aed(price)}'),
            ),
          ),
        ),
      ]),
    );
  }
}
