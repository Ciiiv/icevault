// STATE
let collection = JSON.parse(localStorage.getItem('iceVault_cards') || '[]');
let sharedCollection = [];
let currentPage = 1;
let totalPages = 1;
let totalCards = 0;
let isServerPaginated = false; // true when signed in and using server-side pagination
let currentImage = null, currentImageData = null, currentGrade = null;
let currentTags = [], selectedCardForEbay = null, cameraStream = null;

function getKeys() {
  return {
    anthropic: localStorage.getItem('iceVault_anthropicKey') || '',
    openai: localStorage.getItem('iceVault_openaiKey') || '',
    gemini: localStorage.getItem('iceVault_geminiKey') || '',
    ximilar: localStorage.getItem('iceVault_ximilarKey') || '',
    ebayApp: localStorage.getItem('iceVault_ebayApp') || '',
    ebayToken: localStorage.getItem('iceVault_ebayToken') || ''
  };
}

function saveApiKeys() {
  // Strip non-ASCII chars (e.g. bullet mask chars) before saving
  const sanitize = v => v.replace(/[^\x20-\x7E]/g, '').trim();
  const k=sanitize(document.getElementById('anthropicKeyInput').value);
  const ok=sanitize(document.getElementById('openaiKeyInput').value);
  const gk=sanitize(document.getElementById('geminiKeyInput').value);
  const xk=sanitize(document.getElementById('ximilarKeyInput').value);
  const ea=sanitize(document.getElementById('ebayAppIdModal').value);
  const et=sanitize(document.getElementById('ebayTokenModal').value);
  if(k) localStorage.setItem('iceVault_anthropicKey',k);
  if(ok) localStorage.setItem('iceVault_openaiKey',ok);
  if(gk) localStorage.setItem('iceVault_geminiKey',gk);
  if(xk) localStorage.setItem('iceVault_ximilarKey',xk);
  if(ea) localStorage.setItem('iceVault_ebayApp',ea);
  if(et) localStorage.setItem('iceVault_ebayToken',et);
  document.getElementById('apiStatus').textContent='✓ Saved!';
  document.getElementById('apiStatus').className='api-status ok';
  setTimeout(()=>closeModal('apiModal'),1200);
}

function openApiModal() {
  const keys=getKeys();
  document.getElementById('anthropicKeyInput').value=keys.anthropic?'••••••••••••':'';
  document.getElementById('openaiKeyInput').value=keys.openai?'••••••••••••':'';
  document.getElementById('geminiKeyInput').value=keys.gemini?'••••••••••••':'';
  document.getElementById('ximilarKeyInput').value=keys.ximilar?'••••••••••••':'';
  document.getElementById('ebayAppIdModal').value=keys.ebayApp||'';
  document.getElementById('ebayTokenModal').value=keys.ebayToken?'••••••••••••':'';
  document.getElementById('apiModal').classList.add('open');
  const inner=document.querySelector('#apiModal .api-modal');
  if(inner&&!inner.querySelector('.theme-picker-row')){
    inner.insertAdjacentHTML('beforeend',renderThemePicker());
  }
}

// VIEWS — switchView syncs both classic nav + sidebar nav
function switchView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.sidebar-item[id^="sb-"]').forEach(b=>b.classList.remove('active'));
  const view=document.getElementById('view-'+name);
  if(view) view.classList.add('active');
  const nb=document.getElementById('nav-'+name); if(nb) nb.classList.add('active');
  const sb=document.getElementById('sb-'+name); if(sb) sb.classList.add('active');
  const titles={scan:'Scan Card',collection:'My Collection',ebay:'List on eBay',stats:'Stats & Value Tracking'};
  const te=document.getElementById('topbarTitle'); if(te) te.textContent=titles[name]||name;
  document.getElementById('sidebarShell')?.classList.remove('drawer-open');
  if(name==='collection') renderCollection();
  if(name==='ebay') renderEbayCardSelect();
  if(name==='stats') renderStats();
}

let currentBackImageData=null;
let bulkSelectMode = false;
let selectedCardIds = new Set();

document.getElementById('dropZone').addEventListener('dragover',e=>{e.preventDefault();e.currentTarget.classList.add('drag-over');});
document.getElementById('dropZone').addEventListener('dragleave',e=>e.currentTarget.classList.remove('drag-over'));
document.getElementById('dropZone').addEventListener('drop',e=>{e.preventDefault();e.currentTarget.classList.remove('drag-over');const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))loadImageFile(f,'front');});
document.getElementById('dropZoneBack').addEventListener('dragover',e=>{e.preventDefault();e.currentTarget.classList.add('drag-over');});
document.getElementById('dropZoneBack').addEventListener('dragleave',e=>e.currentTarget.classList.remove('drag-over'));
document.getElementById('dropZoneBack').addEventListener('drop',e=>{e.preventDefault();e.currentTarget.classList.remove('drag-over');const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))loadImageFile(f,'back');});

function handleFileSelect(e,side){const f=e.target.files[0];if(f)loadImageFile(f,side||'front');}

function loadImageFile(file,side){
  const r=new FileReader();
  r.onload=e=>{
    if(side==='back'){currentBackImageData=e.target.result;setPreviewImage(e.target.result,'back');}
    else{currentImageData=e.target.result;currentImage=file;setPreviewImage(e.target.result,'front');}
  };
  r.readAsDataURL(file);
}

function setPreviewImage(src,side){
  if(side==='back'){document.getElementById('previewBoxBack').innerHTML=`<img src="${src}" style="width:100%;height:100%;object-fit:contain;">`;return;}
  document.getElementById('previewBox').innerHTML=`<img src="${src}" style="width:100%;height:100%;object-fit:contain;">`;
  document.getElementById('analyzeBtn').disabled=false;
  document.getElementById('clearBtn').classList.add('visible');
  resetFields();
  showToast('Front image loaded — add back image if available, then click Analyze','success');
}

function clearCard(){
  currentImageData=null;currentBackImageData=null;currentImage=null;
  document.getElementById('previewBox').innerHTML='<div class="preview-placeholder"><div style="font-size:24px;margin-bottom:4px;">🏒</div><div style="font-size:11px;">Front</div></div>';
  document.getElementById('previewBoxBack').innerHTML='<div class="preview-placeholder"><div style="font-size:24px;margin-bottom:4px;">🔄</div><div style="font-size:11px;">Back</div></div>';
  document.getElementById('analyzeBtn').disabled=true;
  document.getElementById('clearBtn').classList.remove('visible');
  document.getElementById('fileInput').value='';
  document.getElementById('fileInputBack').value='';
  document.getElementById('includeEbayDesc').checked=false;
  resetFields();
  showToast('Card cleared — ready to scan again','success');
}

function resetFields(){
  ['fieldPlayer','fieldYear','fieldBrand','fieldNumber','fieldSerial','fieldTeam','fieldParallel','fieldValue'].forEach(id=>document.getElementById(id).value='');
  currentTags=[];renderTagRow();
  document.getElementById('gradeResult').style.display='none';
  document.getElementById('gradePlaceholder').style.display='block';
  currentGrade=null;
}

let cameraTarget='front';
async function openCamera(side){
  cameraTarget=side||'front';
  try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});document.getElementById('cameraFeed').srcObject=cameraStream;document.getElementById('cameraModal').classList.add('open');}
  catch{showToast('Camera access denied or unavailable','error');}
}
function closeCamera(){if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}document.getElementById('cameraModal').classList.remove('open');}
function capturePhoto(){
  const video=document.getElementById('cameraFeed'),canvas=document.getElementById('cameraCanvas');
  canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);
  const d=canvas.toDataURL('image/jpeg',0.9);
  if(cameraTarget==='back'){currentBackImageData=d;setPreviewImage(d,'back');}
  else{currentImageData=d;setPreviewImage(d,'front');}
  closeCamera();
}

let _scanModel = 'claude';
function setScanModel(model) {
  _scanModel = model;
  ['claude','gpt4o','gemini'].forEach(m => {
    const btn = document.getElementById('scanModel' + m.charAt(0).toUpperCase() + m.slice(1));
    if (btn) btn.className = 'grader-btn' + (m === model ? ' active' : '');
  });
  // Update cost hints
  const label = model === 'gpt4o' ? 'GPT-4o' : model === 'gemini' ? 'Gemini' : 'Claude';
  const cost = model === 'gemini' ? '~$0.001-0.01 (free tier available)' : '~$0.01-0.03 (paid balance required)';
  const costNote = document.getElementById('scanCostText');
  if (costNote) costNote.textContent = 'Each scan uses ' + label + ' (' + cost + ' with front+back)';
  const analyzeNote = document.getElementById('analyzeCostNote');
  if (analyzeNote) analyzeNote.textContent = '⚠ ' + cost + ' per scan (' + label + ')';
}

function normalizeImageToJpeg(dataUrl){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const MAX=1280;
      let w=img.width,h=img.height;
      if(w>MAX||h>MAX){if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;}}
      const canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL('image/jpeg',0.92));
    };
    img.onerror=()=>resolve(dataUrl); // fallback to original
    img.src=dataUrl;
  });
}
async function analyzeCard(){
  const keys=getKeys();
  const _needKey = _scanModel === 'gpt4o' ? keys.openai : _scanModel === 'gemini' ? keys.gemini : keys.anthropic;
  if(!_needKey){showToast('Set your ' + (_scanModel === 'gpt4o' ? 'OpenAI' : _scanModel === 'gemini' ? 'Google AI' : 'Anthropic') + ' API key first (⚙ API Keys)','error');return;}
  const btn=document.getElementById('analyzeBtn');
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> &nbsp; Analyzing...';
  const includeEbay=document.getElementById('includeEbayDesc').checked;
  const includeGrade=document.getElementById('includeGrade')?.checked !== false;
  const hasBack=!!currentBackImageData;
  try{
    const normFront=await normalizeImageToJpeg(currentImageData);
    const fb64=normFront.split(',')[1];
    const fmt='image/jpeg';
    const imgs=[{type:'image',source:{type:'base64',media_type:fmt,data:fb64}}];
    if(hasBack){const normBack=await normalizeImageToJpeg(currentBackImageData);const bb=normBack.split(',')[1];const bm='image/jpeg';imgs.push({type:'image',source:{type:'base64',media_type:bm,data:bb}});}
    const ebayF=includeEbay?`,\n  "ebayTitle":"eBay title max 80 chars",\n  "ebayDescription":"Collector eBay description 2-3 paragraphs"`:'';
    const gradeF=includeGrade?`,\n  "grade":{"overall":"1-10","centering":"1-10","corners":"1-10","edges":"1-10","surface":"1-10","rationale":"2-3 sentences"}`:'';
    const backN=hasBack?'Second image is the BACK — use it for card number, parallel, serial number, back condition.':'Only front provided.';
    const prompt=`You are an expert hockey card dealer and collector with 20 years of experience handling hundreds of thousands of cards. ${backN}\nAnalyze this hockey card carefully and respond ONLY with JSON. Read all fields exactly as printed in text on the card -- do not describe visual appearance, do not guess, do not abbreviate, and do not add words not printed on the card. Specifically: brand/set must include any subset name exactly as printed (e.g. insert or parallel set names); parallel must be read exactly as printed in text on the card not from visual appearance; card number must be read exactly as printed; year must be read exactly as printed; serial number must be the actual number printed on the card not inferred. If unsure of any field leave it as null rather than guessing:\n{\n  "player":"Full player name",\n  "year":"Card year",\n  "brand":"Brand and set name",\n  "cardNumber":"Card number if visible",\n  "team":"Player team",\n  "parallel":"Parallel or Base",\n  "serialNumber":"Serial number if present e.g. 47/99 or null",\n  "estimatedValue":"Market value USD as number string"${gradeF}${ebayF}\n}`;
    let res, data, raw;
    if (_scanModel === 'gpt4o') {
      if (!keys.openai) { showToast('Set your OpenAI API key first (\u2699 API Keys)', 'error'); btn.disabled=false; btn.innerHTML='\u2726 &nbsp; Analyze with AI'; return; }
      const gptImgs = imgs.map(img => ({ type: 'image_url', image_url: { url: 'data:' + img.source.media_type + ';base64,' + img.source.data } }));
      res = await fetch(WORKER_URL + '/proxy/openai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-openai-key': keys.openai }, body: JSON.stringify({ model: 'gpt-4o', max_tokens: includeEbay ? 2000 : 1200, messages: [{ role: 'user', content: [...gptImgs, { type: 'text', text: prompt }] }] }) });
      data = await res.json();
      if (data.error) throw new Error(data.error.message);
      raw = data.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
    } else if (_scanModel === 'gemini') {
      if (!keys.gemini) { showToast('Set your Google AI API key first (\u2699 API Keys)', 'error'); btn.disabled=false; btn.innerHTML='\u2726 &nbsp; Analyze with AI'; return; }
      const gemParts = imgs.map(img => ({ inline_data: { mime_type: img.source.media_type, data: img.source.data } }));
      res = await fetch(WORKER_URL + '/proxy/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gemini-key': keys.gemini }, body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [...gemParts, { text: prompt }] }] }) });
      data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      raw = data.candidates[0].content.parts[0].text.trim().replace(/```json|```/g, '').trim();
    } else {
      if (!keys.anthropic) { showToast('Set your Anthropic API key first (\u2699 API Keys)', 'error'); btn.disabled=false; btn.innerHTML='\u2726 &nbsp; Analyze with AI'; return; }
      res = await fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': keys.anthropic, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: includeEbay ? 2000 : 1200, messages: [{ role: 'user', content: [...imgs, { type: 'text', text: prompt }] }] }) });
      data = await res.json();
      if (data.error) throw new Error(data.error.message);
      raw = data.content[0].text.trim().replace(/```json|```/g, '').trim();
    }
    const r=JSON.parse(raw);
    if(r.player)document.getElementById('fieldPlayer').value=r.player;
    if(r.year)document.getElementById('fieldYear').value=r.year;
    if(r.brand)document.getElementById('fieldBrand').value=r.brand;
    if(r.cardNumber)document.getElementById('fieldNumber').value=r.cardNumber;
    if(r.team)document.getElementById('fieldTeam').value=r.team;
    if(r.parallel)document.getElementById('fieldParallel').value=r.parallel;
    if(r.estimatedValue)document.getElementById('fieldValue').value=r.estimatedValue;
    if(r.serialNumber){document.getElementById('fieldSerial').value=r.serialNumber;showToast(`Serial number detected: ${r.serialNumber}`,'success');}
    if(r.ebayTitle||r.ebayDescription)window._lastEbayData={title:r.ebayTitle||'',description:r.ebayDescription||''};
    currentGrade=r.grade||null;
    if(includeGrade&&r.grade)showGrade(r.grade);
    else{document.getElementById('gradeResult').style.display='none';document.getElementById('gradePlaceholder').style.display='block';}
    showToast(`Card analyzed${hasBack?' (front + back)':''}${includeGrade?'':' (no grade)'}${includeEbay?' + eBay desc ready':''}!`,'success');
  }catch(err){showToast('Analysis failed: '+err.message,'error');console.error(err);}
  btn.disabled=false;btn.innerHTML='✦ &nbsp; Analyze with AI';
}

function showGrade(grade){
  document.getElementById('gradePlaceholder').style.display='none';
  document.getElementById('gradeResult').style.display='block';
  const ov=parseFloat(grade.overall),badge=document.getElementById('gradeBadge');
  badge.textContent=`AI Est. ${grade.overall}`;
  badge.className='grade-badge '+(ov>=9?'grade-9':ov>=7?'grade-7':ov>=5?'grade-5':'grade-low');
  document.getElementById('grC').textContent=grade.centering;
  document.getElementById('grCo').textContent=grade.corners;
  document.getElementById('grE').textContent=grade.edges;
  document.getElementById('grS').textContent=grade.surface;
  document.getElementById('gradeRationale').textContent=grade.rationale;
}

function renderTagRow(){const row=document.getElementById('tagRow');row.innerHTML=currentTags.map(t=>`<div class="tag">${t} <span class="tag-x" onclick="removeTag('${t}')">✕</span></div>`).join('')+`<div class="tag-add" onclick="addTag()">+ Add Tag</div>`;}
function addTag(){const t=prompt('Enter tag:');if(t&&t.trim()&&!currentTags.includes(t.trim())){currentTags.push(t.trim());renderTagRow();}}
function removeTag(t){currentTags=currentTags.filter(x=>x!==t);renderTagRow();}


