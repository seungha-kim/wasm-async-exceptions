import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('D/S17: exception_ptr created after resume is rethrown before another suspend — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'D',
    's17',
    [{ waitForLog: 'S17:before-suspend', resolveId: 's17-1' }],
    'PASS:s17-done',
    'D-S17-console.txt'
  );
});
