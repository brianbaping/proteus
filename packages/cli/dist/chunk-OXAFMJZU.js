// src/utils/inbox.ts
import { writeFile, readFile, readdir, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
function getInboxDir(targetPath) {
  return join(targetPath, ".proteus-forge", "05-execute", "inbox");
}
async function writeInboxMessage(targetPath, targetAgent, message) {
  const inboxDir = getInboxDir(targetPath);
  await mkdir(inboxDir, { recursive: true });
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const filename = `${Date.now()}-${targetAgent}.json`;
  const filePath = join(inboxDir, filename);
  const msg = { targetAgent, message, timestamp };
  await writeFile(filePath, JSON.stringify(msg, null, 2) + "\n");
  return filePath;
}
async function consumeInboxMessages(targetPath) {
  const inboxDir = getInboxDir(targetPath);
  if (!existsSync(inboxDir)) return [];
  const files = await readdir(inboxDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
  const messages = [];
  for (const file of jsonFiles) {
    const filePath = join(inboxDir, file);
    try {
      const content = await readFile(filePath, "utf-8");
      messages.push(JSON.parse(content));
      await unlink(filePath);
    } catch {
    }
  }
  return messages;
}
async function* watchInbox(targetPath, pollIntervalMs = 3e3) {
  const inboxDir = getInboxDir(targetPath);
  await mkdir(inboxDir, { recursive: true });
  const sentinelPath = join(inboxDir, ".active");
  await writeFile(sentinelPath, (/* @__PURE__ */ new Date()).toISOString());
  try {
    while (true) {
      const messages = await consumeInboxMessages(targetPath);
      for (const msg of messages) {
        yield `[USER MESSAGE for ${msg.targetAgent}] Please relay this to the "${msg.targetAgent}" teammate: ${msg.message}`;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  } finally {
    try {
      if (existsSync(sentinelPath)) await unlink(sentinelPath);
    } catch {
    }
  }
}
function isInboxActive(targetPath) {
  return existsSync(join(getInboxDir(targetPath), ".active"));
}

export {
  getInboxDir,
  writeInboxMessage,
  consumeInboxMessages,
  watchInbox,
  isInboxActive
};
