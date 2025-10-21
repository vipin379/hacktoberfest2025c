import math

def hitung_lingkaran(r):
    """Mengembalikan luas dan keliling lingkaran berdasarkan jari-jari."""
    luas = math.pi * r ** 2
    keliling = 2 * math.pi * r
    return luas, keliling

def main():
    try:
        r = float(input("Masukkan jari-jari lingkaran: "))
        if r < 0:
            raise ValueError("Jari-jari tidak boleh negatif.")
        luas, keliling = hitung_lingkaran(r)
        print(f"Luas lingkaran dengan jari-jari {r} adalah {luas:.2f}")
        print(f"Keliling lingkaran dengan jari-jari {r} adalah {keliling:.2f}")
    except ValueError as e:
        print(f"Input tidak valid: {e}")

if __name__ == "__main__":
    main()
