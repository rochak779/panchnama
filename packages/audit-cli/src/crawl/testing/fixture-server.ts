import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Local fixture HTTP server helper for Session 4's tests — implementation.md
 * section 11.1's "fixture-site integration tests" (never make CI depend on
 * live government websites). Every crawler test in this session stands up
 * one of these instead of hitting the network.
 */
export interface FixtureServer {
  url: string;
  port: number;
  requestCount: number;
  requestedPaths: string[];
  close: () => Promise<void>;
}

export type FixtureHandler = (req: IncomingMessage, res: ServerResponse) => void;

export async function startFixtureServer(handler: FixtureHandler): Promise<FixtureServer> {
  const requestedPaths: string[] = [];
  const server: Server = createServer((req, res) => {
    requestedPaths.push(req.url ?? "");
    handler(req, res);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    port: address.port,
    get requestCount(): number {
      return requestedPaths.length;
    },
    get requestedPaths(): string[] {
      return requestedPaths;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
