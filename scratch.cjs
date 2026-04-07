const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => {
      if (!response.ok()) console.log('HTTP ERR:', response.url(), response.status());
  });

  await page.goto('http://localhost:5177/marchingmadness/', { waitUntil: 'networkidle0', timeout: 5000 }).catch(e => console.log(e));
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
