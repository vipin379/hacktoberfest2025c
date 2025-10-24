# Simple Scheduler (PHP)

Halaman scheduler sederhana untuk menambahkan beberapa jadwal (datetime + pesan) dan memicu notifikasi ketika waktunya tiba.

Cara menjalankan:

1. Buka PowerShell di folder `e:\hacktoberfest2025`
2. Jalankan server PHP built-in:

```powershell
php -S localhost:8000
```

3. Buka http://localhost:8000/scheduler.php di browser.

Fitur:
- Tambah jadwal menggunakan input `datetime-local`.
- Hapus jadwal.
- Waktu server dan klien ditampilkan untuk akurasi.
- Notifikasi via Notification API jika diizinkan, plus fallback alert().

Catatan:
- Jadwal disimpan di session browser (tidak persist ke DB/file).
- Untuk penyimpanan persisten, saya bisa tambahkan penyimpanan ke file JSON atau SQLite.
