(function(root){'use strict';
const R=root.UTRaffle||(typeof require==='function'?require('./raffle.js'):{}),PREFIX='unitools-checkin-';
const clean=s=>typeof s==='string'?s.trim().normalize('NFC'):'';
function validCheckin(m){return !!m&&typeof m.clientId==='string'&&/^[\w-]{8,100}$/.test(m.clientId)&&typeof m.name==='string'&&clean(m.name).length>0&&m.name.length<=120&&typeof m.department==='string'&&m.department.length<=120}
function checkIn(state,m,now=Date.now()){
 if(!validCheckin(m)||!Number.isFinite(now))return{error:'กรุณาระบุชื่อไม่เกิน 120 ตัว และรหัสอุปกรณ์ที่ถูกต้อง'};
 const previous=state.entries.find(p=>p.clientId===m.clientId);if(previous)return{entry:previous,repeated:true};
 // Removed check-ins remain tombstones so the same device cannot spam after removal.
 if((state.blocked||[]).includes(m.clientId))return{error:'อุปกรณ์นี้เคยลงทะเบียนแล้ว กรุณาติดต่อผู้จัด'};
 const name=clean(m.name),department=clean(m.department),duplicate=state.entries.some(p=>p.name===name&&p.department===department);
 const entry={id:m.clientId,clientId:m.clientId,name,department,number:state.nextNumber||Math.max(0,...state.entries.map(p=>p.number))+1,at:now,duplicate};state.nextNumber=entry.number+1;state.entries.push(entry);return{entry,repeated:false};
}
function recomputeDuplicates(state){const seen=new Set();state.entries.slice().sort((a,b)=>a.number-b.number).forEach(p=>{const key=JSON.stringify([clean(p.name),clean(p.department)]);p.duplicate=seen.has(key);seen.add(key)})}
function lookup(guests,prefix){prefix=clean(prefix);return prefix.length<2?[]:guests.filter(p=>p.name.startsWith(prefix)).slice(0,5).map(({name,department})=>({name,department}))}
function removeCheckin(state,id){const p=state.entries.find(e=>e.id===id);if(!p)return false;state.entries=state.entries.filter(e=>e.id!==id);state.blocked=Array.from(new Set([...(state.blocked||[]),p.clientId]));recomputeDuplicates(state);return p}
function restoreCheckin(state,p){if(!p||state.entries.some(e=>e.id===p.id))return false;state.blocked=(state.blocked||[]).filter(id=>id!==p.clientId);state.entries.push(p);recomputeDuplicates(state);return true}
const api={recomputeDuplicates,lookup,PREFIX,validCheckin,checkIn,removeCheckin,restoreCheckin};if(typeof module!=='undefined')module.exports=api;root.UTCheckin=api;if(!root.document)return;
const $=id=>document.getElementById(id),UT=root.UT,Room=root.UTRoom,el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e},btn=(text,fn)=>{const b=el('button',text,'btn');b.onclick=fn;return b},note=t=>$('event-status').textContent=t;
let state=UT.store.get('checkin-host',null),host=null,client=null,lastRemoved=null,guestList=[],room='',online=false;
const validSaved=s=>s&&Room.validRoom(s.code)&&Array.isArray(s.guests)&&Array.isArray(s.entries)&&s.entries.every(e=>validCheckin(e)&&Number.isInteger(e.number)&&Number.isFinite(e.at))&&typeof s.event==='string';
if(!validSaved(state))state=null;else recomputeDuplicates(state);
let clientId=UT.store.get('checkin-client-id','');if(!/^[\w-]{8,100}$/.test(clientId)){clientId=root.crypto.randomUUID();UT.store.set('checkin-client-id',clientId)}
const save=()=>UT.store.set('checkin-host',state),stamp=n=>new Date(n).toLocaleString('th-TH');
function suggestions(guests){guestList=guests;$('guest-options').replaceChildren(...guests.map(p=>{const o=el('option');o.value=p.name;o.label=p.department;return o}))}
function autofill(name,department){const p=guestList.filter(p=>p.name===$(name).value);if(p.length===1)$(department).value=p[0].department}
$('kiosk-name').oninput=()=>autofill('kiosk-name','kiosk-department');$('attendee-name').oninput=()=>{autofill('attendee-name','attendee-department');suggestions([]);const prefix=$('attendee-name').value.trim();if(prefix.length>=2&&prefix.length<=120)client?.send({t:'lookup',clientId,prefix})};
function publicMessage(c){return{t:'state',event:state.event,entry:state.entries.find(e=>e.clientId===c.checkinId)||null,blocked:(state.blocked||[]).includes(c.checkinId)}}
function publish(){save();renderHost();host?.broadcast(c=>publicMessage(c))}
function renderHost(){
 $('host-event').textContent=state.event;$('counter').textContent='มาแล้ว '+state.entries.filter(e=>!e.duplicate).length+' / '+(state.guests.length||'ไม่จำกัด')+' คน'+(state.entries.some(e=>e.duplicate)?' · ไม่นับรายการที่ทำเครื่องหมายซ้ำ':'');
 const query=$('search-checkins').value.trim().toLowerCase();$('checkins').replaceChildren();[...state.entries].sort((a,b)=>b.at-a.at||b.number-a.number).filter(e=>(e.name+' '+e.department).toLowerCase().includes(query)).forEach(e=>{const row=el('div',undefined,'event-checkin-row');row.append(el('strong','#'+e.number+' '+e.name),el('span',e.department+' · '+stamp(e.at)),btn(e.duplicate?'ยกเลิกซ้ำ':'ทำเครื่องหมายซ้ำ',()=>{e.duplicate=!e.duplicate;publish()}),btn('ลบ / ย้อนกลับ',()=>{lastRemoved=removeCheckin(state,e.id);publish()}));if(e.duplicate)row.classList.add('checkin-duplicate');$('checkins').append(row)});
 if(lastRemoved)$('checkins').append(btn('คืนรายการล่าสุด: '+lastRemoved.name,()=>{restoreCheckin(state,lastRemoved);lastRemoved=null;publish()}));
 $('kiosk-guests').replaceChildren(...state.guests.filter(p=>!state.entries.some(e=>e.name===p.name&&e.department===p.department)).map(p=>btn(p.name+(p.department?' · '+p.department:''),()=>{const result=checkIn(state,{clientId:'kiosk-'+root.crypto.randomUUID(),name:p.name,department:p.department});publish();note(result.error||'ลงทะเบียน '+p.name+' แล้ว')})));
}
function roomInfo(code){state.code=code;save();$('room-code').textContent=code;$('join-url').textContent=Room.joinURL(code);Room.renderQR($('join-qr'),code)}
function start(resume=false){if(!root.Peer){note('โหลด PeerJS ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่');return}try{if(!resume)state={code:Room.roomCode(),event:$('event').value.trim()||'งานเลี้ยง',guests:R.parseParticipants($('names').value).people,entries:[],blocked:[],nextNumber:1};if(state.guests.length>10000||state.guests.some(p=>!p.name||p.name.length>120||p.department.length>120))throw Error('รายชื่อแขกไม่เกิน 10000 คน ชื่อและรหัส/แผนกไม่เกิน 120 ตัว');host?.destroy();$('setup').hidden=true;$('host').hidden=false;$('attendee').hidden=true;suggestions(state.guests);roomInfo(state.code);renderHost();host=Room.createHost({prefix:PREFIX,code:state.code,onStatus:s=>Room.statusPill($('host-status'),s),onCode:roomInfo,onReady:()=>roomInfo(state.code),onError:e=>note('เชื่อมต่อไม่ได้: '+e.type),onJoin:c=>Room.sendTo(c,publicMessage(c)),onMessage:(m,c)=>{
 if(typeof m.clientId!=='string'||!/^[\w-]{8,100}$/.test(m.clientId))return;
 if(c.checkinId&&c.checkinId!==m.clientId)return;c.checkinId=m.clientId;
 if(m.t==='hello'){Room.sendTo(c,publicMessage(c));return}if(m.t==='lookup'){if(typeof m.prefix==='string'&&m.prefix.length<=120)Room.sendTo(c,{t:'lookup',prefix:m.prefix,guests:lookup(state.guests,m.prefix)});return}if(m.t!=='checkin'||state.entries.length>=10000)return;
 const result=checkIn(state,m);if(result.error){Room.sendTo(c,{t:'error',message:result.error});return}if(!result.repeated)publish();else Room.sendTo(c,publicMessage(c));
 }});}catch(e){note(e.message)}}
function success(entry){$('attendee-form').hidden=!!entry;$('success').replaceChildren();if(entry)$('success').append(el('h2','ลงทะเบียนสำเร็จ ✓'),el('strong','ลำดับที่ '+entry.number),el('p',entry.name),el('p',stamp(entry.at)))}
function join(code){if(!Room.validRoom(code)){note('รหัสห้องไม่ถูกต้อง');return}if(!root.Peer){note('โหลด PeerJS ไม่ได้ กรุณาตรวจอินเทอร์เน็ต');return}host?.destroy();client?.destroy();room=code;online=false;$('setup').hidden=$('host').hidden=true;$('attendee').hidden=false;$('submit-checkin').disabled=true;success(null);client=Room.joinRoom({prefix:PREFIX,code,onStatus:s=>{Room.statusPill($('connection-status'),s);online=s==='เชื่อมต่อแล้ว';$('submit-checkin').disabled=!online},onOpen:()=>client.send({t:'hello',clientId}),onError:e=>note('เชื่อมต่อไม่ได้: '+e.type),onState:m=>{
 if(m.t==='error'){note(typeof m.message==='string'?m.message:'ลงทะเบียนไม่ได้');$('submit-checkin').disabled=!online;return}
 if(m.t==='lookup'){if(m.prefix===$('attendee-name').value.trim()&&Array.isArray(m.guests)&&m.guests.length<=5&&m.guests.every(p=>p&&typeof p.name==='string'&&p.name.length<=120&&typeof p.department==='string'&&p.department.length<=120))suggestions(m.guests);return}if(m.t!=='state'||typeof m.event!=='string')return;
 if(m.entry&&(!validCheckin(m.entry)||m.entry.clientId!==clientId||!Number.isInteger(m.entry.number)||!Number.isFinite(m.entry.at)))return;
 $('attendee-event').textContent=m.event;success(m.entry);$('submit-checkin').disabled=!online||!!m.blocked;if(m.blocked){$('success').textContent='ผู้จัดนำรายการออกแล้ว กรุณาติดต่อโต๊ะลงทะเบียน';$('attendee-form').hidden=true}
 }});}
$('start-room').onclick=()=>start();$('resume-room').onclick=()=>start(true);$('resume-room').hidden=!state;
$('copy-link').onclick=()=>UT.copy(Room.joinURL(state.code));$('join-form').onsubmit=e=>{e.preventDefault();join($('join-code').value.trim().toUpperCase())};
$('kiosk-form').onsubmit=e=>{e.preventDefault();const result=checkIn(state,{clientId:'kiosk-'+root.crypto.randomUUID(),name:$('kiosk-name').value,department:$('kiosk-department').value});if(result.error)return note(result.error);publish();note(result.entry.name+' · ลงทะเบียนสำเร็จ ลำดับที่ '+result.entry.number);$('kiosk-name').value=$('kiosk-department').value=''};
$('attendee-form').onsubmit=e=>{e.preventDefault();if(!online)return note('กรุณารอเชื่อมต่อใหม่');const m={t:'checkin',clientId,name:$('attendee-name').value,department:$('attendee-department').value};if(!validCheckin(m))return note('กรุณาระบุชื่อไม่เกิน 120 ตัว');if(client.send(m)){$('submit-checkin').disabled=true;note('กำลังลงทะเบียน…');setTimeout(()=>{if(!$('attendee-form').hidden)$('submit-checkin').disabled=!online},5000)}else note('ยังส่งไม่ได้ กรุณารอเชื่อมต่อใหม่')};
$('search-checkins').oninput=renderHost;
$('export').onclick=()=>UT.download(new Blob([R.csv([['ลำดับ','ชื่อ','รหัส/แผนก','เวลา','ซ้ำ'],...state.entries.map(e=>[e.number,e.name,e.department,stamp(e.at),e.duplicate?'ซ้ำ':''])])],{type:'text/csv;charset=utf-8'}),'unitools-checkin.csv');
$('to-raffle').onclick=()=>{const people=state.entries.filter(e=>!e.duplicate).map(({name,department})=>({name,department}));if(!people.length)return note('ยังไม่มีผู้ลงทะเบียน');UT.store.set('raffle-import',{source:'checkin',event:state.event,people,at:Date.now()});root.open('raffle.html','_blank','noopener')};
$('new-room').onclick=()=>{if(root.confirm('จบห้องและล้างรายชื่อผู้ลงทะเบียน? ส่งออก CSV ก่อนหากต้องการเก็บไว้')){host?.destroy();host=null;lastRemoved=null;state=null;UT.store.set('checkin-host',null);$('host').hidden=true;$('setup').hidden=false;$('resume-room').hidden=true}};
$('import').onchange=async()=>{try{const p=await R.importFile($('import').files[0]);if(p)$('names').value=R.namesText(p.people)}catch(e){note(e.message)}$('import').value=''};
const requested=new URLSearchParams(root.location.search).get('room');if(requested)join(requested.toUpperCase());else if(state){$('event').value=state.event;$('names').value=R.namesText(state.guests);start(true)}
})(typeof window==='undefined'?globalThis:window);
