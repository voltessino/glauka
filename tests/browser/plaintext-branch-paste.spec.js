const {test,expect}=require('@playwright/test');

// Regression: user's real histology outline. Tabs define the structure;
// "1) Vasi" and arrows are labels, NOT a switch to Markdown.
const STROMA=`Ghiandole esocrine (stroma)
	Stroma
		def.
			tess. conn.
			f.ne
				sostegno
				trofismo
		organizzaz. complessa
			dove si trova
				SOLO grandi ghiandole!
					es.
						composte / extramurali
					dette
						"parenchimatose"
						def.
							organi pieni
							composiz.
								stroma + parenchima
									def.
										parte secernente
										(adenomeri + dotti)
		diviso in
			a) Capsula
				o guaina conn.
				strutt.
					guaina ext
				f.ne
					avvolge intera ghiandola
			b) Setti interlobari
				origine
					dalla capsula
				f.ne
					dividono ghiandola
					-> in LOBI
			c) Setti interlobulari
				origine
					dai setti interlobari
				f.ne
					dividono i lobi
					-> in LOBULI
						(ancora + piccoli)
			d) Stroma reticolare
				strutt.
					rete delicata
				composiz.
					fibre reticolari
						(collagene III!)
				f.ne
					avvolge singoli adenomeri
						def.
							unità secernenti
		contenuto
			situaz.
				tra i setti
			passaggio
				strutture vitali
					1) Vasi sanguigni
						f.ne
							nutrizione
					2) Nervi
						f.ne
							regolaz.
					3) Dotti escretori
						f.ne
							trasporto secreto`;

function flatten(nodes){return nodes.flatMap(n=>[n,...flatten(n.children||[])]);}
function child(node,label){const n=(node.children||[]).find(c=>c.text===label);expect(n,label).toBeTruthy();return n;}
async function ready(page){
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.nm66AppendImportedForest);
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
}
test('65 plaintext lines become 65 nodes with original order and siblings',async({page})=>{
 await ready(page);
 const roots=await page.evaluate(sample=>NM66.parseIndentedForest(sample),STROMA);
 expect(flatten(roots)).toHaveLength(65);
 const stroma=child(roots[0],'Stroma');
 expect(stroma.children.map(n=>n.text)).toEqual(['def.','organizzaz. complessa','diviso in','contenuto']);
 const parts=child(stroma,'diviso in').children;
 expect(parts.map(n=>n.text)).toEqual(['a) Capsula','b) Setti interlobari','c) Setti interlobulari','d) Stroma reticolare']);
 expect(child(parts[1],'f.ne').children.map(n=>n.text)).toEqual(['dividono ghiandola','-> in LOBI']);
 expect(child(parts[2],'f.ne').children.map(n=>n.text)).toEqual(['dividono i lobi','-> in LOBULI']);
 expect(child(child(stroma,'contenuto'),'passaggio').children[0].children.map(n=>n.text))
  .toEqual(['1) Vasi sanguigni','2) Nervi','3) Dotti escretori']);
});
test('Preview recognizes tab-indented plaintext and never edits existing nodes',async({page})=>{
 await ready(page);
 const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
 await page.locator('#paste-modal').evaluate(el=>el.classList.remove('hidden'));
 await page.locator('#paste-modal-textarea').fill(STROMA);
 await page.locator('#nm-paste-preview-button').click();
 const preview=page.locator('#nm-paste-preview');
 await expect(preview).toBeVisible();
 await expect(preview).toContainText('65 nodi · Testo indentato');
 await expect(preview).toContainText('a) Capsula');
 await expect(preview).toContainText('d) Stroma reticolare');
 await expect(preview).toContainText('-> in LOBI');
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
});
test('Add child branches preserves old tree and can be undone atomically',async({page})=>{
 await ready(page);
 const prior=await page.evaluate(()=>{
  const app=neuroMapApp;
  const parent=app.state.addChildNode(app.state.root.id,app.layout,'Existing parent');
  const keep=app.state.addChildNode(parent.id,app.layout,'Keep me');
  app.markChanged();app.selectNode(parent.id);
  return {parent:parent.id,keep:keep.id,tab:app.activeTabId,
    before:JSON.stringify(app.state.createSnapshot().root)};
 });
 await page.locator('#paste-modal').evaluate(el=>el.classList.remove('hidden'));
 await page.locator('#paste-modal-textarea').fill(STROMA);
 await page.locator('#btn-confirm-paste-current').click();
 const output=await page.evaluate(ids=>{
  const app=neuroMapApp,p=app.state.findNode(ids.parent);
  return {tab:app.activeTabId,root:app.state.root.text,keep:!!app.state.findNode(ids.keep),
    children:p.children.map(n=>n.text),total:app.state.getAllNodesIncludingCollapsed().length};
 },prior);
 expect(output.tab).toBe(prior.tab);
 expect(output.keep).toBe(true);
 expect(output.children).toEqual(['Keep me','Ghiandole esocrine (stroma)']);
 await page.evaluate(()=>neuroMapApp.undo());
 expect(await page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.state.createSnapshot().root)))).toEqual(JSON.parse(prior.before));
});
test('literal paste makes one node with complete original multiline text in notes',async({page})=>{
 await ready(page);
 const parent=await page.evaluate(()=>{
  const app=neuroMapApp,node=app.state.addChildNode(app.state.root.id,app.layout,'Existing');
  app.markChanged();app.selectNode(node.id);
  return node.id;
 });
 await page.locator('#paste-modal').evaluate(el=>el.classList.remove('hidden'));
 await page.locator('#paste-modal-textarea').fill(STROMA);
 await page.locator('#btn-paste-literal').click();
 const result=await page.evaluate(id=>{
  const n=neuroMapApp.state.findNode(id);
  return {parent:n.text,items:n.children.map(c=>({text:c.text,notes:c.notes,children:c.children.length}))};
 },parent);
 expect(result.parent).toBe('Existing');
 expect(result.items).toHaveLength(1);
 expect(result.items[0].children).toBe(0);
 expect(result.items[0].notes).toBe(STROMA);
});
