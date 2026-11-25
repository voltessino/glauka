const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const pageHtml = `<!doctype html>
<textarea id="field"></textarea>
<div id="editor" contenteditable="true"><span id="inside" tabindex="-1">testo nel nodo</span></div>
<div id="notes" role="dialog"><p id="answer" tabindex="0">Risposta da copiare</p></div>
<div id="map" tabindex="0"></div>`;

async function install(page) {
  const script = fs.readFileSync(path.join(__dirname, "../../apps/macos/native/mac-edit.js"), "utf8");
  await page.setContent(pageHtml + "<script>" + script + "</script>");
  await page.evaluate(() => {
    window.calls = [];
    window.neuroMapApp = {
      copySelection() { window.calls.push("copy"); },
      cutSelection() { window.calls.push("cut"); },
      selectAllBranches() { window.calls.push("selectAll"); },
      pasteSelection() { window.calls.push("paste"); },
      undo() { window.calls.push("undo"); },
      redo() { window.calls.push("redo"); },
    };
  });
}

test("Command editing stays in a text field and branch commands stay on the map", async ({ page }) => {
  await install(page);
  await page.locator("#field").focus();
  await expect.poll(() => page.evaluate(() => window.__glaukaEditState.editing)).toBe(true);
  expect(await page.evaluate(() => window.GlaukaMacEdit.command({ name: "copy" }))).toBe("editing");
  await page.locator("#map").focus();
  await expect.poll(() => page.evaluate(() => window.__glaukaEditState.editing)).toBe(false);
  await page.evaluate(() => {
    window.GlaukaMacEdit.command({ name: "copy" });
    window.GlaukaMacEdit.command({ name: "undo", shift: true });
  });
  await expect.poll(() => page.evaluate(() => window.calls.join(","))).toBe("copy,redo");
});

test("text inside a contenteditable and a dialog is copied natively, not as a map branch", async ({ page }) => {
  await install(page);
  await page.locator("#inside").focus();
  await expect.poll(() => page.evaluate(() => window.__glaukaEditState.editing)).toBe(true);
  expect(await page.evaluate(() => window.GlaukaMacEdit.command({ name: "copy" }))).toBe("editing");
  await page.locator("#answer").focus();
  await expect.poll(() => page.evaluate(() => window.__glaukaEditState.blocked)).toBe(true);
  expect(await page.evaluate(() => window.GlaukaMacEdit.command({ name: "copy" }))).toBe("editing");
  expect(await page.evaluate(() => window.GlaukaMacEdit.command({ name: "selectAll" }))).toBe("editing");
  expect(await page.evaluate(() => window.GlaukaMacEdit.command({ name: "cut" }))).toBe("ignored");
  expect(await page.evaluate(() => window.calls)).toEqual([]);
});
