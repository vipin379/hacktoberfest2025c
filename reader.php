<?php
$file = 'sample.txt';
if (file_exists($file)) {
    $contents = file_get_contents($file);
    echo nl2br($contents);
} else {
    echo "File not found.";
}
?>
