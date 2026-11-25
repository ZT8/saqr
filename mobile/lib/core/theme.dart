import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Space the floating tab bar takes at the bottom of tab screens.
const double kNavSpace = 112;

/// Shared motion: strong ease-out, short durations.
const Curve kEase = Cubic(0.23, 1, 0.32, 1);
const Duration kFast = Duration(milliseconds: 160);
const Duration kMed = Duration(milliseconds: 240);

class AppColors {
  static const ground = Color(0xFFF4F7F1);
  static const surface = Colors.white;
  static const ink = Color(0xFF0F1B15);
  static const muted = Color(0xFF6A786F);
  static const deep = Color(0xFF0C1D16);
  static const accent = Color(0xFFCFF03A);
  static const accentSoft = Color(0xFFEAF6B6);
  static const accentInk = Color(0xFF3E4F00);
  static const ok = Color(0xFF17895A);
  static const danger = Color(0xFFD9583A);
  static const line = Color(0xFFE1E7DC);
  static const chip = Color(0xFFE9EFE5);
  static const sky = Color(0xFFD5E8C9);
}

/// Soft page wash: a tinted band that fades into the ground colour.
class SoftBackground extends StatelessWidget {
  final Widget child;
  const SoftBackground({super.key, required this.child});
  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: const BoxDecoration(color: AppColors.ground),
        child: Stack(children: [
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 360,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [AppColors.sky.withValues(alpha: .85), const Color(0xFFF3F6D8).withValues(alpha: .55), AppColors.ground.withValues(alpha: 0)],
                  stops: const [0, .5, 1],
                ),
              ),
            ),
          ),
          Positioned.fill(child: child),
        ]),
      );
}

/// Light press feedback: scales down a hair while the finger is on it.
class PressScale extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  const PressScale({super.key, required this.child, this.onTap, this.scale = .97});
  @override
  State<PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<PressScale> {
  bool down = false;
  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: widget.onTap == null ? null : (_) => setState(() => down = true),
        onTapUp: (_) => setState(() => down = false),
        onTapCancel: () => setState(() => down = false),
        onTap: widget.onTap,
        child: AnimatedScale(scale: down ? widget.scale : 1, duration: kFast, curve: kEase, child: widget.child),
      );
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: AppColors.deep, primary: AppColors.deep, secondary: AppColors.accent, surface: AppColors.surface),
    scaffoldBackgroundColor: AppColors.ground,
    splashFactory: InkRipple.splashFactory,
    splashColor: AppColors.deep.withValues(alpha: .05),
    highlightColor: Colors.transparent,
  );
  final text = GoogleFonts.readexProTextTheme(base.textTheme).apply(bodyColor: AppColors.ink, displayColor: AppColors.ink);
  const radius22 = BorderRadius.all(Radius.circular(22));
  return base.copyWith(
    textTheme: text,
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      TargetPlatform.android: CupertinoPageTransitionsBuilder(),
    }),
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.ground,
      foregroundColor: AppColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      titleTextStyle: text.titleMedium?.copyWith(fontWeight: FontWeight.w600, color: AppColors.ink),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.accent,
        foregroundColor: AppColors.accentInk,
        disabledBackgroundColor: AppColors.chip,
        disabledForegroundColor: AppColors.muted,
        minimumSize: const Size.fromHeight(54),
        shape: const StadiumBorder(),
        elevation: 0,
        textStyle: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.ink,
        minimumSize: const Size.fromHeight(54),
        shape: const StadiumBorder(),
        side: const BorderSide(color: AppColors.line),
        textStyle: text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: AppColors.deep, textStyle: text.labelLarge?.copyWith(fontWeight: FontWeight.w600))),
    iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(foregroundColor: AppColors.ink)),
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.chip,
      selectedColor: AppColors.accentSoft,
      side: BorderSide.none,
      shape: const StadiumBorder(),
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
      labelStyle: text.labelLarge?.copyWith(color: AppColors.ink, fontWeight: FontWeight.w500),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      hintStyle: text.bodyMedium?.copyWith(color: AppColors.muted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: const BorderSide(color: AppColors.line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: const BorderSide(color: AppColors.line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: const BorderSide(color: AppColors.deep, width: 1.4)),
    ),
    cardTheme: const CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: radius22, side: BorderSide(color: AppColors.line)),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.line, thickness: 1, space: 1),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    ),
    dialogTheme: DialogThemeData(backgroundColor: Colors.white, surfaceTintColor: Colors.transparent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26))),
    listTileTheme: const ListTileThemeData(iconColor: AppColors.ink),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.deep),
  );
}
