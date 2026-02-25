const http = require('http');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || 3000;

const db = {
  users: [{ id: 'admin-1', name: 'Admin Mpok Mar', email: 'admin@mpokmar.id', role: 'admin', provider: 'local' }],
  menu: [
    { id: 'm1', name: 'Nasi Uduk Betawi', category: 'Makanan', price: 22000, stock: 40, spicyLevel: 1, featured: true },
    { id: 'm2', name: 'Soto Betawi', category: 'Makanan', price: 35000, stock: 25, spicyLevel: 2, featured: true },
    { id: 'm3', name: 'Gabus Pucung', category: 'Makanan', price: 38000, stock: 15, spicyLevel: 1, featured: false },
    { id: 'm4', name: 'Kerak Telor', category: 'Camilan', price: 25000, stock: 30, spicyLevel: 1, featured: true },
    { id: 'm5', name: 'Bir Pletok', category: 'Minuman', price: 15000, stock: 60, spicyLevel: 0, featured: false },
    { id: 'm6', name: 'Es Selendang Mayang', category: 'Minuman', price: 18000, stock: 45, spicyLevel: 0, featured: true }
  ],
  orders: [],
  payments: [],
  promos: [
    { code: 'BETAWI10', discountPercent: 10, active: true },
    { code: 'ONDEL20', discountPercent: 20, active: true }
  ],
  inventory: [
    { item: 'Beras pandan wangi', unit: 'kg', remaining: 120 },
    { item: 'Daging sapi', unit: 'kg', remaining: 42 },
    { item: 'Telor bebek', unit: 'butir', remaining: 300 }
  ]
};

const paymentMethods = [
  { id: 'qris', name: 'QRIS', fee: 0, instant: true },
  { id: 'gopay', name: 'GoPay', fee: 1500, instant: true },
  { id: 'ovo', name: 'OVO', fee: 1500, instant: true },
  { id: 'dana', name: 'DANA', fee: 1500, instant: true },
  { id: 'va_bca', name: 'Virtual Account BCA', fee: 2500, instant: false },
  { id: 'va_bni', name: 'Virtual Account BNI', fee: 2500, instant: false },
  { id: 'cod', name: 'Cash on Delivery', fee: 0, instant: false },
  { id: 'card', name: 'Kartu Kredit/Debit', fee: 3500, instant: true }
];

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload terlalu besar'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (_e) {
        reject(new Error('JSON tidak valid'));
      }
    });
  });
}

