import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('A/S14: repeated resolved suspends then inner throw — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'A',
    's14',
    [
      { waitForLog: 'S14:before-suspend-1', resolveId: 's14-1' },
      { waitForLog: 'S14:before-suspend-2', resolveId: 's14-2' },
      { waitForLog: 'S14:before-suspend-3', resolveId: 's14-3' },
      { waitForLog: 'S14:before-suspend-4', resolveId: 's14-4' },
    ],
    'PASS:s14-done',
    'A-S14-console.txt'
  );
});
