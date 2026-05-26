import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  type IParagraphOptions,
} from "docx";

function slugifyFilename(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "project-brief";
}

function parseInlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushPlain = (chunk: string) => {
    if (chunk) runs.push(new TextRun({ text: chunk }));
  };

  while ((match = pattern.exec(text)) !== null) {
    pushPlain(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      runs.push(new TextRun({ text: token.slice(2, -2), bold: true }));
    } else if (token.startsWith("*")) {
      runs.push(new TextRun({ text: token.slice(1, -1), italics: true }));
    } else if (token.startsWith("`")) {
      runs.push(new TextRun({ text: token.slice(1, -1), font: "Consolas" }));
    }
    lastIndex = match.index + token.length;
  }

  pushPlain(text.slice(lastIndex));
  return runs.length ? runs : [new TextRun({ text })];
}

function paragraphFromText(text: string, options?: IParagraphOptions): Paragraph {
  return new Paragraph({
    ...options,
    children: parseInlineRuns(text),
  });
}

function markdownToDocxBlocks(source: string): Paragraph[] {
  const normalized = String(source || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [paragraphFromText("No brief content available.")];
  }

  const lines = normalized.split("\n");
  const blocks: Paragraph[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        new Paragraph({
          children: [
            new TextRun({
              text: codeLines.join("\n") || " ",
              font: "Consolas",
            }),
          ],
          spacing: { after: 200 },
        }),
      );
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      const text = trimmed.replace(/^#+\s+/, "");
      blocks.push(
        paragraphFromText(text, {
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        }),
      );
      index += 1;
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      const text = trimmed.replace(/^##\s+/, "");
      blocks.push(
        paragraphFromText(text, {
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        }),
      );
      index += 1;
      continue;
    }

    if (/^###\s+/.test(trimmed)) {
      const text = trimmed.replace(/^###\s+/, "");
      blocks.push(
        paragraphFromText(text, {
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 },
        }),
      );
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        const item = lines[index].trim().replace(/^[-*]\s+/, "");
        blocks.push(
          paragraphFromText(item, {
            bullet: { level: 0 },
            spacing: { after: 60 },
          }),
        );
        index += 1;
      }
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      let order = 1;
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        const item = lines[index].trim().replace(/^\d+\.\s+/, "");
        blocks.push(
          paragraphFromText(`${order}. ${item}`, {
            spacing: { after: 60 },
          }),
        );
        order += 1;
        index += 1;
      }
      continue;
    }

    const paragraphBuffer: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,3}\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !/^```/.test(lines[index].trim())
    ) {
      paragraphBuffer.push(lines[index].trim());
      index += 1;
    }

    const paragraph = paragraphBuffer.join(" ").trim();
    if (paragraph) {
      blocks.push(paragraphFromText(paragraph, { spacing: { after: 120 } }));
    }
  }

  return blocks;
}

export interface DownloadBriefDocxOptions {
  projectName: string;
  brief: string;
}

export async function downloadBriefDocx({
  projectName,
  brief,
}: DownloadBriefDocxOptions): Promise<void> {
  const title = projectName.trim() || "Project Brief";
  const generatedAt = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const doc = new Document({
    creator: "AI-Developer",
    title: `${title} — Project Brief`,
    description: "Project brief compiled by AI-Developer",
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 22,
          },
        },
      },
    },
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "AI-Developer",
                bold: true,
                size: 40,
                color: "4668E8",
              }),
            ],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Project Brief", size: 28, bold: true })],
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 26 })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Generated: ", color: "666666" }),
              new TextRun({ text: generatedAt, color: "666666" }),
            ],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Compiled by the AI-Developer project brief agent.",
                italics: true,
                color: "666666",
              }),
            ],
            spacing: { after: 280 },
          }),
          ...markdownToDocxBlocks(brief),
          new Paragraph({
            children: [
              new TextRun({
                text: "— End of brief —",
                italics: true,
                color: "888888",
              }),
            ],
            spacing: { before: 360 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `AI-Developer-${slugifyFilename(title)}-brief.docx`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
