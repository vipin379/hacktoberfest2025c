#include <iostream>
#include <fstream>
#include <string>
using namespace std;

int main() {
    string data;
    ofstream fileOut("data.txt"); // Membuka file untuk ditulis
    cout << "Masukkan teks untuk disimpan ke file: ";
    getline(cin, data);
    fileOut << data << endl; // Menulis ke file
    fileOut.close();

    string line;
    ifstream fileIn("data.txt"); // Membuka file untuk dibaca
    cout << "Isi file data.txt:" << endl;
    while (getline(fileIn, line)) {
        cout << line << endl; // Menampilkan isi file
    }
    fileIn.close();
    return 0;
}
