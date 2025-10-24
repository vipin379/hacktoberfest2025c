#!/bin/bash

# Menghasilkan angka acak antara 1 dan 100
angka_rahasia=$((RANDOM % 100 + 1))
tebakan=0

# Loop untuk meminta tebakan sampai benar
while [ $tebakan -ne $angka_rahasia ]
do
    read -p "Tebak angka antara 1 dan 100: " tebakan
    
    if [ $tebakan -lt $angka_rahasia ]; then
        echo "Tebakan terlalu rendah!"
    elif [ $tebakan -gt $angka_rahasia ]; then
        echo "Tebakan terlalu tinggi!"
    fi
done

echo "Selamat! Tebakan kamu benar."
