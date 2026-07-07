import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('A/S13: copied exception object crosses suspend — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'A',
    's13',
    [
      { waitForLog: 'S13:before-first-suspend', resolveId: 's13-1' },
      { waitForLog: 'S13:before-second-suspend', resolveId: 's13-2' },
    ],
    'PASS:s13-done',
    'A-S13-console.txt'
  );
});
