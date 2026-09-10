const DB='FabricInventoryMobile',VER=2,MS='masters',RS='rolls',CORE=90;
const WIDTHS=['10cm','11cm','13cm','15cm','18cm','21cm','23cm','25cm','26cm','27cm','29cm','31cm','기타'];
const SEEDS=[
['종이류','유포지','옥그라',150],['종이류','유포지','황박',250],['종이류','아트지','황박',240],['종이류','아트지','옥그라',140],['종이류','모조지','옥그라',150],
['라미네이팅','투명풀라미','없음',10],['라미네이팅','무광풀라미','없음',10],['라미네이팅','무광열라미','없음',20],['라미네이팅','투명열라미','없음',15],['라미네이팅','무광접착라미','없음',50],['라미네이팅','투명접착라미','없음',35],['라미네이팅','무광바코드라미','없음',40],['라미네이팅','투명바코드라미','없음',35],
['은/금','은무데25','옥그라',100],['은/금','은무데25','황박',210],['은/금','은무데50','옥그라',120],['은/금','은무데50','황박',230],['은/금','은무지','황박',210],['은/금','은무보이드','옥그라',120],['은/금','은광데25','옥그라',90],['은/금','은광데25','황박',220],['은/금','은광데50','황박',230],['은/금','은광데50','옥그라',120],['은/금','은광PE','백박',150],['은/금','은광PP','옥그라',120],['은/금','은광지','옥그라',130],['은/금','금광지','옥그라',120],
['투명/백색','투명데드롱25','옥그라',110],['투명/백색','투명데드롱25','황박',210],['투명/백색','투명데드롱50','옥그라',130],['투명/백색','투명데드롱50','황박',240],['투명/백색','투명OPP50','황박',190],['투명/백색','투명OPP50','옥그라',110],['투명/백색','투명PE','옥그라',150],['투명/백색','투명PET65','황박',200],['투명/백색','백색PE','옥그라',150],
['특수원단','홀로그램','옥그라',130],['특수원단','홀로그램PET','옥그라',130],
['특수원단','펄지','옥그라',150],['특수원단','프라이맥스','백박',130],['특수원단','헤어라인','옥그라',120],['특수원단','WTS','백박',180],['특수원단','홀로그램(모자이크)','백박',220],
['종이류','사탕수수지','옥그라',190],['종이류','크래프트지','옥그라',150],['종이류','아트지300','황박',430],['종이류','백색크래프트지','옥그라',170],
['투명/백색','백색데드롱75','황박',280],
['은/금','은무데75','황박',260],['은/금','금무지','옥그라',130],['투명/백색','100PE','황박',230],['투명/백색','백PE','옥그라',170],['종이류','이중아트','옥그라',220],['종이류','유포지 리무발','황박',260],['은/금','은광지','백박',200],['종이류','아트원지','없음',120],['특수원단','타이벡지','옥그라',245],['은/금','금무데25','옥그라',100],['은/금','금무데25','황박',210],['은/금','금무데50','옥그라',120],['은/금','금무데50','황박',230],['은/금','금광데25','옥그라',90],['은/금','금광데25','황박',220],['은/금','금광데50','옥그라',120],['은/금','금광데50','황박',230]
].map(([category,fabricName,liner,thicknessMicron])=>({key:`${category}|${fabricName}|${liner}`,category,fabricName,liner,thicknessMicron,coreDiameterMm:CORE,maxRollLengthM:0,sourceType: fabricName.startsWith('금무데')||fabricName.startsWith('금광데')?'대체값':'실측',sourceNote: fabricName.startsWith('금무데')?'은무데 동일 규격 두께 적용':fabricName.startsWith('금광데')?'은광데 동일 규격 두께 적용':'',updatedAt:new Date().toISOString()}));
let db,state={category:'',fabric:'',liner:'',width:'',editing:null},installPrompt=null;const $=x=>document.getElementById(x);
const req=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}),done=t=>new Promise((ok,no)=>{t.oncomplete=ok;t.onerror=()=>no(t.error)});

// One-time upgrades preserve existing user-entered values and roll IDs.
async function openDb(){
 db=await new Promise((ok,no)=>{
  let r=indexedDB.open(DB,VER);
  r.onupgradeneeded=()=>{
   let d=r.result;
   if(!d.objectStoreNames.contains(MS))d.createObjectStore(MS,{keyPath:'key'});
   if(!d.objectStoreNames.contains(RS)){
    let s=d.createObjectStore(RS,{keyPath:'id',autoIncrement:true});
    s.createIndex('spec','specKey');
   }
   if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta');
  };
  r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
 });
 await migrateSeeds();
}

