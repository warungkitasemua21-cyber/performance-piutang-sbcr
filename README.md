# Dashboard Performance Piutang PT. SBCR - GitHub + Netlify V2

Versi ini mengikuti **KPI Piutang terbaru dengan Exposure Adjustment** dan sudah dilengkapi:

- Logo PT. SBCR.
- KPI perusahaan, SPV, Gudang, dan Sales.
- Ranking Sales dan SPV dari score terbaik ke terburuk.
- Filter SPV, Salesman, dan Gudang.
- Aging & Histori dengan pencarian SPV, Gudang, Aging, customer/faktur, dan Histori Excel.
- Update histori manual yang disimpan online.
- Upload Excel terbaru dengan format `data ai bener(1).xlsx`.
- Download laporan Excel sesuai filter/hak akses.
- Login Admin, Company/Manager, SPV, dan Sales.
- Responsive untuk PC dan HP.

## KPI terbaru

1. Collection Rate: target >= 98%, bobot 30%.
2. Piutang Belum Lunas / Penjualan: target <= 20%, bobot 15%.
3. Overdue >30 Hari (Adjusted): target <= 40%, bobot 15%.
4. Overdue >120 Hari (Adjusted): target <= 30%, bobot 20%.
5. Invoice 1-14 Hari / Penjualan: target <= 4%, bobot 20%.

Achievement maksimum 120%.

### Exposure Adjustment

- Piutang <= Rp5 juta: weight 60%.
- Piutang > Rp5-20 juta: weight 75%.
- Piutang > Rp20-100 juta: weight 90%.
- Piutang > Rp100 juta: weight 100%.

Adjusted Ratio = (Raw Ratio x Exposure Weight) + (Rasio Perusahaan x (1 - Exposure Weight)).
Adjustment hanya diterapkan pada Overdue >30 dan >120.

## Struktur repository GitHub

Pastikan struktur persis seperti ini. File function **jangan diletakkan di root**.

```
app.js
build.mjs
index.html
netlify.toml
package.json
styles.css
assets/
  sbcr.jpg
netlify/
  functions/
    api.mjs
    health.mjs
    seed-data.mjs
```

## Deploy ke GitHub + Netlify

1. Buat repository GitHub baru, disarankan **Private**.
2. Upload **isi folder project ini**, bukan folder pembungkus ZIP.
3. Pastikan `netlify/functions/api.mjs` terlihat di GitHub pada folder yang benar.
4. Hubungkan repository ke Netlify.
5. Build settings sudah dibaca dari `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
6. Tambahkan Environment Variables di Netlify:
   - `ADMIN_USERNAME` = `admin`
   - `ADMIN_PASSWORD` = password Anda
   - `APP_SESSION_SECRET` = random secret minimal 32 karakter
7. Trigger **Clear cache and deploy site**.
8. Tes function:
   `https://NAMA-SITE.netlify.app/.netlify/functions/health`
9. Jika muncul JSON `ok: true`, buka dashboard dan login sebagai admin.

## Update Excel

Setelah login Admin/Company:

1. Buka `Update Data Excel`.
2. Upload file dengan struktur header yang sama seperti `data ai bener(1).xlsx`.
3. Klik `Proses & Jadikan Data Aktif`.
4. Sistem membaca file di browser, mendeteksi periode terbaru, menghitung agregat dan KPI, lalu menyimpan hasil ke Netlify Blobs.
5. Baris rekap/total tanpa `No. Faktur` otomatis diabaikan agar tidak double-count.

## Login tambahan

Admin dapat membuat akun pada tab `User & Login`:

- Company / Manager: seluruh data.
- SPV: hanya SPV terkait dan Sales di bawahnya.
- Sales: hanya performance Sales terkait.

## Catatan penting

- Jangan menaruh `ADMIN_PASSWORD` atau `APP_SESSION_SECRET` di GitHub.
- Histori manual disimpan terpisah dari data Excel, sehingga tetap ada setelah upload Excel baru selama `rowId` faktur tetap sama.
- Data awal project sudah di-seed dari file closing yang tersedia saat project dibuat.
