// server.js
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function hashAndFormat(base, algo='sha256', length=10) {
  let digest;
  try {
    digest = crypto.createHash(algo).update(base, 'utf8').digest('hex');
  } catch (e) {
    // fallback to sha256
    digest = crypto.createHash('sha256').update(base, 'utf8').digest('hex');
  }
  const out = digest.substring(0, length).toUpperCase();
  return out;
}

function randomCode(len=5) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa I,O,0,1 untuk jelas
  let s = '';
  for (let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

// endpoint untuk tombol G: kembalikan IP client + random code
app.get('/api/generate-sample', (req,res) => {
  // dapatkan IP dari header (X-Forwarded-For) atau socket
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || '';
  // jika ip format ::ffff:192.168.x.x -> normalisasi
  if (ip.startsWith('::ffff:')) ip = ip.split('::ffff:')[1];
  // jika localhost ipv6
  if (ip === '::1' || ip === '127.0.0.1') {
    // fallback, biarkan kosong agar user bisa isi manual
    ip = '';
  }
  const kodeAcak = randomCode(5);
  res.json({ ok:true, ip, kodeAcak });
});

// endpoint generate activation code
app.post('/api/generate', (req,res) => {
  const { ip='', kodeAcak='', days='3', algo='sha256', outLen=10 } = req.body || {};
  if (!ip || !kodeAcak) {
    return res.status(400).json({ ok:false, reason:'missing_ip_or_kodeAcak' });
  }
  const base = `${ip}/${kodeAcak}/${days}`;
  const activation = hashAndFormat(base, algo, parseInt(outLen||10,10));
  res.json({ ok:true, base, activation });
});

// serve index.html
app.get('/', (req,res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => console.log(`DF Activation Generator listening on http://localhost:${PORT}`));
