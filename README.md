# Mega Safe Security Services Sdn Bhd — Guard Tour · VMS · Security Log Book (v5.0)

Aplikasi web (Google Apps Script + Google Sheets) untuk rondaan pengawal (QR checkpoint), daftar pelawat (VMS),
log book keselamatan, kehadiran, roster syif, aduan, ancaman/SOS dan log audit.
Pangkalan data ialah Google Sheet anda sendiri, jadi setiap rekod/ancaman ditulis terus ke Sheet secara automatik.

## Ciri utama

| Bidang | Perincian |
|---|---|
| Pengesahan | Tiada akses tetamu. Kata laluan disimpan sebagai hash SHA-256 bergaram (2000 pusingan). Kunci 15 minit selepas 5 percubaan gagal. Sesi 6 jam, dibatalkan bila kata laluan ditukar. |
| Kata laluan | **Hanya Admin** boleh menukar kata laluan pegawai dan admin (Tetapan & Kata Laluan). Pegawai tiada akses menukar. Minimum 8 aksara. |
| 2FA (TOTP) | Admin: wajib, didaftar semasa log masuk pertama. Pegawai: diaktifkan admin (kod QR dipaparkan sekali). Kod tidak boleh digunakan semula. |
| Log audit | Sheet `AuditLog`, rantaian hash SHA-256 (setiap rekod mengandungi hash rekod sebelumnya). Butang **Sahkan Integriti Rantaian** mengesan sebarang suntingan. Mencatat log masuk/keluar, perubahan tetapan, kata laluan, 2FA, kunci pas, ancaman, konfigurasi alarm, tambah/ubah/padam data. |
| Alarm rondaan | Admin menetapkan **selang rondaan** dan **tempoh bunyi alarm** bagi setiap premis (menu *Alarm Rondaan*). Alarm berbunyi + bergetar pada peranti pegawai, **tiada butang henti**: hanya berhenti selepas pegawai mengimbas checkpoint. Rondaan tertunggak dilog sebagai ancaman automatik dan emel dihantar. |
| Roster syif | Clock In dan imbasan hanya dibenarkan dalam waktu syif (toleransi 30 minit lebih awal). |
| Masa nyata | Apps Script tidak menyokong WebSocket. Sistem menggunakan *polling* ringan setiap 5 saat (admin) / 8 saat (pegawai) dengan penanda versi, jadi dashboard, ancaman dan siren dikemas kini hampir serta-merta. |
| Luar talian | Pegawai boleh daftar **Kunci Pas Luar Talian** (biometrik WebAuthn; jika peranti/pelayar tidak menyokong, PIN peranti). Tanpa data mudah alih, imbasan, SOS dan log disimpan dalam baris gilir pada peranti dan disegerakkan secara automatik selepas log masuk dalam talian. Alarm terus berfungsi luar talian. |
| Google Maps | Premis dan checkpoint dijana koordinat dari alamat (Google Maps Geocoder), laluan/arah dikira pelayan (Google Maps Directions), carian tempat berhampiran (Places API, perlukan key). Tanpa API key, peta asas Google dipaparkan. |
| Penyulitan | Semua trafik melalui HTTPS. Komunikasi pegawai-admin disulitkan **hujung-ke-hujung** (AES-256-GCM, kunci dari frasa kunci premis, diterbitkan dalam pelayar). Pelayan dan Sheet hanya menyimpan teks sulit. Gambar disimpan **privat** di Drive. |
| Ancaman | Butang SOS, laporan insiden, rondaan tertunggak dan webhook IoT menulis ke Sheet `Threats`, membunyikan siren admin, dan menghantar emel. |
| VMS & Log Book | Daftar pelawat (gambar, masa keluar), log book dengan kategori dan gambar bukti, eksport CSV. |

## Struktur fail

```
Code.gs           Backend Apps Script (semua logik, dibungkus dalam objek M)
Index.html        Antara muka (admin & pegawai)
Logo.html         Logo (data URI) dimuatkan oleh Index.html
appsscript.json   Manifest (zon masa, skop OAuth, akses web app)
MegaSafe_Template.xlsx   Templat Google Sheet (semua tab & pengepala)
scripts/check.js  Semakan sintaks tempatan
package.json, .clasp.json.example, .claspignore, .gitignore, .vscode/
```

## Persediaan awal (cara 1: Google Sheet + editor Apps Script)

1. Buka Google Drive, muat naik `MegaSafe_Template.xlsx`, buka dengan Google Sheets, lalu **Fail > Simpan sebagai Google Sheets**.
   (Atau cipta Sheet kosong, sistem akan mencipta semua tab sendiri.)
2. Dalam Sheet: **Sambungan (Extensions) > Apps Script**.
3. Padam kandungan lalu cipta fail: `Code.gs`, `Index.html`, `Logo.html` (guna **+ > HTML** untuk dua fail HTML) dan tampal kandungannya.
   Dalam **Project Settings** aktifkan *Show "appsscript.json" manifest file* dan tampal `appsscript.json`.
4. Pilih fungsi `menuSetup` > **Run**, beri kebenaran (Allow). Ini mencipta semua tab dan memigrasi data lama (PIN lama ditukar kepada hash; QR checkpoint lama ditandatangani semula, **cetak semula QR**).
5. Muat semula Sheet. Menu **Mega Safe** muncul. Pilih **2. Tetapkan kata laluan Admin** (min 10 aksara, huruf besar/kecil/nombor).
   Tiada kata laluan lalai wujud; admin tidak boleh log masuk sebelum langkah ini.
