/**
 * Type definitions for the 3-tier memory system.
 */

export type BriefingKind = "people" | "projects";

export type PersonRelationship =
  | "manager"
  | "direct-report"
  | "peer"
  | "cross-team"
  | "leadership"
  | "external";

export const VALID_PERSON_RELATIONSHIPS: PersonRelationship[] = [
  "manager",
  "direct-report",
  "peer",
  "cross-team",
  "leadership",
  "external",
];

export interface PersonFrontmatter {
  name: string;
  role?: string;
  team?: string;
  relationship?: PersonRelationship;
  timezone?: string;
  last_modified?: string;
  _rationale?: string;
  _drafted_at?: string;
  [key: string]: unknown;
}

export interface PersonDraftPayload {
  name: string;
  role?: string;
  team?: string;
  relationship?: PersonRelationship;
  timezone?: string;
  key_facts?: string[];
  keyFacts?: string[];
  facts?: string[];
  rationale: string;
}

export type ProjectStatus =
  | "active"
  | "planning"
  | "paused"
  | "completed";

export const VALID_PROJECT_STATUSES: ProjectStatus[] = [
  "active",
  "planning",
  "paused",
  "completed",
];

export interface ProjectFrontmatter {
  name: string;
  status?: ProjectStatus;
  lead?: string;
  last_modified?: string;
  _rationale?: string;
  _drafted_at?: string;
  [key: string]: unknown;
}

export interface ProjectDraftPayload {
  name: string;
  status?: ProjectStatus;
  lead?: string;
  objectives?: string[];
  key_facts?: string[];
  keyFacts?: string[];
  facts?: string[];
  rationale: string;
}

export type EntityFrontmatter = PersonFrontmatter | ProjectFrontmatter;

export interface ParsedMarkdownFile<T = Record<string, unknown>> {
  frontmatterRaw: string;
  frontmatter: T;
  body: string;
}

export interface JournalEntry {
  time?: string;
  summary: string;
  projects?: string[];
  people?: string[];
}

export interface UserFrontmatter {
  id?: string;
  name?: string;
  role?: string;
  team?: string;
  email?: string;
  github?: string;
  timezone?: string;
  last_modified?: string;
  _rationale?: string;
  _drafted_at?: string;
  [key: string]: unknown;
}

export interface UserDraftPayload {
  id?: string;
  name?: string;
  role?: string;
  team?: string;
  email?: string;
  github?: string;
  timezone?: string;
  preferences?: string[];
  rules?: string[];
  rationale: string;
}
