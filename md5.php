<?php
// md5.php - Simple MD5 hash generator
// Usage:
// - Open in browser and use form to generate MD5
// - Or call: md5.php?text=hello to get raw hash

$input = '';
$hash = '';
if (isset($_GET['text'])) {
    $input = (string) $_GET['text'];
    $hash = md5($input);
    // If request wants raw output
    if (isset($_GET['raw'])) {
        header('Content-Type: text/plain; charset=utf-8');
        echo $hash;
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['text'])) {
    $input = (string) $_POST['text'];
    $hash = md5($input);
}
?>
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MD5 Generator</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;color:#111;padding:24px}
    .card{max-width:720px;margin:24px auto;background:#fff;padding:20px;border-radius:8px;box-shadow:0 6px 20px rgba(16,24,40,0.06)}
    input[type=text]{width:100%;padding:10px;font-size:16px;margin:8px 0;border:1px solid #ddd;border-radius:6px}
    button{padding:10px 14px;border-radius:6px;border:none;background:#2563eb;color:#fff}
    .output{margin-top:12px;padding:10px;background:#f8fafc;border-radius:6px;border:1px dashed #e6eefc;word-break:break-all}
  </style>
</head>
<body>
  <div class="card">
    <h2>MD5 Hash Generator</h2>
    <form method="post" action="">
      <label for="text">Text to hash</label>
      <input id="text" name="text" type="text" value="<?php echo htmlspecialchars($input); ?>" placeholder="Type text here">
      <div>
        <button type="submit">Generate MD5</button>
      </div>
    </form>

    <?php if ($hash): ?>
      <div class="output">
        <strong>MD5:</strong>
        <div style="margin-top:8px;font-family:monospace;background:#fff;padding:8px;border-radius:4px"><?php echo htmlspecialchars($hash); ?></div>
        <p style="margin-top:8px"><a href="?text=<?php echo urlencode($input); ?>&raw=1">Open raw</a></p>
      </div>
    <?php endif; ?>

    <hr>
    <p class="small">Tip: MD5 bukan untuk penyimpanan password. Gunakan hashing modern seperti password_hash() untuk password.</p>
  </div>
</body>
</html>