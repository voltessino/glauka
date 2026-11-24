'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../save-status');require('../lifecycle');require('../../../apps/desktop-shared/editor/stack-safe-json');
test('recovery feedback never acknowledges edits newer than the completed write',()=>{
 const t=NeuroMapSaveStatus.tracker();assert.equal(t.state,'unknown');t.pending();const first=t.begin();t.pending();t.finish(first,true);assert.equal(t.state,'pending');
 const failed=t.begin();t.finish(failed,false);assert.equal(t.state,'error');
 t.pending();const second=t.begin(),third=t.begin();t.finish(second,false);assert.equal(t.state,'saving');t.finish(third,true);assert.equal(t.state,'ready');t.finish(first,false);assert.equal(t.state,'ready');
});
test('native Android save fingerprints every layout setting and study data',()=>{
 const tab={id:'a',state:{root:{text:'Map'},images:[],relationships:[],compactness:100}},app={learningAttempts:[],learningPlans:[],getStudyCardsForTab:()=>app.cards||[]};
 const original=NeuroMapLifecycle.fingerprint(tab,app);
 for(const key of ['compactness','balanceBias','branchGapX','wrapCustom','defaultLabelWrapChars']){const old=tab.state[key];tab.state[key]=123;assert.notEqual(NeuroMapLifecycle.fingerprint(tab,app),original,key);tab.state[key]=old;}
 app.cards=[{front:'Question',back:'Answer'}];assert.notEqual(NeuroMapLifecycle.fingerprint(tab,app),original);app.cards=[];
 app.learningAttempts=[{tabId:'a',score:1}];assert.notEqual(NeuroMapLifecycle.fingerprint(tab,app),original);
});
