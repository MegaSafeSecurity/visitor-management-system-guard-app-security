# Mega Safe Security Services Sdn Bhd — Guard Tour · VMS · Security Log Book (v5.0)

Sistem pengawal keselamatan: rondaan QR checkpoint dengan alarm, daftar pelawat (VMS), log book bergambar, kehadiran,
roster syif, aduan, SOS/ancaman, log audit, 2FA dan Google Maps. Pangkalan data ialah **Google Sheet** anda sendiri.

```
GitHub Pages (index.html + css + js)  ──fetch HTTPS──▶  Google Apps Script (Code.gs)  ──▶  Google Sheet + Drive + Gmail
   antara muka (admin & pegawai)                         logik, keselamatan, audit             pangkalan data & log masa nyata
```

## Struktur fail

```
index.html            Antara muka (GitHub Pages)
css/style.css         Reka bentuk
js/app.js             Logik antara muka
js/config.js          URL Web App Apps Script  <-- WAJIB diisi
manifest.json         PWA (pasang di telefon)
sw.js                 Service worker (aplikasi boleh dibuka luar talian)
img/                  Logo & ikon Mega Safe
apps-script/Code.gs          Backend Google Apps Script
apps-script/Index.html       Versi satu-fail antara muka (dijana oleh `npm run build`)
apps-script/appsscript.json  Manifest Apps Script
MegaSafe_Template.xlsx       Templat Google Sheet (semua tab)
scripts/  tests/             Build, semakan sintaks, ujian automatik
```

## A. Persediaan Google Sheet + Apps Script (buat SEKALI, sebelum GitHub)

> Punca "tidak dapat log masuk" sebelum ini: kod Apps Script lama tidak menerima permintaan dari GitHub Pages dan
> kata laluan admin belum ditetapkan. Ikut langkah 1 hingga 7 dengan tertib.

1. Buka Google Drive, muat naik `MegaSafe_Template.xlsx`, buka dengan Google Sheets, lalu **Fail > Simpan sebagai Google Sheets**.
   (Boleh juga guna Sheet sedia ada, data lama dimigrasi automatik pada langkah 3.)
2. Dalam Sheet: **Sambungan (Extensions) > Apps Script**.
3. **Ganti semua kod lama**: padam isi `Code.gs`, tampal `apps-script/Code.gs`. Cipta fail HTML bernama `Index` (**+ > HTML**) dan tampal `apps-script/Index.html`.
   Dalam **Project Settings** aktifkan *Show "appsscript.json" manifest file*, tampal `apps-script/appsscript.json`.
   Padam fail lama yang tidak digunakan lagi (cth. `Logo.html`).
4. Pilih fungsi **`menuSetup`** > **Run** > beri kebenaran (Allow). Ia mencipta semua tab, menukar PIN lama kepada hash dan menandatangani semula QR lama (**cetak semula QR**).
5. **Tetapkan kata laluan admin** (tiada kata laluan lalai). Pilih satu:
   - Muat semula Sheet, menu **Mega Safe > 2. Tetapkan kata laluan Admin**; atau
   - Dalam `Code.gs` cari `adminSetupInEditor`, tukar `PASSWORD` kepada kata laluan baharu (min 10 aksara, huruf besar+kecil+nombor), **Run**, kemudian **kembalikan** teks `PASSWORD` seperti asal.
6. **Pasang pemantau rondaan**: menu **Mega Safe > 3. Pasang pemantau rondaan** (supaya rondaan terlepas dikesan walaupun tiada admin dalam talian).
7. **Deploy > New deployment > Web app**: *Execute as* **Me**, *Who has access* **Anyone**. Salin URL yang berakhir `/exec`.
   Selepas **setiap** perubahan `Code.gs`: **Deploy > Manage deployments > ✎ Edit > Version: New version > Deploy** (URL kekal sama).

Ujian pantas: buka `URL/exec?ping=1`, mesti keluar `OK`.

