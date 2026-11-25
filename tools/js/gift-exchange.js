(function(root){'use strict';
const R=root.UTRaffle||(typeof require==='function'?require('./raffle.js'):{});
function constraints(people,rules={}){
 if(people.some(p=>typeof p.name!=='string'||!p.name.trim()||p.name.length>120||typeof p.department!=='string'||p.department.length>120))throw Error('ชื่อและกลุ่ม/แผนกต้องไม่ว่างและไม่เกิน 120 ตัว (กลุ่มเว้นว่างได้)');
 if(people.length<2)throw Error('ต้องมีผู้เข้าร่วมอย่างน้อย 2 คน จึงจะไม่จับตัวเอง');
 if(new Set(people.map(p=>p.name)).size!==people.length)throw Error('ชื่อซ้ำ กรุณาเติมรหัสท้ายชื่อเพื่อระบุแต่ละคนให้ชัดเจน');
 const pairs=rules.exclusions||[];for(const pair of pairs)if(!Array.isArray(pair)||pair.length!==2||pair.some(n=>!people.some(p=>p.name===n)))throw Error('คู่ที่ห้ามจับต้องเป็นชื่อที่มีในรายชื่อทั้งสองคน');
 const allowed=(a,b)=>a!==b&&!(rules.noGroup&&people[a].department&&people[a].department===people[b].department)&&!pairs.some(([x,y])=>(people[a].name===x&&people[b].name===y)||(people[a].name===y&&people[b].name===x));
 for(let a=0;a<people.length;a++)if(!people.some((_,b)=>allowed(a,b)))throw Error('จับคู่ไม่ได้: '+people[a].name+' ไม่มีผู้รับที่อนุญาต โปรดผ่อนกฎกลุ่มหรือคู่ที่ห้ามจับ');
 // A perfect matching is necessary, even when every person has an allowed neighbour.
 const matched=new Map();function augment(a,seen){for(let b=0;b<people.length;b++)if(allowed(a,b)&&!seen.has(b)){seen.add(b);if(!matched.has(b)||augment(matched.get(b),seen)){matched.set(b,a);return true}}return false}
 for(let a=0;a<people.length;a++)if(!augment(a,new Set()))throw Error('จับคู่ไม่ได้: กฎห้ามกลุ่ม/คู่ห้ามจับทำให้ผู้รับที่อนุญาตไม่เพียงพอสำหรับทุกคน');
 return allowed;
}
function drawCycle(people,rules={},attempts=10000,random=R.randomInt){
 const allowed=constraints(people,rules),n=people.length;
 const valid=order=>order.every((a,i)=>allowed(a,order[(i+1)%n]));
 const result=order=>order.map((a,i)=>({giver:people[a].name,receiver:people[order[(i+1)%n]].name}));
 for(let t=0;t<attempts;t++){const order=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=random(i+1);[order[i],order[j]]=[order[j],order[i]]}if(valid(order))return result(order)}
 // Exact bounded search distinguishes a proven impossibility from an unlucky retry limit.
 let visits=0,cutoff=false;const path=[0],used=new Set(path);function search(){if(++visits>250000){cutoff=true;return false}if(path.length===n)return allowed(path.at(-1),0);const candidates=Array.from({length:n},(_,i)=>i).filter(i=>!used.has(i)&&allowed(path.at(-1),i));for(let i=candidates.length-1;i>0;i--){const j=random(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]]}for(const b of candidates){used.add(b);path.push(b);if(search())return true;path.pop();used.delete(b);if(cutoff)return false}return false}
 if(search())return result(path);
 throw Error(cutoff?'ยังหาวงเดียวไม่ได้ภายในจำนวนครั้งที่กำหนด ลองจับใหม่หรือผ่อนกฎกลุ่ม/คู่ที่ห้ามจับ':'จับคู่เป็นวงเดียวไม่ได้: กฎกลุ่มหรือคู่ที่ห้ามจับทำให้เกิดวงย่อยที่เชื่อมกันไม่ได้ โปรดผ่อนข้อห้าม');
}
function b64(bytes){let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return root.btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64(s){if(!/^[\w-]+$/.test(s))throw Error('ลิงก์ของขวัญไม่ถูกต้อง');return Uint8Array.from(root.atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0))}
function encodePayload(value,key){key=key||root.crypto.getRandomValues(new Uint8Array(32));const bytes=new TextEncoder().encode(JSON.stringify(value));return b64(bytes.map((b,i)=>b^key[i%key.length]))+'.'+b64(key)}
function decodePayload(payload){try{if(typeof payload!=='string'||payload.length>100000)throw Error();const parts=payload.split('.');if(parts.length!==2)throw Error();const [data,key]=parts.map(unb64);if(key.length!==32)throw Error();const v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data.map((b,i)=>b^key[i%key.length])));if(!v||['event','giver','receiver','budget','date','note'].some(k=>typeof v[k]!=='string'||v[k].length>2000)||!v.giver.trim()||!v.receiver.trim())throw Error();return v}catch{throw Error('ลิงก์ของขวัญไม่ถูกต้องหรือข้อมูลเสียหาย กรุณาขอลิงก์ใหม่จากผู้จัด')}}
const api={constraints,drawCycle,encodePayload,decodePayload};if(typeof module!=='undefined')module.exports=api;root.UTGift=api;if(!root.document)return;
const $=id=>document.getElementById(id),UT=root.UT,el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e},button=(text,fn)=>{const b=el('button',text,'btn');b.onclick=fn;return b},status=t=>$('event-status').textContent=t;
const fragment=new URLSearchParams(root.location.hash.slice(1));
if(fragment.has('g')){
 $('organizer').hidden=true;$('recipient').hidden=false;
 try{const v=decodePayload(fragment.get('g'));$('recipient-event').textContent=v.event;$('gift-greeting').textContent='ถึง '+v.giver+' · แตะเพื่อเปิดเซอร์ไพรส์';let opened=false;$('gift-box').onclick=()=>{if(opened)return;opened=true;$('gift-box').disabled=true;$('gift-box').classList.add('gift-opening');let done=false;const finish=()=>{if(done)return;done=true;$('gift-result').hidden=false;$('gift-result').append(el('h2','คุณจับได้… '+v.receiver),el('p',[v.budget&&'งบประมาณ: '+v.budget,v.date&&'วันที่: '+v.date].filter(Boolean).join(' · ')),el('p',v.note));$('gift-greeting').textContent='ส่งความสุขให้กัน!';if(!root.matchMedia('(prefers-reduced-motion: reduce)').matches){for(let i=0;i<45;i++){const bit=el('span','✦','gift-bit');bit.style.left=(i*37%100)+'%';bit.style.animationDelay=(i%7)*.05+'s';$('gift-confetti').append(bit)}setTimeout(()=>$('gift-confetti').replaceChildren(),3500)}};$('gift-box').addEventListener('animationend',finish,{once:true});setTimeout(finish,900)};
 }catch(e){$('gift-box').hidden=true;status(e.message)}return;
}
let state=UT.store.get('gift-exchange',null),links=[];
if(state&&typeof state==='object'){for(const [id,k] of [['event','event'],['names','names'],['exclusions','exclusions'],['budget','budget'],['gift-date','date'],['note','note']])$(id).value=state[k]||'';$('no-group').checked=!!state.noGroup}else state={};
function saveInputs(){Object.assign(state,{event:$('event').value,names:$('names').value,exclusions:$('exclusions').value,noGroup:$('no-group').checked,budget:$('budget').value,date:$('gift-date').value,note:$('note').value});UT.store.set('gift-exchange',state)}
for(const id of ['event','names','exclusions','no-group','budget','gift-date','note'])$(id).oninput=saveInputs;
function render(){links=state.links||[];$('delivery').hidden=!links.length;$('all-results').hidden=true;$('links').replaceChildren();links.forEach(item=>{const row=el('div',undefined,'event-link-row'),qrbox=el('div',undefined,'event-personal-qr');qrbox.hidden=true;row.append(el('strong',item.giver),button('คัดลอกลิงก์',()=>UT.copy(item.url)),button('QR',()=>{qrbox.hidden=!qrbox.hidden;if(qrbox.childNodes.length)return;try{const q=root.qrcode(0,'M');q.addData(item.url);q.make();const canvas=el('canvas'),n=q.getModuleCount();canvas.width=canvas.height=(n+8)*4;canvas.setAttribute('aria-label','QR สำหรับ '+item.giver);canvas.setAttribute('role','img');const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#2d3748';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(q.isDark(y,x))ctx.fillRect((x+4)*4,(y+4)*4,4,4);qrbox.append(canvas)}catch{qrbox.append(el('p','โหลด QR ไม่ได้ ใช้ปุ่มคัดลอกลิงก์แทน'))}}),qrbox);$('links').append(row)})}
function draw(){try{saveInputs();const people=R.parseParticipants(state.names).people;const exclusions=state.exclusions.split('\n').filter(s=>s.trim()).map(s=>s.split(/[✕×]/).map(x=>x.trim()));const result=drawCycle(people,{noGroup:state.noGroup,exclusions});const meta={event:state.event,budget:state.budget,date:state.date,note:state.note};state.participants=people;state.result=result;state.drawMeta=meta;state.links=result.map(pair=>({giver:pair.giver,url:root.location.href.split(/[?#]/)[0]+'#g='+encodePayload({...meta,...pair})}));UT.store.set('gift-exchange',state);render();status('จับคู่แล้ว '+result.length+' คน · ผลถูกซ่อนไว้')}catch(e){status(e.message)}}
$('draw').onclick=()=>{if(!state.result?.length||root.confirm('มีผลเดิมแล้ว ต้องการจับใหม่และยกเลิกลิงก์ชุดเดิมที่ยังไม่ได้ส่งหรือไม่? ลิงก์ที่ส่งแล้วจะยังเปิดผลเดิมได้'))draw()};
$('redraw').onclick=()=>{if(root.confirm('จับใหม่? โปรดส่งลิงก์ชุดใหม่ให้ทุกคน ลิงก์เก่าจะยังเปิดผลเดิมได้'))draw()};
$('copy-all').onclick=()=>UT.copy(links.map(x=>x.giver+' → '+x.url).join('\n'));
$('reveal-all').onclick=()=>{if(!$('all-results').hidden){$('all-results').hidden=true;return}if(root.confirm('ผลทั้งหมดจะแสดงบนหน้าจอ ผู้จัดเท่านั้น ควรให้ผู้ร่วมงานออกจากหน้าจอก่อน ยืนยันดูผล?')){$('all-results').replaceChildren(...state.result.map(p=>el('p',p.giver+' → '+p.receiver)));$('all-results').hidden=false}};
$('print').onclick=()=>{if(!root.confirm('พิมพ์สลิปที่มีผลจับคู่ด้านใน? ระวังคนอื่นเห็นระหว่างพิมพ์'))return;const m=state.drawMeta;$('slips').replaceChildren(...state.result.map(p=>{const slip=el('article',undefined,'gift-slip'),outside=el('div','ถึง: '+p.giver,'slip-outside'),inside=el('div',undefined,'slip-inside');inside.append(el('strong','คุณจะให้ของขวัญแก่: '+p.receiver),el('p',[m.budget,m.date].filter(Boolean).join(' · ')));slip.append(inside,outside);return slip}));root.print()};
$('import').onchange=async()=>{try{const p=await R.importFile($('import').files[0]);if(p){$('names').value=R.namesText(p.people);saveInputs();status('นำเข้า '+p.people.length+' คน')}}catch(e){status(e.message)}$('import').value=''};render();
})(typeof window==='undefined'?globalThis:window);
