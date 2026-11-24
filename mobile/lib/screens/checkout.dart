import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/cart.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../widgets.dart';
import 'order.dart';

const emirates = ['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'أم القيوين', 'رأس الخيمة', 'الفجيرة'];

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});
  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  List<Map<String, dynamic>> cars = [];
  bool loadingCars = true;
  int? carId;
  String method = 'card';
  final note = TextEditingController();
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _loadCars();
  }

  Future<void> _loadCars() async {
    try {
      final r = await api.get('/auth/cars') as List;
      cars = r.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      if (cars.isNotEmpty && (carId == null || !cars.any((c) => c['id'] == carId))) carId = cars.first['id'] as int;
    } catch (e) {
      if (mounted) toast(context, e);
    }
    if (mounted) setState(() => loadingCars = false);
  }

  Future<void> _addCar() async {
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
            Text('أضف سيارتك', style: Theme.of(c).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
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
              Expanded(child: TextField(controller: code, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'الرمز'))),
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
              child: const Text('حفظ'),
            ),
          ]),
        ),
      ),
    );
    if (saved == true) {
      setState(() => loadingCars = true);
      await _loadCars();
    }
  }

  Future<void> _confirm() async {
    if (carId == null) {
      toast(context, 'اختر سيارتك عشان الفرع يعرفك');
      return;
    }
    setState(() => busy = true);
    try {
      final o = await api.post('/orders', {
        'branch_id': cart.branchId,
        'car_id': carId,
        'items': cart.toItems(),
        'payment_method': method,
        'note': note.text.trim(),
      }) as Map;
      final id = o['id'] as int;
      cart.clear();
      if (!mounted) return;
      Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => OrderScreen(id: id)), (r) => r.isFirst);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget _section(String title, Widget child) => Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          child,
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(cart.merchantName)),
      body: ListenableBuilder(
        listenable: cart,
        builder: (context, _) => Column(children: [
          Expanded(
            child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 20), children: [
              _section(
                'طلبك',
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(children: [
                      for (final l in cart.lines.values)
                        Row(children: [
                          Expanded(child: Text(l.name)),
                          IconButton(onPressed: () => cart.remove(l.itemId), icon: const Icon(Icons.remove_circle_outline_rounded, size: 22)),
                          Text('${l.qty}', style: t.titleSmall),
                          IconButton(onPressed: () => cart.add(l.itemId, l.name, l.price), icon: const Icon(Icons.add_circle_rounded, size: 22, color: AppColors.deep)),
                          SizedBox(width: 84, child: Text(aed(l.price * l.qty), textAlign: TextAlign.end)),
                        ]),
                      const Divider(),
                      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                        Text('المجموع', style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                        Text(aed(cart.total), style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                      ]),
                    ]),
                  ),
                ),
              ),
              _section(
                'سيارتك',
                loadingCars
                    ? const Center(child: CircularProgressIndicator(color: AppColors.deep))
                    : Column(children: [
                        for (final c in cars)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Card(
                              child: RadioListTile<int>(
                                value: c['id'] as int,
                                groupValue: carId,
                                onChanged: (v) => setState(() => carId = v),
                                activeColor: AppColors.deep,
                                title: Text(c['label'] as String? ?? ''),
                                subtitle: Text(c['plate'] as String? ?? ''),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
                              ),
                            ),
                          ),
                        OutlinedButton.icon(onPressed: _addCar, icon: const Icon(Icons.add_rounded), label: const Text('أضف سيارة')),
                      ]),
              ),
              _section(
                'الدفع',
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final m in const [['card', 'بطاقة', Icons.credit_card_rounded], ['apple_pay', 'Apple Pay', Icons.apple_rounded], ['google_pay', 'Google Pay', Icons.g_mobiledata_rounded]])
                    ChoiceChip(
                      label: Row(mainAxisSize: MainAxisSize.min, children: [Icon(m[2] as IconData, size: 18), const SizedBox(width: 6), Text(m[1] as String)]),
                      selected: method == m[0],
                      onSelected: (_) => setState(() => method = m[0] as String),
                      showCheckmark: false,
                      selectedColor: AppColors.accent,
                      backgroundColor: Colors.white,
                      shape: const StadiumBorder(),
                      side: const BorderSide(color: AppColors.line),
                    ),
                ]),
              ),
              _section('ملاحظة للفرع (اختياري)', TextField(controller: note, maxLength: 200, decoration: const InputDecoration(counterText: ''))),
            ]),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: FilledButton(
                onPressed: busy || cart.isEmpty ? null : _confirm,
                child: busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.accentInk)) : Text('تأكيد الطلب · ${aed(cart.total)}'),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
