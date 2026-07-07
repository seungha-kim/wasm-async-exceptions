import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('A/S12: exception_ptr survives suspend before rethrow_exception — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'A',
    's12',
    [
      { waitForLog: 'S12:before-first-suspend', resolveId: 's12-1' },
      { waitForLog: 'S12:before-second-suspend', resolveId: 's12-2' },
    ],
    'PASS:s12-done',
    'A-S12-console.txt'
  );
});
