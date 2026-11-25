import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../widgets.dart';
import 'order.dart';

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Loader<List<Map<String, dynamic>>>(
        load: () async => (await api.get('/orders') as List).map((e) => Map<String, dynamic>.from(e as Map)).toList(),
        builder: (context, orders, reload) => RefreshIndicator(
          color: AppColors.deep,
          onRefresh: reload,
          child: ListView(padding: const EdgeInsets.fromLTRB(20, 12, 20, kNavSpace), children: [
            Text('طلباتي', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            if (orders.isEmpty) const Padding(padding: EdgeInsets.all(48), child: Center(child: Text('ما عندك طلبات بعد'))),
            for (final o in orders)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Card(
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
                    onTap: () async {
                      await Navigator.push(context, MaterialPageRoute(builder: (_) => OrderScreen(id: o['id'] as int)));
                      reload();
                    },
                    title: Text('طلب رقم ${o['id']} · ${(o['merchant'] as Map?)?['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${o['status_label'] ?? o['status']}'),
                    trailing: Text(aed(o['total'] as num)),
                  ),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}
