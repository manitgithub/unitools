'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const V=require('../tools/js/vote.js'),id='12345678-abcd-1234-abcd-123456789abc';
const question=(type='choice',extra={})=>({id:'q-test',type,text:'ทดสอบ',options:type==='choice'?['A','B','C']:[],multi:false,...extra});
for(let i=0;i<200;i++)assert.ok(V.validRoom(V.roomCode()));
assert.equal(V.roomCode(()=>0),'AAAAAA');
for(const s of ['ABC01O','abcdef','ABCD','ABCDEFx',null])assert.equal(V.validRoom(s),false);
assert.equal(V.normaliseWord('  HeLLo   WORLD สวัสดี  '),'hello world สวัสดี');
assert.ok(V.validDeck([question()]));
for(const d of [[],[question(),question()],[question('bad')],[question('choice',{options:['one']})],[question('choice',{options:Array(9).fill('a')})],[question('choice',{text:' '})]])assert.equal(V.validDeck(d),false);
const hello={t:'hello',clientId:id};assert.ok(V.validateMessage(hello,null));
const answer=(value,extra={})=>({t:'answer',clientId:id,qid:'q-test',value,...extra});
assert.ok(V.validateMessage(answer([0]),question()));
for(const m of [null,[],{},'hi',{t:'evil',clientId:id},answer([0],{clientId:'__proto__'}),answer([0],{qid:'other'}),answer([3]),answer([-1]),answer([0.1]),answer(['0']),answer([0,0]),answer([0,1]),answer([]),answer({}),answer(null)])assert.equal(V.validateMessage(m,question()),false);
assert.ok(V.validateMessage(answer([0,2]),question('choice',{multi:true})));
assert.ok(V.validValue(question('word'),['Hi','คำ','สาม']));
for(const v of [[],[' '],['x'.repeat(26)],['a','b','c','d'],[4],'hello'])assert.equal(V.validValue(question('word'),v),false);
for(const v of [0,6,1.5,'5',null])assert.equal(V.validValue(question('rating'),v),false);
assert.ok(V.validValue(question('rating'),5));assert.ok(V.validValue(question('text'),'<img onerror=evil>'));
assert.equal(V.validValue(question('text'),'x'.repeat(301)),false);
const votes={[id]:[0]};votes[id]=[2];assert.deepEqual(V.tally(question(),votes),{total:1,counts:[0,0,1],percent:[0,0,100]});
assert.deepEqual(V.tally(question('choice',{multi:true}),{a:[0,1],b:[1,2]}).counts,[1,2,1]);
assert.deepEqual(V.tally(question('word'),{a:[' Hello ','hello','HELLO'],b:['hello','Thai'],c:['thai']}).words,[['hello',2],['thai',2]]);
assert.equal(V.tally(question('rating'),{a:1,b:5,c:3}).average,3);
assert.deepEqual(V.tally(question('rating'),{}).counts,[0,0,0,0,0]);
assert.equal(V.tally(question('text'),{a:'text',b:null}).total,1);
const csv=V.buildCSV({code:'ABC234',deck:[question('choice',{text:'=SUM(A1)',options:['"a",b','B','C']})],votes:{'q-test':votes}});
assert.equal(csv.charCodeAt(0),0xfeff);assert.ok(csv.includes('"\'=SUM(A1)"'));assert.ok(csv.includes('""a"",b'));assert.ok(csv.includes('คำตอบดิบ'));assert.ok(csv.includes(id));
// Reuse the smoke DOM harness, with a deterministic in-memory PeerJS stub.
let harness=fs.readFileSync(path.join(__dirname,'smoke.test.js'),'utf8').split('(async()=>{')[0];
harness=harness.replace('dialog|tbody|h2|form','dialog|tbody|h2|form|span').replace('function load(slug){','function load(slug,extras={}){').replace('context.window=context;','Object.assign(context,extras);context.window=context;');
harness=harness.replace('showModal(){this.open=true}', 'showModal(){this.open=true}close(){this.open=false;this.onclose?.()}');
harness=harness.replace("if(slug==='picker')","context.UTRoom=require('./room-ui-stub.js')(context);if(slug==='picker')");
const load=new Function('require','__dirname',harness+';return load;')(require,__dirname);
class Emitter{constructor(){this.events={}}on(t,f){(this.events[t]||=[]).push(f)}emit(t,v){(this.events[t]||[]).forEach(f=>f(v))}}
class Connection extends Emitter{constructor(){super();this.open=true;this.connectionId=Math.random().toString();this.sent=[]}send(m){this.sent.push(m)}close(){this.open=false;this.emit('close')}}
class Peer extends Emitter{static peers=[];constructor(peerId){super();this.id=peerId;Peer.peers.push(this)}destroy(){this.destroyed=true}reconnect(){this.reconnected=true}connect(id,options){this.target=id;this.options=options;return this.connection=new Connection()}}
const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
let host=load('vote',{Peer,localStorage:storage,location:{origin:'https://example.test',pathname:'/tools/vote.html',search:''},confirm:()=>true});
host.get('start-room').click();let p=Peer.peers.at(-1);p.emit('open');const code=p.id.slice('unitools-vote-'.length);assert.ok(V.validRoom(code));
const c=new Connection();p.emit('connection',c);c.emit('open');c.emit('data',hello);let state=c.sent.at(-1);assert.equal(state.t,'state');assert.ok(state.open);const qid=state.q.id;
c.emit('data',{...answer([0]),qid});c.emit('data',{...answer([1]),qid});
let saved=JSON.parse(storage.getItem('unitools:vote-room-'+code));assert.equal(Object.keys(saved.votes[qid]).length,1);assert.deepEqual(saved.votes[qid][id],[1]);
c.emit('data',{...answer([999]),qid});c.emit('data',{...answer([0]),qid,clientId:id+'x'});saved=JSON.parse(storage.getItem('unitools:vote-room-'+code));assert.deepEqual(saved.votes[qid][id],[1]);
host.get('toggle-open').click();c.emit('data',{...answer([0]),qid});saved=JSON.parse(storage.getItem('unitools:vote-room-'+code));assert.deepEqual(saved.votes[qid][id],[1]);assert.equal(c.sent.at(-1).q,null);
p.emit('disconnected');assert.ok(p.reconnected);
host=load('vote',{Peer,localStorage:storage,location:{origin:'https://example.test',pathname:'/tools/vote.html',search:''},confirm:()=>true});assert.equal(host.get('resume-room').hidden,false);host.get('resume-room').click();p=Peer.peers.at(-1);assert.equal(p.id,'unitools-vote-'+code);assert.equal(JSON.parse(storage.getItem('unitools:vote-room-'+code)).votes[qid][id][0],1);
p.emit('error',{type:'unavailable-id'});assert.equal(Peer.peers.at(-1).id,p.id);
host.get('end-room').click();assert.equal(storage.getItem('unitools:vote-active'),'null');
const participant=load('vote',{Peer,localStorage:storage,location:{search:'?room=ABC234'}});p=Peer.peers.at(-1);p.emit('open');const pc=p.connection;pc.emit('open');assert.equal(p.target,'unitools-vote-ABC234');assert.equal(p.options.reliable,true);assert.equal(pc.sent.at(-1).t,'hello');
pc.emit('data',{t:'state',q:question(),open:true,answered:false});const inputs=participant.get('answer-fields').children.map(label=>label.children[0]);inputs[0].checked=true;participant.get('answer-form').onsubmit({preventDefault(){}});assert.equal(pc.sent.at(-1).t,'answer');pc.emit('data',{t:'ack',qid:'q-test'});assert.match(participant.get('answer-status').textContent,/ส่งคำตอบแล้ว/);pc.close();assert.equal(participant.get('connection-status').textContent,'กำลังเชื่อมต่อใหม่');assert.equal(participant.get('connection-status').dataset.connection,'connecting');
// Exercise all presenter result types and question navigation without a CDN.
const allDeck=['word','rating','text'].map((type,i)=>question(type,{id:'question-'+i}));
const alternateData=new Map([['unitools:vote-deck',JSON.stringify(allDeck)]]);
const alternateStorage={getItem:k=>alternateData.get(k)??null,setItem:(k,v)=>alternateData.set(k,v)};
const allHost=load('vote',{Peer,localStorage:alternateStorage,location:{origin:'https://example.test',pathname:'/tools/vote.html',search:''},confirm:()=>true});
allHost.get('start-room').click();const allPeer=Peer.peers.at(-1),allConn=new Connection();allPeer.emit('open');allPeer.emit('connection',allConn);allConn.emit('open');allConn.emit('data',hello);
allConn.emit('data',{...answer([' Clay ','clay']),qid:'question-0'});
assert.equal(allHost.get('vote-results').children.at(-1).children[0].textContent,'clay · 1');
allHost.get('next').click();assert.equal(allConn.sent.at(-1).q,null);allHost.get('toggle-open').click();allConn.emit('data',{...answer(5),qid:'question-1'});
assert.equal(allHost.get('vote-results').children[1].textContent,'5.00 / 5 · 1 คำตอบ');
allHost.get('next').click();allHost.get('toggle-open').click();allConn.emit('data',{...answer('<img src=x onerror=evil>'),qid:'question-2'});
let card=allHost.get('vote-results').children.at(-1);assert.equal(card.children[0].textContent,'<img src=x onerror=evil>');card.children[2].click();card=allHost.get('vote-results').children.at(-1);assert.equal(card.children[0].textContent,'ซ่อนคำตอบนี้แล้ว');
allHost.get('reset-question').click();assert.notEqual(allConn.sent.at(-1).q.id,'question-2');assert.equal(allConn.sent.at(-1).answered,false);
allHost.get('toggle-results').click();assert.match(allHost.get('vote-results').children.at(-1).textContent,/ซ่อนผลอยู่/);
console.log('PASS: vote pure logic, validation, CSV, host dedupe/close/resume/collision, participant submission and disconnect');

