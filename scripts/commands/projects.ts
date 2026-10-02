#!/usr/bin/env bun
/**
 * Project Briefings CLI & Handler (briefings/projects/<name>.md)
 *
 * Commands:
 *   index [--json]                            List all project index cards & active drafts
 *   draft --json '<payload>'                  Stage a new project briefing or patch existing fields
 *   save --name <name>                        Persist draft to briefings/projects/ with rolling backup
 */

import * as fs from "fs";
import * as path from "path";
import {
  type ProjectFrontmatter,
  type ProjectDraftPayload,
  VALID_PROJECT_STATUSES,
} from "../lib/types";
import {
  ensureMemoryStructure,
  getBriefingsDir,
  getBriefingPath,
  getDraftBriefingsDir,
  getDraftBriefingPath,
  getBriefingBackupDir,
  sanitizeName,
} from "../lib/paths";
import { parseMarkdownFile, formatMarkdownFile } from "../lib/frontmatter";
import { atomicWrite, safeWriteWithRollingBackup } from "../lib/atomic-write";
import { replaceSection } from "../lib/markdown-sections";

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getBaseProjectContent(name: string): {
  frontmatter: ProjectFrontmatter & Record<string, unknown>;
  body: string;
  isNew: boolean;
} {
  const draftPath = getDraftBriefingPath("projects", name);
  const livePath = getBriefingPath("projects", name);

  if (fs.existsSync(draftPath)) {
    const raw = fs.readFileSync(draftPath, "utf-8");
    const parsed = parseMarkdownFile<ProjectFrontmatter & Record<string, unknown>>(raw);
    return { frontmatter: parsed.frontmatter, body: parsed.body, isNew: false };
  }

  if (fs.existsSync(livePath)) {
    const raw = fs.readFileSync(livePath, "utf-8");
    const parsed = parseMarkdownFile<ProjectFrontmatter & Record<string, unknown>>(raw);
    return { frontmatter: parsed.frontmatter, body: parsed.body, isNew: false };
  }

  const defaultFm: ProjectFrontmatter & Record<string, unknown> = {
    name,
    status: "active",
    last_modified: getTodayString(),
  };

  const titleName = name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const defaultBody = `# Project ${titleName}\n\n## Objectives\n\n## Key Facts\n`;
  return { frontmatter: defaultFm, body: defaultBody, isNew: true };
}