// ─── R2 IMAGE UPLOAD ─────────────────────────────────────────────────────
// Uploads a base64 image to R2 via the worker /upload endpoint
// Returns the public R2 URL or null if upload fails / user not signed in
async function uploadImageToR2(base64Data, cardId) {
  if (!base64Data || !currentUser) return null;
  try {
    const token = getAuthToken();
    if (!token) return null;
    // Convert base64 to blob
    const parts = base64Data.split(',');
    const mimeType = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    const blob = new Blob([array], { type: mimeType });
    const formData = new FormData();
    formData.append('image', blob, cardId + '.jpg');
    formData.append('cardId', String(cardId));
    const r = await fetch(WORKER_URL + '/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });
    if (!r.ok) { console.warn('[R2] Upload failed:', r.status); return null; }
    const d = await r.json();
    return d.url || null;
  } catch (e) {
    console.warn('[R2] Upload error:', e.message);
    return null;
  }
}

function norm(s){return(s||'').trim().toLowerCase();}
function normYear(s){const m=(s||'').match(/(\d{4})/);return m?m[1]:'';}
function normCardNum(s){return(s||'').trim().toLowerCase().replace(/^#/,'').replace(/[\s\-]/g,'');}
function openDupeTipsModal(level){
  window._dupeLevel=level||'possible';
  const title=document.getElementById('icvDupeTitle');
  const sub=document.getElementById('icvDupeSubtitle');
  if(level==='exact'){
    if(title){title.textContent='Duplicate Card Detected';title.style.color='#E74C3C';}
    if(sub)sub.textContent='This appears to be the same physical card scanned twice. Use ICV labels to tell copies apart.';
  } else {
    if(title){title.innerHTML='&#x26A0; Possible Duplicate';title.style.color='var(--gold)';}
    if(sub)sub.textContent='Different parallel or OCR variance detected. Verify manually -- this may be a legitimately different card.';
  }
  document.getElementById('icvDupeTipsModal').classList.add('open');
}
function openXimilarDetail(cardId){
  const c=collection.find(x=>x.id===cardId);if(!c)return;
  const g=c.grades?.ximilar;if(!g||!g.ximilarDetail)return;
  const d=g.ximilarDetail;
  const f=d.front,bk=d.back,comb=d.combined||{};
  const gradeColor=(v)=>v<=6?'#A32D2D':v<=7.5?'#854F0B':'var(--color-text-primary)';
  const gradeBg=(v)=>v<=6?'rgba(226,75,74,0.08)':v<=7.5?'rgba(186,117,23,0.1)':'var(--color-background-secondary)';
  const gradeBorder=(v)=>v<=6?'0.5px solid rgba(226,75,74,0.2)':v<=7.5?'0.5px solid rgba(186,117,23,0.25)':'none';
  const cornerRow=(c)=>`<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 6px;background:${gradeBg(c.grade)};border-radius:3px;border:${gradeBorder(c.grade)};margin-bottom:2px;"><span style="color:var(--color-text-secondary);">${c.name.replace('_',' ').toLowerCase()}</span><span style="font-weight:500;color:${gradeColor(c.grade)};">${c.grade}</span></div>`;
  const edgeRow=(e)=>`<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 6px;background:${gradeBg(e.grade)};border-radius:3px;border:${gradeBorder(e.grade)};margin-bottom:2px;"><span style="color:var(--color-text-secondary);">${e.name.toLowerCase()}</span><span style="font-weight:500;color:${gradeColor(e.grade)};">${e.grade}</span></div>`;
  const imgCol=(img,label)=>img?`
    <div>
      <div style="font-size:11px;font-weight:500;color:var(--color-text-secondary);margin-bottom:8px;padding-bottom:4px;border-bottom:0.5px solid var(--color-border-tertiary);text-transform:uppercase;letter-spacing:0.05em;">${label}</div>
      <div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:2px;">Centering <span style="font-weight:500;color:${gradeColor(img.centering)};float:right;">${img.centering}</span></div>
      <div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:8px;padding-left:6px;">${img.centeringRatio}</div>
      <div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:4px;">Corners</div>
      ${(img.corners||[]).map(cornerRow).join('')}
      <div style="font-size:11px;color:var(--color-text-secondary);margin-top:6px;margin-bottom:4px;">Edges</div>
      ${(img.edges||[]).map(edgeRow).join('')}
      <div style="font-size:11px;color:var(--color-text-secondary);margin-top:6px;margin-bottom:2px;">Surface <span style="font-weight:500;color:${gradeColor(img.surface)};float:right;">${img.surface}</span></div>
      <div style="font-size:10px;color:var(--color-text-secondary);padding-left:6px;">${label} image analyzed</div>
    </div>`:'<div style="font-size:11px;color:var(--color-text-secondary);">Not scanned</div>';
  const weakSpots=[];
  if(f){
    (f.corners||[]).forEach(x=>{if(x.grade<=6.5)weakSpots.push('Front '+x.name.replace('_',' ').toLowerCase()+' corner ('+x.grade+')')});
    (f.edges||[]).forEach(x=>{if(x.grade<=6.5)weakSpots.push('Front '+x.name.toLowerCase()+' edge ('+x.grade+')')});
    if(f.centering<=6.5)weakSpots.push('Front centering off '+f.centeringRatio);
  }
  if(bk){
    (bk.corners||[]).forEach(x=>{if(x.grade<=6.5)weakSpots.push('Back '+x.name.replace('_',' ').toLowerCase()+' corner ('+x.grade+')')});
    (bk.edges||[]).forEach(x=>{if(x.grade<=6.5)weakSpots.push('Back '+x.name.toLowerCase()+' edge ('+x.grade+')')});
    if(bk.centering<=6.5)weakSpots.push('Back centering off '+bk.centeringRatio);
  }
  // Update modal header with final grade
  const hdr=document.getElementById('ximilarDetailHeader');
  if(hdr)hdr.innerHTML=`<span style="font-size:14px;font-weight:500;color:#E1F5EE;">Ximilar — Full Grade Breakdown</span><div style="text-align:right;margin-right:24px;"><div style="font-size:18px;font-weight:500;color:#E1F5EE;">${comb.final??''}</div><div style="font-size:10px;color:#9FE1CB;">${comb.condition||''} · combined</div></div>`;
  document.getElementById('ximilarDetailModal').classList.add('open');
  document.getElementById('ximilarDetailContent').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">
      <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:8px;text-align:center;"><div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:2px;">Centering</div><div style="font-size:20px;font-weight:500;color:${gradeColor(comb.centering)};">${comb.centering??'?'}</div><div style="font-size:10px;color:var(--color-text-secondary);">combined</div></div>
      <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:8px;text-align:center;"><div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:2px;">Corners</div><div style="font-size:20px;font-weight:500;color:${gradeColor(comb.corners)};">${comb.corners??'?'}</div><div style="font-size:10px;color:var(--color-text-secondary);">combined</div></div>
      <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:8px;text-align:center;"><div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:2px;">Edges</div><div style="font-size:20px;font-weight:500;color:${gradeColor(comb.edges)};">${comb.edges??'?'}</div><div style="font-size:10px;color:var(--color-text-secondary);">combined</div></div>
      <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:8px;text-align:center;"><div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:2px;">Surface</div><div style="font-size:20px;font-weight:500;color:${gradeColor(comb.surface)};">${comb.surface??'?'}</div><div style="font-size:10px;color:var(--color-text-secondary);">combined</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      ${imgCol(f,'Front')}${imgCol(bk,'Back')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
      ${f?.autograph?`<div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:8px 10px;"><div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:2px;">Autograph (front)</div><div style="font-size:12px;font-weight:500;color:${f.autograph==='Yes'?'var(--color-text-success)':'var(--color-text-secondary)'};">${f.autograph} · ${Math.round((f.autographProb||0)*100)}%</div></div>`:''}
      ${f?.damaged?`<div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:8px 10px;"><div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:2px;">Damage check</div><div style="font-size:12px;font-weight:500;color:${f.damaged==='OK'?'var(--color-text-success)':'var(--color-text-danger)'};">${f.damaged} · ${Math.round((f.damagedProb||0)*100)}%</div></div>`:''}
    </div>
    ${weakSpots.length>0?`<div style="background:var(--color-background-danger);border:0.5px solid var(--color-border-danger);border-radius:var(--border-radius-md);padding:8px 10px;margin-bottom:10px;"><div style="font-size:11px;font-weight:500;color:var(--color-text-danger);margin-bottom:2px;">Weak spots</div><div style="font-size:11px;color:var(--color-text-secondary);">${weakSpots.join(', ')}</div></div>`:''}
    <div style="padding-top:10px;border-top:0.5px solid var(--color-border-tertiary);font-size:11px;color:var(--color-text-secondary);">Combined final grade uses geometric mean across ${bk?'front and back':'front only'} images.</div>
  `;
}
function checkForDuplicates(card){
  // Serial # match -- same serial = definitely same physical card scanned twice
  if(card.serialNumber){
    const exact=collection.filter(c=>c.id!==card.id&&c.serialNumber&&c.serialNumber===card.serialNumber);
    return {exact,possible:[]};
  }
  // Cert # match -- same cert = same graded slab scanned twice
  if(card.certNumber){
    const exact=collection.filter(c=>c.id!==card.id&&c.certNumber&&c.certNumber===card.certNumber);
    return {exact,possible:[]};
  }
  // Raw card -- level 1: all key fields match exactly
  const exact=collection.filter(c=>
    c.id!==card.id&&!c.serialNumber&&!c.certNumber&&
    norm(c.player)===norm(card.player)&&
    normYear(c.year)===normYear(card.year)&&
    norm(c.brand)===norm(card.brand)&&
    normCardNum(c.cardNumber)===normCardNum(card.cardNumber)&&
    norm(c.parallel||'Base')===norm(card.parallel||'Base')
  );
  // Level 2: player + year + brand (fuzzy) + cardNumber match, but something else differs
  const exactIds=new Set(exact.map(c=>c.id));
  const brandMatch=(a,b)=>{const na=norm(a),nb=norm(b);return na===nb||na.includes(nb)||nb.includes(na);};
  const possible=collection.filter(c=>
    c.id!==card.id&&!c.serialNumber&&!c.certNumber&&!exactIds.has(c.id)&&
    norm(c.player)===norm(card.player)&&
    normYear(c.year)===normYear(card.year)&&
    brandMatch(c.brand,card.brand)&&
    normCardNum(c.cardNumber)===normCardNum(card.cardNumber)
  );
  return {exact,possible};
}
async function saveCard(){
  const player=document.getElementById('fieldPlayer').value.trim();
  if(!player){showToast('Please analyze a card first','error');return;}
  const cardId=Date.now();
  const estimatedValueAtScan = document.getElementById('fieldValue').value;
  // Normalize images to 1280px JPEG before saving -- prevents localStorage quota errors on large camera photos
  const _normFront = currentImageData ? await normalizeImageToJpeg(currentImageData) : null;
  const _normBack = currentBackImageData ? await normalizeImageToJpeg(currentBackImageData) : null;
  // Build card immediately with base64 imageData -- R2 uploads happen in background
  const card={id:cardId,player,year:document.getElementById('fieldYear').value,brand:document.getElementById('fieldBrand').value,notes:null,cardNumber:document.getElementById('fieldNumber').value,serialNumber:document.getElementById('fieldSerial').value||null,team:document.getElementById('fieldTeam').value,parallel:document.getElementById('fieldParallel').value||'Base',estimatedValue:estimatedValueAtScan,collection:document.getElementById('fieldCollection').value,tags:[...currentTags],grade:currentGrade,aiGraded:!!currentGrade,grades:currentGrade?{[_scanModel]:Object.assign({},currentGrade,{gradedAt:new Date().toISOString(),source:_scanModel})}:{},imageUrl:null,imageUrlBack:null,imageData:_normFront,imageDataBack:_normBack||null,listedOnEbay:false,ebayListingId:null,addedAt:new Date().toISOString(),
    valueHistory: estimatedValueAtScan ? [{ value: estimatedValueAtScan, date: new Date().toISOString(), source: 'scan' }] : []
  };
  // Save to localStorage and reset UI immediately -- card appears instantly
  collection.push(card);localStorage.setItem('iceVault_cards',JSON.stringify(collection));
  updateHeaderStats();showToast(`"${player}" saved!`,'success');
  // Check for duplicates after save
  setTimeout(()=>{
    const {exact,possible}=checkForDuplicates(card);
    if(exact.length>0){
      showToast(`Duplicate detected -- ${exact.length} identical cop${exact.length===1?'y':'ies'} in collection`,'error');
      setTimeout(()=>{openDupeTipsModal('exact');},1500);
    } else if(possible.length>0){
      showToast(`Possible duplicate -- ${possible.length} similar card${possible.length===1?'':'s'} found, verify details`,'error');
      setTimeout(()=>{openDupeTipsModal('possible');},1500);
    }
  },500);
  document.getElementById('previewBox').innerHTML='<div class="preview-placeholder"><div style="font-size:32px;">🏒</div></div>';
  document.getElementById('analyzeBtn').disabled=true;document.getElementById('clearBtn').classList.remove('visible');
  resetFields();currentImageData=null;currentBackImageData=null;document.getElementById('fileInput').value='';document.getElementById('fileInputBack').value='';
  document.getElementById('previewBoxBack').innerHTML='<div class="preview-placeholder"><div style="font-size:24px;margin-bottom:4px;">&#x1F504;</div><div style="font-size:11px;">Back</div></div>';
  // Upload images to R2 in background -- update card with imageUrl when complete
  if(currentUser){
    const frontData=card.imageData;
    const backData=card.imageDataBack;
    Promise.all([
      uploadImageToR2(frontData,cardId),
      backData?uploadImageToR2(backData,cardId+'_back'):Promise.resolve(null)
    ]).then(([imageUrl,imageUrlBack])=>{
      if(imageUrl){card.imageUrl=imageUrl;card.imageData=null;}
      if(imageUrlBack){card.imageUrlBack=imageUrlBack;card.imageDataBack=null;}
      localStorage.setItem('iceVault_cards',JSON.stringify(collection));
      return syncCardToCloud(card);
    }).then(res=>{
      if(res&&res.ok){card.iceVaultId=res.ok;localStorage.setItem('iceVault_cards',JSON.stringify(collection));}
    }).catch(e=>{console.warn('[saveCard] Background upload/sync failed:',e.message);});
  }
}

let activeTagFilter=null;

function renderCardItemHtml(c){
  return `
    <div class="card-item ${c.listedOnEbay?'listed':''}${bulkSelectMode&&selectedCardIds.has(c.id)?' selected':''}" data-id="${c.id}" onclick="${bulkSelectMode?`toggleCardSelect(${c.id},event)`:`openCardDetail(${c.id})`}" style="${bulkSelectMode&&selectedCardIds.has(c.id)?'border-color:var(--gold);':c.listedOnEbay?'':''}cursor:pointer;">
      ${bulkSelectMode?`<input type="checkbox" id="cardCheck_${c.id}" ${selectedCardIds.has(c.id)?'checked':''} onclick="toggleCardSelect(${c.id},event)" style="position:absolute;top:8px;left:8px;width:18px;height:18px;cursor:pointer;z-index:2;accent-color:var(--gold);">`:''}
      ${c.listedOnEbay?'<div class="ebay-indicator">eBay</div>':''}
      <div class="card-thumb">${(c.imageUrl||c.imageData)?`<img src="${c.imageUrl||c.imageData}" alt="${c.player}">`:'🏒'}</div>
      <div class="card-info">
        <div class="card-player">${c.player}</div>
        <div class="card-meta">${c.year||''} ${c.brand||''}</div>
        ${c.tags&&c.tags.length?`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;">${c.tags.map(t=>`<span style="padding:1px 6px;background:rgba(74,156,201,0.12);border:1px solid rgba(74,156,201,0.25);border-radius:10px;font-size:10px;color:var(--ice-dark);">${t}</span>`).join('')}</div>`:''}
        <div class="card-bottom">
          ${c.grade?`<span class="card-grade-mini grade-${gradeClass(c.grade.overall)}">${c.aiGraded?'AI Est. ':(c.certGrader||'PSA')+' '}${c.grade.overall}</span>`:'<span></span>'}
          <span class="card-status ${c.sold?'sold':c.listedOnEbay?'listed':''}">${c.sold?'● Sold $'+c.soldPrice:c.listedOnEbay?'● Listed':c.estimatedValue?'$'+c.estimatedValue:''}</span>
        </div>
      </div>
    </div>`;
}

function renderGridFromCollection(){
  const grid=document.getElementById('cardsGrid');
  if(collection.length===0){
    grid.innerHTML=`<div class="empty-state"><div class="empty-state-icon">🏒</div><div class="empty-state-text">${currentPage>1?'No cards on this page':'No cards match your filters'}</div></div>`;
    return;
  }
  grid.innerHTML=collection.map(c=>renderCardItemHtml(c)).join('');
}

function renderPaginationBar(){
  const bar=document.getElementById('paginationBar');
  // Always update results count
  const rc=document.getElementById('resultsCount');
  const rcCount=isServerPaginated?totalCards:collection.length;
  if(rc)rc.textContent=rcCount===1?'Showing 1 result':'Showing '+rcCount+' results';
  if(!isServerPaginated||totalPages<=1){bar.style.display='none';return;}
  bar.style.display='flex';
  const pages=[];
  // Always show first, last, current, and 2 around current
  const show=new Set([1,totalPages,currentPage,currentPage-1,currentPage+1,currentPage-2,currentPage+2].filter(p=>p>=1&&p<=totalPages));
  const sorted=[...show].sort((a,b)=>a-b);
  let html='';
  html+=`<button class="page-btn" onclick="goToPage(${currentPage-1})" ${currentPage===1?'disabled':''}>←</button>`;
  let prev=0;
  for(const p of sorted){
    if(prev&&p>prev+1)html+=`<span class="page-ellipsis">…</span>`;
    html+=`<button class="page-btn${p===currentPage?' active':''}" onclick="goToPage(${p})">${p}</button>`;
    prev=p;
  }
  html+=`<button class="page-btn" onclick="goToPage(${currentPage+1})" ${currentPage===totalPages?'disabled':''}>→</button>`;
  html+=`<span style="font-size:11px;color:var(--text-muted);margin-left:8px;">${totalCards} cards</span>`;
  bar.innerHTML=html;
}

function goToPage(page){
  if(page<1||page>totalPages||page===currentPage)return;
  fetchFilteredPage(page);
  // Scroll to top of collection
  document.getElementById('view-collection').scrollIntoView({behavior:'smooth'});
}

function toggleBulkSelect() {
  bulkSelectMode = !bulkSelectMode;
  selectedCardIds.clear();
  const btn = document.getElementById('bulkSelectBtn');
  const bar = document.getElementById('bulkActionBar');
  if (btn) btn.style.background = bulkSelectMode ? 'rgba(201,162,39,0.15)' : '';
  if (btn) btn.style.borderColor = bulkSelectMode ? 'var(--gold)' : '';
  if (btn) btn.style.color = bulkSelectMode ? 'var(--gold)' : '';
  if (bar) bar.style.display = bulkSelectMode ? 'flex' : 'none';
  updateBulkCount();
  renderCollection();
}

function updateBulkCount() {
  const el = document.getElementById('bulkCount');
  if (el) el.textContent = selectedCardIds.size + ' selected';
}

function toggleCardSelect(id, e) {
  e.stopPropagation();
  if (selectedCardIds.has(id)) selectedCardIds.delete(id);
  else selectedCardIds.add(id);
  updateBulkCount();
  // Update card appearance
  const card = document.querySelector('.card-item[data-id="' + id + '"]');
  if (card) card.style.borderColor = selectedCardIds.has(id) ? 'var(--gold)' : '';
  const cb = document.getElementById('cardCheck_' + id);
  if (cb) cb.checked = selectedCardIds.has(id);
}

function bulkSelectAll() {
  const visibleCards = document.querySelectorAll('.card-item[data-id]');
  visibleCards.forEach(c => selectedCardIds.add(parseInt(c.dataset.id)));
  updateBulkCount();
  visibleCards.forEach(c => {
    c.style.borderColor = 'var(--gold)';
    const cb = document.getElementById('cardCheck_' + c.dataset.id);
    if (cb) cb.checked = true;
  });
}

function bulkClearAll() {
  selectedCardIds.clear();
  updateBulkCount();
  document.querySelectorAll('.card-item[data-id]').forEach(c => {
    c.style.borderColor = '';
    const cb = document.getElementById('cardCheck_' + c.dataset.id);
    if (cb) cb.checked = false;
  });
}

function bulkMove(col) {
  if (!col || selectedCardIds.size === 0) return;
  if (!confirm('Move ' + selectedCardIds.size + ' card(s) to ' + col + '?')) return;
  selectedCardIds.forEach(id => {
    const c = collection.find(x => x.id === id);
    if (c) { c.collection = col; if (currentUser) syncCardToCloud(c); }
  });
  localStorage.setItem('iceVault_cards', JSON.stringify(collection));
  showToast('Moved ' + selectedCardIds.size + ' card(s) to ' + col, 'success');
  selectedCardIds.clear();
  updateBulkCount();
  renderCollection();
}

function bulkDelete() {
  if (selectedCardIds.size === 0) return;
  if (!confirm('Delete ' + selectedCardIds.size + ' card(s)? This cannot be undone.')) return;
  selectedCardIds.forEach(id => {
    collection = collection.filter(c => c.id !== id);
    if (currentUser) deleteCardFromCloud(id);
  });
  localStorage.setItem('iceVault_cards', JSON.stringify(collection));
  showToast('Deleted ' + selectedCardIds.size + ' card(s)', 'success');
  selectedCardIds.clear();
  updateBulkCount();
  renderCollection();
}

function bulkExport() {
  if (selectedCardIds.size === 0) { showToast('Select cards first', 'error'); return; }
  const selected = collection.filter(c => selectedCardIds.has(c.id));
  const headers = ['Player','Year','Brand','Card Number','Team','Parallel','Serial Number','Estimated Value','Collection','Tags','AI Graded','Grade Overall','Centering','Corners','Edges','Surface','Grade Rationale','Cert Number','Cert Grader','Official Grade','Listed on eBay','Date Added','Notes','IceVault ID'];
  const esc = v => { if(v===null||v===undefined)return''; const s=String(v); if(s.includes(',')||s.includes('"')||s.includes('\n'))return'"'+s.replace(/"/g,'""')+'"'; return s; };
  const rows = selected.map(c => [c.player,c.year,c.brand,c.cardNumber,c.team,c.parallel,c.serialNumber||'',c.estimatedValue,c.collection,(c.tags||[]).join('; '),c.aiGraded?'Yes':'No',c.grade?.overall||'',c.grade?.centering||'',c.grade?.corners||'',c.grade?.edges||'',c.grade?.surface||'',c.grade?.rationale||'',c.certNumber||'',c.certGrader||'',c.officialGrade||'',c.listedOnEbay?'Yes':'No',c.addedAt?new Date(c.addedAt).toLocaleDateString():'',c.notes||''].map(esc).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const date = new Date().toISOString().split('T')[0];
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'icevault-selected-' + date + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Exported ' + selected.length + ' cards', 'success');
}

function renderCollection(){
  updateHeaderStats();
  renderTagFilterRow();
  if(isServerPaginated&&currentUser){
    renderGridFromCollection();
    renderPaginationBar();
  } else {
    _renderFilteredLocal();
  }
}
function getAllTags(){const t=new Set();collection.forEach(c=>(c.tags||[]).forEach(t2=>t.add(t2)));return[...t].sort();}
function renderTagFilterRow(){
  const allT=getAllTags(),row=document.getElementById('tagFilterRow');
  if(allT.length===0){row.style.display='none';return;}
  row.style.display='flex';
  row.innerHTML=`<span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;align-self:center;">Tags:</span>
    <div class="tag" onclick="setTagFilter(null)" style="${!activeTagFilter?'background:rgba(74,156,201,0.25);border-color:var(--ice-dark);':''}">All</div>
    ${allT.map(t=>`<div class="tag" onclick="setTagFilter('${t}')" style="${activeTagFilter===t?'background:rgba(74,156,201,0.25);border-color:var(--ice-dark);':''}">${t}</div>`).join('')}`;
}
function setTagFilter(tag){activeTagFilter=tag;renderTagFilterRow();filterCards();}

let _filterDebounce=null;
function filterCards(){
  if(isServerPaginated&&currentUser){
    // Debounce server requests
    clearTimeout(_filterDebounce);
    _filterDebounce=setTimeout(()=>fetchFilteredPage(1),300);
    return;
  }
  // Guest mode — local filter
  _renderFilteredLocal();
}

async function fetchFilteredPage(page){
  const search=(document.getElementById('searchInput').value||'').trim();
  const col=document.getElementById('collectionFilter').value;
  const sort=document.getElementById('sortSelect').value;
  const gradeF=document.getElementById('gradeFilter')?.value||'';
  const valueF=document.getElementById('valueFilter')?.value||'';
  const dateF=document.getElementById('dateFilter')?.value||'';
  const params={};
  if(search)params.search=search;
  if(col)params.collection=col;
  if(sort)params.sort=sort;
  if(gradeF)params.grade=gradeF;
  if(valueF)params.value=valueF;
  if(dateF)params.date=dateF;
  await syncCollectionFromCloud(page||currentPage,params);
  renderGridFromCollection();
  renderPaginationBar();
}

function _renderFilteredLocal(){
  const search=(document.getElementById('searchInput').value||'').toLowerCase();
  const col=document.getElementById('collectionFilter').value;
  const status=document.getElementById('statusFilter').value;
  const sort=document.getElementById('sortSelect').value;
  const gradeFilter=document.getElementById('gradeFilter')?.value||'';
  const valueFilter=document.getElementById('valueFilter')?.value||'';
  const dateFilter=document.getElementById('dateFilter')?.value||'';
  let filtered=collection.filter(c=>{
    const ms=!search||c.player.toLowerCase().includes(search)||(c.brand||'').toLowerCase().includes(search)||(c.year||'').includes(search)||(c.team||'').toLowerCase().includes(search)||(c.tags||[]).some(t=>t.toLowerCase().includes(search))||(c.notes||'').toLowerCase().includes(search);
    const mc=!col||c.collection===col;
    // Hide sold cards by default unless explicitly filtering for Sold
    const mSold=col==='Sold'?c.sold===true:(c.sold?false:true);
    const mst=!status||(status==='listed'?c.listedOnEbay:!c.listedOnEbay);
    const mt=!activeTagFilter||(c.tags||[]).includes(activeTagFilter);
    // Grade filter
    const g=parseFloat(c.grade?.overall)||0;
    const mg=!gradeFilter||(gradeFilter==='9'?g>=9:gradeFilter==='8'?g>=8:gradeFilter==='7'?g>=7:gradeFilter==='sub7'?g>0&&g<7:true);
    // Value filter
    const v=parseFloat(c.estimatedValue)||0;
    const mv=!valueFilter||(valueFilter==='0-25'?v<25:valueFilter==='25-100'?v>=25&&v<100:valueFilter==='100-500'?v>=100&&v<500:valueFilter==='500+'?v>=500:true);
    // Date filter
    const daysAgo=dateFilter?Math.floor((Date.now()-new Date(c.addedAt))/(1000*60*60*24)):0;
    const md=!dateFilter||daysAgo<=parseInt(dateFilter);
    return ms&&mc&&mSold&&mst&&mt&&mg&&mv&&md;
  });
  filtered.sort((a,b)=>{
    switch(sort){
      case 'date-asc':return new Date(a.addedAt)-new Date(b.addedAt);
      case 'player-asc':return(a.player||'').localeCompare(b.player||'');
      case 'player-desc':return(b.player||'').localeCompare(a.player||'');
      case 'value-desc':return(parseFloat(b.estimatedValue)||0)-(parseFloat(a.estimatedValue)||0);
      case 'value-asc':return(parseFloat(a.estimatedValue)||0)-(parseFloat(b.estimatedValue)||0);
      case 'grade-desc':return(parseFloat(b.grade?.overall)||0)-(parseFloat(a.grade?.overall)||0);
      case 'grade-asc':return(parseFloat(a.grade?.overall)||0)-(parseFloat(b.grade?.overall)||0);
      default:return new Date(b.addedAt)-new Date(a.addedAt);
    }
  });
  const grid=document.getElementById('cardsGrid');
  if(filtered.length===0){grid.innerHTML=`<div class="empty-state"><div class="empty-state-icon">🏒</div><div class="empty-state-text">No cards match your filters</div></div>`;return;}
  grid.innerHTML=filtered.map(c=>renderCardItemHtml(c)).join('');
  document.getElementById('paginationBar').style.display='none';
  const rcEl=document.getElementById('resultsCount');
  if(rcEl)rcEl.textContent=filtered.length===1?'Showing 1 result':'Showing '+filtered.length+' results';
}

function gradeClass(g){const n=parseFloat(g);if(n>=9)return'9';if(n>=7)return'7';if(n>=5)return'5';return'low';}

function buildSharePriceHtml(c) {
  const id = c.id;
  const chk = c.sharePrice ? 'checked' : '';
  const showOpts = c.sharePrice ? 'block' : 'none';
  const aiChk = (!c.sharePriceType || c.sharePriceType === 'ai') ? 'checked' : '';
  const ownChk = c.sharePriceType === 'owner' ? 'checked' : '';
  const showOwn = c.sharePriceType === 'owner' ? 'flex' : 'none';
  const aiPrice = c.estimatedValue || '?';
  const ownPrice = c.ownerPrice || '';
  return [
    '<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:10px;">',
    '<div class="result-label" style="margin-bottom:6px;">Shared View Pricing</div>',
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text-secondary);margin-bottom:8px;">',
    '<input type="checkbox" id="sharePriceCheck_' + id + '" ' + chk + ' onchange="updateCardSharePrice(' + id + ')" style="width:16px;height:16px;cursor:pointer;">',
    '<span>Show price on shared collection view</span></label>',
    '<div id="sharePriceOptions_' + id + '" style="display:' + showOpts + ';margin-left:24px;">',
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text-secondary);margin-bottom:6px;">',
    '<input type="radio" name="sharePriceType_' + id + '" value="ai" ' + aiChk + ' onchange="updateCardSharePriceType(' + id + ',\'ai\')" style="cursor:pointer;">',
    'AI Estimated \u2014 $' + aiPrice + ' <span style="color:var(--text-muted);font-size:10px;">(labeled AI Est.)</span></label>',
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text-secondary);margin-bottom:6px;">',
    '<input type="radio" name="sharePriceType_' + id + '" value="owner" ' + ownChk + ' onchange="updateCardSharePriceType(' + id + ',\'owner\')" style="cursor:pointer;">',
    'My Price <span style="color:var(--text-muted);font-size:10px;">(labeled Owner&#39;s Price)</span></label>',
    '<div id="ownerPriceRow_' + id + '" style="display:' + showOwn + ';gap:6px;align-items:center;margin-top:4px;">',
    '<span style="font-size:12px;color:var(--text-muted);">$</span>',
    '<input type="number" class="result-input" id="ownerPriceInput_' + id + '" value="' + ownPrice + '" placeholder="0.00" step="0.01" style="width:100px;font-size:13px;" onchange="updateCardOwnerPrice(' + id + ',this.value)">',
    '</div>',
    '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">&#8629; Press Enter or click away to save</div>',
    '</div></div>'
  ].join('');
}

function openCardDetail(id){
  const c=collection.find(x=>x.id===id);if(!c)return;
  const _front=c.imageUrl||c.imageData||null;
  const _back=c.imageUrlBack||c.imageDataBack||null;
  // Build grade matrix — shows all AI sources, tabs per source
  const grades = c.grades || {};
  const claudeGrade = grades.claude || (c.aiGraded && c.grade ? c.grade : null);
  const gpt4oGrade = grades.gpt4o || null;
  const geminiGrade = grades.gemini || null;
  const ximilarGrade = grades.ximilar || null;
  const hasAnyGrade = claudeGrade || gpt4oGrade || geminiGrade || ximilarGrade;
  const cardId = c.id;

  function gradeMatrixCellHtml(label, g) {
    return `<div class="grade-matrix-cell"><div class="grade-matrix-cell-label">${label}</div><div class="grade-matrix-cell-val${g?'':' pending'}">${g?g.overall:'—'}</div></div>`;
  }

  const gradeHtml = `<div class="grade-box" style="margin-top:10px;" id="gradeMatrix_${cardId}">
    <div class="grade-matrix-summary">
      ${gradeMatrixCellHtml('Claude', claudeGrade)}
      ${gradeMatrixCellHtml('GPT-4o', gpt4oGrade)}
      ${gradeMatrixCellHtml('Gemini', geminiGrade)}
      ${gradeMatrixCellHtml('Ximilar', ximilarGrade)}
    </div>
    <div class="grade-matrix-tabs">
      <button class="grade-matrix-tab${claudeGrade?' has-grade':''} active" onclick="switchGradeTab(${cardId},'claude',this)">Claude</button>
      <button class="grade-matrix-tab${gpt4oGrade?' has-grade':' coming-soon'}" onclick="switchGradeTab(${cardId},'gpt4o',this)">GPT-4o</button>
      <button class="grade-matrix-tab${geminiGrade?' has-grade':' coming-soon'}" onclick="switchGradeTab(${cardId},'gemini',this)">Gemini</button>
      <button class="grade-matrix-tab${ximilarGrade?' has-grade':' coming-soon'}" onclick="switchGradeTab(${cardId},'ximilar',this)">Ximilar</button>
    </div>
    <div id="gradeTabContent_${cardId}">
      ${renderGradeTabContent(cardId, 'claude', claudeGrade)}
    </div>
  </div>`;
  const tagsHtml=`<div style="margin-top:10px;"><div class="result-label">Tags</div><div id="modalTagRow" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">${(c.tags||[]).map(t=>`<div class="tag">${t} <span class="tag-x" onclick="removeModalTag(${c.id},'${t}')">✕</span></div>`).join('')}<div class="tag-add" onclick="addModalTag(${c.id})">+ Add Tag</div></div></div>`;
  const sharePriceHtml = buildSharePriceHtml(c);
    const colHtml=`<div style="margin-top:8px;"><div class="result-label">Collection</div><select class="result-select" onchange="updateCardCollection(${c.id},this.value)"><option value="Personal" ${c.collection==='Personal'?'selected':''}>Personal Collection</option><option value="For Sale" ${c.collection==='For Sale'?'selected':''}>For Sale</option><option value="Trade" ${c.collection==='Trade'?'selected':''}>Trade Binder</option><option value="Graded" ${c.collection==='Graded'?'selected':''}>Graded Cards</option><option value="Wishlist" ${c.collection==='Wishlist'?'selected':''}>Wishlist</option><option value="Private" ${c.collection==='Private'?'selected':''}>Private Collection</option><option value="EbayQueue" ${c.collection==='EbayQueue'?'selected':''}>eBay Queue</option><option value="Sold" ${c.collection==='Sold'?'selected':''}>Sold</option></select></div>`;
  const notesHtml = '<div style="margin-top:10px;"><div class="result-label">Notes</div>'
    + '<div id="cardNotesDisplay_' + c.id + '" style="min-height:32px;padding:6px 0;font-size:13px;color:' + (c.notes ? 'var(--text-primary)' : 'var(--text-muted)') + ';cursor:pointer;border-radius:4px;" onclick="editCardNotes(' + c.id + ')" title="Click to edit">' + (c.notes || '<span style="opacity:0.5">Add notes...</span>') + '</div>'
    + '<div id="cardNotesEdit_' + c.id + '" style="display:none;"><textarea id="cardNotesInput_' + c.id + '" class="result-input" rows="3" style="width:100%;resize:vertical;font-size:13px;" placeholder="Condition notes, purchase info, storage location...">' + (c.notes || '') + '</textarea>'
    + '<div style="display:flex;gap:6px;margin-top:4px;"><button onclick="saveCardNotes(' + c.id + ')" style="padding:4px 12px;background:var(--ice-dark);border:none;border-radius:5px;color:white;font-size:12px;cursor:pointer;">Save</button>'
    + '<button onclick="cancelCardNotes(' + c.id + ')" style="padding:4px 10px;background:transparent;border:1px solid var(--border-bright);border-radius:5px;color:var(--text-muted);font-size:12px;cursor:pointer;">Cancel</button></div></div></div>';
  document.getElementById('modalContent').innerHTML=`<div class="modal-player">${c.player}</div><div class="modal-meta">${c.year||''} · ${c.brand||''} · ${c.team||''}</div><div class="modal-grid"><div>${(c.imageUrl||c.imageData)?`<img class="modal-img" src="${c.imageUrl||c.imageData}" alt="${c.player}" data-cap="${c.player}" onclick="openLightbox(this.src,this.dataset.cap)" style="cursor:zoom-in;" title="Click to enlarge">`:'<div class="modal-img-placeholder">🏒</div>'}${_back?`<img class="modal-img" src="${_back}" alt="${c.player} back" data-cap="${c.player} Back" onclick="openLightbox(this.src,this.dataset.cap)" style="cursor:zoom-in;margin-top:8px;opacity:0.9;" title="Click to enlarge back">`:''}</div><div>
  <div class="detail-row"><span class="detail-key">Player</span><span class="detail-val editable-val" onclick="editCardField(${c.id},'player',this)">${c.player||'—'}<span class="edit-hint" title="Click to edit">✎</span></span></div>
  <div class="detail-row"><span class="detail-key">Year</span><span class="detail-val editable-val" onclick="editCardField(${c.id},'year',this)">${c.year||'—'}<span class="edit-hint" title="Click to edit">✎</span></span></div>
  <div class="detail-row"><span class="detail-key">Brand / Set</span><span class="detail-val editable-val" onclick="editCardField(${c.id},'brand',this)">${c.brand||'—'}<span class="edit-hint" title="Click to edit">✎</span></span></div>
  <div class="detail-row"><span class="detail-key">Team</span><span class="detail-val editable-val" onclick="editCardField(${c.id},'team',this)">${c.team||'—'}<span class="edit-hint" title="Click to edit">✎</span></span></div>
  <div class="detail-row"><span class="detail-key">Card #</span><span class="detail-val editable-val" onclick="editCardField(${c.id},'cardNumber',this)">${c.cardNumber||'—'}<span class="edit-hint" title="Click to edit">✎</span></span></div>
  <div class="detail-row"><span class="detail-key">Parallel</span><span class="detail-val editable-val" onclick="editCardField(${c.id},'parallel',this)">${c.parallel||'Base'}<span class="edit-hint" title="Click to edit">✎</span></span></div>
  <div class="detail-row"><span class="detail-key">Serial #</span><span class="detail-val editable-val" onclick="editCardField(${c.id},'serialNumber',this)" ${c.serialNumber?'style="color:var(--gold);font-weight:600;"':''}>${c.serialNumber||'—'}<span class="edit-hint" title="Click to edit">✎</span></span></div>
  <div class="detail-row"><span class="detail-key">Est. Value</span><span class="detail-val editable-val" onclick="editCardField(${c.id},'estimatedValue',this)">${c.estimatedValue?'$'+c.estimatedValue:'—'}<span class="edit-hint" title="Click to edit">✎</span></span></div>
  <div id="editSaveHint_${c.id}" class="edit-save-hint">↵ Enter or click away to save &nbsp;·&nbsp; Esc to cancel</div>
  ${c.iceVaultId ? '<div class="detail-row"><span class="detail-key">IceVault ID</span><span class="detail-val" style="font-family:monospace;color:var(--ice-dark);font-size:12px;">ICV-'+String(c.iceVaultId).padStart(6,'0')+'</span></div>' : ''}
  ${(()=>{const {exact,possible}=checkForDuplicates(c);if(exact.length===0&&possible.length===0)return '';const exactLinks=exact.map(d=>`<span onclick="closeModal('cardModal');setTimeout(()=>openCardDetail(${d.id}),100)" style="color:#E74C3C;cursor:pointer;text-decoration:underline;" title="Exact duplicate -- same physical card">ICV-${String(d.iceVaultId||0).padStart(6,'0')} <span style="font-size:9px;background:rgba(192,57,43,0.15);border-radius:3px;padding:1px 4px;color:#E74C3C;">exact</span></span>`).join(', ');const possLinks=possible.map(d=>`<span onclick="closeModal('cardModal');setTimeout(()=>openCardDetail(${d.id}),100)" style="color:var(--gold);cursor:pointer;text-decoration:underline;" title="Possible duplicate -- verify manually">ICV-${String(d.iceVaultId||0).padStart(6,'0')} <span style="font-size:9px;background:rgba(201,162,39,0.15);border-radius:3px;padding:1px 4px;color:var(--gold);">check</span></span>`).join(', ');const allLinks=[exactLinks,possLinks].filter(Boolean).join(', ');return `<div class="detail-row" style="background:rgba(201,162,39,0.08);border-radius:6px;padding:6px 10px;margin:4px 0;"><span class="detail-key" style="color:var(--gold);">Other copies</span><span class="detail-val" style="font-size:12px;">${allLinks} &nbsp;<span onclick="openDupeTipsModal(this.dataset.level)" data-level="${exact.length>0?'exact':'possible'}" style="color:var(--text-muted);cursor:pointer;font-size:11px;">(label tips)</span></span></div>`;})()}
  ${c.certGrader?`<div class="detail-row"><span class="detail-key">Grader</span><span class="detail-val" style="color:var(--gold);font-weight:600;">${c.certGrader}</span></div>`:''}
  ${c.certNumber?`<div class="detail-row"><span class="detail-key">Cert #</span><span class="detail-val" style="color:var(--gold);">${c.certNumber} <a href="${c.registryUrl||'#'}" target="_blank" style="color:var(--ice-dark);font-size:11px;">Verify ↗</a></span></div>`:''}
  ${c.officialGrade?`<div class="detail-row"><span class="detail-key">Official Grade</span><span class="detail-val" style="color:var(--gold);font-weight:600;">${c.officialGrade}</span></div>`:''}
  <div class="detail-row"><span class="detail-key">eBay Status</span><span class="detail-val" style="color:${c.listedOnEbay?'var(--green)':'var(--text-muted)'}">${c.listedOnEbay?'● Listed':'Not listed'}</span></div>
  <div class="detail-row"><span class="detail-key">Added</span><span class="detail-val">${new Date(c.addedAt).toLocaleDateString()}</span></div>
  ${notesHtml}${tagsHtml}${colHtml}${sharePriceHtml}${gradeHtml}</div></div><div class="modal-actions"><button class="modal-action-btn primary" onclick="listOnEbayFromModal(${c.id})">🛒 List on eBay</button>${c.listedOnEbay?`<button class="modal-action-btn" style="background:rgba(201,162,39,0.1);border-color:rgba(201,162,39,0.4);color:var(--gold);" onclick="resetListingStatus(${c.id})">&#x21BA; Reset eBay Listing</button>`:''}${c.sold?`<button class="modal-action-btn" style="background:rgba(192,57,43,0.1);border-color:rgba(192,57,43,0.4);color:#E74C3C;" onclick="undoSold(${c.id})">↩ Undo Sale</button>`:`<button class="modal-action-btn" style="background:rgba(39,174,96,0.12);border-color:rgba(39,174,96,0.4);color:var(--green);" onclick="markAsSold(${c.id})">✓ Mark as Sold</button>`}<button class="modal-action-btn" onclick="deleteCard(${c.id})">🗑 Delete</button></div>${c.sold?`<div style="margin-top:10px;padding:10px 14px;background:rgba(39,174,96,0.08);border:1px solid rgba(39,174,96,0.25);border-radius:8px;font-size:13px;color:var(--green);">✓ Sold for <strong>$${c.soldPrice}</strong> on ${new Date(c.soldAt).toLocaleDateString()}</div>`:''}<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:12px;">
  ${c.imageUrl?`<div class="rescan-section">
    <div class="rescan-controls">
      <button class="rescan-trigger-btn" id="rescanBtn_${c.id}" onclick="triggerRescan(${c.id})">↺ Re-scan card with AI</button>
      <span style="font-size:11px;color:var(--text-muted);">Model:</span>
      <button class="grader-btn active" id="rescanModelClaude_${c.id}" onclick="setRescanModel(${c.id},'claude',this)" style="padding:4px 10px;font-size:11px;">Claude</button>
      <button class="grader-btn" id="rescanModelGpt4o_${c.id}" onclick="setRescanModel(${c.id},'gpt4o',this)" style="padding:4px 10px;font-size:11px;">GPT-4o</button>
      <button class="grader-btn" id="rescanModelGemini_${c.id}" onclick="setRescanModel(${c.id},'gemini',this)" style="padding:4px 10px;font-size:11px;">Gemini</button>
      <span class="rescan-cost" id="rescanCost_${c.id}">⚠ ~$0.01–0.03 (paid) or free (Gemini)</span>
    </div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">⚠ Prices are estimates. Set spend limits on your AI account. Ice Vault is not responsible for AI costs.</div>
    <div id="rescanReview_${c.id}" style="display:none;"></div>
  </div><div style="height:10px;"></div>`:''}
  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Market Research</div><div style="display:flex;gap:8px;flex-wrap:wrap;"><a href="${ebaySearchUrl(c)}" target="_blank" class="modal-action-btn" style="text-decoration:none;flex:1;background:rgba(0,100,210,0.1);border-color:rgba(0,100,210,0.4);color:#4A9CC9;justify-content:center;">🔍 eBay Sold Listings</a><button onclick="open130point(collection.find(x=>x.id===${c.id}))" class="modal-action-btn" style="flex:1;background:rgba(39,174,96,0.1);border-color:rgba(39,174,96,0.4);color:#27AE60;justify-content:center;">📈 130point</button></div></div>`;

  // Wire up rescan model picker cost hints
  setTimeout(() => {
    // cost hints already set via setRescanModel
  }, 50);
  document.getElementById('cardModal').classList.add('open');
}

function addModalTag(id){const t=prompt('Enter tag:');if(!t||!t.trim())return;const c=collection.find(x=>x.id===id);if(!c)return;if(!c.tags)c.tags=[];if(!c.tags.includes(t.trim())){c.tags.push(t.trim());localStorage.setItem('iceVault_cards',JSON.stringify(collection));if(currentUser)syncCardToCloud(c);openCardDetail(id);renderTagFilterRow();}}
function removeModalTag(id,tag){const c=collection.find(x=>x.id===id);if(!c)return;c.tags=(c.tags||[]).filter(t=>t!==tag);localStorage.setItem('iceVault_cards',JSON.stringify(collection));if(currentUser)syncCardToCloud(c);openCardDetail(id);renderTagFilterRow();}
function updateCardCollection(id,val){const c=collection.find(x=>x.id===id);if(!c)return;c.collection=val;localStorage.setItem('iceVault_cards',JSON.stringify(collection));if(currentUser)syncCardToCloud(c);showToast('Collection updated','success');}
function resetListingStatus(id){
  const c=collection.find(x=>x.id===id);if(!c)return;
  if(!confirm('Reset listing status? The card will move back to '+
    (c.certGrader?'Graded Cards':'Personal Collection')+
    '. You can move it to eBay Queue again to relist.'))return;
  c.listedOnEbay=false;
  c.ebayListingId=null;
  c.collection=c.certGrader?'Graded':'Personal';
  localStorage.setItem('iceVault_cards',JSON.stringify(collection));
  if(currentUser)syncCardToCloud(c);
  closeModal('cardModal');
  renderCollection();
  showToast('Listing status reset -- card moved to '+(c.certGrader?'Graded Cards':'Personal Collection'),'success');
}
function listOnEbayFromModal(id){closeModal('cardModal');selectedCardForEbay=collection.find(c=>c.id===id);switchView('ebay');populateEbayForm(selectedCardForEbay);}
function deleteCard(id){if(!confirm('Delete this card?'))return;collection=collection.filter(c=>c.id!==id);localStorage.setItem('iceVault_cards',JSON.stringify(collection));if(currentUser)deleteCardFromCloud(id);closeModal('cardModal');renderCollection();showToast('Card deleted','success');}

function renderGradeTabContent(cardId, source, grade) {
  const sourceLabels = { claude: 'Claude', gpt4o: 'GPT-4o', gemini: 'Gemini', ximilar: 'Ximilar' };
  const label = sourceLabels[source] || source;
  const costHints = { claude: '~$0.01-0.02 paid', gpt4o: '~$0.01-0.02 paid', gemini: '~$0.001-0.01 free tier', ximilar: '~$0.01' };
  const costHint = costHints[source] || '~$0.01';
  const keys = getKeys();
  const hasKey = source === 'claude' ? !!keys.anthropic : source === 'gpt4o' ? !!keys.openai : source === 'gemini' ? !!keys.gemini : !!keys.ximilar;
  const keyLabel = source === 'claude' ? 'Anthropic' : source === 'gpt4o' ? 'OpenAI' : source === 'gemini' ? 'Google AI' : 'Ximilar';

  if (!grade) {
    const noKeyMsg = !hasKey ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">Add your ${keyLabel} API key in ⚙ Settings to enable</div>` : '';
    return `
      <div style="font-size:11px;color:#E74C3C;background:rgba(192,57,43,0.08);border-radius:6px;padding:6px 8px;margin-bottom:8px;">⚠ AI estimate only. Not an official grade.</div>
      ${noKeyMsg}
      <div style="text-align:center;padding:12px 0;color:var(--text-muted);font-size:13px;">No ${label} grade yet</div>
      <button class="grade-regrade-btn" ${!hasKey ? 'disabled' : ''} onclick="${hasKey ? `regradeCard(${cardId},'${source}')` : ''}">${!hasKey ? `Add ${keyLabel} key to enable` : `↺ Grade with ${label} (${costHint})`}</button>`;
  }

  const overall = parseFloat(grade.overall);
  const badgeClass = overall >= 9 ? 'grade-9' : overall >= 7 ? 'grade-7' : overall >= 5 ? 'grade-5' : 'grade-low';
  return `
    <div style="font-size:11px;color:#E74C3C;background:rgba(192,57,43,0.08);border-radius:6px;padding:6px 8px;margin-bottom:8px;">⚠ AI estimate only. Not an official grade.</div>
    <div class="grade-header">
      <span class="grade-title" style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">${label} — AI Est.</span>
      <span class="grade-badge ${badgeClass}">AI Est. ${grade.overall}</span>
    </div>
    <div class="grade-breakdown">
      <div class="grade-row"><span>Centering</span><span>${grade.centering}</span></div>
      <div class="grade-row"><span>Corners</span><span>${grade.corners}</span></div>
      <div class="grade-row"><span>Edges</span><span>${grade.edges}</span></div>
      <div class="grade-row"><span>Surface</span><span>${grade.surface}</span></div>
    </div>
    <div class="grade-rationale" style="margin-top:6px;">${grade.rationale||''}</div>
    ${source==='ximilar'?`<button onclick="openXimilarDetail(${cardId})" style="width:100%;margin:6px 0;padding:6px;border:0.5px solid var(--border);border-radius:6px;background:var(--rink);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;"><i class="ti ti-chart-bar" style="font-size:13px;margin-right:4px;"></i>View full breakdown</button>`:''}
    <button class="grade-regrade-btn" onclick="regradeCard(${cardId},'${source}')">↺ Re-grade with ${label} (${costHint})</button>
    <button class="grade-set-btn" onclick="setCardGrade(${cardId},'${source}')">✓ Set as card grade</button>`;
}

function switchGradeTab(cardId, source, tabEl) {
  const matrix = document.getElementById('gradeMatrix_' + cardId);
  if (!matrix) return;
  matrix.querySelectorAll('.grade-matrix-tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  const c = collection.find(x => x.id === cardId);
  if (!c) return;
  const grades = c.grades || {};
  const claudeGrade = grades.claude || (c.aiGraded && c.grade ? c.grade : null);
  const sourceGrade = source === 'claude' ? claudeGrade : (grades[source] || null);
  const contentEl = document.getElementById('gradeTabContent_' + cardId);
  if (contentEl) contentEl.innerHTML = renderGradeTabContent(cardId, source, sourceGrade);
}

async function fetchImageAsBase64(imageUrl) {
  const token = getAuthToken();
  if (token) {
    try {
      const r = await fetch(WORKER_URL + '/image-proxy?url=' + encodeURIComponent(imageUrl), {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (r.ok) { const d = await r.json(); return { base64: d.base64, mime: d.contentType }; }
    } catch(e) { /* fall through */ }
  }
  const res = await fetch(imageUrl, { mode: 'cors' });
  if (!res.ok) throw new Error('Image fetch failed: ' + res.status);
  const blob = await res.blob();
  const base64 = await new Promise(resolve => { const r = new FileReader(); r.onload = e => resolve(e.target.result.split(',')[1]); r.readAsDataURL(blob); });
  return { base64, mime: blob.type || 'image/jpeg' };
}

async function regradeCard(cardId, source) {
  const c = collection.find(x => x.id === cardId);
  if (!c) return;
  const hasExisting = source === 'claude'
    ? (c.grades?.claude || (c.aiGraded && c.grade))
    : c.grades?.[source];

  if (hasExisting) {
    if (!confirm('This will overwrite the existing ' + source + ' grade. Continue?')) return;
  }

  if (!c.imageUrl) { showToast('No card image found — re-grade requires images stored in cloud', 'error'); return; }
  const keys = getKeys();
  const _regradeKey = source === 'gpt4o' ? keys.openai : source === 'gemini' ? keys.gemini : source === 'ximilar' ? keys.ximilar : keys.anthropic;
  if (!_regradeKey) { showToast('Add your ' + (source === 'gpt4o' ? 'OpenAI' : source === 'gemini' ? 'Google AI' : source === 'ximilar' ? 'Ximilar' : 'Anthropic') + ' API key in ⚙ Settings', 'error'); return; }

  // Update button state
  const contentEl = document.getElementById('gradeTabContent_' + cardId);
  const btn = contentEl ? contentEl.querySelector('.grade-regrade-btn') : null;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> &nbsp; Grading...'; }

  try {
    const imgs = [];
    // Fetch front image as base64
    const { base64: frontB64, mime: frontMime } = await fetchImageAsBase64(c.imageUrl);
    imgs.push({ type: 'image', source: { type: 'base64', media_type: frontMime, data: frontB64 } });
    // frontMime and frontB64 kept in scope for Ximilar branch below

    // Fetch back image if available
    if (c.imageUrlBack) {
      const { base64: backB64, mime: backMime } = await fetchImageAsBase64(c.imageUrlBack);
      imgs.push({ type: 'image', source: { type: 'base64', media_type: backMime, data: backB64 } });
    }

    const hasBack = imgs.length > 1;
    const prompt = `You are an expert hockey card grader. ${hasBack ? 'First image is the FRONT, second is the BACK.' : 'Front image only.'}
Grade this card condition and respond ONLY with JSON:
{
  "overall":"1-10",
  "centering":"1-10",
  "corners":"1-10",
  "edges":"1-10",
  "surface":"1-10",
  "rationale":"2-3 sentences on condition"
}`;

    let res, data, raw, grade;
    if (source === 'ximilar') {
      if (!keys.ximilar) throw new Error('Add your Ximilar API key in \u2699 Settings');
      // Ximilar uses _url with R2 URLs directly -- simpler and more reliable than base64
      const records = [{ _url: c.imageUrl }];
      if (hasBack) records.push({ _url: c.imageUrlBack });
      res = await fetch(WORKER_URL + '/proxy/ximilar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ximilar-key': keys.ximilar }, body: JSON.stringify({ records }) });
      data = await res.json();
      if (data.status && data.status.code !== 200) {
        // Check if at least the front record succeeded -- back may fail if card not detected
        const xRecs = data.records || [];
        const frontOk = xRecs.some(r => r._status?.code === 200);
        if (!frontOk) throw new Error(data.status.text || 'Ximilar error');
        // Front succeeded, back failed -- warn user
        const failedBack = xRecs.find(r => r._status?.code !== 200);
        if (failedBack) showToast('Ximilar: back image not detected (' + (failedBack._status?.text||'unknown') + ') -- graded front only. Try a clearer back photo.', 'error');
      }
      // Map Ximilar response to our grade format
      // data.grades is empty when overall status is 500 -- fall back to front record grades
      const xRecords = (data.records || []).filter(r => r._status?.code === 200);
      const xFrontRec = xRecords[0] || {};
      const xg = (data.grades && data.grades.final) ? data.grades : (xFrontRec.grades || {});
      const xFront = xRecords.find(r => r.card?.[0]?._tags?.Side?.[0]?.name === 'Front') || xFrontRec || {};
      const xBack = xRecords.find(r => r.card?.[0]?._tags?.Side?.[0]?.name === 'Back') || null;
      const buildImageDetail = (rec) => rec ? {
        centering: rec.grades?.centering ?? null,
        centeringRatio: (rec.card?.[0]?.centering?.['left/right'] || '') + ' L/R, ' + (rec.card?.[0]?.centering?.['top/bottom'] || '') + ' T/B',
        surface: rec.card?.[0]?.surface?.grade ?? null,
        corners: (rec.corners || []).map(c => ({ name: c.name, grade: c.grade })),
        edges: (rec.edges || []).map(e => ({ name: e.name, grade: e.grade })),
        autograph: rec.card?.[0]?._tags?.Autograph?.[0]?.name || null,
        autographProb: rec.card?.[0]?._tags?.Autograph?.[0]?.prob || null,
        damaged: rec.card?.[0]?._tags?.Damaged?.[0]?.name || null,
        damagedProb: rec.card?.[0]?._tags?.Damaged?.[0]?.prob || null,
      } : null;
      grade = {
        overall: String(xg.final ?? '?'),
        centering: String(xg.centering ?? '?'),
        corners: String(xg.corners ?? '?'),
        edges: String(xg.edges ?? '?'),
        surface: String(xg.surface ?? '?'),
        rationale: 'Ximilar AI grade. Condition: ' + (xg.condition || '?') + '. Final grade ' + (xg.final ?? '?') + '/10 using geometric mean of centering, corners, edges, surface.',
        ximilarDetail: { front: buildImageDetail(xFront), back: buildImageDetail(xBack), combined: xg }
      };
    } else if (source === 'gpt4o') {
      if (!keys.openai) throw new Error('Add your OpenAI API key in \u2699 Settings');
      const gptImgs = imgs.map(img => ({ type: 'image_url', image_url: { url: 'data:' + img.source.media_type + ';base64,' + img.source.data } }));
      res = await fetch(WORKER_URL + '/proxy/openai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-openai-key': keys.openai }, body: JSON.stringify({ model: 'gpt-4o', max_tokens: 400, messages: [{ role: 'user', content: [...gptImgs, { type: 'text', text: prompt }] }] }) });
      data = await res.json();
      if (data.error) throw new Error(data.error.message);
      raw = data.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
      grade = JSON.parse(raw);
    } else if (source === 'gemini') {
      if (!keys.gemini) throw new Error('Add your Google AI API key in \u2699 Settings');
      const gemParts = imgs.map(img => ({ inline_data: { mime_type: img.source.media_type, data: img.source.data } }));
      res = await fetch(WORKER_URL + '/proxy/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gemini-key': keys.gemini }, body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [...gemParts, { text: prompt }] }] }) });
      data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      raw = data.candidates[0].content.parts[0].text.trim().replace(/```json|```/g, '').trim();
      grade = JSON.parse(raw);
    } else {
      // Claude
      if (!keys.anthropic) throw new Error('Add your Anthropic API key in \u2699 Settings');
      res = await fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': keys.anthropic, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 400, messages: [{ role: 'user', content: [...imgs, { type: 'text', text: prompt }] }] }) });
      data = await res.json();
      if (data.error) throw new Error(data.error.message);
      raw = data.content[0].text.trim().replace(/```json|```/g, '').trim();
      grade = JSON.parse(raw);
    }
    grade.gradedAt = new Date().toISOString();
    grade.source = source;

    // Save grade to card
    if (!c.grades) c.grades = {};
    c.grades[source] = grade;
    localStorage.setItem('iceVault_cards', JSON.stringify(collection));
    if (currentUser) syncCardToCloud(c);

    // Update matrix summary cell
    const matrix = document.getElementById('gradeMatrix_' + cardId);
    if (matrix) {
      const cells = matrix.querySelectorAll('.grade-matrix-cell');
      const sourceIdx = { claude: 0, gpt4o: 1, gemini: 2, ximilar: 3 }[source];
      if (cells[sourceIdx]) {
        const valEl = cells[sourceIdx].querySelector('.grade-matrix-cell-val');
        if (valEl) { valEl.textContent = grade.overall; valEl.classList.remove('pending'); }
      }
      // Update tab to has-grade
      const tabs = matrix.querySelectorAll('.grade-matrix-tab');
      if (tabs[sourceIdx]) { tabs[sourceIdx].classList.remove('coming-soon'); tabs[sourceIdx].classList.add('has-grade'); }
    }

    // Re-render tab content
    if (contentEl) contentEl.innerHTML = renderGradeTabContent(cardId, source, grade);
    showToast('Re-graded with ' + source + ': ' + grade.overall, 'success');
  } catch (err) {
    showToast('Re-grade failed: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '↺ Re-grade with ' + source; }
  }
}

