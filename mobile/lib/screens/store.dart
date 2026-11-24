import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/cart.dart';
import '../core/config.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../widgets.dart';
import 'checkout.dart';

class StoreScreen extends StatefulWidget {
  final int id;
  const StoreScreen({super.key, required this.id});
  @override
  State<StoreScreen> createState() => _StoreScreenState();
}

class _StoreScreenState extends State<StoreScreen> {
  int branchIndex = 0;

  Future<bool> _confirmReplace(String name) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('تبدأ سلة جديدة؟'),
        content: Text('سلتك فيها طلب من ${cart.merchantName}. لو أضفت من $name بنفرغها.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('لا')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('نعم، سلة جديدة')),
        ],
      ),
    );
    return ok == true;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Loader<Map<String, dynamic>>(
        load: () async => Map<String, dynamic>.from(await api.get('/stores/${widget.id}') as Map),
        builder: (context, s, reload) {
          final branches = (s['branches'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
          final branch = branches[branchIndex.clamp(0, branches.length - 1)];
          final open = branch['open'] == true;
          final menu = (s['menu'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
          final loyalty = s['loyalty'] as Map?;
          return ListenableBuilder(
            listenable: cart,
            builder: (context, _) => Column(children: [
              Expanded(
                child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
                  Row(children: [
                    StoreAvatar(s, size: 64),
                    const SizedBox(width: 14),
                    Expanded(child: Text(s['name'] as String, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700))),
                  ]),
                  const SizedBox(height: 12),
                  Wrap(spacing: 8, runSpacing: 6, children: [
                    Pill(branch['hours_label'] as String? ?? '', bg: open ? AppColors.accentSoft : AppColors.ground, fg: open ? AppColors.accentInk : AppColors.muted),
                    if (branch['distance_m'] != null) Pill(distanceLabel(branch['distance_m'] as num)),
                  ]),
                  if (branches.length > 1) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 44,
                      child: ListView(scrollDirection: Axis.horizontal, children: [
                        for (var i = 0; i < branches.length; i++)
                          Padding(
                            padding: const EdgeInsetsDirectional.only(end: 8),
                            child: ChoiceChip(
                              label: Text('${branches[i]['name']}'),
                              selected: i == branchIndex,
                              onSelected: (_) => setState(() => branchIndex = i),
                              showCheckmark: false,
                              selectedColor: AppColors.accent,
                              backgroundColor: Colors.white,
                              shape: const StadiumBorder(),
                              side: const BorderSide(color: AppColors.line),
                            ),
                          ),
                      ]),
                    ),
                  ],
                  if (loyalty != null && loyalty['program'] != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: AppColors.deep, borderRadius: BorderRadius.circular(20)),
                      child: Row(children: [
                        const Icon(Icons.workspace_premium_rounded, color: AppColors.accent),
                        const SizedBox(width: 10),
                        Expanded(child: Text('${loyalty['balance']} من ${(loyalty['program'] as Map)['goal']} · ${(loyalty['program'] as Map)['reward_text']}', style: const TextStyle(color: Colors.white))),
                      ]),
                    ),
                  ],
                  const SizedBox(height: 8),
                  if (menu.isEmpty) const Padding(padding: EdgeInsets.all(40), child: Center(child: Text('المنيو قيد التجهيز'))),
                  for (final c in menu) ...[
                    Padding(padding: const EdgeInsets.only(top: 20, bottom: 8), child: Text(c['name'] as String, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
                    for (final raw in (c['items'] as List))
                      _ItemRow(
                        item: Map<String, dynamic>.from(raw as Map),
                        enabled: open,
                        onAdd: (it) async {
                          final mid = s['id'] as int;
                          if (!cart.belongsTo(mid) && !await _confirmReplace(s['name'] as String)) return;
                          cart.start(mid, branch['id'] as int, s['name'] as String);
                          cart.add(it['id'] as int, it['name'] as String, it['price'] as int);
                        },
                      ),
                  ],
                ]),
              ),
              if (!cart.isEmpty && cart.merchantId == s['id'])
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                    child: FilledButton(
                      onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CheckoutScreen())),
                      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                        Text('السلة · ${cart.count}'),
                        Text(aed(cart.total)),
                      ]),
                    ),
                  ),
                ),
            ]),
          );
        },
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  final Map<String, dynamic> item;
  final bool enabled;
  final Future<void> Function(Map<String, dynamic>) onAdd;
  const _ItemRow({required this.item, required this.enabled, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    final id = item['id'] as int;
    final qty = cart.qtyOf(id);
    final available = item['is_available'] == 1 || item['is_available'] == true;
    final image = item['image'] as String?;
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            if (image != null && image.isNotEmpty)
              Padding(
                padding: const EdgeInsetsDirectional.only(end: 12),
                child: ClipRRect(borderRadius: BorderRadius.circular(14), child: Image.network(assetUrl(image), width: 64, height: 64, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox(width: 64, height: 64))),
              ),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(item['name'] as String, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                if ((item['description'] as String?)?.isNotEmpty ?? false)
                  Text(item['description'] as String, maxLines: 2, overflow: TextOverflow.ellipsis, style: t.bodySmall?.copyWith(color: AppColors.muted)),
                const SizedBox(height: 4),
                Text(aed(item['price'] as num), style: t.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
              ]),
            ),
            const SizedBox(width: 8),
            if (!available)
              const Pill('غير متوفر')
            else if (qty == 0)
              IconButton.filled(
                onPressed: enabled ? () => onAdd(item) : null,
                style: IconButton.styleFrom(backgroundColor: AppColors.accent, foregroundColor: AppColors.accentInk),
                icon: const Icon(Icons.add_rounded),
              )
            else
              Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(onPressed: () => cart.remove(id), icon: const Icon(Icons.remove_circle_outline_rounded)),
                Text('$qty', style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                IconButton(onPressed: () => onAdd(item), icon: const Icon(Icons.add_circle_rounded, color: AppColors.deep)),
              ]),
          ]),
        ),
      ),
    );
  }
}
