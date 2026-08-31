/**
 * Per-host concurrency and delay scheduler — implementation.md section 6.1
 * (`maxConcurrentRequestsPerHost`, `minDelayMsPerHost`) and section 6.6
 * ("avoid high request rates"). A real queue keyed by hostname, not a
 * global rate limiter: two different hosts are scheduled fully
 * independently and never wait on each other.
 */
export interface HostSchedulerOptions {
  maxConcurrentRequestsPerHost: number;
  minDelayMsPerHost: number;
  /** Injectable sleep, so tests don't need to wait out real delays. */
  sleepFn?: (ms: number) => Promise<void>;
  /** Injectable clock, paired with `sleepFn` for deterministic tests. */
  now?: () => number;
}

interface HostState {
  inFlight: number;
  lastStartedAt: number | undefined;
  queue: Array<() => void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class HostScheduler {
  private readonly states = new Map<string, HostState>();
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(private readonly options: HostSchedulerOptions) {
    this.sleepFn = options.sleepFn ?? defaultSleep;
    this.now = options.now ?? (() => Date.now());
  }

  private stateFor(host: string): HostState {
    let state = this.states.get(host);
    if (!state) {
      state = { inFlight: 0, lastStartedAt: undefined, queue: [] };
      this.states.set(host, state);
    }
    return state;
  }

  private async acquireSlot(host: string): Promise<void> {
    const state = this.stateFor(host);
    while (state.inFlight >= this.options.maxConcurrentRequestsPerHost) {
      await new Promise<void>((resolve) => state.queue.push(resolve));
    }
    state.inFlight += 1;
  }

  private releaseSlot(host: string): void {
    const state = this.stateFor(host);
    state.inFlight -= 1;
    const next = state.queue.shift();
    if (next) {
      next();
    }
  }

  private async waitForDelay(host: string): Promise<void> {
    const state = this.stateFor(host);
    if (state.lastStartedAt !== undefined) {
      const elapsed = this.now() - state.lastStartedAt;
      const remaining = this.options.minDelayMsPerHost - elapsed;
      if (remaining > 0) {
        await this.sleepFn(remaining);
      }
    }
    state.lastStartedAt = this.now();
  }

  /** Runs `task` for `host`, respecting both the per-host concurrency cap
   * and the minimum inter-request delay for that host. Two calls for
   * different hosts run fully concurrently. */
  async schedule<T>(host: string, task: () => Promise<T>): Promise<T> {
    await this.acquireSlot(host);
    try {
      await this.waitForDelay(host);
      return await task();
    } finally {
      this.releaseSlot(host);
    }
  }
}
