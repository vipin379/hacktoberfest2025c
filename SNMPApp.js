// js/app.js

// ===================== Helpers & UI =====================
function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id==='sensor-monitoring') initializeCharts();
}
function logLine(s){
  const el=document.getElementById('log'); if(!el) return;
  el.textContent=(el.textContent?el.textContent+"\n":"")+s;
}
function getBackendUrl(path){
  const base=(typeof __backend_base_url!=='undefined'&&__backend_base_url)?__backend_base_url:"http://127.0.0.1:5000";
  return base.replace(/\/$/,'')+path;
}
function debounce(fn, wait){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), wait); }; }

// ===================== Persist filters =====================
function saveFilters(){
  localStorage.setItem('snmpFilters', JSON.stringify({
    search: document.getElementById('filter-search')?.value || '',
    ip: document.getElementById('filter-ip')?.value || '',
    timeWindow: document.getElementById('time-window')?.value || '15',
    livePaused: window.livePaused ? 1 : 0,
  }));
}
function loadFilters(){
  const data = JSON.parse(localStorage.getItem('snmpFilters') || '{}');
  if(data.search) document.getElementById('filter-search').value = data.search;
  if(data.ip) document.getElementById('filter-ip').value = data.ip;
  if(data.timeWindow) document.getElementById('time-window').value = data.timeWindow;
  if(typeof data.livePaused!== 'undefined' && Number(data.livePaused)===1){
    window.livePaused = true;
    const btn=document.getElementById('toggle-live-btn'); const badge=document.getElementById('live-badge');
    if(btn&&badge){ btn.textContent='Resume Live'; badge.textContent='PAUSED'; badge.style.background='rgba(239,68,68,.25)'; }
  }
}

// ===================== Table & Filters =====================
let tableData=[]; window.livePaused=window.livePaused||false;
let fsOptions={timeWindowMinutes:15};
const rowSeen=new Set();

function rowKey(r){return `${r.oid}|${r.ts}|${r.ip}|${r.port}|${r.value}`}
function getFilters(){
  const q=(document.getElementById('filter-search')?.value||'').trim().toLowerCase();
  const ip=(document.getElementById('filter-ip')?.value||'').trim().toLowerCase();
  return { q, ip };
}
function getFilteredTableData(){
  const { q, ip } = getFilters();
  if(!q && !ip) return tableData;
  return tableData.filter(r=>{
    const sName=(r.name||'').toLowerCase();
    const sOID=(r.oid||'').toLowerCase();
    const sIP=(r.ip||'').toLowerCase();
    const okQ = !q || sName.includes(q) || sOID.includes(q);
    const okIP = !ip || sIP.includes(ip);
    return okQ && okIP;
  });
}
function onFilterChange(){ renderTable(); saveFilters(); }

function sourceBadge(src){
  if(src==='firestore') return '<span class="badge" style="background:rgba(16,185,129,.25)">FS</span>';
  if(src==='backend') return '<span class="badge" style="background:rgba(59,130,246,.25)">BK</span>';
  if(src==='dummy') return '<span class="badge" style="background:rgba(148,163,184,.25)">DM</span>';
  return '<span class="badge" style="background:rgba(148,163,184,.2)">NA</span>';
}
function clearTable(){tableData=[];rowSeen.clear();document.getElementById('table-body').innerHTML='';logLine('# Table cleared')}
function renderTable(){
  const tb=document.getElementById('table-body'); if(!tb) return;
  const rows = getFilteredTableData();
  tb.innerHTML=rows.map((r,i)=>`
    <tr class="border-t border-slate-700">
      <td class="p-2 text-gray-400">${rows.length - i}</td>
      <td class="p-2">${r.name}</td>
      <td class="p-2 mono">${r.oid}</td>
      <td class="p-2">${r.value}</td>
      <td class="p-2">${r.unit||''}</td>
      <td class="p-2">${r.type||''}</td>
      <td class="p-2">${r.category||''}</td>
      <td class="p-2">${sourceBadge(r.source)}</td>
      <td class="p-2">${r.ip}:${r.port}</td>
      <td class="p-2">${String(r.ts).replace('T',' ').slice(0,19)}</td>
    </tr>`).join('');
}
function pushRows(rows){
  const add=[]; rows.forEach(r=>{
    if(!r.source) r.source='backend';
    const k=rowKey(r); if(!rowSeen.has(k)){rowSeen.add(k); add.push(r);}
  });
  if(!add.length) return;
  tableData.unshift(...add); if(tableData.length>600) tableData.length=600;
  renderTable(); appendRowsToCharts(add);
}
function setFsOptions(partial){ fsOptions = Object.assign({}, fsOptions, partial||{}); }
function resubscribe(){
  if(window.unsubscribeFS){ try{ window.unsubscribeFS(); }catch{} window.unsubscribeFS=null; }
  if(typeof window.startFirestoreListener==='function'){
    window.unsubscribeFS=window.startFirestoreListener({
      onRows:(rows)=>{ if(window.livePaused) return; pushRows(rows); },
      maxDocs:200,
      timeWindowMinutes: fsOptions.timeWindowMinutes || null,
    });
  }
}
function toggleLive(){
  window.livePaused=!window.livePaused; const btn=document.getElementById('toggle-live-btn'); const badge=document.getElementById('live-badge');
  if(window.livePaused){
    btn.textContent='Resume Live'; badge.textContent='PAUSED'; badge.style.background='rgba(239,68,68,.25)'
    if(window.unsubscribeFS){ try{ window.unsubscribeFS(); }catch{} window.unsubscribeFS=null; }
  } else {
    btn.textContent='Pause Live'; badge.textContent='LIVE'; badge.style.background='rgba(16,185,129,.25)'
    resubscribe();
  }
  saveFilters();
}

