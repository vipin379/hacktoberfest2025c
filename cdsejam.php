<?php
// Ambil waktu sekarang
$now = time();
// Tambahkan 1 jam (3600 detik)
$end_time = $now + 3600;

// Hitung mundur
$diff = $end_time - $now;

// Format hasil hitung mundur
$hours = floor($diff / 3600);
$minutes = floor(($diff % 3600) / 60);
$seconds = $diff % 60;

// Tampilkan hitungan mundur
echo "Hitung mundur: {$hours} jam {$minutes} menit {$seconds} detik.";
?>
