#!/usr/bin/env bun
/**
 * User Profile CLI & Handler (user.md)
 *
 * Commands:
 *   draft --json '<PAYLOAD>'  Stage user profile updates via pure JSON payload
 *   save                      Persist staged draft to user.md with rolling backup
 */

import * as fs from "fs";
import { ensureMemoryStructure, getUserMdPath, getDraftUserPath, getUserBackupDir } from "../lib/paths";
import { atomicWrite, safeWriteWithRollingBackup } from "../lib/atomic-write";
import { parseMarkdownFile, formatMarkdownFile } from "../lib/frontmatter";
import { replaceSection } from "../lib/markdown-sections";
import type { UserDraftPayload, UserFrontmatter } from "../lib/types";

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getBaseUserContent(): { frontmatter: UserFrontmatter; body: string } {
  const draftPath = getDraftUserPath();
  const livePath = getUserMdPath();

  if (fs.existsSync(draftPath)) {
    const raw = fs.readFileSync(draftPath, "utf-8");
    return parseMarkdownFile<UserFrontmatter>(raw);
  }

  if (fs.existsSync(livePath)) {
    const raw = fs.readFileSync(livePath, "utf-8");
    const parsed = parseMarkdownFile<UserFrontmatter>(raw);
    return { frontmatter: parsed.frontmatter, body: parsed.body || "# User Profile" };
  }

  const defaultFrontmatter: UserFrontmatter = {
    id: "user",
    name: "User",
    role: "Engineer",
    timezone: "America/Chicago",
  };

  const defaultBody = `# User Profile

## Communication Preferences
- Concise, direct communication

## Working Rules
- Always prioritize safety gates for persistent state mutations
`;

  return { frontmatter: defaultFrontmatter, body: defaultBody };
}

export function handleUserDraft(payload: UserDraftPayload): {
  success: boolean;
  message: string;
  draftPath: string;
} {
  ensureMemoryStructure();

  if (!payload.rationale || !payload.rationale.trim()) {
    throw new Error("Must provide 'rationale' explaining why this user profile update is proposed");
  }

  const { frontmatter, body } = getBaseUserContent();
  let updatedBody = body;

  // Update frontmatter properties if provided
  if (payload.id !== undefined) frontmatter.id = payload.id.trim();
  if (payload.name !== undefined) frontmatter.name = payload.name.trim();
  if (payload.role !== undefined) frontmatter.role = payload.role.trim();
  if (payload.team !== undefined) frontmatter.team = payload.team.trim();
  if (payload.email !== undefined) frontmatter.email = payload.email.trim();
  if (payload.github !== undefined) frontmatter.github = payload.github.trim();
  if (payload.timezone !== undefined) frontmatter.timezone = payload.timezone.trim();

  // Normalize legacy section headers if present
  updatedBody = updatedBody
    .replace(/##\s+Preferences\s*&\s*Communication\s*Style/gi, "## Communication Preferences")
    .replace(/##\s+Core\s*Decisions\s*&\s*Working\s*Rules/gi, "## Working Rules");

  // Ensure top header exists
  if (!updatedBody.startsWith("# ")) {
    updatedBody = `# User Profile\n\n${updatedBody}`.trim();
  }

  // Update sections if provided
  if (payload.preferences !== undefined) {
    updatedBody = replaceSection(updatedBody, "Communication Preferences", payload.preferences);
  }
  if (payload.rules !== undefined) {
    updatedBody = replaceSection(updatedBody, "Working Rules", payload.rules);
  }

  frontmatter._drafted_at = new Date().toISOString();
  frontmatter._rationale = payload.rationale.trim();

  // Normalize body spacing
  updatedBody = updatedBody.replace(/\n{3,}/g, "\n\n").trim();

  const formatted = formatMarkdownFile(frontmatter, updatedBody + "\n");
  const draftPath = getDraftUserPath();
  atomicWrite(draftPath, formatted);

  return {
    success: true,
    message: "User profile draft staged in drafts/user.md",
    draftPath,
  };
}

export function handleUserSave(): {
  success: boolean;
  message: string;
  path: string;
  backupPath: string | null;
} {
  ensureMemoryStructure();
  const draftPath = getDraftUserPath();
  const liveUserMdPath = getUserMdPath();

  if (!fs.existsSync(draftPath)) {
    throw new Error(`No active user draft found at ${draftPath}. Use 'draft --json' first.`);
  }

  const draftRaw = fs.readFileSync(draftPath, "utf-8");
  const parsed = parseMarkdownFile<UserFrontmatter>(draftRaw);

  delete parsed.frontmatter._drafted_at;
  delete parsed.frontmatter._rationale;
  parsed.frontmatter.last_modified = getTodayString();

  const finalContent = formatMarkdownFile(parsed.frontmatter, parsed.body);
  const { backupPath } = safeWriteWithRollingBackup(liveUserMdPath, finalContent, getUserBackupDir());

  fs.unlinkSync(draftPath);

  return {
    success: true,
    message: "User profile draft saved to user.md",
    path: liveUserMdPath,
    backupPath,
  };
}

function printHelp(): void {
  console.log(`
User Profile CLI (user.md)

Commands:
  draft --json '<PAYLOAD>'
    Stage user profile updates via pure JSON payload.
    Payload fields:
      rationale    (Required) Explanation of why profile or rules are changing
      id           (Optional) Corporate or system user ID (e.g. y0x01z6)
      name         (Optional) User display name
      role         (Optional) Job title / role
      team         (Optional) Team / organization
      email        (Optional) Primary email address
      github       (Optional) GitHub handle or URL
      timezone     (Optional) IANA timezone (e.g. America/Chicago)
      preferences  (Optional) Array of communication style preferences
      rules        (Optional) Array of permanent working rules / decisions

  save
    Persist staged draft to user.md with automatic rolling backup.
`);
}

function parseArgs(args: string[]): { command: string; options: Record<string, string> } {
  const command = args[0] || "";
  const options: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        i++;
      } else {
        options[key] = "true";
      }
    }
  }

  return { command, options };
}

function main(): void {
  const rawArgs = process.argv.slice(2);
  const { command, options } = parseArgs(rawArgs);

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case "draft": {
        if (!options.json) {
          throw new Error("Must provide --json '<JSON_STRING>' for draft command");
        }
        let payload: UserDraftPayload;
        try {
          payload = JSON.parse(options.json);
        } catch (err: any) {
          throw new Error(`Invalid JSON payload: ${err.message}`);
        }
        const res = handleUserDraft(payload);
        console.log(JSON.stringify(res, null, 2));
        break;
      }
      case "save": {
        const res = handleUserSave();
        console.log(JSON.stringify(res, null, 2));
        break;
      }
      default:
        console.error(`Unknown user command: '${command}'`);
        printHelp();
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
