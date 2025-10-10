#!/bin/bash

# Random number between 1 and 100
random_number=$(( ( RANDOM % 100 ) + 1 ))
echo "Random number: $random_number"
