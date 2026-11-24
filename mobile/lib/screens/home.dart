import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../widgets.dart';
import 'order.dart';
import 'store.dart';

/// Best-effort current position; null when permission is denied or location is off.
Future<Position?> currentPosition() async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) return null;
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    if (p == LocationPermission.denied || p == LocationPermission.deniedForever) return null;
    return await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium)).timeout(const Duration(seconds: 8));
  } catch (_) {
    return null;
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? category;
  String query = '';
  Position? pos;
  late Future<Map<String, dynamic>> future = _load();

  Future<Map<String, dynamic>> _load() async {
    pos ??= await currentPosition();
    final q = <String, String>{if (pos != null) 'lat': '${pos!.latitude}', if (pos != null) 'lng': '${pos!.longitude}'};
    return Map<String, dynamic>.from(await api.get('/home', query: q) as Map);
  }

  Future<void> _refresh() async {
    setState(() => future = _load());
    await future;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: FutureBuilder<Map<String, dynamic>>(
        future: future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator(color: AppColors.deep));
          if (snap.hasError) return ErrorView(snap.error!, _refresh);
          final d = snap.data!;
          final cats = (d['categories'] as List).cast<Map>();
          final active = (d['active_orders'] as List).cast<Map>();
          var stores = (d['near'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
          if (category != null) stores = stores.where((s) => s['category'] == category).toList();
          if (query.trim().isNotEmpty) {
            final n = query.trim().toLowerCase();
            stores = stores.where((s) => (s['name'] as String).toLowerCase().contains(n)).toList();
          }
          return RefreshIndicator(
            color: AppColors.deep,
            onRefresh: _refresh,
            child: ListView(padding: const EdgeInsets.fromLTRB(20, 12, 20, 24), children: [
              Text('هلا ${session.name}', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text('وش تبي تطلب اليوم؟', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.muted)),
              const SizedBox(height: 16),
              TextField(
                decoration: const InputDecoration(hintText: 'ابحث عن محل', prefixIcon: Icon(Icons.search_rounded)),
                onChanged: (v) => setState(() => query = v),
              ),
              if (active.isNotEmpty) ...[
                const SizedBox(height: 16),
                for (final o in active)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Material(
                      color: AppColors.deep,
                      borderRadius: BorderRadius.circular(20),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(20),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => OrderScreen(id: o['id'] as int))),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(children: [
                            const Icon(Icons.directions_car_rounded, color: AppColors.accent),
                            const SizedBox(width: 12),
                            Expanded(child: Text('طلب رقم ${o['id']} · ${o['merchant_name']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
                            const Icon(Icons.chevron_left_rounded, color: Colors.white70),
                          ]),
                        ),
                      ),
                    ),
                  ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                height: 44,
                child: ListView(scrollDirection: Axis.horizontal, children: [
                  _chip('الكل', category == null, () => setState(() => category = null), Icons.apps_rounded),
                  for (final c in cats) _chip(c['name'] as String, category == c['key'], () => setState(() => category = c['key'] as String), categoryIcons[c['key']] ?? Icons.storefront_rounded),
                ]),
              ),
              const SizedBox(height: 16),
              if (stores.isEmpty)
                const Padding(padding: EdgeInsets.all(40), child: Center(child: Text('ما لقينا محلات')))
              else
                for (final s in stores) Padding(padding: const EdgeInsets.only(bottom: 12), child: _StoreTile(s)),
            ]),
          );
        },
      ),
    );
  }

  Widget _chip(String label, bool on, VoidCallback tap, IconData icon) => Padding(
        padding: const EdgeInsetsDirectional.only(end: 8),
        child: ChoiceChip(
          label: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 18), const SizedBox(width: 6), Text(label)]),
          selected: on,
          onSelected: (_) => tap(),
          showCheckmark: false,
          selectedColor: AppColors.accent,
          backgroundColor: Colors.white,
          side: const BorderSide(color: AppColors.line),
          shape: const StadiumBorder(),
        ),
      );
}

class _StoreTile extends StatelessWidget {
  final Map<String, dynamic> s;
  const _StoreTile(this.s);
  @override
  Widget build(BuildContext context) {
    final b = s['branch'] as Map?;
    final open = b != null && b['open'] == true;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => StoreScreen(id: s['id'] as int))),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            StoreAvatar(s, size: 60),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(s['name'] as String, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Wrap(spacing: 6, runSpacing: 4, children: [
                  Pill(open ? 'مفتوح' : 'مغلق', bg: open ? AppColors.accentSoft : AppColors.ground, fg: open ? AppColors.accentInk : AppColors.muted),
                  if (b != null && b['distance_m'] != null) Pill(distanceLabel(b['distance_m'] as num)),
                  if (b != null) Pill(b['area'] as String? ?? ''),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
