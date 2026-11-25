(function(root){'use strict';
const R=typeof module==='object'&&module.exports?require('./raffle.js'):root.UTRaffle;
function createRoster(id,name){return{id,name,people:[],picked:[],scores:{},absent:[],day:'',showScores:false};}
function available(roster){const excluded=new Set([...roster.picked,...roster.absent]);return roster.people.filter(p=>!excluded.has(p.id));}
function pick(roster,random=R.randomInt){const pool=available(roster);if(!pool.length)throw Error('ครบทุกคนแล้ว');return{...roster,picked:[...roster.picked,pool[random(pool.length)].id]};}
function undo(roster){return{...roster,picked:roster.picked.slice(0,-1)};}
function newRound(roster){return{...roster,picked:[]};}
function setAbsent(roster,id,absent){if(!roster.people.some(p=>p.id===id))throw Error('ไม่พบรายชื่อ');return{...roster,absent:[...new Set(absent?[...roster.absent,id]:roster.absent.filter(x=>x!==id))]};}
function score(roster,id,delta){if(!roster.picked.includes(id)||![1,-1].includes(delta))throw Error('เลือกผู้ที่เรียกแล้ว');return{...roster,scores:{...roster.scores,[id]:(roster.scores[id]||0)+delta}};}
function replacePeople(roster,people){const ids=new Set(people.map(p=>p.id));return{...roster,people,picked:roster.picked.filter(id=>ids.has(id)),absent:roster.absent.filter(id=>ids.has(id)),scores:Object.fromEntries(Object.entries(roster.scores).filter(([id])=>ids.has(id)))};}
function attendanceDay(roster,day){return roster.day===day?roster:{...roster,day,absent:[]};}
const api={createRoster,available,pick,undo,newRound,setAbsent,score,replacePeople,attendanceDay};if(typeof module==='object'&&module.exports)module.exports=api;
if(!root.document)return;
const $=id=>document.getElementById(id),UT=root.UT;let busy=false;
let state=UT.store.get('picker-state',null);if(!state||state.version!==1||!Array.isArray(state.rosters)||!state.rosters.length)state={version:1,active:'class-1',rosters:[createRoster('class-1','ห้องเรียน 1')]};
if(!state.rosters.some(r=>r.id===state.active))state.active=state.rosters[0].id;
function today(){const d=new Date();return[d.getFullYear(),d.getMonth()+1,d.getDate()].join('-');}
state.rosters=state.rosters.map(r=>attendanceDay(r,today()));
function roster(){return state.rosters.find(r=>r.id===state.active);}
function save(){UT.store.set('picker-state',state);}
function update(r){state.rosters=state.rosters.map(old=>old.id===r.id?r:old);save();render();}
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function message(s){$('picker-status').textContent=s;}
function button(text,fn){const b=el('button',text,'btn ghost');b.disabled=busy;b.onclick=fn;return b;}
function render(){const r=roster(),pool=available(r);$('roster-select').replaceChildren(...state.rosters.map(c=>{const o=el('option',c.name);o.value=c.id;return o;}));$('roster-select').value=r.id;$('roster-title').textContent=r.name;$('picker-count').textContent=r.people.length+' คน · ยังไม่เรียก '+pool.length+' คน · ขาด/ไม่อยู่ '+r.absent.length+' คน';$('scores').checked=r.showScores;
for(const id of ['roster-select','create-roster','rename-roster','delete-roster','picker-names','import-names','save-names','new-round','scores'])$(id).disabled=busy;
$('pick').disabled=busy||!pool.length;$('undo').disabled=busy||!r.picked.length;$('new-round').hidden=!!pool.length;
const last=r.people.find(p=>p.id===r.picked.at(-1));if(!busy)$('picker-display').textContent=last?.name||(r.people.length&&!pool.length?'ครบทุกคนแล้ว':'พร้อมแล้ว!');if(!busy)message(!r.people.length?'เพิ่มรายชื่อเพื่อเริ่มสุ่ม':!pool.length?'ครบทุกคนแล้ว · เริ่มรอบใหม่ได้เลย':'เหลือ '+pool.length+' คนในรอบนี้');
$('students').replaceChildren();r.people.forEach(p=>{const row=el('div',undefined,'student-row'),label=el('label'),check=el('input');check.type='checkbox';check.checked=r.absent.includes(p.id);check.disabled=busy;check.onchange=()=>update(setAbsent(roster(),p.id,check.checked));label.append(check,el('span',p.name+' · ขาด/ไม่อยู่'));row.append(label);$('students').append(row);});
$('picked-list').replaceChildren();r.picked.forEach((id,i)=>{const p=r.people.find(x=>x.id===id);if(!p)return;const row=el('div',undefined,'student-row');row.append(el('strong',(i+1)+'. '+p.name));if(r.showScores){row.append(el('span','คะแนน '+(r.scores[id]||0)),button('+1',()=>update(score(roster(),id,1))),button('−1',()=>update(score(roster(),id,-1))));}$('picked-list').append(row);});}
function fillNames(){$('picker-names').value=R.namesText(roster().people);$('dedupe-warning').textContent='';}
$('roster-select').onchange=()=>{state.active=$('roster-select').value;save();fillNames();render();};
$('create-roster').onclick=()=>{const name=root.prompt('ชื่อห้องใหม่');if(!name?.trim())return;let id='class-'+Date.now();while(state.rosters.some(r=>r.id===id))id+='x';state.rosters.push(attendanceDay(createRoster(id,name.trim()),today()));state.active=id;save();fillNames();render();};
$('rename-roster').onclick=()=>{const name=root.prompt('ชื่อห้อง',roster().name);if(name?.trim())update({...roster(),name:name.trim()});};
$('delete-roster').onclick=()=>{if(!root.confirm('ลบห้อง “'+roster().name+'” รวมรายชื่อและคะแนน?'))return;state.rosters=state.rosters.filter(r=>r.id!==state.active);if(!state.rosters.length)state.rosters=[createRoster('class-1','ห้องเรียน 1')];state.active=state.rosters[0].id;save();fillNames();render();};
function applyNames(parsed){update(replacePeople(roster(),parsed.people));fillNames();$('dedupe-warning').textContent=parsed.duplicates?'ตัดรายชื่อซ้ำ '+parsed.duplicates+' รายการ (ชื่อและแผนกตรงกัน)':'';}
$('save-names').onclick=()=>{try{applyNames(R.parseParticipants($('picker-names').value));}catch(e){message(e.message);}};
$('import-names').onchange=async()=>{const active=state.active;try{const parsed=await R.importFile($('import-names').files[0]);if(parsed&&active===state.active&&!busy)applyNames(parsed);}catch(e){message(e.message);}$('import-names').value='';};
function choose(){if(busy)return;const refreshed=attendanceDay(roster(),today());try{const r=pick(refreshed),person=r.people.find(p=>p.id===r.picked.at(-1));busy=true;update(r);message('กำลังสุ่ม…');$('picker-display').setAttribute('aria-live','off');const start=performance.now(),reduced=root.matchMedia('(prefers-reduced-motion: reduce)').matches;let next=0,ticker=0,done=false;function finish(){if(done)return;done=true;busy=false;$('picker-display').setAttribute('aria-live','polite');render();$('picker-display').textContent=person.name;}function frame(now){if(done)return;const t=(now-start)/1200;if(t<1&&!reduced){if(now>=next){$('picker-display').textContent=refreshed.people[ticker++%refreshed.people.length].name;next=now+50+150*t;}requestAnimationFrame(frame);}else finish();}requestAnimationFrame(frame);setTimeout(finish,1500);}catch(e){message(e.message);}}
$('pick').onclick=choose;$('undo').onclick=()=>update(undo(roster()));$('new-round').onclick=()=>update(newRound(roster()));$('scores').onchange=()=>update({...roster(),showScores:$('scores').checked});$('fullscreen').onclick=()=>UT.fullscreen($('picker-stage'));
$('export-csv').onclick=()=>{const r=roster();UT.download(new Blob([R.csv([['ห้อง','ชื่อ','แผนก','คะแนน','สถานะ','ลำดับเรียก'],...r.people.map(p=>[r.name,p.name,p.department,r.scores[p.id]||0,r.absent.includes(p.id)?'ขาด/ไม่อยู่':r.picked.includes(p.id)?'เรียกแล้ว':'ยังไม่เรียก',r.picked.includes(p.id)?r.picked.indexOf(p.id)+1:''])])],{type:'text/csv;charset=utf-8'}),'unitools-picker.csv');};
document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;if(e.code==='Space'){if(e.target.tagName==='BUTTON')return;e.preventDefault();if(!$('pick').disabled)choose();}if(e.key.toLowerCase()==='u'&&!$('undo').disabled)$('undo').onclick();if(e.key.toLowerCase()==='f')$('fullscreen').onclick();});
function refreshAttendance(){if(busy)return;const r=roster(),fresh=attendanceDay(r,today());if(fresh!==r)update(fresh);}
root.addEventListener?.('focus',refreshAttendance);document.addEventListener('visibilitychange',refreshAttendance);
fillNames();save();render();
})(typeof globalThis!=='undefined'?globalThis:this);
