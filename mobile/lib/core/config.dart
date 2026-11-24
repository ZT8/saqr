/// Server address. Override at build time:
///   flutter run --dart-define=API_URL=https://api.example.com
const String apiBase = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:4000');

/// Uploaded images come back as relative paths (/uploads/...).
String assetUrl(String? path) {
  if (path == null || path.isEmpty) return '';
  return path.startsWith('http') ? path : '$apiBase$path';
}
