'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
globalThis.NeuroMapWorkCore=require('../../../packages/editor-ui/work-core.js');
const I=require('../../../apps/desktop-shared/editor/task-calendar-core.js');
const root={id:'r',text:'Project',children:[
 {id:'one',text:'Review, nursing; lesson',taskStatus:'doing',startDate:'2026-10-23',dueDate:'2026-10-25',children:[]},
 {id:'two',text:'Plan',dueDate:'2026-10-31',taskStatus:'todo',children:[]},
 {id:'three',text:'Undated',children:[]},
 {id:'bad',text:'Inverted',startDate:'2026-11-04',dueDate:'2026-10-31',children:[]}
]};
test('iCalendar exports explicit all-day task intervals with exclusive DTEND',()=>{
 const x=I.render(root,{now:'2026-10-23T13:00:00Z'});
 assert.equal(x.count,2);assert.deepEqual(x.issues,{undated:1,inverted:1});
 assert.match(x.content,/DTSTART;VALUE=DATE:20261023/);
 assert.match(x.content,/DTEND;VALUE=DATE:20261026/);
 assert.match(x.content,/DTSTART;VALUE=DATE:20261031/);
 assert.match(x.content,/DTEND;VALUE=DATE:20261101/);
 assert.match(x.content,/DTSTAMP:20261023T130000Z/);
 assert.match(x.content,/SUMMARY:Review\\, nursing\\; lesson/);
 assert.equal((x.content.match(/BEGIN:VEVENT/g)||[]).length,2);
 assert.equal(x.content.endsWith('END:VCALENDAR\r\n'),true);
});
test('iCalendar never creates events from missing dates',()=>{
 assert.throws(()=>I.render({id:'r',text:'empty',children:[{id:'u',text:'undated',children:[]}]}),/No valid dated tasks/);
});
test('UTF-8 ICS folding stays within 75 octets per physical line',()=>{
 const line='SUMMARY:'+('𝄞Révision, long calendar notes; '.repeat(15));
 for(const physical of I.foldLine(line).split('\r\n'))
  assert.ok(Buffer.byteLength(physical,'utf8')<=75);
});
test('invalid date combinations are reported, not guessed',()=>{
 const report=I.inspect(root);
 assert.equal(report.issues.inverted,1);
 assert.equal(report.issues.undated,1);
});
