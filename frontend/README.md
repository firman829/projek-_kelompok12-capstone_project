# Ramu — asisten tanaman obat

Frontend Expo chatbot tanaman obat dengan chat teks, kamera langsung dengan preview dan tombol jepret, serta unggah foto dari galeri. Semua jawaban saat ini memakai mock data lokal di `src/data/mock-plants.ts`; aplikasi belum terhubung ke backend dan hasil foto adalah simulasi, bukan pengenalan gambar.

## Menjalankan aplikasi

```bash
npm install
npm run web
```

Jalankan `npx expo start` untuk membuka proyek di perangkat atau emulator. Chat teks, kamera, dan galeri dapat dipakai di Expo Go.

```bash
npx expo run:android
# atau
npx expo run:ios
```

### Kamera di web

Browser hanya mengizinkan kamera pada alamat aman (`https://`) atau `localhost`. Jika aplikasi dibuka memakai alamat IP lokal dengan `http://`, berikan izin kamera lewat ikon gembok/pengaturan situs browser atau buka melalui HTTPS. Pastikan kamera tidak sedang dipakai aplikasi lain. Jika preview tetap gagal, layar kamera menampilkan penyebab dan pilihan untuk mencoba lagi atau memilih foto dari galeri.

## Pemeriksaan

```bash
npm run lint
npx tsc --noEmit
```

Contoh alur mock: kirim pertanyaan tentang jahe atau kunyit untuk melihat jawaban edukasi. Pilih foto dari galeri untuk menampilkannya sebagai lampiran sementara, tulis pertanyaan, lalu tekan kirim agar foto dan pertanyaan masuk bersama. Foto galeri tidak dikirim otomatis. Data demo belum menganalisis gambar; jika nama tanaman disebut dalam pertanyaan, jawaban memakai data mock tanaman. Kamu juga bisa membuka kamera dan mengambil foto langsung.
