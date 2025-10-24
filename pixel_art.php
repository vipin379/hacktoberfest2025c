<?php
// pixel_art.php - Simple Pixel Art Generator
// This file serves the frontend. No server-side persistence by default.
?>
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Pixel Art Generator</title>
  <link rel="stylesheet" href="pixel_art.css">
</head>
<body>
  <div class="app">
    <header>
      <h1>Pixel Art Generator</h1>
      <p class="lead">Klik grid untuk mewarnai. Pilih ukuran grid, warna, dan unduh PNG.</p>
    </header>

    <div class="controls">
      <label>Grid size:
        <select id="gridSize">
          <option value="16">16 x 16</option>
          <option value="24">24 x 24</option>
          <option value="32">32 x 32</option>
          <option value="48">48 x 48</option>
        </select>
      </label>

      <label>Pixel size:
        <select id="pixelSize">
          <option value="10">10px</option>
          <option value="12" selected>12px</option>
          <option value="16">16px</option>
          <option value="20">20px</option>
        </select>
      </label>

      <label>Color: <input type="color" id="colorPicker" value="#ff3b3b"></label>
      <button id="eraser">Eraser</button>
      <button id="clear">Clear</button>
      <button id="download">Download PNG</button>
    </div>

    <div class="canvas-wrap">
      <div id="grid" class="grid"></div>
    </div>

    <footer>
      <p class="small">Simple pixel art tool — no server-side save. You can copy/paste or download PNG.</p>
    </footer>
  </div>

  <script>
    const gridEl = document.getElementById('grid');
    const gridSizeEl = document.getElementById('gridSize');
    const pixelSizeEl = document.getElementById('pixelSize');
    const colorPicker = document.getElementById('colorPicker');
    const clearBtn = document.getElementById('clear');
    const downloadBtn = document.getElementById('download');
    const eraserBtn = document.getElementById('eraser');

    let currentColor = colorPicker.value;
    let erasing = false;

    function makeGrid(n, pixelSize){
      gridEl.innerHTML = '';
      gridEl.style.gridTemplateColumns = `repeat(${n}, ${pixelSize}px)`;
      gridEl.style.gridTemplateRows = `repeat(${n}, ${pixelSize}px)`;
      for (let i=0;i<n*n;i++){
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.width = pixelSize + 'px';
        cell.style.height = pixelSize + 'px';
        cell.dataset.index = i;
        cell.addEventListener('mousedown', paint);
        cell.addEventListener('mouseover', (e)=>{ if (e.buttons===1) paint(e); });
        gridEl.appendChild(cell);
      }
    }

    function paint(e){
      const el = e.currentTarget;
      if (erasing) el.style.background = '';
      else el.style.background = currentColor;
    }

    colorPicker.addEventListener('change', e=>{ currentColor = e.target.value; erasing=false; });
    eraserBtn.addEventListener('click', ()=>{ erasing = !erasing; eraserBtn.textContent = erasing ? 'Eraser (ON)' : 'Eraser'; });
    clearBtn.addEventListener('click', ()=>{ Array.from(gridEl.children).forEach(c=>c.style.background=''); });

    function downloadPNG(){
      const n = parseInt(gridSizeEl.value,10);
      const pixel = parseInt(pixelSizeEl.value,10);
      const canvas = document.createElement('canvas');
      canvas.width = n;
      canvas.height = n;
      const ctx = canvas.getContext('2d');

      const cells = Array.from(gridEl.children);
      for (let y=0;y<n;y++){
        for (let x=0;x<n;x++){
          const idx = y*n + x;
          const bg = cells[idx].style.background || 'transparent';
          if (bg){
            ctx.fillStyle = bg;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }

      // scale up to pixel* n
      const outCanvas = document.createElement('canvas');
      outCanvas.width = n * pixel;
      outCanvas.height = n * pixel;
      const outCtx = outCanvas.getContext('2d');
      // draw scaled
      outCtx.imageSmoothingEnabled = false;
      outCtx.drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height);

      const dataUrl = outCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'pixel-art.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    downloadBtn.addEventListener('click', downloadPNG);

    // update grid when controls change
    gridSizeEl.addEventListener('change', ()=> makeGrid(parseInt(gridSizeEl.value,10), parseInt(pixelSizeEl.value,10)));
    pixelSizeEl.addEventListener('change', ()=> makeGrid(parseInt(gridSizeEl.value,10), parseInt(pixelSizeEl.value,10)));

    // initial
    makeGrid(parseInt(gridSizeEl.value,10), parseInt(pixelSizeEl.value,10));

    // support mouse drag painting
    document.body.addEventListener('mousedown', ()=>{});
  </script>
</body>
</html>