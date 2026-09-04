import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPortalAssessments } from "@/lib/publishedRun";
import { ShareExperienceForm } from "@/components/experience/ShareExperienceForm";
import overviewStyles from "../../../overview.module.css";

interface ShareExperiencePageParams {
  portalId: string;
}

/**
 * Session 15 Task 2 ("Staged share-an-experience form and its route") —
 * implementation.md section 10.5. A thin static shell: portal identity
 * (name, for the `<title>`/heading) must be known without a client round
 * trip, so this mirrors `apps/web/src/app/portals/[portalId]/page.tsx`'s
 * `generateStaticParams`/`notFound()` pattern, sourced from the same
 * `getPublishedPortalAssessments()` fixture reader. The submission itself is
 * dynamic and lives entirely in the client component
 * `<ShareExperienceForm />` — this page never talks to the submission API
 * directly.
 */
export function generateStaticParams(): ShareExperiencePageParams[] {
  return getPublishedPortalAssessments().map((a) => ({ portalId: a.portal.id }));
}

export function generateMetadata({ params }: { params: ShareExperiencePageParams }): Metadata {
  const assessment = getPublishedPortalAssessments().find((a) => a.portal.id === params.portalId);
  return {
    title: assessment ? `Share your experience — ${assessment.portal.name}` : "Portal not found",
  };
}

export default function ShareExperiencePage({ params }: { params: ShareExperiencePageParams }) {
  const assessments = getPublishedPortalAssessments();
  const assessment = assessments.find((a) => a.portal.id === params.portalId);
  if (!assessment) {
    notFound();
  }

  return (
    <main id="main-content">
      <div className={overviewStyles.container}>
        <Link href={`/portals/${assessment.portal.id}`}>Back to portal</Link>
        <ShareExperienceForm portalId={assessment.portal.id} portalName={assessment.portal.name} />
      </div>
    </main>
  );
}
