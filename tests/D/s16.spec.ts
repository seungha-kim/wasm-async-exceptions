import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('D/S16: copied what string crosses suspend — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'D',
    's16',
    [
      { waitForLog: 'S16:before-first-suspend', resolveId: 's16-1' },
      { waitForLog: 'S16:before-second-suspend', resolveId: 's16-2' },
    ],
    'PASS:s16-done',
    'D-S16-console.txt'
  );
});
