// Payment gateway adapter.
//
// The platform never stores card data. Every charge goes through a provider adapter.
// Ships with a TEST provider (approves every charge, clearly marked) so the whole
// flow works end to end. To go live, implement the same interface for the chosen
// UAE gateway (N-Genius / Telr / Checkout.com / Stripe) and set PAYMENT_PROVIDER.
const crypto = require('crypto');
const db = require('../db');
const { fail } = require('./core');

const providers = {
  test: {
    name: 'test',
    // Returns { status: 'captured' | 'declined', providerRef }
    charge({ amount, method, card }) {
      if (amount <= 0) return { status: 'captured', providerRef: 'zero-' + Date.now() };
      // Test card that always declines, to exercise the error path.
      if (method === 'card' && card && String(card.number || '').replace(/\s/g, '') === '4000000000000002') {
        return { status: 'declined', providerRef: null };
      }
      return { status: 'captured', providerRef: 'test_' + crypto.randomBytes(6).toString('hex') };
    },
    refund({ providerRef }) { return { status: 'refunded', providerRef }; }
  }
  // ngenius: require('./gateways/ngenius'),  // live adapters plug in here
};

const PROVIDER = providers[process.env.PAYMENT_PROVIDER || 'test'];
const METHODS = ['card', 'apple_pay', 'google_pay'];

function charge(purpose, refId, amount, method, card) {
  if (!METHODS.includes(method)) fail(400, 'طريقة دفع غير مدعومة');
  const res = PROVIDER.charge({ amount, method, card });
  db.run(
    'INSERT INTO payments (purpose, ref_id, amount, provider, method, status, provider_ref) VALUES (?,?,?,?,?,?,?)',
    purpose, refId, amount, PROVIDER.name, method, res.status, res.providerRef
  );
  if (res.status !== 'captured') fail(402, 'تم رفض البطاقة، جرّب بطاقة ثانية');
  return res.providerRef;
}

function refund(purpose, refId) {
  const p = db.one(`SELECT * FROM payments WHERE purpose = ? AND ref_id = ? AND status = 'captured' ORDER BY id DESC`, purpose, refId);
  if (!p) return null;
  const r = PROVIDER.refund({ providerRef: p.provider_ref });
  db.run(
    'INSERT INTO payments (purpose, ref_id, amount, provider, method, status, provider_ref) VALUES (?,?,?,?,?,?,?)',
    purpose, refId, -p.amount, PROVIDER.name, p.method, r.status, p.provider_ref
  );
  return r;
}

module.exports = { charge, refund, METHODS, isTest: PROVIDER.name === 'test' };
