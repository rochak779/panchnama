import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getFixtureEvidenceArtifacts,
  getFixtureOverlapComparisons,
  getFixturePortalAssessments,
} from "@/lib/publishedFixtures";
import { PortalDetailContent } from "@/components/portal-detail/PortalDetailContent";
import overviewStyles from "../../overview.module.css";

interface PortalPageParams {
  portalId: string;
}

/**
 * Session 14 ("Portal evidence pages") — implementation.md section 14. A
 * static route per portal (`generateStaticParams` sourced from the same
 * fixture reader `/` and `/inventory` already use, per Session 13's own
 * prerequisite note), so every `/portals/[id]` link from the inventory
 * table resolves at build time rather than 404ing.
 */
export function generateStaticParams(): PortalPageParams[] {
  return getFixturePortalAssessments().map((a) => ({ portalId: a.portal.id }));
}

export function generateMetadata({ params }: { params: PortalPageParams }): Metadata {
  const assessment = getFixturePortalAssessments().find((a) => a.portal.id === params.portalId);
  return { title: assessment?.portal.name ?? "Portal not found" };
}

export default function PortalDetailPage({ params }: { params: PortalPageParams }) {
  const assessments = getFixturePortalAssessments();
  const assessment = assessments.find((a) => a.portal.id === params.portalId);
  if (!assessment) {
    notFound();
  }

  const evidenceArtifacts = getFixtureEvidenceArtifacts();
  const overlapComparisons = getFixtureOverlapComparisons();

  return (
    <main id="main-content">
      <div className={overviewStyles.container}>
        <PortalDetailContent
          assessment={assessment}
          evidenceArtifacts={evidenceArtifacts}
          overlapComparisons={overlapComparisons}
          allAssessments={assessments}
        />
      </div>
    </main>
  );
}
