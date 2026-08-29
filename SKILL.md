---
name: memory
description: 3-Tier Markdown Memory System for persistent user profiles, entity briefings (people & projects), and episodic chronological logs.
allowed-tools:
  - Bash
  - Read
  - Write
sample-prompts:
  - 'What do you remember about the user and their preferences?'
  - 'What did we work on earlier today or this week?'
  - 'List all active project briefings and their current bottlenecks'
  - 'Read the briefing for Alex Morgan'
  - 'Update the status of Project Halo Tiger Team to in-review'
  - 'Record a new briefing for our manager Vinod'
---

# Unified 3-Tier Markdown Memory System

Cognitive persistence system structured across three functional tiers.

---

## 1. Mental Model

Memory is organized across three distinct functional tiers:

1. **Identity (`user.md`):** Permanent user profile, communication preferences, and core working rules.
2. **Daily Journals (`journals/`):** Chronological activity logbook (`YYYY/MM/DD.md`) recording daily milestones, session progress, and key decisions.
3. **Entity Briefings (`briefings/`):** Curated briefings for core active collaborators (`people/`) and initiatives (`projects/`).

---

## 2. Discover

All memory files reside under `~/.memory/` as standard Markdown files with YAML frontmatter:

```
~/.memory/
├── user.md                         # Permanent identity & working rules
├── journals/YYYY/MM/DD.md          # Chronological daily logbooks
├── briefings/
│   ├── people/<name>.md            # People briefings
│   └── projects/<name>.md          # Project briefings
├── drafts/                         # Staging pool for uncommitted drafts
└── backups/                        # Automatic rolling historical snapshots
```

### Discovery Paths

1. **Entity Index Cards**
   Scan summary cards across all tracked people or projects and active drafts without reading individual files:
   ```bash
   bun <SKILL_DIR>/scripts/commands/people.ts index
   bun <SKILL_DIR>/scripts/commands/project.ts index
   ```

2. **Native Traversal and Search**
   * **List files and folders**: Use directory listing or glob tools across `~/.memory/` to discover logs, briefings, or staged drafts.
   * **Full-text search**: Use grep or text-search tools across `~/.memory/` to locate topics and references across all memory files.

3. **System Health and Diagnostics**
   Run the diagnostic check before heavy operations or when verifying system scaffolding:
   ```bash
   bun <SKILL_DIR>/scripts/commands/status.ts
   ```

---

## 3. Read

Read discovered memory files directly using native file-reading tools without CLI overhead:

* **Identity & Rules**: `~/.memory/user.md`
* **Daily Activity Logs**: `~/.memory/journals/YYYY/MM/DD.md`
* **Entity Briefings**: `~/.memory/briefings/<people|projects>/<name>.md`
* **Staged Drafts**: `~/.memory/drafts/**/*.md`

---

## 4. Write

### 4.1 Daily Journals

Chronological activity logbook (`journals/YYYY/MM/DD.md`) recording daily progress, milestones, and decisions.

1. **When to Record**: Log an entry immediately upon completing a task, reaching a project milestone, or making a key decision.

2. **Append-Only Protocol**: All entries are appended atomically to today's log file; past entries are never modified or overwritten.

3. **Tagging & Decoupling**: Tagging people or project identifiers does not require pre-existing briefings. When a tagged entity becomes recurring or high-value, promote it to a dedicated briefing in 4.2.

```bash
# Append chronological progress entry
bun <SKILL_DIR>/scripts/commands/journal.ts append \
  --summary "<1-2 sentence description of completed task, decision, or discovery>" \
  --projects "<optional comma-separated names, e.g. crescendo,payment-service>" \
  --people "<optional comma-separated names, e.g. feng-feng,sarah-chen>"
```

---

### 4.2 Entity Briefings (People & Projects)

Curated briefings for collaborators (`briefings/people/<name>.md`) and active initiatives (`briefings/projects/<name>.md`).

1. **When to Track**: Create or update a briefing when a person or project mentioned in daily journals becomes recurring, high-value, or is explicitly introduced by the user.

2. **Two-Phase Ceremony**: Stage changes with `draft --json '<PAYLOAD>'` and commit them with `save --name "<name>"`. Save immediately in the same turn for routine updates, or pause after drafting to confirm with the user when making major or uncertain changes.
   * **2.1 Unified Command**: The `draft` command handles both creating new briefings and updating existing ones automatically.
   * **2.2 Targeted Updates**: Only specify the fields you want to modify; unmentioned fields are kept as-is.

3. **Payload Guidelines**: `name` (kebab-case identifier) and `rationale` are strictly required for every mutation. Keep body arrays (`key_facts`, `objectives`) bounded to durable context, because transient progress and meeting notes belong in daily journals.

```bash
# A. People Briefings (Stage & Commit)
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
bun <SKILL_DIR>/scripts/commands/people.ts save --name "<kebab-name>"

# B. Project Briefings (Stage & Commit)
bun <SKILL_DIR>/scripts/commands/project.ts draft --json '{
  "name": "<kebab-name>",                  # Required: matches filename (e.g. crescendo)
  "rationale": "<why updating>",           # Required: explicit justification
  "status": "<status>",                    # Optional: active | planning | paused | completed
  "lead": "<kebab-name>",                  # Optional: primary lead (e.g. feng-feng)
  "objectives": [                          # Optional: 2-4 fixed scope goals & deliverables:
    "<Core goal or primary deliverable 1>",
    "<Core goal or primary deliverable 2>"
  ],
  "key_facts": [                           # Optional: durable architecture & constraints:
    "<Core repository, service architecture, tech stacks>",
    "<Active branch, system dependencies, permanent technical constraints>"
  ]
}'
bun <SKILL_DIR>/scripts/commands/project.ts save --name "<kebab-name>"
```

---

### 4.3 User Profile

Permanent user profile (`user.md`) storing core identity, communication style preferences, and universal working rules.

1. **When to Update**: Update strictly on explicit user directives, persistent communication corrections, or permanent architecture rules. Never mutate for transient task data.

2. **Two-Phase Ceremony**: Stage changes with `draft --json '<PAYLOAD>'` and commit them with `save`. Save immediately in the same turn for direct user instructions, or pause after drafting to confirm with the user when inferring preferences. Only specify fields you want to modify; unmentioned fields are kept as-is.

3. **Payload Guidelines**: `rationale` is strictly required for every mutation. Keep body arrays (`preferences`, `rules`) bounded to durable context (3–5 items each) to prevent profile bloat.

```bash
# Stage user profile update & Commit
bun <SKILL_DIR>/scripts/commands/user.ts draft --json '{
  "rationale": "<why updating>",           # Required: explicit justification
  "id": "<user-id>",                       # Optional: e.g. y0x01z6
  "name": "<display name>",                # Optional: e.g. Xunzhao
  "role": "<job title>",                   # Optional: e.g. Lead AI Engineer
  "team": "<team name>",                   # Optional: e.g. GPA / Squiggly
  "email": "<email>",                      # Optional: e.g. xunzhao.yin@walmart.com
  "github": "<github url or handle>",      # Optional: e.g. https://gecgithub01.walmart.com/y0x01z6
  "timezone": "<IANA-tz>",                 # Optional: e.g. America/Chicago
  "preferences": [                         # Optional: 3-5 bounded communication preferences:
    "<Communication style, tone, format, and density expectations>"
  ],
  "rules": [                               # Optional: 3-5 bounded working rules:
    "<Permanent operating principles, safety gates, architectural invariants>"
  ]
}'
bun <SKILL_DIR>/scripts/commands/user.ts save
```
