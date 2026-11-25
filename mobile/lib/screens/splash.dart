import 'package:flutter/material.dart';
import '../core/theme.dart';

/// Brand splash shown over the app for about 1.8s: the logo eases in, holds, then the whole
/// layer fades away. It matches the native launch screen (same colour and logo) so there is no flash between them.
class Splash extends StatefulWidget {
  final Widget child;
  const Splash({super.key, required this.child});
  @override
  State<Splash> createState() => _SplashState();
}

class _SplashState extends State<Splash> with SingleTickerProviderStateMixin {
  late final AnimationController _in = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..forward();
  bool _gone = false;
  bool _fading = false;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (mounted) setState(() => _fading = true);
    });
  }

  @override
  void dispose() {
    _in.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(children: [
      widget.child,
      if (!_gone)
        Positioned.fill(
          child: IgnorePointer(
            ignoring: _fading,
            child: AnimatedOpacity(
              opacity: _fading ? 0 : 1,
              duration: const Duration(milliseconds: 380),
              curve: kEase,
              onEnd: () {
                if (_fading && mounted) setState(() => _gone = true);
              },
              child: ColoredBox(
                color: AppColors.deep,
                child: Center(
                  child: AnimatedBuilder(
                    animation: _in,
                    builder: (_, child) {
                      final v = kEase.transform(_in.value);
                      return Opacity(opacity: v, child: Transform.scale(scale: .92 + .08 * v, child: child));
                    },
                    child: Image.asset('assets/icon.png', width: 168, height: 168),
                  ),
                ),
              ),
            ),
          ),
        ),
    ]);
  }
}
