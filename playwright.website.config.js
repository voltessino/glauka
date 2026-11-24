const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/website",
  workers: 2,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4175",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "node scripts/dev/serve-website.cjs --port 4175",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
