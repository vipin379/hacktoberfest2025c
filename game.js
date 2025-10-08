// Simple Number Guessing Game (Node.js)
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const target = Math.floor(Math.random() * 100) + 1;
let attempts = 0;

console.log("Guess the number between 1 and 100!");

function ask() {
  rl.question("Your guess: ", (answer) => {
    const guess = Number(answer);
    attempts++;
    if (isNaN(guess) || guess < 1 || guess > 100) {
      console.log("Please enter a valid number between 1 and 100.");
      ask();
    } else if (guess < target) {
      console.log("Too low!");
      ask();
    } else if (guess > target) {
      console.log("Too high!");
      ask();
    } else {
      console.log(`Correct! You guessed it in ${attempts} attempts.`);
      rl.close();
    }
  });
}

ask();
