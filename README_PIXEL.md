# Pixel Art Generator

Simple Pixel Art generator built with HTML/JS served by PHP.

Features:
- Create pixel art with selectable grid size (16/24/32/48) and pixel export size.
- Click and drag to paint; eraser; clear canvas.
- Download PNG (scaled to chosen pixel size).

Usage:
1. Run PHP built-in server in project folder:
```powershell
php -S localhost:8000
```
2. Open http://localhost:8000/pixel_art.php

Notes:
- No server-side persistence by default. If you want saving, I can add saving to JSON or allow upload to Imgur via API.
- Export uses canvas; the generated PNG will be scaled to the chosen pixel size.
