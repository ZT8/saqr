import 'package:flutter_test/flutter_test.dart';
import 'package:saqr/i18n.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Arabic and English plurals', () async {
    await Strings.I.load();
    Strings.I.lang = 'ar';
    expect(Strings.I.plural(1), 'بلاغ واحد');
    expect(Strings.I.plural(2), 'بلاغان');
    expect(Strings.I.plural(5), '5 بلاغات');
    expect(Strings.I.plural(11), '11 بلاغاً');
    Strings.I.lang = 'en';
    expect(Strings.I.plural(1), '1 report');
    expect(Strings.I.plural(1284), '1,284 reports');
  });

  test('templates fill parameters', () async {
    await Strings.I.load();
    Strings.I.lang = 'en';
    expect(t('result_meta', {'s': 96, 'type': 'Message'}), 'Risk score 96 of 100 · Message');
    expect(Strings.I.reason({'code': 'registry_verified', 'params': {'reports': 12}}), contains('12'));
  });
}
