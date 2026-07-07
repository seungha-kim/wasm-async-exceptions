import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('D/S9: catch calls helper chain that suspends — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'D',
    's9',
    [
      { waitForLog: 'S9:before-first-suspend', resolveId: 's9-1' },
      { waitForLog: 'S9:helper-before-suspend', resolveId: 's9-helper' },
    ],
    'PASS:s9-done',
    'D-S9-console.txt'
  );
});
