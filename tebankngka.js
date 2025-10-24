function tebakAngka() {
    let angkaRahasia = Math.floor(Math.random() * 100) + 1;
    let tebakan;
    do {
        tebakan = prompt("Tebak angka antara 1 dan 100:");
        if (tebakan < angkaRahasia) {
            alert("Tebakan terlalu rendah!");
        } else if (tebakan > angkaRahasia) {
            alert("Tebakan terlalu tinggi!");
        }
    } while (tebakan != angkaRahasia);
    alert("Selamat! Tebakan kamu benar.");
}

tebakAngka();
