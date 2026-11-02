# Perbaikan skor pimpinan — 3 November 2026

Penyebab: model lama membagi pencapaian omzet dengan 95% dan rata-rata KPI dengan 90.
Model baru mengikuti rumus sheet Skor Pimpinan pada Excel 31 Oktober 2026:
- SPV/ASM = rasio omzet × bobot omzet × 100 + rata-rata skor Sales × bobot KPI.
- Perusahaan = rasio omzet × bobot omzet × 100 + rata-rata setara skor ASM × bobot KPI.
- Bobot dibaca dari Aturan KPI (file ini 70% dan 30%). Tidak ada pembatas tambahan pada skor pimpinan.
- Batas KPI Sales dan ambang/pengali insentif tetap mengikuti aturan workbook.
- Data tersimpan dihitung ulang saat dimuat, sehingga tidak bergantung pada skor lama di Supabase.

## Pemasangan pada GitHub / Netlify
1. Ekstrak ZIP ini. Ganti file di root repository GitHub yang terhubung ke kpisalessbcr.netlify.app. Jangan unggah ZIP sebagai satu file saja.
2. Commit perubahan. Biarkan Netlify menjalankan build npm run build dengan publish directory dist.
3. Pertahankan environment variables Supabase yang sudah dipakai di Netlify. Tidak perlu menjalankan ulang schema SQL.
4. Setelah deploy berhasil, muat ulang dashboard (Ctrl+Shift+R).
5. Jika dataset aktif belum memakai Excel 31 Oktober ini, unggah workbook tersebut melalui menu Unggah Data bersama file Laporan Harian Manager yang sesuai, kemudian publikasikan data.

File inti yang berubah: src/model.js, src/app.js. Dokumentasi, tes regresi, dan skrip verifikasi turut diperbarui.
ZIP berisi source untuk GitHub, bukan paket drag-and-drop Netlify. Tidak menyertakan Excel atau kredensial.
Situs aktif belum dideploy dalam pengerjaan ini.

## Validasi
5 tes lulus; build Vite berhasil. Semua 39 skor cocok dengan nilai tersimpan Excel pada toleransi 0,00000001 poin.
Untuk mengulang: node scripts/verify-performance.mjs /path/performance.xlsx

| Level | Nama | Excel | Dashboard |
| --- | --- | ---: | ---: |
| SPV | David Permana | 58.56 | 58.56 |
| SPV | Ricky M Budiman | 71.27 | 71.27 |
| SPV | Koswara Saputra | 68.14 | 68.14 |
| SPV | Moch Nurrizki | 85.38 | 85.38 |
| SPV | Aryanto | 85.03 | 85.03 |
| SPV | Tohaedin | 85.69 | 85.69 |
| SPV | Aceng Komarudin | 84.62 | 84.62 |
| SPV | Teriyadi | 62.70 | 62.70 |
| ASM | Teriyadi | 81.61 | 81.61 |
| ASM | Aceng Komarudin | 77.49 | 77.49 |
| Perusahaan | PT SBCR | 84.20 | 84.20 |
