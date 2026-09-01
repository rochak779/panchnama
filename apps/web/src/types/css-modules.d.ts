/**
 * Ambient module declaration for CSS Modules imports. Next.js's own build
 * (webpack/Turbopack) resolves `*.module.css` imports natively without
 * this, but this package's `typecheck` script runs plain `tsc --noEmit`
 * outside of Next's build, which needs an explicit type for the import to
 * resolve at all.
 */
declare module "*.module.css" {
  const classes: { readonly [className: string]: string };
  export default classes;
}
