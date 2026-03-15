import fs from "fs";
import path from "path";

// ============================================================
// Attachment Parser
// Detects file paths in user input (drag-and-drop), classifies
// them as images or documents, and returns clean labels.
// ============================================================

export interface Attachment {
  /** Display label: [Image1], [Document1], etc. */
  label: string;
  /** Original absolute path */
  originalPath: string;
  /** Resolved absolute path (quotes/escapes removed) */
  resolvedPath: string;
  /** File type category */
  type: "image" | "document";
  /** File extension */
  ext: string;
  /** File name */
  fileName: string;
}

export interface ParsedInput {
  /** The description text with file paths replaced by labels */
  description: string;
  /** Extracted attachments */
  attachments: Attachment[];
}

const IMAGE_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".tiff", ".avif",
]);

const DOCUMENT_EXTS = new Set([
  ".pdf", ".doc", ".docx", ".txt", ".md", ".csv", ".xls", ".xlsx",
  ".ppt", ".pptx", ".rtf", ".html", ".json", ".yaml", ".yml",
  ".xml", ".figma", ".sketch", ".xd",
]);

// Matches file paths: absolute paths, quoted paths, or escaped-space paths
// Examples: /Users/foo/bar.png, "/Users/foo/bar.png", /Users/foo/bar\ baz.png
const PATH_PATTERN = /(?:"([^"]+\.[\w]+)")|(?:'([^']+\.[\w]+)')|(?:((?:\/|[A-Z]:\\)(?:[^\s,;]|\\[ ])+\.[\w]+))/g;

/**
 * Parse user input to extract file paths and replace them with clean labels.
 * Handles drag-and-drop paths from terminal (absolute paths, quoted, escaped spaces).
 */
export function parseAttachments(input: string): ParsedInput {
  const attachments: Attachment[] = [];
  let imageCount = 0;
  let docCount = 0;

  let cleaned = input.replace(PATH_PATTERN, (match, quoted, singleQuoted, raw) => {
    const filePath = (quoted || singleQuoted || raw || "").replace(/\\ /g, " ").trim();

    if (!filePath) return match;

    // Resolve the path
    const resolved = path.resolve(filePath);

    // Check if the file actually exists
    if (!fs.existsSync(resolved)) return match;

    const ext = path.extname(resolved).toLowerCase();
    const fileName = path.basename(resolved);

    let type: "image" | "document";
    let label: string;

    if (IMAGE_EXTS.has(ext)) {
      imageCount++;
      type = "image";
      label = `[Image${imageCount}]`;
    } else if (DOCUMENT_EXTS.has(ext)) {
      docCount++;
      type = "document";
      label = `[Document${docCount}]`;
    } else {
      // Treat unknown file types as documents
      docCount++;
      type = "document";
      label = `[Document${docCount}]`;
    }

    attachments.push({
      label,
      originalPath: match,
      resolvedPath: resolved,
      type,
      ext,
      fileName,
    });

    return label;
  });

  // Clean up extra whitespace from removed paths
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return { description: cleaned, attachments };
}

/**
 * Copy attachments to .forge/attachments/ so workers can access them.
 * Returns the list of copied paths.
 */
export function stageAttachments(attachments: Attachment[]): string[] {
  if (attachments.length === 0) return [];

  const attachDir = path.join(process.cwd(), ".forge", "attachments");
  fs.mkdirSync(attachDir, { recursive: true });

  const stagedPaths: string[] = [];

  for (const att of attachments) {
    // Use label-based filename to keep it clean: image1.png, document1.pdf
    const stagedName = att.label.replace(/[\[\]]/g, "").toLowerCase() + att.ext;
    const dest = path.join(attachDir, stagedName);

    try {
      fs.copyFileSync(att.resolvedPath, dest);
      stagedPaths.push(dest);
    } catch {
      // If copy fails (permissions, etc.), skip silently
    }
  }

  return stagedPaths;
}

/**
 * Format attachments for display in the terminal.
 */
export function formatAttachmentList(attachments: Attachment[]): string {
  if (attachments.length === 0) return "";

  return attachments
    .map((a) => `    ${a.label} ${a.fileName}`)
    .join("\n");
}

/**
 * Build an attachment context block for the orchestrator/worker prompt.
 */
export function buildAttachmentPrompt(attachments: Attachment[]): string {
  if (attachments.length === 0) return "";

  const lines = attachments.map((a) => {
    const relPath = path.relative(process.cwd(), a.resolvedPath);
    if (a.type === "image") {
      return `- ${a.label}: Image file at ${relPath} — read this file to see the visual reference`;
    }
    return `- ${a.label}: Document at ${relPath} — read this file for requirements/specs`;
  });

  return `
ATTACHMENTS (provided by the user):
${lines.join("\n")}

Use these attachments as reference material. For images, match the visual style/layout.
For documents, extract requirements and specifications from them.
`;
}
