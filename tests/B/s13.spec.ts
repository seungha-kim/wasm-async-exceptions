import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('B/S13: copied exception object crosses suspend — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'B',
    's13',
    [
      { waitForLog: 'S13:before-first-suspend', resolveId: 's13-1' },
      { waitForLog: 'S13:before-second-suspend', resolveId: 's13-2' },
    ],
    'PASS:s13-done',
    'B-S13-console.txt'
  );
});
