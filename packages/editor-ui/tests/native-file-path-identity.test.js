'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {composeDesktopControls}=require('./helpers/compose-app-source.cjs');
const source=composeDesktopControls('desktop-shared');
class App{
 activateTab(id){this.activeTabId=id;}
 showToast(){}
}
// Load the real controller without locating a method by its surrounding text.
new Function('NeuroMapApp','window',source)(App,{});
const cases=[
 ['drive path and case','C:\\Maps\\Saved.gk','c:/maps/SAVED.gk',true],
 ['drive separators','D:/Maps/Saved.gk','d:\\maps\\saved.gk',true],
 ['UNC path and case','\\\\Server\\Share\\Saved.gk','//server/share/SAVED.gk',true],
 ['identical macOS path','/Users/person/Map.gk','/Users/person/Map.gk',true],
 ['case-sensitive macOS path','/Users/person/Map.gk','/Users/person/map.gk',false],
 ['different drive','C:/Maps/Map.gk','D:/Maps/Map.gk',false],
];
for(const [name,saved,incoming,same]of cases)test('native file identity: '+name,async()=>{
 const app=new App(),root={id:'original',text:'Unsaved edit',children:[]};
 const tab={id:'existing',filePath:saved,state:{root,isDirty:true}};
 app.tabs=[tab,{id:'other'}];app.activeTabId='other';
 let imports=0,origins=0;
 app.importFiles=async()=>{imports++;return 1;};
 app.v6SetOrigin=()=>{origins++;};
 assert.equal(await app.v6ImportNative({path:incoming,filename:'Map.gk',bytes:new Uint8Array([123,125])},true),true);
 assert.equal(imports,same?0:1);
 assert.equal(origins,same?0:1);
 assert.equal(app.activeTabId,same?'existing':'other');
 assert.equal(tab.state.root,root);
 assert.equal(tab.state.isDirty,true);
 assert.equal(app.tabs.length,2);
});
