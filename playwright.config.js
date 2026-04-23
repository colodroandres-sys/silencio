const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 35000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://www.stillova.com',
    // iPhone 14: 390×844, mobile UA, touch
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    locale: 'es-ES',
    browserName: 'chromium',
  },
});
