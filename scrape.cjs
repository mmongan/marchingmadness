const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
      console.log('PAGE LOG:', msg.text());
  });

  await page.goto('http://localhost:5178/marchingmadness/', { waitUntil: 'domcontentloaded' }).catch(e => console.log(e));
  
  await new Promise(r => setTimeout(r, 2000));
  
  const sizes = await page.evaluate(() => {
      const q = document.querySelectorAll('canvas');
      return Array.from(q).map(c => `W:${c.width} H:${c.height}`);
  });
  console.log('Canvas Sizes:', sizes);

  await browser.close();
})();