import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../widgets.dart';

const _steps = [['new', 'استلمنا طلبك'], ['preparing', 'قيد التحضير'], ['ready', 'جاهز'], ['delivered', 'تم التسليم']];

class OrderScreen extends StatefulWidget {
  final int id;
  const OrderScreen({super.key, required this.id});
  @override
  State<OrderScreen> createState() => _OrderScreenState();
}

class _OrderScreenState extends State<OrderScreen> {
  Map<String, dynamic>? o;
  Object? error;
  Timer? poll;
  StreamSubscription<Position>? sub;
  bool busy = false;
  bool trackTried = false;

  @override
  void initState() {
    super.initState();
    _load();
    poll = Timer.periodic(const Duration(seconds: 4), (_) => _load());
  }

  @override
  void dispose() {
    poll?.cancel();
    sub?.cancel();
    super.dispose();
  }

  bool get live => o != null && const ['new', 'preparing', 'ready'].contains(o!['status']);
  bool get arrived => o?['arrived_at'] != null;

  Future<void> _load() async {
    try {
      final r = Map<String, dynamic>.from(await api.get('/orders/${widget.id}') as Map);
      if (!mounted) return;
      setState(() { o = r; error = null; });
      if (!live || arrived) {
        sub?.cancel();
        sub = null;
      } else if (r['on_the_way'] == true && sub == null && !trackTried) {
        trackTried = true;
        _track(); // resume tracking after the app was reopened
      }
    } catch (e) {
      if (mounted && o == null) setState(() => error = e);
    }
  }

  Future<void> _act(Future<dynamic> Function() f) async {
    setState(() => busy = true);
    try {
      await f();
      await _load();
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _track() async {
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    if (p == LocationPermission.denied || p == LocationPermission.deniedForever) {
      if (mounted) toast(context, 'فعّل الموقع عشان الفرع يعرف متى توصل');
      return;
    }
    sub?.cancel();
    sub = Geolocator.getPositionStream(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 25)).listen((pos) async {
      try {
        await api.post('/orders/${widget.id}/location', {'lat': pos.latitude, 'lng': pos.longitude});
      } catch (_) {}
    });
  }

  Future<void> _start() => _act(() async {
        trackTried = true;
        await api.post('/orders/${widget.id}/on-the-way');
        await _track();
      });

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text('طلب رقم ${widget.id}')),
      body: o == null
          ? (error != null ? ErrorView(error!, _load) : const Center(child: CircularProgressIndicator(color: AppColors.deep)))
          : ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 24), children: _content(t)),
    );
  }

  List<Widget> _content(TextTheme t) {
    final order = o!;
    final status = order['status'] as String;
    final cancelled = status == 'cancelled' || status == 'rejected';
    final idx = _steps.indexWhere((s) => s[0] == status);
    final eta = order['eta_minutes'] as num?;
    final ahead = order['queue_ahead'] as num? ?? 0;
    final items = (order['items'] as List).cast<Map>();
    final branch = order['branch'] as Map?;
    final merchant = order['merchant'] as Map?;
    return [
      Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: AppColors.deep, borderRadius: BorderRadius.circular(28)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${merchant?['name'] ?? ''}${branch != null ? ' · ${branch['name']}' : ''}', style: t.bodyMedium?.copyWith(color: Colors.white70)),
          const SizedBox(height: 8),
          Text(
            arrived && live ? 'وصلت، الموظف بيطلع لك الطلب' : (order['status_label'] as String? ?? status),
            style: t.headlineSmall?.copyWith(color: AppColors.accent, fontWeight: FontWeight.w700),
          ),
          if (live && !arrived && order['on_the_way'] == true && eta != null) ...[
            const SizedBox(height: 6),
            Text('توصل بعد ${minutesLabel(eta.round())} · ${distanceLabel(order['distance_m'] as num?)}', style: t.bodyMedium?.copyWith(color: Colors.white)),
          ],
          if (!cancelled) ...[
            const SizedBox(height: 16),
            Row(children: [
              for (var i = 0; i < _steps.length; i++)
                Expanded(
                  child: Container(
                    height: 5,
                    margin: EdgeInsetsDirectional.only(end: i == _steps.length - 1 ? 0 : 4),
                    decoration: BoxDecoration(color: i <= idx ? AppColors.accent : Colors.white24, borderRadius: BorderRadius.circular(3)),
                  ),
                ),
            ]),
          ],
        ]),
      ),
      const SizedBox(height: 14),
      if (live && arrived)
        _info(Icons.directions_car_rounded, 'السيارات قبلك', '$ahead'),
      if (live) ...[
        const SizedBox(height: 8),
        if (!arrived && order['on_the_way'] != true)
          FilledButton.icon(onPressed: busy ? null : _start, icon: const Icon(Icons.navigation_rounded), label: const Text('أنا في الطريق')),
        if (!arrived && order['on_the_way'] == true)
          OutlinedButton(onPressed: busy ? null : () => _act(() => api.post('/orders/${widget.id}/arrived')), child: const Text('أنا وصلت')),
        if (order['can_cancel'] == true) ...[
          const SizedBox(height: 8),
          TextButton(
            onPressed: busy ? null : () => _act(() => api.post('/orders/${widget.id}/cancel')),
            child: const Text('إلغاء الطلب', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ],
      if (status == 'delivered') _rating(order),
      const SizedBox(height: 14),
      _info(Icons.directions_car_outlined, 'سيارتك', '${order['car_label'] ?? ''}\n${order['plate_label'] ?? ''}'),
      const SizedBox(height: 12),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            for (final i in items)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  Expanded(child: Text('${i['name']} × ${i['qty']}')),
                  Text(aed((i['unit_price'] as num) * (i['qty'] as num))),
                ]),
              ),
            const Divider(),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('المدفوع', style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              Text(aed(order['total'] as num), style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
            ]),
          ]),
        ),
      ),
    ];
  }

  Widget _info(IconData icon, String label, String value) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Icon(icon, color: AppColors.deep),
            const SizedBox(width: 12),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
            const Spacer(),
            Flexible(child: Text(value, textAlign: TextAlign.end)),
          ]),
        ),
      );

  Widget _rating(Map<String, dynamic> order) {
    final rated = (order['rating'] as num?)?.toInt() ?? 0;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Text(rated > 0 ? 'شكراً على تقييمك' : 'كيف كان طلبك؟', style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var s = 1; s <= 5; s++)
                IconButton(
                  onPressed: rated > 0 ? null : () => _act(() => api.post('/orders/${widget.id}/rate', {'rating': s})),
                  icon: Icon(s <= rated ? Icons.star_rounded : Icons.star_outline_rounded, color: const Color(0xFFE9A100), size: 32),
                ),
            ]),
          ]),
        ),
      ),
    );
  }
}
