import { runPublish, type RunPublishParams } from "../review/publish-run.js";

export interface PublishCommandOutput {
  exitCode: 0 | 1;
  lines: string[];
}

/** `pnpm run audit publish --run-id <id>` — implementation.md section 9.1. */
export async function runPublishCommand(params: RunPublishParams): Promise<PublishCommandOutput> {
  const result = await runPublish(params);
  return { exitCode: result.ok ? 0 : 1, lines: result.lines };
}
