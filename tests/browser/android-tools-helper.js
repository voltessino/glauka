exports.chooseTool = async (page, selector) => {
  const back = page.locator("#nm74-tools-back");
  if (await back.isVisible()) await back.click();
  const target=page.locator(selector);
  const advanced=target.locator("xpath=ancestor::details[contains(@class, 'nm74-experimental')]");
  if(await advanced.count() && !(await advanced.evaluate(e=>e.open)))await advanced.locator("summary").first().click();
  await target.click();
};
