#include <iostream>
#include <iomanip>

using namespace std;

// Fungsi untuk menentukan tahun kabisat
bool isKabisat(int tahun) {
    return ((tahun % 4 == 0 && tahun % 100 != 0) || (tahun % 400 == 0));
}

// Fungsi untuk mendapatkan jumlah hari dalam bulan tertentu
int getJumlahHari(int bulan, int tahun) {
    switch (bulan) {
        case 1:  return 31;
        case 2:  return isKabisat(tahun) ? 29 : 28;
        case 3:  return 31;
        case 4:  return 30;
        case 5:  return 31;
        case 6:  return 30;
        case 7:  return 31;
        case 8:  return 31;
        case 9:  return 30;
        case 10: return 31;
        case 11: return 30;
        case 12: return 31;
        default: return 0;
    }
}

// Fungsi untuk menentukan hari pertama pada bulan tertentu (0 = Minggu, 1 = Senin, dst)
int getHariPertama(int bulan, int tahun) {
    int y = tahun;
    int m = bulan;
    if(m < 3) {
        m += 12;
        y--;
    }
    int d = 1;
    int h = (d + ((13 * (m + 1)) / 5) + y + (y / 4) - (y / 100) + (y / 400)) % 7;
    // Konversi ke format: 0 = Minggu
    return (h + 6) % 7;
}

int main() {
    int bulan, tahun;
    cout << "Masukkan bulan (1-12): ";
    cin >> bulan;
    cout << "Masukkan tahun: ";
    cin >> tahun;

    cout << "\n   Kalender " << bulan << "/" << tahun << endl;
    cout << "Su Mo Tu We Th Fr Sa" << endl;

    int hariPertama = getHariPertama(bulan, tahun);
    int jumlahHari = getJumlahHari(bulan, tahun);

    // Print spasi untuk hari pertama
    for(int i = 0; i < hariPertama; i++)
        cout << "   ";

    // Print hari
    for(int i = 1; i <= jumlahHari; i++) {
        cout << setw(2) << i << " ";
        if((i + hariPertama) % 7 == 0)
            cout << endl;
    }

    cout << endl;
    return 0;
}
