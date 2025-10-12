<?php
// Ambil waktu sekarang
$now = time();
// Tambahkan 1 menit (60 detik)
$end_time = $now + 60;

// Hitung mundur
$diff = $end_time - $now;

// Format hasil hitung mundur
$minutes = floor($diff / 60);
$seconds = $diff % 60;

// Tampilkan hitungan mundur
echo "Hitung mundur: {$minutes} menit {$seconds} detik.";
?>
