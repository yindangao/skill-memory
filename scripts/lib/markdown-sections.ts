/**
 * Utility functions for parsing and mutating structured Markdown sections and bullet lists.
 */

/**
 * Replaces all bullets in a designated ## Section with a new list of items.
 */
export function replaceSection(body: string, sectionTitle: string, items: string[]): string {
  const cleanItems = items.map((i) => i.trim()).filter(Boolean);
  const formattedBullets = cleanItems
    .map((i) => (i.startsWith("- ") ? i : `- ${i}`))
    .join("\n");

  const sectionRegex = new RegExp(`(^|\\n)##\\s+${escapeRegex(sectionTitle)}\\s*\\n([\\s\\S]*?)(?=(\\n##\\s+|$))`, "i");
  const match = body.match(sectionRegex);

  if (cleanItems.length === 0) {
    if (match) {
      return body.replace(match[0], "").trim() + "\n";
    }
    return body;
  }

  if (match) {
    const prefix = match[1] === "\n" ? "\n" : "";
    const replacement = `${prefix}## ${sectionTitle}\n${formattedBullets}\n`;
    return body.replace(match[0], replacement);
  } else {
    const cleanBody = body.trimEnd();
    return cleanBody
      ? `${cleanBody}\n\n## ${sectionTitle}\n${formattedBullets}\n`
      : `## ${sectionTitle}\n${formattedBullets}\n`;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

