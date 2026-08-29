import type { ParsedMarkdownFile } from "./types";

/**
 * Splits a markdown document into raw frontmatter, parsed frontmatter object, and markdown body.
 */
export function parseMarkdownFile<T = Record<string, unknown>>(content: string): ParsedMarkdownFile<T> {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    return {
      frontmatterRaw: "",
      frontmatter: {} as T,
      body: normalized.trim(),
    };
  }

  const frontmatterRaw = match[1].trim();
  const body = match[2].trim();
  const frontmatter = parseSimpleYaml(frontmatterRaw) as T;

  return {
    frontmatterRaw,
    frontmatter,
    body,
  };
}

/**
 * Serializes frontmatter and body back to standard markdown format.
 */
export function formatMarkdownFile(frontmatter: Record<string, unknown>, body: string): string {
  const yaml = stringifySimpleYaml(frontmatter);
  const cleanBody = body.trim();
  if (!yaml) {
    return cleanBody ? `${cleanBody}\n` : "";
  }
  return `---\n${yaml}\n---\n\n${cleanBody}\n`;
}

/**
 * Lightweight, zero-dependency YAML parser for typical frontmatter keys.
 */
export function parseSimpleYaml(yamlStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yamlStr.split("\n");

  let currentKey = "";
  let currentArray: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    // List item for multiline array
    if (line.startsWith("- ") && currentKey) {
      const val = line.slice(2).trim();
      if (!currentArray) {
        currentArray = [];
        result[currentKey] = currentArray;
      }
      currentArray.push(parseYamlValue(val) as string);
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      continue;
    }

    currentKey = line.slice(0, colonIdx).trim();
    const rawVal = line.slice(colonIdx + 1).trim();

    if (!rawVal) {
      // Could be start of multiline array
      currentArray = [];
      result[currentKey] = currentArray;
    } else {
      currentArray = null;
      result[currentKey] = parseYamlValue(rawVal);
    }
  }

  return result;
}

function parseYamlValue(val: string): unknown {
  if (val.startsWith("[") && val.endsWith("]")) {
    const inner = val.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => {
      const trimmed = item.trim();
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    });
  }

  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }

  if (val === "true") return true;
  if (val === "false") return false;
  if (val === "null" || val === "~") return null;

  if (!isNaN(Number(val)) && val !== "") {
    return Number(val);
  }

  return val;
}

/**
 * Lightweight, zero-dependency YAML stringifier for typical frontmatter keys.
 */
export function stringifySimpleYaml(obj: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else if (value.every((v) => typeof v === "string" && !v.includes("\n") && !v.includes(","))) {
        lines.push(`${key}: [${value.join(", ")}]`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${String(item)}`);
        }
      }
    } else if (typeof value === "object") {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else if (typeof value === "string") {
      if (value.includes("\n") || value.includes(":") || value.includes("#") || value.startsWith("[")) {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }

  return lines.join("\n");
}
