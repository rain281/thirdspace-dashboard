export interface ControlledWritePreview {
  path: string;
  title: string;
  summary: string;
  before: string;
  after: string;
  writeContent: string;
  diff: string;
  warnings: string[];
}

export interface ManagedSectionPreviewInput {
  path: string;
  title: string;
  section: string;
  marker: string;
  content: string;
  existingContent: string;
  warnings?: string[];
}

export interface FocusYamlPreviewInput {
  path: string;
  title: string;
  yaml: string;
  existingContent: string;
  warnings?: string[];
}

export interface OperationPreviewInput {
  path: string;
  title: string;
  summary: string;
  content: string;
  warnings?: string[];
}

const MARKER_PREFIX = "thirdspace-dashboard";

export function createManagedSectionPreview(input: ManagedSectionPreviewInput): ControlledWritePreview {
  const block = managedBlock(input.marker, input.content);
  const { after, created } = upsertManagedBlockInSection(input.existingContent, input.section, input.marker, block);
  return {
    path: input.path,
    title: input.title,
    summary: `${created ? "创建" : "更新"} ## ${input.section} 中的 Dashboard managed block`,
    before: input.existingContent,
    after,
    writeContent: block,
    diff: simpleLineDiff(input.existingContent, after),
    warnings: input.warnings ?? [],
  };
}

export function createFocusYamlPreview(input: FocusYamlPreviewInput): ControlledWritePreview {
  const after = normalizeTrailingNewline(input.yaml);
  return {
    path: input.path,
    title: input.title,
    summary: "写入结构化 YAML 状态文件",
    before: input.existingContent,
    after,
    writeContent: after,
    diff: simpleLineDiff(input.existingContent, after),
    warnings: input.warnings ?? [],
  };
}

export function createOperationPreview(input: OperationPreviewInput): ControlledWritePreview {
  const writeContent = normalizeTrailingNewline(input.content);
  return {
    path: input.path,
    title: input.title,
    summary: input.summary,
    before: "",
    after: writeContent,
    writeContent,
    diff: `+${input.summary}\n${writeContent.split("\n").filter(Boolean).map(line => `+${line}`).join("\n")}`,
    warnings: input.warnings ?? [],
  };
}

export function applyControlledWritePreview(preview: ControlledWritePreview, currentContent: string): string {
  if (currentContent === preview.after) return currentContent;
  if (currentContent === preview.before) return preview.after;
  return preview.after;
}

function upsertManagedBlockInSection(
  markdown: string,
  section: string,
  marker: string,
  block: string,
): { after: string; created: boolean } {
  const normalized = normalizeTrailingNewline(markdown);
  const bounds = findSectionBounds(normalized, section);
  if (!bounds) {
    return {
      after: appendSection(normalized, section, block),
      created: true,
    };
  }

  const beforeSection = normalized.slice(0, bounds.contentStart);
  const sectionContent = normalized.slice(bounds.contentStart, bounds.contentEnd);
  const afterSection = normalized.slice(bounds.contentEnd);
  const markerBounds = findManagedBlockBounds(sectionContent, marker);
  if (markerBounds) {
    return {
      after: [
        beforeSection,
        sectionContent.slice(0, markerBounds.start),
        block,
        sectionContent.slice(markerBounds.end),
        afterSection,
      ].join(""),
      created: false,
    };
  }

  const contentPrefix = sectionContent.trim().length > 0
    ? trimTrailingBlankLines(sectionContent) + "\n\n"
    : "";
  return {
    after: [beforeSection, contentPrefix, block, ensureLeadingNewline(afterSection)].join(""),
    created: false,
  };
}

function findSectionBounds(markdown: string, section: string): { contentStart: number; contentEnd: number } | null {
  const headingPattern = /^##\s+(.+?)\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(markdown))) {
    if (match[1].trim() !== section) continue;
    const contentStart = lineEndIndex(markdown, match.index);
    headingPattern.lastIndex = contentStart;
    const next = headingPattern.exec(markdown);
    return {
      contentStart,
      contentEnd: next?.index ?? markdown.length,
    };
  }
  return null;
}

function findManagedBlockBounds(markdown: string, marker: string): { start: number; end: number } | null {
  const startMarker = `<!-- ${MARKER_PREFIX}:start ${marker} -->`;
  const endMarker = `<!-- ${MARKER_PREFIX}:end ${marker} -->`;
  const start = markdown.indexOf(startMarker);
  if (start < 0) return null;
  const endMarkerStart = markdown.indexOf(endMarker, start + startMarker.length);
  if (endMarkerStart < 0) return null;
  const end = endMarkerStart + endMarker.length;
  return {
    start,
    end: markdown.slice(end, end + 1) === "\n" ? end + 1 : end,
  };
}

function managedBlock(marker: string, content: string): string {
  const body = content.trim();
  return [
    `<!-- ${MARKER_PREFIX}:start ${marker} -->`,
    body,
    `<!-- ${MARKER_PREFIX}:end ${marker} -->`,
    "",
  ].join("\n");
}

function appendSection(markdown: string, section: string, block: string): string {
  const base = trimTrailingBlankLines(markdown);
  return [base, "", `## ${section}`, "", block].filter((part, index) => index > 0 || part.length > 0).join("\n");
}

function lineEndIndex(text: string, index: number): number {
  const nextNewline = text.indexOf("\n", index);
  return nextNewline < 0 ? text.length : nextNewline + 1;
}

function ensureLeadingNewline(text: string): string {
  if (!text) return "";
  return text.startsWith("\n") ? text : `\n${text}`;
}

function normalizeTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function trimTrailingBlankLines(text: string): string {
  return text.replace(/\s+$/g, "");
}

function simpleLineDiff(before: string, after: string): string {
  if (before === after) return "";
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const prefixLength = commonPrefixLength(beforeLines, afterLines);
  const suffixLength = commonSuffixLength(beforeLines, afterLines, prefixLength);
  const removed = beforeLines.slice(prefixLength, beforeLines.length - suffixLength);
  const added = afterLines.slice(prefixLength, afterLines.length - suffixLength);
  return [
    ...removed.map(line => `-${line}`),
    ...added.map(line => `+${line}`),
  ].join("\n");
}

function commonPrefixLength(left: string[], right: string[]): number {
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) index++;
  return index;
}

function commonSuffixLength(left: string[], right: string[], prefixLength: number): number {
  let count = 0;
  while (
    count < left.length - prefixLength
    && count < right.length - prefixLength
    && left[left.length - 1 - count] === right[right.length - 1 - count]
  ) {
    count++;
  }
  return count;
}
