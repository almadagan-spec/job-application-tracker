import { Document, HeadingLevel, Packer, Paragraph } from 'docx'

// Turns plain text (one or more paragraphs, separated by blank lines) into a
// downloadable .docx file, entirely in the browser -- no server involved.
export async function downloadAsWord(title: string, text: string, fileName: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) => block.split('\n').map((line) => new Paragraph(line)))

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
          ...paragraphs,
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
