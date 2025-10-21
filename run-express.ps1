# Ensure we're in the script's directory
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Initialize npm if needed
if (!(Test-Path -Path "package.json")) {
  Write-Host "Initializing npm project..."
  npm init -y | Out-Null
}

# Install express if missing
if (!(Test-Path -Path "node_modules/express/package.json")) {
  Write-Host "Installing express..."
  npm install express --silent | Out-Null
}

# Create a simple server.js if it doesn't exist
if (!(Test-Path -Path "server.js")) {
  Write-Host "Creating server.js..."
  @'
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Hello from Express!");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
'@ | Set-Content -NoNewline -Path server.js
}

# Run the server
Write-Host "Starting server...";
node server.js

