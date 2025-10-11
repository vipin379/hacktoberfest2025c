# Kalkulator Sederhana Python
def kalkulator():
    print("Kalkulator Sederhana")
    angka1 = float(input("Masukkan angka pertama: "))
    operator = input("Pilih operator (+, -, *, /): ")
    angka2 = float(input("Masukkan angka kedua: "))

    if operator == "+":
        hasil = angka1 + angka2
    elif operator == "-":
        hasil = angka1 - angka2
    elif operator == "*":
        hasil = angka1 * angka2
    elif operator == "/":
        if angka2 != 0:
            hasil = angka1 / angka2
        else:
            hasil = "Error: Pembagian dengan nol!"
    else:
        hasil = "Operator salah!"

    print("Hasil:", hasil)

kalkulator()
