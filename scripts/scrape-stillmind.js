const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = '/tmp/stillmind';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const page = await ctx.newPage();
  await page.goto('https://stillmind.co', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: OUT + '/01-landing.png' });
  console.log('URL:', page.url(), '| Title:', await page.title());

  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/02-scroll.png' });

  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/03-scroll2.png' });

  const btns = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a, button'))
      .map(e => e.textContent.trim())
      .filter(t => t && t.length < 60)
  );
  console.log('Links/buttons:', JSON.stringify(btns.slice(0, 25)));

  // Try CTA
  const ctaSelectors = [
    'a:has-text("Get started")', 'a:has-text("Start free")',
    'button:has-text("Get started")', 'a:has-text("Try")',
    'a:has-text("Sign up")', 'button:has-text("Sign up")'
  ];
  for (const sel of ctaSelectors) {
    try {
      await page.click(sel, { timeout: 2000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: OUT + '/04-after-cta.png' });
      console.log('Clicked CTA:', sel, '| URL:', page.url());
      break;
    } catch {}
  }

  await browser.close();
})();
