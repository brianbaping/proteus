import { writeFile, readFile, readdir, unlink, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface InboxMessage {
  targetAgent: string;
  message: string;
  timestamp: string;
}

/**
 * Get the inbox directory path for the active execute session.
 */
export function getInboxDir(targetPath: string): string {
  return join(targetPath, ".proteus-forge", "05-execute", "inbox");
}

/**
 * Write a message to the inbox. Called by `proteus-forge inform`.
 */
export async function writeInboxMessage(
  targetPath: string,
  targetAgent: string,
  message: string
): Promise<string> {
  const inboxDir = getInboxDir(targetPath);
  await mkdir(inboxDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const filename = `${Date.now()}-${targetAgent}.json`;
  const filePath = join(inboxDir, filename);

  const msg: InboxMessage = { targetAgent, message, timestamp };
  await writeFile(filePath, JSON.stringify(msg, null, 2) + "\n");

  return filePath;
}

/**
 * Read and consume all pending messages from the inbox.
 * Messages are deleted after reading.
 */
export async function consumeInboxMessages(
  targetPath: string
): Promise<InboxMessage[]> {
  const inboxDir = getInboxDir(targetPath);
  if (!existsSync(inboxDir)) return [];

  const files = await readdir(inboxDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

  const messages: InboxMessage[] = [];
  for (const file of jsonFiles) {
    const filePath = join(inboxDir, file);
    try {
      const content = await readFile(filePath, "utf-8");
      messages.push(JSON.parse(content) as InboxMessage);
      await unlink(filePath);
    } catch {
      // Skip malformed or already consumed messages
    }
  }

  return messages;
}

/**
 * Create an async generator that polls the inbox for new messages.
 * Yields formatted user messages suitable for streamInput().
 */
export async function* watchInbox(
  targetPath: string,
  pollIntervalMs: number = 3000
): AsyncGenerator<string> {
  const inboxDir = getInboxDir(targetPath);
  await mkdir(inboxDir, { recursive: true });

  // Write a sentinel file to signal the inbox is active
  const sentinelPath = join(inboxDir, ".active");
  await writeFile(sentinelPath, new Date().toISOString());

  try {
    while (true) {
      const messages = await consumeInboxMessages(targetPath);
      for (const msg of messages) {
        yield `[USER MESSAGE for ${msg.targetAgent}] Please relay this to the "${msg.targetAgent}" teammate: ${msg.message}`;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  } finally {
    // Clean up sentinel on exit
    try {
      if (existsSync(sentinelPath)) await unlink(sentinelPath);
    } catch {
      // Best effort cleanup
    }
  }
}

/**
 * Check if an execute session has an active inbox.
 */
export function isInboxActive(targetPath: string): boolean {
  return existsSync(join(getInboxDir(targetPath), ".active"));
}
