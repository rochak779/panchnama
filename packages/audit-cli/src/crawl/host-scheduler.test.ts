import { describe, expect, it } from "vitest";
import { HostScheduler } from "./host-scheduler.js";

describe("HostScheduler", () => {
  it("runs tasks for different hosts fully concurrently", async () => {
    const scheduler = new HostScheduler({
      maxConcurrentRequestsPerHost: 1,
      minDelayMsPerHost: 1000,
      sleepFn: async () => {},
    });
    const order: string[] = [];
    await Promise.all([
      scheduler.schedule("a.example", async () => {
        order.push("a-start");
        order.push("a-end");
      }),
      scheduler.schedule("b.example", async () => {
        order.push("b-start");
        order.push("b-end");
      }),
    ]);
    expect(order).toContain("a-start");
    expect(order).toContain("b-start");
  });

  it("limits concurrency per host", async () => {
    const scheduler = new HostScheduler({
      maxConcurrentRequestsPerHost: 2,
      minDelayMsPerHost: 0,
      sleepFn: async () => {},
    });
    let concurrent = 0;
    let maxConcurrent = 0;
    const task = () =>
      scheduler.schedule("host.example", async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 20));
        concurrent -= 1;
      });
    await Promise.all([task(), task(), task(), task()]);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("enforces minimum delay between request starts on the same host", async () => {
    let now = 0;
    const scheduler = new HostScheduler({
      maxConcurrentRequestsPerHost: 5,
      minDelayMsPerHost: 100,
      now: () => now,
      sleepFn: async (ms) => {
        now += ms;
      },
    });
    const starts: number[] = [];
    await scheduler.schedule("host.example", async () => {
      starts.push(now);
    });
    await scheduler.schedule("host.example", async () => {
      starts.push(now);
    });
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(100);
  });
});
