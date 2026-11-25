// Players must not learn whether they were right (via score/rank) before the host reveals the answer.
const assert=require('assert');
const {publicState}=require('../tools/js/quiz.js');
const base={deck:[{id:'q1',text:'?',options:['a','b'],correct:[0],limit:20}],index:0,started:Date.now(),
  players:[{id:'p1',name:'A',score:960},{id:'p2',name:'B',score:500}],answers:{q1:{p1:{points:960,correct:true}}}};
const during=publicState({...base,phase:'question'},'p1');
assert.equal(during.me.score,0);assert.equal(during.me.rank,2);assert.equal(during.result,null);
const after=publicState({...base,phase:'results'},'p1');
assert.equal(after.me.score,960);assert.equal(after.me.rank,1);assert.equal(after.result.points,960);
console.log('PASS: quiz score/rank hidden until reveal');
