import { defineConfig, devices } from "@playwright/test";

/**
 * Session 19 — end-to-end quality and accessibility (implementation.md
 * §14). Runs against a real `next build && next start` server (not `next
 * dev`), so tests exercise the same static/server output a production
 * deploy would — this is load-bearing for this session's own "verify
 * audit pages remain statically generated" requirement (Task 5).
 *
 * Every page under test is driven entirely by this repo's committed
 * fixture data (`data/fixtures/*.json` via
 * `apps/web/src/lib/publishedFixtures.ts`) — no database, no live network
 * target. Port 3100 is used (not 3000) so this never collides with a
 * developer's own `next dev` session on the default port.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // No `--` before `-p 3100`: this repo's pnpm (11.x) forwards the `--`
    // separator itself into the script's argv instead of stripping it,
    // which makes `next start` try to parse `--` as a directory argument
    // and fail. Passing `-p 3100` directly to `pnpm run start` works
    // because pnpm still appends unrecognized flags to the underlying
    // script command.
    command: "pnpm run build && pnpm run start -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
