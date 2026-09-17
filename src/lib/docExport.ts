import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

const ACCENT = '2F6FED'
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

// Turns "## Section" / "- bullet" style plain text into real Word headings
// and bullet points.
function renderLine(line: string): Paragraph {
  if (line.startsWith('## ')) {
    return new Paragraph({
      text: line.slice(3).trim(),
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 80 },
    })
  }
  if (line.startsWith('### ')) {
    return new Paragraph({
      children: [new TextRun({ text: line.slice(4).trim(), bold: true })],
      spacing: { before: 140, after: 20 },
    })
  }
  if (line.startsWith('- ') || line.startsWith('• ')) {
    return new Paragraph({ text: line.slice(2).trim(), bullet: { level: 0 }, spacing: { after: 40 } })
  }
  return new Paragraph({ text: line, spacing: { after: 40 } })
}

// Turns AI-written prose into a plain downloadable .docx file (used for the
// cover letter, which is naturally addressed to the company -- no need to
// hide that here).
export async function downloadAsWord(title: string, text: string, fileName: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) => block.split('\n').map((line) => new Paragraph(line)))

  const doc = new Document({
    sections: [
      {
        children: [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { after: 160 } }), ...paragraphs],
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
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { fill: ACCENT },
                margins: { top: 240, bottom: 240, left: 240, right: 240 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [new TextRun({ text: parsed.name, bold: true, size: 36, color: 'FFFFFF' })],
                  }),
                  ...(parsed.title
                    ? [
                        new Paragraph({
                          alignment: AlignmentType.LEFT,
                          children: [new TextRun({ text: parsed.title, size: 22, color: 'FFFFFF' })],
                        }),
                      ]
                    : []),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: '', spacing: { after: 120 } }),
    )
  }

  if (hasColumns) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 33, type: WidthType.PERCENTAGE },
                shading: { fill: SIDEBAR_BG },
                margins: { top: 200, bottom: 200, left: 200, right: 200 },
                children: parsed.sidebar.map(renderLine),
              }),
              new TableCell({
                width: { size: 67, type: WidthType.PERCENTAGE },
                margins: { top: 200, bottom: 200, left: 240, right: 120 },
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

  const doc = new Document({ sections: [{ children }] })
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
