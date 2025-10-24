def tebak_angka
  angka_rahasia = rand(1..100)
  tebakan = nil

  while tebakan != angka_rahasia
    print "Tebak angka antara 1 dan 100: "
    tebakan = gets.to_i
    if tebakan < angka_rahasia
      puts "Tebakan terlalu rendah!"
    elsif tebakan > angka_rahasia
      puts "Tebakan terlalu tinggi!"
    end
  end

  puts "Selamat! Tebakan kamu benar."
end

tebak_angka
