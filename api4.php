<?php
header('Content-Type: application/json');
$data = [
    "status" => "success",
    "message" => "Data fetched successfully",
    "numbers" => [1, 2, 3, 4, 5]
];
echo json_encode($data);
?>
