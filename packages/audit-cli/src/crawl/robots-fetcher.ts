import { parseRobotsTxt, robotsAllows, type RobotsRules } from "@panchnama/audit-core";
import { fetchOnce, type HttpFetcherOptions } from "./http-fetcher.js";

/**
 * Per-host robots.txt fetch + cache — implementation.md section 6.3.
 * Parsing itself is the pure `@panchnama/audit-core` function; this module
 * is the I/O wrapper that fetches `/robots.txt` once per hostname per run
 * and caches the parsed result (an absent or unfetchable robots.txt is
 * treated as "allow everything," the conventional interpretation).
 */
export class RobotsCache {
  private readonly cache = new Map<string, RobotsRules>();

  constructor(
    private readonly fetcherOptions: HttpFetcherOptions,
    private readonly userAgent: string,
  ) {}

  private async load(origin: string): Promise<RobotsRules> {
    const cached = this.cache.get(origin);
    if (cached) {
      return cached;
    }
    const result = await fetchOnce(`${origin}/robots.txt`, {
      ...this.fetcherOptions,
      method: "GET",
    });
    const rules =
      result.ok && result.bodyText !== undefined
        ? parseRobotsTxt(result.bodyText)
        : { groups: new Map() };
    this.cache.set(origin, rules);
    return rules;
  }

  /** Returns `"allowed"` or `"disallowed"` for `url` per the cached
   * robots.txt for its origin. Never throws — a robots.txt fetch failure
   * degrades to "allowed" (absence of a rule is not a block). */
  async decide(url: string): Promise<"allowed" | "disallowed"> {
    const parsed = new URL(url);
    const origin = `${parsed.protocol}//${parsed.host}`;
    const rules = await this.load(origin);
    const allowed = robotsAllows(rules, this.userAgent, parsed.pathname + parsed.search);
    return allowed ? "allowed" : "disallowed";
  }
}
