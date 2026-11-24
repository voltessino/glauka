async function openSettings(page, category) {
  if ((await page.locator("#gl-settings-center").count()) === 0) {
    await page.locator("#gl-settings-quick").click();
  }
  await page.locator("#gl-settings-center").waitFor({ state: "visible" });
  if (category) {
    await page.locator('#gl-settings-nav button[data-category="' + category + '"]').click();
  }
}

async function chooseTheme(page, theme) {
  await openSettings(page, "appearance");
  if (theme === "prisma" || theme === "slate") {
    await page.locator("#gl-settings-theme-" + theme).click();
    return;
  }
  const more = page.locator("#gl-settings-more-themes");
  if ((await more.getAttribute("open")) === null) await more.locator("summary").click();
  await page.locator("#gl-settings-theme-extra").selectOption(theme);
}

module.exports = { openSettings, chooseTheme };
