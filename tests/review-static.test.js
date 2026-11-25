'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let harness=fs.readFileSync(path.join(__dirname,'smoke.test.js'),'utf8').split('(async()=>{')[0];
harness=harness.replace('(input|textarea|select|button|div|output|p|a|section|canvas|dialog|tbody|h2|form)', '(input|textarea|select|button|div|output|p|a|section|canvas|dialog|tbody|h2|form|label|progress|span)').replace('function load(slug){','function load(slug,extras={}){').replace('context.window=context;',`Object.assign(context,extras);doc.events={};doc.addEventListener=(k,f)=>doc.events[k]=f;doc.fonts={load:async()=>[{}],check:()=>true};Object.assign(doc,extras.doc||{});extras.setup?.(doc);context.window=context;`);
const load=new Function('require','__dirname',harness+';return load;')(require,__dirname);
const {fitText}=require('../tools/js/certificate.js');
const ctx={font:'',measureText(text){return{width:Array.from(text).length*parseFloat(this.font)}}};
const box={size:30,font:'Sarabun',align:'center',x:.5,y:.5};
let fit=fitText(ctx,box,'ก'.repeat(40),400,400,1);assert.equal(fit.px,8);assert.equal(fit.lines.length,1);assert.equal(fit.overflow,false);
fit=fitText(ctx,box,'ก'.repeat(80),400,400,1);assert.equal(fit.px,6);assert.equal(fit.lines.length,2);assert.equal(fit.overflow,false);
fit=fitText(ctx,box,'ก'.repeat(200),400,400,1);assert.equal(fit.overflow,true);
for(const align of ['left','right','center'])assert.equal(fitText(ctx,{...box,align,x:align==='left'?.9:.1},'ก'.repeat(50),400,400,1).overflow,true);
assert.equal(fitText(ctx,{...box,y:1},'ก',400,400,1).overflow,true);
fit=fitText(ctx,box,'น้ำ'.repeat(50),400,400,1);assert.ok(fit.lines.every(line=>!/^\p{M}/u.test(line)));
(async()=>{
let page=load('groups');
function divide(){page.get('names').value='ก\nข';page.get('count').value='2';page.get('divide').click();assert.equal(page.get('copy-groups').disabled,false)}
function invalid(){assert.equal(page.get('groups').children.length,0);for(const id of ['again','copy-groups','csv'])assert.equal(page.get(id).disabled,true);page.get('copy-groups').click();page.get('csv').click();assert.equal(page.copies.length,0);assert.equal(page.downloads.length,0)}
for(const id of ['names','count','mode']){divide();page.get(id).oninput();invalid();divide();page.get(id).onchange();invalid()}
divide();page.get('names').value='';page.get('divide').click();invalid();divide();page.get('count').value='0';page.get('divide').click();invalid();
page=load('timer');const key=page.context.document.events.keydown;let prevented=0;
function event(target={},extra={}){return{target:{tagName:'DIV',...target},code:'Space',key:' ',preventDefault(){prevented++},...extra}}
for(const tagName of ['BUTTON','A','SELECT','INPUT','TEXTAREA'])key(event({tagName}));
key(event({isContentEditable:true}));key(event({closest:()=>({})}));
for(const modifier of ['ctrlKey','metaKey','altKey','shiftKey']){key(event({},{[modifier]:true}));key(event({},{key:'r',code:'KeyR',[modifier]:true}))}
assert.equal(prevented,0);assert.equal(page.get('toggle').textContent,'');key(event());assert.equal(prevented,1);assert.equal(page.get('toggle').textContent,'พัก');
key(event({tagName:'BUTTON'},{key:'r',code:'KeyR'}));assert.equal(page.get('toggle').textContent,'พัก');key(event({},{key:'r',code:'KeyR'}));assert.equal(page.get('toggle').textContent,'เริ่ม');
let frames=[];page=load('wheel',{requestAnimationFrame:f=>frames.push(f)});page.get('spin').click();assert.equal(frames.length,0);assert.equal(page.get('winner-dialog').open,true);assert.match(page.get('wheel-status').textContent,/ผู้ชนะ:/);assert.equal(page.get('spin').disabled,false);
frames=[];page=load('wheel',{matchMedia:()=>({matches:false}),requestAnimationFrame:f=>frames.push(f)});page.get('spin').click();assert.equal(frames.length,1);assert.equal(page.get('winner-dialog').open,undefined);frames.shift()(6000);assert.equal(page.get('winner-dialog').open,true);
let blocked=true;frames=[];page=load('raffle',{localStorage:{getItem:()=>null,setItem(){if(blocked)throw Error('quota')}},requestAnimationFrame:f=>frames.push(f)});
let warnings=[];page.context.UT.toast=s=>warnings.push(s);assert.equal(page.context.UT.store.set('a',1),false);assert.equal(page.context.UT.store.set('b',2),false);assert.deepEqual(warnings,['บันทึกในเบราว์เซอร์ไม่ได้ — ข้อมูลจะหายเมื่อปิดหน้า กรุณาส่งออกไฟล์ไว้']);blocked=false;assert.equal(page.context.UT.store.set('a',1),true);blocked=true;
page.get('participants').value='ก\nข';page.get('save-names').click();page.get('draw').click();frames.shift()(5000);assert.match(page.get('raffle-status').textContent,/หน้านี้เท่านั้น/);assert.doesNotMatch(page.get('raffle-status').textContent,/บันทึกแล้ว/);
// Certificate uses a deterministic canvas measurement stub; exercise save and export guards.
const canvas={toDataURL:()=>'data:image/jpeg;base64,',width:1684,height:1190,events:{},addEventListener(){},getContext(){return new Proxy(ctx,{get:(o,k)=>k in o?o[k]:()=>{}})}};
page=load('certificate',{setTimeout,localStorage:{getItem:()=>null,setItem(){throw Error('quota')}},setup(doc){const get=doc.getElementById;doc.getElementById=id=>id==='cert-canvas'?canvas:get(id)}});
await new Promise(resolve=>setImmediate(resolve));
page.get('save-layout').click();assert.match(page.get('cert-status').textContent,/หน้านี้เท่านั้น/);
assert.ok(!page.body.children.some(e=>/บันทึกแบบแล้ว/.test(e.textContent)));
page.get('paste-names').value='ก\n'+'น้ำ'.repeat(2000);page.get('use-names').click();
await page.get('export-combined').onclick();assert.equal(page.downloads.length,0);assert.match(page.get('cert-status').textContent,/ข้อความล้นกรอบในแถวที่ 2/);
page.get('paste-names').value='สมชาย ใจดี';page.get('use-names').click();
let images=0;page.context.jspdf={jsPDF:class{constructor(){this.internal={pageSize:{getWidth:()=>297,getHeight:()=>210}}}addImage(){images++}output(){return new Blob(['pdf'])}}};
await page.get('export-combined').onclick();assert.equal(images,1);assert.equal(page.downloads.length,1);
console.log('PASS: persistence failures, raffle/certificate save messages, certificate fitting/export overflow, reduced-motion wheel, timer focus/modifiers, group output invalidation');
})().catch(e=>{console.error(e);process.exitCode=1});