function setCardGrade(cardId, source) {
  const c = collection.find(x => x.id === cardId);
  if (!c) return;
  const grades = c.grades || {};
  const claudeGrade = grades.claude || (c.aiGraded && c.grade ? c.grade : null);
  const grade = source === 'claude' ? claudeGrade : grades[source];
  if (!grade) { showToast('No grade from this source yet', 'error'); return; }
  const sourceLabels = { claude: 'Claude', gpt4o: 'GPT-4o', gemini: 'Gemini', ximilar: 'Ximilar' };
  if (c.grade && !confirm('Replace current card grade (' + (c.grade.overall) + ') with ' + sourceLabels[source] + ' grade (' + grade.overall + ')?')) return;
  c.grade = grade;
  c.aiGraded = true;
  localStorage.setItem('iceVault_cards', JSON.stringify(collection));
  if (currentUser) syncCardToCloud(c);
  showToast('Card grade set to ' + sourceLabels[source] + ' ' + grade.overall, 'success');
  renderCollection();
}

const _rescanModels = {}; // tracks selected model per card
function setRescanModel(cardId, model, btn) {
  _rescanModels[cardId] = model;
  // Update active button
  ['Claude','Gpt4o','Gemini'].forEach(m => {
    const b = document.getElementById('rescanModel' + m + '_' + cardId);
    if (b) b.className = 'grader-btn' + (m.toLowerCase() === model ? ' active' : '');
  });
  // Update cost hint
  const costEl = document.getElementById('rescanCost_' + cardId);
  if (costEl) {
    const hints = { claude: '⚠ ~$0.01-0.03 (paid)', gpt4o: '⚠ ~$0.01-0.03 (paid)', gemini: '⚠ ~$0.001-0.01 (free tier)' };
    costEl.textContent = hints[model] || '⚠ ~$0.01-0.03';
  }
}

async function triggerRescan(cardId) {
  const c = collection.find(x => x.id === cardId);
  if (!c || !c.imageUrl) return;
  const rescanModel = _rescanModels[cardId] || 'claude';
  const keys = getKeys();
  const rescanKey = rescanModel === 'gpt4o' ? keys.openai : rescanModel === 'gemini' ? keys.gemini : keys.anthropic;
  const rescanKeyLabel = rescanModel === 'gpt4o' ? 'OpenAI' : rescanModel === 'gemini' ? 'Google AI' : 'Anthropic';
  if (!rescanKey) { showToast('Add your ' + rescanKeyLabel + ' API key in ⚙ Settings', 'error'); return; }

  const btn = document.getElementById('rescanBtn_' + cardId);
  const reviewEl = document.getElementById('rescanReview_' + cardId);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> &nbsp; Scanning...'; }
  if (reviewEl) reviewEl.style.display = 'none';

  try {
    // Fetch front image
    const { base64: frontB64, mime: frontMime } = await fetchImageAsBase64(c.imageUrl);
    const imgs = [{ type: 'image', source: { type: 'base64', media_type: frontMime, data: frontB64 } }];

    // Fetch back image if available
    if (c.imageUrlBack) {
      const { base64: backB64, mime: backMime } = await fetchImageAsBase64(c.imageUrlBack);
      imgs.push({ type: 'image', source: { type: 'base64', media_type: backMime, data: backB64 } });
    }

    const hasBack = imgs.length > 1;
    const prompt = `You are an expert hockey card analyst. ${hasBack ? 'First image is FRONT, second is BACK — use back for card number, parallel, serial number.' : 'Front image only.'}
Analyze this hockey card and respond ONLY with JSON:
{
  "player":"Full player name",
  "year":"Card year",
  "brand":"Brand and set name",
  "cardNumber":"Card number if visible",
  "team":"Player team",
  "parallel":"Parallel or Base",
  "serialNumber":"Serial number if present e.g. 47/99 or null",
  "estimatedValue":"Market value USD as number string"
}`;

    let rescanRes, rescanData, rescanRaw;
    if (rescanModel === 'gpt4o') {
      const gptImgs = imgs.map(img => ({ type: 'image_url', image_url: { url: 'data:' + img.source.media_type + ';base64,' + img.source.data } }));
      rescanRes = await fetch(WORKER_URL + '/proxy/openai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-openai-key': keys.openai }, body: JSON.stringify({ model: 'gpt-4o', max_tokens: 800, messages: [{ role: 'user', content: [...gptImgs, { type: 'text', text: prompt }] }] }) });
      rescanData = await rescanRes.json();
      if (rescanData.error) throw new Error(rescanData.error.message);
      rescanRaw = rescanData.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
    } else if (rescanModel === 'gemini') {
      const gemParts = imgs.map(img => ({ inline_data: { mime_type: img.source.media_type, data: img.source.data } }));
      rescanRes = await fetch(WORKER_URL + '/proxy/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gemini-key': keys.gemini }, body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [...gemParts, { text: prompt }] }] }) });
      rescanData = await rescanRes.json();
      if (rescanData.error) throw new Error(rescanData.error.message || JSON.stringify(rescanData.error));
      rescanRaw = rescanData.candidates[0].content.parts[0].text.trim().replace(/```json|```/g, '').trim();
    } else {
      rescanRes = await fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': keys.anthropic, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 800, messages: [{ role: 'user', content: [...imgs, { type: 'text', text: prompt }] }] }) });
      rescanData = await rescanRes.json();
      if (rescanData.error) throw new Error(rescanData.error.message);
      rescanRaw = rescanData.content[0].text.trim().replace(/```json|```/g, '').trim();
    }
    const result = JSON.parse(rescanRaw);

    // Build diff and show review panel
    const fields = [
      { key: 'player', label: 'Player', newVal: result.player },
      { key: 'year', label: 'Year', newVal: result.year },
      { key: 'brand', label: 'Brand / Set', newVal: result.brand },
      { key: 'team', label: 'Team', newVal: result.team },
      { key: 'cardNumber', label: 'Card #', newVal: result.cardNumber },
      { key: 'parallel', label: 'Parallel', newVal: result.parallel },
      { key: 'serialNumber', label: 'Serial #', newVal: result.serialNumber },
      { key: 'estimatedValue', label: 'Est. Value', newVal: result.estimatedValue, prefix: '$' },
    ];

    let changedCount = 0;
    let rowsHtml = fields.map(f => {
      const oldVal = c[f.key] || '—';
      const newVal = f.newVal || '—';
      const changed = String(oldVal) !== String(newVal) && newVal !== '—';
      if (changed) changedCount++;
      const oldDisplay = f.prefix && oldVal !== '—' ? f.prefix + oldVal : oldVal;
      const newDisplay = f.prefix && newVal !== '—' ? f.prefix + newVal : newVal;
      return `<div class="rescan-review-row">
        <div class="rescan-review-label">${f.label}</div>
        <div class="rescan-review-vals">
          ${changed ? `<span class="rescan-old">${oldDisplay}</span><span class="rescan-arrow">→</span><div class="rescan-changed-dot"></div><span class="rescan-new changed">${newDisplay}</span>` : `<span class="rescan-new same">${newDisplay}</span>`}
        </div>
      </div>`;
    }).join('');


    const unchangedCount = fields.length - changedCount;

    if (reviewEl) {
      reviewEl.innerHTML = `<div class="rescan-review">
        <div class="rescan-review-header">
          <span class="rescan-review-title">Review before saving</span>
          <span class="grade-badge grade-7" style="font-size:10px;padding:2px 8px;">${{claude:'Claude',gpt4o:'GPT-4o',gemini:'Gemini'}[rescanModel]||'Claude'}</span>
        </div>
        <div class="rescan-review-grid">${rowsHtml}</div>
        <div class="rescan-summary"><span>●</span> ${changedCount} field${changedCount !== 1 ? 's' : ''} changed · ${unchangedCount} unchanged</div>
        <div class="rescan-review-actions">
          <button class="rescan-cancel-btn" onclick="cancelRescan(${cardId})">Cancel</button>
          <button class="rescan-confirm-btn" onclick="confirmRescan(${cardId}, ${JSON.stringify(result).replace(/"/g, '&quot;')}, '${rescanModel}')">✓ Save changes</button>
        </div>
      </div>`;
      reviewEl.style.display = 'block';
    }
    showToast('Re-scan complete — review changes below', 'success');
  } catch (err) {
    showToast('Re-scan failed: ' + err.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '↺ Re-scan card with AI'; }
}

