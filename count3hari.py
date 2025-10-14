import time

# Total detik untuk 3 hari
total_seconds = 3 * 24 * 60 * 60

while total_seconds:
    days = total_seconds // (24 * 3600)
    hours = (total_seconds % (24 * 3600)) // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    print(f"Sisa: {days:02d} hari {hours:02d}:{minutes:02d}:{seconds:02d}", end='\r')
    time.sleep(1)
    total_seconds -= 1

print("\nCountdown selesai!")
