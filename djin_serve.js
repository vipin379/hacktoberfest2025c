// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet());
app.use(bodyParser.json());

// Config
const SECRET = process.env.SECRET || "change_this_secret";
const PORT = parseInt(process.env.PORT||"8080",10);
const HOST = process.env.HOST || "0.0.0.0"; // set ke 172.18.44.147 jika mau bind khusus
const RSA_PRIVATE_KEY_PATH = process.env.RSA_PRIVATE_KEY_PATH || "./private.pem";
const RSA_PUBLIC_KEY_PATH = process.env.RSA_PUBLIC_KEY_PATH || "./public.pem";
const USE_RSA = (process.env.USE_RSA === "1"); // 0 = HMAC mode, 1 = RSA signed token mode

// simple in-memory store for generated licenses (for demo only)
const licenses = new Map();

// helper: base64url
function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function base64urlDecodeToString(s) {
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  while (s.length %4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

// sign HMAC-SHA256 mode
function signHmac(payloadObj) {
  const payloadJson = JSON.stringify(payloadObj);
  const payloadB64 = base64url(Buffer.from(payloadJson,'utf8'));
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payloadB64);
  const sig = base64url(hmac.digest());
  return `${payloadB64}.${sig}`;
}
function verifyHmac(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return {ok:false, reason:'invalid_format'};
    const [payloadB64, sig] = parts;
    const hmac = crypto.createHmac('sha256', SECRET);
    hmac.update(payloadB64);
    const expected = base64url(hmac.digest());
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return {ok:false, reason:'bad_sig'};
    const payloadJson = base64urlDecodeToString(payloadB64);
    return {ok:true, payload: JSON.parse(payloadJson)};
  } catch(e) {
    return {ok:false, reason:'exception', error:e.message};
  }
}

// RSA sign/verify mode
function rsaSign(payloadObj) {
  const payloadJson = JSON.stringify(payloadObj);
  const privateKey = fs.readFileSync(RSA_PRIVATE_KEY_PATH, 'utf8');
  const payloadB64 = base64url(Buffer.from(payloadJson,'utf8'));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(payloadB64);
  const sig = signer.sign(privateKey, 'base64');
  const sigUrl = sig.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return `${payloadB64}.${sigUrl}`;
}
function rsaVerify(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return {ok:false, reason:'invalid_format'};
    const [payloadB64, sigUrl] = parts;
    const sig = sigUrl.replace(/-/g,'+').replace(/_/g,'/');
    // pad
    const padLen = (4 - (sig.length % 4)) % 4;
    const sigPadded = sig + '='.repeat(padLen);
    const publicKey = fs.readFileSync(RSA_PUBLIC_KEY_PATH, 'utf8');
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(payloadB64);
    const ok = verifier.verify(publicKey, Buffer.from(sigPadded, 'base64'));
    if (!ok) return {ok:false, reason:'bad_sig'};
    const payloadJson = base64urlDecodeToString(payloadB64);
    return {ok:true, payload: JSON.parse(payloadJson)};
  } catch(e) {
    return {ok:false, reason:'exception', error: e.message};
  }
}

// signing abstraction
function signToken(payload) {
  if (USE_RSA && fs.existsSync(RSA_PRIVATE_KEY_PATH)) {
    return rsaSign(payload);
  } else {
    return signHmac(payload);
  }
}
function verifyToken(token) {
  if (USE_RSA && fs.existsSync(RSA_PUBLIC_KEY_PATH)) {
    return rsaVerify(token);
  } else {
    return verifyHmac(token);
  }
}

// limiter for endpoints
const limiter = rateLimit({ windowMs:60*1000, max: 120 });
app.use(limiter);

// admin generate (no auth in this demo — protect in production)
app.post('/api/generate', (req,res) => {
  const { machineId, days, mode } = req.body || {};
  const now = Math.floor(Date.now()/1000);
  const payload = {
    machineId: machineId || null,
    issuedAt: now,
    expiresAt: now + (parseInt(days||365,10) * 24 * 3600),
    mode: mode || 'full'
  };
  const token = signToken(payload);
  // store mapping (demo) so we can check revoke
  const id = machineId || `gen-${Date.now()}`;
  licenses.set(id, { token, payload });
  res.json({ ok:true, token, payload });
});

// activate endpoint: DF.exe calls this to validate code
app.post('/api/activate', (req,res) => {
  const { machineId, code } = req.body || {};
  if (!code) return res.status(400).json({ ok:false, reason:'missing_code' });
  // try verify token first
  const v = verifyToken(code);
  if (v.ok) {
    // check machineId (if payload has machineId and mismatch)
    if (v.payload.machineId && machineId && v.payload.machineId !== machineId) {
      return res.json({ ok:false, reason:'machine_mismatch' });
    }
    // check expiry
    const now = Math.floor(Date.now()/1000);
    if (v.payload.expiresAt && now > v.payload.expiresAt) {
      return res.json({ ok:false, reason:'expired', payload:v.payload });
    }
    // success
    return res.json({ ok:true, license:code, payload:v.payload });
  }
  // fallback: maybe legacy scheme: DF.exe might send raw 'activation code' that server validates by hashing
  // example legacy pattern: server expects SHA256(machineId + SECRET) equals provided code
  try {
    const expected = crypto.createHash('sha256').update((machineId||'') + SECRET).digest('hex');
    if (expected === code) {
      // create a license token to return
      const now = Math.floor(Date.now()/1000);
      const payload = { machineId: machineId||null, issuedAt: now, expiresAt: now + 365*24*3600, mode:'legacy' };
      const token = signToken(payload);
      licenses.set(machineId || `legacy-${now}`, { token, payload });
      return res.json({ ok:true, license:token, payload });
    }
  } catch(e) {}
  return res.json({ ok:false, reason:'invalid_code' });
});

// verify endpoint (server-side verify)
app.post('/api/verify', (req,res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ ok:false, reason:'missing' });
  const v = verifyToken(code);
  if (!v.ok) return res.json(v);
  const now = Math.floor(Date.now()/1000);
  if (v.payload.expiresAt && now > v.payload.expiresAt) return res.json({ ok:false, reason:'expired', payload:v.payload });
  res.json({ ok:true, payload: v.payload });
});

// health
app.get('/api/health', (req,res) => res.json({ ok:true, ts:Date.now() }));

app.listen(PORT, HOST, () => {
  console.log(`Activation server listening on http://${HOST}:${PORT} (USE_RSA=${USE_RSA})`);
});