function cancelRescan(cardId) {
  const reviewEl = document.getElementById('rescanReview_' + cardId);
  if (reviewEl) reviewEl.style.display = 'none';
}

function confirmRescan(cardId, result, rescanModel) {
  const c = collection.find(x => x.id === cardId);
  if (!c) return;
  rescanModel = rescanModel || 'claude'; // fallback for safety
  if (result.player) c.player = result.player;
  if (result.year) c.year = result.year;
  if (result.brand) c.brand = result.brand;
  if (result.cardNumber) c.cardNumber = result.cardNumber;
  if (result.team) c.team = result.team;
  if (result.parallel) c.parallel = result.parallel;
  c.serialNumber = result.serialNumber || null;
  if (result.estimatedValue) {
    const oldEv = c.estimatedValue;
    c.estimatedValue = result.estimatedValue;
    if (c.estimatedValue !== oldEv) {
      if (!c.valueHistory) c.valueHistory = [];
      c.valueHistory.push({ value: c.estimatedValue, date: new Date().toISOString(), source: 'rescan' });
    }
  }
  localStorage.setItem('iceVault_cards', JSON.stringify(collection));
  if (currentUser) syncCardToCloud(c);
  closeModal('cardModal');
  renderCollection();
  showToast('Card updated from re-scan', 'success');
}

function editCardNotes(id) {
  document.getElementById('cardNotesDisplay_' + id).style.display = 'none';
  document.getElementById('cardNotesEdit_' + id).style.display = 'block';
  const ta = document.getElementById('cardNotesInput_' + id);
  if (ta) { ta.focus(); ta.selectionStart = ta.value.length; }
}

function cancelCardNotes(id) {
  document.getElementById('cardNotesDisplay_' + id).style.display = 'block';
  document.getElementById('cardNotesEdit_' + id).style.display = 'none';
  // Restore original value
  const c = collection.find(x => x.id === id);
  if (c) document.getElementById('cardNotesInput_' + id).value = c.notes || '';
}

function saveCardNotes(id) {
  const c = collection.find(x => x.id === id);
  if (!c) return;
  const val = document.getElementById('cardNotesInput_' + id).value.trim();
  c.notes = val || null;
  localStorage.setItem('iceVault_cards', JSON.stringify(collection));
  if (currentUser) syncCardToCloud(c);
  // Update display
  const disp = document.getElementById('cardNotesDisplay_' + id);
  if (disp) disp.innerHTML = c.notes || '<span style="opacity:0.5">Add notes...</span>';
  if (disp) disp.style.color = c.notes ? 'var(--text-primary)' : 'var(--text-muted)';
  document.getElementById('cardNotesDisplay_' + id).style.display = 'block';
  document.getElementById('cardNotesEdit_' + id).style.display = 'none';
  showToast('Notes saved', 'success');
}

function editCardField(id, field, el) {
  const c = collection.find(x => x.id === id);
  if (!c) return;
  if (el.querySelector('input')) return;

  // Show save hint
  const hintEl = document.getElementById('editSaveHint_' + id);
  if (hintEl) hintEl.classList.add('visible');

  // Remove hint span and text node
  const hint = el.querySelector('.edit-hint');
  if (hint) hint.remove();
  const textNode = el.childNodes[0];
  if (textNode) el.removeChild(textNode);

  const input = document.createElement('input');
  input.type = field === 'estimatedValue' ? 'number' : 'text';
  input.className = 'editable-inline';
  input.value = c[field] || '';
  if (field === 'estimatedValue') { input.step = '0.01'; input.min = '0'; }
  el.insertBefore(input, el.firstChild);
  input.focus();
  input.select();

  function restore(val) {
    if (el.querySelector('input')) el.removeChild(input);
    const hintSpan = document.createElement('span');
    hintSpan.className = 'edit-hint';
    hintSpan.textContent = '✎';
    el.insertBefore(document.createTextNode(val), el.firstChild);
    el.appendChild(hintSpan);
    if (hintEl) hintEl.classList.remove('visible');
  }

  function save() {
    const newVal = input.value.trim();
    const oldDisplay = field === 'estimatedValue'
      ? (c[field] ? '$' + c[field] : '—')
      : (c[field] || '—');

    if (newVal === String(c[field] || '') || (!newVal && !c[field])) {
      restore(oldDisplay);
      return;
    }

    if (field === 'estimatedValue') {
      const oldEv = c[field];
      c[field] = newVal ? parseFloat(newVal).toFixed(2) : '';
      // Append to value history if value actually changed
      if (c[field] && c[field] !== oldEv) {
        if (!c.valueHistory) c.valueHistory = [];
        c.valueHistory.push({ value: c[field], date: new Date().toISOString(), source: 'manual' });
      }
      restore(c[field] ? '$' + c[field] : '—');
    } else if (field === 'serialNumber') {
      c[field] = newVal || null;
      restore(c[field] || '—');
      if (c[field]) { el.style.color = 'var(--gold)'; el.style.fontWeight = '600'; }
      else { el.style.color = ''; el.style.fontWeight = ''; }
    } else {
      c[field] = newVal;
      restore(c[field] || '—');
    }

    // Update modal header if player/year/brand/team changed
    if (['player','year','brand','team'].includes(field)) {
      const playerEl = document.querySelector('#modalContent .modal-player');
      const metaEl = document.querySelector('#modalContent .modal-meta');
      if (playerEl) playerEl.textContent = c.player || '';
      if (metaEl) metaEl.textContent = `${c.year||''} · ${c.brand||''} · ${c.team||''}`;
    }

    localStorage.setItem('iceVault_cards', JSON.stringify(collection));
    if (currentUser) syncCardToCloud(c);
    showToast('Card updated', 'success');
  }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') {
      const oldDisplay = field === 'estimatedValue'
        ? (c[field] ? '$' + c[field] : '—')
        : (c[field] || '—');
      if (el.querySelector('input')) el.removeChild(input);
      const hintSpan = document.createElement('span');
      hintSpan.className = 'edit-hint';
      hintSpan.textContent = '✎';
      el.insertBefore(document.createTextNode(oldDisplay), el.firstChild);
      el.appendChild(hintSpan);
      if (hintEl) hintEl.classList.remove('visible');
    }
  });
}

function markAsSold(id) {
  const c = collection.find(x => x.id === id);
  if (!c) return;
  const price = prompt('Sale price ($) — required:');
  if (price === null) return; // user cancelled
  const trimmed = price.trim();
  if (!trimmed || isNaN(parseFloat(trimmed)) || parseFloat(trimmed) < 0) {
    showToast('Please enter a valid sale price', 'error');
    return;
  }
  c.sold = true;
  c.soldPrice = parseFloat(trimmed).toFixed(2);
  c.soldAt = new Date().toISOString();
  c.collection = 'Sold';
  c.listedOnEbay = false;
  localStorage.setItem('iceVault_cards', JSON.stringify(collection));
  if (currentUser) syncCardToCloud(c);
  closeModal('cardModal');
  renderCollection();
  showToast(`Marked as sold for $${c.soldPrice}`, 'success');
}

function undoSold(id) {
  const c = collection.find(x => x.id === id);
  if (!c) return;
  if (!confirm('Undo this sale? The card will be moved back to Personal Collection and sale data cleared.')) return;
  c.sold = false;
  c.soldPrice = null;
  c.soldAt = null;
  c.collection = 'Personal';
  localStorage.setItem('iceVault_cards', JSON.stringify(collection));
  if (currentUser) syncCardToCloud(c);
  closeModal('cardModal');
  renderCollection();
  showToast('Sale undone — card moved back to Personal Collection', 'success');
}

let _ebayMode = 'queue';
function setEbayMode(mode) {
  _ebayMode = mode;
  document.getElementById('ebayModeQueue').className = 'mode-toggle-btn' + (mode==='queue'?' active':'');
  document.getElementById('ebayModeSingle').className = 'mode-toggle-btn' + (mode==='single'?' active':'');
  document.getElementById('ebayQueuePanel').style.display = mode==='queue' ? 'block' : 'none';
  document.getElementById('ebaySinglePanel').style.display = mode==='single' ? 'block' : 'none';
  if (mode==='queue') renderEbayQueue();
  else renderEbayCardSelect();
}

function renderEbayQueue() {
  const queueCards = collection.filter(c => c.collection === 'EbayQueue' && !c.listedOnEbay && !c.sold);
  const container = document.getElementById('ebayQueueList');
  if (!container) return;
  if (queueCards.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:20px 0;">No cards in eBay Queue. Move cards to the eBay Queue collection to list them here.</div>';
    return;
  }
  container.innerHTML = queueCards.map(c => {
    const startPrice = c.estimatedValue ? (parseFloat(c.estimatedValue)*0.7).toFixed(2) : '';
    const binPrice = c.estimatedValue || '';
    const officialGrade = !c.aiGraded && c.grade ? (c.certGrader||'PSA')+' '+c.grade.overall : '';
    const title = [c.player,c.year,c.brand,c.cardNumber?'#'+c.cardNumber:'',c.parallel&&c.parallel!=='Base'?c.parallel:'',c.serialNumber||'',officialGrade].filter(Boolean).join(' ').trim().substring(0,80);
    const thumb = (c.imageUrl||c.imageData) ? '<img src="'+(c.imageUrl||c.imageData)+'" style="width:100%;height:100%;object-fit:cover;">' : '⚪';
    const gradeLabel = c.grade ? '<span style="font-size:11px;color:var(--text-muted);">'+(c.aiGraded?'AI Est. ':'')+c.grade.overall+'</span>' : '';
    return '<div class="form-section" id="queueCard_'+c.id+'" style="margin-bottom:12px;">'
      +'<div style="display:flex;gap:12px;align-items:flex-start;">'
      +'<div style="width:60px;height:80px;background:var(--rink);border-radius:6px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">'+thumb+'</div>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-weight:600;font-size:14px;color:var(--text-primary);">'+c.player+'</div>'
      +'<div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">'+(c.year||'')+' '+(c.brand||'')+' '+gradeLabel+'</div>'
      +'<input type="text" value="'+title+'" id="queueTitle_'+c.id+'" class="form-control" style="font-size:12px;margin-bottom:6px;" placeholder="Listing title">'
      +'<div style="display:flex;gap:8px;">'
      +'<div style="flex:1;"><label class="form-label">Start ($)</label><input type="number" class="form-control" id="queueStart_'+c.id+'" value="'+startPrice+'" step="0.01" placeholder="9.99"></div>'
      +'<div style="flex:1;"><label class="form-label">BIN ($)</label><input type="number" class="form-control" id="queueBin_'+c.id+'" value="'+binPrice+'" step="0.01" placeholder="Optional"></div>'
      +'</div>'
      +'<div id="queueDesc_'+c.id+'" style="margin-top:6px;"></div>'
      +'<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">'
      +'<div style="display:flex;align-items:center;gap:4px;margin-top:6px;margin-bottom:4px;">'
      +'<span style="font-size:10px;color:var(--text-muted);">Desc AI:</span>'
      +'<button class="grader-btn active" id="queueDescModel_claude_'+c.id+'" onclick="setQueueDescModel('+c.id+',\'claude\')" style="padding:3px 8px;font-size:10px;">Claude</button>'
      +'<button class="grader-btn" id="queueDescModel_gpt4o_'+c.id+'" onclick="setQueueDescModel('+c.id+',\'gpt4o\')" style="padding:3px 8px;font-size:10px;">GPT-4o</button>'
      +'<button class="grader-btn" id="queueDescModel_gemini_'+c.id+'" onclick="setQueueDescModel('+c.id+',\'gemini\')" style="padding:3px 8px;font-size:10px;">Gemini</button>'
      +'</div>'
      +'<div id="queueDescCostHint_'+c.id+'" style="font-size:10px;color:var(--gold);margin-top:2px;margin-bottom:2px;">⚠ Optional — ~$0.01–0.02 per description (Claude, paid). Prices are estimates only.</div>'
      +'<button onclick="queueGenerateDesc('+c.id+')" class="camera-btn" style="flex:1;font-size:12px;padding:6px 10px;">&#x2726; Generate desc</button>'
      +'<button onclick="ebayQueueSubmitOne('+c.id+')" class="analyze-btn" style="flex:1;margin-top:0;font-size:12px;padding:6px 10px;">&#x1F6D2; Submit</button>'
      +'<button onclick="ebayQueueRemove('+c.id+')" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(192,57,43,0.3);background:transparent;color:#E74C3C;font-size:12px;cursor:pointer;font-family:var(--font,sans-serif);">&#x2715; Remove</button>'
      +'</div>'
      +'<div style="display:flex;gap:8px;margin-top:8px;">'
      +'<a href="'+ebaySearchUrl(c)+'" target="_blank" class="camera-btn" style="flex:1;font-size:11px;padding:5px 8px;text-align:center;text-decoration:none;">&#x1F50D; eBay Sold</a>'
      +'<button onclick="open130point(collection.find(x=>x.id==='+c.id+'))" class="camera-btn" style="flex:1;font-size:11px;padding:5px 8px;">&#x1F4CA; 130point</button>'
      +'</div>'
      +'<div id="queueStatus_'+c.id+'" style="font-size:11px;margin-top:4px;color:var(--text-muted);"></div>'
      +'</div></div></div>';
  }).join('');
}

function ebayQueueRemove(id) {
  const c = collection.find(x => x.id === id);
  if (!c) return;
  c.collection = 'Personal';
  localStorage.setItem('iceVault_cards', JSON.stringify(collection));
  if (currentUser) syncCardToCloud(c);
  renderEbayQueue();
  showToast('Removed from eBay Queue', 'success');
}

const _queueDescModels = {};
function setQueueDescModel(id, model) {
  _queueDescModels[id] = model;
  ['claude','gpt4o','gemini'].forEach(m => {
    const btn = document.getElementById('queueDescModel_' + m + '_' + id);
    if (btn) btn.className = 'grader-btn' + (m === model ? ' active' : '');
  });
  const costHints = { claude: '~$0.01–0.02 per description (Claude, paid)', gpt4o: '~$0.01–0.02 per description (GPT-4o, paid)', gemini: '~$0.001–0.01 per description (Gemini, free tier available)' };
  const hint = document.getElementById('queueDescCostHint_' + id);
  if (hint) hint.textContent = '⚠ Optional — ' + (costHints[model] || costHints.claude) + '. Prices are estimates only.';
}

async function queueGenerateDesc(id) {
  const c = collection.find(x => x.id === id);
  if (!c) return;
  const keys = getKeys();
  // Use selected model, fall back to first available key
  const selectedModel = _queueDescModels[id];
  const descModel = selectedModel && (
    (selectedModel==='claude'&&keys.anthropic)||(selectedModel==='gpt4o'&&keys.openai)||(selectedModel==='gemini'&&keys.gemini)
  ) ? selectedModel : keys.anthropic ? 'claude' : keys.openai ? 'gpt4o' : keys.gemini ? 'gemini' : null;
  if (!descModel) { showToast('Add an AI API key in ⚙ Settings to generate descriptions', 'error'); return; }
  const statusEl = document.getElementById('queueStatus_' + id);
  if (statusEl) statusEl.textContent = 'Generating description...';
  const gt = c.grade ? 'Grade '+c.grade.overall+'/10. '+c.grade.rationale : 'Not graded';
  const prompt = 'Write a factual eBay listing description for this hockey card. Be professional and straightforward. State the facts only -- do not upsell, exaggerate, use hype language, or make investment claims. Do not say things like "exploding in demand", "must-have", "phenomenal", "blue-chip", or similar sales language. If the card is not professionally graded, do not mention or imply any grade. Describe what the card is, its key features (autograph, patch, serial number if applicable), the set it comes from, and the player. Keep it honest and concise.\n\nPlayer: '+c.player+'\nYear: '+(c.year||'Unknown')+'\nBrand/Set: '+(c.brand||'Unknown')+'\nCard #: '+(c.cardNumber||'N/A')+'\nTeam: '+(c.team||'Unknown')+'\nParallel: '+(c.parallel||'Base')+'\nCondition: '+gt+'\nValue: $'+(c.estimatedValue||'N/A')+'\n\nWrite 2-3 short paragraphs. No markdown. Under 200 words. Facts only.';
  try {
    let desc;
    if (descModel === 'gpt4o') {
      const res = await fetch(WORKER_URL + '/proxy/openai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-openai-key': keys.openai }, body: JSON.stringify({ model: 'gpt-4o', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }) });
      const data = await res.json(); if (data.error) throw new Error(data.error.message);
      desc = data.choices[0].message.content;
    } else if (descModel === 'gemini') {
      const res = await fetch(WORKER_URL + '/proxy/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gemini-key': keys.gemini }, body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] }) });
      const data = await res.json(); if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      desc = data.candidates[0].content.parts[0].text;
    } else {
      const res = await fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': keys.anthropic, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }) });
      const data = await res.json(); if (data.error) throw new Error(data.error.message);
      desc = data.content[0].text;
    }
    const descEl = document.getElementById('queueDesc_' + id);
    if (descEl) descEl.innerHTML = '<textarea class="form-control" id="queueDescText_'+id+'" rows="4" style="font-size:12px;margin-top:4px;">'+desc+'</textarea>';
    const modelLabel = descModel === 'gpt4o' ? 'GPT-4o' : descModel === 'gemini' ? 'Gemini' : 'Claude';
    if (statusEl) statusEl.textContent = '✓ Description generated (' + modelLabel + ')';
  } catch(e) {
    if (statusEl) statusEl.textContent = '✕ Failed: ' + e.message;
  }
}

function updateEbayShippingCost() {
  const sel = document.getElementById('ebayShipping');
  const cost = sel?.options[sel.selectedIndex]?.dataset?.cost || '5.00';
  const field = document.getElementById('ebayShippingCost');
  if (field) field.value = cost;
}
function updateQueueShippingCost() {
  const sel = document.getElementById('queueShipping');
  const cost = sel?.options[sel.selectedIndex]?.dataset?.cost || '5.00';
  const field = document.getElementById('queueShippingCost');
  if (field) field.value = cost;
}

async function ebayQueueSubmitOne(id) {
  const c = collection.find(x => x.id === id);
  if (!c) return;
  const keys = getKeys();
  const token = keys.ebayToken;
  if (!token) { showToast('Add your eBay OAuth token in ⚙ Settings', 'error'); return; }
  if (!confirm('Submit "' + c.player + '" to eBay?')) return;
  const statusEl = document.getElementById('queueStatus_' + id);
  if (statusEl) statusEl.textContent = 'Submitting...';
  const title = (document.getElementById('queueTitle_' + id)?.value || c.player).substring(0,80);
  const price = document.getElementById('queueStart_' + id)?.value || '9.99';
  const bin = document.getElementById('queueBin_' + id)?.value || '';
  const desc = document.getElementById('queueDescText_' + id)?.value || c.player+' '+(c.year||'')+' '+(c.brand||'');
  const duration = document.getElementById('queueDuration')?.value || '7 days';
  const days = duration.includes('30')?'Days_30':duration.includes('10')?'Days_10':duration.includes('5')?'Days_5':duration.includes('3')?'Days_3':'Days_7';
  const shipping = document.getElementById('queueShipping')?.value || 'USPS First Class (Top Loader)';
  const shippingCost = document.getElementById('queueShippingCost')?.value || '5.00';
  const shippingService = shipping.includes('USPSGroundAdvantage')?'USPSFirstClass':shipping.includes('USPSPriority')?'USPSPriority':'USPSFirstClass';
  const shippingFree = shipping.includes('Free');
  const binXml = bin ? '<BuyItNowPrice>'+bin+'</BuyItNowPrice>' : '';
  const xml = '<?xml version="1.0" encoding="utf-8"?><AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>'+token+'</eBayAuthToken></RequesterCredentials><Item><Title>'+title+'</Title><Description><![CDATA['+desc+']]></Description><PrimaryCategory><CategoryID>261328</CategoryID></PrimaryCategory><StartPrice>'+price+'</StartPrice>'+binXml+'<ConditionID>'+(document.getElementById('queueCondition')?.value||'3000')+'</ConditionID>'+'<ItemSpecifics><NameValueList><Name>Sport</Name><Value>Hockey</Value></NameValueList>'+'<NameValueList><Name>Player</Name><Value>'+c.player+'</Value></NameValueList>'+'<NameValueList><Name>Season</Name><Value>'+(c.year||'Unknown')+'</Value></NameValueList></ItemSpecifics>'+(c.imageUrl?'<PictureDetails><PictureURL>'+c.imageUrl+'</PictureURL></PictureDetails>':'')+'<Country>US</Country><Currency>USD</Currency><Location>'+(document.getElementById('queueLocation')?.value||'United States')+'</Location><DispatchTimeMax>3</DispatchTimeMax><ListingDuration>'+days+'</ListingDuration><ListingType>'+(document.getElementById('queueListingType')?.value||'FixedPriceItem')+'</ListingType>'+(document.getElementById('queueBestOffer')?.checked?'<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>':'')+'<Quantity>1</Quantity><ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption></ReturnPolicy><ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingService>'+shippingService+'</ShippingService><ShippingServiceCost>'+(shippingFree?'0.00':shippingCost)+'</ShippingServiceCost></ShippingServiceOptions></ShippingDetails><Site>US</Site></Item></AddItemRequest>';
  try {
    const r = await fetch(WORKER_URL + '/proxy/ebay', { method:'POST', headers:{'Content-Type':'text/xml','x-ebay-call-name':'AddItem'}, body: xml });
    const text = await r.text();
    if (text.includes('<Ack>Success</Ack>') || text.includes('<Ack>Warning</Ack>')) {
      const im = text.match(/<ItemID>(\d+)<\/ItemID>/);
      const lid = im ? im[1] : 'Unknown';
      c.listedOnEbay = true; c.ebayListingId = lid; c.collection = 'For Sale';
      localStorage.setItem('iceVault_cards', JSON.stringify(collection));
      if (currentUser) syncCardToCloud(c);
      if (statusEl) statusEl.innerHTML = '✓ Listed! <a href="https://ebay.com/itm/'+lid+'" target="_blank" style="color:var(--ice-dark);">View listing</a>';
      showToast(c.player + ' listed on eBay!', 'success');
      setTimeout(() => renderEbayQueue(), 1500);
    } else {
      const em = text.match(/<ShortMessage>(.*?)<\/ShortMessage>/);
      throw new Error(em ? em[1] : 'Unknown eBay error');
    }
  } catch(e) {
    if (statusEl) statusEl.textContent = '✕ Failed: ' + e.message;
    showToast('Listing failed: ' + e.message, 'error');
  }
}

async function ebayQueueSubmitAll() {
  const queueCards = collection.filter(c => c.collection === 'EbayQueue' && !c.listedOnEbay && !c.sold);
  if (queueCards.length === 0) { showToast('No cards in queue', 'error'); return; }
  const keys = getKeys();
  if (!keys.ebayToken) { showToast('Add your eBay OAuth token in ⚙ Settings', 'error'); return; }
  if (!confirm('Submit all ' + queueCards.length + ' card(s) to eBay? Each will be listed separately.')) return;
  const progressEl = document.getElementById('queueSubmitProgress');
  if (progressEl) progressEl.style.display = 'block';
  let success = 0, failed = 0;
  for (const c of queueCards) {
    if (progressEl) progressEl.textContent = 'Listing '+(success+failed+1)+' of '+queueCards.length+': '+c.player+'...';
    const statusBefore = document.getElementById('queueStatus_' + c.id)?.textContent || '';
    await ebayQueueSubmitOne(c.id);
    await new Promise(r => setTimeout(r, 600));
    const statusAfter = document.getElementById('queueStatus_' + c.id)?.textContent || '';
    if (statusAfter.includes('✓')) success++; else failed++;
  }
  if (progressEl) progressEl.textContent = 'Done: '+success+' listed, '+failed+' failed.';
  showToast(success+' card(s) listed on eBay', 'success');
}

function renderEbayCardSelect(){
  const ctr=document.getElementById('ebayCardSelect');
  const queueCards=collection.filter(c=>c.collection==='EbayQueue'&&!c.sold);
  if(queueCards.length===0){ctr.innerHTML='<div style="color:var(--text-muted);font-size:13px;padding:10px 0;">No cards in eBay Queue. Move cards to the eBay Queue collection to list them here.</div>';return;}
  ctr.innerHTML=`<div class="ebay-card-list">${queueCards.map(c=>`<div class="ebay-card-row ${selectedCardForEbay&&selectedCardForEbay.id===c.id?'selected':''}" onclick="selectCardForEbay(${c.id})"><div class="ebay-card-thumb">${(c.imageUrl||c.imageData)?`<img src="${c.imageUrl||c.imageData}" alt="">`:'🏒'}</div><div class="ebay-card-info"><div class="ebay-card-name">${c.player}</div><div class="ebay-card-meta">${c.year||''} ${c.brand||''} · ${c.grade?'Grade '+c.grade.overall:'No grade'}</div></div>${c.listedOnEbay?'<span style="color:var(--green);font-size:11px;">Listed</span>':''}</div>`).join('')}</div>`;
  if(selectedCardForEbay&&selectedCardForEbay.collection==='EbayQueue')populateEbayForm(selectedCardForEbay);else if(queueCards.length>0&&!selectedCardForEbay&&!renderEbayCardSelect._skipAutoSelect){selectCardForEbay(queueCards[0].id);}
}
function selectCardForEbay(id){selectedCardForEbay=collection.find(c=>c.id===id);renderEbayCardSelect();populateEbayForm(selectedCardForEbay);}

