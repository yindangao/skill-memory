---
name: memory
description: >-
  Ambient cognitive persistence system. Consult stored entity briefings and journals to recall collaborator context, project history, and past decisions. Silently append daily journals and spawn a subagent to update entity briefings upon completing a non-trivial task, solving a tough bug, or establishing a project decision. Update user profile under user confirmation.
allowed-tools:
  - Bash
  - Read
  - Write
---

# Unified 3-Tier Memory Persistence System

This skill provides the cognitive persistence engine, safety contracts, and CLI interfaces for mutating the 3-tier memory store in `~/.memory/`.

---

## 1. The 3-Tier Execution Authority Matrix

To preserve high chat responsiveness while ensuring deep, bounded knowledge persistence, memory operations are strictly partitioned across 3 tiers:

| Memory Tier | Storage Path | Primary Handler | Access & Mutation Protocol |
| :--- | :--- | :--- | :--- |
| **Tier 1: Daily Journals** | `~/.memory/journals/YYYY/MM/DD.md` | **Main Parent Agent** | **Append-Only (Silent / On-the-Fly)**<br>Atomic append upon completing tasks or decisions. Read-only to subagents. |
| **Tier 2: Entity Briefings** | `~/.memory/briefings/people/`<br>`~/.memory/briefings/projects/` | **Background Subagent** | **Read / Write (Autonomous Bounded Reconciliation)**<br>Asynchronously synthesized by background subagent. Bounded sizes enforced. |
| **Tier 3: User Profile & Rules** | `~/.memory/user.md` | **Main Parent Agent ONLY** | **Strict Confirmation Gate**<br>Interactive user confirmation required for rule changes. Read-only to subagents. |

---

## 2. Tier 1: Daily Journals (Parent Agent Append)

Chronological logbook recording daily milestones, task completions, and key decisions.

* **Trigger**: Proactively log an entry upon completing a non-trivial task, solving a tough bug, or establishing a project decision.
* **Silent Execution**: Append entries as background tool calls. Do not mention, quote, or acknowledge journal logging in your text response—focus your response entirely on the user's task.
* **Tagging**: Tag collaborator or project identifiers freely (e.g., `people: mohamad-elmoussawi`, `projects: wmap`). They do not require pre-existing briefings.
* **Subagent Lock**: Daily journals are **read-only** to subagents. Only the main parent agent appends to journals.

```bash
bun <SKILL_DIR>/scripts/commands/journal.ts append \
  --summary "<1-2 sentence description of completed task, decision, or discovery>" \
  [--projects "<optional comma-separated names, e.g. wmap,crescendo>"] \
  [--people "<optional comma-separated names, e.g. mohamad-elmoussawi,feng-feng>"]
```

### 🌉 Handoff Bridge: Journal Append $\implies$ Immediate Subagent Dispatch
Whenever you append to the Daily Journal, you **must immediately launch a background Memory Subagent** using `invoke_subagent` (see Section 3 for the invariant launch template). Execute both the journal append and subagent launch in the same turn—do not separate them. This decouples real-time conversation response from multi-file entity synthesis.

---

## 3. Tier 2: Entity Briefings (Autonomous Subagent Reconciliation)

Curated briefings for active collaborators (`briefings/people/<name>.md`) and initiatives (`briefings/projects/<name>.md`).

### A. Subagent Operating Contract & Bounds
The background subagent runs asynchronously to inspect transcripts and journals, deciding autonomously which entity briefings to create or update while adhering to strict structural limits:

1. **Strict File Budget & Content Invariants**:
   * **Collaborator Briefings (`briefings/people/<name>.md`)**: Max 1 section (`## Key Facts`) with strictly **3–5 bounded bullets** across 3 pillars:
     1. *Domain & Ownership*: systems, repos, services, or technical areas owned.
     2. *Working Habits*: communication habits, review style, async vs. meeting bias.
     3. *Personal Anchors*: hobbies, background, interests, rapport anchors.
     *(Total file length must not exceed ~25 lines).*
   * **Project Briefings (`briefings/projects/<name>.md`)**: Max 2 sections:
     1. `## Objectives`: **2–4 fixed scope goals & deliverables**.
     2. `## Key Facts`: **3–6 bounded bullets** across architecture, dependencies, permanent constraints, and roster.
     *(Total file length must not exceed ~35 lines).*
