import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../widgets.dart';
import 'store.dart';

const _tierColors = {
  'bronze': [Color(0xFF8A5A3B), Colors.white],
  'silver': [Color(0xFFD7DAD6), AppColors.ink],
  'gold': [Color(0xFFE6C34A), AppColors.ink],
  'platinum': [AppColors.deep, AppColors.accent],
};

class LoyaltyScreen extends StatelessWidget {
  const LoyaltyScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الولاء')),
      body: Loader<Map<String, dynamic>>(
        load: () async => Map<String, dynamic>.from(await api.get('/loyalty') as Map),
        builder: (context, d, reload) {
          final t = Map<String, dynamic>.from(d['tier'] as Map);
          final cards = maps(d['cards']);
          final c = _tierColors[t['key']] ?? _tierColors['bronze']!;
          final next = t['next'] as Map?;
          final remaining = (next?['remaining'] as num?)?.toInt() ?? 0;
          return RefreshIndicator(
            color: AppColors.deep,
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 24), children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: c[0], borderRadius: BorderRadius.circular(28)),
                child: DefaultTextStyle.merge(
                  style: TextStyle(color: c[1]),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('عضوية Around', style: TextStyle(fontWeight: FontWeight.w600)),
                    Text('العضوية ${t['name']}', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 18),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(value: ((t['progress'] as num?) ?? 0) / 100, minHeight: 8, backgroundColor: c[1].withValues(alpha: .2), color: c[1]),
                    ),
                    const SizedBox(height: 8),
                    Text(next != null ? 'باقي $remaining ${remaining == 1 ? 'طلب' : 'طلبات'} على العضوية ${next['name']}' : 'أعلى عضوية في Around', style: const TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 10),
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      Text('سارية حتى ${dateShort(t['valid_until'] as String?)}', style: const TextStyle(fontSize: 12)),
                      Text('${t['orders']} طلب هالسنة', style: const TextStyle(fontSize: 12)),
                    ]),
                  ]),
                ),
              ),
              const SizedBox(height: 12),
              Text('المستوى يتحدد حسب عدد طلباتك خلال السنة. كل محل له برنامج نقاط خاص فيه، والمكافآت يحددها المحل نفسه.', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted)),
              const SizedBox(height: 18),
              Text('نقاطك عند المحلات', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              if (cards.isEmpty)
                const EmptyState(Icons.star_border_rounded, 'ما عندك نقاط للحين', hint: 'اطلب من المحلات اللي عندها برنامج ولاء وتبدأ تجمع.')
              else
                for (final k in cards) Padding(padding: const EdgeInsets.only(bottom: 10), child: LoyaltyCard(k)),
            ]),
          );
        },
      ),
    );
  }
}

class LoyaltyCard extends StatelessWidget {
  final Map<String, dynamic> card;
  final double? width;
  const LoyaltyCard(this.card, {super.key, this.width});
  @override
  Widget build(BuildContext context) {
    final p = Map<String, dynamic>.from(card['program'] as Map);
    final m = Map<String, dynamic>.from(card['merchant'] as Map);
    final goal = (p['goal'] as num).toInt();
    final bal = (card['balance'] as num).toInt();
    final stamps = p['type'] == 'stamps' && goal <= 10;
    return SizedBox(
      width: width,
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => StoreScreen(id: m['id'] as int))),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                StoreAvatar(m, size: 40),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${m['name']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text('${p['reward_text'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                  ]),
                ),
                Text('$bal/$goal', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.deep)),
              ]),
              const SizedBox(height: 12),
              if (stamps)
                Row(children: [
                  for (var i = 0; i < goal; i++)
                    Expanded(child: Container(height: 12, margin: const EdgeInsets.symmetric(horizontal: 2), decoration: BoxDecoration(color: i < bal ? AppColors.deep : AppColors.line, borderRadius: BorderRadius.circular(6)))),
                ])
              else
                ClipRRect(borderRadius: BorderRadius.circular(6), child: LinearProgressIndicator(value: (bal / goal).clamp(0, 1).toDouble(), minHeight: 8, backgroundColor: AppColors.line, color: AppColors.deep)),
              const SizedBox(height: 8),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                if (card['can_redeem'] == true) const Pill('المكافأة جاهزة', bg: AppColors.accentSoft, fg: AppColors.accentInk) else Text('باقي ${goal - bal} ${unitOf(p)}', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                if (card['expires_at'] != null) Text('تنتهي ${dateShort(card['expires_at'] as String?)}', style: const TextStyle(fontSize: 12, color: AppColors.danger, fontWeight: FontWeight.w600)),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}
