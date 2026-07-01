import { test, expect } from '@playwright/test';

test('A/S3: suspended Promise rejects — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });

  await page.goto('http://localhost:8080/examples/A/s3/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S3:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);
  await page.evaluate(() => (window as any).__Controlled.reject('s3-1', new Error('S3')));
  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s3-done') ||
             (window as any).__logLines?.includes('PASS:s3-catch-reached-ellipsis'),
      null,
      { timeout: 10_000 }
    ),
    page.waitForEvent('pageerror', { timeout: 10_000 }).then((e) => {
      lines.push(`[pageerror] ${e.message}`);
    }),
    page.waitForTimeout(10_000).then(() => lines.push('[timeout] no s3-done')),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('A-S3-console.txt');
});