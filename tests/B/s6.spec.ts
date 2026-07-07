import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('B/S6: destructor suspends during C++ unwind — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'B',
    's6',
    [
      { waitForLog: 'S6:before-work-suspend', resolveId: 's6-work' },
      { waitForLog: 'S6:dtor-before-suspend', resolveId: 's6-cleanup' },
    ],
    'PASS:s6-done',
    'B-S6-console.txt'
  );
});
