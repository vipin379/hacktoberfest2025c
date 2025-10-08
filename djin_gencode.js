// generate_code.js
require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');

// config from .env
const SECRET = process.env.SECRET || '';
const USE_RSA = (process.env.USE_RSA === '1');
const RSA_PRIVATE_KEY_PATH = process.env.RSA_PRIVATE_KEY_PATH || './private.pem';

// utils base64url
function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function base64urlDecodeToString(s) {
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  while (s.length %4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

// sign HMAC
function signHmac(payloadObj) {
  const payloadJson = JSON.stringify(payloadObj);
  const payloadB64 = base64url(Buffer.from(payloadJson,'utf8'));
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payloadB64);
  const sig = base64url(hmac.digest());
  return `${payloadB64}.${sig}`;
}

// RSA sign
function rsaSign(payloadObj) {
  const payloadJson = JSON.stringify(payloadObj);
  const payloadB64 = base64url(Buffer.from(payloadJson,'utf8'));
  const privateKey = fs.readFileSync(RSA_PRIVATE_KEY_PATH, 'utf8');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(payloadB64);
  const sig = signer.sign(privateKey, 'base64');
  const sigUrl = sig.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return `${payloadB64}.${sigUrl}`;
}

function signToken(payload) {
  if (USE_RSA && fs.existsSync(RSA_PRIVATE_KEY_PATH)) {
    return rsaSign(payload);
  } else {
    return signHmac(payload);
  }
}

function legacySha256(machineId) {
  // produce hex digest of sha256(machineId + SECRET)
  return crypto.createHash('sha256').update((machineId||'') + SECRET).digest('hex');
}

// CLI parse args
// Usage: node generate_code.js MACHINE_ID [DAYS] [MODE]
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node generate_code.js <machineId> [days=365] [mode=full]');
  process.exit(2);
}
const machineId = args[0];
const days = Math.max(1, parseInt(args[1]||'365',10));
const mode = args[2] || 'full';

const now = Math.floor(Date.now()/1000);
const payload = {
  machineId: machineId || null,
  issuedAt: now,
  expiresAt: now + days*24*3600,
  mode: mode
};

const token = signToken(payload);
const legacy = legacySha256(machineId);

console.log('=== Activation Code Generator ===');
console.log('machineId:', machineId);
console.log('expires (days):', days);
console.log('mode:', mode);
console.log('');
console.log('-> token (signed):');
console.log(token);
console.log('');
console.log('-> legacy (sha256 hex):');
console.log(legacy);
console.log('');
console.log('Tip: POST {"machineId":"'+machineId+'","code":"<token or legacy>"} to http://172.18.44.147:8080/api/activate');
