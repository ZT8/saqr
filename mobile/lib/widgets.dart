import 'package:flutter/material.dart';
import 'core/config.dart';
import 'core/theme.dart';

void toast(BuildContext context, Object message) {
  final m = ScaffoldMessenger.of(context);
  m.hideCurrentSnackBar();
  m.showSnackBar(SnackBar(
    content: Text(message.toString()),
    behavior: SnackBarBehavior.floating,
    backgroundColor: AppColors.deep,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
  ));
}

const Map<String, IconData> categoryIcons = {
  'coffee': Icons.coffee_rounded,
  'burger': Icons.lunch_dining_rounded,
  'restaurant': Icons.restaurant_rounded,
  'bakery': Icons.bakery_dining_rounded,
  'juice': Icons.local_drink_rounded,
  'dessert': Icons.cake_rounded,
  'grocery': Icons.local_grocery_store_rounded,
  'pharmacy': Icons.local_pharmacy_rounded,
};

Color parseColor(String? hex, [Color fallback = AppColors.accentSoft]) {
  if (hex == null) return fallback;
  var h = hex.replaceAll('#', '');
  if (h.length == 6) h = 'FF$h';
  final v = int.tryParse(h, radix: 16);
  return v == null ? fallback : Color(v);
}

/// Store logo: the uploaded image if any, otherwise the category icon on a tint.
class StoreAvatar extends StatelessWidget {
  final Map<String, dynamic> store;
  final double size;
  const StoreAvatar(this.store, {super.key, this.size = 56});

  @override
  Widget build(BuildContext context) {
    final logo = store['logo'] as String?;
    final tint = parseColor(store['color'] as String?);
    final icon = categoryIcons[store['category']] ?? Icons.storefront_rounded;
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: tint.withValues(alpha: .25), borderRadius: BorderRadius.circular(size * .3)),
      child: logo != null && logo.isNotEmpty
          ? Image.network(assetUrl(logo), fit: BoxFit.cover, errorBuilder: (_, __, ___) => Icon(icon, size: size * .5, color: AppColors.deep))
          : Icon(icon, size: size * .5, color: AppColors.deep),
    );
  }
}

class Pill extends StatelessWidget {
  final String text;
  final Color? bg;
  final Color? fg;
  const Pill(this.text, {super.key, this.bg, this.fg});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: bg ?? AppColors.ground, borderRadius: BorderRadius.circular(99)),
        child: Text(text, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: fg ?? AppColors.ink, fontWeight: FontWeight.w600)),
      );
}

class ErrorView extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;
  const ErrorView(this.error, this.onRetry, {super.key});
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.wifi_off_rounded, size: 40, color: AppColors.muted),
            const SizedBox(height: 12),
            Text(error.toString(), textAlign: TextAlign.center),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, style: OutlinedButton.styleFrom(minimumSize: const Size(160, 48)), child: const Text('حاول مرة ثانية')),
          ]),
        ),
      );
}

/// Loads data once and on retry; shows spinner / error / builder.
class Loader<T> extends StatefulWidget {
  final Future<T> Function() load;
  final Widget Function(BuildContext, T, Future<void> Function() reload) builder;
  const Loader({super.key, required this.load, required this.builder});
  @override
  State<Loader<T>> createState() => _LoaderState<T>();
}

class _LoaderState<T> extends State<Loader<T>> {
  T? data;
  Object? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    reload();
  }

  Future<void> reload() async {
    if (data == null) setState(() { loading = true; error = null; });
    try {
      final d = await widget.load();
      if (!mounted) return;
      setState(() { data = d; loading = false; error = null; });
    } catch (e) {
      if (!mounted) return;
      setState(() { error = e; loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (data != null) return widget.builder(context, data as T, reload);
    if (loading) return const Center(child: CircularProgressIndicator(color: AppColors.deep));
    return ErrorView(error ?? 'خطأ', reload);
  }
}