async function migrateSeeds(){
 let t=db.transaction([MS,RS,'meta'],'readwrite'),
     s=t.objectStore(MS),rs=t.objectStore(RS),meta=t.objectStore('meta');
 let migrated=await req(meta.get('seed-v4'));
 if(!migrated){
  // Rename only matching seeded entries, never delete or overwrite a
  // separately existing target. Move roll references without changing IDs.
  for(const [category,fabricName,oldLiner,newLiner,thickness] of [
   ['종이류','아트지300','미확인','황박',430],
   ['종이류','아트지300','없음','황박',430],
   ['투명/백색','백색데드롱75','미확인','황박',280],
   ['투명/백색','백색데드롱75','없음','황박',280],
   ['은/금','금무지','옥박','옥그라',130]
  ]){
   let oldKey=category+'|'+fabricName+'|'+oldLiner,
       newKey=category+'|'+fabricName+'|'+newLiner;
   let old=await req(s.get(oldKey)),target=await req(s.get(newKey));
   if(!old || target || Number(old.thicknessMicron)!==thickness)continue;
   let entries=await req(rs.index('spec').getAll());
   let affected=entries.filter(r=>r.specKey.startsWith(oldKey+'|'));
   let conflict=false;
   for(const r of affected){
    if((await req(rs.index('spec').getAll(
      r.specKey.replace(oldKey+'|',newKey+'|')))).length){
     conflict=true;break;
    }
   }
   if(conflict)continue;
   s.put({...old,key:newKey,liner:newLiner,updatedAt:new Date().toISOString()});
   s.delete(oldKey);
   for(const r of affected)
    rs.put({...r,specKey:newKey+r.specKey.slice(oldKey.length)});
  }
  let silver=await req(s.get('은/금|은무지|황박'));
  if(silver&&Number(silver.thicknessMicron)===220)
   s.put({...silver,thicknessMicron:210,updatedAt:new Date().toISOString()});
  meta.put(true,'seed-v4');
 }
 for(const m of SEEDS){
  let existing=await req(s.get(m.key));
  if(!existing)s.add(m);
  else if(m.sourceType==='대체값'&&Number(existing.thicknessMicron)===m.thicknessMicron&&
          !existing.sourceType&&!existing.sourceNote)
    s.put({...existing,sourceType:'대체값',sourceNote:m.sourceNote});
 }
 await done(t);
}
async function all(n){return await req(db.transaction(n).objectStore(n).getAll())}
async function master(){if(!state.category||!state.fabric||!state.liner)return null;return await req(db.transaction(MS).objectStore(MS).get(`${state.category}|${state.fabric}|${state.liner}`))}
async function putM(m){let t=db.transaction(MS,'readwrite');t.objectStore(MS).put(m);await done(t)}
const spec=()=>`${state.category}|${state.fabric}|${state.liner}|${state.width}`;
async function rolls(){if(!state.width)return[];return await req(db.transaction(RS).objectStore(RS).index('spec').getAll(spec()))}
async function putR(r){let t=db.transaction(RS,'readwrite');t.objectStore(RS).put(r);await done(t)}async function delR(id){let t=db.transaction(RS,'readwrite');t.objectStore(RS).delete(id);await done(t)}
const fmt=(n,d=2)=>Number(n||0).toLocaleString('ko-KR',{maximumFractionDigits:d});
function calc(D,d,t){return D>d&&d>0&&t>0?Math.PI*(D*D-d*d)/(4*t):0}
function fill(el,a,v,p){el.innerHTML=`<option value="">${p}</option>`+a.map(x=>`<option ${x===v?'selected':''}>${x}</option>`).join('')}
async function selectors(){let m=await all(MS),cats=[...new Set(m.map(x=>x.category))],box=$('categoryButtons');box.innerHTML='';cats.forEach(c=>{let b=document.createElement('button');b.className='chip'+(state.category===c?' active':'');b.textContent=c;b.onclick=()=>{state={...state,category:c,fabric:'',liner:'',width:''};selectors()};box.appendChild(b)});let f=[...new Set(m.filter(x=>x.category===state.category).map(x=>x.fabricName))];fill($('fabricSelect'),f,state.fabric,'원단 선택');let l=[...new Set(m.filter(x=>x.category===state.category&&x.fabricName===state.fabric).map(x=>x.liner))];fill($('linerSelect'),l,state.liner,'후지 선택');fill($('widthSelect'),WIDTHS,state.width,'폭 선택');await refresh()}
async function refresh(){let m=await master();if(!m){$('thicknessValue').textContent=state.liner?'미설정':'-';$('coreValue').textContent=state.liner?'90 mm':'-';$('maxLengthValue').textContent='미설정';$('masterState').textContent=state.liner?'이 조합은 아직 값이 없어.':'원단과 후지를 선택해줘.'}else{$('thicknessValue').textContent=`${fmt(m.thicknessMicron,3)} μm`;$('coreValue').textContent=`${fmt(m.coreDiameterMm)} mm`;$('maxLengthValue').textContent=m.maxRollLengthM>0?`${fmt(m.maxRollLengthM)} m`:'미설정';$('masterState').textContent=m.sourceType==='대체값'?`${m.liner} · 대체값 (${m.sourceNote||'동일 규격 은색 원단 기준'})`:`${m.liner} 기준값`}await refreshRolls()}

