# Warung Mpok Mar - Fullstack Website

Website fullstack bertema warung khas Betawi dengan fitur:

- Landing page dengan nuansa Betawi (ornamen ondel-ondel, tari Betawi, warna tradisional).
- Menu digital + keranjang + checkout order online.
- Sistem pembayaran lengkap (QRIS, e-wallet, VA, COD, kartu).
- Login pelanggan via Google/Facebook (demo OAuth flow siap diintegrasikan ke provider asli).
- Dashboard admin lengkap: KPI, order, pembayaran, inventory, promo, dan tambah menu.
- API backend REST untuk menu, order, auth, payment methods, dan data admin.

## Jalankan proyek

```bash
npm install
npm run start
```

Lalu buka: `http://localhost:3000`

## Kredensial demo admin

- Email: `admin@mpokmar.id`
- Password: `admin123`

## Catatan OAuth produksi

Saat ini login sosial menggunakan **mode demo** agar bisa langsung dicoba lokal.
Untuk produksi, endpoint `/api/auth/social-login` perlu dihubungkan ke OAuth provider asli (Google/Facebook) menggunakan client id/secret dari masing-masing provider.
