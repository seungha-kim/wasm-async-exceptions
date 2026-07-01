import { test, expect } from '@playwright/test';

test('A/S4: catch then re-suspend — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  // Collect pageerrors from the start — the rejection of s4-1 may already
  // escape to the page before we set up the wait below.
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/A/s4/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S4:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);

  // First the suspended s4-1 is rejected — this should drive control into
  // the catch handler.
  await page.evaluate(() => (window as any).__Controlled.reject('s4-1', new Error('S4')));
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s4-catch-reached'),
    null,
    { timeout: 10_000 }
  ).catch(() => {/* if catch isn't reached, the snapshot will show it */});

  // Drive the second await, if the catch handler ever reaches it. If the
  // catch was missed (as we expect for the §1.2 pitfall), s4-2 will not have
  // been registered yet, so resolve() throws; we swallow that since the
  // snapshot will record whatever did happen.
  await page.evaluate(() => {
    try {
      (window as any).__Controlled.resolve('s4-2');
      return 'resolved';
    } catch {
      return 'no-s4-2-registered';
    }
  });

  // Either done appears, or we simply wait briefly and snapshot whatever
  // appears. Avoid a 10s hang since the pageerror already arrived above.
  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s4-done'),
      null,
      { timeout: 5_000 }
    ).catch(() => {/* not reached for this pitfall case */}),
    page.waitForTimeout(2_000),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('A-S4-console.txt');
});