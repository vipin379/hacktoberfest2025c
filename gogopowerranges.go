package main

import (
	"fmt"
	"math/rand"
	"time"
)

func main() {
	rand.Seed(time.Now().UnixNano())
	randomNumber := rand.Intn(100) + 1 // 1 to 100
	fmt.Printf("Random number: %d\n", randomNumber)
}
