import random

def tebak_angka():
    angka_rahasia = random.randint(1, 100)
    tebakan = None
    while tebakan != angka_rahasia:
        tebakan = int(input("Tebak angka antara 1 dan 100: "))
        if tebakan < angka_rahasia:
            print("Tebakan terlalu rendah!")
        elif tebakan > angka_rahasia:
            print("Tebakan terlalu tinggi!")
    print("Selamat! Tebakan kamu benar.")

tebak_angka()