function ebaySearchUrl(card){const p=[card.player,card.year,card.brand,card.cardNumber?'#'+card.cardNumber:'',card.parallel&&card.parallel!=='Base'?card.parallel:'',card.serialNumber||'',card.certGrader&&!card.aiGraded?card.certGrader:'',card.grade&&!card.aiGraded?card.grade.overall:''].filter(Boolean).join(' ').trim();return`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(p)}&LH_Sold=1&LH_Complete=1&_sop=13`;}
function open130point(card){if(!card)return;const p=[card.player,card.year,card.brand,card.parallel&&card.parallel!=='Base'?card.parallel:'',card.certGrader&&!card.aiGraded?card.certGrader:'',card.grade&&!card.aiGraded?card.grade.overall:''].filter(Boolean).join(' ').trim();navigator.clipboard.writeText(p).then(()=>showToast('Search copied — paste into 130point!','success')).catch(()=>showToast('Open 130point and search: '+p,'success'));window.open('https://130point.com/sales/','_blank');}

function populateEbayForm(card){
  if(!card)return;
  // Official grade only in title — never AI estimates (eBay policy + accuracy concerns)
  const officialGrade=!card.aiGraded&&card.grade?(card.certGrader||'PSA')+' '+card.grade.overall:'';
  const t=`${card.player} ${card.year||''} ${card.brand||''} ${card.cardNumber?'#'+card.cardNumber:''} ${card.parallel&&card.parallel!=='Base'?card.parallel:''} ${card.serialNumber||''} ${officialGrade}`.trim().replace(/\s+/g,' ');
  document.getElementById('ebayTitle').value=t.substring(0,80);
  if(card.estimatedValue){document.getElementById('ebayPrice').value=(parseFloat(card.estimatedValue)*0.7).toFixed(2);document.getElementById('ebayBIN').value=card.estimatedValue;}
  // ebayAppId and ebayToken fields removed from UI -- keys managed in Settings
  // const ebayAppIdEl=document.getElementById('ebayAppId'); if(ebayAppIdEl) ebayAppIdEl.value=getKeys().ebayApp||'';
  document.getElementById('ebayMarketResearch').style.display='block';
  document.getElementById('ebayResearchLink').href=ebaySearchUrl(card);
  const prev=document.getElementById('selectedCardPreview');
  prev.innerHTML=`<h3 style="font-size:13px;font-weight:500;color:var(--ice-dark);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Selected Card</h3><div style="display:flex;gap:12px;align-items:center;">${(card.imageUrl||card.imageData)?`<img src="${card.imageUrl||card.imageData}" style="width:60px;height:80px;object-fit:cover;border-radius:6px;">`:`<div style="width:60px;height:80px;background:var(--rink);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;">🏒</div>`}<div><div style="font-weight:600;font-size:15px;">${card.player}</div><div style="color:var(--text-muted);font-size:12px;">${card.year||''} · ${card.brand||''}</div>${card.grade?`<div style="margin-top:4px;"><span class="grade-badge grade-${gradeClass(card.grade.overall)}" style="font-size:11px;padding:2px 8px;">${card.aiGraded?'AI Est.':card.certGrader||'PSA'} ${card.grade.overall}</span></div>`:''}</div></div>`;
  prev.style.display='block';
}

let _ebayDescModel = 'claude';
function setEbayDescModel(model) {
  _ebayDescModel = model;
  ['claude','gpt4o','gemini'].forEach(m => {
    const btn = document.getElementById('ebayDescModel' + m.charAt(0).toUpperCase() + m.slice(1));
    if (btn) btn.className = 'grader-btn' + (m === model ? ' active' : '');
  });
  const costHints = { claude: '~$0.01–0.02 per description (Claude, paid)', gpt4o: '~$0.01–0.02 per description (GPT-4o, paid)', gemini: '~$0.001–0.01 per description (Gemini, free tier available)' };
  const hint = document.getElementById('ebayDescCostHint');
  if (hint) hint.textContent = '⚠ Optional — ' + (costHints[model] || costHints.claude) + '. Prices are estimates only.';
}

async function generateListingAI(){
  if(!selectedCardForEbay){showToast('Please select a card','error');return;}
  const ebayDescBtnEl=document.getElementById('ebayDescBtn');
  if(ebayDescBtnEl){ebayDescBtnEl.disabled=true;ebayDescBtnEl.innerHTML='<span class="spinner"></span> &nbsp; Generating...';}
  const keys=getKeys();
  const ebayDescKey = _ebayDescModel==='gpt4o'?keys.openai:_ebayDescModel==='gemini'?keys.gemini:keys.anthropic;
  const ebayDescLabel = _ebayDescModel==='gpt4o'?'OpenAI':_ebayDescModel==='gemini'?'Google AI':'Anthropic';
  if(!ebayDescKey){showToast('Add your '+ebayDescLabel+' API key in ⚙ Settings','error');return;}
  if(window._lastEbayData&&window._lastEbayData.description){document.getElementById('ebayDesc').value=window._lastEbayData.description;if(window._lastEbayData.title){const te=document.getElementById('ebayTitle');if(te&&!te.value)te.value=window._lastEbayData.title.substring(0,80);}showToast('eBay description loaded from scan!','success');window._lastEbayData=null;return;}
  const c=selectedCardForEbay;
  const gt=c.grade&&!c.aiGraded?`${c.certGrader||'PSA'} ${c.grade.overall} (officially graded)`:'Ungraded raw card';
  try{
    const ebayDescPrompt=`Write a factual eBay listing description for this hockey card. Be professional and straightforward. State the facts only -- do not upsell, exaggerate, use hype language, or make investment claims. Do not say things like "exploding in demand", "must-have", "phenomenal", "blue-chip", or similar sales language. If the card is not professionally graded, do not mention or imply any grade. Describe what the card is, its key features (autograph, patch, serial number if applicable), the set it comes from, and the player. Keep it honest and concise.\n\nPlayer: ${c.player}\nYear: ${c.year||'Unknown'}\nBrand/Set: ${c.brand||'Unknown'}\nCard #: ${c.cardNumber||'N/A'}\nTeam: ${c.team||'Unknown'}\nParallel: ${c.parallel||'Base'}\nCondition: ${gt}\nValue: $${c.estimatedValue||'N/A'}\n\nWrite 2-3 short paragraphs. No markdown. Under 200 words. Facts only.`;
    let res,data,desc;
    if(_ebayDescModel==='gpt4o'){
      res=await fetch(WORKER_URL+'/proxy/openai',{method:'POST',headers:{'Content-Type':'application/json','x-openai-key':keys.openai},body:JSON.stringify({model:'gpt-4o',max_tokens:600,messages:[{role:'user',content:ebayDescPrompt}]})});
      data=await res.json();if(data.error)throw new Error(data.error.message);desc=data.choices[0].message.content;
    }else if(_ebayDescModel==='gemini'){
      res=await fetch(WORKER_URL+'/proxy/gemini',{method:'POST',headers:{'Content-Type':'application/json','x-gemini-key':keys.gemini},body:JSON.stringify({model:'gemini-2.5-flash',contents:[{parts:[{text:ebayDescPrompt}]}]})});
      data=await res.json();if(data.error)throw new Error(data.error.message||JSON.stringify(data.error));desc=data.candidates[0].content.parts[0].text;
    }else{
      res=await fetch(WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json','x-api-key':keys.anthropic,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-opus-4-6',max_tokens:600,messages:[{role:'user',content:ebayDescPrompt}]})});
      data=await res.json();if(data.error)throw new Error(data.error.message);desc=data.content[0].text;
    }
    document.getElementById('ebayDesc').value=desc;
    showToast('AI description generated!','success');
  }catch(err){showToast('Generation failed: '+err.message,'error');}
  finally{if(ebayDescBtnEl){ebayDescBtnEl.disabled=false;ebayDescBtnEl.innerHTML='✦ &nbsp; Generate AI Description';}}
}

async function submitToEbay(){
  if(!selectedCardForEbay){showToast('Please select a card','error');return;}
  const token=getKeys().ebayToken;
  if(!token){showToast('Add your eBay Auth\'n\'Auth token in ⚙ Settings','error');return;}
  const re=document.getElementById('ebayResult');re.innerHTML='<span class="spinner"></span> Submitting...';
  const title=document.getElementById('ebayTitle').value,price=document.getElementById('ebayPrice').value,desc=document.getElementById('ebayDesc').value;
  const _sc = selectedCardForEbay;
  const _condDescId = document.getElementById('ebayCondition')?.value||'400012';
  const _cond = '4000'; // Ungraded -- ConditionID for sports trading cards

  const _loc = document.getElementById('ebayLocation')?.value||'Detroit, MI';
  const _lt = document.getElementById('ebayListingType')?.value||'FixedPriceItem';
  const _dur = document.getElementById('ebayDuration')?.value||'7 days';
  const _days = _dur.includes('30')?'GTC':_dur.includes('10')?'Days_10':_dur.includes('5')?'Days_5':_dur.includes('3')?'Days_3':'Days_7';
  const _bo = document.getElementById('ebayBestOffer')?.checked?'<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>':'';
  const _ship = document.getElementById('ebayShipping')?.value||'USPS First Class (Top Loader)';
  const _shipSvc = _ship.includes('USPSGroundAdvantage')?'USPSFirstClass':_ship.includes('USPSPriority')?'USPSPriority':_ship.includes('PWE')?'USPSFirstClass':'USPSFirstClass';
  const _shipCost = _ship.includes('Free')?'0.00':(document.getElementById('ebayShippingCost')?.value||'5.00');
  const _shipFree = _ship.includes('Free');
  const _graderXml = (!_sc.aiGraded&&_sc.grade)
    ? '<NameValueList><Name>Professional Grader</Name><Value>'+(_sc.certGrader||'PSA')+'</Value></NameValueList><NameValueList><Name>Grade</Name><Value>'+_sc.grade.overall+'</Value></NameValueList>'
    : '<NameValueList><Name>Professional Grader</Name><Value>Ungraded</Value></NameValueList>';
  const _picXml = _sc.imageUrl ? '<PictureDetails><PictureURL>'+_sc.imageUrl+'</PictureURL></PictureDetails>' : '';
  const _binXml = document.getElementById('ebayBIN')?.value ? '<BuyItNowPrice>'+document.getElementById('ebayBIN').value+'</BuyItNowPrice>' : '';
  const xml = '<?xml version="1.0" encoding="utf-8"?>'
    +'<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">'
    +'<RequesterCredentials><eBayAuthToken>'+token+'</eBayAuthToken></RequesterCredentials>'
    +'<Item>'
    +'<Title>'+title+'</Title>'
    +'<Description><![CDATA['+desc+']]></Description>'
    +'<PrimaryCategory><CategoryID>261328</CategoryID></PrimaryCategory>'
    +'<StartPrice>'+price+'</StartPrice>'+_binXml
    +'<ConditionID>'+_cond+'</ConditionID>'
    +'<ItemSpecifics>'
    +'<NameValueList><Name>Sport</Name><Value>Hockey</Value></NameValueList>'
    +'<NameValueList><Name>Card Manufacturer</Name><Value>'+(_sc.brand||'Unknown')+'</Value></NameValueList>'
    +'<NameValueList><Name>Season</Name><Value>'+(_sc.year||'Unknown')+'</Value></NameValueList>'
    +'<NameValueList><Name>Player</Name><Value>'+(_sc.player||'Unknown')+'</Value></NameValueList>'
    +_graderXml
    +'</ItemSpecifics>'
    +'<ConditionDescriptors>'
    +'<ConditionDescriptor><Name>40001</Name><Value>'+_condDescId+'</Value></ConditionDescriptor>'
    +'</ConditionDescriptors>'
    +_picXml
    +'<Country>US</Country><Currency>USD</Currency>'
    +'<Location>'+_loc+'</Location>'
    +'<DispatchTimeMax>3</DispatchTimeMax>'
    +'<ListingDuration>'+_days+'</ListingDuration>'
    +'<ListingType>'+_lt+'</ListingType>'
    +_bo
    +'<Quantity>1</Quantity>'
    +'<ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption></ReturnPolicy>'
    +'<ShippingDetails><ShippingType>Flat</ShippingType>'
    +'<ShippingServiceOptions><ShippingService>'+_shipSvc+'</ShippingService>'
    +'<ShippingServiceCost>'+(_shipFree?'0.00':_shipCost)+'</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>'
    +'<Site>US</Site></Item></AddItemRequest>';

  console.log('[eBay XML]', xml);
  try{
    const r=await fetch(WORKER_URL+'/proxy/ebay',{method:'POST',headers:{'Content-Type':'text/xml','x-ebay-call-name':'AddItem'},body:xml});
    const text=await r.text();
    if(text.includes('<Ack>Success</Ack>')||text.includes('<Ack>Warning</Ack>')){const im=text.match(/<ItemID>(\d+)<\/ItemID>/);const lid=im?im[1]:'Unknown';selectedCardForEbay.listedOnEbay=true;selectedCardForEbay.ebayListingId=lid;localStorage.setItem('iceVault_cards',JSON.stringify(collection));re.innerHTML=`<span style="color:var(--green);">✓ Listed! <a href="https://ebay.com/itm/${lid}" target="_blank" style="color:var(--ice-dark);">${lid}</a></span>`;showToast('Listed on eBay!','success');}
    else{
      console.log('[eBay SOAP response]', text);
      const em=text.match(/<ShortMessage>(.*?)<\/ShortMessage>/);
      const lm=text.match(/<LongMessage>(.*?)<\/LongMessage>/);
      throw new Error((em?em[1]:'Unknown eBay error')+(lm?' -- '+lm[1]:''));
    }
  }catch(err){re.innerHTML=`<span style="color:var(--red);">✕ ${err.message}</span>`;showToast('eBay listing failed','error');}
}

