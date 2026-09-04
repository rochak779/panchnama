import { describe, expect, it } from "vitest";
import { fetchOnce, fetchWithRetry, type HttpFetcherOptions } from "./http-fetcher.js";
import { startFixtureServer, type FixtureServer } from "./testing/fixture-server.js";

const baseOptions: Omit<HttpFetcherOptions, "userAgent"> = {
  requestTimeoutMs: 500,
  maxResponseBodyBytes: 1024 * 1024,
  maxRedirects: 10,
  allowedSchemes: ["http", "https"],
  // Fixture servers run on 127.0.0.1 (loopback), which the real SSRF check
  // would (correctly) reject — this test-only override is documented in
  // ssrf.ts and never set by the production `crawl` command path.
  ssrf: { allowLoopbackForTests: true },
};

function opts(overrides: Partial<HttpFetcherOptions> = {}): HttpFetcherOptions {
  return { ...baseOptions, userAgent: "PanchnamaTestBot/0.1", ...overrides };
}

describe("fetchOnce — status codes", () => {
  it("returns ok:true with body for a 200 HTML response", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body>hi</body></html>");
    });
    try {
      const result = await fetchOnce(server.url, opts());
      expect(result.ok).toBe(true);
      expect(result.httpStatus).toBe(200);
      expect(result.bodyText).toContain("hi");
      expect(result.errorCode).toBeUndefined();
    } finally {
      await server.close();
    }
  });

  it("classifies 404 as HTTP_CLIENT_ERROR", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("not found");
    });
    try {
      const result = await fetchOnce(server.url, opts());
      expect(result.ok).toBe(false);
      expect(result.httpStatus).toBe(404);
      expect(result.errorCode).toBe("HTTP_CLIENT_ERROR");
    } finally {
      await server.close();
    }
  });

  it("classifies 500 as HTTP_SERVER_ERROR", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(500);
      res.end("boom");
    });
    try {
      const result = await fetchOnce(server.url, opts());
      expect(result.errorCode).toBe("HTTP_SERVER_ERROR");
    } finally {
      await server.close();
    }
  });

  it("classifies 401 as AUTH_REQUIRED", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(401);
      res.end("auth required");
    });
    try {
      const result = await fetchOnce(server.url, opts());
      expect(result.errorCode).toBe("AUTH_REQUIRED");
    } finally {
      await server.close();
    }
  });
});

describe("fetchOnce — redirects", () => {
  it("captures a single-hop redirect chain and follows to final content", async () => {
    const server = await startFixtureServer((req, res) => {
      if (req.url === "/start") {
        res.writeHead(302, { Location: "/final" });
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("final page");
    });
    try {
      const result = await fetchOnce(`${server.url}/start`, opts());
      expect(result.ok).toBe(true);
      expect(result.finalUrl).toBe(`${server.url}/final`);
      expect(result.redirectChain).toEqual([{ url: `${server.url}/start`, status: 302 }]);
      expect(result.bodyText).toBe("final page");
    } finally {
      await server.close();
    }
  });

  it("captures a multi-hop redirect chain in order", async () => {
    const server = await startFixtureServer((req, res) => {
      if (req.url === "/a") {
        res.writeHead(301, { Location: "/b" });
        return res.end();
      }
      if (req.url === "/b") {
        res.writeHead(302, { Location: "/c" });
        return res.end();
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("done");
    });
    try {
      const result = await fetchOnce(`${server.url}/a`, opts());
      expect(result.redirectChain.map((r) => r.url)).toEqual([
        `${server.url}/a`,
        `${server.url}/b`,
      ]);
      expect(result.finalUrl).toBe(`${server.url}/c`);
    } finally {
      await server.close();
    }
  });

  it("terminates a redirect loop with TOO_MANY_REDIRECTS instead of hanging", async () => {
    const server = await startFixtureServer((req, res) => {
      const next = req.url === "/x" ? "/y" : "/x";
      res.writeHead(302, { Location: next });
      res.end();
    });
    try {
      const result = await fetchOnce(`${server.url}/x`, opts({ maxRedirects: 5 }));
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe("TOO_MANY_REDIRECTS");
      expect(result.redirectChain.length).toBe(6);
    } finally {
      await server.close();
    }
  }, 10000);
});

describe("fetchOnce — timeouts", () => {
  it("aborts with CONNECT_TIMEOUT when no response arrives in time", async () => {
    const server = await startFixtureServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200);
        res.end("late");
      }, 2000);
    });
    try {
      const result = await fetchOnce(server.url, opts({ requestTimeoutMs: 100 }));
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe("CONNECT_TIMEOUT");
    } finally {
      await server.close();
    }
  }, 10000);

  it("aborts with READ_TIMEOUT when the body stalls after headers", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.write("partial-chunk");
      // Never call res.end() — body stalls indefinitely.
    });
    try {
      const result = await fetchOnce(server.url, opts({ requestTimeoutMs: 150 }));
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe("READ_TIMEOUT");
    } finally {
      await server.close();
    }
  }, 10000);
});

