import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('B/S16: copied what string crosses suspend — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'B',
    's16',
    [
      { waitForLog: 'S16:before-first-suspend', resolveId: 's16-1' },
      { waitForLog: 'S16:before-second-suspend', resolveId: 's16-2' },
    ],
    'PASS:s16-done',
    'B-S16-console.txt'
  );
});
