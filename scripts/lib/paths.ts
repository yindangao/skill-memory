import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";
import type { BriefingKind } from "./types";

/**
 * Resolves the root directory of the memory storage.
 * Defaults to the universal user memory store: ~/.memory/
 * Supports MEMORY_ROOT env var for test isolation.
 */
export function resolveMemoryRoot(): string {
  if (process.env.MEMORY_ROOT && process.env.MEMORY_ROOT.trim()) {
    return path.resolve(process.env.MEMORY_ROOT.trim());
  }

  return path.join(homedir(), ".memory");
}

/**
 * Ensures standard directory structure exists within memory root.
 */
export function ensureMemoryStructure(): string {
  const root = resolveMemoryRoot();
  const dirs = [
    root,
    path.join(root, "briefings", "people"),
    path.join(root, "briefings", "projects"),
    path.join(root, "drafts", "briefings", "people"),
    path.join(root, "drafts", "briefings", "projects"),
    path.join(root, "backups", "briefings", "people"),
    path.join(root, "backups", "briefings", "projects"),
    path.join(root, "journals"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  return root;
}

export function getUserMdPath(): string {
  return path.join(resolveMemoryRoot(), "user.md");
}

export function getDraftsDir(): string {
  return path.join(resolveMemoryRoot(), "drafts");
}

export function getBackupsDir(): string {
  return path.join(resolveMemoryRoot(), "backups");
}

export function getBriefingsDir(kind: BriefingKind): string {
  return path.join(resolveMemoryRoot(), "briefings", kind);
}

export function getBriefingPath(kind: BriefingKind, name: string): string {
  const cleanName = sanitizeName(name);
  return path.join(getBriefingsDir(kind), `${cleanName}.md`);
}

export function getDraftBriefingsDir(kind: BriefingKind): string {
  return path.join(resolveMemoryRoot(), "drafts", "briefings", kind);
}

export function getDraftBriefingPath(kind: BriefingKind, name: string): string {
  const cleanName = sanitizeName(name);
  return path.join(getDraftBriefingsDir(kind), `${cleanName}.md`);
}

export function getBriefingBackupDir(kind: BriefingKind, name: string): string {
  const cleanName = sanitizeName(name);
  return path.join(resolveMemoryRoot(), "backups", "briefings", kind, cleanName);
}

export function getJournalsDir(): string {
  return path.join(resolveMemoryRoot(), "journals");
}

export function getJournalPath(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return path.join(getJournalsDir(), year, month, `${day}.md`);
  }
  return path.join(getJournalsDir(), `${dateStr}.md`);
}

export function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\.md$/, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-");
}