// ===================== CSV Export =====================
function exportCSV(){
  const rows=getFilteredTableData();
  if(!rows.length){ alert('No data to export'); return; }
  const header=['Name','OID','Value','Unit','Type','Category','Source','IP','Port','Time'];
  const csv=[header.join(',')].concat(rows.map(r=>[
    JSON.stringify(r.name??''),
    JSON.stringify(r.oid??''),
    JSON.stringify(r.value??''),
    JSON.stringify(r.unit??''),
    JSON.stringify(r.type??''),
    JSON.stringify(r.category??''),
    JSON.stringify(r.source??''),
    JSON.stringify(r.ip??''),
    JSON.stringify(r.port??''),
    JSON.stringify(String(r.ts).replace('T',' ').slice(0,19)),
  ].join(','))).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='snmp_table.csv';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

// ===================== Charts =====================
function initializeCharts(){
  if(Chart.getChart('tempHumidityChart')) Chart.getChart('tempHumidityChart').destroy();
  if(Chart.getChart('voltageCurrentChart')) Chart.getChart('voltageCurrentChart').destroy();
  const tctx=document.getElementById('tempHumidityChart').getContext('2d');
  const vctx=document.getElementById('voltageCurrentChart').getContext('2d');
  window.tempHumidityChart=new Chart(tctx,{type:'line',data:{labels:[],datasets:[
    {label:'Temperature (°C)',data:[],borderColor:'#f87171',backgroundColor:'rgba(248,113,113,.2)',tension:.35},
    {label:'Humidity (%RH)', data:[],borderColor:'#60a5fa',backgroundColor:'rgba(96,165,250,.2)',tension:.35}
  ]}});
  window.voltageCurrentChart=new Chart(vctx,{type:'line',data:{labels:[],datasets:[
    {label:'Voltage (V)',data:[],borderColor:'#a78bfa',backgroundColor:'rgba(167,139,250,.2)',tension:.35},
    {label:'Current (A)',data:[],borderColor:'#34d399',backgroundColor:'rgba(52,211,153,.2)',tension:.35}
  ]}});
}
function appendRowsToCharts(rows){
  if(!window.tempHumidityChart||!window.voltageCurrentChart) return;
  const tC=window.tempHumidityChart, vC=window.voltageCurrentChart;
  const label=new Date().toLocaleTimeString();
  if(tC.data.labels[tC.data.labels.length-1]!==label){tC.data.labels.push(label); vC.data.labels.push(label);}
  const t=tC.data.datasets[0].data, h=tC.data.datasets[1].data, v=vC.data.datasets[0].data, c=vC.data.datasets[1].data;
  rows.forEach(r=>{const nm=(r.name||'').toLowerCase(); const val=(typeof r.value==='number')?r.value:parseFloat(r.value);
    if(!Number.isFinite(val)) return;
    if(nm.includes('temp')) t.push(val); else if(nm.includes('humid')) h.push(val);
    else if(nm.includes('volt')) v.push(val); else if(nm.includes('curr')) c.push(val);
  });
  [t,h,v,c,tC.data.labels,vC.data.labels].forEach(a=>{while(a.length>60) a.shift();});
  tC.update(); vC.update();
}

// ===================== Backend Calls =====================
async function runOp(op){
  const ip=document.getElementById('ip').value.trim();
  const port=parseInt(document.getElementById('port').value||'161',10);
  const community=document.getElementById('community').value.trim();
  const version=document.getElementById('version').value;
  const oid=document.getElementById('oid').value.trim();
  const v3={
    user:document.getElementById('v3_user').value.trim(),
    authProto:document.getElementById('v3_auth').value,
    authKey:document.getElementById('v3_authKey').value,
    privProto:document.getElementById('v3_priv').value,
    privKey:document.getElementById('v3_privKey').value,
  };

  const payload={operation:op,ip,port,community,version,oid};
  if(version==='v3') payload.v3=v3;

  const buttons=document.querySelectorAll('.btn-1, .btn-3');
  buttons.forEach(b=>b.disabled=true);

  logLine(`# ${op.toUpperCase()} → ${ip}:${port} ${oid}`);
  try{
    const res=await fetch(getBackendUrl('/snmp'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json();
    if(!res.ok){logLine(`# ERROR ${res.status}: ${JSON.stringify(data)}`);return;}
    const rows=Array.isArray(data.rows)?data.rows:[];
    if(rows.length){ rows.forEach(r=>{ if(!r.source) r.source = (r.dummy===true?'dummy':'backend'); }); }
    if(!window.livePaused && rows.length) pushRows(rows);
    logLine(`# OK: ${op} received ${rows.length||0} rows`);
  }catch(e){
    logLine(`# fetch error: ${e?.message||e}`);
  }finally{
    buttons.forEach(b=>b.disabled=false);
  }
}
function doSet(){
  const val=prompt("Enter value to SET:"); if(!val) return;
  const ip=document.getElementById('ip').value.trim();
  const port=parseInt(document.getElementById('port').value||'161',10);
  const community=document.getElementById('community').value.trim();
  const version=document.getElementById('version').value;
  const oid=document.getElementById('oid').value.trim();
  const v3={
    user:document.getElementById('v3_user').value.trim(),
    authProto:document.getElementById('v3_auth').value,
    authKey:document.getElementById('v3_authKey').value,
    privProto:document.getElementById('v3_priv').value,
    privKey:document.getElementById('v3_privKey').value,
  };
  const payload={operation:'set',ip,port,community,version,oid,setValue:val};
  if(version==='v3') payload.v3=v3;
  logLine(`# SET "${val}" → ${ip}:${port} ${oid}`);
  fetch(getBackendUrl('/snmp'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(r=>r.json().then(j=>({ok:r.ok,body:j}))).then(({ok,body})=>{
      if(!ok) logLine(`# ERROR: ${JSON.stringify(body)}`);
      else{ const rows=Array.isArray(body.rows)?body.rows:[]; if(rows.length){ rows.forEach(r=>{ if(!r.source) r.source = (r.dummy===true?'dummy':'backend'); }); } if(!window.livePaused&&rows.length) pushRows(rows); logLine(`# OK: SET result ${rows.length||0} rows`); }
    }).catch(e=>logLine(`# fetch error: ${e?.message||e}`));
}

// ===================== Boot =====================
window.onload=function(){
  showPage('snmp-table'); initializeCharts();

  loadFilters();

  const debouncedFilter = debounce(onFilterChange, 300);
  document.getElementById('filter-search').addEventListener('input', debouncedFilter);
  document.getElementById('filter-ip').addEventListener('input', debouncedFilter);
  document.getElementById('time-window').addEventListener('change', (e)=>{
    const minutes=parseInt(e.target.value,10)||0;
    setFsOptions({timeWindowMinutes: minutes});
    saveFilters();
    resubscribe();
  });

  const tw=document.getElementById('time-window').value; fsOptions.timeWindowMinutes = parseInt(tw||'15',10) || 0;

  const wait=setInterval(()=>{
    if(window.isFirebaseReady && window.db){
      clearInterval(wait);
      if(!window.livePaused){ resubscribe(); }
    }
  },300);
};
