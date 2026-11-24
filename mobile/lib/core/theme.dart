import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const ground = Color(0xFFF1F2EE);
  static const surface = Colors.white;
  static const ink = Color(0xFF0B1410);
  static const muted = Color(0xFF66706A);
  static const deep = Color(0xFF0C1D16);
  static const accent = Color(0xFFCFF03A);
  static const accentSoft = Color(0xFFEBF7B8);
  static const accentInk = Color(0xFF3E4F00);
  static const ok = Color(0xFF17895A);
  static const danger = Color(0xFFC23B2B);
  static const line = Color(0xFFE2E4DE);
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: AppColors.deep, primary: AppColors.deep, secondary: AppColors.accent, surface: AppColors.surface),
    scaffoldBackgroundColor: AppColors.ground,
  );
  final text = GoogleFonts.readexProTextTheme(base.textTheme).apply(bodyColor: AppColors.ink, displayColor: AppColors.ink);
  return base.copyWith(
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.ground,
      foregroundColor: AppColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: text.titleLarge?.copyWith(fontWeight: FontWeight.w600),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.accent,
        foregroundColor: AppColors.accentInk,
        minimumSize: const Size.fromHeight(54),
        shape: const StadiumBorder(),
        textStyle: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.ink,
        minimumSize: const Size.fromHeight(54),
        shape: const StadiumBorder(),
        side: const BorderSide(color: AppColors.line),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.deep, width: 1.5)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: AppColors.accent,
      labelTextStyle: WidgetStatePropertyAll(text.labelMedium),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
    ),
  );
}
