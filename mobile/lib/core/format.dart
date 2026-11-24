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
