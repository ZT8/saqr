import 'package:flutter/material.dart';

import '../api.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/eye.dart';

class RegistryScreen extends StatefulWidget {
  const RegistryScreen({super.key});
  @override
  State<RegistryScreen> createState() => _RegistryScreenState();
}

class _RegistryScreenState extends State<RegistryScreen> {
  final _q = TextEditingController();
  String _type = '';
  final List<Map<String, dynamic>> _items = [];
  int _page = 1, _total = 0;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _page = 1;
        _items.clear();
      }
    });
    try {
      final d = await Api.I.registry(q: _q.text.trim(), type: _type, page: _page);
      setState(() {
        _items.addAll((d['items'] as List).map((e) => Map<String, dynamic>.from(e as Map)));
        _total = (d['total'] as num).toInt();
        _page++;
      });
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      child: Pad(children: [
        H1(t('registry_title')),
        Lead(t('registry_sub')),
        TextField(
          controller: _q,
          textInputAction: TextInputAction.search,
          onSubmitted: (_) => _load(reset: true),
          decoration: InputDecoration(hintText: t('search_ph'), prefixIcon: const Icon(Icons.search)),
        ),
        const SizedBox(height: 10),
        Wrap(spacing: 8, children: [
          for (final ty in ['', 'url', 'phone', 'message'])
            ChoiceChip(
              label: Text(ty.isEmpty ? t('all_types') : t('t_$ty')),
              selected: _type == ty,
              showCheckmark: false,
              shape: const RoundedRectangleBorder(),
              side: BorderSide.none,
              selectedColor: C.ink,
              backgroundColor: C.surface,
              labelStyle: TextStyle(color: _type == ty ? Colors.white : C.ink, fontWeight: FontWeight.w600),
              onSelected: (_) {
                setState(() => _type = ty);
                _load(reset: true);
              },
            ),
        ]),
        const SizedBox(height: 16),
        if (_error != null) Text(_error!, style: const TextStyle(color: C.danger)),
        if (!_loading && _items.isEmpty && _error == null)
          Container(color: C.surface, padding: const EdgeInsets.all(28), child: Text(t('no_results'), textAlign: TextAlign.center, style: const TextStyle(color: C.muted))),
        for (final it in _items) _Item(it),
        if (_loading) const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator(color: C.accent))),
        if (!_loading && _items.length < _total)
          Center(child: TextButton(onPressed: _load, child: Text(t('next'), style: const TextStyle(color: C.ink, decoration: TextDecoration.underline)))),
      ]),
    );
  }
}

class _Item extends StatelessWidget {
  const _Item(this.it);
  final Map<String, dynamic> it;
  @override
  Widget build(BuildContext context) {
    final verified = it['status'] == 'verified';
    final color = verified ? C.danger : C.warn;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      color: verified ? C.dangerBg : C.surface,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(spacing: 10, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
          Badge2(t('t_${it['type']}')),
          Row(mainAxisSize: MainAxisSize.min, children: [
            EyeDot(color: color, width: 16),
            const SizedBox(width: 6),
            Text(t('st_${it['status']}'), style: TextStyle(color: color, fontWeight: FontWeight.w700)),
          ]),
          if (it['category'] != null) Text(t('cat_${it['category']}'), style: const TextStyle(color: C.muted, fontSize: 13)),
        ]),
        if (it['value'] != null) ...[
          const SizedBox(height: 10),
          Directionality(textDirection: TextDirection.ltr, child: Text(it['value'].toString(), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
        ],
        if (it['sample'] != null && (it['sample'] as String).isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(color: C.bg, padding: const EdgeInsets.all(12), child: Text(it['sample'] as String, maxLines: 4, overflow: TextOverflow.ellipsis)),
        ],
        const SizedBox(height: 10),
        Text('${t('reports_n', {'n': it['reports']})} · ${t('last_seen')}: ${Strings.I.date(it['last_seen'] as String)}', style: const TextStyle(color: C.muted, fontSize: 13)),
      ]),
    );
  }
}
