import 'package:flutter/material.dart';
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Tabs are built the first time they are opened, then kept alive.
      body: IndexedStack(index: tab, children: [for (var i = 0; i < 5; i++) _opened.contains(i) ? _screen(i) : const SizedBox.shrink()]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() { tab = i; _opened.add(i); }),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'الرئيسية'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long_rounded), label: 'طلباتي'),
          NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore_rounded), label: 'اكسبلور'),
          NavigationDestination(icon: Icon(Icons.photo_camera_outlined), selectedIcon: Icon(Icons.photo_camera_rounded), label: 'سوشال'),
          NavigationDestination(icon: Icon(Icons.menu_rounded), selectedIcon: Icon(Icons.menu_rounded), label: 'المزيد'),
        ],
      ),
    );
  }
}
