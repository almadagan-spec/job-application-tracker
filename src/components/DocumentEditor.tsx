import { useMemo, useState } from 'react'
import { diffWords } from 'diff'
import EditableBlock from './EditableBlock'
import { parseResumeMarkup, stringifyResume, type ParsedResume, type ResumeBlock } from '../lib/resumeFormat'
import './DocumentEditor.css'

interface DocumentEditorProps {
  docType: 'resume' | 'cover'
  companyName: string
  initialText: string
  originalResumeText: string | null
  onClose: () => void
  onSave: (newText: string) => Promise<void>
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function wordSet(s: string): Set<string> {
  return new Set(s.toLowerCase().match(/[a-z0-9']+/g) ?? [])
}

// Jaccard similarity (shared words / all distinct words across both) -- a
// cheap score for picking which original line a new block most likely grew
// out of. Deliberately not "shared / smaller set", which would let a tiny
// original line (e.g. a 2-word line) "perfectly" match almost any block
// that happens to contain those same 2 words, hijacking the match.
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  const union = a.size + b.size - shared
  return shared / union
}

// Finds the original resume line this block most likely grew out of, so the
// diff compares two short, related strings -- not this one small block
// against the entire multi-paragraph original document (which would make
// almost the whole original show up as "removed" on every single block).
function findBestMatch(blockText: string, originalLines: string[]): string | null {
  const blockWords = wordSet(blockText)
  let best: { line: string; score: number } | null = null
  for (const line of originalLines) {
    const score = similarity(blockWords, wordSet(line))
    if (!best || score > best.score) best = { line, score }
  }
  return best && best.score > 0.15 ? best.line : null
}

// Track-changes style: words only in the AI's new version are green
// (added), words only in the matched original line are shown struck
// through in red (removed), and the rest is plain text -- same idea as
// Word's Track Changes, so both the before and after are visible together.
function trackChangesHtml(blockText: string, originalLines: string[]): string {
  const matchLine = findBestMatch(blockText, originalLines)
  if (!matchLine) return `<span class="jat-diff-added">${escapeHtml(blockText)}</span>`
  const parts = diffWords(matchLine, blockText)
  return parts
    .map((p) => {
      const escaped = escapeHtml(p.value)
      if (p.added) return `<span class="jat-diff-added">${escaped}</span>`
      if (p.removed) return `<span class="jat-diff-removed">${escaped}</span>`
      return escaped
    })
    .join('')
}

type BlockKey = string

export default function DocumentEditor({
  docType,
  companyName,
  initialText,
  originalResumeText,
  onClose,
  onSave,
}: DocumentEditorProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [coverText, setCoverText] = useState(initialText)
  const [parsed, setParsed] = useState<ParsedResume>(() => parseResumeMarkup(initialText))
  // Body blocks (bullets/plain lines) start as a read-only track-changes
  // view; clicking one "reveals" a plain editable field for it, so the
  // colored diff markup and live typing never have to mix in the same box.
  const [revealed, setRevealed] = useState<Set<BlockKey>>(new Set())

  const originalLines = useMemo(
    () =>
      (originalResumeText ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    [originalResumeText],
  )

  const coverHtml = useMemo(
    () => (docType === 'cover' ? escapeHtml(initialText) : ''),
    // Intentionally computed once from the value the screen opened with.
    [docType, initialText],
  )

  function updateBlock(column: 'sidebar' | 'main', index: number, text: string) {
    setParsed((prev) => {
      const next = { ...prev, [column]: [...prev[column]] }
      next[column][index] = { ...next[column][index], text }
      return next
    })
  }

  function reveal(key: BlockKey) {
    setRevealed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
  }

  function blockClass(type: ResumeBlock['type']): string {
    if (type === 'header') return 'jat-doc-header'
    if (type === 'entry') return 'jat-doc-entry'
    if (type === 'bullet') return 'jat-doc-bullet'
    return 'jat-doc-plain'
  }

  function renderResumeBlock(column: 'sidebar' | 'main', block: ResumeBlock, i: number) {
    const key = `${column}:${i}`
    const className = blockClass(block.type)

    // Headers and entry titles are structural labels (section names,
    // job/degree titles) -- always plainly editable, never diff-marked.
    if (block.type === 'header' || block.type === 'entry') {
      return (
        <EditableBlock
          key={key}
          initialHtml={escapeHtml(block.text)}
          onChange={(text) => updateBlock(column, i, text)}
          className={className}
        />
      )
    }

    if (!revealed.has(key)) {
      return (
        <div
          key={key}
          className={`${className} jat-doc-clickable`}
          tabIndex={0}
          role="button"
          onClick={() => reveal(key)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') reveal(key)
          }}
          dangerouslySetInnerHTML={{ __html: trackChangesHtml(block.text, originalLines) }}
        />
      )
    }

    return (
      <EditableBlock
        key={key}
        autoFocus
        initialHtml={escapeHtml(block.text)}
        onChange={(text) => updateBlock(column, i, text)}
        className={className}
      />
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const text = docType === 'cover' ? coverText : stringifyResume(parsed)
      await onSave(text)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="jat-editor-overlay">
      <div className="jat-editor-shell">
        <header className="jat-editor-header">
          <div>
            <h2>{docType === 'resume' ? 'Resume' : 'Cover letter'} — {companyName}</h2>
            {docType === 'resume' && (
              <p className="jat-editor-hint">
                <span className="jat-diff-swatch jat-diff-swatch-added" /> added
                <span className="jat-diff-swatch jat-diff-swatch-removed" /> removed from your original — click any text to edit it
              </p>
            )}
          </div>
          <div className="jat-editor-actions">
            <button className="jat-btn jat-btn-secondary" onClick={onClose} disabled={saving}>
              Back
            </button>
            <button className="jat-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save and return'}
            </button>
          </div>
        </header>

        {error && <p className="jat-error jat-editor-error">{error}</p>}

        <div className="jat-editor-body">
          {docType === 'cover' ? (
            <div className="jat-doc-page jat-doc-cover">
              <EditableBlock initialHtml={coverHtml} onChange={setCoverText} className="jat-doc-cover-text" />
            </div>
          ) : (
            <div className="jat-doc-page">
              <div className="jat-doc-banner">
                <EditableBlock
                  initialHtml={escapeHtml(parsed.name)}
                  onChange={(text) => setParsed((prev) => ({ ...prev, name: text }))}
                  className="jat-doc-name"
                />
                <EditableBlock
                  initialHtml={escapeHtml(parsed.title)}
                  onChange={(text) => setParsed((prev) => ({ ...prev, title: text }))}
                  className="jat-doc-role"
                />
              </div>
              <div className="jat-doc-columns">
                <div className="jat-doc-sidebar">
                  {parsed.sidebar.map((block, i) => renderResumeBlock('sidebar', block, i))}
                </div>
                <div className="jat-doc-main">{parsed.main.map((block, i) => renderResumeBlock('main', block, i))}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
