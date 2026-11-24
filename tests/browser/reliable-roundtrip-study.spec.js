const { test, expect } = require("@playwright/test");
const platforms = [
  ["Android", "http://127.0.0.1:5173/app/index.html"],
  ["Desktop", "http://127.0.0.1:5174/index.html"],
];
async function boot(page, url) {
  if (url.includes("/app/"))
    await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => localStorage.setItem("nm6_welcome_seen", "1"));
  await page.goto(url);
  await page.waitForFunction(() => window.neuroMapApp);
  await page.evaluate(() =>
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden")),
  );
}
for (const [name, url] of platforms) {
  test(
    name +
      " reopens native text styles, symbols, label geometry and opposite sides",
    async ({ page }) => {
      await boot(page, url);
      const result = await page.evaluate(async () => {
        const a = neuroMapApp;
        const payload = {
          schema: "NeuroMapArchitect-SingleTab-v6",
          root: {
            id: "root-old",
            text: "Project",
            side: "root",
            children: [
              {
                id: "child-old",
                text: "Styled",
                side: "left",
                sidePinned: "left",
                fontFamily: "Georgia",
                fontColor: "#8b2355",
                fontUnderline: true,
                fontStrike: true,
                fontSize: 24,
                fontWeight: 700,
                fontItalic: true,
                nodeShape: "hex",
                markers: ["priority-1"],
                labelAlign: "right",
                labelIndent: 18,
                children: [],
              },
            ],
          },
        };
        await a.importFile(
          new File([JSON.stringify(payload)], "project.neuromap"),
          { newTab: true },
        );
        const one = a.io.buildSerializedProjectPayload();
        await a.importFile(
          new File([JSON.stringify(one)], "project.neuromap"),
          { newTab: true },
        );
        return a.io.buildSerializedProjectPayload().root.children[0];
      });
      expect(result).toMatchObject({
        fontFamily: "Georgia",
        fontColor: "#8b2355",
        fontUnderline: true,
        fontStrike: true,
        fontSize: 24,
        fontWeight: 700,
        fontItalic: true,
        nodeShape: "hex",
        markers: ["priority-1"],
        labelAlign: "right",
        labelIndent: 18,
        sidePinned: "left",
      });
    },
  );
  test(
    name +
      " short review uses real due cards, updates SRS and leaves future cards untouched",
    async ({ page }, info) => {
      await boot(page, url);
      await page.evaluate(() => {
        const a = neuroMapApp;
        a.studyCards = Array.from({ length: 16 }, (_, i) => ({
          id: "card-" + i,
          sourceTabId: a.activeTabId,
          sourceNodeId: a.state.root.id,
          sourceSignature: a.v5Signature(a.state.root, a.state),
          question: "Question " + i,
          answer: "Answer " + i,
          sr: { dueAt: i === 15 ? Date.now() + 86400000 : 0 },
        }));
        a.openFlashcards();
      });
      await expect(page.locator("#glauka-study-today")).toContainText("15");
      await expect(page.locator("#glauka-study-tools")).not.toHaveAttribute("open", "");
      await page.locator("#glauka-study-tools>summary").click();
      await expect(page.locator("#v5-generate-cards")).toBeVisible();
      await page.locator("#glauka-study-tools>summary").click();
      await page.locator("#glauka-study-start").click();
      expect(await page.evaluate(() => neuroMapApp._v5Deck.length)).toBe(10);
      await page.evaluate(() => {
        neuroMapApp.revealFlashcard();
        neuroMapApp.rateFlashcard(3);
      });
      expect(
        await page.evaluate(() => neuroMapApp.studyCards[0].sr.reviews),
      ).toBe(1);
      expect(
        await page.evaluate(() => neuroMapApp.studyCards[15].sr.reviews),
      ).toBeUndefined();
      await expect(
        page.locator("#glauka-study-session-progress"),
      ).toContainText("1 / 10");
      await page.mouse.move(2,2);await page.screenshot({path:info.outputPath("review-today.png"),animations:"disabled"});
    },
  );
}
test("a project travels Desktop → Android → Desktop retaining style, cards, dependencies and source data", async ({
  browser,
}) => {
  const desktop = await browser.newPage(),
    phone = await browser.newPage();
  try {
    await boot(desktop, platforms[1][1]);
    await boot(phone, platforms[0][1]);
    const payload = await desktop.evaluate(() => {
      const a = neuroMapApp;
      a.importHierarchy(
        {
          text: "Project",
          children: [
            { text: "Design", children: [] },
            { text: "Review", children: [] },
          ],
        },
        { newTab: true },
      );
      const [one, two] = a.state.root.children;
      Object.assign(one, {
        fontFamily: "Georgia",
        fontColor: "#8b2355",
        fontUnderline: true,
        fontStrike: true,
        nodeShape: "hex",
        markers: ["priority-1"],
        labelAlign: "right",
        labelIndent: 18,
        notes: "Source note",
        sidePinned: "left",
        networkPosition:{x:450,y:250},
      });
      a.state.root.viewMode="concept-network";
      two.taskDependsOn = [one.id];
      two.taskStatus = "todo";
      a.studyCards = [
        {
          id: "retained-card",
          sourceTabId: a.activeTabId,
          sourceNodeId: one.id,
          sourceSignature: a.v5Signature(one, a.state),
          question: "What is the design?",
          answer: "A tested idea",
          sr: { reviews: 3, intervalDays: 7, dueAt: 1900000000000 },
        },
      ];
      return a.io.buildSerializedProjectPayload();
    });
    const exchanged = await phone.evaluate(async (payload) => {
      const a = neuroMapApp;
      await a.importFile(
        new File([JSON.stringify(payload)], "desktop.neuromap"),
        { newTab: true },
      );
      await a.persistWorkspace();
      return a.io.buildSerializedProjectPayload();
    }, payload);
    const back = await desktop.evaluate(async (payload) => {
      const a = neuroMapApp;
      await a.importFile(
        new File([JSON.stringify(payload)], "phone.neuromap"),
        { newTab: true },
      );
      const doc = a.io.buildSerializedProjectPayload();
      return {
        node: doc.root.children[0],
        second: doc.root.children[1],
        card: doc.studyCards[0],
        viewMode:doc.root.viewMode,
      };
    }, exchanged);
    expect(back.node).toMatchObject({
      fontFamily: "Georgia",
      fontColor: "#8b2355",
      fontUnderline: true,
      fontStrike: true,
      nodeShape: "hex",
      markers: ["priority-1"],
      labelAlign: "right",
      labelIndent: 18,
      notes: "Source note",
      sidePinned: "left",
    });
    expect(back.viewMode).toBe("concept-network");expect(back.node.networkPosition).toEqual({x:450,y:250});
    expect(back.second.taskDependsOn).toEqual([back.node.id]);
    expect(back.card.sourceNodeId).toBe(back.node.id);
    expect(back.card.sr).toMatchObject({
      reviews: 3,
      intervalDays: 7,
      dueAt: 1900000000000,
    });
  } finally {
    await desktop.close();
    await phone.close();
  }
});
for (const [name, url] of platforms)
  test(
    name + " cancelled native-format exports never display a success message",
    async ({ page }) => {
      await boot(page, url);
      const results = await page.evaluate(async () => {
        const a = neuroMapApp;
        a.state.root.text = "Edited project";
        a.markChanged();
        let notices = [];
        a.showToast = (message) => notices.push(message);
        a.io.triggerDownload = () => Promise.resolve(false);
        const out = [];
        for (const method of [
          "exportPNG",
          "exportSVG",
          "exportMarkdown",
          "exportBatchMarkdown",
          "exportOPML",
          "exportJSON",
          "exportBatchWorkspaceJSON",
        ]) {
          notices = [];
          const result = await a.io[method]();
          out.push({ method, result, notices: notices.length });
        }
        return { out, dirty: a.state.isDirty };
      });
      expect(results.dirty).toBe(true);
      for (const r of results.out)
        expect(r, { message: r.method }).toMatchObject({
          result: false,
          notices: 0,
        });
    },
  );
for(const [name,url] of platforms)test(name+' recovery preserves an existing collection of more than 2500 flashcards',async({page})=>{
 await boot(page,url);const count=await page.evaluate(async()=>{
  const a=neuroMapApp;a.studyCards=Array.from({length:3001},(_,i)=>({id:'card-'+i,sourceTabId:a.activeTabId,sourceNodeId:a.state.root.id,question:'Question '+i,answer:'Answer '+i}));
  if(await a.persistWorkspace()!==true)throw Error('Recovery not written');a.studyCards=[];
  if(a.loadAutosave()!==true)throw Error('Recovery not restored');return a.studyCards.length;
 });expect(count).toBe(3001);
});
