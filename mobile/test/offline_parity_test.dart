import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:saqr/offline.dart';

// The on-device engine must give the same verdict as the server engine for every case
// exported by `npm run mobile:export` (dataset samples, practice questions, links and numbers).
void main() {
  final engine = OfflineEngine.fromJson(File('assets/offline/engine.json').readAsStringSync());
  final cases = (jsonDecode(File('test/fixtures/parity.json').readAsStringSync()) as List).cast<Map<String, dynamic>>();

  test('offline engine matches the server engine', () {
    final failures = <String>[];
    for (final c in cases) {
      final r = engine.analyze(c['value'] as String);
      final codes = (r['reasons'] as List).map((e) => e['code']).toList();
      if (r['detectedType'] != c['type'] || r['score'] != c['score'] || codes.join(',') != (c['codes'] as List).join(',')) {
        failures.add('${c['value']}\n   server: ${c['type']} ${c['score']} ${(c['codes'] as List).join(',')}\n   device: ${r['detectedType']} ${r['score']} ${codes.join(',')}');
      }
    }
    expect(failures, isEmpty, reason: '${failures.length}/${cases.length} differ:\n${failures.join('\n')}');
  });

  test('typical scam is dangerous offline', () {
    final r = engine.analyze('شرطة أبوظبي: لديك مخالفة مرورية غير مدفوعة بقيمة 400 درهم، ادفع خلال 24 ساعة لتجنب حجز المركبة adpolice-fines.com/pay');
    expect(r['level'], 'dangerous');
    expect(r['offline'], true);
  });
}
