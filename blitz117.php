<?php
$fruits = ['apple', 'banana', 'cherry', 'date', 'fig', 'grape'];
shuffle($fruits);
echo 'Randomized fruits order: ' . implode(', ', $fruits);
?>
