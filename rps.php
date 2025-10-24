<?php
session_start();

if (!isset($_SESSION['wins'])) {
    $_SESSION['wins'] = 0;
    $_SESSION['losses'] = 0;
    $_SESSION['ties'] = 0;
}

$choices = ['rock' => '🪨', 'paper' => '📄', 'scissors' => '✂️'];
$message = "Pilih: Rock, Paper, atau Scissors.";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['reset'])) {
        $_SESSION['wins'] = $_SESSION['losses'] = $_SESSION['ties'] = 0;
        $message = "Skor direset.";
    } elseif (isset($_POST['pick'])) {
        $player = $_POST['pick'];
        $computer = array_rand($choices);

        if ($player === $computer) {
            $_SESSION['ties']++;
            $result = 'Tie';
            $message = "SERI: {$choices[$player]} vs {$choices[$computer]}";
        } else {
            $wins = [
                'rock' => 'scissors',
                'scissors' => 'paper',
                'paper' => 'rock'
            ];

            if ($wins[$player] === $computer) {
                $_SESSION['wins']++;
                $result = 'You win';
                $message = "MENANG: {$choices[$player]} mengalahkan {$choices[$computer]}";
            } else {
                $_SESSION['losses']++;
                $result = 'You lose';
                $message = "KALAH: {$choices[$computer]} mengalahkan {$choices[$player]}";
            }
        }
    }
}
?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Rock Paper Scissors (PHP)</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 16px; }
        .card { border: 1px solid #ddd; padding: 16px; border-radius: 6px; text-align: center; }
        .choices button { font-size: 24px; padding: 12px 18px; margin: 8px; }
        .score { margin-top: 12px; }
        .msg { margin: 12px 0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Rock Paper Scissors</h2>
        <p>Mini game sederhana. Pilih satu lalu lihat hasil melawan komputer.</p>

        <div class="msg"><?php echo htmlspecialchars($message); ?></div>

        <form method="post" action="">
            <div class="choices">
                <button type="submit" name="pick" value="rock">🪨 Rock</button>
                <button type="submit" name="pick" value="paper">📄 Paper</button>
                <button type="submit" name="pick" value="scissors">✂️ Scissors</button>
            </div>
            <div style="margin-top:12px;">
                <button type="submit" name="reset" value="1">Reset Skor</button>
            </div>
        </form>

        <div class="score">
            <p>Wins: <?php echo $_SESSION['wins']; ?> | Losses: <?php echo $_SESSION['losses']; ?> | Ties: <?php echo $_SESSION['ties']; ?></p>
        </div>
    </div>
</body>
</html>