2. **Consolidate & Replace (Never Continuously Append)**:
   * Transient task progress belongs in daily journals.
   * When adding new durable facts, the subagent must synthesize, condense, or replace older lower-priority bullets to respect the bullet ceiling.
3. **Access Boundaries**:
   * `~/.memory/briefings/` $\rightarrow$ **Read / Write** (via CLI draft and save commands).
   * `~/.memory/journals/` $\rightarrow$ **Read-Only** (used as knowledge source).
   * `~/.memory/user.md` $\rightarrow$ **Read-Only** (subagent is strictly prohibited from modifying user profile).

### B. Universal Invariant Subagent Launch Template
The parent agent invokes the subagent using this invariant prompt (zero decision burden on parent):

```typescript
invoke_subagent({
  TypeName: "self",
  Role: "Memory Entity Reconciler",
  Prompt: `
Review the latest conversation transcript, recent journal entries, and existing entity briefings in ~/.memory/briefings/.
1. Autonomously identify which project or collaborator briefings need to be created, updated, or reconciled based on recent durable facts, decisions, or milestones.
2. Enforce strict bounded limits:
   - People (briefings/people/<name>.md): Exactly 3-5 bounded bullets in ## Key Facts (Domain, Habits, Anchors). Max ~25 lines.
   - Projects (briefings/projects/<name>.md): 2-4 ## Objectives and 3-6 ## Key Facts (Architecture, Constraints, Roster). Max ~35 lines.
   - Consolidate & replace older lower-priority facts rather than continuously appending.
3. Use the CLI commands to draft and save updates:
   bun <SKILL_DIR>/scripts/commands/people.ts draft --json '<payload>' && bun <SKILL_DIR>/scripts/commands/people.ts save --name '<name>'
   bun <SKILL_DIR>/scripts/commands/projects.ts draft --json '<payload>' && bun <SKILL_DIR>/scripts/commands/projects.ts save --name '<name>'
4. Do NOT modify ~/.memory/user.md or ~/.memory/journals/. Both are strictly READ-ONLY.
5. Exit silently when finished.
`
});
```

### C. Underlying Entity CLI Commands (Used by Subagent)

```bash
# Collaborator Briefings (Draft & Save)
bun <SKILL_DIR>/scripts/commands/people.ts draft --json '{
  "name": "<kebab-name>",
  "rationale": "<why updating>",
  "role": "<job title>",
  "team": "<team name>",
  "relationship": "<peer|manager|direct-report|cross-team|leadership|external>",
  "timezone": "<IANA-tz>",
  "key_facts": ["<Domain & Ownership>", "<Working Habits>", "<Personal Anchors>"]
}'
bun <SKILL_DIR>/scripts/commands/people.ts save --name "<kebab-name>"

# Project Briefings (Draft & Save)
bun <SKILL_DIR>/scripts/commands/projects.ts draft --json '{
  "name": "<kebab-name>",
  "rationale": "<why updating>",
  "status": "<active|planning|paused|completed>",
  "lead": "<kebab-name>",
  "objectives": ["<Goal 1>", "<Goal 2>"],
  "key_facts": ["<Architecture & Stacks>", "<Constraints & Dependencies>", "<Roster>"]
}'
bun <SKILL_DIR>/scripts/commands/projects.ts save --name "<kebab-name>"
```

---

## 4. Tier 3: User Profile & Operating Rules (Parent Agent Guarded)

Permanent user profile (`~/.memory/user.md`) storing core identity, preferences, and universal working rules.

* **Symlink Architecture**: `~/.memory/user.md` is the canonical ground truth, directly linked into workspaces via symbolic links (e.g., `.agents/AGENTS.md`, `CLAUDE.md`).
* **Trigger**: Update only upon explicit user directives, persistent working style adjustments, or permanent architecture invariants. Never mutate for transient task data.
* **Editing Protocol**: Edit `~/.memory/user.md` directly using native file editing tools.
* **Strict Confirmation Gate**: Always confirm proposed profile or rule modifications with the user in chat before applying edits, especially when inferring preferences rather than following explicit commands.
* **Subagent Barrier**: Subagents are strictly forbidden from editing `~/.memory/user.md`.
* **Substrate Invariant**: The `## Memory Substrate` section is an essential system anchor and must always be preserved.
