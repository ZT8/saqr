// Load .env if present (no extra dependency).
const fs0 = require('fs'), path0 = require('path');
const envFile = path0.join(__dirname, '..', '..', '.env');
if (fs0.existsSync(envFile)) for (const line of fs0.readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const http = require('http');
const { Server } = require('socket.io');
const { createApp } = require('./app');
const { realtime, userFromToken } = require('./services/core');

const PORT = Number(process.env.PORT || 4000);
const app = createApp();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

// Each socket authenticates with its JWT and joins rooms for its role.
io.use((socket, next) => {
  const user = userFromToken(socket.handshake.auth && socket.handshake.auth.token);
  if (!user) return next(new Error('unauthorized'));
  socket.user = user;
  next();
});
io.on('connection', (socket) => {
  const u = socket.user;
  socket.join('user:' + u.id);
  if (u.role === 'staff' && u.branch_id) socket.join('branch:' + u.branch_id);
  if (u.role === 'merchant' && u.merchant_id) {
    socket.join('merchant:' + u.merchant_id);
    socket.on('branch:watch', (branchId) => {
      const db = require('./db');
      const b = db.one('SELECT merchant_id FROM branches WHERE id = ?', branchId);
      if (b && b.merchant_id === u.merchant_id) {
        [...socket.rooms].filter((r) => r.startsWith('branch:')).forEach((r) => socket.leave(r));
        socket.join('branch:' + branchId);
      }
    });
  }
  if (u.role === 'admin') socket.join('admin');
});
realtime.attach(io);

server.listen(PORT, () => console.log(`Around server on http://localhost:${PORT}`));
