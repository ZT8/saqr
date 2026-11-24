import 'package:flutter/foundation.dart';

class CartLine {
  final int itemId;
  final String name;
  final int price; // fils
  int qty;
  CartLine(this.itemId, this.name, this.price, this.qty);
}

class Cart extends ChangeNotifier {
  int? merchantId;
  int? branchId;
  String merchantName = '';
  final Map<int, CartLine> lines = {};

  int get count => lines.values.fold(0, (a, l) => a + l.qty);
  int get total => lines.values.fold(0, (a, l) => a + l.price * l.qty);
  bool get isEmpty => lines.isEmpty;
  int qtyOf(int itemId) => lines[itemId]?.qty ?? 0;

  bool belongsTo(int merchant) => merchantId == null || merchantId == merchant || lines.isEmpty;

  void start(int merchant, int branch, String name) {
    if (merchantId != merchant) lines.clear();
    merchantId = merchant;
    branchId = branch;
    merchantName = name;
    notifyListeners();
  }

  void add(int itemId, String name, int price) {
    final l = lines[itemId];
    if (l == null) {
      lines[itemId] = CartLine(itemId, name, price, 1);
    } else if (l.qty < 50) {
      l.qty++;
    }
    notifyListeners();
  }

  void remove(int itemId) {
    final l = lines[itemId];
    if (l == null) return;
    l.qty--;
    if (l.qty <= 0) lines.remove(itemId);
    notifyListeners();
  }

  void clear() {
    lines.clear();
    merchantId = null;
    branchId = null;
    notifyListeners();
  }

  List<Map<String, dynamic>> toItems() => lines.values.map((l) => {'item_id': l.itemId, 'qty': l.qty}).toList();
}

final Cart cart = Cart();
