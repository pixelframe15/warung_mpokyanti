const state = {
  menu: [],
  paymentMethods: [],
  cart: []
};

const rupiah = (n) => new Intl.NumberFormat('id-ID').format(n);

async function fetchJSON(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Terjadi kesalahan.' }));
    throw new Error(err.message || 'Request gagal');
  }

  return res.json();
}

function renderMenu() {
  const menuList = document.getElementById('menuList');
  menuList.innerHTML = state.menu
    .map(
      (item) => `
      <article class="menu-item">
        <h3>${item.name}</h3>
        <p>Kategori: ${item.category}</p>
        <p>Harga: <strong>Rp ${rupiah(item.price)}</strong></p>
        <p>Stok: ${item.stock}</p>
        <button data-id="${item.id}" class="add-to-cart">Tambah ke Keranjang</button>
      </article>
    `
    )
    .join('');

  document.querySelectorAll('.add-to-cart').forEach((button) => {
    button.addEventListener('click', () => addToCart(button.dataset.id));
  });
}

function addToCart(menuId) {
  const existing = state.cart.find((item) => item.menuId === menuId);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({ menuId, qty: 1 });
  }
  renderCart();
}

function renderCart() {
  const cartList = document.getElementById('cartList');
  if (!state.cart.length) {
    cartList.innerHTML = '<li>Keranjang masih kosong.</li>';
    document.getElementById('subtotal').textContent = '0';
    return;
  }

  let subtotal = 0;
  cartList.innerHTML = state.cart
    .map((cart) => {
      const menu = state.menu.find((m) => m.id === cart.menuId);
      const total = menu.price * cart.qty;
      subtotal += total;
      return `<li>${menu.name} x${cart.qty} - Rp ${rupiah(total)}</li>`;
    })
    .join('');

  document.getElementById('subtotal').textContent = rupiah(subtotal);
}

function renderPaymentMethods() {
  const select = document.getElementById('paymentMethodSelect');
  select.innerHTML = state.paymentMethods
    .map((method) => `<option value="${method.id}">${method.name} (fee Rp ${rupiah(method.fee)})</option>`)
    .join('');
}

async function initData() {
  state.menu = await fetchJSON('/api/menu');
  state.paymentMethods = await fetchJSON('/api/payment-methods');
  renderMenu();
  renderCart();
  renderPaymentMethods();
}

document.getElementById('orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  if (!state.cart.length) {
    document.getElementById('orderResult').textContent = 'Tambahkan menu dulu ke keranjang.';
    return;
  }

  const payload = {
    customerName: formData.get('customerName'),
    customerPhone: formData.get('customerPhone'),
    deliveryAddress: formData.get('deliveryAddress'),
    promoCode: formData.get('promoCode') || null,
    paymentMethodId: formData.get('paymentMethodId'),
    items: state.cart
  };

  try {
    const result = await fetchJSON('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    state.cart = [];
    renderCart();
    document.getElementById('orderResult').textContent = `Order berhasil!\nID: ${result.id}\nTotal: Rp ${rupiah(result.total)}\nStatus: ${result.status}`;
    e.target.reset();
  } catch (error) {
    document.getElementById('orderResult').textContent = error.message;
  }
});

document.querySelectorAll('#socialForm [data-provider]').forEach((button) => {
  button.addEventListener('click', async () => {
    const formData = new FormData(document.getElementById('socialForm'));
    const payload = {
      provider: button.dataset.provider,
      email: formData.get('email'),
      name: formData.get('name')
    };

    try {
      const result = await fetchJSON('/api/auth/social-login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      document.getElementById('socialResult').textContent = JSON.stringify(result, null, 2);
    } catch (error) {
      document.getElementById('socialResult').textContent = error.message;
    }
  });
});

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  try {
    await fetchJSON('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password')
      })
    });

    document.getElementById('adminPanel').hidden = false;
    loadAdminDashboard();
  } catch (error) {
    alert(error.message);
  }
});

async function loadAdminDashboard() {
  const data = await fetchJSON('/api/admin/dashboard');

  document.getElementById('kpi').innerHTML = Object.entries(data.kpi)
    .map(([k, v]) => `<div class="kpi"><strong>${k}</strong><br/>${typeof v === 'number' ? rupiah(v) : v}</div>`)
    .join('');

  document.getElementById('adminOrders').innerHTML = buildTable(data.orders, ['id', 'customerName', 'total', 'status']);
  document.getElementById('adminPayments').innerHTML = buildTable(data.payments, ['orderId', 'method', 'amount', 'status']);
  document.getElementById('adminInventory').innerHTML = buildTable(data.inventory, ['item', 'unit', 'remaining']);
  document.getElementById('adminPromos').innerHTML = buildTable(data.promos, ['code', 'discountPercent', 'active']);
}

function buildTable(rows, columns) {
  if (!rows.length) return '<p>Belum ada data.</p>';

  const header = columns.map((c) => `<th>${c}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${row[c] ?? '-'}</td>`).join('')}</tr>`)
    .join('');

  return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

document.getElementById('newMenuForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = {
    name: formData.get('name'),
    category: formData.get('category'),
    price: Number(formData.get('price')),
    stock: Number(formData.get('stock'))
  };

  try {
    await fetchJSON('/api/menu', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    alert('Menu baru berhasil ditambahkan!');
    e.target.reset();
    await initData();
    await loadAdminDashboard();
  } catch (error) {
    alert(error.message);
  }
});

initData();