6. Pilih **3. Pasang pemantau rondaan** supaya rondaan tertunggak dikesan walaupun tiada admin dalam talian.
7. **Deploy > New deployment > Web app**: *Execute as* **Me**, *Who has access* **Anyone** (pegawai tidak perlu akaun Google; keselamatan dikawal oleh log masuk + 2FA sistem ini). Salin URL `/exec`.
   Setiap perubahan kod memerlukan **Deploy > Manage deployments > Edit > New version**.
8. Buka URL, log masuk `admin`, daftarkan 2FA (Google/Microsoft Authenticator).

### Cara 2: VS Code + clasp + GitHub

```bash
npm install
npx clasp login
npx clasp create --type sheets --title "Mega Safe Security System" --rootDir .   # atau salin .clasp.json.example
npm run check        # semak sintaks
npm run push         # hantar kod ke Apps Script
npm run deploy
git init && git add . && git commit -m "Mega Safe v5.0"
```

`.clasp.json` tidak dimasukkan ke Git (ada dalam `.gitignore`). Jangan commit kata laluan, API key atau rahsia webhook; semuanya disimpan dalam *Script Properties*, bukan dalam kod.

## Mula guna selepas deploy

1. **Manage Premises**: tambah premis dan alamat (koordinat Google Maps dijana automatik).
2. **Checkpoint & QR**: tambah checkpoint, tetapkan *Seq* (urutan), cetak QR (butang *Cetak semua QR*). QR mengandungi tandatangan HMAC, QR palsu ditolak.
3. **HR - Pegawai**: tambah pegawai dengan kata laluan awal (min 8 aksara). Pegawai log masuk menggunakan **No Staf**.
4. **Duty Roster**: tetapkan waktu syif dan hari bertugas.
5. **Alarm Rondaan**: tetapkan selang (minit), tempoh bunyi alarm (saat) dan waktu aktif bagi setiap premis.
6. **Tetapan**: masukkan emel amaran, (pilihan) Google Maps API key, aktifkan 2FA pegawai.

### Google Maps API key (pilihan)

Tanpa key, premis dipaparkan dengan peta asas Google. Untuk marker checkpoint/ancaman dan carian tempat: Google Cloud Console > aktifkan *Maps JavaScript API* dan *Places API (New)* > cipta key > **sekat key kepada API tersebut sahaja** > tampal di Tetapan. Geocoding dan arah laluan menggunakan perkhidmatan Maps terbina dalam Apps Script dan tidak memerlukan key.

### Webhook IoT (pilihan)

Tetapan > *Jana rahsia Webhook IoT*, kemudian:

```bash
curl -X POST "URL_WEBAPP/exec" -H "Content-Type: text/plain" \
  -d '{"secret":"RAHSIA","premise":"Nama Premis","type":"Pintu dibuka","severity":"High","detail":"Sensor pintu belakang"}'
```

### Pemulihan

- Lupa kod 2FA admin / hilang telefon: menu Sheet **4. Reset 2FA Admin** (pemilik skrip sahaja).
- Lupa kata laluan admin: menu **2. Tetapkan kata laluan Admin**.
- Pegawai hilang telefon: Tetapan > tukar kata laluan / nyahaktif 2FA; tandakan pegawai *Inactive*.

## Had yang perlu diketahui (jujur)

- **Bukan WebSocket sebenar**: Apps Script tidak boleh menjadi pelayan WebSocket. Polling 5 saat digunakan; siren admin boleh lewat sehingga ~5 saat. Untuk WebSocket sebenar perlukan pelayan sendiri (cth. Firebase/Cloud Run).
- **Penyulitan hujung-ke-hujung** hanya meliputi modul Komunikasi. Rekod lain (pelawat, log book, rondaan) dilindungi HTTPS, kawalan akses dan Google Workspace, tetapi pemilik Sheet boleh membacanya. Rahsia TOTP pegawai disimpan dalam Sheet `Guards` (jangan kongsi Sheet ini).
- **Kunci Pas Luar Talian** ialah kunci pembuka peranti (biometrik/PIN) untuk mod luar talian sahaja; log masuk dalam talian tetap menggunakan kata laluan (+ 2FA). Dalam persekitaran Apps Script sesetengah pelayar menyekat WebAuthn; sistem akan jatuh balik kepada PIN peranti. Imbasan luar talian disahkan oleh pelayan semasa penyegerakan (tandatangan QR, waktu syif; had masa 24 jam).
- **IP pengguna** tidak boleh dibaca oleh Apps Script; log audit merekod maklumat peranti (user-agent ringkas).
- **Payroll** (gaji) tidak termasuk; skrin demo HR/Payroll dalam tangkapan skrin ialah data contoh. HR di sini meliputi pegawai, roster, aduan dan kehadiran.
- Had kuota Google: pembacaan Sheet bagi puluhan pegawai serentak adalah mencukupi; untuk ratusan pegawai pertimbangkan pangkalan data berasingan.
- Fail `Code.gs` memerlukan akaun Google pemilik yang sama untuk Sheet, Drive dan emel amaran (MailApp: ~100 emel/hari akaun percuma).

## Keselamatan: senarai semak sebelum guna

- [ ] Kata laluan admin kuat + 2FA aktif
- [ ] Hanya pemilik skrip mempunyai akses edit kepada Sheet dan Apps Script
- [ ] Trigger pemantau dipasang
- [ ] Emel amaran ditetapkan
- [ ] QR lama dicetak semula (selepas naik taraf)
- [ ] Jalankan **Sahkan Integriti Rantaian** pada Log Audit secara berkala

---
Dibina untuk Mega Safe Security Services Sdn Bhd.
