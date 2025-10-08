// Simple fetch from ip-api.com using Node.js
const http = require("http");

const url = "http://ip-api.com/json"; // Fetch info for your own IP

http
  .get(url, (res) => {
    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => {
      try {
        const info = JSON.parse(data);
        console.log("Geolocation info:", info);
      } catch (e) {
        console.error("Error parsing response:", e);
      }
    });
  })
  .on("error", (err) => {
    console.error("Request error:", err);
  });
