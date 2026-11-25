import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../widgets.dart';
import 'banners.dart';
import 'gifts.dart';
import 'loyalty.dart';
import 'more.dart';
import 'order.dart';
import 'social.dart';
import 'store.dart';

/// Best-effort current position; null when permission is denied or location is off.
Future<Position?> currentPosition() async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) return null;
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    if (p == LocationPermission.denied || p == LocationPermission.deniedForever) return null;
    return await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.medium, timeLimit: const Duration(seconds: 8));
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
      bottom: false,
      child: FutureBuilder<Map<String, dynamic>>(
        future: future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator(color: AppColors.deep));
          if (snap.hasError) return ErrorView(snap.error!, _refresh);
          final d = snap.data!;
          final cats = (d['categories'] as List).cast<Map>();
          final active = (d['active_orders'] as List).cast<Map>();
          final stories = maps(d['stories']);
          final loyaltyCards = maps(d['loyalty']);
          var stores = (d['near'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
          if (category != null) stores = stores.where((s) => s['category'] == category).toList();
          if (query.trim().isNotEmpty) {
            final n = query.trim().toLowerCase();
            stores = stores.where((s) => (s['name'] as String).toLowerCase().contains(n)).toList();
          }
          return RefreshIndicator(
            color: AppColors.deep,
            onRefresh: _refresh,
            child: ListView(padding: const EdgeInsets.fromLTRB(20, 12, 20, kNavSpace), children: [
              Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(DateTime.now().hour < 12 ? 'صباح الخير' : DateTime.now().hour < 18 ? 'مساء النور' : 'مساء الخير', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.muted)),
                    const SizedBox(height: 2),
                    Text(session.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                  ]),
                ),
                CircleBtn(
                  Icons.card_giftcard_rounded,
                  tooltip: 'الهدايا',
                  onTap: () async {
                    await Navigator.push(context, MaterialPageRoute(builder: (_) => const GiftsScreen()));
                    _refresh();
                  },
                ),
                const SizedBox(width: 8),
                CircleBtn(Icons.notifications_none_rounded, tooltip: 'الإشعارات', onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen()))),
              ]),
              const SizedBox(height: 18),
              TextField(
                decoration: InputDecoration(
                  hintText: 'ابحث عن محل',
                  prefixIcon: const Icon(Icons.search_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: const BorderSide(color: AppColors.line)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: const BorderSide(color: AppColors.line)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: const BorderSide(color: AppColors.deep, width: 1.4)),
                ),
                onChanged: (v) => setState(() => query = v),
              ),
              if (maps(d['banners'] ?? []).isNotEmpty && category == null && query.trim().isEmpty) ...[
                const SizedBox(height: 16),
                BannerCarousel(maps(d['banners'] ?? [])),
              ],
              if (active.isNotEmpty) ...[
                const SizedBox(height: 16),
                for (final o in active)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Material(
                      color: AppColors.deep,
                      borderRadius: BorderRadius.circular(26),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(26),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => OrderScreen(id: o['id'] as int))),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(children: [
                            Container(width: 40, height: 40, decoration: const BoxDecoration(color: AppColors.accent, shape: BoxShape.circle), child: const Icon(Icons.directions_car_rounded, size: 22, color: AppColors.deep)),
                            const SizedBox(width: 12),
                            Expanded(child: Text('طلب رقم ${o['id']} · ${o['merchant_name']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
                            const Icon(Icons.chevron_left_rounded, color: Colors.white70),
                          ]),
                        ),
                      ),
                    ),
                  ),
              ],
              if (stories.isNotEmpty) ...[
                const SizedBox(height: 16),
                SizedBox(
                  height: 106,
                  child: ListView(scrollDirection: Axis.horizontal, children: [
                    for (final st in stories)
                      StoryBubble(
                        name: (st['username'] ?? st['name'] ?? '') as String,
                        image: st['cover'] as String?,
                        seen: st['unseen'] != true,
                        onTap: () async {
                          await Navigator.push(context, MaterialPageRoute(builder: (_) => StoryViewerScreen(userId: st['user_id'] as int)));
                          _refresh();
                        },
                      ),
                  ]),
                ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                height: 46,
                child: ListView(scrollDirection: Axis.horizontal, children: [
                  _chip('الكل', category == null, () => setState(() => category = null), Icons.apps_rounded),
                  for (final c in cats) _chip(c['name'] as String, category == c['key'], () => setState(() => category = c['key'] as String), categoryIcons[c['key']] ?? Icons.storefront_rounded),
                ]),
              ),
              if (loyaltyCards.isNotEmpty) ...[
                const SizedBox(height: 18),
                Row(children: [
                  Expanded(child: Text('بطاقات الولاء', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
                  TextButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LoyaltyScreen())), child: const Text('الكل')),
                ]),
                SizedBox(
                  height: 150,
                  child: ListView(scrollDirection: Axis.horizontal, children: [
                    for (final c in loyaltyCards) Padding(padding: const EdgeInsetsDirectional.only(end: 10), child: LoyaltyCard(c, width: 270)),
                  ]),
                ),
              ],
              const SizedBox(height: 16),
              if (stores.isEmpty)
                const EmptyState(Icons.storefront_outlined, 'ما لقينا محلات', hint: 'جرّب تغيّر الفلتر أو البحث')
              else
                for (final s in stores) Padding(padding: const EdgeInsets.only(bottom: 12), child: StoreTile(s)),
            ]),
          );
        },
      ),
    );
  }

  Widget _chip(String label, bool on, VoidCallback tap, IconData icon) => Padding(
        padding: const EdgeInsetsDirectional.only(end: 8),
        child: SoftChip(label, icon: icon, selected: on, onTap: tap),
      );
}

class StoreTile extends StatelessWidget {
  final Map<String, dynamic> s;
  const StoreTile(this.s);
  @override
  Widget build(BuildContext context) {
    final b = s['branch'] as Map?;
    final open = b != null && b['open'] == true;
    return PressScale(
      scale: .985,
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => StoreScreen(id: s['id'] as int))),
      child: Card(
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
                  Pill(open ? 'مفتوح' : 'مغلق', bg: open ? AppColors.accentSoft : const Color(0xFFFBE9E3), fg: open ? AppColors.accentInk : AppColors.danger),
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