export function handleProjectIndex(args: { json?: boolean } = {}): string {
  ensureMemoryStructure();
  const dir = getBriefingsDir("projects");
  const draftDir = getDraftBriefingsDir("projects");

  const results: Array<{ name: string; file: string; frontmatter: ProjectFrontmatter }> = [];
  const draftsList: Array<{ name: string; rationale?: string; drafted_at?: string }> = [];

  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        const parsed = parseMarkdownFile<ProjectFrontmatter>(raw);
        results.push({
          name: sanitizeName(file),
          file,
          frontmatter: parsed.frontmatter,
        });
      } catch {
        // Skip unreadable files
      }
    }
  }

  if (fs.existsSync(draftDir)) {
    const dFiles = fs.readdirSync(draftDir).filter((f) => f.endsWith(".md"));
    for (const file of dFiles) {
      const fullPath = path.join(draftDir, file);
      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        const parsed = parseMarkdownFile<Record<string, unknown>>(raw);
        draftsList.push({
          name: sanitizeName(file),
          rationale: parsed.frontmatter._rationale as string | undefined,
          drafted_at: parsed.frontmatter._drafted_at as string | undefined,
        });
      } catch {
        // Skip unreadable files
      }
    }
  }

  if (args.json) {
    return JSON.stringify({ projects: results, activeDrafts: draftsList }, null, 2);
  }

  const sections: string[] = [`# Project Briefings Index (${results.length})\n`];
  if (results.length === 0) {
    sections.push("  (No project briefings recorded yet)\n");
  } else {
    for (const item of results) {
      const fm = item.frontmatter;
      sections.push(`- **${item.name}**`);
      const details = [
        fm.status ? `status: ${fm.status}` : null,
        fm.lead ? `lead: ${fm.lead}` : null,
        fm.last_modified ? `modified: ${fm.last_modified}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      if (details) sections.push(`  ↳ ${details}`);
    }
    sections.push("");
  }

  if (draftsList.length > 0) {
    sections.push(`## ACTIVE DRAFTS (${draftsList.length}) — Awaiting Save`);
    for (const d of draftsList) {
      sections.push(`- **${d.name}** (drafted: ${d.drafted_at || "recent"})`);
      if (d.rationale) sections.push(`  ↳ rationale: ${d.rationale}`);
    }
    sections.push("");
  }

  return sections.join("\n").trim();
}

export function handleProjectDraft(payload: ProjectDraftPayload): {
  success: boolean;
  message: string;
  draftPath: string;
  name: string;
  operation: "created" | "updated";
} {
  ensureMemoryStructure();

  if (!payload.name || typeof payload.name !== "string" || !payload.name.trim()) {
    throw new Error("Payload must provide non-empty 'name' string");
  }

  if (!payload.rationale || typeof payload.rationale !== "string" || !payload.rationale.trim()) {
    throw new Error("Payload must provide non-empty 'rationale' explaining why this draft is staged");
  }

  if (payload.status !== undefined) {
    if (!VALID_PROJECT_STATUSES.includes(payload.status)) {
      throw new Error(
        `Invalid status '${payload.status}'. Allowed options: [${VALID_PROJECT_STATUSES.join(", ")}]`
      );
    }
  }

  const name = sanitizeName(payload.name);
  const { frontmatter, body, isNew } = getBaseProjectContent(name);
  let updatedBody = body;

  // Universal rule: Present in payload -> update; absent -> keep existing
  if (payload.status !== undefined) frontmatter.status = payload.status;
  if (payload.lead !== undefined) frontmatter.lead = payload.lead.trim();

  // Strip deprecated fields if present in legacy files
  delete frontmatter.aliases;
  delete frontmatter.tier;
  delete frontmatter.owner;
  delete frontmatter.current_bottleneck;
  delete frontmatter.next_action;
  delete frontmatter.tags;
  delete frontmatter.description;
  delete frontmatter.last_updated;

  if (payload.objectives !== undefined) {
    if (!Array.isArray(payload.objectives)) {
      throw new Error("'objectives' must be an array of strings");
    }
    updatedBody = replaceSection(updatedBody, "Objectives", payload.objectives);
  }

  const keyFacts = payload.key_facts ?? payload.keyFacts ?? (payload as unknown as { keyFact?: string[] }).keyFact ?? payload.facts;
  if (keyFacts !== undefined) {
    if (!Array.isArray(keyFacts)) {
      throw new Error("'key_facts' must be an array of strings");
    }
    updatedBody = replaceSection(updatedBody, "Key Facts", keyFacts);
  }

  // Remove deprecated sections if present
  updatedBody = replaceSection(updatedBody, "Timeline", []);
  updatedBody = replaceSection(updatedBody, "Open Threads", []);

  frontmatter.name = name;
  frontmatter.last_modified = getTodayString();
  frontmatter._drafted_at = new Date().toISOString();
  frontmatter._rationale = payload.rationale.trim();

  const formatted = formatMarkdownFile(frontmatter, updatedBody);
  const draftPath = getDraftBriefingPath("projects", name);
  atomicWrite(draftPath, formatted);

  const operation = isNew ? "created" : "updated";
  return {
    success: true,
    message: `Successfully ${operation} project draft for '${name}' in drafts/briefings/projects/`,
    draftPath,
    name,
    operation,
  };
}

export function handleProjectSave(args: { name: string }): {
  success: boolean;
  message: string;
  committedPath: string;
  backupPath: string | null;
} {
  ensureMemoryStructure();
  if (!args.name || !args.name.trim()) throw new Error("Must provide --name '<identifier>'");

  const name = sanitizeName(args.name);
  const draftPath = getDraftBriefingPath("projects", name);
  const committedPath = getBriefingPath("projects", name);
  const backupDir = getBriefingBackupDir("projects", name);

  if (!fs.existsSync(draftPath)) {
    throw new Error(`No active draft found for projects/${name} at ${draftPath}. Use draft first.`);
  }

  const draftRaw = fs.readFileSync(draftPath, "utf-8");
  const parsed = parseMarkdownFile<Record<string, unknown>>(draftRaw);

  delete parsed.frontmatter._drafted_at;
  delete parsed.frontmatter._rationale;
  parsed.frontmatter.last_modified = getTodayString();

  const finalContent = formatMarkdownFile(parsed.frontmatter, parsed.body);
  const { backupPath } = safeWriteWithRollingBackup(committedPath, finalContent, backupDir);

  fs.unlinkSync(draftPath);

  return {
    success: true,
    message: `Saved project briefing for ${name}`,
    committedPath,
    backupPath,
  };
}

function printHelp(): void {
  console.log(`
Project Briefings CLI (briefings/projects/<name>.md)

Commands:
  index [--json]
    Output index summary of all project briefings and pending drafts.

  draft --json '<payload>'
    Stage a new project briefing or patch fields on an existing one.
    Payload schema:
      {
        "name": "<kebab-name>",                          (required)
        "status": "<enum>",                               (optional: active|planning|paused|completed)
        "lead": "<kebab-name>",                           (optional)
        "objectives": ["2-4 deliverables"],               (optional: 2-4 items)
        "key_facts": ["3-6 architecture & roster facts"], (optional: 3-6 items)
        "rationale": "<why this update>"                  (required)
      }

  save --name "<name>"
    Persist staged draft to briefings/projects/<name>.md with rolling backup.
`);
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data.trim()));
    process.stdin.on("error", reject);
  });
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const command = rawArgs[0] || "";

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case "index": {
        const json = rawArgs.includes("--json");
        const out = handleProjectIndex({ json });
        console.log(out);
        break;
      }
      case "draft": {
        let jsonStr = "";
        const jsonIdx = rawArgs.indexOf("--json");
        if (jsonIdx !== -1 && rawArgs[jsonIdx + 1]) {
          jsonStr = rawArgs[jsonIdx + 1];
        } else if (!process.stdin.isTTY) {
          jsonStr = await readStdin();
        }

        if (!jsonStr) {
          throw new Error("Must provide payload via --json '<JSON>' or pipe to stdin");
        }

        let payload: ProjectDraftPayload;
        try {
          payload = JSON.parse(jsonStr);
        } catch (e: any) {
          throw new Error(`Invalid JSON payload: ${e.message}`);
        }

        const res = handleProjectDraft(payload);
        console.log(JSON.stringify(res, null, 2));
        break;
      }
      case "save": {
        let name = "";
        const nameIdx = rawArgs.indexOf("--name");
        if (nameIdx !== -1 && rawArgs[nameIdx + 1]) {
          name = rawArgs[nameIdx + 1];
        } else {
          const jsonIdx = rawArgs.indexOf("--json");
          if (jsonIdx !== -1 && rawArgs[jsonIdx + 1]) {
            const parsed = JSON.parse(rawArgs[jsonIdx + 1]);
            name = parsed.name;
          }
        }

        if (!name) throw new Error("Must provide --name '<identifier>'");
        const res = handleProjectSave({ name });
        console.log(JSON.stringify(res, null, 2));
        break;
      }
      default:
        console.error(`Unknown project command: '${command}'`);
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
