import 'dart:convert';
import 'package:http/http.dart' as http;
import 'config.dart';

class ApiException implements Exception {
  final String message;
  final int status;
  ApiException(this.message, this.status);
  @override
  String toString() => message;
}

class Api {
  String? token;
  void Function()? onUnauthorized;

  Uri _uri(String path, [Map<String, String>? query]) {
    final u = Uri.parse('$apiBase/api$path');
    return query == null || query.isEmpty ? u : u.replace(queryParameters: query);
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> _run(Future<http.Response> Function() send) async {
    http.Response r;
    try {
      r = await send().timeout(const Duration(seconds: 15));
    } catch (_) {
      throw ApiException('ما قدرنا نتصل بالخادم، تأكد من الإنترنت', 0);
    }
    dynamic body;
    try {
      body = r.bodyBytes.isEmpty ? null : jsonDecode(utf8.decode(r.bodyBytes));
    } catch (_) {
      body = null;
    }
    if (r.statusCode >= 200 && r.statusCode < 300) return body;
    if (r.statusCode == 401) onUnauthorized?.call();
    final msg = body is Map && body['error'] is String ? body['error'] as String : 'صار خطأ، حاول مرة ثانية';
    throw ApiException(msg, r.statusCode);
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) => _run(() => http.get(_uri(path, query), headers: _headers));
  Future<dynamic> post(String path, [Object? body]) => _run(() => http.post(_uri(path), headers: _headers, body: jsonEncode(body ?? {})));
  Future<dynamic> patch(String path, Object body) => _run(() => http.patch(_uri(path), headers: _headers, body: jsonEncode(body)));
  Future<dynamic> delete(String path) => _run(() => http.delete(_uri(path), headers: _headers));
}

final Api api = Api();
