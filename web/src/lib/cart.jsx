// Cart state: one store at a time (like V-Thru), persisted on the device.
import { createContext, useContext, useEffect, useState } from 'react';

const KEY = 'around_cart';
const empty = { merchant_id: null, merchant_name: '', branch_id: null, lines: [], source_post_id: null, gift_id: null };
const CartCtx = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return empty; }
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(cart)); }, [cart]);

  const value = {
    cart,
    count: cart.lines.reduce((a, l) => a + l.qty, 0),
    subtotal: cart.lines.reduce((a, l) => a + l.qty * l.price, 0),
    // Returns false if adding would mix two stores (caller asks the user to confirm).
    canAdd: (merchantId) => !cart.lines.length || cart.merchant_id === merchantId,
    add(store, branchId, item, qty = 1) {
      setCart((c) => {
        const base = c.merchant_id === store.id ? c : { ...empty, merchant_id: store.id, merchant_name: store.name };
        const lines = [...base.lines];
        const i = lines.findIndex((l) => l.item_id === item.id);
        if (i >= 0) lines[i] = { ...lines[i], qty: Math.min(50, lines[i].qty + qty) };
        else lines.push({ item_id: item.id, name: item.name, price: item.price, qty });
        return { ...base, branch_id: branchId || base.branch_id, lines };
      });
    },
    setQty(itemId, qty) {
      setCart((c) => {
        const lines = c.lines.map((l) => (l.item_id === itemId ? { ...l, qty } : l)).filter((l) => l.qty > 0);
        return lines.length || c.gift_id ? { ...c, lines } : empty;
      });
    },
    setBranch: (branchId) => setCart((c) => ({ ...c, branch_id: branchId })),
    load(store, branchId, lines, sourcePostId = null) {
      setCart({ ...empty, merchant_id: store.id, merchant_name: store.name, branch_id: branchId, lines, source_post_id: sourcePostId });
    },
    useGift(store, branchId, giftId) {
      setCart((c) => (c.merchant_id === store.id ? { ...c, gift_id: giftId, branch_id: c.branch_id || branchId }
        : { ...empty, merchant_id: store.id, merchant_name: store.name, branch_id: branchId, gift_id: giftId }));
    },
    clearGift: () => setCart((c) => ({ ...c, gift_id: null })),
    clear: () => setCart(empty)
  };
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export const useCart = () => useContext(CartCtx);
