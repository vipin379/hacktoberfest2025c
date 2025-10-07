// fetchData.js
const axios = require("axios");
const express = require("express");
const app = express();
const PORT = 3000;

app.get("/posts", async (req, res) => {
  try {
    const response = await axios.get("https://jsonplaceholder.typicode.com/posts");

    // Jika sukses
    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    // Network error (tidak dapat koneksi)
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      console.error("Network Error:", error.message);
      return res.status(503).json({
        success: false,
        message: "Service unavailable. Please try again later.",
      });
    }

    // HTTP error (404, 500, dsb)
    if (error.response) {
      console.error("HTTP Error:", error.response.status, error.response.statusText);
      return res.status(error.response.status).json({
        success: false,
        message: `Failed to fetch data: ${error.response.statusText}`,
      });
    }

    // Error umum
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred.",
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
