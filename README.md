# Mega Safe Security Services Sdn Bhd - Guard Tour, VMS & Security Log Book

Sistem pemantauan rondaan pengawal, daftar pelawat (VMS) dan buku log keselamatan.
Pelayan: **Google Apps Script**. Pangkalan data: **Google Sheets**. Tiada pelayan lain diperlukan.

## Ciri
- Log masuk pegawai (No Staf + PIN) dan admin (kata laluan + **2FA TOTP**)
- Rondaan melalui QR checkpoint, gambar bukti, GPS, laporan rondaan
- **Alarm rondaan** ditetapkan admin per premis (selang + tempoh bunyi); pegawai hanya boleh berhentikan dengan mengimbas
- Kehadiran (Clock In/Out), Daftar Pelawat (VMS) dengan gambar, Security Log Book, Aduan
- **Papan analisis ancaman** langsung (kemas kini 5 saat), **Log Audit** setiap perubahan, **Log Ancaman**
- Sheet berasingan "Mega Safe - Realtime Security Log" menerima setiap ancaman secara automatik
- **Ejen Peta Google**: geokod, laluan/arah (Maps Service), carian tempat (Places API)
- HR kemas kini nama pegawai di menu HR; semua modul lain mengikut secara automatik

## Struktur
```
src/Code.gs          pelayan (Apps Script)
src/Index.html       antara muka
src/Logo.html        logo (data URI)
src/appsscript.json  manifest + skop
scripts/build-single.js   hasilkan dist/Code.single.gs (SATU fail untuk ditampal)
tests/               ujian pelayan (node tests/server.test.js)
dist/Code.single.gs  fail siap tampal
```

## Keselamatan: apa yang ada
| Kawalan | Pelaksanaan |
|---|---|
| Tiada akses tetamu | Semua fungsi (kecuali ping/login) menuntut token sesi; token rawak 256-bit di server |
| Tiada kata laluan lalai | Admin dicipta daripada `INIT_ADMIN_PASSWORD` (min 12 aksara) yang dipadam selepas guna |
| Penyimpanan kata laluan/PIN | HMAC-SHA256 berulang (300x) + salt + pepper rahsia; PIN pegawai tidak pernah disimpan |
| Pegawai tidak boleh tukar kata laluan | Tiada fungsi sedemikian untuk pegawai; hanya Admin (Tetapan / HR) |
| Kunci akaun | 5 percubaan salah = dikunci 15 minit; direkod sebagai ancaman High |
| 2FA | TOTP RFC 6238, anti-replay; wajib untuk admin, pilihan per pegawai |
| Sesi | Admin tamat selepas 30 min tidak aktif; logout memadam sesi di server |
| Audit | Setiap tambah/ubah/padam, set PIN, tukar kata laluan, 2FA direkod (tanpa PIN/kata laluan) |
| Suntikan formula | Nilai bebas dineutralkan dalam log |

### Had yang jujur (tidak dibina kerana mustahil dengan Apps Script)
- **WebSocket sebenar**: Apps Script tidak boleh menjadi pelayan WebSocket. "Masa nyata" dilaksanakan melalui *polling* setiap 5 saat.
- **Penyulitan hujung-ke-hujung (E2E)**: pelayan mesti membaca data untuk menyimpannya ke Sheets, jadi E2E sebenar tidak mungkin. Pengangkutan disulitkan oleh HTTPS Google; kredensial di-hash.
- **Passkey (WebAuthn)**: tidak boleh disahkan di Apps Script. Gantinya: **TOTP** yang berfungsi **tanpa data mudah alih** (kod dijana di telefon).
- Pelayar tidak boleh memaksa bunyi alarm jika skrin dikunci atau telefon disenyapkan.
- Halaman log masuk boleh dicapai dari internet (`ANYONE_ANONYMOUS` diperlukan supaya pegawai tanpa akaun Google boleh log masuk); tiada data tanpa kelayakan sah.

## Pemasangan