// Post-it settings, untrusted payloads, ownership, limits and formula-safe CSV.
const sticky=question('postit',{maxLength:20,notesPerPerson:2,columns:['ข้อดี','ข้อเสีย'],askName:true});
const note=(extra={})=>({op:'add',id:'note-1',text:'<img onerror=evil>',color:'#fff59d',column:0,name:'ผู้ร่วมโหวต',...extra});
assert.ok(V.validDeck([sticky]));assert.ok(V.validDeck([question('postit')]));
assert.deepEqual(V.noteSettings(question('postit')),{maxLength:140,notesPerPerson:3,columns:[],askName:false});
for(const extra of [{maxLength:0},{maxLength:2001},{maxLength:1.5},{notesPerPerson:0},{notesPerPerson:11},{notesPerPerson:'3'},{columns:['']},{columns:Array(9).fill('a')},{columns:null},{askName:'yes'}])assert.equal(V.validDeck([{...sticky,...extra}]),false);
assert.ok(V.validateMessage(answer(note()),sticky));
for(const value of [null,[],{},note({id:'__proto__'}),note({id:'x'.repeat(81)}),note({text:' '}),note({text:'x'.repeat(21)}),note({color:'red'}),note({column:-1}),note({column:2}),note({column:0.1}),note({column:'0'}),note({name:''}),note({name:'x'.repeat(81)}),note({op:'edit'})])assert.equal(V.validValue(sticky,value),false);
const stickyVotes={},otherId='abcdefgh-abcd-1234-abcd-123456789abc';
assert.ok(V.applyPostit(sticky,stickyVotes,id,note(),0));
assert.equal(stickyVotes[id][0].time,'1970-01-01T00:00:00.000Z');
assert.equal(V.applyPostit(sticky,stickyVotes,id,note()),false,'duplicate ID');
assert.equal(V.applyPostit(sticky,stickyVotes,otherId,note()),false,'ID collision across clients');
assert.equal(V.applyPostit(sticky,stickyVotes,otherId,{op:'remove',id:'note-1'}),false,'cannot remove someone else’s note');
assert.ok(V.applyPostit(sticky,stickyVotes,id,note({id:'note-2',column:1,color:'#98ff98',text:'=SUM(A1)',name:'=NAME'}),1));
assert.equal(V.applyPostit(sticky,stickyVotes,id,note({id:'note-3'})),false,'per-person limit');
assert.equal(V.tally(sticky,stickyVotes).total,2);
const stickyCSV=V.buildCSV({code:'ABC234',deck:[sticky],votes:{'q-test':stickyVotes}});
for(const text of ['ข้อดี','ข้อเสีย','#98ff98',"'=SUM(A1)","'=NAME",'1970-01-01T00:00:00.001Z','<img onerror=evil>'])assert.ok(stickyCSV.includes(text),text);
assert.ok(V.applyPostit(sticky,stickyVotes,id,{op:'remove',id:'note-1'}));
assert.equal(V.applyPostit(sticky,stickyVotes,id,{op:'remove',id:'note-1'}),false);
assert.ok(V.applyPostit(sticky,stickyVotes,id,note({id:'note-3'})));
const anonymous={};assert.ok(V.applyPostit(question('postit'),anonymous,id,note()));assert.equal(anonymous[id][0].name,'');

