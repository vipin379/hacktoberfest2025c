// activation_bruteforce.js
// Produces many candidate activation codes from input ip/kodeAcak/days and writes candidates.txt
// Usage:
//   node activation_bruteforce.js "192.168.1.75" "6MK4D" 3
//   node activation_bruteforce.js "7.40.17.251" "L6BE2" 3

const crypto = require('crypto');
const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node activation_bruteforce.js <ip> <kodeAcak> <days>');
  process.exit(1);
}
const ip = args[0];
const kode = args[1];
const days = String(args[2]);

function md5hex(s){ return crypto.createHash('md5').update(s,'utf8').digest('hex'); }
function sha1hex(s){ return crypto.createHash('sha1').update(s,'utf8').digest('hex'); }
function sha256hex(s){ return crypto.createHash('sha256').update(s,'utf8').digest('hex'); }
function crc32hex(s){
  // simple CRC32 via buffer (fallback)
  const table = (function(){ let t=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++){ c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1); } t[n]=c; } return t; })();
  let crc = 0xFFFFFFFF;
  const buf = Buffer.from(s,'utf8');
  for(let i=0;i<buf.length;i++){
    const b = buf[i];
    crc = (crc >>> 8) ^ table[(crc ^ b) & 0xFF];
  }
  return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8,'0');
}

// helpers
function base36FromHex(hex){
  try {
    return BigInt('0x' + hex).toString(36).toUpperCase();
  } catch(e){ return ''; }
}
function base32FromHex(hex){
  // crude base32: convert bytes -> base32 using Buffer -> base64 then map (not perfect but adds variety)
  try {
    const b = Buffer.from(hex, 'hex');
    return b.toString('base64').replace(/=/g,'').replace(/\+/g,'').replace(/\//g,'').toUpperCase();
  } catch(e){ return ''; }
}
function base64urlFromHex(hex){
  try {
    const b = Buffer.from(hex, 'hex');
    return b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  } catch(e){ return ''; }
}
function lettersOnly(s){
  return s.replace(/[^A-Za-z]/g,'').toUpperCase();
}
function digitsOnly(s){
  return s.replace(/[^0-9]/g,'').toUpperCase();
}
function reverseStr(s){ return s.split('').reverse().join(''); }
function nibbleSwap(hex){ // swap nibbles in each byte (e.g., '1a2b' -> 'a12b' naive)
  if (hex.length % 2 !== 0) hex = '0' + hex;
  let out = '';
  for (let i=0;i<hex.length;i+=2){
    const a = hex[i], b = hex[i+1];
    out += b + a;
  }
  return out;
}

function generateAll(base) {
  const results = new Set();
  // base hashes
  const md5 = md5hex(base);
  const sha1 = sha1hex(base);
  const sha256 = sha256hex(base);
  const crc32 = crc32hex(base);

  const hashes = [
    {name:'md5', h:md5},
    {name:'sha1', h:sha1},
    {name:'sha256', h:sha256},
    {name:'crc32', h:crc32}
  ];

  const lens = [6,7,8,9,10,11,12];
  const starts = [0,1,2,3,4,5,6,8,-8,-10];

  // add full variants and slices
  hashes.forEach(obj=>{
    results.add(obj.h.toUpperCase());
    starts.forEach(st=>{
      lens.forEach(len=>{
        // slice (support negative start)
        let s = obj.h;
        let pos = st;
        if (pos < 0) pos = s.length + pos;
        if (pos < 0) pos = 0;
        const substr = s.substr(pos, len);
        if (substr) results.add(substr.toUpperCase());
        // reversed
        results.add(reverseStr(substr).toUpperCase());
      });
    });
    // nibble swapped + slices
    const ns = nibbleSwap(obj.h);
    results.add(ns.toUpperCase());
    starts.forEach(st=>{
      lens.forEach(len=>{
        let pos = st < 0 ? ns.length + st : st;
        if (pos < 0) pos = 0;
        const sub = ns.substr(pos, len);
        if (sub) results.add(sub.toUpperCase());
      });
    });
  });

  // base36 / base64 / base32
  const b36 = base36FromHex(sha256);
  if (b36) {
    results.add(b36);
    lens.forEach(l=> results.add(b36.substr(0,l).toUpperCase()));
  }
  const b32 = base32FromHex(md5);
  if (b32) {
    results.add(b32);
    lens.forEach(l=> results.add(b32.substr(0,l).toUpperCase()));
  }
  const b64u = base64urlFromHex(sha256);
  if (b64u) {
    results.add(b64u.toUpperCase());
    lens.forEach(l=> results.add(b64u.substr(0,l).toUpperCase()));
  }

  // letters/digits only
  Array.from(results).forEach(v=>{
    const L = lettersOnly(v);
    if (L) results.add(L.substr(0,12));
    const D = digitsOnly(v);
    if (D) results.add(D.substr(0,12));
  });

  // direct combos
  results.add(kode.toUpperCase());
  const ipCompact = ip.replace(/\./g,'');
  results.add(ipCompact);
  results.add((ipCompact + kode).toUpperCase());
  results.add((ipCompact + kode + days).toUpperCase());

  // append/prepend days
  const dayVars = [days, ('00'+days).slice(-3), 'D'+days];
  Array.from(results).forEach(v=>{
    dayVars.forEach(dv=>{
      results.add((v + dv).toUpperCase());
      results.add((dv + v).toUpperCase());
    });
  });

  // small variations: replace letters with lookalikes removed (I/O)
  const lookalikes = {'0':'O','1':'I'};
  const arr = Array.from(results);
  arr.forEach(v=>{
    let s = v;
    Object.keys(lookalikes).forEach(k=>{
      s = s.replace(new RegExp(k,'g'), lookalikes[k]);
    });
    results.add(s);
  });

  return Array.from(results);
}

const base = `${ip}/${kode}/${days}`;
console.log('Base string:', base);
const all = generateAll(base);
console.log('Candidates count:', all.length);
const outPath = `candidates_${ip.replace(/\./g,'_')}_${kode}_${days}.txt`;
fs.writeFileSync(outPath, all.join('\n'), 'utf8');
console.log('Wrote candidates to', outPath);
console.log('Open file and copy-paste candidates into DF.exe until find matching code.');
