<?php


// Default values
$defaultMin = 1;
$defaultMax = 100;
$defaultCount = 5;

// Get CLI arguments or prompt user
$options = getopt("", ["min:", "max:", "count:"]);

$min = isset($options['min']) ? (int)$options['min'] : $defaultMin;
$max = isset($options['max']) ? (int)$options['max'] : $defaultMax;
$count = isset($options['count']) ? (int)$options['count'] : $defaultCount;

// Input validation
if ($min >= $max) {
    fwrite(STDERR, "Error: Min must be less than Max.\n");
    exit(1);
}
if ($count < 1 || $count > 1000) {
    fwrite(STDERR, "Error: Count must be between 1 and 1000.\n");
    exit(1);
}

// Generate random numbers
$numbers = [];
for ($i = 0; $i < $count; $i++) {
    $numbers[] = rand($min, $max);
}

// Output in JSON format
echo json_encode([
    'min' => $min,
    'max' => $max,
    'count' => $count,
    'numbers' => $numbers
], JSON_PRETTY_PRINT);