## B. Letak di GitHub Pages

1. Buka `js/config.js`, pastikan `MEGASAFE_API` ialah URL `/exec` anda.
2. Cipta repositori GitHub, muat naik **semua fail** (kecuali `node_modules`).
   - Dengan VS Code: `git init`, `git add .`, `git commit -m "Mega Safe v5.0"`, `git remote add origin …`, `git push -u origin main`.
3. GitHub: **Settings > Pages > Source: Deploy from a branch > main / (root)**.
4. Buka `https://<akaun>.github.io/<repo>/`. Skrin log masuk memaparkan logo dan "Pelayan sedia" (hijau) jika sambungan ke Apps Script berjaya.
   Jika merah, semak URL dalam `js/config.js` dan pastikan deployment *Anyone* + versi terkini.
5. Log masuk `admin` + kata laluan langkah A5. Pada log masuk pertama sistem **memaksa pendaftaran 2FA** (Google/Microsoft Authenticator).

Pilihan: boleh juga buka terus URL `/exec` Apps Script (antara muka sama, tanpa GitHub).

## C. Mula guna

1. **Manage Premises & QR**: tambah premis + alamat (koordinat Google Maps dijana automatik), tambah checkpoint (isi *Urutan*), cetak QR.
2. **HR Master**: tambah pegawai (No Staf = ID log masuk, kata laluan awal min 8 aksara). Apabila HR menukar nama/premis, semua modul mengikut.
3. **Duty Roster & Report**: tetapkan syif. Pegawai hanya boleh Clock In/imbas dalam waktu syif (toleransi 30 minit).
4. **Duty Roster > Alarm Rondaan**: **hanya admin** menetapkan selang rondaan (minit) dan **berapa lama alarm berbunyi** (saat).
5. **Tetapan & Kata Laluan**: emel amaran ancaman, Google Maps API key (pilihan), aktifkan 2FA pegawai.

## Ciri keselamatan

| Bidang | Perincian |
|---|---|
| Pengesahan | Tiada akses tetamu, tiada pintasan "ujian cepat". Kata laluan di-hash (SHA-256 bergaram, 2000 pusingan). Akaun dikunci 15 minit selepas 5 percubaan gagal. Sesi 6 jam, dibatalkan serta-merta bila kata laluan/2FA/status berubah. |
| Kata laluan | **Hanya Admin** boleh menukar kata laluan pegawai dan admin. Pegawai tiada skrin atau fungsi untuk menukar (disekat di pelayan, bukan sekadar disembunyikan). |
| 2FA (TOTP) | Admin wajib. Pegawai diaktifkan oleh admin (kod QR dipaparkan sekali). Kod sekali guna. |
| Log audit | Tab `AuditLog`, rantaian hash SHA-256. Butang **Sahkan Integriti Rantaian** mengesan sebarang suntingan manual. Merekod log masuk/keluar, gagal/kunci, kata laluan, 2FA, tetapan, alarm, ancaman, tambah/ubah/padam. Eksport CSV/JSON. |
| Alarm rondaan | Berbunyi + bergetar pada peranti pegawai pada masa rondaan. **Tiada butang henti**: hanya berhenti selepas pegawai mengimbas checkpoint. Rondaan terlepas direkod sebagai ancaman + emel. |
| QR | Setiap QR bertandatangan HMAC; QR palsu atau diubah ditolak. |
| Penyulitan | Semua trafik HTTPS. Komunikasi E2EE (AES-256-GCM) antara pegawai & admin: pelayan/Sheet hanya menyimpan teks sulit. Gambar disimpan privat di Drive. |
| Ancaman | SOS, insiden, rondaan terlepas dan Webhook IoT menulis ke tab `Threats` serta menghantar emel secara automatik. |

## Pegawai tanpa data mudah alih (Kunci Pas Luar Talian)

