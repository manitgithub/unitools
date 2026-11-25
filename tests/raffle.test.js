'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../tools/js/raffle.js'),P=require('../tools/js/picker.js');
for(const n of [0,-1,1.1,NaN,4294967297])assert.throws(()=>R.randomInt(n));
for(const n of [1,2,10,4294967296])for(let i=0;i<100;i++){const x=R.randomInt(n);assert.ok(x>=0&&x<n);}
let batch=R.beginDraw({...R.initialState(),participants:R.parseParticipants('A\nB\nC\nD').people},true,()=>0);const absentId=batch.pending[1].person.id,heldIds=[batch.pending[0].person.id,batch.pending[2].person.id];batch=R.absentWinner(batch,absentId);assert.equal(batch.results[0].status,'absent');batch=R.replaceAbsent(batch,()=>0);assert.equal(batch.pending.length,3);assert.ok(heldIds.every(id=>batch.pending.some(r=>r.person.id===id)));assert.ok(!batch.pending.some(r=>r.person.id===absentId));assert.equal(new Set(batch.pending.map(r=>r.person.id)).size,3);
const handoff=R.parseRaffleImport({source:'checkin',event:'ปีใหม่',at:123,people:[{name:' A ',department:'บัญชี'},{name:'A',department:'บัญชี'}]});
assert.equal(handoff.people.length,1);assert.equal(handoff.people[0].name,'A');assert.equal(handoff.event,'ปีใหม่');assert.equal(R.parseRaffleImport({source:'checkin',people:[{name:4}]}),null);assert.equal(R.parseRaffleImport(null),null);
const crypto=globalThis.crypto,original=crypto.getRandomValues;let calls=0;
crypto.getRandomValues=a=>{a[0]=calls++===0?4294967295:7;return a;};
try{assert.equal(R.randomInt(10),7);assert.equal(calls,2);}finally{crypto.getRandomValues=original;}
// Broad chi-square bound: detects skew/modulo mistakes, with negligible flake probability.
const bins=Array(7).fill(0),trials=70000;for(let i=0;i<trials;i++)bins[R.randomInt(7)]++;
assert.ok(bins.reduce((s,n)=>s+(n-trials/7)**2/(trials/7),0)<45,JSON.stringify(bins));
const parsed=R.parseParticipants('\ufeffชื่อ,แผนก\r\n"ก,ข","งาน ""วิจัย"""\r\nค,ครู\r\nค,ครู\r\nค,บัญชี\r\n\r\n');
assert.equal(parsed.people.length,3);assert.equal(parsed.duplicates,1);assert.equal(parsed.people[0].name,'ก,ข');assert.equal(parsed.people[0].department,'งาน "วิจัย"');assert.deepEqual(R.parseParticipants(R.namesText(parsed.people)).people,parsed.people);assert.throws(()=>R.parseCSV('"unclosed'));
assert.equal(R.parseParticipants([['Name','Department'],[' ก ',' ครู '],['ก','ครู']]).duplicates,1);
const people=R.parseParticipants('A\nB\nC\nD\nE\nF').people;
assert.equal(new Set(R.drawWithoutReplacement(people,6).map(p=>p.id)).size,6);assert.equal(people.length,6);assert.throws(()=>R.drawWithoutReplacement(people,7));
let state={...R.initialState(),participants:people};const initial=JSON.stringify(state);
assert.deepEqual(R.prizeOrder(state.prizes).map(p=>p.name),['รางวัลเล็ก','รางวัลใหญ่']);assert.equal(R.prizeOrder(state.prizes,true)[0].name,'รางวัลใหญ่');
let drawn=R.beginDraw(state,true,()=>0);assert.equal(JSON.stringify(state),initial);assert.equal(drawn.pending.length,3);assert.equal(new Set(drawn.pending.map(r=>r.person.id)).size,3);assert.throws(()=>R.beginDraw(drawn));
// JSON round trip models the page reloading after selection, before confirmation.
drawn=JSON.parse(JSON.stringify(drawn));state=R.resolveDraw(drawn,'confirm');assert.equal(state.results.length,3);assert.equal(R.eligible(state).length,3);assert.equal(R.remainingSlots(state)[0].prize,'รางวัลใหญ่');
state=R.beginDraw(state,false,()=>0);state=R.resolveDraw(state,'absent');assert.equal(state.results.at(-1).status,'absent');assert.equal(R.remainingSlots(state).length,1);assert.equal(R.eligible(state).length,2);
state=R.resolveDraw(R.beginDraw(state,false,()=>0),'confirm');assert.equal(R.remainingSlots(state).length,0);assert.equal(new Set(state.results.filter(r=>r.status==='confirmed').map(r=>r.person.id)).size,4);assert.throws(()=>R.beginDraw(state));
state={...R.initialState(),participants:people,once:false};state=R.resolveDraw(R.beginDraw(state,false,()=>0),'confirm');assert.equal(R.eligible(state).length,6);state=R.resolveDraw(R.beginDraw(state,false,()=>0),'absent');assert.equal(R.eligible(state).length,5);
state=R.resolveDraw({...R.initialState(),batch:true},'skip');assert.equal(state.results.length,3);assert.equal(R.remainingSlots(state).length,1);assert.equal(state.results[0].person,null);assert.throws(()=>R.resolveDraw(R.initialState(),'confirm'));
assert.throws(()=>R.beginDraw({...R.initialState(),participants:people.slice(0,2)},true));
let roster={...P.createRoster('r1','ห้อง 1'),people};roster=P.attendanceDay(roster,'2026-11-24');roster=P.setAbsent(roster,people[0].id,true);assert.equal(P.available(roster).length,5);
for(let i=0;i<5;i++)roster=P.pick(roster,()=>0);assert.equal(new Set(roster.picked).size,5);assert.equal(P.available(roster).length,0);assert.throws(()=>P.pick(roster));
const picked=roster.picked.at(-1);roster=P.score(roster,picked,1);roster=P.score(roster,picked,-1);assert.equal(roster.scores[picked],0);assert.throws(()=>P.score(roster,people[0].id,1));
roster=P.undo(roster);assert.equal(P.available(roster).length,1);assert.equal(P.pick(roster,()=>0).picked.at(-1),picked);
roster=P.newRound(roster);assert.equal(roster.picked.length,0);assert.equal(P.available(roster).length,5);assert.equal(roster.absent.length,1);assert.equal(P.attendanceDay(roster,'2026-11-25').absent.length,0);
assert.equal(P.replacePeople({...roster,picked:[picked]},[]).picked.length,0);assert.equal(P.createRoster('r2','ห้อง 2').scores[picked],undefined);
const csv=R.csv([['ชื่อ','คะแนน'],['=SUM(A1)',1],['ก,"ข',2]]);assert.equal(csv.charCodeAt(0),0xfeff);assert.ok(csv.includes('"\'=SUM(A1)"'));assert.ok(csv.includes('"ก,""ข"'));
// Reuse the project's DOM harness. Advance the real animation callbacks explicitly.
let harness=fs.readFileSync(path.join(__dirname,'smoke.test.js'),'utf8').split('(async()=>{')[0];
harness=harness.replace('function load(slug){','function load(slug,extras={}){').replace('context.window=context;','Object.assign(context,extras);context.window=context;');
const load=new Function('require','__dirname',harness+';return load;')(require,__dirname);
const data=new Map(),frames=[];let now=0;const extras={localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},confirm:()=>true,prompt:()=> 'ห้องใหม่',performance:{now:()=>now},requestAnimationFrame:f=>frames.push(f),print(){}};
function finish(){now+=5000;for(const f of frames.splice(0))f(now);}
let page=load('raffle',extras);page.get('participants').value='A\nB\nC\nD\nE\nF\nA';page.get('save-names').click();assert.match(page.get('participant-count').textContent,/6 คน/);assert.match(page.get('dedupe-warning').textContent,/1/);
page.get('draw').click();let saved=JSON.parse(data.get('unitools:raffle-state'));assert.equal(saved.pending.length,1);assert.ok(page.get('draw').disabled);assert.equal(page.get('winners').children.length,1);
finish();assert.ok(!page.get('confirm-winner').disabled);assert.equal(page.get('raffle-display').children[0].textContent,saved.pending[0].person.name);
page=load('raffle',extras);assert.ok(!page.get('confirm-winner').disabled);page.get('confirm-winner').click();saved=JSON.parse(data.get('unitools:raffle-state'));assert.equal(saved.results[0].status,'confirmed');assert.equal(saved.pending,null);
page.get('draw').click();finish();page.get('redraw').click();finish();saved=JSON.parse(data.get('unitools:raffle-state'));assert.equal(saved.results.at(-1).status,'absent');assert.notEqual(saved.results.at(-1).person.id,saved.pending[0].person.id);
page.get('export-csv').click();assert.equal(page.downloads[0][1],'unitools-raffle.csv');page.get('reset-all').click();assert.equal(JSON.parse(data.get('unitools:raffle-state')).participants.length,0);
page=load('picker',extras);page.get('picker-names').value='A\nB';page.get('save-names').click();page.get('pick').click();assert.equal(JSON.parse(data.get('unitools:picker-state')).rosters[0].picked.length,1);finish();
page.get('pick').click();finish();assert.match(page.get('picker-status').textContent,/ครบทุกคนแล้ว/);assert.ok(page.get('pick').disabled);page.get('undo').click();assert.ok(!page.get('pick').disabled);page.get('pick').click();finish();page.get('new-round').click();assert.ok(!page.get('pick').disabled);
page.get('pick').click();finish();page.get('scores').checked=true;page.get('scores').onchange();page.get('picked-list').children[0].children[2].click();saved=JSON.parse(data.get('unitools:picker-state'));assert.equal(Object.values(saved.rosters[0].scores)[0],1);
page.get('create-roster').click();assert.equal(page.get('roster-select').children.length,2);assert.match(page.get('picker-count').textContent,/0 คน/);page.get('delete-roster').click();assert.equal(page.get('roster-select').children.length,1);page.get('export-csv').click();assert.equal(page.downloads[0][1],'unitools-picker.csv');
console.log('PASS: raffle/picker rejection and uniformity, dedupe/CSV, no repeats, prize order, transitions/recovery, rounds/undo/attendance/scores and page controls');
