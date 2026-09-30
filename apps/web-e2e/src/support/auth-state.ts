import { join } from 'node:path';
import { workspaceRoot } from '@nx/devkit';

/** Saved signed-in browser state, written by auth.setup.ts (under dist/, so never committed). */
export const AUTH_STATE = join(
  workspaceRoot,
  'dist/.playwright/apps/web-e2e/.auth/user.json',
);
