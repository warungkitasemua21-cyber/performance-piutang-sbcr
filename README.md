# Dashboard Performance Piutang - Netlify Direct Function FIX

Versi ini memperbaiki error **HTTP 404 saat login** dengan tidak lagi memakai routing `/api/*` atau custom function path.
Frontend memanggil endpoint bawaan Netlify secara langsung:

- Health: `/.netlify/functions/health`
- API: `/.netlify/functions/api?route=/login`

## Struktur repository wajib

```text
index.html
app.js
styles.css
build.mjs
package.json
netlify.toml
netlify/
  functions/
    api.mjs
    health.mjs
    seed-data.mjs
```

Semua file di atas harus berada langsung di root repository GitHub. Jangan upload folder pembungkus tambahan.

## Environment Variables Netlify

Tambahkan:

- `ADMIN_USERNAME` = misalnya `admin`
- `ADMIN_PASSWORD` = password admin
- `APP_SESSION_SECRET` = minimal 24 karakter, disarankan 32+ karakter acak

Setelah mengubah environment variable, trigger deploy ulang.

## Build settings

- Base directory: kosong
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

`netlify.toml` dalam repository sudah mengatur build dan functions directory.

## Tes sesudah deploy

Buka:

```text
https://NAMA-SITE.netlify.app/.netlify/functions/health
```

Jika function aktif, akan muncul JSON dengan `"ok": true`.

Lalu buka dashboard dan login. Frontend akan langsung memanggil:

```text
/.netlify/functions/api?route=/login
```

Tidak ada rewrite `/api/*`, sehingga tidak ada konflik dengan routing static site.
