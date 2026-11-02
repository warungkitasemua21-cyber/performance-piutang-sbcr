# SBCR Performance Hub

Proyek dashboard untuk **GitHub → Netlify**, menggunakan **Supabase Auth, PostgreSQL, dan Storage** sebagai penyimpanan bersama. Ini bukan dashboard yang hanya menyimpan data di browser.

## Mulai dari sini

1. Ekstrak ZIP. Upload **isi folder proyek** ke repository GitHub privat, termasuk `package.json`, `package-lock.json`, `netlify.toml`, `src`, `netlify`, dan `supabase`.
2. Buat satu project Supabase. Jalankan seluruh isi `supabase/schema.sql` di SQL Editor **satu kali** pada project baru.
3. Di Supabase Authentication, **matikan pendaftaran pengguna publik**. Buat pengguna admin pertama melalui Authentication → Users → Add user. Gunakan email dan password Anda sendiri.
4. Setelah user pertama dibuat, jalankan SQL berikut, mengganti alamat email dengan email yang persis sama:

   ```sql
   update public.profiles set role = 'admin'
   where email = 'email-admin-anda@perusahaan.com';
   ```

5. Di Netlify pilih **Add new project / Import an existing project**, hubungkan repository GitHub tersebut. Build command: `npm run build`. Publish directory: `dist`. Functions directory sudah diatur dalam `netlify.toml`.
6. Isi environment variables berikut di **Netlify Project configuration → Environment variables**. Gunakan URL dan API keys dari project Supabase Anda.

   | Variable | Nilai | Scope |
   |---|---|---|
   | `VITE_SUPABASE_URL` | URL project, contoh `https://PROJECT.supabase.co` | Builds |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key `sb_publishable_...` | Builds |
   | `SUPABASE_URL` | URL project yang sama | Functions |
   | `SUPABASE_SECRET_KEY` | Secret key `sb_secret_...` | Functions saja |

   **Secret key tidak boleh memakai awalan `VITE_`, masuk source GitHub, atau disampaikan ke pengguna.** Browser hanya memakai publishable key dan sesi login pengguna. Pada project lama, anon key dapat dipakai sebagai publishable key dan service-role key sebagai secret key, tetapi utamakan keys baru.
7. Jalankan deploy Netlify. Jika Anda menambahkan environment variables setelah deploy pertama, lakukan deploy ulang satu kali. Di Supabase Authentication → URL Configuration, isi Site URL dengan URL Netlify final.
8. Masuk ke URL Netlify memakai akun admin. Menu **Akun Pengguna** digunakan untuk membuat akun lain, mengganti peran admin/pengguna, menonaktifkan akun, dan mereset password. Admin memberikan password awal secara pribadi; aplikasi tidak mengirim email otomatis. Pengguna dapat mengganti password dengan klik nama akunnya di kanan atas.
9. Buka **Unggah Data**, pilih kedua Excel, klik **Periksa dua file**, tinjau data, tanggal, dan selisih nama, lalu **Publikasikan ke semua pengguna**.

### Apakah harus deploy ulang setiap hari?

**Tidak.** Deploy GitHub/Netlify diperlukan untuk pemasangan awal atau perubahan kode. Untuk data harian, cukup login sebagai admin ke website yang sudah terpasang, unggah dua Excel, dan publikasikan. Pengguna lain tidak mengunggah file. Halaman terbuka memeriksa versi setiap **30 detik** dan saat tab kembali aktif. Klik **Perbarui** untuk mengambil perubahan segera.

Jika hanya satu file berubah, tetap pilih file terbaru untuk sumber tersebut dan file terakhir yang valid untuk sumber lainnya. Keduanya dipublikasikan sebagai satu snapshot agar overview dan detail memiliki versi yang jelas. Tanggal internal sumber tidak dipaksakan sama.

**Jangan memakai Netlify Drop untuk hanya mengunggah folder `dist`.** Modul akun membutuhkan Netlify Functions dan environment variables. Gunakan koneksi GitHub sesuai langkah di atas.

## Fitur

- Overview PT SBCR, per depo, dan setiap Sales; target, realisasi, pencapaian dan skor KPI.
- Depo: penjualan, OA, EC, SKU, NOO, Collection; urutan skor KPI atau pencapaian masing-masing indikator.
- Peringkat terpisah Sales, SPV, ASM berdasarkan skor KPI atau realisasi / target penjualan. Nilai sama mendapat peringkat sama.
- Detail pelanggan NOO, OA, SKU, EC dan Collection. Filter teks/angka/tanggal dapat digabungkan pada **semua header Excel**. Kolom berulang diberi akhiran `(2)` agar tidak saling menimpa. Tampilan dipaginasi 50 baris.
- Halaman rekonsiliasi memperlihatkan perbandingan overview dengan jumlah kolom `Cek` detail. Selisih tidak diganti secara otomatis.
- Insentif hanya status **Tercapai / Tidak tercapai / Data belum lengkap**, poin pengali, basis, dan faktor. **Tidak menampilkan atau memasukkan insentif dasar dan nominal pembayaran ke dataset pengguna.**
- Akun admin/pengguna dengan pemeriksaan izin di server dan kebijakan RLS database/storage.
- Unggah versi baru bersifat atomik. Versi aktif hanya berubah setelah semua bagian data tersimpan. Konflik dua admin yang memublikasikan bersamaan ditolak agar tidak saling menimpa.
- Demo menggunakan nama dan angka fiktif. Demo tidak menunjukkan pelanggan atau data asli.

