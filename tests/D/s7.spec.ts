import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('D/S7: catch then suspend then rethrow — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'D',
    's7',
    [
      { waitForLog: 'S7:before-first-suspend', resolveId: 's7-1' },
      { waitForLog: 'S7:inner-catch', resolveId: 's7-2' },
    ],
    'PASS:s7-done',
    'D-S7-console.txt'
  );
});
