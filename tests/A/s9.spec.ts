import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('A/S9: catch calls helper chain that suspends — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'A',
    's9',
    [
      { waitForLog: 'S9:before-first-suspend', resolveId: 's9-1' },
      { waitForLog: 'S9:helper-before-suspend', resolveId: 's9-helper' },
    ],
    'PASS:s9-done',
    'A-S9-console.txt'
  );
});
