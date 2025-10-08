// test_candidates.js
// Usage: node test_candidates.js <machineId> <candidates_file> [serverUrl]
// Example: node test_candidates.js "192.168.1.75" candidates_192_168_1_75_6MK4D_3.txt http://172.18.44.147:8080

const fs = require('fs');
const fetch = require('node-fetch'); // npm i node-fetch@2
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node test_candidates.js <machineId> <candidates_file> [serverUrl]');
  process.exit(2);
}
const [machineId, filePath] = args;
const server = args[2] || 'http://172.18.44.147:8080';
const activateUrl = server.replace(/\/+$/,'') + '/api/activate';

if (!fs.existsSync(filePath)) {
  console.error('Candidates file not found:', filePath);
  process.exit(3);
}

const lines = fs.readFileSync(filePath,'utf8').split(/\r?\n/).map(s=>s.trim()).filter(s=>s.length>0);

console.log(`Testing ${lines.length} candidates against ${activateUrl} for machineId=${machineId}`);
let found = [];
// sequential with small delay to be polite
(async () => {
  for (let i=0;i<lines.length;i++){
    const code = lines[i];
    try {
      const res = await fetch(activateUrl, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ machineId, code })
      });
      const j = await res.json().catch(()=>({ok:false}));
      if (j && j.ok) {
        console.log(`MATCH FOUND: code=${code}  => server ok, payload=${JSON.stringify(j.payload||{})}`);
        found.push({code, payload:j.payload||null, raw:j});
        // optionally break if you want first match only:
        // break;
      } else {
        if (i % 100 === 0) process.stdout.write(`.${i}`); // progress dots
      }
    } catch(e){
      console.error('Request error', e.message);
      // wait a bit and continue
      await new Promise(r=>setTimeout(r,500));
    }
    // small delay to avoid spamming server
    await new Promise(r=>setTimeout(r,60));
  }
  console.log('\nDone. Matches:', found.length);
  if (found.length>0) {
    console.log(JSON.stringify(found, null, 2));
    fs.writeFileSync('matches_found.json', JSON.stringify(found, null, 2), 'utf8');
    console.log('Saved matches_found.json');
  }
})();