describe("fetchOnce — response size limit", () => {
  it("aborts once maxResponseBodyBytes is exceeded without buffering the whole body", async () => {
    const server: FixtureServer = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      // Stream far more than the limit; if the fetcher buffered the whole
      // thing first this would take a long time / a lot of memory.
      const chunk = "a".repeat(1024);
      let sent = 0;
      const interval = setInterval(() => {
        if (res.writableEnded) {
          clearInterval(interval);
          return;
        }
        res.write(chunk);
        sent += chunk.length;
        if (sent > 20 * 1024 * 1024) {
          clearInterval(interval);
          res.end();
        }
      }, 1);
    });
    try {
      const result = await fetchOnce(
        server.url,
        opts({ maxResponseBodyBytes: 4096, requestTimeoutMs: 5000 }),
      );
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe("RESPONSE_TOO_LARGE");
      expect(result.bodyTruncated).toBe(true);
    } finally {
      await server.close();
    }
  }, 10000);
});

describe("fetchOnce — connection refused", () => {
  it("classifies a closed port as CONNECT_TIMEOUT", async () => {
    // A high loopback port almost never listening in test envs (and not on
    // the fetch spec's forbidden-ports list, unlike e.g. port 1); connecting
    // there should fail fast with ECONNREFUSED.
    const result = await fetchOnce("http://127.0.0.1:59999/", opts({ requestTimeoutMs: 2000 }));
    expect(result.ok).toBe(false);
    expect(["CONNECT_TIMEOUT", "DNS_FAILURE"]).toContain(result.errorCode);
  }, 10000);
});

describe("fetchOnce — scheme and method", () => {
  it("only ever issues GET or HEAD, never a body", async () => {
    const server = await startFixtureServer((req, res) => {
      expect(["GET", "HEAD"]).toContain(req.method);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("ok");
    });
    try {
      await fetchOnce(server.url, opts({ method: "HEAD" }));
    } finally {
      await server.close();
    }
  });
});

describe("fetchWithRetry", () => {
  it("recovers from an intermittent 500 within maxAttempts using injected instant sleep", async () => {
    let calls = 0;
    const server = await startFixtureServer((_req, res) => {
      calls += 1;
      if (calls === 1) {
        res.writeHead(500);
        return res.end();
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("ok now");
    });
    try {
      const result = await fetchWithRetry(server.url, opts(), {
        maxAttempts: 3,
        baseDelayMs: 1,
        sleepFn: async () => {},
        randomFn: () => 0,
      });
      expect(result.ok).toBe(true);
      expect(result.attempts).toBe(2);
    } finally {
      await server.close();
    }
  });

  it("does not retry a 404 (non-retryable)", async () => {
    let calls = 0;
    const server = await startFixtureServer((_req, res) => {
      calls += 1;
      res.writeHead(404);
      res.end();
    });
    try {
      const result = await fetchWithRetry(server.url, opts(), {
        maxAttempts: 3,
        baseDelayMs: 1,
        sleepFn: async () => {},
      });
      expect(result.attempts).toBe(1);
      expect(calls).toBe(1);
    } finally {
      await server.close();
    }
  });

  it("gives up after maxAttempts on persistent failure", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(503);
      res.end();
    });
    try {
      const result = await fetchWithRetry(server.url, opts(), {
        maxAttempts: 3,
        baseDelayMs: 1,
        sleepFn: async () => {},
      });
      expect(result.attempts).toBe(3);
      expect(result.ok).toBe(false);
    } finally {
      await server.close();
    }
  });

  it("retries a transient SSRF-check DNS lookup failure as DNS_FAILURE (regression: previously non-retryable SSRF_BLOCKED)", async () => {
    // Regression test for the real Session 17 bug: a DNS lookup that
    // fails to resolve at all must be retried like any other network
    // failure, not treated as a permanent SSRF_BLOCKED determination
    // with zero retries.
    const result = await fetchWithRetry(
      "https://this-hostname-is-not-actually-fetched.example",
      opts({
        ssrf: {
          lookupFn: (async () => {
            throw new Error("ENOTFOUND");
          }) as never,
        },
      }),
      {
        maxAttempts: 3,
        baseDelayMs: 1,
        sleepFn: async () => {},
      },
    );
    expect(result.errorCode).toBe("DNS_FAILURE");
    expect(result.attempts).toBe(3);
  });

  it("does not retry a genuine SSRF block (resolves to a blocked address)", async () => {
    const result = await fetchWithRetry(
      "https://this-hostname-is-not-actually-fetched.example",
      opts({
        ssrf: {
          lookupFn: (async () => [{ address: "10.0.0.5", family: 4 }]) as never,
        },
      }),
      {
        maxAttempts: 3,
        baseDelayMs: 1,
        sleepFn: async () => {},
      },
    );
    expect(result.errorCode).toBe("SSRF_BLOCKED");
    expect(result.attempts).toBe(1);
  });
});
