"use client";

import { useId, useState, type ReactNode } from "react";
import styles from "./portal-scorecard.module.css";

export interface ScorecardTab {
  id: string;
  label: string;
  badge?: number;
  panel: ReactNode;
}

/** A standard ARIA tabs pattern (roles + arrow-key navigation) — the one
 * genuinely interactive piece of the new page chrome; everything each
 * panel renders is server-rendered content passed in as `panel`. */
export function ScorecardTabs({ tabs }: { tabs: ScorecardTab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const baseId = useId();

  function activateByOffset(offset: number) {
    const index = tabs.findIndex((t) => t.id === activeId);
    const next = tabs[(index + offset + tabs.length) % tabs.length];
    if (next) setActiveId(next.id);
  }

  return (
    <div>
      <div className={styles.tabList} role="tablist" aria-label="Portal detail views">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={tab.id === activeId}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={tab.id === activeId ? 0 : -1}
            className={styles.tab}
            onClick={() => setActiveId(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                activateByOffset(1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                activateByOffset(-1);
              }
            }}
          >
            {tab.label}
            {tab.badge !== undefined ? <span className={styles.badge}>{tab.badge}</span> : null}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== activeId}
          className={styles.tabPanel}
        >
          {tab.id === activeId ? tab.panel : null}
        </div>
      ))}
    </div>
  );
}
