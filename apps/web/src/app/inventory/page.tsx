import { Suspense } from "react";
import type { Metadata } from "next";
import { getPublishedPortalAssessments } from "@/lib/publishedRun";
import { InventoryExplorer } from "@/components/inventory/InventoryExplorer";
import overviewStyles from "../overview.module.css";

export const metadata: Metadata = {
  title: "Website inventory",
};

/**
 * Session 13 ("Inventory exploration") — implementation.md section 14 /
 * 10.3. A server component that loads the same validated fixture data the
 * overview page uses and hands it to the client-side `InventoryExplorer`,
 * which owns all search/filter/sort/URL-state behavior. Wrapped in
 * `<Suspense>` because `InventoryExplorer` calls `useSearchParams()`,
 * which Next.js requires to be inside a Suspense boundary on a
 * statically-rendered page.
 */
export default function InventoryPage() {
  const assessments = getPublishedPortalAssessments();

  return (
    <main id="main-content">
      <div className={overviewStyles.container}>
        <div className={overviewStyles.hero}>
          <h1>Website inventory</h1>
          <p>
            Every portal in the observed Assam government web estate. Search, filter, and sort to
            find critical, unavailable, or repair-candidate portals — the filters you choose are
            reflected in the page URL, so you can share or bookmark exactly this view.
          </p>
        </div>
        <Suspense fallback={<p>Loading inventory…</p>}>
          <InventoryExplorer assessments={assessments} />
        </Suspense>
      </div>
    </main>
  );
}