function clearEbayForm(){
  document.getElementById('ebayTitle').value='';
  document.getElementById('ebayPrice').value='';
  document.getElementById('ebayBIN').value='';
  document.getElementById('ebayDesc').value='';
  document.getElementById('ebayResult').innerHTML='';
  selectedCardForEbay=null;
  const prev=document.getElementById('selectedCardPreview');
  if(prev){prev.innerHTML='';prev.style.display='none';}
  document.getElementById('ebayMarketResearch').style.display='none';
  document.getElementById('listingPreview').style.display='none';
  // Re-render card list without auto-selecting
  renderEbayCardSelect._skipAutoSelect=true;
  renderEbayCardSelect();
  renderEbayCardSelect._skipAutoSelect=false;
  showToast('Form cleared -- select a card to list','success');
}
function simulateListing(){
  if(!selectedCardForEbay){showToast('Please select a card','error');return;}
  const c=selectedCardForEbay;
  const title=document.getElementById('ebayTitle').value||c.player;
  const price=document.getElementById('ebayPrice').value||'0';
  const bin=document.getElementById('ebayBIN').value||'';
  const desc=document.getElementById('ebayDesc').value||'No description added yet.';
  const condition=document.getElementById('ebayCondition')?.selectedOptions[0]?.text||'Very Good';
  const shipping=document.getElementById('ebayShipping')?.value||'';
  const shippingCost=document.getElementById('ebayShippingCost')?.value||'5.00';
  const location=document.getElementById('ebayLocation')?.value||'United States';
  const bestOffer=document.getElementById('ebayBestOffer')?.checked;
  const imgSrc=c.imageUrl||c.imageData||null;
  const isFree=shipping.includes('Free');
  const shipLabel=isFree?'Free shipping':'+ $'+parseFloat(shippingCost).toFixed(2)+' shipping';
  const shipService=shipping.includes('Priority')?'USPS Priority Mail':shipping.includes('PWE')?'USPS First Class (PWE)':shipping.includes('Top')?'USPS First Class (Top Loader)':'USPS Ground Advantage';
  document.getElementById('ebayPreviewModal').classList.add('open');
  document.getElementById('ebayPreviewContent').innerHTML=`
    <div style="font-size:11px;color:#777;margin-bottom:10px;">Sports Trading Cards &gt; Hockey &gt; Individual Cards</div>
    <div style="display:flex;gap:16px;margin-bottom:16px;">
      <div style="flex-shrink:0;">
        <div style="width:120px;height:160px;background:#f3f3f3;border:1px solid #ddd;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;margin-bottom:6px;">
          ${imgSrc?`<img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;">`:'<span style="color:#aaa;font-size:11px;">No image</span>'}
        </div>
        <div style="display:flex;gap:3px;">
          ${imgSrc?`<div style="width:36px;height:46px;border:2px solid #e53238;border-radius:2px;overflow:hidden;"><img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;"></div>`:''}
          <div style="width:36px;height:46px;border:1px solid #ddd;border-radius:2px;background:#f3f3f3;"></div>
        </div>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:15px;font-weight:600;color:#111;line-height:1.4;margin-bottom:8px;">${title}</div>
        <div style="font-size:12px;color:#777;margin-bottom:10px;">Condition: ${condition} &middot; Sport: Hockey &middot; Player: ${c.player}</div>
        <div style="font-size:24px;font-weight:600;color:#e53238;margin-bottom:2px;">US $${parseFloat(price).toFixed(2)}</div>
        ${bestOffer?'<div style="font-size:13px;color:#555;margin-bottom:8px;">or Best Offer</div>':''}
        <div style="font-size:12px;color:#777;margin-bottom:12px;">${shipLabel} &middot; ${shipService} &middot; ${location}</div>
        <div style="margin-bottom:8px;"><span style="background:#e53238;color:white;font-size:13px;font-weight:600;padding:8px 24px;border-radius:20px;">Buy It Now</span></div>
        ${bin?`<div style="font-size:12px;color:#777;margin-bottom:8px;">Buy It Now: US $${parseFloat(bin).toFixed(2)}</div>`:''}
        <div style="font-size:12px;color:#555;margin-bottom:4px;">&#9745; eBay Money Back Guarantee</div>
        <div style="font-size:12px;color:#777;">Seller: <span style="color:#0064d2;">YourUsername</span> &middot; Returns: Not accepted</div>
      </div>
    </div>
    <div style="border-top:2px solid #ddd;margin-bottom:0;">
      <div style="display:flex;">
        <div style="font-size:13px;padding:10px 16px;border-bottom:2px solid #e53238;color:#e53238;font-weight:500;">Description</div>
        <div style="font-size:13px;padding:10px 16px;color:#777;">Shipping</div>
        <div style="font-size:13px;padding:10px 16px;color:#777;">Returns</div>
        <div style="font-size:13px;padding:10px 16px;color:#777;">Payments</div>
      </div>
    </div>
    <div style="font-size:13px;color:#111;line-height:1.7;padding:12px 0;">${desc}</div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #ddd;font-size:11px;color:#aaa;text-align:center;font-style:italic;">Preview only -- not submitted to eBay</div>
  `;
  showToast('Preview generated','success');
}

function closeModal(id){document.getElementById(id).classList.remove('open');}

// -- STATS EXPORT: CSV --
function exportStatsCSV() {
  const allCards = collection;
  if (allCards.length === 0) { showToast('No cards to export', 'error'); return; }
  const headers = ['Player','Year','Brand','Parallel','Serial #','Collection','Grade','AI Graded','Est. Value','Value Date','Value Source','Sold','Sold Price','Sold Date'];
  const esc = v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g,'""'  ) + '"';
    return s;
  };
  const rows = [];
  allCards.forEach(c => {
    const baseRow = [c.player,c.year,c.brand,c.parallel||'Base',c.serialNumber||'',c.collection||'',c.grade?.overall||'',c.aiGraded?'Yes':'No'];
    const history = c.valueHistory || (c.estimatedValue ? [{ value: c.estimatedValue, date: c.addedAt||'', source: 'scan' }] : []);
    if (history.length === 0) {
      rows.push([...baseRow,'','','',c.sold?'Yes':'No',c.soldPrice||'',c.soldAt?new Date(c.soldAt).toLocaleDateString():''].map(esc).join(','));
    } else {
      history.forEach((h, i) => {
        rows.push([...baseRow,h.value,h.date?new Date(h.date).toLocaleDateString():'',h.source||'',
          i===history.length-1&&c.sold?'Yes':'No',
          i===history.length-1&&c.sold?(c.soldPrice||''):'',
          i===history.length-1&&c.sold?(c.soldAt?new Date(c.soldAt).toLocaleDateString():''):''
        ].map(esc).join(','));
      });
    }
  });
  const newline = String.fromCharCode(10);
  const csv = [headers.join(','), ...rows].join(newline);
  const date = new Date().toISOString().split('T')[0];
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'icevault-stats-' + date + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Stats CSV exported', 'success');
}

// -- STATS EXPORT: PDF --
async function exportStatsPDF() {
  const btn = document.getElementById('exportPDFBtn');
  if (btn) { btn.textContent = 'Generating...'; btn.disabled = true; }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, H = 297, margin = 14;
    const teal = [10,138,154], navy = [10,26,94], muted = [136,153,204];
    const light = [240,246,255], green = [26,140,80], red = [192,57,43];

    // Header
    doc.setFillColor(...teal);
    doc.rect(0, 0, W, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255,255,255);
    doc.text('Ice Vault -- Collection Stats Report', margin, 12);
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text('Generated ' + new Date().toLocaleDateString() + ' - ' + collection.filter(c=>!c.sold).length + ' active cards', W-margin, 12, {align:'right'});

    // Metrics
    const activeCards = collection.filter(c=>!c.sold);
    const soldCards = collection.filter(c=>c.sold);
    const totalVal = activeCards.reduce((s,c)=>s+(parseFloat(c.estimatedValue)||0),0);
    const totalSold = soldCards.reduce((s,c)=>s+(parseFloat(c.soldPrice)||0),0);
    const soldWithBoth = soldCards.filter(c=>c.soldPrice&&c.estimatedValue);
    const avgVsEst = soldWithBoth.length>0 ? soldWithBoth.reduce((s,c)=>s+((parseFloat(c.soldPrice)-parseFloat(c.estimatedValue))/parseFloat(c.estimatedValue)*100),0)/soldWithBoth.length : null;
    let bestFlip=null,bestFlipCard=null;
    soldWithBoth.forEach(c=>{const g=parseFloat(c.soldPrice)-parseFloat(c.estimatedValue);if(bestFlip===null||g>bestFlip){bestFlip=g;bestFlipCard=c;}});
    const metrics = [
      {label:'Collection Value',val:'$'+totalVal.toFixed(0),sub:activeCards.length+' active cards'},
      {label:'Total Sold',val:'$'+totalSold.toFixed(0),sub:soldCards.length+' cards sold'},
      {label:'Avg vs Estimate',val:avgVsEst!==null?(avgVsEst>=0?'+':'')+avgVsEst.toFixed(0)+'%':'--',sub:'sold vs AI est.'},
      {label:'Best Flip',val:bestFlip!==null?(bestFlip>=0?'+':'')+'$'+Math.abs(bestFlip).toFixed(0):'--',sub:bestFlipCard?bestFlipCard.player:'no sales yet'},
    ];
    const boxW=(W-margin*2-9)/4;
    metrics.forEach((m,i)=>{
      const x=margin+i*(boxW+3),y=22;
      doc.setFillColor(...light); doc.roundedRect(x,y,boxW,22,2,2,'F');
      doc.setFontSize(7); doc.setTextColor(...muted); doc.text(m.label.toUpperCase(),x+4,y+6);
      doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...navy); doc.text(m.val,x+4,y+14);
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(...muted); doc.text(m.sub,x+4,y+19);
    });

    // Charts
    const chartIds=['statsValueChart','statsSoldChart','statsGradeChart'];
    const chartTitles=['Collection value over time','Sold price vs AI estimate','Grade distribution'];
    const chartY=[48,48,126],chartX=[margin,W/2+2,margin];
    const chartW=[(W/2)-margin-2,(W/2)-margin-2,(W/2)-margin-2],chartH=[62,62,44];
    for(let i=0;i<chartIds.length;i++){
      const canvas=document.getElementById(chartIds[i]); if(!canvas)continue;
      doc.setFillColor(...light); doc.roundedRect(chartX[i],chartY[i],chartW[i],chartH[i]+8,2,2,'F');
      doc.setFontSize(7); doc.setTextColor(...muted); doc.text(chartTitles[i].toUpperCase(),chartX[i]+4,chartY[i]+5);
      try{ const imgData=canvas.toDataURL('image/png'); doc.addImage(imgData,'PNG',chartX[i]+2,chartY[i]+7,chartW[i]-4,chartH[i]-2); }
      catch(e){ doc.setTextColor(...muted); doc.text('Chart not available',chartX[i]+4,chartY[i]+20); }
    }

    // Bucket bars
    const buckets={};
    collection.forEach(c=>{const b=c.collection||'Personal';buckets[b]=(buckets[b]||0)+1;});
    const maxB=Math.max(...Object.values(buckets),1);
    const bY=126;
    doc.setFillColor(...light); doc.roundedRect(W/2+2,bY,(W/2)-margin-2,60,2,2,'F');
    doc.setFontSize(7); doc.setTextColor(...muted); doc.text('COLLECTION BY BUCKET',W/2+6,bY+5);
    let bRowY=bY+11;
    Object.entries(buckets).sort((a,b)=>b[1]-a[1]).forEach(([name,count])=>{
      doc.setFontSize(7); doc.setTextColor(...navy); doc.text(name,W/2+6,bRowY);
      const barX=W/2+36,barW=(W/2)-margin-42;
      doc.setFillColor(220,228,240); doc.rect(barX,bRowY-3.5,barW,4,'F');
      doc.setFillColor(...teal); doc.rect(barX,bRowY-3.5,Math.round((count/maxB)*barW),4,'F');
      doc.setTextColor(...muted); doc.text(String(count),W/2+6+barW+32,bRowY);
      bRowY+=8;
    });

    // Recent sales table -- always shown
    const tY=190;
    doc.setFontSize(7); doc.setTextColor(...muted); doc.text('RECENT SALES',margin,tY);
    doc.setDrawColor(...light); doc.line(margin,tY+2,W-margin,tY+2);
    if(soldCards.length===0){
      doc.setFontSize(7); doc.setTextColor(...muted);
      doc.text('No sales recorded yet -- mark cards as sold to see them here.',margin,tY+10);
    } else {
      const hdrs=['Card','AI Est.','Sold For','+/-','Date'];
      const colX=[margin,margin+90,margin+110,margin+130,margin+152];
      doc.setFontSize(7); doc.setTextColor(...muted);
      hdrs.forEach((h,i)=>doc.text(h,colX[i],tY+7));
      const sorted=[...soldCards].sort((a,b)=>new Date(b.soldAt)-new Date(a.soldAt)).slice(0,8);
      sorted.forEach((c,ri)=>{
        const ry=tY+13+(ri*7);
        const est=parseFloat(c.estimatedValue)||0,sold=parseFloat(c.soldPrice)||0;
        const diff=est>0?sold-est:null;
        doc.setFontSize(7); doc.setTextColor(...navy);
        doc.text((c.player+' '+c.year).substring(0,38),colX[0],ry);
        doc.setTextColor(...muted); doc.text(est>0?'$'+est.toFixed(0):'--',colX[1],ry);
        doc.setTextColor(...green); doc.text('$'+sold.toFixed(0),colX[2],ry);
        if(diff!==null){doc.setTextColor(...(diff>=0?green:red));doc.text((diff>=0?'+':'')+diff.toFixed(0),colX[3],ry);}
        doc.setTextColor(...muted); doc.text(c.soldAt?new Date(c.soldAt).toLocaleDateString():'--',colX[4],ry);
        if(ri<sorted.length-1){doc.setDrawColor(220,228,240);doc.line(margin,ry+2,W-margin,ry+2);}
      });
    }

    // Footer p1
    doc.setFontSize(7); doc.setTextColor(...muted);
    doc.text('Ice Vault - AI estimates only, not official grades',margin,H-6);
    doc.text('Page 1',W-margin,H-6,{align:'right'});

    // Per-card pages -- warn and chunk at 250
    const CHUNK=250;
    const totalCards=collection.length;
    const numFiles=Math.ceil(totalCards/CHUNK);
    if(totalCards>CHUNK){
      if(!confirm(`Your collection has ${totalCards} cards. This will create ${numFiles} PDF files of up to ${CHUNK} cards each. Each file is complete on its own \u2014 combine them externally if desired. A free tool like ilovepdf.com might work or your own methods. Continue?`)){
        if(btn){btn.innerHTML='&#x2B07; PDF';btn.disabled=false;}
        return;
      }
    }
    const cols=3,cardW=(W-margin*2-8)/3,cardH=68;
    const startX=margin,startY=22,cardsPerPage=9;
    for(let chunkIdx=0;chunkIdx<numFiles;chunkIdx++){
      const chunkStart=chunkIdx*CHUNK;
      const chunkEnd=Math.min(chunkStart+CHUNK,totalCards);
      const chunkCards=collection.slice(chunkStart,chunkEnd);
      const cdoc=chunkIdx===0?doc:new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    for(let ci=0;ci<chunkCards.length;ci++){
      if(ci%cardsPerPage===0){
        cdoc.addPage();
        cdoc.setFillColor(...teal); cdoc.rect(0,0,W,14,'F');
        cdoc.setFont('helvetica','bold'); cdoc.setFontSize(10); cdoc.setTextColor(255,255,255);
        cdoc.text('Ice Vault -- Card Collection',margin,9);
        cdoc.setFont('helvetica','normal'); cdoc.setFontSize(7);
        const pageLabel='Page '+(chunkIdx===0?Math.floor(ci/cardsPerPage)+2:Math.floor(ci/cardsPerPage)+1);
        const rangeLabel='Cards '+(chunkStart+ci+1)+'-'+Math.min(chunkStart+ci+cardsPerPage,chunkEnd);
        cdoc.text(pageLabel+' \u00b7 '+rangeLabel,W-margin,9,{align:'right'});
      }
      const c=chunkCards[ci];
      const col=ci%cols,row=Math.floor((ci%cardsPerPage)/cols);
      const x=startX+col*(cardW+4),y=startY+row*(cardH+4);
      cdoc.setFillColor(...light); cdoc.roundedRect(x,y,cardW,cardH,2,2,'F');
      const thumbW=22,thumbH=28;
      cdoc.setFillColor(220,228,240); cdoc.roundedRect(x+3,y+3,thumbW,thumbH,1,1,'F');
      if(c.imageUrl){
        try{
          const img=await loadImageAsBase64(c.imageUrl);
          cdoc.addImage(img,'JPEG',x+3,y+3,thumbW,thumbH);
        }catch(e){}
      }
      const tx=x+thumbW+6;
      cdoc.setFont('helvetica','bold'); cdoc.setFontSize(7.5); cdoc.setTextColor(...navy);
      cdoc.text(c.player.substring(0,22),tx,y+7);
      cdoc.setFont('helvetica','normal'); cdoc.setFontSize(6.5); cdoc.setTextColor(...muted);
      cdoc.text(((c.year||'')+' '+(c.brand||'')).substring(0,24).trim(),tx,y+11);
      const colHalf=(cardW-thumbW-12)/2;
      const stats=[['Est. Value',c.estimatedValue?'$'+c.estimatedValue:'--'],['Grade',c.grade?(c.aiGraded?'AI ':'')+c.grade.overall:'--'],['Parallel',(c.parallel||'Base').substring(0,10)],['Serial #',(c.serialNumber||'--').substring(0,8)],['Team',(c.team||'--').substring(0,12)]];
      stats.forEach(([label,val],si)=>{
        const sx=tx+(si%2)*colHalf,sy=y+16+(Math.floor(si/2)*8);
        cdoc.setFontSize(6); cdoc.setTextColor(...muted); cdoc.text(label,sx,sy);
        cdoc.setFontSize(6.5); cdoc.setTextColor(...navy); cdoc.setFont('helvetica','bold');
        cdoc.text(val,sx,sy+4,{maxWidth:colHalf-2});
        cdoc.setFont('helvetica','normal');
      });
      if(c.sold){
        cdoc.setFillColor(...green); cdoc.roundedRect(tx,y+33,cardW-thumbW-12,5,1,1,'F');
        cdoc.setFontSize(5.5); cdoc.setTextColor(255,255,255);
        cdoc.text('Sold $'+c.soldPrice+' - '+(c.soldAt?new Date(c.soldAt).toLocaleDateString():'--'),tx+2,y+36.5);
      }
      const history=c.valueHistory||(c.estimatedValue?[{value:c.estimatedValue}]:[]);
      if(history.length>0){
        const barAreaX=x+3,barAreaY=y+34,barAreaW=cardW-6,barAreaH=12;
        cdoc.setFontSize(5.5); cdoc.setTextColor(...muted); cdoc.text('VALUE HISTORY',barAreaX,barAreaY);
        const maxV=Math.max(...history.map(h=>parseFloat(h.value)||0),1);
        const barW2=Math.min(8,(barAreaW-4)/history.length);
        history.forEach((h,hi)=>{
          const bh=Math.max(1,((parseFloat(h.value)||0)/maxV)*(barAreaH-4));
          const bx=barAreaX+2+hi*(barW2+1),by=barAreaY+barAreaH-bh;
          const isSold=c.sold&&hi===history.length-1;
          cdoc.setFillColor(...(isSold?green:teal)); cdoc.rect(bx,by,Math.max(1.5,barW2-0.5),bh,'F');
        });
        cdoc.setFontSize(5); cdoc.setTextColor(...muted);
        cdoc.text('$'+history[0].value,barAreaX+2,barAreaY+barAreaH+3);
        if(history.length>1) cdoc.text('$'+history[history.length-1].value,barAreaX+barAreaW-8,barAreaY+barAreaH+3);
      }
    } // end card loop
      cdoc.setFontSize(7); cdoc.setTextColor(...muted);
      cdoc.text('Ice Vault - AI estimates only, not official grades',margin,H-6);
      const date=new Date().toISOString().split('T')[0];
      const suffix=numFiles>1?'-cards-'+(chunkStart+1)+'-'+chunkEnd:'-stats';
      cdoc.save('icevault'+suffix+'-'+date+'.pdf');
    } // end chunk loop
    showToast(numFiles>1?numFiles+' PDFs exported!':'PDF exported!', 'success');
  } catch(e) {
    console.error('PDF export error:',e);
    showToast('PDF export failed: '+e.message, 'error');
  }
  if(btn){btn.innerHTML='&#x2B07; PDF';btn.disabled=false;}
}

function loadImageAsBase64(url) {
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=img.width;canvas.height=img.height;
      canvas.getContext('2d').drawImage(img,0,0);
      resolve(canvas.toDataURL('image/jpeg',0.7));
    };
    img.onerror=reject;
    img.src=url;
  });
}

let _statsCharts = {};

function renderStats() {
  const activeCards = collection.filter(c => !c.sold);
  const soldCards = collection.filter(c => c.sold);

  // ── Summary metrics ──
  const totalVal = activeCards.reduce((s,c) => s+(parseFloat(c.estimatedValue)||0), 0);
  const totalSold = soldCards.reduce((s,c) => s+(parseFloat(c.soldPrice)||0), 0);
  const soldWithBoth = soldCards.filter(c => c.soldPrice && c.estimatedValue);
  const avgVsEst = soldWithBoth.length > 0
    ? soldWithBoth.reduce((s,c) => s+((parseFloat(c.soldPrice)-parseFloat(c.estimatedValue))/parseFloat(c.estimatedValue)*100), 0) / soldWithBoth.length
    : null;

  document.getElementById('statsCollectionValue').textContent = '$'+totalVal.toFixed(0);
  document.getElementById('statsActiveCards').textContent = activeCards.length + ' active card' + (activeCards.length !== 1 ? 's' : '');
  document.getElementById('statsTotalSold').textContent = '$'+totalSold.toFixed(0);
  document.getElementById('statsSoldCount').textContent = soldCards.length + ' card' + (soldCards.length !== 1 ? 's' : '') + ' sold';
  document.getElementById('statsVsEst').textContent = avgVsEst !== null ? (avgVsEst >= 0 ? '+' : '') + avgVsEst.toFixed(0) + '%' : '—';
  if(avgVsEst !== null) document.getElementById('statsVsEst').style.color = avgVsEst >= 0 ? 'var(--green)' : 'var(--red)';

  // Best flip
  let bestFlip = null, bestFlipCard = null;
  soldWithBoth.forEach(c => {
    const gain = parseFloat(c.soldPrice) - parseFloat(c.estimatedValue);
    if(bestFlip === null || gain > bestFlip) { bestFlip = gain; bestFlipCard = c; }
  });
  document.getElementById('statsBestFlip').textContent = bestFlip !== null ? (bestFlip >= 0 ? '+' : '') + '$' + Math.abs(bestFlip).toFixed(0) : '—';
  document.getElementById('statsBestFlipCard').textContent = bestFlipCard ? bestFlipCard.player : 'no sales yet';

  // ── Collection value over time ──
  // Build timeline from all valueHistory entries across active cards
  const allEntries = [];
  activeCards.forEach(c => {
    (c.valueHistory || []).forEach(e => allEntries.push({ date: e.date, value: parseFloat(e.value)||0, cardId: c.id }));
  });
  allEntries.sort((a,b) => new Date(a.date)-new Date(b.date));

  // Group by month, sum latest value per card per month
  const monthMap = {};
  const cardLatest = {};
  allEntries.forEach(e => {
    const month = e.date.slice(0,7); // YYYY-MM
    cardLatest[e.cardId] = e.value;
    monthMap[month] = Object.values(cardLatest).reduce((s,v) => s+v, 0);
  });
  const months = Object.keys(monthMap).sort();
  const monthLabels = months.map(m => { const [y,mo] = m.split('-'); return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo)-1]+' '+y.slice(2); });
  const monthValues = months.map(m => parseFloat(monthMap[m].toFixed(2)));

  const teal = getComputedStyle(document.documentElement).getPropertyValue('--ice-dark').trim() || '#0a8a9a';
  const border = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || 'rgba(74,156,201,0.2)';
  const textMuted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#4A6A8A';

  if(_statsCharts.value) { _statsCharts.value.destroy(); }
  const vCtx = document.getElementById('statsValueChart');
  if(vCtx) {
    _statsCharts.value = new Chart(vCtx, {
      type: 'line',
      data: {
        labels: monthLabels.length ? monthLabels : ['No data'],
        datasets: [{ data: monthValues.length ? monthValues : [0], borderColor: teal, backgroundColor: teal+'22', fill: true, tension: 0.4, pointBackgroundColor: teal, pointRadius: 3, borderWidth: 2 }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales: { x:{grid:{display:false},ticks:{color:textMuted,font:{size:10}}}, y:{ticks:{color:textMuted,font:{size:10},callback:v=>'$'+v.toLocaleString()},grid:{color:border}} } }
    });
  }

  // ── Sold vs estimate bar chart ──
  if(_statsCharts.sold) { _statsCharts.sold.destroy(); }
  const sCtx = document.getElementById('statsSoldChart');
  if(sCtx) {
    const soldLabels = soldCards.slice(-8).map(c => c.player.split(' ').pop());
    const soldEst = soldCards.slice(-8).map(c => parseFloat(c.estimatedValue)||0);
    const soldPrices = soldCards.slice(-8).map(c => parseFloat(c.soldPrice)||0);
    _statsCharts.sold = new Chart(sCtx, {
      type: 'bar',
      data: {
        labels: soldLabels.length ? soldLabels : ['No sales'],
        datasets: [
          { label:'AI Est.', data:soldEst.length?soldEst:[0], backgroundColor: border, borderWidth:0 },
          { label:'Sold', data:soldPrices.length?soldPrices:[0], backgroundColor: teal, borderWidth:0 }
        ]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:true,labels:{color:textMuted,font:{size:10},boxWidth:12}}},
        scales: { x:{grid:{display:false},ticks:{color:textMuted,font:{size:10}}}, y:{ticks:{color:textMuted,font:{size:10},callback:v=>'$'+v},grid:{color:border}} } }
    });
  }

  // ── Grade distribution ──
  if(_statsCharts.grade) { _statsCharts.grade.destroy(); }
  const gCtx = document.getElementById('statsGradeChart');
  if(gCtx) {
    const gradeBuckets = {'9-10':0,'8-8.9':0,'7-7.9':0,'<7':0,'Ungraded':0};
    activeCards.forEach(c => {
      if(!c.grade) { gradeBuckets['Ungraded']++; return; }
      const g = parseFloat(c.grade.overall);
      if(g>=9) gradeBuckets['9-10']++;
      else if(g>=8) gradeBuckets['8-8.9']++;
      else if(g>=7) gradeBuckets['7-7.9']++;
      else gradeBuckets['<7']++;
    });
    _statsCharts.grade = new Chart(gCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(gradeBuckets),
        datasets: [{ data: Object.values(gradeBuckets), backgroundColor: [teal, teal+'bb', teal+'88', teal+'55', border], borderWidth:0, borderRadius:4 }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales: { x:{grid:{display:false},ticks:{color:textMuted,font:{size:10}}}, y:{ticks:{color:textMuted,font:{size:10},stepSize:1},grid:{color:border}} } }
    });
  }

  // ── Collection by bucket bars ──
  const buckets = {};
  collection.forEach(c => { const b = c.collection||'Personal'; buckets[b] = (buckets[b]||0)+1; });
  const maxB = Math.max(...Object.values(buckets), 1);
  const barsEl = document.getElementById('statsBucketBars');
  if(barsEl) {
    barsEl.innerHTML = Object.entries(buckets).sort((a,b)=>b[1]-a[1]).map(([name,count]) => `
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;">
        <span style="width:80px;color:var(--text-secondary);flex-shrink:0;">${name}</span>
        <div style="flex:1;height:8px;background:var(--rink);border-radius:4px;overflow:hidden;">
          <div style="width:${Math.round((count/maxB)*100)}%;height:100%;background:var(--ice-dark);border-radius:4px;"></div>
        </div>
        <span style="width:24px;text-align:right;color:var(--text-primary);font-weight:500;">${count}</span>
      </div>`).join('');
  }

  // ── Recent sales table ──
  const salesEl = document.getElementById('statsRecentSales');
  if(salesEl) {
    if(soldCards.length === 0) {
      salesEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">No sales recorded yet — mark cards as sold to see them here.</div>';
    } else {
      const sorted = [...soldCards].sort((a,b) => new Date(b.soldAt)-new Date(a.soldAt));
      salesEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:6px 0;font-size:10px;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.06em;">Card</th>
          <th style="text-align:right;padding:6px 0;font-size:10px;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.06em;">AI Est.</th>
          <th style="text-align:right;padding:6px 0;font-size:10px;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.06em;">Sold For</th>
          <th style="text-align:right;padding:6px 0;font-size:10px;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.06em;">+/−</th>
          <th style="text-align:right;padding:6px 0;font-size:10px;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.06em;">Date</th>
        </tr></thead>
        <tbody>${sorted.map(c => {
          const est = parseFloat(c.estimatedValue)||0;
          const sold = parseFloat(c.soldPrice)||0;
          const diff = est > 0 ? sold - est : null;
          const diffStr = diff !== null ? (diff >= 0 ? '+' : '') + '$' + Math.abs(diff).toFixed(0) : '—';
          const diffColor = diff === null ? 'var(--text-muted)' : diff >= 0 ? 'var(--green)' : 'var(--red)';
          return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:7px 0;color:var(--text-primary);">${c.player}<span style="color:var(--text-muted);font-size:11px;"> · ${c.year||''} ${c.brand||''}</span></td>
            <td style="text-align:right;color:var(--text-secondary);">${est > 0 ? '$'+est.toFixed(0) : '—'}</td>
            <td style="text-align:right;color:var(--green);font-weight:500;">$${sold.toFixed(0)}</td>
            <td style="text-align:right;color:${diffColor};font-weight:500;">${diffStr}</td>
            <td style="text-align:right;color:var(--text-muted);font-size:11px;">${c.soldAt ? new Date(c.soldAt).toLocaleDateString() : '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
    }
  }
}

function updateHeaderStats(){
  const activeCards = collection.filter(c=>!c.sold);
  const soldCards = collection.filter(c=>c.sold);
  document.getElementById('statTotal').textContent=isServerPaginated?totalCards:activeCards.length;
  document.getElementById('statListed').textContent=collection.filter(c=>c.listedOnEbay).length;
  const val=activeCards.reduce((s,c)=>s+(parseFloat(c.estimatedValue)||0),0);
  document.getElementById('statValue').textContent='$'+val.toFixed(0);
  const s=document.getElementById('sbStatTotal'),sv=document.getElementById('sbStatValue'),badge=document.getElementById('sbBadgeCollection');
  if(s)s.textContent=isServerPaginated?totalCards:activeCards.length;
  if(sv)sv.textContent='$'+val.toFixed(0);
  const sbListed=document.getElementById('sbStatListed');if(sbListed)sbListed.textContent=collection.filter(c=>c.listedOnEbay).length;
  if(badge){badge.textContent=activeCards.length;badge.style.display=activeCards.length>0?'inline':'none';}
  // Sold + vs est topbar stats
  const totalSoldRev = soldCards.reduce((s,c)=>s+(parseFloat(c.soldPrice)||0),0);
  const sbSold = document.getElementById('sbStatSold');
  const sbVsEst = document.getElementById('sbStatVsEst');
  if(sbSold) sbSold.textContent = '$'+totalSoldRev.toFixed(0);
  if(sbVsEst && soldCards.length > 0) {
    const soldWithBoth = soldCards.filter(c=>c.soldPrice&&c.estimatedValue);
    if(soldWithBoth.length > 0) {
      const avgPct = soldWithBoth.reduce((s,c)=>{
        const diff = ((parseFloat(c.soldPrice)-parseFloat(c.estimatedValue))/parseFloat(c.estimatedValue))*100;
        return s+diff;
      },0) / soldWithBoth.length;
      const sign = avgPct >= 0 ? '+' : '';
      sbVsEst.textContent = sign + avgPct.toFixed(0) + '%';
      sbVsEst.style.color = avgPct >= 0 ? 'var(--green)' : 'var(--red)';
    }
  } else if(sbVsEst) { sbVsEst.textContent = '—'; }
  // Classic header -- Sold + Vs Est.
  const statSoldEl=document.getElementById('statSold');
  const statVsEstEl=document.getElementById('statVsEst');
  if(statSoldEl)statSoldEl.textContent='$'+soldCards.reduce((s,c)=>s+(parseFloat(c.soldPrice)||0),0).toFixed(0);
  if(statVsEstEl){
    const sw2=soldCards.filter(c=>c.soldPrice&&c.estimatedValue);
    if(sw2.length>0){const ap2=sw2.reduce((s,c)=>{return s+((parseFloat(c.soldPrice)-parseFloat(c.estimatedValue))/parseFloat(c.estimatedValue)*100);},0)/sw2.length;statVsEstEl.textContent=(ap2>=0?'+':'')+ap2.toFixed(0)+'%';statVsEstEl.style.color=ap2>=0?'var(--green)':'var(--red)';}
    else{statVsEstEl.textContent='—';}
  }
}


const PHOTO_TIPS_CARD = [
  { icon: '\u2600\ufe0f', title: 'Use natural light', body: 'Near a window works best. Avoid flash \u2014 it causes glare on foil, refractor, and holographic cards and will reduce grading accuracy.' },
  { icon: '\u2b1b', title: 'Plain background', body: 'Place the card on a plain dark or white surface. Avoid clutter \u2014 it helps the AI locate card edges accurately.' },
  { icon: '\uD83D\uDD0D', title: 'Tap to focus, hold still', body: 'Tap the card on your screen to focus before shooting. Keep the camera steady \u2014 blurry text reduces OCR accuracy.' },
  { icon: '\uD83D\uDDBB', title: 'Fill the frame', body: 'Get close enough that the card fills most of the photo, leaving a small border. Don\u2019t crop into the card edges.' },
  { icon: '\u26a0\ufe0f', title: 'Remove sleeves if possible', body: 'Toploaders and penny sleeves add distortion and reflections. Remove them for best results. If you can\u2019t, note it affects grading accuracy.' },
  { icon: '\uD83D\uDD04', title: 'Always include the back', body: 'The back contains the card number, serial number, and parallel info. Including it significantly improves scan accuracy.' },
];

const PHOTO_TIPS_SLAB = [
  { icon: '\u2600\ufe0f', title: 'Use natural light', body: 'Near a window works best. Avoid flash \u2014 it causes glare through the plastic case.' },
  { icon: '\u2b1b', title: 'Plain background', body: 'Place the slab on a plain dark or white surface. Clutter makes it harder for the AI to read the label.' },
  { icon: '\uD83D\uDD0D', title: 'Tap to focus, hold still', body: 'Tap the label on your screen to focus before shooting. Keep the camera steady \u2014 blurry labels reduce read accuracy.' },
  { icon: '\uD83D\uDDBB', title: 'Fill the frame', body: 'Get close enough that the slab fills most of the photo, leaving a small border.' },
  { icon: '\uD83D\uDCA1', title: 'Angle to avoid case glare', body: 'Tilt the slab slightly (5\u201310\u00b0) so light doesn\u2019t reflect directly off the plastic into the lens.' },
  { icon: '\uD83E\uddf9', title: 'Clean the case first', body: 'Wipe the plastic case with a microfibre cloth before shooting to remove fingerprints and dust.' },
  { icon: '\uD83D\uDD04', title: 'Include the back', body: 'The slab back often has additional cert info. Include it when possible for best results.' },
];

function openPhotoTipsModal(type) {
  const tips = type === 'slab' ? PHOTO_TIPS_SLAB : PHOTO_TIPS_CARD;
  const title = type === 'slab' ? 'Slab photography tips' : 'Card photography tips';
  const rows = tips.map(t => `
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px;">
      <div style="font-size:20px;width:32px;text-align:center;flex-shrink:0;margin-top:1px;">${t.icon}</div>
      <div>
        <div style="font-size:13px;font-weight:500;color:var(--text-primary);margin-bottom:2px;">${t.title}</div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;">${t.body}</div>
      </div>
    </div>`).join('');
  document.getElementById('photoTipsContent').innerHTML = `
    <div style="font-family:'Bebas Neue',cursive;font-size:20px;letter-spacing:1px;color:var(--ice-dark);margin-bottom:4px;">${title}</div>
    <div style="margin-top:14px;">${rows}</div>
    <div style="margin-top:12px;padding:10px 12px;background:var(--rink);border-radius:8px;border:1px solid var(--border);font-size:11px;color:var(--text-muted);line-height:1.5;">
      AI grading accuracy depends on photo quality. Ice Vault is not responsible for inaccurate grades resulting from poor lighting, glare, or distortion.
    </div>`;
  document.getElementById('photoTipsModal').classList.add('open');
}

function showToast(msg,type='success'){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+type+' show';setTimeout(()=>t.className='toast',3000);}
function togglePasswordVisibility(id,btn){const i=document.getElementById(id);if(!i)return;if(i.type==='password'){i.type='text';btn.textContent='🙈';}else{i.type='password';btn.textContent='👁';}}

const WORKER_URL='https://lingering-breeze-fb87.mtouch01.workers.dev';
let currentUser=null,authToken=null;
function getAuthToken(){return localStorage.getItem('iceVault_authToken');}
function setAuthToken(t){localStorage.setItem('iceVault_authToken',t);authToken=t;}
function clearAuthToken(){localStorage.removeItem('iceVault_authToken');authToken=null;}

async function verifySession(){
  const token=getAuthToken();if(!token)return updateAuthUI(null);
  try{const r=await fetch(WORKER_URL+'/auth/verify',{headers:{'Authorization':'Bearer '+token}});if(r.ok){const d=await r.json();currentUser={email:d.email,userId:d.userId,displayName:d.displayName||null};authToken=token;updateAuthUI(currentUser);if(!currentUser.displayName){document.getElementById('displayNameModal').classList.add('open');return;}await syncCollectionFromCloud();}else{clearAuthToken();updateAuthUI(null);}}
  catch{updateAuthUI(null);}
}

function updateAuthUI(user){
  const btn=document.getElementById('accountBtn'),sbBtn=document.getElementById('sbAccountBtn'),sbAv=document.getElementById('sbAvatar'),sbUn=document.getElementById('sbUsername'),sbUs=document.getElementById('sbUsersub'),sw=document.getElementById('scanGuestWarning'),cw=document.getElementById('certGuestWarning');
  const shareBtn=document.getElementById('shareCollectionBtn');
  if(user){
    const ini=user.email.substring(0,2).toUpperCase();
    if(btn){btn.textContent='✓ '+user.email.split('@')[0];btn.className='auth-btn signed-in';}
    if(sbBtn){sbBtn.textContent='✓ '+user.email.split('@')[0];sbBtn.className='topbar-account-btn signed-in';}
    if(sbAv)sbAv.textContent=ini;if(sbUn)sbUn.textContent=user.email.split('@')[0];if(sbUs)sbUs.textContent='Signed in · synced';
    if(sw)sw.style.display='none';if(cw)cw.style.display='none';
    if(shareBtn)shareBtn.style.display='flex';
  }else{
    if(btn){btn.textContent='👤 Sign In';btn.className='auth-btn';}
    if(sbBtn){sbBtn.textContent='👤 Sign In';sbBtn.className='topbar-account-btn';}
    if(sbAv)sbAv.textContent='?';if(sbUn)sbUn.textContent='Guest Mode';if(sbUs)sbUs.textContent='Click to sign in';
    if(sw)sw.style.display='flex';
    if(shareBtn)shareBtn.style.display='none';
  }
}

function openAuthModal(){
  const m=document.getElementById('authModal'),si=document.getElementById('authSignedInContent'),f=document.getElementById('authModalContent');
  if(currentUser){
    document.getElementById('authSignedInEmail').textContent=currentUser.email;
    const dnEl=document.getElementById('authSignedInDisplayName');
    if(dnEl)dnEl.textContent=currentUser.displayName?'Display name: '+currentUser.displayName:'No display name set';
    f.style.display='none';si.style.display='block';
  }
  else{f.style.display='block';si.style.display='none';}
  m.classList.add('open');
}

function switchAuthTab(tab){
  document.getElementById('authTabSignin').className='auth-tab'+(tab==='signin'?' active':'');
  document.getElementById('authTabSignup').className='auth-tab'+(tab==='signup'?' active':'');
  document.getElementById('authSignupExtra').style.display=tab==='signup'?'block':'none';
  document.getElementById('authPasswordField').style.display=tab==='forgot'?'none':'block';
  document.getElementById('authForgotLink').style.display=tab==='signin'?'block':'none';
  document.getElementById('authForgotPanel').style.display=tab==='forgot'?'block':'none';
  document.getElementById('authSubmitBtn').textContent=tab==='signup'?'Create Account':tab==='forgot'?'Send Reset Email':'Sign In';
  document.getElementById('authError').textContent='';
  document.getElementById('authSuccess').style.display='none';
}

async function submitAuth(){
  const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value;
  const isSignup=document.getElementById('authTabSignup').classList.contains('active');
  const isForgot=document.getElementById('authSubmitBtn').textContent==='Send Reset Email';
  const btn=document.getElementById('authSubmitBtn'),errEl=document.getElementById('authError'),succEl=document.getElementById('authSuccess');
  errEl.textContent='';succEl.style.display='none';
  if(!email){errEl.textContent='Please enter your email';return;}
  if(isForgot){
    btn.textContent='Sending...';btn.disabled=true;
    try{await fetch(WORKER_URL+'/auth/forgot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});succEl.textContent='If that email has an account, a reset link has been sent.';succEl.style.display='block';}
    catch{errEl.textContent='Connection error — try again';}
    finally{btn.textContent='Send Reset Email';btn.disabled=false;}
    return;
  }
  if(!password){errEl.textContent='Please enter your password';return;}
  if(isSignup){const c=document.getElementById('authPasswordConfirm').value;if(password!==c){errEl.textContent='Passwords do not match';return;}if(password.length<6){errEl.textContent='Password must be at least 6 characters';return;}}
  btn.textContent=isSignup?'Creating account...':'Signing in...';btn.disabled=true;
  try{
    const r=await fetch(WORKER_URL+(isSignup?'/auth/signup':'/auth/login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(isSignup?{email,password,displayName:(document.getElementById('authDisplayName')?.value||'').trim()}:{email,password})});
    const d=await r.json();if(!r.ok){errEl.textContent=d.error||'Something went wrong';return;}
    // Handle email verification required (new signup)
    if(d.needsVerification){
      showVerificationPending(d.email);
      return;
    }
    setAuthToken(d.token);currentUser={email:d.email,userId:d.userId,displayName:d.displayName||null};updateAuthUI(currentUser);
    if(!currentUser.displayName){closeModal('authModal');document.getElementById('displayNameModal').classList.add('open');return;}
    if(collection.length>0){collection=await migrateLocalImagesToR2(collection);await syncCollectionToCloud();}else await syncCollectionFromCloud();
    closeModal('authModal');showToast(isSignup?'Account created! Collection synced.':'Signed in! Collection synced.','success');
  }catch{errEl.textContent='Connection error — try again';}
  finally{btn.textContent=isSignup?'Create Account':'Sign In';btn.disabled=false;}
}

async function checkResetToken(){
  const p=new URLSearchParams(window.location.search),rt=p.get('reset');if(!rt)return;
  window.history.replaceState({},'',window.location.pathname);
  document.getElementById('authModalContent').style.display='block';document.getElementById('authSignedInContent').style.display='none';document.getElementById('authModal').classList.add('open');
  document.getElementById('authModalContent').innerHTML=`<div style="font-family:'Bebas Neue',cursive;font-size:24px;letter-spacing:2px;color:var(--ice-dark);margin-bottom:4px;">Reset Password</div><div style="font-size:13px;color:var(--text-muted);margin-bottom:18px;">Enter your new password — must be at least 6 characters</div><div class="result-field"><div class="result-label">New Password</div><div style="position:relative;"><input type="password" class="result-input" id="resetNewPassword" placeholder="••••••••" style="width:100%;padding-right:40px;"><button onclick="togglePasswordVisibility('resetNewPassword',this)" type="button" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:0;">👁</button></div></div><div class="result-field" style="margin-top:10px;"><div class="result-label">Confirm New Password</div><div style="position:relative;margin-top:4px;"><input type="password" class="result-input" id="resetConfirmPassword" placeholder="••••••••" style="width:100%;padding-right:40px;"><button onclick="togglePasswordVisibility('resetConfirmPassword',this)" type="button" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:0;">👁</button></div></div><button class="save-btn" style="margin-top:14px;" onclick="submitReset('${rt}')">Set New Password</button><div id="resetError" style="margin-top:10px;font-size:13px;color:#E74C3C;text-align:center;"></div><div id="resetSuccess" style="margin-top:10px;font-size:13px;color:var(--green);text-align:center;display:none;"></div>`;
}

async function submitReset(token){
  const pw=document.getElementById('resetNewPassword').value,cf=document.getElementById('resetConfirmPassword').value;
  const err=document.getElementById('resetError'),succ=document.getElementById('resetSuccess');
  err.textContent='';succ.style.display='none';
  if(!pw){err.textContent='Enter a new password';return;}if(pw.length<6){err.textContent='Password must be at least 6 characters';return;}if(pw!==cf){err.textContent='Passwords do not match';return;}
  const btn=document.querySelector('#authModalContent .save-btn');if(btn){btn.textContent='Saving...';btn.disabled=true;}
  try{
    const r=await fetch(WORKER_URL+'/auth/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:pw})});
    const d=await r.json();if(!r.ok){err.textContent=d.error||'Reset failed — link may have expired';if(btn){btn.textContent='Set New Password';btn.disabled=false;}return;}
    succ.textContent='✓ Password changed!';succ.style.display='block';if(btn)btn.style.display='none';
    setTimeout(()=>{closeModal('authModal');showToast('Password reset! Sign in with your new password.','success');},1500);
  }catch{err.textContent='Connection error — try again';if(btn){btn.textContent='Set New Password';btn.disabled=false;}}
}


async function changePassword() {
  const current = document.getElementById('changePwCurrent').value;
  const newPw = document.getElementById('changePwNew').value;
  const confirm = document.getElementById('changePwConfirm').value;
  const errEl = document.getElementById('changePwError');
  const succEl = document.getElementById('changePwSuccess');
  errEl.style.display = 'none';
  succEl.style.display = 'none';

  if (!current) { errEl.textContent = 'Enter your current password'; errEl.style.display = 'block'; return; }
  if (!newPw) { errEl.textContent = 'Enter a new password'; errEl.style.display = 'block'; return; }
  if (newPw.length < 8) { errEl.textContent = 'Password must be at least 8 characters'; errEl.style.display = 'block'; return; }
  if (!/[a-zA-Z]/.test(newPw)) { errEl.textContent = 'Password must contain at least one letter'; errEl.style.display = 'block'; return; }
  if (!/[0-9]/.test(newPw)) { errEl.textContent = 'Password must contain at least one number'; errEl.style.display = 'block'; return; }
  if (!/[^a-zA-Z0-9]/.test(newPw)) { errEl.textContent = 'Password must contain at least one symbol'; errEl.style.display = 'block'; return; }
  if (newPw !== confirm) { errEl.textContent = 'New passwords do not match'; errEl.style.display = 'block'; return; }
  if (newPw === current) { errEl.textContent = 'New password must be different from current'; errEl.style.display = 'block'; return; }

  const btn = document.querySelector('#authSignedInContent .save-btn');
  if (btn) { btn.textContent = 'Updating...'; btn.disabled = true; }

  try {
    const r = await fetch(WORKER_URL + '/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
      body: JSON.stringify({ currentPassword: current, newPassword: newPw })
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || 'Failed to update password'; errEl.style.display = 'block'; return; }
    succEl.textContent = '✓ Password updated successfully';
    succEl.style.display = 'block';
    document.getElementById('changePwCurrent').value = '';
    document.getElementById('changePwNew').value = '';
    document.getElementById('changePwConfirm').value = '';
  } catch (e) {
    errEl.textContent = 'Connection error — try again';
    errEl.style.display = 'block';
  } finally {
    if (btn) { btn.textContent = 'Update Password'; btn.disabled = false; }
  }
}

function openChangeDisplayName() {
  const newName = prompt('New display name (max 32 chars):', currentUser.displayName || '');
  if (!newName || !newName.trim()) return;
  const val = newName.trim();
  if (val.length > 32) { showToast('Max 32 characters', 'error'); return; }
  if (!/^[a-zA-Z0-9 _.\-]+$/.test(val)) { showToast('Letters, numbers, spaces, _ - . only', 'error'); return; }
  const emailPfx = currentUser?.email ? currentUser.email.split('@')[0].toLowerCase() : '';
  if (emailPfx && (val.toLowerCase() === emailPfx || val.toLowerCase().includes(emailPfx))) { showToast('Display name cannot match or contain your email username', 'error'); return; }
  fetch(WORKER_URL + '/auth/display-name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
    body: JSON.stringify({ displayName: val })
  }).then(r => r.json()).then(d => {
    if (d.ok) {
      currentUser.displayName = val;
      const dnEl = document.getElementById('authSignedInDisplayName');
      if (dnEl) dnEl.textContent = 'Display name: ' + val;
      showToast('Display name updated!', 'success');
    } else { showToast(d.error || 'Failed to update', 'error'); }
  }).catch(() => showToast('Connection error', 'error'));
}

async function submitDisplayName() {
  const input = document.getElementById('promptDisplayName');
  const val = (input?.value || '').trim();
  const errEl = document.getElementById('displayNameError');
  errEl.style.display = 'none';
  if (!val) { errEl.textContent = 'Display name required'; errEl.style.display = 'block'; return; }
  if (val.length > 32) { errEl.textContent = 'Max 32 characters'; errEl.style.display = 'block'; return; }
  if (!/^[a-zA-Z0-9 _.\-]+$/.test(val)) { errEl.textContent = 'Letters, numbers, spaces, _ - . only'; errEl.style.display = 'block'; return; }
  const emailPrefix = currentUser?.email ? currentUser.email.split('@')[0].toLowerCase() : '';
  if (emailPrefix && (val.toLowerCase() === emailPrefix || val.toLowerCase().includes(emailPrefix))) { errEl.textContent = 'Display name cannot match or contain your email username'; errEl.style.display = 'block'; return; }
  const btn = document.querySelector('#displayNameModal .save-btn');
  if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
  try {
    const r = await fetch(WORKER_URL + '/auth/display-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
      body: JSON.stringify({ displayName: val })
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || 'Failed to set display name'; errEl.style.display = 'block'; return; }
    currentUser.displayName = val;
    document.getElementById('displayNameModal').classList.remove('open');
    updateAuthUI(currentUser);
    await syncCollectionFromCloud();
    showToast('Display name set!', 'success');
  } catch (e) {
    errEl.textContent = 'Connection error'; errEl.style.display = 'block';
  } finally {
    if (btn) { btn.textContent = 'Set Display Name'; btn.disabled = false; }
  }
}


function showVerificationPending(email) {
  const f = document.getElementById('authModalContent');
  f.innerHTML = `
    <div style="text-align:center;padding:10px 0;">
      <div style="font-size:48px;margin-bottom:12px;">📧</div>
      <div style="font-family:'Bebas Neue',cursive;font-size:22px;letter-spacing:1px;color:var(--ice-dark);margin-bottom:8px;">Check Your Email</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">We sent a verification link to <strong>${email}</strong></div>
      <div style="background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.25);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#E74C3C;line-height:1.6;">
        ⚠ <strong>Check your spam/junk folder</strong> if you don't see it in your inbox within a few minutes.
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Click the link in the email to verify your account and start using Ice Vault.</div>
      <button class="camera-btn" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="resendVerification('${email}')">Resend Verification Email</button>
      <button class="camera-btn" style="width:100%;justify-content:center;" onclick="closeModal('authModal')">Close</button>
      <div id="resendStatus" style="margin-top:8px;font-size:12px;text-align:center;"></div>
    </div>`;
  document.getElementById('authModal').classList.add('open');
}

async function resendVerification(email) {
  const btn = document.querySelector('#authModalContent .camera-btn');
  const status = document.getElementById('resendStatus');
  if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }
  try {
    await fetch(WORKER_URL + '/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (status) { status.textContent = '✓ Sent! Check your inbox and spam folder.'; status.style.color = 'var(--green)'; }
  } catch (e) {
    if (status) { status.textContent = 'Connection error — try again'; status.style.color = '#E74C3C'; }
  } finally {
    if (btn) { btn.textContent = 'Resend Verification Email'; btn.disabled = false; }
  }
}

async function checkVerifyToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('verify');
  if (!token) return;
  window.history.replaceState({}, '', window.location.pathname);
  try {
    const r = await fetch(WORKER_URL + '/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const d = await r.json();
    if (!r.ok) {
      // Show error in auth modal
      document.getElementById('authModalContent').style.display = 'block';
      document.getElementById('authSignedInContent').style.display = 'none';
      document.getElementById('authModal').classList.add('open');
      document.getElementById('authError').textContent = d.error || 'Verification failed';
      return;
    }
    // Verified and logged in
    setAuthToken(d.token);
    currentUser = { email: d.email, userId: d.userId, displayName: d.displayName || null };
    updateAuthUI(currentUser);
    showToast('Email verified! Welcome to Ice Vault.', 'success');
    if (!currentUser.displayName) {
      document.getElementById('displayNameModal').classList.add('open');
      return;
    }
    await syncCollectionFromCloud();
  } catch (e) {
    showToast('Verification failed — try again', 'error');
  }
}

async function signOut(){
  const t=getAuthToken();if(t)fetch(WORKER_URL+'/auth/logout',{method:'POST',headers:{'Authorization':'Bearer '+t}}).catch(()=>{});
  clearAuthToken();currentUser=null;
  collection=[];localStorage.removeItem('iceVault_cards');localStorage.removeItem('iceVault_lastSync');isServerPaginated=false;currentPage=1;totalPages=1;totalCards=0;
  updateAuthUI(null);updateHeaderStats();closeModal('authModal');switchView('scan');showToast('Signed out','success');
}


// ─── MIGRATE GUEST IMAGES TO R2 ON ACCOUNT CREATION ──────────────────────
// Called when a guest signs up or signs in with local cards containing base64
// Uploads imageData to R2, replaces with imageUrl before pushing to D1
// Prevents base64 blobs from ever landing in D1
async function migrateLocalImagesToR2(col) {
  const needs = col.filter(c => (c.imageData && !c.imageUrl) || (c.imageDataBack && !c.imageUrlBack));
  if (needs.length === 0) return col;
  showToast(`Uploading ${needs.length} card image${needs.length > 1 ? 's' : ''} to cloud storage...`, 'success');
  for (const card of needs) {
    // Migrate front image
    if (card.imageData && !card.imageUrl) {
      const url = await uploadImageToR2(card.imageData, card.id);
      if (url) { card.imageUrl = url; card.imageData = null; }
    }
    // Migrate back image
    if (card.imageDataBack && !card.imageUrlBack) {
      const urlBack = await uploadImageToR2(card.imageDataBack, card.id + '_back');
      if (urlBack) { card.imageUrlBack = urlBack; card.imageDataBack = null; }
    }
  }
  localStorage.setItem('iceVault_cards', JSON.stringify(col));
  return col;
}
async function syncCollectionToCloud(){
  // Bulk sync — used for import and guest migration only
  const t=getAuthToken();if(!t||!currentUser)return;
  try{
    await fetch(WORKER_URL+'/collection',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({collection})});
    localStorage.setItem('iceVault_lastSync', new Date().toISOString());
  }
  catch(e){console.warn('Cloud sync failed:',e);}
}

async function syncCardToCloud(card){
  // Single card upsert -- used for all individual card saves/edits
  const t=getAuthToken();if(!t||!currentUser||!card)return null;
  try{
    const r=await fetch(WORKER_URL+'/collection/'+card.id,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({card})});
    localStorage.setItem('iceVault_lastSync', new Date().toISOString());
    return await r.json();
  }
  catch(e){console.warn('Card sync failed:',e);return null;}
}

async function deleteCardFromCloud(cardId){
  const t=getAuthToken();if(!t||!currentUser)return;
  try{await fetch(WORKER_URL+'/collection/'+cardId,{method:'DELETE',headers:{'Authorization':'Bearer '+t}});}
  catch(e){console.warn('Card delete sync failed:',e);}
}
async function syncCollectionFromCloud(page, params){
  const t=getAuthToken();if(!t||!currentUser)return;
  try{
    if(!page){
      // Smart sync check on initial login
      const lastSync=localStorage.getItem('iceVault_lastSync');
      const metaR=await fetch(WORKER_URL+'/collection/meta',{headers:{'Authorization':'Bearer '+t}});
      if(metaR.ok){
        const meta=await metaR.json();
        const localCount=isServerPaginated?totalCards:collection.length;
        if(lastSync && meta.lastUpdated && lastSync >= meta.lastUpdated && localCount === meta.count && localCount > 0){
          console.log('[SYNC] Collection up to date — skipping full pull');
          isServerPaginated=true;
          return;
        }
      }
      page=1;
    }
    // Fetch page from server
    const qp=new URLSearchParams({page:page||1,limit:100,...(params||{})});
    const r=await fetch(WORKER_URL+'/collection?'+qp.toString(),{headers:{'Authorization':'Bearer '+t}});
    if(!r.ok)return;
    const d=await r.json();
    collection=d.collection||[];
    currentPage=d.page||1;
    totalPages=d.pages||1;
    totalCards=d.total||collection.length;
    isServerPaginated=true;
    migrateValueHistory();
    localStorage.setItem('iceVault_cards',JSON.stringify(collection));
    localStorage.setItem('iceVault_lastSync', new Date().toISOString());
    updateHeaderStats();
    renderCollection();
  }
  catch(e){console.warn('Cloud fetch failed:',e);}
}

function openLightbox(src,cap){document.getElementById('lightboxImg').src=src;document.getElementById('lightboxCaption').textContent=cap||'';document.getElementById('lightboxModal').classList.add('open');}
function closeLightbox(){document.getElementById('lightboxModal').classList.remove('open');}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(document.getElementById('displayNameModal').classList.contains('open'))return;
    // Close any open modal
    ['cardModal','apiModal','authModal','shareModal','photoTipsModal','cameraModal'].forEach(id=>{
      const el=document.getElementById(id);
      if(el&&el.classList.contains('open'))el.classList.remove('open');
    });
    closeLightbox();
    closeDrawer();
  }
});

let currentScanMode='card';
function setScanMode(mode){
  currentScanMode=mode;
  document.getElementById('modeScanPanel').style.display=mode==='card'?'block':'none';
  document.getElementById('modeCertPanel').style.display=mode==='cert'?'block':'none';
  document.getElementById('modeCardBtn').className='mode-toggle-btn'+(mode==='card'?' active':'');
  document.getElementById('modeCertBtn').className='mode-toggle-btn'+(mode==='cert'?' active-gold':'');
  if(mode==='cert')updateGraderInfo();
}

let slabScanImageData=null,slabScanImageDataBack=null;
function handleSlabScanSelect(e,side){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{if(side==='back'){slabScanImageDataBack=ev.target.result;document.getElementById('slabScanImgBack').src=slabScanImageDataBack;document.getElementById('slabScanPreviewBack').style.display='flex';}else{slabScanImageData=ev.target.result;certSlabImageData=slabScanImageData;document.getElementById('slabScanImg').src=slabScanImageData;document.getElementById('slabScanPreview').style.display='flex';document.getElementById('slabAnalyzeBtn').disabled=false;document.getElementById('slabClearBtn').classList.add('visible');}};
  r.readAsDataURL(f);
}
let slabCameraTarget='front';
function openSlabCamera(side){slabCameraTarget=side||'front';navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(s=>{cameraStream=s;document.getElementById('cameraFeed').srcObject=s;document.getElementById('cameraModal').classList.add('open');document.getElementById('cameraModal').dataset.mode='slab';}).catch(()=>showToast('Camera access denied','error'));}
function clearSlabScan(){slabScanImageData=null;slabScanImageDataBack=null;certSlabImageData=null;document.getElementById('slabScanPreview').style.display='none';if(document.getElementById('slabScanPreviewBack'))document.getElementById('slabScanPreviewBack').style.display='none';document.getElementById('slabAnalyzeBtn').disabled=true;document.getElementById('slabClearBtn').classList.remove('visible');document.getElementById('slabScanFileInput').value='';if(document.getElementById('slabScanFileInputBack'))document.getElementById('slabScanFileInputBack').value='';document.getElementById('slabScanStatus').textContent='';
  // Clear OCR result fields and hide result panel
  ['certPlayer','certYear','certBrand','certCardNum','certTeam','certVariation','certSerialNum','certValue'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const certNum=document.getElementById('certNum');if(certNum)certNum.textContent='—';
  const certGrade=document.getElementById('certGrade');if(certGrade){certGrade.value='';certGrade.readOnly=false;certGrade.style.opacity='';}
  const certResultData=document.getElementById('certResultData');if(certResultData)certResultData.style.display='none';
  const certResultPlaceholder=document.getElementById('certResultPlaceholder');if(certResultPlaceholder)certResultPlaceholder.style.display='block';
  const certSaveBtn=document.getElementById('certSaveBtn');if(certSaveBtn)certSaveBtn.style.display='none';
}

let _slabModel = 'claude';
function setSlabModel(model) {
  _slabModel = model;
  ['claude','gpt4o','gemini'].forEach(m => {
    const btn = document.getElementById('slabModel' + m.charAt(0).toUpperCase() + m.slice(1));
    if (btn) btn.className = 'grader-btn' + (m === model ? ' active' : '');
  });
  const costEl = document.getElementById('slabCostNote');
  if (costEl) {
    const label = model === 'gpt4o' ? 'GPT-4o' : model === 'gemini' ? 'Gemini' : 'Claude';
    const cost = model === 'gemini' ? '~$0.001-0.01 (free tier)' : '~$0.01-0.03 (paid)';
    costEl.textContent = '⚠ ' + cost + ' per read (' + label + ')';
  }
}

async function analyzeSlabPhoto(){
  const keys=getKeys();
  const slabKey = _slabModel === 'gpt4o' ? keys.openai : _slabModel === 'gemini' ? keys.gemini : keys.anthropic;
  const slabKeyLabel = _slabModel === 'gpt4o' ? 'OpenAI' : _slabModel === 'gemini' ? 'Google AI' : 'Anthropic';
  if(!slabKey){showToast('Add your ' + slabKeyLabel + ' API key in ⚙ Settings','error');return;}
  if(!slabScanImageData){showToast('Load a slab photo first','error');return;}
  const btn=document.getElementById('slabAnalyzeBtn'),st=document.getElementById('slabScanStatus');
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> &nbsp; Reading slab...';st.textContent='AI is reading the slab...';st.style.color='var(--text-muted)';
  try{
    const normFront=await normalizeImageToJpeg(slabScanImageData);
    const b64=normFront.split(',')[1],mt='image/jpeg';
    const imgs=[{type:'image',source:{type:'base64',media_type:mt,data:b64}}];
    if(slabScanImageDataBack){const normBack=await normalizeImageToJpeg(slabScanImageDataBack);const bb=normBack.split(',')[1];const bm='image/jpeg';imgs.push({type:'image',source:{type:'base64',media_type:bm,data:bb}});}
    const slabPromptText = 'You are an expert graded sports card authenticator and dealer with 20 years of experience. Analyze this graded card slab carefully and respond ONLY with JSON. Be precise -- use the exact brand and set name as printed on the card label (do not abbreviate or add words not on the label), the exact parallel or variation name as printed, and read the cert number and grade exactly as shown on the label: {"grader":"PSA,BGS,SGC,CGC,Authority,TAG,KSA,HGA or Other","certNumber":"cert number from label","grade":"full grade text e.g. PSA 9 MINT","gradeNumeric":"numeric grade e.g. 9","player":"player name","year":"card year","brand":"brand and set","cardNumber":"card number if visible","team":"player team name","variation":"parallel or variation","serialNumber":"serial number if present e.g. 47/99 or null","estimatedValue":"market value USD as number string"}';
    let slabRes, slabData;
    if (_slabModel === 'gpt4o') {
      const gptImgs = imgs.map(img => ({ type: 'image_url', image_url: { url: 'data:' + img.source.media_type + ';base64,' + img.source.data } }));
      slabRes = await fetch(WORKER_URL + '/proxy/openai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-openai-key': keys.openai }, body: JSON.stringify({ model: 'gpt-4o', max_tokens: 1000, messages: [{ role: 'user', content: [...gptImgs, { type: 'text', text: slabPromptText }] }] }) });
      slabData = await slabRes.json();
      if (slabData.error) throw new Error(slabData.error.message);
    } else if (_slabModel === 'gemini') {
      const gemParts = imgs.map(img => ({ inline_data: { mime_type: img.source.media_type, data: img.source.data } }));
      slabRes = await fetch(WORKER_URL + '/proxy/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gemini-key': keys.gemini }, body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [...gemParts, { text: slabPromptText }] }] }) });
      slabData = await slabRes.json();
      if (slabData.error) throw new Error(slabData.error.message || JSON.stringify(slabData.error));
    } else {
      slabRes = await fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': keys.anthropic, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 1000, messages: [{ role: 'user', content: [...imgs, { type: 'text', text: slabPromptText }] }] }) });
      slabData = await slabRes.json();
      if (slabData.error) throw new Error(slabData.error.message);
    }
    let raw;
    if (_slabModel === 'gpt4o') raw = slabData.choices[0].message.content.trim().replace(/```json|```/g,'').trim();
    else if (_slabModel === 'gemini') raw = slabData.candidates[0].content.parts[0].text.trim().replace(/```json|```/g,'').trim();
    else raw = slabData.content[0].text.trim().replace(/```json|```/g,'').trim();
    const result=JSON.parse(raw);
    const gm={PSA:'PSA',BGS:'BGS',SGC:'SGC',CGC:'CGC',Authority:'AUT',TAG:'TAG',KSA:'KSA',HGA:'HGA'};
    if(result.grader&&gm[result.grader])setGrader(gm[result.grader]);
    if(result.certNumber){document.getElementById('certNumberInput').value=result.certNumber;updateRegistryLink();}
    document.getElementById('certResultPlaceholder').style.display='none';document.getElementById('certResultData').style.display='block';document.getElementById('certSaveBtn').style.display='block';
    if(!currentUser)document.getElementById('certGuestWarning').style.display='flex';
    document.getElementById('certGraderBadge').textContent=result.grader||currentGrader;document.getElementById('certNum').textContent=result.certNumber||'—';const cgEl=document.getElementById('certGrade');if(cgEl){cgEl.value=result.grade||'';cgEl.readOnly=true;cgEl.style.opacity='0.7';}
    const url=GRADERS[gm[result.grader]||currentGrader]?.url(result.certNumber||'')||'#';
    document.getElementById('certPop').innerHTML=`<a href="${url}" target="_blank" style="color:var(--ice-dark);">Verify at registry ↗</a>`;
    document.getElementById('certDate').textContent='—';
    document.getElementById('certPlayer').value=result.player||'';document.getElementById('certYear').value=result.year||'';document.getElementById('certBrand').value=result.brand||'';document.getElementById('certCardNum').value=result.cardNumber||'';document.getElementById('certTeam').value=result.team||'';document.getElementById('certVariation').value=result.variation||'';document.getElementById('certSerialNum').value=result.serialNumber||'';document.getElementById('certValue').value=result.estimatedValue||'';
    if(result.certNumber){document.getElementById('certNumEditInput').value=result.certNumber;updateRegistryLinkFromEdit();}
    certTags=[];renderCertTagRow();st.textContent='✓ Slab read — verify cert # if needed';st.style.color='var(--green)';showToast('Slab analyzed!','success');
  }catch(err){st.textContent='✗ Failed: '+err.message;st.style.color='var(--red)';showToast('Slab read failed: '+err.message,'error');}
  btn.disabled=false;btn.innerHTML='✦ &nbsp; Read Slab with AI';
}

const GRADERS={PSA:{name:'PSA',url:n=>`https://www.psacard.com/cert/${n}`,info:'psacard.com — largest grading company, most liquid market',placeholder:'e.g. 12345678'},BGS:{name:'Beckett (BGS)',url:n=>`https://www.beckett.com/grading/population/submitCertSearch?cert_num=${n}`,info:'beckett.com — BGS/BVG/BCCG grading registry',placeholder:'e.g. 0012345678'},SGC:{name:'SGC',url:n=>`https://www.sgccard.com/cert-lookup/?cert=${n}`,info:'sgccard.com — SGC grading registry',placeholder:'e.g. 1234567'},CGC:{name:'CGC',url:n=>`https://www.cgccards.com/certlookup/${n}/`,info:'cgccards.com — CGC Trading Cards registry',placeholder:'e.g. 1234567890'},AUT:{name:'Authority',url:n=>`https://www.theauthority.com/${n}`,info:'theauthority.com — Authority grading registry',placeholder:'e.g. A827580493'},TAG:{name:'TAG',url:n=>`https://www.taggrading.com/cert/${n}`,info:'taggrading.com — Tech-Assisted Grading registry',placeholder:'e.g. 123456'},KSA:{name:'KSA',url:n=>`https://www.ksacertified.com/cert-lookup?cert=${n}`,info:'ksacertified.com — KSA Certified grading registry',placeholder:'e.g. 123456'},HGA:{name:'HGA',url:n=>`https://hgagrading.com/cert/${n}`,info:'hgagrading.com — Hybrid Grading Approach registry',placeholder:'e.g. 123456'}};

let currentGrader='PSA',certTags=[],certSlabImageData=null;
function setGrader(g){currentGrader=g;['PSA','BGS','SGC','CGC','AUT','TAG','KSA','HGA'].forEach(x=>{const b=document.getElementById('grader'+x);if(b)b.className='grader-btn'+(x===g?' active':'');});updateGraderInfo();updateRegistryLink();}
function updateGraderInfo(){const i=document.getElementById('certRegistryInfo');if(i)i.textContent=GRADERS[currentGrader]?.info||'';const inp=document.getElementById('certNumberInput');if(inp)inp.placeholder=GRADERS[currentGrader]?.placeholder||'Cert number';}
function updateRegistryLinkFromEdit(){const n=(document.getElementById('certNumEditInput')?.value||'').trim(),a=document.getElementById('certVerifyAnchor');if(!a)return;if(n.length>=4){a.href=GRADERS[currentGrader]?.url(n)||'#';a.style.color='var(--ice-dark)';}else a.href='#';}
function updateRegistryLink(){const n=(document.getElementById('certNumberInput')?.value||'').trim(),ld=document.getElementById('certRegistryLink'),a=document.getElementById('certRegistryAnchor');if(!ld||!a)return;if(n.length>=4){a.href=GRADERS[currentGrader].url(n);a.textContent=`Open ${GRADERS[currentGrader].name} registry ↗`;ld.style.display='block';}else ld.style.display='none';}

function lookupCert(){
  const n=(document.getElementById('certNumberInput').value||'').trim();if(!n){showToast('Enter a cert number first','error');return;}
  const g=GRADERS[currentGrader];window.open(g.url(n),'_blank');
  document.getElementById('certResultPlaceholder').style.display='none';document.getElementById('certResultData').style.display='block';document.getElementById('certSaveBtn').style.display='block';
  if(!currentUser)document.getElementById('certGuestWarning').style.display='flex';
  document.getElementById('certGraderBadge').textContent=currentGrader==='AUT'?'Authority':currentGrader;document.getElementById('certNum').textContent=n;document.getElementById('certGrade').value='';document.getElementById('certPop').innerHTML=`<a href="${g.url(n)}" target="_blank" style="color:var(--ice-dark);">View at ${g.name} ↗</a>`;document.getElementById('certDate').textContent='—';document.getElementById('certNumEditInput').value=n;updateRegistryLinkFromEdit();
  document.getElementById('certQrStatus').textContent=`✓ Registry opened — fill in details from the ${g.name} page`;document.getElementById('certQrStatus').style.color='var(--ice-dark)';
  certTags=[];renderCertTagRow();showToast(`${g.name} registry opened — fill in the details`,'success');
}

function handleCertImageSelect(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>decodeCertQR(ev.target.result);r.readAsDataURL(f);}
function handleCertPhotoSelect(e,side){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    const data=ev.target.result;
    if(side==='back'){
      slabScanImageDataBack=data;
      document.getElementById('certBackImg').src=data;
      document.getElementById('certBackPreview').style.display='block';
      document.getElementById('certBackPlaceholder').style.display='none';
    } else {
      certSlabImageData=data;
      slabScanImageData=data;
      document.getElementById('certFrontImg').src=data;
      document.getElementById('certFrontPreview').style.display='block';
      document.getElementById('certFrontPlaceholder').style.display='none';
    }
  };
  r.readAsDataURL(f);
}
function decodeCertQR(dataUrl){
  const st=document.getElementById('certQrStatus');st.textContent='Decoding QR/barcode...';st.style.color='var(--text-muted)';
  const img=new Image();img.onload=()=>{
    const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);const id=c.getContext('2d').getImageData(0,0,c.width,c.height);
    if(typeof jsQR==='undefined'){st.textContent='QR library loading — try again';return;}
    const code=jsQR(id.data,id.width,id.height);
    if(code){
      const d=code.data;
      if(d.includes('psacard.com'))setGrader('PSA');else if(d.includes('beckett.com'))setGrader('BGS');else if(d.includes('sgccard.com'))setGrader('SGC');else if(d.includes('cgccards.com'))setGrader('CGC');else if(d.includes('theauthority.com'))setGrader('AUT');else if(d.includes('taggrading.com'))setGrader('TAG');else if(d.includes('ksacertified.com'))setGrader('KSA');else if(d.includes('hgagrading.com'))setGrader('HGA');
      const m=d.match(/([A-Z]?\d{6,12})/i);
      if(m){document.getElementById('certNumberInput').value=m[1];updateRegistryLink();st.textContent='✓ Cert #'+m[1]+' detected';st.style.color='var(--green)';lookupCert();}
      else{document.getElementById('certNumberInput').value=d;updateRegistryLink();st.textContent='✓ Scanned: '+d;st.style.color='var(--green)';}
    }else{st.textContent='✗ No QR/barcode detected — try a clearer image';st.style.color='var(--red)';}
  };img.src=dataUrl;
}

