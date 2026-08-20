import { chromium } from 'playwright';

async function takeScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const baseUrl = 'http://localhost:3000';
  const screenshotsDir = 'docs/screenshots';
  
  console.log('Taking screenshots...');
  
  // 1. Landing page hero
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${screenshotsDir}/01-landing-hero.png`, fullPage: true });
  console.log('✓ Landing page hero');
  
  // 2. Landing page metrics section
  await page.locator('#metrics').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${screenshotsDir}/02-landing-metrics.png`, fullPage: false });
  console.log('✓ Landing page metrics');
  
  // 3. Dashboard table view
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); // Wait for client-side fetch
  await page.screenshot({ path: `${screenshotsDir}/03-dashboard-table.png`, fullPage: true });
  console.log('✓ Dashboard table view');
  
  // 4. Item detail view (3M enriched item)
  await page.goto(`${baseUrl}/dashboard/36d4d8e6-fa6e-462c-bf5a-0ea25281bb9e`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${screenshotsDir}/04-item-detail-3m.png`, fullPage: true });
  console.log('✓ Item detail view (3M enriched)');
  
  // 5. Item detail view (ground truth review item)
  await page.goto(`${baseUrl}/dashboard/4abb025f-057f-4e5e-9db6-36c3cf5a58a4`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${screenshotsDir}/05-item-detail-gt.png`, fullPage: true });
  console.log('✓ Item detail view (ground truth)');
  
  // 6. Insights page
  await page.goto(`${baseUrl}/dashboard/insights`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${screenshotsDir}/06-insights-charts.png`, fullPage: true });
  console.log('✓ Insights charts');
  
  await browser.close();
  console.log('\nAll screenshots saved to', screenshotsDir);
}

takeScreenshots().catch(console.error);