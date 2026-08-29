import * as fs from "fs";
import * as path from "path";

const DEFAULT_MAX_SNAPSHOTS = 5;

/**
 * Creates a timestamped backup copy in the dedicated backup directory and enforces a rolling retention window.
 */
export function createRollingBackup(
  targetFilePath: string,
  backupDir: string,
  maxSnapshots: number = DEFAULT_MAX_SNAPSHOTS
): string | null {
  if (!fs.existsSync(targetFilePath)) {
    return null;
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\..+/, ""); // e.g. 2026-08-27T14-40-00

  const backupFilePath = path.join(backupDir, `${timestamp}.md`);
  fs.copyFileSync(targetFilePath, backupFilePath);

  // Enforce rolling retention window
  try {
    const existing = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith(".md"))
      .sort(); // ISO format timestamps sort chronologically

    if (existing.length > maxSnapshots) {
      const toDelete = existing.slice(0, existing.length - maxSnapshots);
      for (const oldFile of toDelete) {
        fs.unlinkSync(path.join(backupDir, oldFile));
      }
    }
  } catch {
    // Non-fatal retention cleanup error
  }

  return backupFilePath;
}

/**
 * Performs an atomic file write using a temporary sibling file and rename.
 */
export function atomicWrite(targetPath: string, content: string): void {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = path.join(
    dir,
    `.${path.basename(targetPath)}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`
  );

  fs.writeFileSync(tempPath, content, "utf-8");
  fs.renameSync(tempPath, targetPath);
}

/**
 * Safely writes a file after snapshotting the previous revision to the dedicated backup directory.
 */
export function safeWriteWithRollingBackup(
  targetPath: string,
  content: string,
  backupDir: string,
  maxSnapshots: number = DEFAULT_MAX_SNAPSHOTS
): { written: boolean; backupPath: string | null } {
  const backupPath = createRollingBackup(targetPath, backupDir, maxSnapshots);
  atomicWrite(targetPath, content);
  return { written: true, backupPath };
}
