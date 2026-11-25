import 'dart:ui';
import 'package:flutter/material.dart';
import '../core/theme.dart';
import 'explore.dart';
import 'home.dart';
import 'more.dart';
import 'orders.dart';
import 'social.dart';

class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _Tab {
  final int index;
  final String label;
  final IconData icon;
  final IconData filled;
  const _Tab(this.index, this.label, this.icon, this.filled);
}

const _tabs = [
  _Tab(0, 'الرئيسية', Icons.local_cafe_outlined, Icons.local_cafe_rounded),
  _Tab(1, 'طلباتي', Icons.receipt_long_outlined, Icons.receipt_long_rounded),
  _Tab(3, 'سوشال', Icons.photo_camera_outlined, Icons.photo_camera_rounded),
  _Tab(4, 'المزيد', Icons.person_outline_rounded, Icons.person_rounded),
];

class _ShellState extends State<Shell> {
  int tab = 0;
  final _opened = <int>{0};

  Widget _screen(int i) {
    switch (i) {
      case 0:
        return const HomeScreen();
      case 1:
        return const OrdersScreen();
      case 2:
        return const ExploreScreen();
      case 3:
        return const SocialScreen();
      default:
        return const MoreScreen();
    }
  }

  void _go(int i) => setState(() {
        tab = i;
        _opened.add(i);
      });

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBody: true,
      body: SoftBackground(
        child: Stack(children: [
          // Tabs are built the first time they are opened, then kept alive.
          Positioned.fill(child: IndexedStack(index: tab, children: [for (var i = 0; i < 5; i++) _opened.contains(i) ? _screen(i) : const SizedBox.shrink()])),
          Positioned(
            left: 16,
            right: 16,
            bottom: (bottom > 0 ? bottom : 12) + 4,
            child: Row(children: [
              Expanded(child: _NavPill(current: tab, onTap: _go)),
              const SizedBox(width: 10),
              _SearchOrb(selected: tab == 2, onTap: () => _go(2)),
            ]),
          ),
        ]),
      ),
    );
  }
}

BoxDecoration _glass({bool selected = false}) => BoxDecoration(
      color: Colors.white.withValues(alpha: .82),
      borderRadius: BorderRadius.circular(40),
      border: Border.all(color: Colors.white.withValues(alpha: .9)),
      boxShadow: [BoxShadow(color: AppColors.deep.withValues(alpha: .08), blurRadius: 28, offset: const Offset(0, 10))],
    );

class _NavPill extends StatelessWidget {
  final int current;
  final ValueChanged<int> onTap;
  const _NavPill({required this.current, required this.onTap});
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(40),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: Container(
            height: 70,
            padding: const EdgeInsets.all(6),
            decoration: _glass(),
            child: Row(children: [
              for (final t in _tabs) Expanded(child: _NavItem(t, selected: current == t.index, onTap: () => onTap(t.index))),
            ]),
          ),
        ),
      );
}

class _NavItem extends StatelessWidget {
  final _Tab t;
  final bool selected;
  final VoidCallback onTap;
  const _NavItem(this.t, {required this.selected, required this.onTap});
  @override
  Widget build(BuildContext context) => PressScale(
        onTap: onTap,
        scale: .94,
        child: AnimatedContainer(
          duration: kMed,
          curve: kEase,
          decoration: BoxDecoration(color: selected ? AppColors.accentSoft : Colors.transparent, borderRadius: BorderRadius.circular(32)),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(selected ? t.filled : t.icon, size: 24, color: selected ? AppColors.deep : AppColors.muted),
            const SizedBox(height: 3),
            Text(t.label, maxLines: 1, style: TextStyle(fontSize: 11, height: 1.1, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? AppColors.deep : AppColors.muted)),
          ]),
        ),
      );
}

class _SearchOrb extends StatelessWidget {
  final bool selected;
  final VoidCallback onTap;
  const _SearchOrb({required this.selected, required this.onTap});
  @override
  Widget build(BuildContext context) => PressScale(
        onTap: onTap,
        scale: .92,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(40),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: AnimatedContainer(
              duration: kMed,
              curve: kEase,
              width: 70,
              height: 70,
              decoration: _glass().copyWith(color: selected ? AppColors.accent : Colors.white.withValues(alpha: .82)),
              child: Icon(Icons.explore_outlined, size: 28, color: selected ? AppColors.deep : AppColors.ink),
            ),
          ),
        ),
      );
}
