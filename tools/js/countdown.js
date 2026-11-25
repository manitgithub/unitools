(function(root){'use strict';
function nextNewYear(now=Date.now()){const d=new Date(now);if(!Number.isFinite(d.getTime()))throw Error('เวลาเครื่องไม่ถูกต้อง');return new Date(d.getFullYear()+1,0,1,0,0,0,0).getTime()}
function beYear(time){const d=new Date(time);if(!Number.isFinite(d.getTime()))throw Error('วันที่ไม่ถูกต้อง');return d.getFullYear()+543}
function targetTime(mode,value,now=Date.now()){if(!Number.isFinite(now))throw Error('เวลาเครื่องไม่ถูกต้อง');let target;if(mode==='newyear')target=nextNewYear(now);else if(mode==='minutes'){const n=Number(value);if(!Number.isFinite(n)||n<=0||n>525600)throw Error('กรุณาระบุนาทีมากกว่า 0 และไม่เกิน 525600');target=now+n*60000}else if(mode==='custom'){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw Error('กรุณาระบุวันที่และเวลา');target=new Date(value).getTime();const d=new Date(target),parts=value.split(/[-T:]/).map(Number);if(d.getFullYear()!==parts[0]||d.getMonth()+1!==parts[1]||d.getDate()!==parts[2]||d.getHours()!==parts[3]||d.getMinutes()!==parts[4])throw Error('วันที่หรือเวลาไม่มีอยู่จริง')}else throw Error('รูปแบบเวลาไม่ถูกต้อง');if(!Number.isFinite(target)||target<=now)throw Error('กรุณาเลือกเวลาในอนาคต');return target}
function timeLeft(target,now=Date.now()){if(!Number.isFinite(target)||!Number.isFinite(now))throw Error('เวลาไม่ถูกต้อง');const total=Math.max(0,Math.ceil((target-now)/1000));return{total,days:Math.floor(total/86400),hours:Math.floor(total/3600)%24,minutes:Math.floor(total/60)%60,seconds:total%60}}
const api={nextNewYear,beYear,targetTime,timeLeft};if(typeof module!=='undefined')module.exports=api;root.UTCountdown=api;if(!root.document)return;
const $=id=>document.getElementById(id),UT=root.UT,el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e},reduced=root.matchMedia('(prefers-reduced-motion: reduce)').matches;
let target=nextNewYear(),active=false,ended=false,previous=-1,muted=false,audio=null,fireworkStarted=0,fireworkUntil=0,fireworkFrame=0,particles=[],rockets=[],lastFrame=0,lastLaunch=0;
$('title').value='นับถอยหลังสู่ปีใหม่ '+beYear(target);$('end-message').value='สวัสดีปีใหม่ '+beYear(target);
const blocks=[['days','วัน'],['hours','ชั่วโมง'],['minutes','นาที'],['seconds','วินาที']].map(([key,label])=>{const box=el('div',undefined,'time-block'),value=el('strong','00');box.append(value,el('span',label));$('time-blocks').append(box);return{key,box,value}});
function unlock(){try{audio=audio||new(root.AudioContext||root.webkitAudioContext)();audio.resume().catch(()=>{})}catch{}}
function tone(f,delay=0,duration=.1){if(muted||!audio)return;const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+delay;o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(.07,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+duration)}
function fanfare(){[523,659,784,1046,784,1046,1318].forEach((f,i)=>tone(f,i*.16,.35))}
const canvas=$('fireworks'),ctx=canvas.getContext('2d'),colours=['#ffe08a','#ff9fa6','#a8e8bb','#a8cdff','#e1bcff'];let width=0,height=0;
function size(){width=canvas.width=canvas.clientWidth||1000;height=canvas.height=canvas.clientHeight||650}
root.addEventListener('resize',size);
function burst(x,y,colour){const count=reduced?12:65;for(let i=0;i<count;i++){const angle=i/count*Math.PI*2,speed=reduced?.6:1+Math.random()*4;particles.push({x,y,px:x,py:y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:1,colour})}}
function fireworksFrame(now){
 if(!fireworkUntil)return;const dt=Math.min(2.5,(now-lastFrame)/16.67||1);lastFrame=now;
 // Actual clock governs the energetic-to-gentle transition, including background tabs.
 const gentle=Date.now()-fireworkStarted>30000;
 if(Date.now()>fireworkUntil){stopFireworks();return}
 ctx.globalAlpha=1;ctx.fillStyle='rgba(25,24,49,.22)';ctx.fillRect(0,0,width,height);
 if(now-lastLaunch>(gentle?2200:reduced?1800:400)){lastLaunch=now;const colour=colours[Math.floor(Math.random()*colours.length)];if(reduced)burst(width*(.15+Math.random()*.7),height*(.15+Math.random()*.4),colour);else rockets.push({x:width*(.1+Math.random()*.8),y:height,vy:-7-Math.random()*5,target:height*(.12+Math.random()*.4),colour})}
 rockets=rockets.filter(r=>{const old=r.y;r.y+=r.vy*dt;ctx.strokeStyle=r.colour;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r.x,old+15);ctx.lineTo(r.x,r.y);ctx.stroke();if(r.y<=r.target){burst(r.x,r.y,r.colour);return false}return true});
 particles=particles.filter(p=>{p.px=p.x;p.py=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.035*dt;p.life-=(reduced?.018:.012)*dt;if(p.life<=0)return false;ctx.globalAlpha=p.life;ctx.strokeStyle=p.colour;ctx.lineWidth=reduced?3:2;ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(p.x+1,p.y+1);ctx.stroke();return true});ctx.globalAlpha=1;
 fireworkFrame=root.requestAnimationFrame(fireworksFrame);
}
function startFireworks(test=false){stopFireworks();size();fireworkStarted=Date.now();fireworkUntil=test?Date.now()+12000:Infinity;lastLaunch=lastFrame=0;fireworkFrame=root.requestAnimationFrame(fireworksFrame);if(test)setTimeout(()=>{if(fireworkUntil!==Infinity&&Date.now()>=fireworkUntil)stopFireworks()},12500)}
function stopFireworks(){root.cancelAnimationFrame(fireworkFrame);fireworkUntil=0;particles=[];rockets=[];ctx.clearRect(0,0,canvas.width,canvas.height)}
function stageMode(on){$('countdown-stage').classList.toggle('is-stage',on);$('countdown-setup').hidden=on}
function start(rehearsal=false){try{target=rehearsal?Date.now()+10000:targetTime($('target-mode').value,$('target-mode').value==='custom'?$('target-date').value:$('minutes').value);unlock();stopFireworks();active=true;ended=false;previous=-1;$('celebration').hidden=true;$('stage-title').textContent=rehearsal?'ทดลองนับ 10 วินาที':$('title').value;stageMode(true);tick()}catch(e){$('event-status').textContent=e.message}}
function tick(){
 $('device-clock').textContent=new Date().toLocaleTimeString('th-TH');if(!active)return;const left=timeLeft(target);
 if(left.total===0){if(!ended){ended=true;$('time-blocks').hidden=$('giant-number').hidden=true;$('celebration').hidden=false;$('celebration').textContent=$('end-message').value||'ถึงเวลาแล้ว!';startFireworks();fanfare()}return}
 const final=left.total<=10;$('time-blocks').hidden=final;$('giant-number').hidden=!final;
 if(previous!==left.total){blocks.forEach(({key,box,value})=>{const s=String(left[key]).padStart(2,'0');if(value.textContent!==s){value.textContent=s;box.classList.remove('event-flip');void box.offsetWidth;box.classList.add('event-flip');setTimeout(()=>box.classList.remove('event-flip'),450)}});if(final){$('giant-number').textContent=left.total;tone(700,.0,.07)}previous=left.total}
}
$('target-mode').onchange=()=>{$('custom-field').hidden=$('target-mode').value!=='custom';$('minutes-field').hidden=$('target-mode').value!=='minutes'};
$('start').onclick=()=>start();$('rehearse').onclick=()=>start(true);
$('test-fireworks').onclick=()=>{unlock();active=false;ended=false;stageMode(true);$('time-blocks').hidden=$('giant-number').hidden=true;$('stage-title').textContent='ทดสอบพลุ';$('celebration').hidden=false;$('celebration').textContent=$('end-message').value;startFireworks(true);fanfare()};
$('fullscreen').onclick=()=>{unlock();stageMode(true);UT.fullscreen($('countdown-stage'))};
$('mute').onclick=()=>{muted=!muted;$('mute').textContent='เสียง: '+(muted?'ปิด':'เปิด');$('mute').setAttribute('aria-pressed',String(muted));if(!muted)unlock()};
$('stop').onclick=()=>{active=false;ended=false;stopFireworks();stageMode(false);$('celebration').hidden=$('giant-number').hidden=true;$('time-blocks').hidden=false;if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})};
$('stage-title').textContent=$('title').value;size();tick();setInterval(tick,100);document.addEventListener('visibilitychange',tick);
})(typeof window==='undefined'?globalThis:window);