Guard Mobile Terminal > **Kunci Pas Luar Talian** > Daftar (semasa dalam talian). Selepas itu, tanpa internet pegawai boleh tekan
**Masuk Luar Talian** pada skrin log masuk (biometrik/PIN peranti). Imbasan QR, SOS dan log disimpan pada peranti dan
**dihantar automatik** apabila dalam talian. Alarm rondaan terus berbunyi luar talian. Pelayan menyemak tandatangan QR, waktu syif
dan had 24 jam semasa penyegerakan. Pasang ke skrin utama telefon (Add to Home Screen) supaya aplikasi dibuka tanpa internet.

## Google Maps

- **Tanpa API key**: koordinat dari alamat, laluan berjalan/memandu dan peta asas Google berfungsi (menggunakan perkhidmatan Maps dalam Apps Script).
- **Dengan API key** (Tetapan): peta penuh dengan penanda checkpoint/ancaman/lokasi imbasan dan carian tempat (Places) & Bantuan Kecemasan terdekat.
  Cloud Console: aktifkan *Maps JavaScript API* + *Places API (New)*, aktifkan Billing, **sekat key** kepada API itu dan domain `https://<akaun>.github.io/*`.
  Mesej "This page can't load Google Maps correctly" bermaksud Billing/sekatan domain key belum betul.

## Webhook IoT (pilihan)

Tetapan > *Jana rahsia Webhook IoT*, kemudian:
```bash
curl -X POST "URL_WEBAPP/exec" -H "Content-Type: text/plain" \
  -d '{"secret":"RAHSIA","premise":"Nama Premis","type":"Pintu dibuka","severity":"High","detail":"Sensor pintu belakang"}'
```

## Pemulihan

- Lupa kata laluan admin: menu Sheet **Mega Safe > 2. Tetapkan kata laluan Admin** (pemilik skrip sahaja).
- Hilang telefon/kod 2FA admin: menu **4. Reset 2FA Admin**.
- Pegawai hilang telefon: Tetapan > tukar kata laluan / nyahaktif 2FA, atau tandakan *Inactive* di HR Master.

## Pembangunan (VS Code)

```bash
npm install
npm run check      # bina apps-script/Index.html + semak sintaks
npm test           # + 86 ujian backend + 43 ujian pelayar (Chromium, perlu: npx playwright install chromium)
npm run push       # clasp push ke Apps Script (salin .clasp.json.example ke .clasp.json, isi scriptId)
```
Selepas ubah `index.html`, `css/` atau `js/app.js` jalankan `npm run build` supaya `apps-script/Index.html` dikemas kini.

## Had yang perlu diketahui (jujur)

- **Bukan WebSocket sebenar**: Apps Script tidak boleh menjadi pelayan WebSocket. Dashboard dan siren dikemas kini melalui *polling* setiap 5 saat (admin) / 8 saat (pegawai), jadi ada kelewatan sehingga ~5 saat. WebSocket sebenar memerlukan pelayan sendiri (cth. Firebase atau Cloud Run).
- **E2EE** hanya meliputi modul Komunikasi. Rekod lain dilindungi HTTPS + kawalan akses, tetapi pemilik Google Sheet boleh membacanya (jangan kongsi Sheet). Rahsia TOTP pegawai disimpan dalam tab `Guards`.
- **Payroll** tidak dibina (skrin "HR & Payroll" dalam gambar ialah data contoh). HR Master meliputi pegawai, roster, 2FA, kehadiran dan aduan.
- **IP pengguna** tidak boleh dibaca oleh Apps Script; log audit merekod maklumat peranti (user-agent ringkas).
- Kunci Pas: sesetengah pelayar menyekat WebAuthn dalam iframe; sistem jatuh balik kepada PIN peranti.
- Kuota Google: emel amaran ~100/hari (akaun percuma); polling ramai pegawai serentak sesuai untuk puluhan pegawai, bukan ratusan.
- Pustaka pengimbas QR dimuat dari CDN (jsDelivr/cdnjs) dan di-cache oleh service worker selepas pembukaan pertama dalam talian.
