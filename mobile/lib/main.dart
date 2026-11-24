import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'core/config.dart';
import 'core/session.dart';
import 'core/theme.dart';
import 'screens/login.dart';
import 'screens/shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await loadServer();
  await session.load();
  runApp(const AroundApp());
}

class AroundApp extends StatelessWidget {
  const AroundApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Around',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      locale: const Locale('ar', 'AE'),
      supportedLocales: const [Locale('ar', 'AE')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: ListenableBuilder(
        listenable: session,
        builder: (context, _) => session.signedIn ? const Shell() : const LoginScreen(),
      ),
    );
  }
}
