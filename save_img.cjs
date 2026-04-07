const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5180/marchingmadness/', { waitUntil: 'domcontentloaded' });
  
  await new Promise(r => setTimeout(r, 2000));
  
  const b64 = await page.evaluate(() => {
      return new Promise(resolve => {
        // Try grabbing the texture canvas itself... Wait, babylon textures don't always exist in DOM.
        // Let's take a screenshot of the page instead.
        resolve(null);
      });
  });
  
  await page.screenshot({ path: 'test_screenshot.png' });
  console.log('Saved to test_screenshot.png');

  await browser.close();
})();