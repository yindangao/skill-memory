#!/usr/bin/env bun
/**
 * Daily Journals CLI & Handler (journals/YYYY/MM/DD.md)
 *
 * Usage:
 *   bun journal.ts append --summary "<summary>" [--projects "p1,p2"] [--people "n1,n2"]
 */

import * as fs from "fs";
import * as path from "path";
import { ensureMemoryStructure, getJournalPath } from "../lib/paths";

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getTimeString(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${min}`;
}

function formatEntityList(raw?: string): string {
  if (!raw || !raw.trim()) return "";
  return raw
    .split(/[,;]/)
    .map((item) => item.trim())
    .map((item) => item.replace(/^(people|projects)\//i, ""))
    .map((item) => item.replace(/^\[\[(.*?)\]\]$/, "$1"))
    .filter(Boolean)
    .join(", ");
}

export function handleJournalAppend(args: {
  summary: string;
  projects?: string;
  people?: string;
}): {
  success: boolean;
  message: string;
  entry: string;
  path: string;
} {
  ensureMemoryStructure();
  const todayStr = getTodayString();
  const journalPath = getJournalPath(todayStr);

  const parentDir = path.dirname(journalPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const timeStr = getTimeString();
  const projectList = formatEntityList(args.projects);
  const peopleList = formatEntityList(args.people);

  let entryContent = `### ${timeStr}\n`;
  if (projectList) {
    entryContent += `- **projects**: ${projectList}\n`;
  }
  if (peopleList) {
    entryContent += `- **people**: ${peopleList}\n`;
  }
  entryContent += `- **summary**: ${args.summary.trim()}\n\n`;

  if (!fs.existsSync(journalPath)) {
    const header = `---\ndate: ${todayStr}\n---\n\n`;
    fs.writeFileSync(journalPath, header + entryContent, "utf-8");
  } else {
    fs.appendFileSync(journalPath, entryContent, "utf-8");
  }

  return {
    success: true,
    message: `Appended journal entry to ${todayStr}.md`,
    entry: entryContent.trim(),
    path: journalPath,
  };
}

function printHelp(): void {
  console.log(`
Daily Journals CLI (journals/YYYY/MM/DD.md)

Usage:
  bun journal.ts append --summary "<summary>" [--projects "p1,p2"] [--people "n1,n2"]

Options:
  --summary "<text>"    Summary of task completed, milestone achieved, or decision made (required)
  --projects "<names>"  Comma-separated project identifiers (optional)
  --people "<names>"    Comma-separated person identifiers (optional)
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
    if (command === "append") {
      if (!options.summary) {
        console.error("Error: Must provide --summary '<summary>'");
        process.exit(1);
      }
      const res = handleJournalAppend({
        summary: options.summary,
        projects: options.projects,
        people: options.people,
      });
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.error(`Unknown journal command: '${command}'`);
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
