import { afterEach, expect } from "vitest";
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// This setup file runs for every test in the project, including Session
// 10's node-environment lib/route tests, which never touch the DOM — so
// everything below is guarded to be a no-op there. Only test files that
// opt into `// @vitest-environment jsdom` (Session 11's component tests)
// exercise this branch.
if (typeof document !== "undefined") {
  // Dynamic imports: `@testing-library/jest-dom`/`react` reach for `window`
  // at module-evaluation time in some versions, which would throw if
  // imported eagerly in a node-environment test file.
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");

  // Without Vitest's `globals: true` (not enabled in this project — every
  // test file imports `describe`/`it`/`expect` explicitly), Testing
  // Library's own auto-cleanup cannot detect a global `afterEach` to hook
  // into, so each rendered component would otherwise leak into the next
  // test's DOM.
  afterEach(() => {
    cleanup();
  });
}
