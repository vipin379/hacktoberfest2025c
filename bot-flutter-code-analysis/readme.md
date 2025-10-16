# dart-search-bot

CLI Node.js untuk mengindeks dan mencari **class**, **method**, dan **top-level function** di proyek Dart/Flutter.

- 📁 Hanya memindai file `*.dart` di dalam folder **`lib/`**
- 🧭 Menemukan class & method, beserta `start_line`, `end_line`, dan `code_snippet`
- 💬 Bisa **REPL interaktif** atau **sekali jalan** via flag CLI
- 📤 Ekspor ke **JSON** atau **CSV**
- ⚡️ Tanpa `npm install`

---

## Daftar Isi

- [Prasyarat](#prasyarat)
- [Mulai Cepat](#mulai-cepat)
- [Penggunaan CLI](#penggunaan-cli)
- [Contoh](#contoh)
- [Format Output](#format-output)
  - [Konsol](#konsol)
  - [CSV](#csv)
  - [JSON](#json)
- [Cara Kerja](#cara-kerja)
- [Keterbatasan](#keterbatasan)

---

## Prasyarat

- **Node.js** v18+ (disarankan v22)
- Proyek Dart/Flutter dengan folder `lib/`

---

## Mulai Cepat

```bash
# Jalankan dari root proyek (yang berisi folder lib/)
node dart-search-bot.js /path/ke/proyek
```

Mode ini membuka REPL interaktif. Ketik perintah seperti:

```
class SplashScreen
method build
exit
```

---

## Penggunaan CLI

```
node dart-search-bot.js <rootDirProyek> [opsi]
```

**Opsi**

| Opsi                   | Deskripsi                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `--list all`           | Menampilkan **classes + methods + functions** (default).                             |
| `--list classes`       | Hanya **classes**.                                                                   |
| `--list methods`       | Hanya **methods** (di dalam class).                                                  |
| `--list functions`     | Hanya **top-level functions**.                                                       |
| `--find class <Nama>`  | Cari class berdasarkan nama (tidak peka huruf besar/kecil).                          |
| `--find method <Nama>` | Cari method atau top-level function berdasarkan nama (tidak peka huruf besar/kecil). |
| `--json <file.json>`   | Ekspor indeks lengkap ke JSON.                                                       |
| `--csv <file.csv>`     | Ekspor hasil saat ini (dari `--list`/`--find`) ke CSV.                               |

> ℹ️ Tool ini **hanya** memindai folder `lib/` di bawah `<rootDirProyek>` dan mengabaikan direktori umum seperti `node_modules`, `build`, `.git`, dsb.

---

## Contoh

Tampilkan semua dan ekspor ke CSV:

```bash
node dart-search-bot.js /path/ke/proyek --list all --csv hasil.csv
```

Hanya daftar class:

```bash
node dart-search-bot.js /path/ke/proyek --list classes
```

Cari class tertentu:

```bash
node dart-search-bot.js /path/ke/proyek --find class SplashScreen
```

Cari method (atau top‑level function) tertentu:

```bash
node dart-search-bot.js /path/ke/proyek --find method build
```

Ekspor indeks lengkap ke JSON:

```bash
node dart-search-bot.js /path/ke/proyek --json index.json
```

---

## Format Output

### Konsol

Setiap kecocokan dicetak seperti ini:

```
================================================================================
FILE      : /abs/path/lib/controller/anggota_controller.dart
CLASS     : AnggotaController
LINE      : 6 - 118
--------------------------------------------------------------------------------
class AnggotaController implements AnggotaRepositories {
  // ... cuplikan kode ...
}
```

### CSV

Menggunakan `--csv <file.csv>`, tool menulis berkas CSV dengan kolom:

```
file_path, class_name, method_name, function_name, start_line, end_line, code_snippet
```

### JSON

Menggunakan `--json <file.json>`, tool menulis indeks seperti:

```json
{
  "indexed_at": "2025-10-06T10:00:00.000Z",
  "root": "/abs/path/to/project/lib",
  "files": [
    {
      "file_path": "/abs/path/lib/controller/anggota_controller.dart",
      "classes": [
        {
          "type": "class",
          "name": "AnggotaController",
          "file_path": "...",
          "start_line": 6,
          "end_line": 118,
          "code_snippet": "class AnggotaController implements ... }",
          "methods": [
            {
              "type": "method",
              "class_name": "AnggotaController",
              "name": "addAnggota",
              "start_line": 20,
              "end_line": 55,
              "code_snippet": "Future<void> addAnggota(...) { ... }"
            }
          ]
        }
      ],
      "functions": [
        {
          "type": "function",
          "name": "main",
          "file_path": "...",
          "start_line": 3,
          "end_line": 9,
          "code_snippet": "void main() { ... }"
        }
      ]
    }
  ]
}
```

---

## Cara Kerja

- **Discovery**: Rekursif memindai `lib/` untuk file `*.dart` (mengabaikan `.git`, `build`, dsb).
- **Parsing**: Menggunakan regex + pencocokan kurung untuk mengenali:
  - `class Bar { ... }`
  - method di dalam class
  - top‑level function (termasuk arrow function `=>`)
- **Posisi**: Menghitung `start_line` & `end_line` memakai indeks awal baris dan posisi kurung kurawal yang cocok.
- **Cuplikan**: Mengambil `code_snippet` berdasarkan rentang baris tersebut.

---
