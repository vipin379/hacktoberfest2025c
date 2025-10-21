<?php
<?php
session_start();

// Inisialisasi game
if (!isset($_SESSION['target']) || isset($_POST['reset'])) {
    $_SESSION['target'] = rand(1, 100);
    $_SESSION['attempts'] = 0;
    $_SESSION['message'] = "Tebak angka antara 1 sampai 100.";
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['guess'])) {
    $guess = intval($_POST['guess']);
    $_SESSION['attempts']++;

    if ($guess < 1 || $guess > 100) {
        $_SESSION['message'] = "Masukkan angka antara 1 dan 100.";
    } elseif ($guess < $_SESSION['target']) {
        $_SESSION['message'] = "Terlalu kecil!";
    } elseif ($guess > $_SESSION['target']) {
        $_SESSION['message'] = "Terlalu besar!";
    } else {
        $_SESSION['message'] = "Benar! Angka: {$_SESSION['target']}. Kamu butuh {$_SESSION['attempts']} percobaan.";
        // Setelah menang, sediakan opsi mulai ulang
    }
}
?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Tebak Angka (PHP)</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; }
        .card { border: 1px solid #ddd; padding: 16px; border-radius: 6px; }
        input[type="number"] { width: 100%; padding: 8px; margin: 8px 0; box-sizing: border-box; }
        button { padding: 8px 12px; }
        .msg { margin: 12px 0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Tebak Angka</h2>
        <p>Permainan: tebak angka antara 1 dan 100.</p>

        <div class="msg"><?php echo htmlspecialchars($_SESSION['message']); ?></div>
        <form method="post" action="">
            <label for="guess">Masukkan tebakan:</label>
            <input type="number" id="guess" name="guess" min="1" max="100" required autofocus>
            <div style="margin-top:8px;">
                <button type="submit">Tebak</button>
                <button type="submit" name="reset" value="1">Mulai Ulang</button>
            </div>
        </form>

        <p style="margin-top:12px;color:#555;">Percobaan: <?php echo $_SESSION['attempts']; ?></p>
    </div>
</body>
</html>