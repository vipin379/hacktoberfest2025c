// Generate a random number between min and max (inclusive)
function generateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate a random string of given length
function generateRandomString(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Example usage:
const randomNum = generateRandomNumber(1, 100); // Change range as needed
const randomStr = generateRandomString(12); // Change length as needed
console.log("Random number:", randomNum);
console.log("Random string:", randomStr);
