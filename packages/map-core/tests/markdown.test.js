const {test}=require('node:test');
const assert=require('node:assert/strict');
const {serializeMarkdown,parseMarkdownExport,decodeMarkdownLabel}=require('..');

test('Markdown export preserves hierarchy, Unicode, backslashes and multiline labels',()=>{
  const root={text:'Root α',children:[{text:'One\nTwo',children:[{text:'C:\\notes\\file',children:[]},{text:'Literal \\n and \\ path',children:[]}]},{text:'---',children:[]}]};
  assert.deepEqual(parseMarkdownExport(serializeMarkdown(root)),[root]);
  assert.equal(decodeMarkdownLabel(String.raw`C:\\notes\\file`),'C:\\notes\\file');
  assert.equal(decodeMarkdownLabel(String.raw`One\nTwo`),'One\nTwo');
});

test('30 deterministic trees preserve text and sibling order through Markdown',()=>{
  let seed=42;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  const labels=['α é 中文','C:\\notes\\new','First\nSecond','Literal \\n','Hash # and - dash','Slash \\\\ end'];
  const make=depth=>({text:labels[next()%labels.length]+' '+next(),children:depth<4?Array.from({length:next()%4},()=>make(depth+1)):[]});
  for(let i=0;i<30;i++){
    const root=make(0);
    assert.deepEqual(parseMarkdownExport(serializeMarkdown(root)),[root]);
  }
});

test('batch Markdown keeps independent roots and leaves external Markdown to the normal parser',()=>{
  const roots=[{text:'First',children:[]},{text:'Second',children:[{text:'Child',children:[]}]}];
  assert.deepEqual(parseMarkdownExport(roots.map(serializeMarkdown).join('\n---\n')),roots);
  assert.equal(parseMarkdownExport('# External document\n- Ordinary topic'),null);
  assert.throws(()=>parseMarkdownExport('<!-- NeuroMap-Markdown-v1 -->\n# Root\n    - Invalid depth'));
});

test('rich Markdown retains whole-topic emphasis, literal links and fenced code',()=>{
 const {parseMarkdownOutline}=require('..');
 const [root]=parseMarkdownOutline('# C#\n## **Bold**\n- ***Both***\n- *Italic*\n- [Link](https://example.com) and `code`\n```js\nconst x = "α";\n```');
 assert.equal(root.text,'C#');assert.equal(root.children[0].fontWeight,700);
 const nodes=root.children[0].children;
 assert.equal(nodes[0].fontItalic,true);assert.equal(nodes[0].fontWeight,700);assert.equal(nodes[1].fontItalic,true);
 assert.equal(nodes[2].text,'[Link](https://example.com) and `code`');assert.match(nodes[3].text,/const x = "α"/);
 assert.deepEqual(parseMarkdownExport(serializeMarkdown(root)),[root]);
});

test('v2 Markdown metadata preserves notes, styles and literal marker-like user text',()=>{
 const root={text:'Root <!--NM:literal-->',notes:'Unicode α\n**Markdown**',fontItalic:true,children:[{text:'First\nSecond',fontWeight:700,labelAlign:'right',labelIndent:12,children:[]}]};
 const md=serializeMarkdown(root);assert.match(md,/NeuroMap-Markdown-v2/);assert.deepEqual(parseMarkdownExport(md),[root]);
});

test('document separators inside fenced code do not create extra maps',()=>{
 const {parseMarkdownDocuments}=require('..');
 const maps=parseMarkdownDocuments('# First\n```text\n---\nimportant\n```\n---\n# Second');
 assert.equal(maps.length,2);assert.match(maps[0].children[0].text,/---\nimportant/);assert.equal(maps[1].text,'Second');
});

test('multiline paragraphs remain together and ordered-list source numbers are retained',()=>{
 const {parseMarkdownOutline}=require('..');const [root]=parseMarkdownOutline('# Root\nFirst paragraph\ncontinued α\n\nAnother paragraph\n7. Step seven\n12. Step twelve');
 assert.equal(root.children[0].text,'First paragraph\ncontinued α');assert.equal(root.children[1].text,'Another paragraph');
 assert.equal(root.children[2].notes,'7. Step seven');assert.equal(root.children[3].notes,'12. Step twelve');
});

test('visible text wrapping stops at 200 lines without scanning or mutating a huge word',()=>{
 const {wrapLabelText}=require('..'),text='α'.repeat(500000);const lines=wrapLabelText(text,18);
 assert.equal(lines.length,200);assert.equal(lines.join(''),text.slice(0,3600));assert.equal(text.length,500000);
 const family='👨‍👩‍👧‍👦';assert.equal(wrapLabelText('AAAAAAA'+family+'BBBBBBB',8).join(''),'AAAAAAA'+family+'BBBBBBB');
});