const stickyData=new Map([['unitools:vote-deck',JSON.stringify([sticky])]]),stickyStorage={getItem:k=>stickyData.get(k)??null,setItem:(k,v)=>stickyData.set(k,v)};
const stickyHost=load('vote',{Peer,localStorage:stickyStorage,location:{origin:'https://example.test',pathname:'/tools/vote.html',search:''}});
stickyHost.get('start-room').click();const stickyPeer=Peer.peers.at(-1),sc=new Connection(),oc=new Connection();stickyPeer.emit('open');stickyPeer.emit('connection',sc);sc.emit('open');sc.emit('data',hello);stickyPeer.emit('connection',oc);oc.emit('open');oc.emit('data',{...hello,clientId:otherId});
assert.equal(stickyHost.get('host-status').dataset.connection,'connected');
sc.emit('data',answer(note()));assert.equal(sc.sent.at(-1).answered.length,1);assert.equal(oc.sent.at(-1).answered.length,0);
assert.deepEqual(Object.keys(sc.sent.at(-1).answered[0]).sort(),['color','column','id','text']);
const board=()=>stickyHost.get('vote-results').children.at(-1),stickyCard=()=>board().children[0].children[1];
assert.equal(stickyCard().children[0].textContent,'<img onerror=evil>','note text remains literal');
stickyCard().children[2].children[1].click();assert.equal(stickyCard().children[2].children[1].attrs['aria-pressed'],'true');
stickyCard().children[2].children[2].click();assert.equal(stickyCard().children[0].textContent,'ซ่อนโน้ตนี้แล้ว');
stickyCard().children[2].children[2].click();
sc.emit('data',answer(note({id:'note-2'})));sc.emit('data',answer(note({id:'note-3'})));assert.equal(sc.sent.at(-1).answered.length,2);
oc.emit('data',{...answer({op:'remove',id:'note-1'}),clientId:otherId});assert.equal(sc.sent.at(-1).answered.length,2);
sc.emit('data',answer({op:'remove',id:'note-1'}));assert.equal(sc.sent.at(-1).answered.length,1);
stickyHost.get('toggle-open').click();assert.equal(sc.sent.at(-1).q.type,'postit');assert.equal(sc.sent.at(-1).open,false);sc.emit('data',answer(note({id:'closed'})));assert.equal(sc.sent.at(-1).answered.length,1);
stickyHost.get('toggle-open').click();stickyCard().children[2].children[3].click();assert.equal(sc.sent.at(-1).answered.length,0);

