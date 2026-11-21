import 'package:flutter/material.dart';

/// Saqr design tokens — the same system as the web app: white ground, ink, signal red,
/// and the falcon's eye as the only shape.
class C {
  static const bg = Color(0xFFFFFFFF);
  static const surface = Color(0xFFF2F2F2);
  static const surface2 = Color(0xFFE6E6E6);
  static const ink = Color(0xFF0A0A0A);
  static const muted = Color(0xFF5C5C5C);
  static const accent = Color(0xFFD92B21);
  static const accentPress = Color(0xFFB8221A);
  static const safe = Color(0xFF0D7A4A);
  static const safeBg = Color(0xFFE3F3EA);
  static const warn = Color(0xFF9A5800);
  static const warnBg = Color(0xFFFBEFD8);
  static const warnIris = Color(0xFFE0A100);
  static const danger = Color(0xFFC4211A);
  static const dangerBg = Color(0xFFFDE7E5);
  static const info = Color(0xFF23517A);
  static const infoBg = Color(0xFFE6EEF6);

  static Color level(String? l) => l == 'safe' ? safe : l == 'suspicious' ? warn : l == 'dangerous' ? danger : muted;
  static Color levelBg(String? l) => l == 'safe' ? safeBg : l == 'suspicious' ? warnBg : l == 'dangerous' ? dangerBg : surface;
  static Color iris(String? l) => l == 'safe' ? safe : l == 'suspicious' ? warnIris : l == 'dangerous' ? danger : surface2;
  static Color severity(String? s) => switch (s) {
        'high' => danger,
        'medium' => warnIris,
        'low' => const Color(0xFFC9A35C),
        'safe' => safe,
        _ => const Color(0xFF9AA5AD),
      };
}

ThemeData saqrTheme() {
  final base = ThemeData(
    useMaterial3: true,
    fontFamily: 'Saqr',
    scaffoldBackgroundColor: C.bg,
    colorScheme: ColorScheme.fromSeed(seedColor: C.accent, primary: C.ink, secondary: C.accent, surface: C.bg, error: C.danger),
  );
  return base.copyWith(
    appBarTheme: const AppBarTheme(backgroundColor: C.bg, foregroundColor: C.ink, elevation: 0, scrolledUnderElevation: 0, centerTitle: false),
    textTheme: base.textTheme.apply(bodyColor: C.ink, displayColor: C.ink).copyWith(
          displaySmall: const TextStyle(fontFamily: 'Saqr', fontSize: 40, height: 1.05, fontWeight: FontWeight.w700, color: C.ink),
          headlineMedium: const TextStyle(fontFamily: 'Saqr', fontSize: 28, height: 1.15, fontWeight: FontWeight.w700, color: C.ink),
          titleLarge: const TextStyle(fontFamily: 'Saqr', fontSize: 20, height: 1.3, fontWeight: FontWeight.w700, color: C.ink),
          bodyLarge: const TextStyle(fontFamily: 'Saqr', fontSize: 17, height: 1.55, color: C.ink),
          bodyMedium: const TextStyle(fontFamily: 'Saqr', fontSize: 15, height: 1.5, color: C.ink),
        ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: C.surface,
      border: OutlineInputBorder(borderRadius: BorderRadius.zero, borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.zero, borderSide: BorderSide(color: C.ink, width: 2)),
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: C.bg,
      indicatorColor: C.surface,
      labelTextStyle: WidgetStateProperty.all(const TextStyle(fontFamily: 'Saqr', fontSize: 12, fontWeight: FontWeight.w600)),
    ),
    snackBarTheme: const SnackBarThemeData(backgroundColor: C.ink, behavior: SnackBarBehavior.floating),
    dividerTheme: const DividerThemeData(color: C.surface2, thickness: 1, space: 1),
  );
}
