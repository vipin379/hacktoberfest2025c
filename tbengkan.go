package main

import (
	"fmt"
	"math/rand"
	"time"
)

func main() {
	rand.Seed(time.Now().UnixNano())
	angkaRahasia := rand.Intn(100) + 1
	var tebakan int

	for tebakan != angkaRahasia {
		fmt.Print("Tebak angka antara 1 dan 100: ")
		fmt.Scan(&tebakan)
		if tebakan < angkaRahasia {
			fmt.Println("Tebakan terlalu rendah!")
		} else if tebakan > angkaRahasia {
			fmt.Println("Tebakan terlalu tinggi!")
		}
	}

	fmt.Println("Selamat! Tebakan kamu benar.")
}
