import { expect, type Page } from '@playwright/test';

type ResolveStep = {
  waitForLog: string;
  resolveId: string;
};

export async function runResolveOnlyScenario(
  page: Page,
  target: string,
  scenario: string,
  steps: ResolveStep[],
  doneLog: string,
  snapshotName: string
) {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto(`http://localhost:8080/examples/${target}/${scenario}/build/index.html`);

  for (const step of steps) {
    await page.waitForFunction(
      (line) => (window as any).__logLines?.includes(line),
      step.waitForLog,
      { timeout: 10_000 }
    );
    await page.waitForTimeout(50);
    const resolveResult = await page.evaluate((id) => {
      try {
        (window as any).__Controlled.resolve(id);
        return 'resolved';
      } catch (e) {
        return `[control-error] ${e instanceof Error ? e.message : String(e)}`;
      }
    }, step.resolveId);
    if (resolveResult !== 'resolved') lines.push(resolveResult);
  }

  await Promise.race([
    page.waitForFunction(
      (line) => (window as any).__logLines?.includes(line),
      doneLog,
      { timeout: 10_000 }
    ).catch(() => lines.push(`[timeout] no ${doneLog}`)),
    page.waitForTimeout(10_000).then(() => lines.push(`[timeout] no ${doneLog}`)),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot(snapshotName);
}
