---
name: memory
description: >-
  Ambient cognitive persistence system. Proactively and autonomously record daily
  activity log entries, stage collaborator/project briefings, and update user profile
  rules at agent discretion upon completing tasks, reaching milestones, making key
  decisions, or discovering durable facts—without waiting for explicit user directives.
allowed-tools:
  - Bash
  - Read
  - Write
---

# Unified 3-Tier Memory Persistence System

This skill provides the cognitive persistence engine, safety contracts, and CLI interfaces for mutating the 3-tier memory store in `~/.memory/`.

---

## 1. Persistence Protocols

Memory persistence follows two strict safety patterns:

1. **Daily Journals (Append-Only):** Direct atomic append to `~/.memory/journals/YYYY/MM/DD.md`. Past entries are never modified.
2. **Entity Briefings & User Profile (Two-Phase Ceremony):**
   * **Stage (`draft`):** Generates/patches a draft payload in `~/.memory/drafts/`.
   * **Commit (`save`):** Persists the staged draft into live memory (`~/.memory/briefings/` or `~/.memory/user.md`) with an automatic rolling historical snapshot in `~/.memory/backups/`.
   * **Confirmation Gate:** Pause after drafting and confirm with the user before saving whenever proposing major revisions, destructive overwrites, or high-uncertainty inferences across profile and entity briefings.

---

## 2. Daily Journals

Chronological logbook recording daily milestones, task completions, and key decisions.

* **Trigger**: Proactively log an entry upon completing a non-trivial task, solving a tough bug, or establishing a project decision.
* **Silent Execution**: Append entries as background tool calls. Do not mention, quote, or acknowledge journal logging in your text response—focus your response entirely on the user's task.
* **Tagging**: Tag collaborator or project identifiers freely (e.g., `people: alex-morgan`, `projects: crescendo`). They do not require pre-existing briefings.

```bash
bun <SKILL_DIR>/scripts/commands/journal.ts append \
  --summary "<1-2 sentence description of completed task, decision, or discovery>" \
  [--projects "<optional comma-separated names, e.g. crescendo,payment-service>"] \
  [--people "<optional comma-separated names, e.g. feng-feng,sarah-chen>"]
```

---

## 3. Entity Briefings (People & Projects)

Curated briefings for active collaborators (`briefings/people/<name>.md`) and initiatives (`briefings/projects/<name>.md`).

* **Trigger**: Create or update a briefing when an entity mentioned in daily journals becomes recurring, high-value, or is explicitly introduced.
* **Payload Guidelines**: `name` (kebab-case) and `rationale` are required. Keep body arrays bounded to durable context (transient progress belongs in daily journals). Specify only fields being added or modified; unmentioned fields are preserved.

### A. Collaborator Briefings (`briefings/people/<name>.md`)

```bash
# Stage changes
bun <SKILL_DIR>/scripts/commands/people.ts draft --json '{
  "name": "<kebab-name>",                  # Required: matches filename (e.g. alex-morgan)
  "rationale": "<why updating>",           # Required: explicit justification
  "role": "<job title>",                   # Optional: e.g. Staff Security Engineer
  "team": "<team name>",                   # Optional: e.g. Cloud Security
  "relationship": "<relationship>",        # Optional: manager | direct-report | peer | cross-team | leadership | external
  "timezone": "<IANA-tz>",                 # Optional: e.g. America/Los_Angeles
  "key_facts": [                           # Optional: 3-5 bounded bullets across 3 pillars:
    "<Domain & Ownership: systems, repos, services, or technical areas owned>",
    "<Working Preferences: communication habits, review style, async vs. meeting bias>",
    "<Personal Anchors: hobbies, background, interests, rapport anchors>"
  ]
}'

# Commit to live memory
bun <SKILL_DIR>/scripts/commands/people.ts save --name "<kebab-name>"
```

### B. Project Briefings (`briefings/projects/<name>.md`)

```bash
# Stage changes
bun <SKILL_DIR>/scripts/commands/project.ts draft --json '{
  "name": "<kebab-name>",                  # Required: matches filename (e.g. crescendo)
  "rationale": "<why updating>",           # Required: explicit justification
  "status": "<status>",                    # Optional: active | planning | paused | completed
  "lead": "<kebab-name>",                  # Optional: primary lead (e.g. feng-feng)
  "objectives": [                          # Optional: 2-4 fixed scope goals & deliverables:
    "<Core goal or primary deliverable 1>",
    "<Core goal or primary deliverable 2>"
  ],
  "key_facts": [                           # Optional: 3-6 bounded bullets across architecture, constraints, & roster:
    "<Core repository, service architecture, tech stacks>",
    "<Active branch, system dependencies, permanent technical constraints>"
  ]
}'

# Commit to live memory
bun <SKILL_DIR>/scripts/commands/project.ts save --name "<kebab-name>"
```

---

## 4. User Profile & Operating Rules

Permanent user profile (`~/.memory/user.md`) storing core identity, preferences, and universal working rules.

* **Symlink Architecture**: `~/.memory/user.md` is the canonical ground truth, directly linked into workspaces via symbolic links (e.g., `.agents/AGENTS.md`, `CLAUDE.md`).
* **Trigger**: Update only upon explicit user directives, persistent working style adjustments, or permanent architecture invariants. Never mutate for transient task data.
* **Editing Protocol**: Edit `~/.memory/user.md` directly using native file editing tools.
* **Confirmation Gate**: Always confirm proposed profile or rule modifications with the user before applying edits, especially when inferring preferences rather than following explicit commands.
* **Substrate Invariant**: Keep entries bounded to high-signal context while respecting existing document formatting. The `## Memory Substrate` section is an essential system anchor and must always be preserved.