function serveStatic(req, res) {
  const publicDir = path.join(__dirname, 'public');
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.normalize(path.join(publicDir, reqPath));

  if (!filePath.startsWith(publicDir)) {
    json(res, 403, { message: 'Forbidden' });
    return true;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml'
  };

  res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  try {
    if (method === 'GET' && url === '/api/health') return json(res, 200, { status: 'ok', app: 'Warung Mpok Mar API' });
    if (method === 'GET' && url === '/api/menu') return json(res, 200, db.menu);
    if (method === 'GET' && url === '/api/payment-methods') return json(res, 200, paymentMethods);
    if (method === 'GET' && url === '/api/orders') return json(res, 200, db.orders);

    if (method === 'POST' && url === '/api/menu') {
      const body = await parseBody(req);
      const { name, category, price, stock } = body;
      if (!name || !category || !price) return json(res, 400, { message: 'Field name, category, dan price wajib diisi.' });
      const newItem = { id: createId('menu'), name, category, price: Number(price), stock: Number(stock || 0), spicyLevel: Number(body.spicyLevel || 0), featured: Boolean(body.featured) };
      db.menu.push(newItem);
      return json(res, 201, newItem);
    }

    if (method === 'PUT' && url.startsWith('/api/menu/')) {
      const id = url.split('/').pop();
      const idx = db.menu.findIndex((item) => item.id === id);
      if (idx === -1) return json(res, 404, { message: 'Menu tidak ditemukan.' });
      const body = await parseBody(req);
      db.menu[idx] = { ...db.menu[idx], ...body };
      return json(res, 200, db.menu[idx]);
    }

    if (method === 'DELETE' && url.startsWith('/api/menu/')) {
      const id = url.split('/').pop();
      const idx = db.menu.findIndex((item) => item.id === id);
      if (idx === -1) return json(res, 404, { message: 'Menu tidak ditemukan.' });
      db.menu.splice(idx, 1);
      res.writeHead(204);
      return res.end();
    }

    if (method === 'POST' && url === '/api/auth/social-login') {
      const { provider, email, name } = await parseBody(req);
      if (!provider || !email || !name) return json(res, 400, { message: 'provider, email, dan name wajib diisi.' });
      if (!['google', 'facebook'].includes(provider)) return json(res, 400, { message: 'Provider belum didukung.' });
      let user = db.users.find((u) => u.email === email);
      if (!user) {
        user = { id: createId('user'), email, name, role: 'customer', provider };
        db.users.push(user);
      }
      return json(res, 200, { token: `demo-token-${user.id}`, user, note: 'Mode demo OAuth aktif. Integrasikan client_id & client_secret untuk produksi.' });
    }

    if (method === 'POST' && url === '/api/auth/admin-login') {
      const { email, password } = await parseBody(req);
      if (email === 'admin@mpokmar.id' && password === 'admin123') {
        return json(res, 200, { token: 'admin-demo-token', user: { id: 'admin-1', name: 'Admin Mpok Mar', role: 'admin' } });
      }
      return json(res, 401, { message: 'Email atau password salah.' });
    }

    if (method === 'POST' && url === '/api/orders') {
      const { customerName, customerPhone, deliveryAddress, items, paymentMethodId, promoCode } = await parseBody(req);
      if (!customerName || !customerPhone || !Array.isArray(items) || !items.length || !paymentMethodId) return json(res, 400, { message: 'Data order belum lengkap.' });
      const paymentMethod = paymentMethods.find((m) => m.id === paymentMethodId);
      if (!paymentMethod) return json(res, 400, { message: 'Metode pembayaran tidak valid.' });
      let subtotal = 0;
      const detailedItems = items.map((cartItem) => {
        const menuItem = db.menu.find((m) => m.id === cartItem.menuId);
        if (!menuItem) throw new Error(`Menu ${cartItem.menuId} tidak ditemukan`);
        const qty = Number(cartItem.qty || 1);
        const lineTotal = menuItem.price * qty;
        subtotal += lineTotal;
        return { ...menuItem, qty, lineTotal };
      });
      let discount = 0;
      if (promoCode) {
        const promo = db.promos.find((p) => p.code === promoCode && p.active);
        if (promo) discount = Math.floor((subtotal * promo.discountPercent) / 100);
      }
      const total = subtotal - discount + paymentMethod.fee;
      const order = { id: createId('ord'), createdAt: new Date().toISOString(), customerName, customerPhone, deliveryAddress: deliveryAddress || 'Ambil di tempat', status: 'Menunggu Konfirmasi', items: detailedItems, paymentMethod, subtotal, discount, fee: paymentMethod.fee, total, promoCode: promoCode || null };
      db.orders.unshift(order);
      db.payments.unshift({ id: createId('pay'), orderId: order.id, method: paymentMethod.name, amount: total, status: paymentMethod.instant ? 'Paid' : 'Pending', timestamp: new Date().toISOString() });
      return json(res, 201, order);
    }

    if (method === 'PATCH' && url.startsWith('/api/orders/') && url.endsWith('/status')) {
      const id = url.split('/')[3];
      const order = db.orders.find((o) => o.id === id);
      if (!order) return json(res, 404, { message: 'Order tidak ditemukan.' });
      const body = await parseBody(req);
      order.status = body.status || order.status;
      return json(res, 200, order);
    }

    if (method === 'GET' && url === '/api/admin/dashboard') {
      const totalRevenue = db.orders.reduce((acc, curr) => acc + curr.total, 0);
      const totalOrders = db.orders.length;
      const totalCustomers = db.users.filter((u) => u.role === 'customer').length;
      const pendingOrders = db.orders.filter((o) => o.status !== 'Selesai').length;
      return json(res, 200, { kpi: { totalRevenue, totalOrders, totalCustomers, pendingOrders }, orders: db.orders.slice(0, 10), payments: db.payments.slice(0, 10), inventory: db.inventory, promos: db.promos });
    }

    if (serveStatic(req, res)) return;
    if (method === 'GET') {
      req.url = '/index.html';
      if (serveStatic(req, res)) return;
    }
    json(res, 404, { message: 'Not found' });
  } catch (error) {
    json(res, 500, { message: error.message || 'Terjadi kesalahan server.' });
  }
});

server.listen(port, () => {
  console.log(`Warung Mpok Mar running at http://localhost:${port}`);
});
