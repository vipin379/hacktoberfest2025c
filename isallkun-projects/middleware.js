// middleware.js
const express = require("express");
const app = express();
app.use(express.json()); // untuk parsing JSON body

// Middleware untuk validasi data user
function validateUser(req, res, next) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: name, email, or password.",
    });
  }

  // Validasi sederhana email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format.",
    });
  }

  // Password minimal 6 karakter
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long.",
    });
  }

  next(); // lanjut ke route berikutnya jika valid
}

// Route untuk create-user
app.post("/create-user", validateUser, (req, res) => {
  const { name, email } = req.body;
  res.status(201).json({
    success: true,
    message: "User created successfully!",
    data: { name, email },
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
