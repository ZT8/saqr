import 'dart:async';
import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/config.dart';
import '../core/theme.dart';
import 'store.dart';

/// Home banners: swipeable, advances every 5 seconds (paused while a finger is down),
/// reports one view per banner per session and a click on tap. A banner with a store opens it.
class BannerCarousel extends StatefulWidget {
  final List<Map<String, dynamic>> banners;
  const BannerCarousel(this.banners, {super.key});
  @override
  State<BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<BannerCarousel> {
  final _page = PageController();
  static final _seen = <int>{};
  Timer? _timer;
  bool _held = false;
  int _i = 0;

  @override
  void initState() {
    super.initState();
    _track(0);
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (_held || !mounted || widget.banners.length < 2 || !_page.hasClients) return;
      _page.animateToPage((_i + 1) % widget.banners.length, duration: kMed, curve: kEase);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _page.dispose();
    super.dispose();
  }

  void _track(int i) {
    if (i >= widget.banners.length) return;
    final id = widget.banners[i]['id'] as int;
    if (_seen.add(id)) api.post('/banners/$id/view').catchError((_) => null);
  }

  void _tap(Map<String, dynamic> b) {
    api.post('/banners/${b['id']}/click').catchError((_) => null);
    final m = b['merchant_id'];
    if (m is int) Navigator.push(context, MaterialPageRoute(builder: (_) => StoreScreen(id: m)));
  }

  @override
  Widget build(BuildContext context) {
    final list = widget.banners;
    if (list.isEmpty) return const SizedBox.shrink();
    return Column(children: [
      Listener(
        onPointerDown: (_) => _held = true,
        onPointerUp: (_) => _held = false,
        onPointerCancel: (_) => _held = false,
        child: AspectRatio(
          aspectRatio: 2,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: PageView.builder(
              controller: _page,
              itemCount: list.length,
              onPageChanged: (i) {
                setState(() => _i = i);
                _track(i);
              },
              itemBuilder: (_, n) {
                final b = list[n];
                return GestureDetector(
                  onTap: () => _tap(b),
                  child: Stack(fit: StackFit.expand, children: [
                    Image.network(assetUrl(b['image'] as String?), fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: AppColors.accentSoft)),
                    const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.center, colors: [Color(0xA60C1D16), Color(0x000C1D16)]))),
                    Positioned(
                      left: 16,
                      right: 16,
                      bottom: 14,
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${b['title']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                        if ('${b['subtitle'] ?? ''}'.isNotEmpty) Text('${b['subtitle']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                      ]),
                    ),
                  ]),
                );
              },
            ),
          ),
        ),
      ),
      if (list.length > 1) ...[
        const SizedBox(height: 8),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          for (var n = 0; n < list.length; n++)
            AnimatedContainer(
              duration: kFast,
              curve: kEase,
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: n == _i ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(color: n == _i ? AppColors.deep : AppColors.line, borderRadius: BorderRadius.circular(3)),
            ),
        ]),
      ],
    ]);
  }
}