function openCertCamera(){navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(s=>{document.getElementById('cameraFeed').srcObject=s;cameraStream=s;document.getElementById('cameraModal').classList.add('open');document.getElementById('cameraModal').dataset.mode='cert';}).catch(()=>showToast('Camera access denied','error'));}

const _origCapturePhoto=capturePhoto;
window.capturePhoto=function(){
  const modal=document.getElementById('cameraModal'),mode=modal.dataset.mode;
  const video=document.getElementById('cameraFeed'),canvas=document.getElementById('cameraCanvas');
  canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);
  const dataUrl=canvas.toDataURL('image/jpeg',0.9);
  closeCamera();modal.dataset.mode='';
  if(mode==='cert')decodeCertQR(dataUrl);
  else if(mode==='slab'){if(slabCameraTarget==='back'){slabScanImageDataBack=dataUrl;document.getElementById('slabScanImgBack').src=dataUrl;document.getElementById('slabScanPreviewBack').style.display='flex';}else{slabScanImageData=dataUrl;certSlabImageData=dataUrl;document.getElementById('slabScanImg').src=dataUrl;document.getElementById('slabScanPreview').style.display='flex';document.getElementById('slabAnalyzeBtn').disabled=false;document.getElementById('slabClearBtn').classList.add('visible');}}
  else{if(cameraTarget==='back'){currentBackImageData=dataUrl;setPreviewImage(dataUrl,'back');}else{currentImageData=dataUrl;setPreviewImage(dataUrl,'front');}}
};

