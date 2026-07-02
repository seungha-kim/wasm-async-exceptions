import { test, expect } from '@playwright/test';

test('B/S3: suspended Promise rejects — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/B/s3/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S3:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);
  await page.evaluate(() => (window as any).__Controlled.reject('s3-1', new Error('S3')));
  // Either catch fires (done or ellipsis), or we time out at 2s — whichever
  // terminates the test faster. pageerror is already captured by the handler
  // above, so we don't need a separate waitForEvent for it.
  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s3-done') ||
             (window as any).__logLines?.includes('PASS:s3-catch-reached-ellipsis'),
      null,
      { timeout: 2_000 }
    ).catch(() => lines.push('[timeout] no s3-done')),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('B-S3-console.txt');
});