const FLOOR_VALUES=['3층','4층','미지정'];
const floorOf=r=>FLOOR_VALUES.includes(r.floor)?r.floor:'미지정';
const rollLength=r=>Number(r.savedLengthM)||0;
const koCompare=(a,b)=>String(a).localeCompare(String(b),'ko',{numeric:true});
function kstText(value){
 if(!value)return '';
 // Historical timezone-less values are treated as existing Korean local times.
 if(typeof value==='string'&&!/[zZ]|[+-]\d\d:\d\d$/.test(value))
  return value.replace('T',' ').slice(0,19);
 const d=new Date(value);
 if(!Number.isFinite(d.getTime()))return String(value);
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
}
function splitSpec(r){
 const p=String(r.specKey||'').split('|');
 return {category:p[0]||'',fabric:p[1]||'',liner:p[2]||'',width:p[3]||''};
}
function groupInventory(rows){
 const map=new Map();
 for(const r of rows){
  const p=splitSpec(r),key=JSON.stringify([p.category,p.fabric,p.width]);
  if(!map.has(key))map.set(key,{...p,liner:'',count:0,total:0,rows:[],liners:new Map()});
  const g=map.get(key);g.rows.push(r);g.count++;g.total+=rollLength(r);
  const l=g.liners.get(p.liner)||{count:0,total:0};
  l.count++;l.total+=rollLength(r);g.liners.set(p.liner,l);
 }
 return [...map.values()];
}
function sortInventory(groups,mode){
 const name=(a,b)=>koCompare(a.fabric,b.fabric)||koCompare(a.width,b.width)||koCompare(a.category,b.category);
 return groups.sort(mode==='lengthDesc'?(a,b)=>b.total-a.total||name(a,b):
  mode==='lengthAsc'?(a,b)=>a.total-b.total||name(a,b):name);
}
let overviewFloorState='3층';
function setOverviewFloor(floor){
 if(!FLOOR_VALUES.includes(floor))floor='3층';
 overviewFloorState=floor;
 document.querySelectorAll('[data-overview-floor]').forEach(btn=>{
  const active=btn.dataset.overviewFloor===floor;
  btn.classList.toggle('active',active);
  btn.setAttribute('aria-pressed',String(active));
 });
 $('overviewFloorTitle').textContent=`${floor} 재고`;
 refreshOverview();
}
async function refreshOverview(){
 const allRows=await all(RS);
 const stats={};
 for(const f of FLOOR_VALUES){
  const r=allRows.filter(x=>floorOf(x)===f);
  stats[f]={rows:r,total:r.reduce((s,x)=>s+rollLength(x),0)};
 }
 $('overview3Total').textContent=`${fmt(stats['3층'].total)} m`;
 $('overview3Count').textContent=`${stats['3층'].rows.length}롤`;
 $('overview4Total').textContent=`${fmt(stats['4층'].total)} m`;
 $('overview4Count').textContent=`${stats['4층'].rows.length}롤`;
 $('overviewUTotal').textContent=`${fmt(stats['미지정'].total)} m`;
 $('overviewUCount').textContent=`${stats['미지정'].rows.length}롤`;

 const rows=stats[overviewFloorState].rows;
 const groups=sortInventory(groupInventory(rows),$('overviewSort').value);
 $('overviewTotal').textContent=`총 ${fmt(stats[overviewFloorState].total)} m · ${rows.length}롤`;
 $('overviewFloorTitle').textContent=`${overviewFloorState} 재고`;
 const list=$('overviewList');list.replaceChildren();
 if(!groups.length){
  list.innerHTML=`<div class="empty">${overviewFloorState}에 등록된 재고가 없어.</div>`;
  return;
 }
 for(const g of groups){
  const box=document.createElement('article');box.className='overview-group';
  const head=document.createElement('div');head.className='overview-heading';
  const name=document.createElement('strong');name.textContent=`${g.fabric} · ${g.width}`;
  const total=document.createElement('b');total.textContent=`${fmt(g.total)} m`;
  head.append(name,total);box.appendChild(head);
  const detail=document.createElement('div');detail.className='overview-detail';
  detail.textContent=`${g.count}롤 · `+[...g.liners].map(([l,v])=>`${l} ${fmt(v.total)}m (${v.count}롤)`).join(' / ');
  box.appendChild(detail);list.appendChild(box);
 }
}

async function refreshRolls(){
 const list=$('rollList');
 if(!state.width){
  $('totalStock').textContent='0 m';$('rollCount').textContent='0롤';
  list.innerHTML='<div class="empty">폭까지 선택하면 재고가 보여.</div>';
  await refreshOverview();if(activeAppTab==='move')await refreshStockManager();return;
 }
 const floor=$('floorFilter').value;
 const a=(await rolls()).filter(r=>floor==='all'||floorOf(r)===floor).sort((x,y)=>x.rollNo-y.rollNo);
 $('totalStock').textContent=`${fmt(a.reduce((s,r)=>s+rollLength(r),0))} m`;
 $('rollCount').textContent=`${a.length}롤`;list.replaceChildren();
 if(!a.length)list.innerHTML='<div class="empty">해당 층에 등록된 롤이 없어.</div>';
 for(const r of a){
  const n=$('rollTemplate').content.cloneNode(true);
  n.querySelector('.rname').textContent=`${r.rollNo}번 롤 · ${r.isNewRoll?'새 롤':'사용중'}`;
  n.querySelector('.rsub').textContent=`${floorOf(r)} · `+(r.isNewRoll?'미사용':`전체 지름 ${fmt(r.outerDiameterMm)}mm`)+(r.memo?' · '+r.memo:'');
  n.querySelector('.rlen').textContent=`${fmt(r.savedLengthM)} m`;
  n.querySelector('.edit').onclick=()=>openRoll(r);
  n.querySelector('.del').onclick=async()=>{if(confirm(`${r.rollNo}번 롤을 삭제할까?`)){await delR(r.id);await refreshRolls();}};
  list.appendChild(n);
 }
 await refreshOverview();if(activeAppTab==='move')await refreshStockManager();
}
async function openMaster(){if(!state.fabric||!state.liner){alert('원단과 후지를 먼저 선택해줘.');return}let m=await master();$('masterDialogTitle').textContent=`${state.fabric} / ${state.liner}`;$('masterSource').textContent=m?.sourceType==='대체값'?`대체값 · ${m.sourceNote||''}`:'실측값 또는 사용자 설정값';$('masterThickness').value=m?.thicknessMicron??'';$('masterCore').value=m?.coreDiameterMm??90;$('masterMax').value=m?.maxRollLengthM||'';$('masterDialog').showModal()}
async function saveMaster(){let t=+$('masterThickness').value,c=+$('masterCore').value,x=+$('masterMax').value||0;if(!(t>0&&c>0)){alert('두께와 지관 지름을 확인해줘.');return false}await putM({key:`${state.category}|${state.fabric}|${state.liner}`,category:state.category,fabricName:state.fabric,liner:state.liner,thicknessMicron:t,coreDiameterMm:c,maxRollLengthM:x,sourceType:'사용자 설정',sourceNote:'',updatedAt:new Date().toISOString()});await refresh();return true}