function handleSlabImageSelect(e){handleSlabScanSelect(e,'front');}
function renderCertTagRow(){const r=document.getElementById('certTagRow');if(!r)return;r.innerHTML=certTags.map(t=>`<div class="tag">${t} <span class="tag-x" onclick="removeCertTag('${t}')">✕</span></div>`).join('')+`<div class="tag-add" onclick="addCertTag()">+ Add Tag</div>`;}
function addCertTag(){const t=prompt('Enter tag:');if(t&&t.trim()&&!certTags.includes(t.trim())){certTags.push(t.trim());renderCertTagRow();}}
function removeCertTag(t){certTags=certTags.filter(x=>x!==t);renderCertTagRow();}

function saveCertCard(){
  const player=document.getElementById('certPlayer').value.trim();
  const gt=document.getElementById('certGrade').value,gn=gt.match(/(\d+\.?\d*)/)?.[1]||'';
  const cn=document.getElementById('certNumEditInput')?.value.trim()||document.getElementById('certNum').textContent;
  if(!player){showToast('Enter the player name first','error');return;}
  const gl=currentGrader==='AUT'?'Authority':currentGrader;
  const certEstVal = document.getElementById('certValue').value;
  const card={id:Date.now(),player,year:document.getElementById('certYear').value,brand:document.getElementById('certBrand').value,cardNumber:document.getElementById('certCardNum').value,serialNumber:document.getElementById('certSerialNum')?.value.trim()||null,team:document.getElementById('certTeam')?.value.trim()||'',parallel:document.getElementById('certVariation').value||'Base',estimatedValue:certEstVal,collection:document.getElementById('certCollection').value,tags:[...new Set([...certTags,gl])],grade:gn?{overall:gn,centering:gn,corners:gn,edges:gn,surface:gn,rationale:`Official ${gl} grade: ${gt}. Cert #${cn}.`}:null,imageData:certSlabImageData,imageDataBack:slabScanImageDataBack||null,certNumber:cn,certGrader:gl,officialGrade:gt,registryUrl:GRADERS[currentGrader].url(cn),listedOnEbay:false,ebayListingId:null,addedAt:new Date().toISOString(),
    valueHistory: certEstVal ? [{ value: certEstVal, date: new Date().toISOString(), source: 'scan' }] : []
  };
  // Save to localStorage immediately -- card appears instantly
  collection.push(card);localStorage.setItem('iceVault_cards',JSON.stringify(collection));
  updateHeaderStats();showToast(`${player} (${gl} ${gn||'?'}) saved!`,'success');
  // Check for duplicates after cert card save
  setTimeout(()=>{
    const {exact,possible}=checkForDuplicates(card);
    if(exact.length>0){
      showToast(`Duplicate detected -- ${exact.length} identical cop${exact.length===1?'y':'ies'} in collection`,'error');
      setTimeout(()=>{openDupeTipsModal('exact');},1500);
    } else if(possible.length>0){
      showToast(`Possible duplicate -- ${possible.length} similar card${possible.length===1?'':'s'} found, verify details`,'error');
      setTimeout(()=>{openDupeTipsModal('possible');},1500);
    }
  },500);
  document.getElementById('certNumberInput').value='';document.getElementById('certResultPlaceholder').style.display='block';document.getElementById('certResultData').style.display='none';document.getElementById('certSaveBtn').style.display='none';document.getElementById('certGuestWarning').style.display='none';document.getElementById('certQrStatus').textContent='';document.getElementById('certRegistryLink').style.display='none';certTags=[];clearSlabScan();
  // Upload slab image to R2 in background then sync to cloud
  if(currentUser){
    const slabData=card.imageData;
    const slabBackData=card.imageDataBack;
    certSlabImageData=null;
    Promise.all([
      slabData?uploadImageToR2(slabData,card.id):Promise.resolve(null),
      slabBackData?uploadImageToR2(slabBackData,card.id+'_back'):Promise.resolve(null)
    ]).then(([imageUrl,imageUrlBack])=>{
      if(imageUrl){card.imageUrl=imageUrl;card.imageData=null;}
      if(imageUrlBack){card.imageUrlBack=imageUrlBack;card.imageDataBack=null;}
      localStorage.setItem('iceVault_cards',JSON.stringify(collection));
      return syncCardToCloud(card);
    }).then(res=>{
      if(res&&res.ok){card.iceVaultId=res.ok;localStorage.setItem('iceVault_cards',JSON.stringify(collection));}
    }).catch(e=>{console.warn('[saveCertCard] Background upload/sync failed:',e.message);});
  } else {
    certSlabImageData=null;
  }
}


// ═══════════════════════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════════════════════

function exportJSON() {
  if (collection.length === 0) { showToast('No cards to export', 'error'); return; }
  const date = new Date().toISOString().split('T')[0];
  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `icevault-collection-${date}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Exported ${collection.length} cards as JSON`, 'success');
}

function exportCSV() {
  if (collection.length === 0) { showToast('No cards to export', 'error'); return; }
  const headers = [
    'Player','Year','Brand','Card Number','Team','Parallel',
    'Serial Number','Estimated Value','Collection','Tags',
    'AI Graded','Grade Overall','Centering','Corners','Edges','Surface','Grade Rationale',
    'Cert Number','Cert Grader','Official Grade','Listed on eBay','Date Added','Notes','IceVault ID'
  ];
  const esc = v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const rows = collection.map(c => [
    c.player, c.year, c.brand, c.cardNumber, c.team, c.parallel,
    c.serialNumber || '',
    c.estimatedValue, c.collection,
    (c.tags || []).join('; '),
    c.aiGraded ? 'Yes' : 'No',
    c.grade?.overall || '', c.grade?.centering || '', c.grade?.corners || '',
    c.grade?.edges || '', c.grade?.surface || '', c.grade?.rationale || '',
    c.certNumber || '', c.certGrader || '', c.officialGrade || '',
    c.listedOnEbay ? 'Yes' : 'No',
    c.addedAt ? new Date(c.addedAt).toLocaleDateString() : '',
    c.notes || '',
    c.iceVaultId ? 'ICV-'+String(c.iceVaultId).padStart(6,'0') : ''
  ].map(esc).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const date = new Date().toISOString().split('T')[0];
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'icevault-collection-' + date + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Exported ' + collection.length + ' cards as CSV', 'success');
}
async function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) { showToast('Invalid file — expected a JSON array', 'error'); return; }
      // Validate basic shape
      const valid = imported.filter(c => c.id && c.player && c.addedAt);
      if (valid.length === 0) { showToast('No valid cards found in file', 'error'); return; }
      // Merge — add cards that don't already exist (match by id)
      const existingIds = new Set(collection.map(c => c.id));
      const newCards = valid.filter(c => !existingIds.has(c.id));
      const duplicates = valid.length - newCards.length;
      collection = [...collection, ...newCards];
      localStorage.setItem('iceVault_cards', JSON.stringify(collection));
      if (currentUser) {
        collection = await migrateLocalImagesToR2(collection);
        syncCollectionToCloud();
      }
      updateHeaderStats();
      renderCollection();
      const msg = duplicates > 0
        ? `Imported ${newCards.length} cards (${duplicates} duplicates skipped)`
        : `Imported ${newCards.length} cards`;
      showToast(msg, 'success');
    } catch (err) {
      showToast('Import failed — invalid JSON file', 'error');
    }
    // Reset input so same file can be imported again if needed
    e.target.value = '';
  };
  reader.readAsText(file);
}


// ═══════════════════════════════════════════════════════
// COLLECTION SHARING
// ═══════════════════════════════════════════════════════

let currentShareUrl = null;

async function openShareModal() {
  document.getElementById('shareModal').classList.add('open');
  // Check current share status
  try {
    const r = await fetch(WORKER_URL + '/share/status', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
    const d = await r.json();
    if (d.sharing) {
      currentShareUrl = d.url;
      showShareOnState(d.url, d.createdAt);
    } else {
      showShareOffState();
    }
  } catch (e) {
    showShareOffState();
  }
}

function showShareOffState() {
  document.getElementById('shareOffState').style.display = 'block';
  document.getElementById('shareOnState').style.display = 'none';
}

function showShareOnState(url, createdAt) {
  document.getElementById('shareOffState').style.display = 'none';
  document.getElementById('shareOnState').style.display = 'block';
  document.getElementById('shareUrlDisplay').textContent = url;
  if (createdAt) {
    document.getElementById('shareCreatedAt').textContent = 'Created ' + new Date(createdAt).toLocaleDateString();
  }
}

async function generateShareLink() {
  const btn = document.getElementById('generateShareBtn');
  btn.textContent = 'Generating...'; btn.disabled = true;
  try {
    const r = await fetch(WORKER_URL + '/share/generate', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
    const d = await r.json();
    if (!r.ok) { showToast(d.error || 'Failed to generate link', 'error'); return; }
    currentShareUrl = d.url;
    showShareOnState(d.url, new Date().toISOString());
    showToast('Share link generated!', 'success');
  } catch (e) {
    showToast('Connection error', 'error');
  } finally {
    btn.textContent = 'Generate Share Link'; btn.disabled = false;
  }
}

async function revokeShareLink() {
  if (!confirm('Disable sharing? The current link will stop working immediately.')) return;
  try {
    const r = await fetch(WORKER_URL + '/share/revoke', {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
    if (!r.ok) { showToast('Failed to revoke link', 'error'); return; }
    currentShareUrl = null;
    showShareOffState();
    showToast('Sharing disabled — link revoked', 'success');
  } catch (e) {
    showToast('Connection error', 'error');
  }
}

function copyShareUrl() {
  if (!currentShareUrl) return;
  navigator.clipboard.writeText(currentShareUrl)
    .then(() => showToast('Link copied to clipboard!', 'success'))
    .catch(() => showToast('Copy failed — select and copy manually', 'error'));
}

// ─── PER-CARD PRICE SHARING ──────────────────────────────────────────────
function updateCardSharePrice(id) {
  id = typeof id === 'string' ? parseInt(id) : id;
  const c = collection.find(x => x.id === id); if (!c) return;
  const checked = document.getElementById('sharePriceCheck_' + id)?.checked;
  c.sharePrice = checked;
  const optionsEl = document.getElementById('sharePriceOptions_' + id);
  if (optionsEl) optionsEl.style.display = checked ? 'block' : 'none';
  saveCollectionLocal(c);
}

function updateCardSharePriceType(id, type) {
  id = typeof id === 'string' ? parseInt(id) : id;
  const c = collection.find(x => x.id === id); if (!c) return;
  c.sharePriceType = type;
  const ownerRow = document.getElementById('ownerPriceRow_' + id);
  if (ownerRow) ownerRow.style.display = type === 'owner' ? 'flex' : 'none';
  saveCollectionLocal(c);
}

function updateCardOwnerPrice(id, value) {
  id = typeof id === 'string' ? parseInt(id) : id;
  const c = collection.find(x => x.id === id); if (!c) return;
  c.ownerPrice = value;
  saveCollectionLocal(c);
}

function saveCollectionLocal(card) {
  localStorage.setItem('iceVault_cards', JSON.stringify(collection));
  if (currentUser) {
    if (card) syncCardToCloud(card);
    else syncCollectionToCloud();
  }
}

// ─── SHARED VIEW — load on ?collection=TOKEN ─────────────────────────────
async function checkSharedCollectionUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('collection');
  if (!token) return;

  // Clear the URL param without reloading
  window.history.replaceState({}, '', window.location.pathname);

  try {
    const r = await fetch(WORKER_URL + '/share/' + token);
    if (!r.ok) { showToast('Collection not found or sharing has been disabled', 'error'); return; }
    const data = await r.json();
    renderSharedView(data, token);
  } catch (e) {
    showToast('Failed to load shared collection', 'error');
  }
}

function renderSharedView(data, token) {
  // Switch to collection view
  switchView('collection');

  // Inject shared view banner above collection
  const collectionView = document.getElementById('view-collection');
  const existingBanner = document.getElementById('sharedViewBanner');
  if (existingBanner) existingBanner.remove();

  const banner = document.createElement('div');
  banner.id = 'sharedViewBanner';
  banner.className = 'shared-view-banner';
  banner.innerHTML = `
    <div>
      <div class="shared-view-banner-text">🏒 ${data.displayName}&#39;s Collection</div>
      <div class="shared-view-banner-sub">${data.cardCount} card${data.cardCount !== 1 ? 's' : ''} — read only view</div>
    </div>
    <button class="shared-view-signup-btn" onclick="openAuthModal()">Sign up to manage yours →</button>
  `;
  collectionView.insertBefore(banner, collectionView.firstChild);

  // Render the shared collection (read-only)
  const grid = document.getElementById('cardsGrid');
  if (data.collection.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏒</div><div class="empty-state-text">No cards in this collection yet.</div></div>';
    return;
  }

  sharedCollection = data.collection;
  window._sharedDisplayName = data.displayName || '';
  grid.innerHTML = data.collection.map((c, idx) => {
    const gradeLabel = c.aiGraded ? 'AI Est.' : (c.certGrader || '');
    const ownerLabel = window._sharedDisplayName ? window._sharedDisplayName : 'Owner';
    const priceDisplay = c.sharePrice
      ? (c.sharePriceType === 'owner' && c.ownerPrice
          ? `<span class="card-status" style="color:var(--gold);">$${c.ownerPrice} <span style="font-size:9px;opacity:0.7;">${ownerLabel}</span></span>`
          : c.estimatedValue
            ? `<span class="card-status" style="color:var(--text-muted);">$${c.estimatedValue} <span style="font-size:9px;opacity:0.7;">AI Est.</span></span>`
            : '')
      : '';
    return `
      <div class="card-item" onclick="openSharedCardDetail(${idx})">
        <div class="card-thumb">${c.imageUrl ? `<img src="${c.imageUrl}" alt="${c.player}">` : '🏒'}</div>
        <div class="card-info">
          <div class="card-player">${c.player}</div>
          <div class="card-meta">${c.year || ''} ${c.brand || ''}</div>
          ${c.tags && c.tags.length ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;">${c.tags.map(t => `<span style="padding:1px 6px;background:rgba(74,156,201,0.12);border:1px solid rgba(74,156,201,0.25);border-radius:10px;font-size:10px;color:var(--ice-dark);">${t}</span>`).join('')}</div>` : ''}
          <div class="card-bottom">
            ${c.grade ? `<span class="card-grade-mini grade-${gradeClass(c.grade.overall)}">${gradeLabel} ${c.grade.overall}</span>` : '<span></span>'}
            ${priceDisplay}
          </div>
        </div>
      </div>`;
  }).join('');

  // Hide toolbar controls for shared view
  document.querySelector('.collection-toolbar').style.opacity = '0.4';
  document.querySelector('.collection-toolbar').style.pointerEvents = 'none';
  document.getElementById('tagFilterRow').style.display = 'none';
}


function buildSharedPriceRow(c) {
  const ownerName = window._sharedDisplayName || 'Owner';
  const label = c.sharePriceType === 'owner' ? ownerName + '&#39;s Price' : 'AI Est. Value';
  const val = c.sharePriceType === 'owner' ? c.ownerPrice : c.estimatedValue;
  return '<div class="detail-row"><span class="detail-key">' + label +
    '</span><span class="detail-val" style="color:var(--gold);">$' + val + '</span></div>';
}
function openSharedCardDetail(idx) {
  const c = sharedCollection[idx]; if (!c) return;
  const gradeHtml = c.grade ? `<div class="grade-box" style="margin-top:16px;">
    <div class="grade-header">
      <span class="grade-title">${c.aiGraded ? 'AI Condition Estimate' : 'Official Grade'}</span>
      <span class="grade-badge grade-${gradeClass(c.grade.overall)}">${c.aiGraded ? 'AI Est. ' : (c.certGrader || '') + ' '}${c.grade.overall}</span>
    </div>
    ${c.aiGraded ? '<div style="font-size:11px;color:#E74C3C;margin-bottom:8px;padding:6px 8px;background:rgba(192,57,43,0.08);border-radius:6px;">⚠ AI estimate only.</div>' : ''}
    <div class="grade-breakdown">
      <div class="grade-row"><span>Centering</span><span>${c.grade.centering}</span></div>
      <div class="grade-row"><span>Corners</span><span>${c.grade.corners}</span></div>
      <div class="grade-row"><span>Edges</span><span>${c.grade.edges}</span></div>
      <div class="grade-row"><span>Surface</span><span>${c.grade.surface}</span></div>
    </div>
    <div class="grade-rationale" style="margin-top:8px;">${c.grade.rationale || ''}</div>
  </div>` : '';

  const frontSrc = c.imageUrl || null;
  const backSrc = c.imageUrlBack || null;

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-player">${c.player}</div>
    <div class="modal-meta">${c.year || ''} · ${c.brand || ''} · ${c.team || ''}</div>
    <div class="modal-grid">
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${frontSrc ? `<img class="modal-img lb-img" src="${frontSrc}" alt="${c.player}" data-cap="${c.player}" style="cursor:zoom-in;">` : '<div class="modal-img-placeholder">🏒</div>'}
        ${backSrc ? `<img class="modal-img lb-img" src="${backSrc}" alt="Back" data-cap="${c.player} Back" style="cursor:zoom-in;opacity:0.9;">` : ''}
      </div>
      <div>
        <div class="detail-row"><span class="detail-key">Card #</span><span class="detail-val">${c.cardNumber || '—'}</span></div>
        <div class="detail-row"><span class="detail-key">Parallel</span><span class="detail-val">${c.parallel || 'Base'}</span></div>
        ${c.serialNumber ? `<div class="detail-row"><span class="detail-key">Serial #</span><span class="detail-val" style="color:var(--gold);font-weight:600;">${c.serialNumber}</span></div>` : ''}
        <div class="detail-row"><span class="detail-key">Collection</span><span class="detail-val">${c.collection || '—'}</span></div>
        <div class="detail-row"><span class="detail-key">Added</span><span class="detail-val">${new Date(c.addedAt).toLocaleDateString()}</span></div>
        ${c.sharePrice && c.estimatedValue ? buildSharedPriceRow(c) : ''}
        ${c.tags && c.tags.length ? `<div style="margin-top:10px;"><div class="result-label">Tags</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">${c.tags.map(t => `<div class="tag">${t}</div>`).join('')}</div></div>` : ''}
        ${gradeHtml}
      </div>
    </div>`;
  document.querySelectorAll('#modalContent .lb-img').forEach(function(img){
    img.addEventListener('click',function(){openLightbox(img.src,img.dataset.cap||'');});
  });
  document.getElementById('cardModal').classList.add('open');
}

// ═══════════════════════════════════════════════════════
// THEME SYSTEM
// ═══════════════════════════════════════════════════════
function applyTheme(themeId){
  document.documentElement.setAttribute('data-theme',themeId);
  localStorage.setItem('icevault-theme',themeId);
  document.querySelectorAll('.theme-pick-btn').forEach(b=>b.classList.toggle('active',b.dataset.theme===themeId));
}

function setTheme(themeId){
  applyTheme(themeId);
  const v=document.querySelector('.view.active');if(v)updateNavActive(v.id.replace('view-',''));
}

function updateNavActive(viewName){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.sidebar-item[id^="sb-"]').forEach(b=>b.classList.remove('active'));
  const nb=document.getElementById('nav-'+viewName);if(nb)nb.classList.add('active');
  const sb=document.getElementById('sb-'+viewName);if(sb)sb.classList.add('active');
  const titles={scan:'Scan Card',collection:'My Collection',ebay:'List on eBay',stats:'Stats & Value Tracking'};
  const te=document.getElementById('topbarTitle');if(te)te.textContent=titles[viewName]||viewName;
  closeDrawer();
}

function toggleDrawer(){document.getElementById('sidebarShell').classList.toggle('drawer-open');}
function closeDrawer(){document.getElementById('sidebarShell')?.classList.remove('drawer-open');}

function renderThemePicker(){
  const themes=[{id:'classic',label:'🏒 Classic'},{id:'light',label:'☀ Light'},{id:'dark',label:'🌑 Dark'},{id:'blue',label:'🔷 Vibrant Blue'},{id:'ice',label:'❄ Ice'},{id:'hybrid',label:'🌊 Hybrid'}];
  const cur=localStorage.getItem('icevault-theme')||'hybrid';
  return`<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px;"><div class="result-label" style="margin-bottom:6px;">App Theme</div><div class="theme-picker-row">${themes.map(t=>`<button class="theme-pick-btn${cur===t.id?' active':''}" data-theme="${t.id}" onclick="setTheme('${t.id}')">${t.label}</button>`).join('')}</div></div>`;
}

// ─── VALUE HISTORY MIGRATION ─────────────────────────────────────────────
// Migrates existing cards that have estimatedValue but no valueHistory array
// Runs once on init — idempotent, safe to run multiple times
function migrateValueHistory() {
  let migrated = 0;
  collection.forEach(c => {
    if (!c.valueHistory) {
      c.valueHistory = c.estimatedValue
        ? [{ value: c.estimatedValue, date: c.addedAt || new Date().toISOString(), source: 'scan' }]
        : [];
      migrated++;
    }
  });
  if (migrated > 0) {
    localStorage.setItem('iceVault_cards', JSON.stringify(collection));
    console.log('[MIGRATE] Added valueHistory to ' + migrated + ' existing cards');
  }
}

// INIT
updateHeaderStats();
migrateValueHistory();
setTimeout(updateGraderInfo,100);
verifySession();
checkResetToken();
checkVerifyToken();
checkSharedCollectionUrl();
(function(){
  const saved=localStorage.getItem('icevault-theme')||'hybrid';
  applyTheme(saved);
  updateNavActive('scan');
})();
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/icevault/sw.js').then(()=>console.log('SW registered')).catch(e=>console.log('SW failed:',e));
}
