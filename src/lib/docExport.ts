import { Document, HeadingLevel, Packer, Paragraph } from 'docx'

// Turns "## Section" / "- bullet" style plain text into real Word headings
// and bullet points, so a resume keeps its section structure instead of
// becoming one flat block of text. Plain lines (cover letters, the name/
// contact line at the top of a resume) render as normal paragraphs.
function renderBody(text: string): Paragraph[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith('## ')) {
        return new Paragraph({
          text: line.slice(3).trim(),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 80 },
        })
      }
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return new Paragraph({ text: line.slice(2).trim(), bullet: { level: 0 } })
      }
      return new Paragraph(line)
    })
}

// Turns AI-written text into a downloadable .docx file, entirely in the
// browser -- no server involved.
export async function downloadAsWord(title: string, text: string, fileName: string) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { after: 160 } }),
          ...renderBody(text),
        ],
      },
    ],
  })

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
