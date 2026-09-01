import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PRODUCT_DISCLAIMER, PRODUCT_NAME } from "@/lib/constants";
import { getFixtureAuditRun } from "@/lib/publishedFixtures";
import { AuditContextBanner } from "@/components/AuditContextBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { mono, publicSans } from "./fonts";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s — ${PRODUCT_NAME}` },
  description: PRODUCT_DISCLAIMER,
  applicationName: PRODUCT_NAME,
  // No `authors`/`publisher` naming any government body — this app must
  // never visually or textually imply official endorsement (implementation.md
  // section 1.6 principle 8, section 10.10).
  openGraph: {
    title: PRODUCT_NAME,
    description: PRODUCT_DISCLAIMER,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: PRODUCT_NAME,
    description: PRODUCT_DISCLAIMER,
  },
  robots: {
    // Real Assam audit data does not exist in this build yet (Session 11
    // still reads local fixtures — see src/lib/publishedFixtures.ts); do
    // not let search engines index a fixture-only build.
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Session 11: reads validated local fixtures at build time (real
  // implementation.md section 10.1 requires audit date/coverage on every
  // page, so this reads once here in the root layout, not per-page). See
  // src/lib/publishedFixtures.ts for the validation contract and why this
  // throws loudly rather than rendering a blank banner on bad data.
  const auditRun = getFixtureAuditRun();

  return (
    <html lang="en" className={`${publicSans.variable} ${mono.variable}`}>
      <body>
        {/*
          THESIS: An evidence register, not a government portal — every
          status is read as text and shape, never guessed from color alone.
          OWN-WORLD: cool neutral canvas/surface, one muted slate-indigo
          accent (#464b78) reserved for actions/links/focus, Public Sans for
          UI text, IBM Plex Mono for data (timestamps/hashes/ids), 1px
          hairline borders, small (4px/6px) radius, no shadows, no
          gradients, no kicker labels.
          STORY: a visitor immediately sees this is independent and dated,
          reads technical health/severity as icon+text (not color-only),
          and can reach evidence/methodology from any page.
          FIRST VIEWPORT: header (wordmark + independence tag + nav), a
          persistent audit-context banner (date/coverage/status/links)
          beneath it, then page content.
          FORM: pinned by implementation.md section 10.10 — brief-pinned,
          no concept tournament run; code-led (no image generation
          available this session).
          FINISH: unreviewed and undocumented is unfinished; this build
          ends with the finish review, the verdict, DESIGN.md, and every
          shipping raster carrying its provenance.
        */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <SiteHeader />
        <AuditContextBanner auditRun={auditRun} />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