pc.open=true;pc.emit('data',{t:'state',q:sticky,open:true,answered:[]});
assert.equal(participant.get('connection-status').dataset.connection,'connected');
let pf=participant.get('answer-fields');const textField=pf.children[0].children[0],nameField=pf.children[4].children[0];textField.value='โน้ตทดสอบ';nameField.value='ทดสอบ';participant.get('answer-form').onsubmit({preventDefault(){}});
assert.equal(pc.sent.at(-1).value.op,'add');assert.equal(pc.sent.at(-1).value.color,'#fff59d');
const ownNotes=[{id:'own-1',text:'โน้ตแรก',color:'#add8e6',column:0},{id:'own-2',text:'โน้ตสอง',color:'#98ff98',column:1}];pc.emit('data',{t:'state',q:sticky,open:true,answered:ownNotes});
assert.equal(participant.get('submit-answer').disabled,true);assert.match(pf.children.at(-2).textContent,/เหลือ 0/);
pf.children.at(-1).children[0].children[2].click();assert.equal(pc.sent.at(-1).value.op,'remove');assert.equal(pc.sent.at(-1).value.id,'own-1');
pc.emit('data',{t:'state',q:sticky,open:true,answered:[ownNotes[1]]});assert.equal(participant.get('submit-answer').disabled,false);assert.match(pf.children.at(-2).textContent,/เหลือ 1/);
console.log('PASS: post-it validation, limits, ownership/removal, private state, literal rendering, moderation, participant form/counter and CSV');

