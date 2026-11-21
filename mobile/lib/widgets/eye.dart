import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

/// The falcon's eye: an almond with pointed ends (same curve as the web app's clip path).
Path eyePath(Size s) {
  final w = s.width, h = s.height;
  return Path()
    ..moveTo(0, h * .5)
    ..cubicTo(w * .24, h * -.12, w * .76, h * -.12, w, h * .5)
    ..cubicTo(w * .76, h * 1.12, w * .24, h * 1.12, 0, h * .5)
    ..close();
}

class EyeClipper extends CustomClipper<Path> {
  const EyeClipper();
  @override
  Path getClip(Size size) => eyePath(size);
  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

/// Primary action: an eye-shaped button with press feedback (scale 0.97).
class EyeButton extends StatefulWidget {
  const EyeButton({super.key, required this.label, required this.onPressed, this.color = C.accent, this.height = 60, this.busy = false, this.expand = false});
  final String label;
  final VoidCallback? onPressed;
  final Color color;
  final double height;
  final bool busy;
  final bool expand;

  @override
  State<EyeButton> createState() => _EyeButtonState();
}

class _EyeButtonState extends State<EyeButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null && !widget.busy;
    final child = AnimatedScale(
      scale: _down ? 0.97 : 1,
      duration: const Duration(milliseconds: 140),
      curve: Curves.easeOutCubic,
      child: ClipPath(
        clipper: const EyeClipper(),
        child: Material(
          color: enabled ? widget.color : widget.color.withValues(alpha: 0.5),
          child: InkWell(
            onTap: enabled ? widget.onPressed : null,
            onHighlightChanged: (v) => setState(() => _down = v),
            child: Container(
              height: widget.height,
              constraints: const BoxConstraints(minWidth: 180),
              padding: const EdgeInsets.symmetric(horizontal: 48),
              alignment: Alignment.center,
              child: widget.busy
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                  : Text(widget.label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17)),
            ),
          ),
        ),
      ),
    );
    return Semantics(button: true, enabled: enabled, label: widget.label, child: widget.expand ? SizedBox(width: double.infinity, child: child) : child);
  }
}

/// Saqr's mark: a red eye with an ink iris.
class EyeMark extends StatelessWidget {
  const EyeMark({super.key, this.width = 40});
  final double width;
  @override
  Widget build(BuildContext context) => CustomPaint(size: Size(width, width * .6), painter: _MarkPainter());
}

class _MarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawPath(eyePath(size), Paint()..color = C.accent);
    canvas.drawCircle(Offset(size.width * .54, size.height * .5), size.height * .22, Paint()..color = C.ink);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// The hero eye. Its iris takes the verdict colour and the pupil narrows as risk rises
/// (round when safe, a slit when dangerous) — animated between states.
class HeroEye extends StatelessWidget {
  const HeroEye({super.key, this.level, this.mirror = false});
  final String? level;
  final bool mirror;

  @override
  Widget build(BuildContext context) {
    final pupil = switch (level) {
      'safe' => const Size(.30, .30),
      'suspicious' => const Size(.17, .29),
      'dangerous' => const Size(.07, .44),
      _ => const Size(.25, .25),
    };
    final iris = switch (level) {
      'safe' => C.safe,
      'suspicious' => C.warnIris,
      'dangerous' => const Color(0xFFF5C7C3),
      _ => C.ink,
    };
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 900),
      curve: Curves.easeOutCubic,
      builder: (context, open, _) => TweenAnimationBuilder<Size?>(
        tween: SizeTween(end: pupil),
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
        builder: (context, p, _) => TweenAnimationBuilder<Color?>(
          tween: ColorTween(end: iris),
          duration: const Duration(milliseconds: 420),
          builder: (context, ic, _) => Transform(
            alignment: Alignment.center,
            transform: Matrix4.diagonal3Values(mirror ? -1 : 1, 1, 1),
            child: CustomPaint(painter: _HeroEyePainter(open: open, pupil: p ?? pupil, iris: ic ?? iris), child: const AspectRatio(aspectRatio: 10 / 6.6)),
          ),
        ),
      ),
    );
  }
}

class _HeroEyePainter extends CustomPainter {
  _HeroEyePainter({required this.open, required this.pupil, required this.iris});
  final double open;
  final Size pupil;
  final Color iris;

  @override
  void paint(Canvas canvas, Size size) {
    final eyeH = size.height;
    final eye = Size(size.width, eyeH);
    // The lid opens from a line to the full almond.
    canvas.save();
    canvas.translate(0, eyeH * .5 * (1 - open));
    canvas.scale(1, math.max(open, 0.001));
    canvas.drawPath(eyePath(eye), Paint()..color = C.accent);
    canvas.restore();
    final center = Offset(size.width * .5, eyeH * .5);
    final r = eyeH * .29 * open;
    canvas.drawCircle(center, r, Paint()..color = iris);
    canvas.drawOval(Rect.fromCenter(center: center, width: size.width * pupil.width * .5 * open, height: eyeH * pupil.height * open), Paint()..color = C.ink);
    canvas.drawCircle(center + Offset(r * .26, -r * .29), r * .12, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant _HeroEyePainter old) => old.open != open || old.pupil != pupil || old.iris != iris;
}

/// The verdict eye on the result card: iris in the verdict colour, score inside.
class VerdictEye extends StatelessWidget {
  const VerdictEye({super.key, required this.score, required this.level});
  final int score;
  final String level;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      height: 72,
      child: Stack(alignment: Alignment.center, children: [
        ClipPath(clipper: const EyeClipper(), child: Container(color: C.ink)),
        Container(width: 54, height: 54, decoration: BoxDecoration(color: C.iris(level), shape: BoxShape.circle)),
        Text('$score', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20, color: level == 'suspicious' ? C.ink : Colors.white)),
      ]),
    );
  }
}

/// Small eye bullet used for reasons (severity colour).
class EyeDot extends StatelessWidget {
  const EyeDot({super.key, required this.color, this.width = 18});
  final Color color;
  final double width;
  @override
  Widget build(BuildContext context) =>
      ClipPath(clipper: const EyeClipper(), child: Container(width: width, height: width * .6, color: color));
}
