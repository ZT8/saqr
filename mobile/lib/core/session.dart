import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';

class Session extends ChangeNotifier {
  Map<String, dynamic>? user;
  bool ready = false;
  static const _key = 'around_token';

  bool get signedIn => api.token != null && user != null;
  String get name => (user?['name'] as String?) ?? '';

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    api.token = p.getString(_key);
    api.onUnauthorized = () => signOut();
    if (api.token != null) {
      try {
        user = Map<String, dynamic>.from(await api.get('/auth/me') as Map);
      } on ApiException catch (e) {
        if (e.status == 401) api.token = null;
      }
    }
    ready = true;
    notifyListeners();
  }

  Future<void> signIn(String token, Map<String, dynamic> u) async {
    api.token = token;
    user = u;
    final p = await SharedPreferences.getInstance();
    await p.setString(_key, token);
    notifyListeners();
  }

  Future<void> refresh() async {
    user = Map<String, dynamic>.from(await api.get('/auth/me') as Map);
    notifyListeners();
  }

  Future<void> signOut() async {
    api.token = null;
    user = null;
    final p = await SharedPreferences.getInstance();
    await p.remove(_key);
    notifyListeners();
  }
}

final Session session = Session();
