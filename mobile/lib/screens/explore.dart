import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../core/api.dart';
import '../core/theme.dart';
import '../widgets.dart';
import 'home.dart';
import 'social.dart';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});
  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  final q = TextEditingController();
  Timer? debounce;
  String query = '';
  String? category;
  Position? pos;
  List<Map<String, dynamic>> cats = [];
  List<Map<String, dynamic>>? stores;
  List<Map<String, dynamic>> users = [];
  List<Map<String, dynamic>> trending = [];
  Object? error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    debounce?.cancel();
    super.dispose();
  }

  Future<void> _init() async {
    try {
      pos = await currentPosition();
      final c = maps(await api.get('/categories'));
      final t = maps(await api.get('/social/trending'));
      if (mounted) setState(() { cats = c; trending = t; });
      await _search();
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _search() async {
    try {
      final params = <String, String>{
        if (pos != null) 'lat': '${pos!.latitude}',
        if (pos != null) 'lng': '${pos!.longitude}',
        if (category != null) 'category': category!,
        if (query.isNotEmpty) 'q': query,
      };
      final s = maps(await api.get('/stores', query: params));
      final u = query.length >= 2 ? maps(await api.get('/social/search', query: {'q': query})) : <Map<String, dynamic>>[];
      if (mounted) setState(() { stores = s; users = u; error = null; });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  void _onChanged(String v) {
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 300), () {
      query = v.trim();
      _search();
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final browsing = query.isEmpty && category == null;
    return SafeArea(
      bottom: false,
      child: error != null && stores == null
          ? ErrorView(error!, _init)
          : ListView(padding: const EdgeInsets.fromLTRB(20, 12, 20, kNavSpace), children: [
              Text('اكسبلور', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              TextField(controller: q, onChanged: _onChanged, decoration: const InputDecoration(hintText: 'ابحث عن محل، منتج، أو شخص', prefixIcon: Icon(Icons.search_rounded))),
              const SizedBox(height: 12),
              SizedBox(
                height: 44,
                child: ListView(scrollDirection: Axis.horizontal, children: [
                  for (final c in cats)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(end: 8),
                      child: ChoiceChip(
                        label: Row(mainAxisSize: MainAxisSize.min, children: [Icon(categoryIcons[c['key']] ?? Icons.storefront_rounded, size: 18), const SizedBox(width: 6), Text('${c['name']}')]),
                        selected: category == c['key'],
                        onSelected: (_) {
                          setState(() => category = category == c['key'] ? null : c['key'] as String);
                          _search();
                        },
                        showCheckmark: false,
                        selectedColor: AppColors.accentSoft,
                        backgroundColor: AppColors.chip,
                        side: BorderSide.none,
                        shape: const StadiumBorder(),
                      ),
                    ),
                ]),
              ),
              if (users.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('أشخاص', style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                for (final u in users)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Card(
                      child: ListTile(
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => UserProfileScreen(id: u['id'] as int))),
                        leading: UserAvatar(u, size: 40),
                        title: Text('${u['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: u['username'] != null ? Text('@${u['username']}', textDirection: TextDirection.ltr, textAlign: TextAlign.start) : null,
                      ),
                    ),
                  ),
              ],
              const SizedBox(height: 16),
              Text(query.isNotEmpty ? 'نتائج البحث' : category != null ? '${cats.firstWhere((c) => c['key'] == category, orElse: () => {'name': ''})['name']}' : 'كل المحلات', style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              if (stores == null)
                const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(color: AppColors.deep)))
              else if (stores!.isEmpty)
                const EmptyState(Icons.search_off_rounded, 'ما لقينا محلات', hint: 'جرّب كلمة ثانية أو تصنيف ثاني.')
              else
                for (final s in stores!) Padding(padding: const EdgeInsets.only(bottom: 12), child: StoreTile(s)),
              if (browsing && trending.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text('الأكثر تفاعلاً هالأسبوع', style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                ClipRRect(borderRadius: BorderRadius.circular(18), child: PostGrid(trending)),
              ],
            ]),
    );
  }
}
