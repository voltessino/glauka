'use strict';
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../../..');
// Mirror the staging manifest's two permitted roots; never resolve arbitrary paths.
module.exports=(editor,name)=>{
 if(!/^(?:shared\/)?[a-z0-9][a-z0-9-]*\.js$/.test(name))throw Error('Unsafe editor source: '+name);
 return name.startsWith('shared/')?path.join(ROOT,'packages/editor-ui/editor-shared',name.slice(7)):path.join(editor,name);
};
