'use strict';
const assert=require('node:assert/strict');
const p=require('../tools/js/password.js');
assert.ok(p.WORDS.length>=280&&p.WORDS.length<=350);
assert.equal(new Set(p.WORDS).size,p.WORDS.length);
for(let mask=1;mask<16;mask++)for(const exclude of [false,true])for(const length of [6,16,64]){
 const opts={length,exclude,...Object.fromEntries(Object.keys(p.SETS).map((k,i)=>[k,!!(mask&(1<<i))]))};
 for(let i=0;i<10;i++){
  const {value,bits}=p.generate(opts),sets=p.selectedSets(opts);
  assert.equal(value.length,length);assert.ok(sets.every(s=>[...value].some(c=>s.includes(c))));
  assert.ok([...value].every(c=>sets.join('').includes(c)));
  if(exclude)assert.ok(![...value].some(c=>p.AMBIGUOUS.has(c)));
  assert.ok(Number.isFinite(bits)&&bits>0);
 }
}
assert.ok(Math.abs(p.passwordEntropy(6,['ab','01'])-Math.log2(4**6-2*2**6))<1e-10);
assert.equal(p.passwordEntropy(16,['0123456789']),16*Math.log2(10));
for(const length of [5,65,NaN,6.2])assert.throws(()=>p.generate({length}));
assert.throws(()=>p.generate({upper:false,lower:false,digits:false,symbols:false}));
for(const words of [3,8])for(const separator of ['-','.','_',' '])for(const exclude of [true,false])for(const capitalise of [true,false])for(const appendDigit of [true,false]){
 const opts={mode:'phrase',words,separator,exclude,capitalise,appendDigit},r=p.generate(opts),list=p.phraseWords(opts),parts=(appendDigit?r.value.slice(0,-1):r.value).split(separator);
 assert.equal(parts.length,words);assert.ok(parts.every(w=>list.includes(w)));
 if(exclude)assert.ok(![...r.value].some(c=>p.AMBIGUOUS.has(c)));
 if(appendDigit)assert.match(r.value,/\d$/);
 assert.equal(r.bits,words*Math.log2(list.length)+(appendDigit?Math.log2(exclude?8:10):0));
}
assert.throws(()=>p.generate({mode:'phrase',words:2}));assert.throws(()=>p.generate({mode:'phrase',separator:'|'}));
assert.deepEqual([39,40,60,80].map(p.strength),['อ่อน','พอใช้','ดี','แข็งแรงมาก']);
const rows=p.bulk({},500);assert.equal(rows.length,500);assert.ok(rows.every(r=>r.value.length===16));
assert.equal(p.bulk({},2,'สมชาย\n650001')[1].name,'650001');
assert.throws(()=>p.bulk({},0));assert.throws(()=>p.bulk({},501));assert.throws(()=>p.bulk({},2,'one'));
const csv=p.csv([{name:'ก,"ข',value:'=1+2'}]);assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"ก,""ข"'));assert.ok(csv.includes('"\'=1+2"'));
// Prove out-of-range random samples are rejected instead of reduced modulo n.
const crypto=globalThis.crypto,original=crypto.getRandomValues;let calls=0;
crypto.getRandomValues=a=>{a[0]=calls++===0?4294967295:7;return a};
try{assert.equal(p.randomInt(10),7);assert.equal(calls,2)}finally{crypto.getRandomValues=original}
console.log('PASS: password lengths/sets, ambiguity filtering, unbiased rejection, entropy, 320-word phrases, bulk limits/pairing and CSV BOM/escaping');

// Exercise the actual page wiring, including settings persistence and exports.
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../tools/password.html'),'utf8');
class Element{
 constructor(attrs){this.value=/value="([^"]*)"/.exec(attrs)?.[1]||'';this.type=/type="([^"]*)"/.exec(attrs)?.[1]||'';this.checked=/\bchecked\b/.test(attrs);this.disabled=/\bdisabled\b/.test(attrs);this.hidden=/\bhidden\b/.test(attrs);this.style={};this.events={};this.attrs={};this.dataset={mode:/data-mode="([^"]*)"/.exec(attrs)?.[1]};this.classList={toggle(){}};}
 addEventListener(e,f){this.events[e]=f}setAttribute(k,v){this.attrs[k]=v}click(){if(!this.disabled){this.onclick?.();this.events.click?.()}}input(value){if(this.type==='checkbox')this.checked=value;else this.value=String(value);this.events.input?.()}
}
const nodes={},modes=[];
for(const m of html.matchAll(/<[a-z]+\b([^>]*)>/g)){const id=/\bid="([^"]*)"/.exec(m[1])?.[1];if(id)nodes[id]=new Element(m[1]);if(/data-mode=/.test(m[1]))modes.push(new Element(m[1]));}
const stored=[],copies=[],downloads=[];
const context={crypto:require('node:crypto').webcrypto,Uint32Array,Blob,document:{getElementById:id=>{assert.ok(nodes[id],'missing '+id);return nodes[id]},querySelectorAll:()=>modes},UT:{store:{get:()=>({}),set:(k,v)=>stored.push([k,JSON.parse(JSON.stringify(v))])},copy:t=>copies.push(t),download:(blob,name)=>downloads.push([blob,name])}};
context.window=context;vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../tools/js/password.js'),'utf8'),context);
assert.equal(nodes['password-result'].value.length,16);
nodes.length.input(64);assert.equal(nodes['password-result'].value.length,64);assert.equal(nodes['length-value'].textContent,64);
nodes['copy-password'].click();assert.equal(copies.at(-1),nodes['password-result'].value);
nodes['show-password'].click();assert.equal(nodes['password-result'].type,'text');nodes['show-password'].click();assert.equal(nodes['password-result'].type,'password');
for(const key of ['upper','lower','digits','symbols'])nodes[key].input(false);
assert.equal(nodes['password-result'].value,'');assert.equal(nodes['copy-password'].disabled,true);assert.match(nodes['password-status'].textContent,/เลือกอักขระ/);
nodes.lower.input(true);modes[1].click();nodes.words.input(3);assert.equal(nodes['password-result'].value.split('-').length,3);assert.equal(nodes['character-settings'].hidden,true);
nodes['bulk-count'].input(2);nodes['bulk-names'].input('คนแรก\nคนที่สอง');nodes['generate-bulk'].click();assert.equal(nodes['bulk-result'].value.split('\n').length,2);nodes['copy-all'].click();assert.match(copies.at(-1),/คนแรก\t/);nodes['export-csv'].click();assert.equal(downloads[0][1],'unitools-passwords.csv');assert.equal(downloads[0][0].type,'text/csv;charset=utf-8');
nodes['bulk-names'].input('เปลี่ยนรายชื่อ');assert.equal(nodes['export-csv'].disabled,true);assert.equal(nodes['bulk-result'].value,'');
assert.ok(stored.length>0);for(const [key,value] of stored){assert.equal(key,'password-settings');assert.deepEqual(Object.keys(value).sort(),Object.keys(p.defaults).sort());}
console.log('PASS: password page controls, invalid selections, mode switch, copy/show, bulk pairing/export, stale-output clearing and settings-only storage');
