#!/usr/bin/env bun
/**
 * People Briefings CLI & Handler (briefings/people/<name>.md)
 *
 * Commands:
 *   index [--json]                            List all people index cards & active drafts
 *   draft << 'EOF' ... EOF                    Stage a new collaborator briefing via stdin (or --json '<payload>')
 *   save --name <name>                        Persist draft to briefings/people/ with rolling backup
 */

import * as fs from "fs";
import * as path from "path";
import {
  type PersonFrontmatter,
  type PersonDraftPayload,
  VALID_PERSON_RELATIONSHIPS,
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

function getBasePersonContent(name: string): {
  frontmatter: PersonFrontmatter & Record<string, unknown>;
  body: string;
  isNew: boolean;
} {
  const draftPath = getDraftBriefingPath("people", name);
  const livePath = getBriefingPath("people", name);

  if (fs.existsSync(draftPath)) {
    const raw = fs.readFileSync(draftPath, "utf-8");
    const parsed = parseMarkdownFile<PersonFrontmatter & Record<string, unknown>>(raw);
    return { frontmatter: parsed.frontmatter, body: parsed.body, isNew: false };
  }

  if (fs.existsSync(livePath)) {
    const raw = fs.readFileSync(livePath, "utf-8");
    const parsed = parseMarkdownFile<PersonFrontmatter & Record<string, unknown>>(raw);
    return { frontmatter: parsed.frontmatter, body: parsed.body, isNew: false };
  }

  const defaultFm: PersonFrontmatter & Record<string, unknown> = {
    name,
    relationship: "peer",
    last_modified: getTodayString(),
  };

  const titleName = name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const defaultBody = `# ${titleName}\n\n## Key Facts\n`;
  return { frontmatter: defaultFm, body: defaultBody, isNew: true };
}

export function handlePeopleIndex(args: { json?: boolean } = {}): string {
  ensureMemoryStructure();
  const dir = getBriefingsDir("people");
  const draftDir = getDraftBriefingsDir("people");

  const results: Array<{ name: string; file: string; frontmatter: PersonFrontmatter }> = [];
  const draftsList: Array<{ name: string; rationale?: string; drafted_at?: string }> = [];

  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        const parsed = parseMarkdownFile<PersonFrontmatter>(raw);
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
    return JSON.stringify({ people: results, activeDrafts: draftsList }, null, 2);
  }

  const sections: string[] = [`# People Briefings Index (${results.length})\n`];
  if (results.length === 0) {
    sections.push("  (No people briefings recorded yet)\n");
  } else {
    for (const item of results) {
      const fm = item.frontmatter;
      sections.push(`- **${item.name}**`);
      const details = [
        fm.role ? `role: ${fm.role}` : null,
        fm.team ? `team: ${fm.team}` : null,
        fm.relationship ? `rel: ${fm.relationship}` : null,
        fm.timezone ? `tz: ${fm.timezone}` : null,
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

export function handlePeopleDraft(payload: PersonDraftPayload): {
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

  if (payload.relationship !== undefined) {
    if (!VALID_PERSON_RELATIONSHIPS.includes(payload.relationship)) {
      throw new Error(
        `Invalid relationship '${payload.relationship}'. Allowed options: [${VALID_PERSON_RELATIONSHIPS.join(", ")}]`
      );
    }
  }

  const name = sanitizeName(payload.name);
  const { frontmatter, body, isNew } = getBasePersonContent(name);
  let updatedBody = body;

  // Universal rule: Present in payload -> update; absent -> keep existing
  if (payload.role !== undefined) frontmatter.role = payload.role.trim();
  if (payload.team !== undefined) frontmatter.team = payload.team.trim();
  if (payload.relationship !== undefined) frontmatter.relationship = payload.relationship;
  if (payload.timezone !== undefined) frontmatter.timezone = payload.timezone.trim();

  // Strip deprecated fields if present in legacy files
  delete frontmatter.aliases;
  delete frontmatter.manager;
  delete frontmatter.location;
  delete frontmatter.tags;
  delete frontmatter.description;
  delete frontmatter.last_interaction;

  const keyFacts = payload.key_facts ?? payload.keyFacts ?? (payload as unknown as { keyFact?: string[] }).keyFact ?? payload.facts;
  if (keyFacts !== undefined) {
    if (!Array.isArray(keyFacts)) {
      throw new Error("'key_facts' must be an array of strings");
    }
    updatedBody = replaceSection(updatedBody, "Key Facts", keyFacts);
  }

  // Remove deprecated sections if present
  updatedBody = replaceSection(updatedBody, "Timeline", []);
  updatedBody = replaceSection(updatedBody, "Interaction Timeline", []);
  updatedBody = replaceSection(updatedBody, "Open Threads", []);

  frontmatter.name = name;
  frontmatter.last_modified = getTodayString();
  frontmatter._drafted_at = new Date().toISOString();
  frontmatter._rationale = payload.rationale.trim();

  const formatted = formatMarkdownFile(frontmatter, updatedBody);
  const draftPath = getDraftBriefingPath("people", name);
  atomicWrite(draftPath, formatted);

  const operation = isNew ? "created" : "updated";
  return {
    success: true,
    message: `Successfully ${operation} person draft for '${name}' in drafts/briefings/people/`,
    draftPath,
    name,
    operation,
  };
}

export function handlePeopleSave(args: { name: string }): {
  success: boolean;
  message: string;
  committedPath: string;
  backupPath: string | null;
} {
  ensureMemoryStructure();
  if (!args.name || !args.name.trim()) throw new Error("Must provide --name '<identifier>'");

  const name = sanitizeName(args.name);
  const draftPath = getDraftBriefingPath("people", name);
  const committedPath = getBriefingPath("people", name);
  const backupDir = getBriefingBackupDir("people", name);

  if (!fs.existsSync(draftPath)) {
    throw new Error(`No active draft found for people/${name} at ${draftPath}. Use draft first.`);
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
    message: `Saved people briefing for ${name}`,
    committedPath,
    backupPath,
  };
}

function printHelp(): void {
  console.log(`
People Briefings CLI (briefings/people/<name>.md)

Commands:
  index [--json]
    Output index summary of all people briefings and pending drafts.

  draft [<< 'EOF' | --json '<payload>']
    Stage a new person briefing or patch fields on an existing one via stdin or JSON flag.
    Payload schema:
      {
        "name": "<kebab-name>",               (required)
        "role": "<job title>",                 (optional)
        "team": "<team or branch>",            (optional)
        "relationship": "<enum>",              (optional: manager|direct-report|peer|cross-team|leadership|external)
        "timezone": "<iana-timezone>",         (optional, e.g. America/Chicago)
        "facts": ["fact 1", "fact 2"],         (optional)
        "rationale": "<why this update>"       (required)
      }

  save --name "<name>"
    Persist staged draft to briefings/people/<name>.md with rolling backup.
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
        const out = handlePeopleIndex({ json });
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
          throw new Error("Must provide payload via stdin (e.g. draft << 'EOF') or --json '<JSON>'");
        }

        let payload: PersonDraftPayload;
        try {
          payload = JSON.parse(jsonStr);
        } catch (e: any) {
          throw new Error(`Invalid JSON payload: ${e.message}`);
        }

        const res = handlePeopleDraft(payload);
        console.log(JSON.stringify(res, null, 2));
        break;
      }
      case "save": {
        let name = "";
        const nameIdx = rawArgs.indexOf("--name");
        if (nameIdx !== -1 && rawArgs[nameIdx + 1]) {
          name = rawArgs[nameIdx + 1];
        } else {
          // Check if passed via json
          const jsonIdx = rawArgs.indexOf("--json");
          if (jsonIdx !== -1 && rawArgs[jsonIdx + 1]) {
            const parsed = JSON.parse(rawArgs[jsonIdx + 1]);
            name = parsed.name;
          }
        }

        if (!name) throw new Error("Must provide --name '<identifier>'");
        const res = handlePeopleSave({ name });
        console.log(JSON.stringify(res, null, 2));
        break;
      }
      default:
        console.error(`Unknown people command: '${command}'`);
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