let rollCalculation={master:null,estimated:null,valid:false,manualOverride:false,request:0};

function markRollResult(message,valid=false){
 $('calcResult').textContent=message;
 $('calcResult').dataset.valid=valid?'true':'false';
}

async function openRoll(r=null,forceNew=false){
 if(!state.category||!state.fabric||!state.liner||!state.width){
  alert('원단, 후지, 폭을 모두 선택해줘.');return;
 }
 let m=await master();
 if(!m){alert('먼저 원단 기본값을 저장해줘.');return;}
 state.editing=r;
 $('rollFloor').value=r?floorOf(r):(['3층','4층'].includes($('floorFilter').value)?$('floorFilter').value:'미지정');
 rollCalculation={master:m,estimated:null,valid:false,manualOverride:false,request:rollCalculation.request+1};
 $('rollSourceInfo').textContent=m.sourceType==='대체값'?`주의: ${m.sourceNote||'동일 규격 은색 원단 기준'} (임시 두께)`:'';let a=await rolls(),no=r?.rollNo??(a.length?Math.max(...a.map(x=>x.rollNo))+1:1);
 $('rollDialogTitle').textContent=r?`${no}번 롤 수정`:`${no}번 롤 등록`;
 $('rollProfileInfo').textContent=`${state.fabric} / ${state.liner} / ${state.width} · 두께 ${fmt(m.thicknessMicron,3)}μm · 지관 ${fmt(m.coreDiameterMm)}mm`;
 $('isNewRoll').checked=r?.isNewRoll??forceNew;
 $('outerDiameter').value=r?.outerDiameterMm||'';
 $('savedLength').value=r?.savedLengthM??(forceNew&&m.maxRollLengthM>0?m.maxRollLengthM:'');
 $('memo').value=r?.memo||'';
 syncNew(m);
 $('rollDialog').showModal();
}

function syncNew(m){
 if(!m)return;
 let n=$('isNewRoll').checked;
 $('outerRow').classList.toggle('hidden',n);
 if(n){
  rollCalculation.estimated=m.maxRollLengthM>0?m.maxRollLengthM:null;
  rollCalculation.valid=m.maxRollLengthM>0;
  if(m.maxRollLengthM>0){
   $('savedLength').value=m.maxRollLengthM;
   markRollResult(`새 롤: ${fmt(m.maxRollLengthM)} m`,true);
  }else{
   $('savedLength').value='';
   markRollResult('새 롤 등록 전에 한 롤 최대길이를 설정해줘.');
  }
 }else{
  updateRollCalculation();
 }
}

// The diameter input is the source of truth. A manual saved-length edit
// is allowed, but changing the diameter again recalculates the estimate.
function updateRollCalculation(){
 const m=rollCalculation.master;
 if(!m||$('isNewRoll').checked)return;
 const raw=$('outerDiameter').value.trim();
 const D=Number(raw);
 if(raw===''||!Number.isFinite(D)||D<=m.coreDiameterMm){
  rollCalculation.valid=false;
  rollCalculation.estimated=null;
  $('savedLength').value='';
  markRollResult(raw===''?'지름을 입력하면 잔량이 자동 계산돼.':
   `전체 지름은 지관 ${fmt(m.coreDiameterMm)}mm보다 커야 해.`);
  return;
 }
 if(!(m.thicknessMicron>0)){
  rollCalculation.valid=false;rollCalculation.estimated=null;
  $('savedLength').value='';
  markRollResult('원단 두께를 먼저 설정해줘.');
  return;
 }
 let x=calc(D,m.coreDiameterMm,m.thicknessMicron);
 if(m.maxRollLengthM>0)x=Math.min(x,m.maxRollLengthM);
 if(!Number.isFinite(x)||x<0){
  rollCalculation.valid=false;rollCalculation.estimated=null;
  $('savedLength').value='';
  markRollResult('계산할 수 없는 지름이야.');
  return;
 }
 rollCalculation.valid=true;
 rollCalculation.estimated=x;
 $('savedLength').value=x.toFixed(2);
 markRollResult(`계산 잔량: 약 ${fmt(x)} m`,true);
}

