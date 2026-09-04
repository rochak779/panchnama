"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { TECHNICAL_HEALTH_VISUALS } from "@/components/status/statusTokens";
import styles from "./portal-scorecard.module.css";

export interface PortalSwitcherOption {
  id: string;
  name: string;
  host: string;
  technicalHealth: keyof typeof TECHNICAL_HEALTH_VISUALS;
}

const TONE_COLOR: Record<string, string> = {
  good: "var(--ps-good)",
  caution: "var(--ps-caution)",
  severe: "var(--ps-accent-strong)",
  info: "var(--ps-info)",
  unknown: "var(--ps-unknown)",
};

/**
 * A real portal switcher: filters `options` client-side by name/host and
 * navigates to the selected portal's own page. Every result shown is a
 * real published portal from this audit run — nothing here is decorative
 * placeholder content.
 */
export function PortalSwitcherSearch({ options }: { options: PortalSwitcherOption[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 6);
    return options
      .filter((o) => o.name.toLowerCase().includes(q) || o.host.toLowerCase().includes(q))
      .slice(0, 8);
  }, [options, query]);

  function goTo(id: string) {
    setOpen(false);
    setQuery("");
    router.push(`/portals/${id}`);
  }

  return (
    <div className={styles.searchWrap}>
      <SearchIcon width={16} height={16} className={styles.searchIcon} />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Switch to another portal"
        placeholder="Search another portal or host…"
        className={styles.searchInput}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            setOpen(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && results[activeIndex]) {
            e.preventDefault();
            goTo(results[activeIndex]!.id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open ? (
        <div className={`${styles.card} ${styles.searchDropdown}`} role="listbox" id={listId}>
          {results.length === 0 ? (
            <p className={styles.searchEmpty}>No portal matches &ldquo;{query}&rdquo;.</p>
          ) : (
            results.map((option, index) => {
              const visual = TECHNICAL_HEALTH_VISUALS[option.technicalHealth];
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  data-active={index === activeIndex}
                  className={styles.searchOption}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goTo(option.id)}
                >
                  <span
                    className={styles.searchOptionDot}
                    style={{ background: TONE_COLOR[visual.tone] }}
                  />
                  <span className={styles.searchOptionText}>
                    <span className={styles.searchOptionName}>{option.name}</span>
                    <span className={styles.searchOptionHost}>{option.host}</span>
                  </span>
                  <span
                    className={styles.status}
                    style={{ color: TONE_COLOR[visual.tone], fontSize: "0.68rem" }}
                  >
                    {visual.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
