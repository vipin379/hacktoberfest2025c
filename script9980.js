#!/usr/bin/env node
// Simple CLI utility: random number, random string, timestamp
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function generateRandomNumber(min = 1, max = 100) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomString(length = 12) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < length; i++)
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function showMenu() {
  console.log("\nSelect an option:");
  console.log("1) Generate random number");
  console.log("2) Generate random string");
  console.log("3) Show current timestamp");
  console.log("q) Quit");
}

function prompt() {
  showMenu();
  rl.question("Choice: ", (choice) => {
    if (choice === "1") {
      rl.question("Min (default 1): ", (minRaw) => {
        rl.question("Max (default 100): ", (maxRaw) => {
          const min = Number(minRaw) || 1;
          const max = Number(maxRaw) || 100;
          console.log("Random number:", generateRandomNumber(min, max));
          prompt();
        });
      });
    } else if (choice === "2") {
      rl.question("Length (default 12): ", (lenRaw) => {
        const len = Number(lenRaw) || 12;
        console.log("Random string:", generateRandomString(len));
        prompt();
      });
    } else if (choice === "3") {
      console.log("Timestamp:", new Date().toString());
      prompt();
    } else if (choice.toLowerCase() === "q") {
      rl.close();
    } else {
      console.log("Unknown choice");
      prompt();
    }
  });
}

rl.on("close", () => {
  console.log("Bye!");
  process.exit(0);
});

console.log("Simple JS utility");
prompt();
