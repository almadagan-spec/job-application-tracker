// Shared parsing for the lightweight resume markup the AI writes
// (%%NAME%%, %%TITLE%%, %%SIDEBAR%%/%%MAIN%%, "## " headers, "### " entry
// titles, "- " bullets). Used by both the Word export and the in-app
// preview/edit screen, so they always agree on structure.

export type ResumeBlockType = 'header' | 'entry' | 'bullet' | 'plain'

export interface ResumeBlock {
  type: ResumeBlockType
  text: string
}

export interface ParsedResume {
  name: string
  title: string
  sidebar: ResumeBlock[]
  main: ResumeBlock[]
}

function parseLine(line: string): ResumeBlock {
  if (line.startsWith('## ')) return { type: 'header', text: line.slice(3).trim() }
  if (line.startsWith('### ')) return { type: 'entry', text: line.slice(4).trim() }
  if (line.startsWith('- ') || line.startsWith('• ')) return { type: 'bullet', text: line.slice(2).trim() }
  return { type: 'plain', text: line }
}

export function parseResumeMarkup(text: string): ParsedResume {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  let name = ''
  let title = ''
  const sidebar: ResumeBlock[] = []
  const main: ResumeBlock[] = []
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
      sidebar.push(parseLine(line))
    } else if (target === 'main' || target === null) {
      main.push(parseLine(line))
    }
  }

  return { name, title, sidebar, main }
}

function blockToLine(block: ResumeBlock): string {
  if (block.type === 'header') return `## ${block.text}`
  if (block.type === 'entry') return `### ${block.text}`
  if (block.type === 'bullet') return `- ${block.text}`
  return block.text
}

// The inverse of parseResumeMarkup -- turns edited blocks back into the
// %% markup text stored in the database.
export function stringifyResume(parsed: ParsedResume): string {
  return [
    `%%NAME%% ${parsed.name}`,
    `%%TITLE%% ${parsed.title}`,
    '%%SIDEBAR%%',
    ...parsed.sidebar.map(blockToLine),
    '%%MAIN%%',
    ...parsed.main.map(blockToLine),
  ].join('\n')
}