async function saveRoll(){
 let m=rollCalculation.master,isNew=$('isNewRoll').checked;
 if(!m)return false;
 if(isNew&&!(m.maxRollLengthM>0)){
  alert('새 롤은 한 롤 최대길이를 먼저 설정해줘.');return false;
 }
 let raw=$('savedLength').value.trim(),s=Number(raw);
 if(raw===''||!Number.isFinite(s)||s<0){
  alert('저장 재고를 확인해줘.');return false;
 }
 if(m.maxRollLengthM>0&&s>m.maxRollLengthM){
  alert('저장 재고가 한 롤 최대길이보다 커.');return false;
 }
 let D=0,e=m.maxRollLengthM;
 if(!isNew){
  D=Number($('outerDiameter').value);
  if(!rollCalculation.valid||!(D>m.coreDiameterMm)){
   alert('지름을 올바르게 입력해줘.');return false;
  }
  e=calc(D,m.coreDiameterMm,m.thicknessMicron);
  if(m.maxRollLengthM>0)e=Math.min(e,m.maxRollLengthM);
 }
 let a=await rolls(),no=state.editing?.rollNo??(a.length?Math.max(...a.map(x=>x.rollNo))+1:1);
 await putR({...state.editing,specKey:spec(),floor:$('rollFloor').value,rollNo:no,isNewRoll:isNew,outerDiameterMm:D,
  estimatedLengthM:e,savedLengthM:s,memo:$('memo').value.trim(),updatedAt:new Date().toISOString()});
 await refreshRolls();return true;
}
function download(blob,name){let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}const stamp=()=>new Date().toISOString().slice(0,10).replaceAll('-','');
async function backup(){download(new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),masters:await all(MS),rolls:await all(RS)},null,2)],{type:'application/json'}),`fabric_inventory_backup_${stamp()}.json`)}