## Dua sumber Excel

### Dashboard performance

Sheet `Input Sales` berisi roster dan nilai enam KPI. Kolom dikenali berdasarkan nama header, bukan urutan baris. Sheet `Aturan KPI` memakai posisi kontrol dari template yang disediakan:

| Kontrol | Lokasi |
|---|---|
| SPV: bobot/target omzet dan KPI tim | C6:D7 |
| ASM: bobot/target omzet dan KPI tim | C8:D9 |
| Perusahaan: bobot/target omzet dan rata-rata ASM | C10:D11 |
| Batas pencapaian per KPI | D12 |
| Tanggal akhir overview | D13 |
| Ambang insentif penjualan/KPI | I24:I25 |
| Batas poin pengali insentif | I29 |

Skor **dihitung ulang di JavaScript** berdasarkan input dan aturan tersebut. Browser tidak mengandalkan cache hasil formula pada sheet skor. Bila suatu **input** adalah formula Excel, Excel harus menghitung dan menyimpannya terlebih dahulu karena parser tidak menjalankan formula sumber. Nama Sales harus unik dan depo/SPV/ASM harus terisi. Nama baru otomatis ikut roster tanpa batas 29 baris.

### Laporan harian manager

| KPI | Sheet |
|---|---|
| NOO | `NOO` |
| OA | `Check OA` |
| SKU | `Check SKU` |
| EC | `Check EC` |
| Collection | `Collectionpiutang` |

Header dicari pada 40 baris pertama. Baris detail dibaca berdasarkan adanya `id` atau `No. Faktur`. Tanggal Excel dipertahankan sebagai tanggal kalender tanpa pergeseran zona waktu. Detail ditampilkan sebagai bukti sumber; **baris transaksi tidak otomatis disamakan dengan jumlah pelanggan unik atau nilai KPI**.

## Definisi perhitungan

- Sales: jumlah `MIN(realisasi / target, batas KPI) × bobot × 100`. KPI berbobot positif dengan target kosong/nol atau realisasi kosong membuat skor final tidak tersedia. Nol realisasi yang benar tetap valid. Bobot harus berjumlah 100%.
- SPV/ASM: 70% × pencapaian omzet tim × 100 + 30% × rata-rata skor Sales langsung, mengikuti nilai editable workbook. ASM memakai Sales langsung, bukan rata-rata skor SPV.
- PT SBCR: 70% × pencapaian penjualan perusahaan × 100 + 30% × **rata-rata setara skor ASM**. Skor pimpinan tidak dibagi ambang 95%/90 dan tidak dibatasi ulang; batas per KPI Sales tetap mengikuti workbook.
- Depo: skor KPI adalah rata-rata setara skor Sales; penjualan/OA/EC/SKU/NOO menjumlahkan target dan realisasi per Sales. Angka ini adalah agregat catatan Sales; pelanggan yang dimiliki beberapa Sales tidak dideduplikasi lintas Sales.
- Collection depo: **rata-rata rasio Collection Sales**, bukan total pembayaran / total beban piutang. File performance tidak menyediakan denominator nominal yang diperlukan untuk rasio gabungan itu. Detail historis faktur ditampilkan terpisah.
- Filter depo pada peringkat SPV/ASM hanya memilih pimpinan yang memiliki Sales di depo tersebut. Skor pimpinan tetap mencerminkan seluruh anggota timnya.
- Poin insentif: hanya penjualan `>95%` → poin penjualan, faktor 50%; hanya KPI `>90` → total poin KPI, faktor 50%; keduanya → total poin KPI, faktor 100%. Poin pengali maksimum 120%. Tepat 95% dan 90 tidak melampaui ambang. Tidak ada perhitungan uang pada data publik aplikasi.
- Batas pengali insentif 120% **tidak mengubah** batas pencapaian KPI di D12. Jika kebijakan skor KPI juga berubah, ubah D12 pada workbook.

## Temuan pada file awal

Pengujian dua file terlampir menghasilkan 29 Sales, 9 SPV, 3 ASM dan 7 depo. Skor perusahaan 54,6102038357 dan omzet Rp13.449.185.663. Skor Sales hasil JavaScript sesuai cache skor final workbook.

