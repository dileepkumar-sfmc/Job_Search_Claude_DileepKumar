import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  TabStopType,
  TabStopPosition,
} from 'docx';
import { saveAs } from 'file-saver';

/** Sanitize a string into a safe filename fragment. */
function slug(s: string): string {
  return (s || 'document')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

/**
 * Save a Blob — preferring the native "Save As" dialog (File System Access API,
 * which opens the OS file explorer) and falling back to a normal download.
 */
async function saveBlob(blob: Blob, filename: string, mime: string, ext: string) {
  const picker = (window as unknown as {
    showSaveFilePicker?: (opts: unknown) => Promise<{
      createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
  }).showSaveFilePicker;

  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: ext.toUpperCase() + ' file', accept: { [mime]: ['.' + ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Other failures (e.g. blocked in an iframe): fall through to download.
    }
  }

  saveAs(blob, filename);
}

const FONT = 'Calibri';
// Subtle navy accent for the name + section headings. Text-only coloring keeps
// the resume ATS-safe (parsers read the characters; the color is ignored).
const ACCENT = '1F3864';
const SECTION_HEADINGS = new Set([
  'professional summary',
  'summary',
  'technical skills',
  'skills',
  'professional experience',
  'work experience',
  'experience',
  'education',
  'certifications',
  'projects',
]);

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 90 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 2 } },
    children: [new TextRun({ text, bold: true, size: 24, font: FONT, color: ACCENT })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 21, font: FONT })],
  });
}

/** "Client: Company, Location | Dates" → bold left + right-aligned dates. */
function clientLine(value: string): Paragraph {
  const [left, right] = value.split('|').map((s) => s.trim());
  const children = [new TextRun({ text: `Client: ${left}`, bold: true, size: 22, font: FONT })];
  if (right) children.push(new TextRun({ text: `\t${right}`, bold: true, size: 22, font: FONT }));
  return new Paragraph({
    spacing: { before: 160, after: 20 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children,
  });
}

/** "Label: value" → bold label, normal (or italic) value. */
function labeledLine(label: string, value: string, italicValue = false): Paragraph {
  return new Paragraph({
    spacing: { after: 30 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 21, font: FONT }),
      new TextRun({ text: value, italics: italicValue, size: 21, font: FONT }),
    ],
  });
}

function plainLine(text: string, size = 21): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text, size, font: FONT })],
  });
}

/** Build a polished, ATS-friendly resume .docx from the structured plain text. */
function buildResumeDocx(text: string, title: string): Promise<Blob> {
  const lines = text.split('\n');
  const children: Paragraph[] = [];

  lines.forEach((raw, idx) => {
    const line = raw.trim();

    if (line === '') {
      children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
      return;
    }

    // Line 1 → name (centered, large)
    if (idx === 0) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [new TextRun({ text: line, bold: true, size: 34, font: FONT, color: ACCENT })],
        })
      );
      return;
    }

    // Line 2 → contact (centered, small grey) when it looks like a contact line
    if (idx <= 2 && line.includes('|') && !/^[A-Za-z][\w &/().+-]{0,30}:/.test(line)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: line.replace(/\s*\|\s*/g, '   |   '), size: 18, font: FONT, color: '555555' })],
        })
      );
      return;
    }

    // Section heading
    if (SECTION_HEADINGS.has(line.toLowerCase())) {
      children.push(sectionHeading(line));
      return;
    }

    // Bullet
    if (/^[-•*]\s+/.test(line)) {
      children.push(bullet(line.replace(/^[-•*]\s+/, '')));
      return;
    }

    // Labeled line ("Client:", "Role:", "Environment:", skill categories…)
    const m = line.match(/^([A-Za-z][\w &/().+-]{0,38}):\s*(.*)$/);
    if (m) {
      const [, label, value] = m;
      if (label === 'Client') children.push(clientLine(value));
      else if (label === 'Environment') children.push(labeledLine(label, value, true));
      else children.push(labeledLine(label, value));
      return;
    }

    // Everything else (summary statements, education, descriptions)
    children.push(plainLine(line));
  });

  const doc = new Document({
    creator: 'Job Search Copilot',
    title,
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

/** Build a simple prose .docx (cover letters, briefs). */
function buildPlainDocx(text: string, title: string): Promise<Blob> {
  const children = text.split('\n').map((line) => {
    const t = line.trimEnd();
    if (t === '') return new Paragraph({ spacing: { after: 80 }, children: [] });
    const heading = t.length <= 40 && t === t.toUpperCase() && /[A-Z]/.test(t);
    return new Paragraph({
      spacing: { after: heading ? 80 : 60, before: heading ? 160 : 0 },
      children: [new TextRun({ text: t, bold: heading, size: 22, font: FONT })],
    });
  });

  const doc = new Document({
    creator: 'Job Search Copilot',
    title,
    sections: [{ properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children }],
  });
  return Packer.toBlob(doc);
}

/** Download a document as .docx. `kind: 'resume'` uses the structured resume layout. */
export async function downloadDocx(content: string, baseName: string, kind: 'resume' | 'plain' = 'plain') {
  const blob = await (kind === 'resume' ? buildResumeDocx(content, baseName) : buildPlainDocx(content, baseName));
  await saveBlob(
    blob,
    `${slug(baseName)}.docx`,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'docx'
  );
}

/** Download a document as plain .txt. */
export async function downloadTxt(content: string, baseName: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  await saveBlob(blob, `${slug(baseName)}.txt`, 'text/plain', 'txt');
}