### Cara A: tampal satu fail (paling mudah)
1. Cipta Google Sheet baharu > **Extensions > Apps Script**.
2. Padam kandungan `Code.gs`, tampal seluruh `dist/Code.single.gs`. Jangan cipta fail HTML.
3. **Project Settings > Script properties > Add**: `INIT_ADMIN_PASSWORD` = kata laluan admin (min 12 aksara).
4. Pilih fungsi `setup` > **Run** > beri kebenaran. Ia mencipta semua tab, Sheet log masa nyata dan pemantau automatik (5 minit).
5. **Deploy > New deployment > Web app**: *Execute as: Me*, *Who has access: Anyone*. Salin URL `/exec`.
6. Buka URL, log masuk `admin` + kata laluan. Daftar aplikasi pengesah (Google/Microsoft Authenticator, Authy) dengan QR atau kunci yang dipaparkan.

### Cara B: VS Code + clasp
```bash
npm install
npx clasp login
cp .clasp.json.example .clasp.json      # isi scriptId projek Apps Script
npm run push                            # tolak src/ ke Apps Script
npm test                                # ujian pelayan
npm run build                           # jana dist/Code.single.gs
```
Aktifkan Apps Script API di https://script.google.com/home/usersettings. Selepas `push`, lakukan langkah 3 hingga 6 di atas.

### Setiap kali kod dikemas kini
**Deploy > Manage deployments > pensel > Version: New version > Deploy.** Menyimpan sahaja tidak mengemas kini URL web app.

## Tetapan awal
1. **Premis**: tambah premis; tetapkan *Selang ronda (minit)* dan *Tempoh bunyi alarm (saat)*.
2. **Checkpoint & QR**: tambah checkpoint per premis, cetak QR (butang QR / Cetak semua QR) dan tampal di lokasi.
3. **HR - Pegawai**: tambah pegawai, pilih premis dan shift, tetapkan **PIN 6-12 digit** (kosongkan semasa edit jika tidak mahu tukar). Pilih *Wajib 2FA* jika perlu; pegawai mendaftar peranti pada log masuk pertama. *Reset 2FA* jika telefon hilang.
4. **Google Maps**: Carian tempat memerlukan kunci **Places API (New)** (Google Cloud Console, aktifkan Places API (New), sekat kunci) simpan sebagai `MAPS_KEY` di Script properties. Geokod dan laluan berfungsi tanpa kunci (tertakluk kuota harian Apps Script).
5. **Tetapan**: tukar kata laluan admin (perlukan kod 2FA); pautan ke Sheet utama dan Sheet log masa nyata.

## Jenis ancaman
`LOGIN_FAIL` (Low) | `BAD_2FA`, `BAD_PW_CHANGE`, `QR_INVALID`, `QR_WRONG_PREMISE`, `PATROL_MISSED` (Medium) | `ACCOUNT_LOCK`, `UNAUTHORIZED` (High).
Tahap papan pemuka: **High** jika ada ancaman High dalam 1 jam atau skor 24 jam >= 15; **Medium** jika skor >= 5.

## Penyelesaian masalah
| Masalah | Penyelesaian |
|---|---|
| "Admin belum disediakan" | Tetapkan `INIT_ADMIN_PASSWORD`, jalankan `setup()` |
| Lupa kata laluan/2FA admin | Editor: jalankan `resetAdminPassword()`, tetapkan `INIT_ADMIN_PASSWORD`, jalankan `setup()` |
| Telefon admin hilang (kata laluan masih ada) | Editor: jalankan `resetAdmin2FA()` |
| Akaun dikunci | Tunggu 15 minit |
| Skrin putih / versi lama | Deploy **New version**; buka URL `/exec` dalam Incognito |
| "No HTML file named Index" | Gunakan `dist/Code.single.gs` (tanpa fail HTML) |

## Sandaran
Sheet utama ialah pangkalan data: guna *File > Version history* dan salin berkala. Gambar disimpan dalam folder Drive `MegaSafe_Photos`.

## Belum dibina
HR & Payroll (gaji), butang panic, notifikasi Telegram, penjana Duty Roster, peta rondaan langsung.

(c) Mega Safe Security Services Sdn Bhd. Hak cipta terpelihara.
