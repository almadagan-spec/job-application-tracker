import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

const FONT = 'Calibri'
const ACCENT = '2F6FED'
const TEXT_COLOR = '1F2430'
const SIDEBAR_BG = 'F2F4F8'
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
}

// Fixed widths in twips (1/1440 inch), not percentages -- some Word
// readers (Pages included) mis-render percentage-width table columns as
// nearly zero width, wrapping every line one letter at a time.
const PAGE_MARGIN = 620 // ~0.43in -- tight but still printable
const PAGE_WIDTH = 12240 // US Letter
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const SIDEBAR_WIDTH = Math.round(CONTENT_WIDTH * 0.33)
const MAIN_WIDTH = CONTENT_WIDTH - SIDEBAR_WIDTH

// A size scale that keeps real proportions -- name is clearly biggest,
// section headers next, entry titles smaller still, body text smallest --
// while staying tight enough for a one-page resume. Sizes are in half-points.
const SIZE = { name: 30, roleUnderName: 18, sectionHeader: 21, entryTitle: 18, body: 17 }

function docStyles() {
  return {
    default: {
      document: { run: { font: FONT, size: SIZE.body, color: TEXT_COLOR } },
    },
  }
}

// Turns "## Section" / "### Entry" / "- bullet" style plain text into real
// Word paragraphs, keeping the original's blue section headers and the
// relative size differences between a section header, an entry title
// (a job/degree), and body text.
function renderLine(line: string): Paragraph {
  if (line.startsWith('## ')) {
    return new Paragraph({
      spacing: { before: 140, after: 40 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D5DBE8', space: 2 } },
      children: [
        new TextRun({ text: line.slice(3).trim(), bold: true, size: SIZE.sectionHeader, color: ACCENT, font: FONT }),
      ],
    })
  }
  if (line.startsWith('### ')) {
    return new Paragraph({
      spacing: { before: 90, after: 10 },
      children: [new TextRun({ text: line.slice(4).trim(), bold: true, size: SIZE.entryTitle, color: TEXT_COLOR, font: FONT })],
    })
  }
  if (line.startsWith('- ') || line.startsWith('• ')) {
    return new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 10 },
      children: [new TextRun({ text: line.slice(2).trim(), size: SIZE.body, color: TEXT_COLOR, font: FONT })],
    })
  }
  return new Paragraph({
    spacing: { after: 20 },
    children: [new TextRun({ text: line, size: SIZE.body, color: TEXT_COLOR, font: FONT })],
  })
}

// Turns AI-written prose into a plain downloadable .docx file (used for the
// cover letter, which is naturally addressed to the company -- no need to
// hide that here).
export async function downloadAsWord(title: string, text: string, fileName: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) =>
      block
        .split('\n')
        .map((line) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: line, size: SIZE.body, font: FONT })] })),
    )

  const doc = new Document({
    styles: docStyles(),
    sections: [
      {
        children: [
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: title, bold: true, size: SIZE.sectionHeader, color: ACCENT, font: FONT })],
          }),
          ...paragraphs,
        ],
      },
    ],
  })

  await saveDocx(doc, fileName)
}

interface ParsedResume {
  name: string
  title: string
  sidebar: string[]
  main: string[]
}

function parseResume(text: string): ParsedResume {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  let name = ''
  let title = ''
  const sidebar: string[] = []
  const main: string[] = []
  let target: 'sidebar' | 'main' | null = null

  for (const line of lines) {
    if (line.startsWith('%%NAME%%')) {
      name = line.slice(8).trim()
    } else if (line.startsWith('%%TITLE%%')) {
      title = line.slice(9).trim()
    } else if (line.startsWith('%%SIDEBAR%%')) {
      target = 'sidebar'
    } else if (line.startsWith('%%MAIN%%')) {
      target = 'main'
    } else if (target === 'sidebar') {
      sidebar.push(line)
    } else if (target === 'main' || target === null) {
      main.push(line)
    }
  }

  return { name, title, sidebar, main }
}

// Builds the tailored resume as a two-column .docx (a colored header banner,
// a narrower sidebar for contact/education/skills, and a wider main column
// for the profile and work history) -- deliberately without the company's
// name anywhere in it, so the file itself doesn't reveal it was tailored.
export async function downloadResumeAsWord(text: string, fileName: string) {
  const parsed = parseResume(text)
  const hasColumns = parsed.sidebar.length > 0 && parsed.main.length > 0

  const children: (Table | Paragraph)[] = []

  if (parsed.name) {
    children.push(
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [CONTENT_WIDTH],
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                shading: { fill: ACCENT },
                margins: { top: 160, bottom: 160, left: 200, right: 200 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [new TextRun({ text: parsed.name, bold: true, size: SIZE.name, color: 'FFFFFF', font: FONT })],
                  }),
                  ...(parsed.title
                    ? [
                        new Paragraph({
                          alignment: AlignmentType.LEFT,
                          children: [new TextRun({ text: parsed.title, size: SIZE.roleUnderName, color: 'FFFFFF', font: FONT })],
                        }),
                      ]
                    : []),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: '', spacing: { after: 60 } }),
    )
  }

  if (hasColumns) {
    children.push(
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [SIDEBAR_WIDTH, MAIN_WIDTH],
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: SIDEBAR_WIDTH, type: WidthType.DXA },
                shading: { fill: SIDEBAR_BG },
                margins: { top: 140, bottom: 140, left: 160, right: 160 },
                children: parsed.sidebar.map(renderLine),
              }),
              new TableCell({
                width: { size: MAIN_WIDTH, type: WidthType.DXA },
                margins: { top: 140, bottom: 140, left: 180, right: 100 },
                children: parsed.main.map(renderLine),
              }),
            ],
          }),
        ],
      }),
    )
  } else {
    // The AI didn't tag sidebar/main sections -- fall back to one column
    // rather than showing a blank document.
    const flat = parsed.main.length > 0 ? parsed.main : text.split('\n').map((l) => l.trim()).filter(Boolean)
    children.push(...flat.map(renderLine))
  }

  const doc = new Document({
    styles: docStyles(),
    sections: [
      {
        properties: {
          page: { margin: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN } },
        },
        children,
      },
    ],
  })
  await saveDocx(doc, fileName)
}

async function saveDocx(doc: Document, fileName: string) {
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
