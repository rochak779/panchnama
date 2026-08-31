/**
 * Minimal robots.txt parser — implementation.md section 6.3. A small
 * hand-rolled subset (User-agent groups, Allow/Disallow directives) rather
 * than a dependency, per the task brief's preference for something small
 * and auditable. Supports:
 *   - `User-agent:` group headers (case-insensitive match against the
 *     configured bot user agent, or `*` as the fallback group);
 *   - `Disallow:` / `Allow:` directives with simple prefix matching, `*`
 *     wildcard, and `$` end-of-string anchor (the common subset used by
 *     real-world robots.txt files);
 *   - `#` comments and blank lines.
 * Does not implement crawl-delay, sitemap directives, or full RFC 9309
 * pattern semantics (e.g. Disallow specificity tie-breaking beyond
 * longest-match, which is implemented).
 */

export interface RobotsRule {
  type: "allow" | "disallow";
  pattern: string;
}

export interface RobotsRules {
  groups: Map<string, RobotsRule[]>;
}

function patternToRegExp(pattern: string): RegExp {
  let anchored = pattern;
  let endsWithDollar = false;
  if (anchored.endsWith("$")) {
    endsWithDollar = true;
    anchored = anchored.slice(0, -1);
  }
  const escaped = anchored
    .split("*")
    .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}${endsWithDollar ? "$" : ""}`);
}

/** Parses robots.txt content into per-user-agent rule groups. Never
 * throws — malformed lines are skipped. */
export function parseRobotsTxt(content: string): RobotsRules {
  const groups = new Map<string, RobotsRule[]>();
  let currentAgents: string[] = [];
  let sawDirectiveSinceAgent = true;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]!.trim();
    if (line.length === 0) {
      continue;
    }
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const field = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (field === "user-agent") {
      const agent = value.toLowerCase();
      if (sawDirectiveSinceAgent) {
        // Starting a new group.
        currentAgents = [agent];
        sawDirectiveSinceAgent = false;
      } else {
        currentAgents.push(agent);
      }
      if (!groups.has(agent)) {
        groups.set(agent, []);
      }
      continue;
    }

    if ((field === "disallow" || field === "allow") && currentAgents.length > 0) {
      sawDirectiveSinceAgent = true;
      for (const agent of currentAgents) {
        groups.get(agent)!.push({ type: field, pattern: value });
      }
    }
  }

  return { groups };
}

/**
 * Decides whether `path` (a URL path, e.g. `/foo/bar?x=1`) is allowed for
 * `userAgent` under the parsed rules. Uses the longest-matching-pattern
 * wins convention; an empty `Disallow:` value means "allow everything." No
 * matching group and no `*` group defaults to allowed (robots.txt absence
 * or silence is not a block).
 */
export function robotsAllows(rules: RobotsRules, userAgent: string, path: string): boolean {
  const lowerAgent = userAgent.toLowerCase();
  let selected: RobotsRule[] | undefined;
  for (const [agent, agentRules] of rules.groups) {
    if (agent !== "*" && lowerAgent.includes(agent)) {
      selected = agentRules;
      break;
    }
  }
  if (selected === undefined) {
    selected = rules.groups.get("*");
  }
  if (selected === undefined || selected.length === 0) {
    return true;
  }

  let bestMatch: RobotsRule | undefined;
  let bestLength = -1;
  for (const rule of selected) {
    if (rule.pattern.length === 0) {
      // Empty Disallow means "allow all" for this rule; skip as it never
      // wins a longest-match comparison against a real path prefix.
      continue;
    }
    if (patternToRegExp(rule.pattern).test(path) && rule.pattern.length > bestLength) {
      bestMatch = rule;
      bestLength = rule.pattern.length;
    }
  }

  if (bestMatch === undefined) {
    return true;
  }
  return bestMatch.type === "allow";
}
