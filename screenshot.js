const { chromium } = require('playwright');

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const baseUrl = 'http://localhost:3000';

  // 1. Landing page
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/01-landing.png', fullPage: true });
  console.log('✓ Landing page');

  // 2. Dashboard
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/02-dashboard.png', fullPage: true });
  console.log('✓ Dashboard');

  // 3. Item detail - enriched 3M item
  await page.goto(`${baseUrl}/dashboard/36d4d8e6-fa6e-462c-bf5a-0ea25281bb9e`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/03-item-3m-enriched.png', fullPage: true });
  console.log('✓ Item detail - 3M enriched');

  // 4. Item detail - ground truth PDSH item
  await page.goto(`${baseUrl}/dashboard/4abb025f-057f-4e5e-9db6-36c3cf5a58a4`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/04-item-pdsh-groundtruth.png', fullPage: true });
  console.log('✓ Item detail - PDSH ground truth');

  // 5. Insights page
  await page.goto(`${baseUrl}/dashboard/insights`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/05-insights.png', fullPage: true });
  console.log('✓ Insights page');

  // 6. Dashboard with batch filter (upload test)
  await page.goto(`${baseUrl}/dashboard?batch=test`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/06-dashboard-batch-filter.png', fullPage: true });
  console.log('✓ Dashboard with batch filter');

  // 7. Upload modal open
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.click('button:has-text("Upload Dataset")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/07-upload-modal.png', fullPage: true });
  console.log('✓ Upload modal');

  await browser.close();
  console.log('\nAll screenshots saved to screenshots/');
}

takeScreenshots().catch(console.error);