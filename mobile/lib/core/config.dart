import 'package:shared_preferences/shared_preferences.dart';

/// Server address. Default can be set at build time:
///   flutter build ios --dart-define=API_URL=https://api.example.com
/// It can also be changed inside the app (long-press the logo on the login screen),
/// which is handy for temporary tunnels whose URL changes.
const String _buildApi = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:4000');
String apiBase = _buildApi;

Future<void> loadServer() async {
  final p = await SharedPreferences.getInstance();
  final s = p.getString('around_server');
  if (s != null && s.isNotEmpty) apiBase = s;
}

/// Normalises what the user typed: trims, adds https://, drops trailing slashes and /api.
String normalizeServer(String raw) {
  var s = raw.trim();
  if (s.isEmpty) return '';
  if (!s.startsWith('http://') && !s.startsWith('https://')) s = 'https://$s';
  s = s.replaceAll(RegExp(r'/+$'), '');
  if (s.endsWith('/api')) s = s.substring(0, s.length - 4);
  return s;
}

Future<void> saveServer(String raw) async {
  final p = await SharedPreferences.getInstance();
  final s = normalizeServer(raw);
  if (s.isEmpty) {
    await p.remove('around_server');
    apiBase = _buildApi;
  } else {
    await p.setString('around_server', s);
    apiBase = s;
  }
}

/// Uploaded images come back as relative paths (/uploads/...).
String assetUrl(String? path) {
  if (path == null || path.isEmpty) return '';
  return path.startsWith('http') ? path : '$apiBase$path';
}
