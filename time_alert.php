<?php
// time_alert.php
// Halaman sederhana untuk mengatur alarm waktu. Menggunakan waktu server untuk akurasi.
session_start();

$serverTime = time(); // epoch
$serverOffset = date('Z'); // offset in seconds

// Default values
$targetTs = null;
$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $time = $_POST['time'] ?? '';
    $msg = trim($_POST['message'] ?? '');

    // Expect input as HH:MM (24-hour)
    if (preg_match('/^(\d{1,2}):(\d{2})$/', $time, $m)) {
        $h = intval($m[1]);
        $min = intval($m[2]);
        $now = new DateTime('now', new DateTimeZone(date_default_timezone_get()));
        $target = clone $now;
        $target->setTime($h, $min, 0);
        if ($target->getTimestamp() <= $now->getTimestamp()) {
            // if time already passed today, set for tomorrow
            $target->modify('+1 day');
        }
        $_SESSION['alarm'] = [
            'ts' => $target->getTimestamp(),
            'message' => $msg
        ];
    } else {
        $_SESSION['error'] = 'Format waktu harus HH:MM (24-jam).';
    }
    header('Location: ' . $_SERVER['PHP_SELF']);
    exit;
}

$alarm = $_SESSION['alarm'] ?? null;
$error = $_SESSION['error'] ?? null;
unset($_SESSION['error']);
// Handle clear via GET or POST quick calls
if (isset($_GET['do_clear']) || isset($_GET['clear'])) {
    unset($_SESSION['alarm']);
    if (isset($_GET['do_clear'])) {
        // called via fetch POST
        http_response_code(204);
        exit;
    } else {
        // regular clear via fetch then reload
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit;
    }
}

?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Time Alert</title>
    <style>
        body { font-family: Arial, sans-serif; max-width:700px; margin:40px auto; padding:0 16px; }
        .card { border:1px solid #ddd; padding:16px; border-radius:6px; }
        input, button { padding:8px; font-size:14px; }
        .small { color:#666; font-size:13px }
    </style>
</head>
<body>
    <div class="card">
        <h2>Time Alert</h2>
        <p>Atur alarm berdasarkan waktu server. Halaman ini akan menampilkan alert dan mencoba menampilkan Notification (jika diizinkan).</p>

        <?php if ($error): ?>
            <div style="color:red;margin-bottom:8px"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>

        <form method="post" action="">
            <label>Waktu (HH:MM 24-jam):</label>
            <input type="text" name="time" placeholder="14:30" required pattern="\d{1,2}:\d{2}">
            <br><br>
            <label>Pesan (opsional):</label>
            <input type="text" name="message" placeholder="Meeting in 5 minutes">
            <br><br>
            <button type="submit">Set Alarm</button>
            <button type="button" id="clearBtn">Clear Alarm</button>
        </form>

        <hr>
        <div>
            <p class="small">Waktu server saat ini: <span id="serverTime"></span></p>
            <p class="small">Waktu klien saat ini: <span id="clientTime"></span></p>
        </div>

        <div id="alarmInfo">
            <?php if ($alarm): ?>
                <p>Alarm diset untuk: <strong><?php echo date('Y-m-d H:i:s', $alarm['ts']); ?></strong></p>
                <p>Pesan: <em><?php echo htmlspecialchars($alarm['message']); ?></em></p>
            <?php else: ?>
                <p>Tidak ada alarm diset.</p>
            <?php endif; ?>
        </div>

    </div>

    <script>
        // Ambil waktu server dari variabel PHP
        const serverTs = <?php echo $serverTime * 1000; ?>; // ms
        const serverOffset = <?php echo $serverOffset * 1000; ?>; // ms
        const alarm = <?php echo json_encode($alarm); ?>;

        function pad(n){ return n<10? '0'+n: n }
        function fmt(d){ return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }

        // Calculate difference between client clock and server clock
        const clientNow = Date.now();
        const serverNow = serverTs;
        const clockDiff = serverNow - clientNow; // ms to add to client to match server

        function updateClocks(){
            const c = new Date(Date.now());
            const s = new Date(Date.now() + clockDiff);
            document.getElementById('clientTime').textContent = fmt(c);
            document.getElementById('serverTime').textContent = fmt(s);
        }
        setInterval(updateClocks, 1000);
        updateClocks();

        // Alarm checking
        if (alarm && alarm.ts) {
            const alarmTs = alarm.ts * 1000; // to ms
            const message = alarm.message || 'Alarm!';

            function checkAlarm(){
                const nowAdjusted = Date.now() + clockDiff;
                if (nowAdjusted >= alarmTs) {
                    triggerAlarm(message);
                    clearInterval(alarmInterval);
                }
            }
            const alarmInterval = setInterval(checkAlarm, 1000);
            checkAlarm();
        }

        function triggerAlarm(msg){
            alert(msg);
            // Notification API
            if ("Notification" in window) {
                if (Notification.permission === 'granted') {
                    new Notification(msg);
                } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission().then(function(permission){
                        if (permission === 'granted') {
                            new Notification(msg);
                        }
                    });
                }
            }
            // play beep
            const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAAAB3AQACABAAZGF0YQAAAAA=');
            audio.play().catch(()=>{});

            // clear server-side alarm
            fetch(location.pathname + '?clear=1').then(()=>{}).catch(()=>{});
        }

        // Clear alarm button: call server to clear
        document.getElementById('clearBtn').addEventListener('click', function(){
            fetch(location.pathname + '?clear=1').then(()=> location.reload());
        });

        // If server clear requested, handle via quick request
        if (location.search.indexOf('clear=1') !== -1) {
            // send POST to clear
            fetch(location.pathname + '?do_clear=1', { method: 'POST' }).then(()=> location.reload());
        }
    </script>
</body>
</html>