// Selection uses stable roll IDs, never row indices or material names.
let stockRowsCache=[],stockSelected=new Set(),stockBusy=false,stockPending=null,stockRenderToken=0;
function stockSortRows(rows,mode){
 const name=(a,b)=>{
  const x=splitSpec(a),y=splitSpec(b);
  return koCompare(x.fabric,y.fabric)||koCompare(x.width,y.width)||koCompare(x.liner,y.liner)||koCompare(x.category,y.category)||a.rollNo-b.rollNo;
 };
 return rows.sort(mode==='lengthDesc'?(a,b)=>rollLength(b)-rollLength(a)||name(a,b):
  mode==='lengthAsc'?(a,b)=>rollLength(a)-rollLength(b)||name(a,b):name);
}
function stockVisibleRows(){
 const floor=$('stockFloor').value,query=$('stockSearch').value.trim().toLocaleLowerCase();
 return stockSortRows(stockRowsCache.filter(r=>{
  if(floor!=='all'&&floorOf(r)!==floor)return false;
  const p=splitSpec(r);
  return !query||[p.category,p.fabric,p.liner,p.width,r.rollNo].join(' ').toLocaleLowerCase().includes(query);
 }),$('stockSort').value);
}
function stockSelectionSummary(){
 const chosen=stockRowsCache.filter(r=>stockSelected.has(r.id));
 return {count:chosen.length,total:chosen.reduce((s,r)=>s+rollLength(r),0)};
}
function renderStockSelection(){
 const summary=stockSelectionSummary();
 $('stockSelectionInfo').textContent=`선택 ${summary.count}롤 · ${fmt(summary.total)} m`;
 $('stockMoveBtn').disabled=stockBusy||!summary.count||!$('stockDestination').value;
 for(const row of $('stockRows').querySelectorAll('tr[data-roll-id]')){
  const selected=stockSelected.has(Number(row.dataset.rollId));
  row.classList.toggle('selected',selected);
  row.setAttribute('aria-selected',String(selected));
  row.querySelector('input[type=checkbox]').checked=selected;
 }
}
function toggleStockRow(id,checked){
 if(stockBusy)return;
 if(checked)stockSelected.add(id);else stockSelected.delete(id);
 renderStockSelection();
}
function renderStockRows(){
 const rows=stockVisibleRows(),body=$('stockRows');
 body.replaceChildren();
 const totals=FLOOR_VALUES.map(f=>`${f} ${fmt(stockRowsCache.filter(r=>floorOf(r)===f).reduce((s,r)=>s+rollLength(r),0))}m`);
 $('stockTotals').textContent=totals.join(' · ');
 if(!rows.length){
  const tr=document.createElement('tr'),td=document.createElement('td');
  td.colSpan=5;td.className='stock-empty';td.textContent='조건에 맞는 재고가 없어.';
  tr.append(td);body.append(tr);
 }
 for(const r of rows){
  const p=splitSpec(r),tr=document.createElement('tr');
  tr.dataset.rollId=String(r.id);
  const checkCell=document.createElement('td'),check=document.createElement('input');
  check.type='checkbox';check.checked=stockSelected.has(r.id);
  check.setAttribute('aria-label',`${p.fabric} ${p.width} ${r.rollNo}번 롤 선택`);
  check.addEventListener('change',()=>toggleStockRow(r.id,check.checked));
  check.addEventListener('click',e=>e.stopPropagation());
  checkCell.append(check);tr.append(checkCell);
  const cells=[
   {value:`${p.fabric} · ${p.width}`,sub:`${p.liner} / ${p.category}`},
   {value:`${r.rollNo}번`,sub:r.isNewRoll?'새 롤':'사용중'},
   {value:fmt(r.savedLengthM),cls:'stock-number'},
   {value:floorOf(r)}
  ];
  for(const c of cells){
   const td=document.createElement('td');
   if(c.cls)td.className=c.cls;
   td.append(document.createTextNode(c.value));
   if(c.sub){const small=document.createElement('small');small.textContent=c.sub;td.append(small);}
   tr.append(td);
  }
  tr.tabIndex=0;tr.setAttribute('aria-label',`${p.fabric} ${p.width} ${r.rollNo}번 롤, ${fmt(r.savedLengthM)}미터, ${floorOf(r)}`);
  tr.addEventListener('click',e=>{if(e.target.closest('input,button,a'))return;toggleStockRow(r.id,!stockSelected.has(r.id));});
  tr.addEventListener('keydown',e=>{if(e.target!==tr)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleStockRow(r.id,!stockSelected.has(r.id));}});
  body.append(tr);
 }
 renderStockSelection();
}
async function refreshStockManager(){
 const token=++stockRenderToken;
 const rows=await all(RS);
 if(token!==stockRenderToken)return;
 stockRowsCache=rows;
 const ids=new Set(rows.map(r=>r.id));
 for(const id of stockSelected)if(!ids.has(id))stockSelected.delete(id);
 renderStockRows();
}
function selectVisibleStock(){
 if(stockBusy)return;
 for(const r of stockVisibleRows())stockSelected.add(r.id);
 renderStockSelection();
}
function clearStockSelection(){
 if(stockBusy)return;
 stockSelected.clear();renderStockSelection();
}
function inventoryBackupBlob(masters,rows){
 return new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),masters,rolls:rows},null,2)],{type:'application/json'});
}
async function openStockMoveDialog(){
 if(stockBusy)return;
 stockPending=null;
 const dest=$('stockDestination').value;
 if(!FLOOR_VALUES.includes(dest))return;
 const rows=await all(RS);
 const selected=rows.filter(r=>stockSelected.has(r.id)&&floorOf(r)!==dest);
 const unchanged=rows.filter(r=>stockSelected.has(r.id)&&floorOf(r)===dest).length;
 if(!selected.length){$('stockMoveStatus').textContent='선택한 롤이 이미 도착 층에 있어.';return;}
 stockPending={ids:selected.map(r=>r.id),dest};
 $('stockMoveDetails').textContent=`${selected.length}롤 · ${fmt(selected.reduce((s,r)=>s+rollLength(r),0))} m → ${dest}`+(unchanged?` (이미 ${dest}인 ${unchanged}롤 제외)`:'');
 $('stockMoveDialog').showModal();
}
async function confirmStockMove(){
 if(stockBusy||!stockPending)return;
 const pending=stockPending;
 stockBusy=true;$('stockMoveConfirm').disabled=true;
 $('stockMoveBtn').disabled=true;
 try{
  const before=await all(RS);
  const ids=new Set(pending.ids);
  const moving=before.filter(r=>ids.has(r.id)&&floorOf(r)!==pending.dest);
  if(!moving.length){$('stockMoveStatus').textContent='변경할 재고가 없어.';$('stockMoveDialog').close();return;}
  // Every selected ID is validated again immediately before writing.
  // A backup is generated from the same transaction snapshot.
  const tx=db.transaction([MS,RS],'readwrite');
  let committed=false,current=[];
  try{
  const store=tx.objectStore(RS),masterStore=tx.objectStore(MS);
  const records=await req(store.getAll()),currentMasters=await req(masterStore.getAll());
  current=records.filter(r=>ids.has(r.id)&&floorOf(r)!==pending.dest);
  // Do not move a record that changed after confirmation.
  for(const r of current){
   const old=before.find(x=>x.id===r.id);
   if(!old||JSON.stringify(old)!==JSON.stringify(r))throw new Error('재고가 변경됐어. 다시 확인해줘.');
  }
  const backupName=`fabric_inventory_before_floor_move_${stamp()}_${Date.now()}.json`;
  download(inventoryBackupBlob(currentMasters,records),backupName);
  for(const r of current)store.put({...r,floor:pending.dest});
  await done(tx);
  committed=true;
  }catch(e){if(!committed){try{tx.abort();}catch{}}throw e;}
  for(const r of current)stockSelected.delete(r.id);
  stockPending=null;$('stockMoveDialog').close();
  $('stockMoveStatus').textContent=`완료: ${current.length}롤 · ${fmt(current.reduce((s,r)=>s+rollLength(r),0))} m → ${pending.dest}`;
  await refreshRolls();
 }catch(e){
  console.error(e);
  stockPending=null;$('stockMoveDialog').close();
  $('stockMoveStatus').textContent='이동에 실패했어. 재고를 다시 확인해줘.';
  alert('이동에 실패했어. 재고가 변경됐거나 저장 오류가 발생했을 수 있어.');
 }finally{
  stockBusy=false;$('stockMoveConfirm').disabled=false;
  renderStockSelection();
 }
}
async function restore(f){try{let d=JSON.parse(await f.text());if(!Array.isArray(d.masters)||!Array.isArray(d.rolls))throw 0;let t=db.transaction([MS,RS],'readwrite'),ms=t.objectStore(MS),rs=t.objectStore(RS);ms.clear();rs.clear();d.masters.forEach(x=>ms.put(x));d.rolls.forEach(x=>rs.put(x));await done(t);stockSelected.clear();stockPending=null;await refreshStockManager();alert('복원 완료.');state={category:'',fabric:'',liner:'',width:'',editing:null};selectors()}catch{alert('백업 파일을 읽지 못했어.')}}
function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}const u16=n=>[n&255,n>>>8&255],u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255],utf8=s=>new TextEncoder().encode(s);
function zip(files){let out=[],cen=[],off=0;for(const[n,c]of files){let N=utf8(n),D=utf8(c),z=crc32(D),L=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(z),...u32(D.length),...u32(D.length),...u16(N.length),...u16(0),...N]);out.push(L,D);cen.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(z),...u32(D.length),...u32(D.length),...u16(N.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off),...N]));off+=L.length+D.length}let cs=cen.reduce((s,x)=>s+x.length,0),n=files.length,E=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(n),...u16(n),...u32(cs),...u32(off),...u16(0)]);return new Blob([...out,...cen,E],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');function col(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}
// Spreadsheet export: local KST dates, floor reports, and formula-driven totals.
function excelDate(value){
 if(!value)return null;
 // Earlier local timestamps without an offset are already Korean wall-clock time.
 let d;
 if(typeof value==='string'&&!/[zZ]|[+-]\d\d:\d\d$/.test(value))
  d=new Date(value.replace(' ','T')+'+09:00');
 else d=new Date(value);
 if(!Number.isFinite(d.getTime()))return null;
 return (d.getTime()+9*3600000-Date.UTC(1899,11,30))/86400000;
}
function reportSheet(rows, widths=[], numeric=[], dateColumns=[], totalRows=[]){
 const lastCol=col(Math.max(...rows.map(r=>r.length),1));
 const body=rows.map((row,i)=>`<row r="${i+1}">`+row.map((v,j)=>{
  const ref=`${col(j+1)}${i+1}`,style=i===0?' s="1"':dateColumns.includes(j)?' s="3"':
   numeric.includes(j)?' s="2"':'';
  if(v&&typeof v==='object'&&v.formula){
   return `<c r="${ref}" s="2"><f>${esc(v.formula.replace(/^=/,''))}</f><v>${v.value}</v></c>`;
  }
  if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"${style}><v>${v}</v></c>`;
  return `<c r="${ref}"${style} t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
 }).join('')+'</row>').join('');
 const columns=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
 const last=rows.length;
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${body}</sheetData><autoFilter ref="A1:${lastCol}${last}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}
function reportFormula(formula,value){return {formula,value};}
function sumOf(rows){return rows.reduce((s,r)=>s+rollLength(r),0);}
function reportData(masters,allRolls,sortMode='name'){
 const rows=allRolls.slice().sort((a,b)=>{
  const x=splitSpec(a),y=splitSpec(b);
  return koCompare(x.fabric,y.fabric)||koCompare(x.width,y.width)||
   koCompare(floorOf(a),floorOf(b))||a.rollNo-b.rollNo;
 });
 const detailHeader=['층','분류','원단명','후지','폭','롤번호','상태','전체지름(mm)','계산잔량(m)','저장재고(m)','메모','수정일(KST)'];
 const detail=[detailHeader,...rows.map(r=>{
  const p=splitSpec(r);
  return [floorOf(r),p.category,p.fabric,p.liner,p.width,r.rollNo,r.isNewRoll?'새 롤':'사용중',
   r.outerDiameterMm||0,r.estimatedLengthM||0,rollLength(r),r.memo||'',excelDate(r.updatedAt)];
 })];
 const end=detail.length,ref=(c)=>`'롤재고'!$${c}$2:$${c}$${Math.max(end,2)}`;
 const summaryHeader=['분류','원단명','폭','롤 수','전체 합계(m)','3층(m)','4층(m)','미지정(m)'];
 const groups=sortInventory(groupInventory(rows),sortMode);
 const summary=[summaryHeader];
 groups.forEach((g,i)=>{
  const n=i+2,criteria=`${ref('B')},A${n},${ref('C')},B${n},${ref('E')},C${n}`;
  const matching=rows.filter(r=>{const p=splitSpec(r);return p.category===g.category&&p.fabric===g.fabric&&p.width===g.width;});
  const total=matching.reduce((s,r)=>s+rollLength(r),0);
  summary.push([g.category,g.fabric,g.width,
   reportFormula(`COUNTIFS(${criteria})`,g.count),
   reportFormula(`SUMIFS(${ref('J')},${criteria})`,total),
   ...FLOOR_VALUES.map(f=>reportFormula(`SUMIFS(${ref('J')},${criteria},${ref('A')},"${f}")`,sumOf(matching.filter(r=>floorOf(r)===f))))]);
 });
 const floorReports={};
 for(const floor of FLOOR_VALUES){
  const fRows=rows.filter(r=>floorOf(r)===floor),gg=sortInventory(groupInventory(fRows),sortMode);
  const result=[['분류','원단명','폭','후지별 내역','롤 수','합계(m)']];
  gg.forEach((g,i)=>{
   const n=i+2,criteria=`${ref('A')},"${floor}",${ref('B')},A${n},${ref('C')},B${n},${ref('E')},C${n}`;
   result.push([g.category,g.fabric,g.width,[...g.liners].map(([l,v])=>`${l}: ${fmt(v.total)}m`).join(' / '),
    reportFormula(`COUNTIFS(${criteria})`,g.count),reportFormula(`SUMIFS(${ref('J')},${criteria})`,g.total)]);
  });
  floorReports[floor]=result;
 }
 const masterRows=[['분류','원단명','후지','두께(μm)','지관(mm)','한 롤 최대길이(m)','두께 구분','적용 기준','수정일(KST)'],
  ...masters.slice().sort((a,b)=>koCompare(a.fabricName,b.fabricName)||koCompare(a.liner,b.liner)).map(m=>
   [m.category,m.fabricName,m.liner,m.thicknessMicron,m.coreDiameterMm,m.maxRollLengthM||0,m.sourceType||'미분류',m.sourceNote||'',excelDate(m.updatedAt)])];
 const overview=[['재고 현황','값'],['기준 시간(KST)',kstText(new Date().toISOString())],
  ['전체 롤 수',rows.length],['전체 재고(m)',sumOf(rows)],
  ...FLOOR_VALUES.map(f=>[f+' 재고(m)',sumOf(rows.filter(r=>floorOf(r)===f))]),
  ['정렬 기준',sortMode==='lengthDesc'?'길이 긴 순':sortMode==='lengthAsc'?'길이 짧은 순':'원단명순'],
  ['집계 기준','분류 + 원단명 + 폭 (후지 합산)'],
  ['미지정','기존 재고는 보관층 확인 후 3층/4층으로 지정'],
  ['수정 시간','한국 시간(Asia/Seoul), 기존 시간대 없는 기록은 한국 현지시각으로 해석']];
 return {overview,summary,floorReports,detail,masterRows};
}
function makeReportXlsx(data){
 const sheets=[
  ['요약',data.overview,[34,55],[1],[]],
  ['원단폭합계',data.summary,[17,27,14,12,20,18,18,18],[3,4,5,6,7],[]],
  ...FLOOR_VALUES.map(f=>[f,data.floorReports[f],[17,27,14,52,12,20],[4,5],[]]),
  ['롤재고',data.detail,[13,17,27,17,14,12,14,20,20,20,36,23],[5,7,8,9],[11]],
  ['원단마스터',data.masterRows,[17,27,17,17,17,23,17,40,23],[3,4,5],[8]]
 ];
 const types=['<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>',
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
  ...sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`),'</Types>'].join('');
 const styles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.##"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts><fonts count="2"><font><sz val="10"/><name val="Malgun Gothic"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Malgun Gothic"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF315CB0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 const files=[
  ['[Content_Types].xml',types],
  ['_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml',`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${esc(s[0])}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr fullCalcOnLoad="1"/></workbook>`],
  ['xl/_rels/workbook.xml.rels',`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
  ['xl/styles.xml',styles],
  ...sheets.map((s,i)=>[`xl/worksheets/sheet${i+1}.xml`,reportSheet(s[1],s[2],s[3],s[4])])
 ];
 return zip(files);
}
async function xlsx(){
 const data=reportData(await all(MS),await all(RS),$('overviewSort').value);
 download(makeReportXlsx(data),`fabric_inventory_${stamp()}.xlsx`);
}

let activeAppTab='main';
function setAppTab(tab){
 activeAppTab=tab==='move'?'move':'main';
 const isMain=activeAppTab==='main';
 $('mainTabPanel').classList.toggle('active',isMain);
 $('moveTabPanel').classList.toggle('active',!isMain);
 $('mainTabBtn').classList.toggle('active',isMain);
 $('moveTabBtn').classList.toggle('active',!isMain);
 $('mainTabBtn').setAttribute('aria-selected',String(isMain));
 $('moveTabBtn').setAttribute('aria-selected',String(!isMain));
 try{localStorage.setItem('fabricInventoryActiveTab',activeAppTab);}catch{}
 if(!isMain)refreshStockManager();
 window.scrollTo({top:0,behavior:'smooth'});
}
function restoreAppTab(){
 let tab='main';
 try{tab=localStorage.getItem('fabricInventoryActiveTab')||'main';}catch{}
 setAppTab(tab);
}
function bind(){$('mainTabBtn').onclick=()=>setAppTab('main');$('moveTabBtn').onclick=()=>setAppTab('move');$('fabricSelect').onchange=e=>{state.fabric=e.target.value;state.liner='';state.width='';selectors()};$('linerSelect').onchange=e=>{state.liner=e.target.value;state.width='';selectors()};$('widthSelect').onchange=e=>{state.width=e.target.value;refresh()};$('editMasterBtn').onclick=openMaster;$('masterForm').onsubmit=async e=>{e.preventDefault();if(await saveMaster())$('masterDialog').close()};$('addNewRollBtn').onclick=()=>openRoll(null,true);$('addUsedRollBtn').onclick=()=>openRoll();$('isNewRoll').onchange=()=>syncNew(rollCalculation.master);$('outerDiameter').addEventListener('input',updateRollCalculation);$('rollForm').onsubmit=async e=>{e.preventDefault();if(await saveRoll())$('rollDialog').close()};$('stockRefresh').onclick=refreshStockManager;
$('stockFloor').onchange=renderStockRows;
$('stockSort').onchange=renderStockRows;
$('stockSearch').oninput=renderStockRows;
$('stockSelectVisible').onclick=selectVisibleStock;
$('stockClearSelection').onclick=clearStockSelection;
$('stockDestination').onchange=renderStockSelection;
$('stockMoveBtn').onclick=openStockMoveDialog;
$('stockMoveCancel').onclick=()=>{if(stockBusy)return;$('stockMoveDialog').close();stockPending=null;};
$('stockMoveConfirm').onclick=confirmStockMove;
$('floorFilter').onchange=refreshRolls;
document.querySelectorAll('[data-overview-floor]').forEach(b=>b.onclick=()=>setOverviewFloor(b.dataset.overviewFloor));
$('overviewSort').onchange=refreshOverview;
$('refreshOverview').onclick=refreshOverview;
$('exportXlsxBtn').onclick=xlsx;$('backupBtn').onclick=backup;$('restoreInput').onchange=e=>{let f=e.target.files[0];if(f&&confirm('현재 데이터를 지우고 이 백업으로 복원할까?'))restore(f);e.target.value=''};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installBtn').classList.remove('hidden')});$('installBtn').onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installBtn').classList.add('hidden')}}}
(async()=>{await openDb();bind();await selectors();restoreAppTab();if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{})})();
