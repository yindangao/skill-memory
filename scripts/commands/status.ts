#!/usr/bin/env bun
/**
 * CLI Entrypoint for Memory Diagnostics & Status
 *
 * Usage:
 *   bun status.ts
 */

import * as fs from "fs";
import {
  ensureMemoryStructure,
  getMemoryRoot,
  getUserMdPath,
  getBriefingsDir,
  getDraftsDir,
  getBackupsDir,
  getJournalsDir,
} from "../lib/paths";

export function handleStatus(): Record<string, unknown> {
  ensureMemoryStructure();
  const root = getMemoryRoot();

  const userExists = fs.existsSync(getUserMdPath());
  const peopleCount = fs.existsSync(getBriefingsDir("people"))
    ? fs.readdirSync(getBriefingsDir("people")).filter((f) => f.endsWith(".md")).length
    : 0;
  const projectCount = fs.existsSync(getBriefingsDir("projects"))
    ? fs.readdirSync(getBriefingsDir("projects")).filter((f) => f.endsWith(".md")).length
    : 0;

  let draftsCount = 0;
  const draftsDir = getDraftsDir();
  if (fs.existsSync(draftsDir)) {
    const scanDrafts = (dir: string) => {
      for (const item of fs.readdirSync(dir)) {
        const full = `${dir}/${item}`;
        if (fs.statSync(full).isDirectory()) scanDrafts(full);
        else if (item.endsWith(".md")) draftsCount++;
      }
    };
    scanDrafts(draftsDir);
  }

  let backupsCount = 0;
  const backupsDir = getBackupsDir();
  if (fs.existsSync(backupsDir)) {
    const scanBackups = (dir: string) => {
      for (const item of fs.readdirSync(dir)) {
        const full = `${dir}/${item}`;
        if (fs.statSync(full).isDirectory()) scanBackups(full);
        else if (item.endsWith(".md")) backupsCount++;
      }
    };
    scanBackups(backupsDir);
  }

  let journalsCount = 0;
  const journalsDir = getJournalsDir();
  if (fs.existsSync(journalsDir)) {
    const scanJournals = (dir: string) => {
      for (const item of fs.readdirSync(dir)) {
        const full = `${dir}/${item}`;
        if (fs.statSync(full).isDirectory()) scanJournals(full);
        else if (item.endsWith(".md")) journalsCount++;
      }
    };
    scanJournals(journalsDir);
  }

  return {
    status: "ok",
    memoryRoot: root,
    userProfile: userExists ? "present" : "missing",
    entities: {
      people: peopleCount,
      projects: projectCount,
    },
    activeDrafts: draftsCount,
    backupSnapshots: backupsCount,
    journalEntries: journalsCount,
  };
}

function main(): void {
  try {
    const res = handleStatus();
    console.log(JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
