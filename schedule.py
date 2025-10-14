from jadwal import jadwal_shalat

jws = jadwal_shalat.JadwalShalat()
prov = jws.data_provinsi()
id_prov = prov[9]['value']  # Misal DKI JAKARTA

kota = jws.data_kabupaten_kota(id_prov)
id_kota = kota[1]['value']  # Misal JAKARTA SELATAN

jadwal = jws.jadwal_shalat(id_prov, id_kota, 10, 2025) # contoh bulan Oktober tahun 2025

for tanggal, data in jadwal['data'].items():
    print(f"{tanggal} | Subuh: {data['subuh']} | Dzuhur: {data['dzuhur']} | Ashar: {data['ashar']} | Maghrib: {data['maghrib']} | Isya: {data['isya']}")