Detail: NOO 96 baris, OA 1.788, SKU 11.839, EC 3.446, Collection 89.397. Overview bertanggal 26 Oktober 2026, sebagian detail sampai 27 Oktober, dan closing Collection 21 Oktober. Data Collection mencakup faktur historis mulai Januari 2025.

NOO/OA sesuai jumlah `Cek` untuk roster Sales. SKU memiliki selisih pada seluruh 29 Sales dan EC pada 1 Sales; definisi `Cek` belum tentu identik dengan definisi SKU overview. Ada nama Sales dan SPV historis berbeda. Aplikasi memperlihatkan temuan ini, mempertahankan nilai overview, dan tidak melakukan pencocokan nama secara perkiraan.

## Akses dan penyimpanan

- Pengguna aktif dapat membaca seluruh ringkasan dan detail KPI bersama. **Belum ada pembatasan per Sales/depo** karena permintaan menggunakan dashboard bersama. Jika akses harus dibatasi per wilayah, tambahkan kebijakan scoped access di backend, bukan sekadar filter UI.
- File asli disimpan pada bucket privat `sbcr-raw`, hanya admin. Ini dapat berisi data insentif asli; file tersebut tidak bisa diakses role pengguna. Dataset terolah berada di bucket privat `sbcr-data` dengan izin baca untuk akun aktif.
- Admin tidak dapat menonaktifkan atau mengubah perannya sendiri melalui modul akun. Database mencegah penonaktifan admin aktif terakhir.
- Nonaktifkan pengguna melalui modul akun untuk mencabut akses data baru; halaman terbuka mendeteksi status pada polling berikutnya. Informasi yang sudah dibaca sebelumnya tidak dapat ditarik kembali dari perangkat pengguna.
- File dan versi lama tetap tersimpan untuk audit; biaya/kuota mengikuti paket Supabase dan Netlify. Penghapusan versi lama dilakukan pemilik project di dashboard storage setelah memastikan versi tersebut tidak aktif. Upload gagal dapat menyisakan objek yang belum pernah diaktifkan; bersihkan melalui admin penyimpanan bila diperlukan.
- Batas 50 MB per file ditetapkan pada aplikasi/bucket. Jika mengubah limit, sesuaikan keduanya. File besar diproses di Web Worker; gunakan browser desktop untuk upload data harian besar.

## Menjalankan dan menguji

```bash
npm ci
cp .env.example .env
# Isi dua VITE_ variables untuk frontend, jangan commit .env.
npm test
npm run dev
npm run build
```

Modul akun server memerlukan Netlify Functions. Untuk pengujian lokal fungsi, gunakan Netlify CLI (`netlify dev`) pada lingkungan Anda, atau deploy Netlify dengan environment functions yang benar. `vite` sendiri hanya menjalankan frontend.

Untuk validasi dua Excel lokal:

```bash
npm run verify:excel -- "/path/performance.xlsx" "/path/manager.xlsx"
```

Tes otomatis mencakup aturan insentif, batas 120%, ranking seri, data kosong vs nol, filter, dan rekonsiliasi parser terhadap Excel. Paket sudah melalui build produksi. **Login, Storage RLS, publikasi antar-akun dan Netlify Functions belum diuji pada project Supabase/Netlify Anda** karena URL/key/project belum diberikan. Sebelum dipakai operasional, lakukan uji penerimaan berikut:

1. Login admin, buat akun viewer, login viewer di browser kedua.
2. Pastikan viewer tidak memiliki menu upload/akun dan panggilan endpoint akun menghasilkan 403.
3. Publikasikan dua Excel; pastikan browser kedua mengambil versi baru dalam 30 detik.
4. Coba filter pelanggan Collection, header ganda, dan tanggal; cek terhadap baris Excel.
5. Pastikan pengguna tidak dapat membuka bucket `sbcr-raw` dan JSON overview tidak berisi `insentif_dasar`/`insentif_rp`.
6. Nonaktifkan viewer; pastikan data baru ditolak dan sesi frontend keluar setelah polling.

## Struktur repository

```text
src/                     UI, model KPI, parser, worker, koneksi Supabase
netlify/functions/       API pengelolaan user (server only)
supabase/schema.sql      Database, storage buckets, RLS, publikasi atomik
tests/                   Tes model dan filter
scripts/verify-excel.mjs  Validasi terhadap dua workbook
netlify.toml             Konfigurasi build, functions, headers
```

Excel asli dan data pelanggan tidak disertakan dalam repository/ZIP. Unggah melalui modul admin setelah setup.

## Referensi resmi

- https://docs.netlify.com/build/functions/get-started/
- https://docs.netlify.com/build/functions/environment-variables/
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
