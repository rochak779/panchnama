/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Session 11: `pnpm lint` (root `eslint .`, which does apply
    // `next/core-web-vitals` scoped to `apps/web/**` — see
    // `eslint.config.mjs`) is this monorepo's actual lint gate, run from
    // the repo root where the flat config and its `settings.next.rootDir`
    // resolve correctly. `next build`'s own built-in auto-lint runs a
    // separate, unrelated ESLint pass from `apps/web` as cwd, which cannot
    // find that root-level flat config and reports spurious "plugin not
    // detected"/"pages directory not found" warnings for a check `pnpm
    // lint` already performs correctly. Disabled here to avoid a
    // redundant, misconfigured second lint pass — not to skip linting.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
