/// Amounts are stored in fils (1 AED = 100 fils).
String aed(num fils) {
  final v = (fils / 100).toStringAsFixed(2);
  final parts = v.split('.');
  final whole = parts[0].replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');
  return '$whole.${parts[1]} د.إ';
}

String distanceLabel(num? metres) {
  if (metres == null) return '';
  if (metres >= 1000) return '${(metres / 1000).toStringAsFixed(1)} كم';
  return '${metres.round()} م';
}

/// Arabic plural for minutes: 1 دقيقة، 2 دقيقتين، 3-10 دقايق، 11+ دقيقة.
String minutesLabel(int n) {
  if (n == 1) return 'دقيقة';
  if (n == 2) return 'دقيقتين';
  if (n >= 3 && n <= 10) return '$n دقايق';
  return '$n دقيقة';
}

DateTime _parse(String? s) {
  if (s == null || s.isEmpty) return DateTime.now();
  var v = s.contains('T') ? s : s.replaceFirst(' ', 'T');
  if (!RegExp(r'(Z|[+-]\d\d:?\d\d)$').hasMatch(v)) v += 'Z';
  return DateTime.tryParse(v)?.toLocal() ?? DateTime.now();
}

/// "قبل 5 دقايق" style relative time for server timestamps (UTC, sqlite format).
String ago(String? iso) {
  final sec = DateTime.now().difference(_parse(iso)).inSeconds;
  if (sec < 60) return 'الحين';
  final m = (sec / 60).round();
  if (m < 60) return m == 1 ? 'قبل دقيقة' : m == 2 ? 'قبل دقيقتين' : 'قبل $m دقيقة';
  final h = (m / 60).round();
  if (h < 24) return h == 1 ? 'قبل ساعة' : h == 2 ? 'قبل ساعتين' : 'قبل $h ساعات';
  final d = (h / 24).round();
  return d == 1 ? 'قبل يوم' : d == 2 ? 'قبل يومين' : 'قبل $d أيام';
}

String dateShort(String? iso) {
  final d = _parse(iso);
  return '${d.day}/${d.month}/${d.year}';
}

String unitOf(Map? program) => program != null && program['type'] == 'points' ? 'نقطة' : 'ختم';