// Focus and spotlight live inside the presenter, so they also work in fullscreen.
sc.emit('data',answer(note({id:'focus-1',text:'โน้ตขยาย'})));
stickyCard().children[0].click();assert.equal(stickyHost.get('note-focus').open,true);assert.equal(stickyHost.get('note-focus').children[1].textContent,'โน้ตขยาย');
stickyHost.get('note-focus').children[0].click();assert.equal(stickyHost.get('note-focus').open,false);
stickyHost.get('vote-results').children[2].children[1].click();assert.equal(stickyHost.get('note-focus').open,true);
stickyHost.get('note-focus').children[0].click();
sc.emit('data',answer(note({id:'focus-2',text:'โน้ตที่สอง',color:'#98ff98'})));
let lane=board().children[0],first=lane.children[1],second=lane.children[2],drag=second.children[2].children[0];
first.getBoundingClientRect=()=>({left:0,right:100,top:0,bottom:100});drag.setPointerCapture=()=>{};
drag.onpointerdown({pointerId:1,clientX:150,clientY:150,button:0,preventDefault(){}});drag.onpointermove({clientX:50,clientY:50});drag.onpointerup({type:'pointerup',clientX:50,clientY:50});
assert.equal(board().children[0].children[1].children[0].textContent,second.children[0].textContent,'touch-compatible pointer drag reorders within lane');
const sorting=stickyHost.get('vote-results').children[2].children[0];sorting.value='color';sorting.onchange();assert.equal(stickyCard().style.background,'#fff59d');
stickyHost.get('toggle-results').click();assert.equal(stickyHost.get('note-focus').open,false);
// A malformed host state must not replace the participant form or break counters.
pc.emit('data',{t:'state',q:sticky,open:true,answered:true});assert.equal(participant.get('submit-answer').disabled,false);
console.log('PASS: post-it focus/spotlight, pointer rearrangement, colour sorting and malformed state rejection');
const inheritedDeck=question('choice',{id:'toString'}),safeVotes=V.dictionary(JSON.parse('{"toString":{}}'));V.questionData(safeVotes,inheritedDeck.id)[id]=[1];assert.equal(V.tally(inheritedDeck,safeVotes.toString).total,1);assert.deepEqual(JSON.parse(JSON.stringify(safeVotes)).toString[id],[1]);assert.equal(Object.getPrototypeOf(V.dictionary(JSON.parse(JSON.stringify(safeVotes)))) ,null);assert.equal(Object.getPrototypeOf(V.questionData({},'toString')),null);
// Arrow keys reorder and announce, and keep native keyboard navigation outside this handler.
stickyHost.get('toggle-results').click();const beforeKeyboard=board().children[0].children[2].children[0].textContent;let keyboardDrag=board().children[0].children[2].children[2].children[0],prevented=false,stopped=false;keyboardDrag.onkeydown({key:'ArrowUp',preventDefault(){prevented=true},stopPropagation(){stopped=true}});assert.equal(prevented,true);assert.equal(stopped,true);assert.equal(board().children[0].children[1].children[0].textContent,beforeKeyboard);assert.match(stickyHost.get('vote-status').textContent,/ตำแหน่ง 1/);assert.equal(stickyHost.get('vote-status').attrs['aria-live'],'polite');
console.log('PASS: inherited question IDs persist and keyboard note reorder announces position');
