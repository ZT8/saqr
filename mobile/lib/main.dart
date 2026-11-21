import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'api.dart';
import 'i18n.dart';
import 'screens/more.dart';
import 'screens/registry.dart';
import 'screens/report.dart';
import 'screens/scan.dart';
import 'screens/train.dart';
import 'theme.dart';
import 'widgets/eye.dart';

/// App-wide state: language, current tab, and a report prefilled from a scan.
class AppState extends ChangeNotifier {
  AppState._();
  static final AppState I = AppState._();

  int tab = 0;
  Map<String, String>? prefill;

  void setLang(String l) {
    Strings.I.lang = l;
    Api.I.setPref('lang', l);
    notifyListeners();
  }

  void go(int i) {
    tab = i;
    notifyListeners();
  }

  void refresh() => notifyListeners();

  void reportThis(String type, String value) {
    prefill = {'type': type, 'value': value};
    go(1);
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Future.wait([Strings.I.load(), Api.I.init(), initializeDateFormatting('ar'), initializeDateFormatting('en')]);
  Strings.I.lang = Api.I.pref('lang') ?? 'ar';
  runApp(const SaqrApp());
  // Pick up any strings added on the server since this build (non-blocking).
  Api.I.i18n().then((m) {
    Strings.I.update(m);
    AppState.I.refresh();
  }).catchError((_) {});
}

class SaqrApp extends StatelessWidget {
  const SaqrApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState.I,
      builder: (context, _) => MaterialApp(
        title: 'Saqr',
        debugShowCheckedModeBanner: false,
        theme: saqrTheme(),
        locale: Locale(Strings.I.lang),
        supportedLocales: const [Locale('ar'), Locale('en')],
        localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
        home: const Shell(),
      ),
    );
  }
}

class Shell extends StatelessWidget {
  const Shell({super.key});

  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: AppState.I, builder: (context, _) => _build(context));

  Widget _build(BuildContext context) {
    final s = AppState.I;
    // Not const: every page rebuilds when the language changes.
    // ignore: prefer_const_constructors
    final pages = <Widget>[ScanScreen(), ReportScreen(), RegistryScreen(), TrainScreen(), MoreScreen()];
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 20,
        title: Row(children: [const EyeMark(width: 38), const SizedBox(width: 10), Text(t('brand'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 24))]),
        actions: [
          TextButton(
            onPressed: () => s.setLang(Strings.I.lang == 'ar' ? 'en' : 'ar'),
            child: Text(t('lang_toggle'), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: IndexedStack(index: s.tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: s.tab,
        onDestinationSelected: s.go,
        destinations: [
          NavigationDestination(icon: const Icon(Icons.search), label: t('nav_scan')),
          NavigationDestination(icon: const Icon(Icons.flag_outlined), selectedIcon: const Icon(Icons.flag), label: t('nav_report')),
          NavigationDestination(icon: const Icon(Icons.list_alt), label: t('nav_registry')),
          NavigationDestination(icon: const Icon(Icons.school_outlined), selectedIcon: const Icon(Icons.school), label: t('nav_train')),
          NavigationDestination(icon: const Icon(Icons.more_horiz), label: t('app_more')),
        ],
      ),
    );
  }
}
