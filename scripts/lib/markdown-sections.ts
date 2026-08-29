/**
 * Utility functions for parsing and mutating structured Markdown sections and bullet lists.
 */

/**
 * Appends a bullet point to a designated ## Section in a markdown body.
 * If the section does not exist, it is created.
 */
export function appendToSection(body: string, sectionTitle: string, item: string): string {
  if (!item || !item.trim()) return body;

  const trimmedItem = item.trim();
  const formattedBullet = trimmedItem.startsWith("- ") ? trimmedItem : `- ${trimmedItem}`;

  const sectionRegex = new RegExp(`(^|\\n)##\\s+${escapeRegex(sectionTitle)}\\s*\\n([\\s\\S]*?)(?=(\\n##\\s+|$))`, "i");
  const match = body.match(sectionRegex);

  if (match) {
    const fullSection = match[0];
    const sectionContent = match[2].trimEnd();
    const updatedContent = sectionContent
      ? `${sectionContent}\n${formattedBullet}`
      : formattedBullet;

    const prefix = match[1] === "\n" ? "\n" : "";
    const replacement = `${prefix}## ${sectionTitle}\n${updatedContent}\n`;
    return body.replace(match[0], replacement);
  } else {
    // Section does not exist, append to the end
    const cleanBody = body.trimEnd();
    return cleanBody
      ? `${cleanBody}\n\n## ${sectionTitle}\n${formattedBullet}\n`
      : `## ${sectionTitle}\n${formattedBullet}\n`;
  }
}

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
    // If empty, remove section if present
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

/**
 * Updates top-level key-value bullets in a markdown file (e.g. - **Role:** Developer).
 */
export function updateTopKeyValues(body: string, updates: Record<string, string | undefined>): string {
  let result = body;

  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined || val === null || val === "") continue;

    const regex = new RegExp(`(^|\\n)-\\s*\\*\\*${escapeRegex(key)}:\\*\\*.*?(?=\\n|$)`, "i");
    if (regex.test(result)) {
      result = result.replace(regex, `$1- **${key}:** ${val.trim()}`);
    } else {
      // Find top # Header
      const headerMatch = result.match(/^#\s+.*?\n/);
      if (headerMatch) {
        const headerEnd = headerMatch[0];
        result = result.replace(headerEnd, `${headerEnd}\n- **${key}:** ${val.trim()}`);
      } else {
        result = `- **${key}:** ${val.trim()}\n` + result;
      }
    }
  }

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
