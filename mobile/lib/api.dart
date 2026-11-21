import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'offline.dart';

/// Error returned by the Saqr API: `code` matches the web app's error codes (e_<code> strings).
class ApiError implements Exception {
  ApiError(this.code, [this.status = 0]);
  final String code;
  final int status;
  @override
  String toString() => 'ApiError($code, $status)';
}

/// Thin client for the Saqr REST API (the same endpoints the web app uses).
class Api {
  Api._();
  static final Api I = Api._();

  static const defaultBase = 'http://10.0.2.2:3000'; // Android emulator → host machine
  String base = defaultBase;
  DateTime? _offlineUntil;
  SharedPreferences? _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    base = _prefs!.getString('server') ?? defaultBase;
  }

  Future<void> setBase(String url) async {
    base = url.trim().replaceAll(RegExp(r'/+$'), '');
    _offlineUntil = null;
    await _prefs?.setString('server', base);
  }

  String? pref(String k) => _prefs?.getString(k);
  Future<void> setPref(String k, String? v) async {
    if (v == null) {
      await _prefs?.remove(k);
    } else {
      await _prefs?.setString(k, v);
    }
  }

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, String>? headers, Duration? timeout}) async {
    final uri = Uri.parse('$base$path');
    final h = {'Content-Type': 'application/json', 'Accept': 'application/json', ...?headers};
    late http.Response res;
    try {
      final encoded = body == null ? null : jsonEncode(body);
      switch (method) {
        case 'POST':
          res = await http.post(uri, headers: h, body: encoded).timeout(timeout ?? const Duration(seconds: 45));
          break;
        case 'DELETE':
          res = await http.delete(uri, headers: h).timeout(timeout ?? const Duration(seconds: 10));
          break;
        default:
          res = await http.get(uri, headers: h).timeout(timeout ?? const Duration(seconds: 10));
      }
    } catch (_) {
      throw ApiError('network');
    }
    dynamic data;
    try {
      data = jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      data = null;
    }
    if (res.statusCode >= 400) {
      final code = data is Map && data['error'] is String ? data['error'] as String : 'server_error';
      throw ApiError(code, res.statusCode);
    }
    return data;
  }

  // ----- Public -----
  Future<Map<String, dynamic>> i18n() async => Map<String, dynamic>.from(await _send('GET', '/api/i18n'));
  Future<Map<String, dynamic>> meta() async => Map<String, dynamic>.from(await _send('GET', '/api/meta'));
  Future<Map<String, dynamic>> stats() async => Map<String, dynamic>.from(await _send('GET', '/api/stats'));

  /// Scans on the server (which adds the community registry and threat feeds). When the server
  /// cannot be reached, the same engine runs on the device and the result carries `offline: true`.
  Future<Map<String, dynamic>> scan(String value, {String type = 'auto', String? elderToken, bool share = false}) async {
    final now = DateTime.now();
    if (_offlineUntil != null && now.isBefore(_offlineUntil!)) return (await OfflineEngine.load()).analyze(value, type: type);
    try {
      final r = Map<String, dynamic>.from(await _send('POST', '/api/scan',
          body: {'type': type, 'value': value, 'share': share},
          headers: elderToken == null ? null : {'X-Elder-Token': elderToken},
          timeout: const Duration(seconds: 6)));
      _offlineUntil = null;
      return r;
    } on ApiError catch (e) {
      if (e.code != 'network') rethrow;
      _offlineUntil = now.add(const Duration(minutes: 1)); // don't wait for the server on every scan
      return (await OfflineEngine.load()).analyze(value, type: type);
    }
  }

  Future<Map<String, dynamic>> report(Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(await _send('POST', '/api/report', body: body));

  Future<Map<String, dynamic>> registry({String q = '', String type = '', int page = 1}) async =>
      Map<String, dynamic>.from(await _send('GET', '/api/registry?q=${Uri.encodeQueryComponent(q)}&type=$type&page=$page'));

  /// Practice questions come from the bank bundled with the app (generated from the server's
  /// bank and engine), so practice works with or without a connection.
  Future<List<dynamic>> training(String lang) async => ((await OfflineEngine.trainingBank(lang))..shuffle()).take(8).toList();

  // ----- Extortion help -----
  Future<Map<String, dynamic>> createCase(Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(await _send('POST', '/api/help/case', body: body));
  Future<Map<String, dynamic>> caseStatus(String ref, String code) async =>
      Map<String, dynamic>.from(await _send('POST', '/api/help/case/status', body: {'ref': ref, 'code': code}));
  Future<Map<String, dynamic>> caseEvidence(String ref, String code, List<Map<String, String>> files) async =>
      Map<String, dynamic>.from(await _send('POST', '/api/help/case/evidence', body: {'ref': ref, 'code': code, 'files': files}));
  Future<void> caseWithdraw(String ref, String code) async => _send('POST', '/api/help/case/withdraw', body: {'ref': ref, 'code': code});

  // ----- Family -----
  Future<Map<String, dynamic>> familyCreate(String label) async =>
      Map<String, dynamic>.from(await _send('POST', '/api/family', body: {'label': label}));
  Future<Map<String, dynamic>> familyAlerts(String guardian) async =>
      Map<String, dynamic>.from(await _send('GET', '/api/family/alerts', headers: {'X-Guardian-Token': guardian}));
  Future<void> familySeen(String guardian) async => _send('POST', '/api/family/seen', headers: {'X-Guardian-Token': guardian});
  Future<void> familyDelete(String guardian) async => _send('DELETE', '/api/family', headers: {'X-Guardian-Token': guardian});
  Future<Map<String, dynamic>> elderInfo(String elder) async =>
      Map<String, dynamic>.from(await _send('GET', '/api/family/elder', headers: {'X-Elder-Token': elder}));
  Future<void> elderHelp(String elder) async => _send('POST', '/api/family/help', headers: {'X-Elder-Token': elder});
}
