<?php
// scheduler.php
session_start();

if (!isset($_SESSION['schedules'])) {
    $_SESSION['schedules'] = [];
}

// Add schedule
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['add'])) {
        $dt = trim($_POST['datetime'] ?? '');
        $msg = trim($_POST['message'] ?? '');
        // Expect ISO datetime-local format: YYYY-MM-DDTHH:MM
        if ($dt && $msg) {
            $ts = strtotime($dt);
            if ($ts !== false) {
                $_SESSION['schedules'][] = ['ts' => $ts, 'message' => $msg, 'id' => uniqid()];
            } else {
                $_SESSION['error'] = 'Format datetime tidak valid.';
            }
        } else {
            $_SESSION['error'] = 'Datetime dan message wajib diisi.';
        }
        header('Location: ' . $_SERVER['PHP_SELF']); exit;
    } elseif (isset($_POST['delete'])) {
        $id = $_POST['id'] ?? '';
        $_SESSION['schedules'] = array_values(array_filter($_SESSION['schedules'], function($s) use ($id){ return $s['id'] !== $id; }));
        header('Location: ' . $_SERVER['PHP_SELF']); exit;
    }
}

$error = $_SESSION['error'] ?? null; unset($_SESSION['error']);
$schedules = $_SESSION['schedules'];
$serverTime = time();
?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Simple Scheduler</title>
    <style>
        body { font-family: Arial, sans-serif; max-width:900px; margin:40px auto; padding:0 16px; }
        .card { border:1px solid #ddd; padding:16px; border-radius:6px; }
        table { width:100%; border-collapse:collapse; }
        th,td { border:1px solid #eee; padding:8px; text-align:left; }
        .small { color:#666; font-size:13px }
        button { padding:6px 10px }
    </style>
</head>
<body>
    <div class="card">
        <h2>Simple Scheduler</h2>
        <p>Tambahkan beberapa jadwal (datetime + pesan). Halaman akan memeriksa jadwal dan memicu alert/Notification saat waktunya tiba.</p>

        <?php if ($error): ?>
            <div style="color:red;margin-bottom:8px"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>

        <form method="post" action="">
            <label>Datetime:</label>
            <input type="datetime-local" name="datetime" required>
            <label>Message:</label>
            <input type="text" name="message" required placeholder="Meeting">
            <button type="submit" name="add">Add</button>
        </form>

        <hr>
        <p class="small">Waktu server: <span id="serverTime"></span> | Waktu klien: <span id="clientTime"></span></p>

        <h3>Schedules</h3>
        <table>
            <thead><tr><th>Datetime</th><th>Message</th><th>Actions</th></tr></thead>
            <tbody>
                <?php foreach ($schedules as $s): ?>
                    <tr>
                        <td><?php echo date('Y-m-d H:i:s', $s['ts']); ?></td>
                        <td><?php echo htmlspecialchars($s['message']); ?></td>
                        <td>
                            <form method="post" action="" style="display:inline">
                                <input type="hidden" name="id" value="<?php echo $s['id']; ?>">
                                <button type="submit" name="delete">Delete</button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>

    </div>

    <script>
        const serverTs = <?php echo $serverTime * 1000; ?>;
        const clockDiff = serverTs - Date.now();

        function pad(n){ return n<10? '0'+n : n }
        function fmt(d){ return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }

        function updateClocks(){
            document.getElementById('clientTime').textContent = fmt(new Date());
            document.getElementById('serverTime').textContent = fmt(new Date(Date.now() + clockDiff));
        }
        setInterval(updateClocks, 1000);
        updateClocks();

        // Build schedules list from server-rendered table for checking
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        const schedules = rows.map(r => {
            const dtText = r.cells[0].textContent.trim();
            const msg = r.cells[1].textContent.trim();
            const ts = Date.parse(dtText.replace(' ', 'T'));
            return { ts, msg };
        });

        function checkSchedules(){
            const nowAdj = Date.now() + clockDiff;
            schedules.forEach((s, idx) => {
                if (s && s.ts && nowAdj >= s.ts) {
                    alert('Schedule: ' + s.msg + ' (now)');
                    if ("Notification" in window && Notification.permission === 'granted') {
                        new Notification(s.msg);
                    } else if ("Notification" in window && Notification.permission !== 'denied') {
                        Notification.requestPermission().then(p => { if (p === 'granted') new Notification(s.msg); });
                    }
                    // mark as triggered to avoid repeat
                    schedules[idx] = null;
                }
            });
        }

        setInterval(checkSchedules, 1000);
        checkSchedules();
    </script>
</body>
</html>