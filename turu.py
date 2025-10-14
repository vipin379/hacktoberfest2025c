import time
from datetime import datetime

def tunggu_sampai_jam_9():
    while True:
        sekarang = datetime.now()
        if sekarang.hour == 21 and sekarang.minute == 0:
            print("Waktunya tidur!")
            break
        # Tunggu selama 30 detik sebelum cek kembali waktu
        time.sleep(30)

if __name__ == "__main__":
    print("Program pengingat tidur dimulai. Menunggu jam 9 malam...")
    tunggu_sampai_jam_9()
