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

// Highlights the words in `text` that don't appear (in a compatible order)
// anywhere in `original` -- i.e. what the AI actually changed relative to
// the user's real uploaded resume.
function highlightChanges(text: string, original: string): string {
  if (!original.trim()) return escapeHtml(text)
  const parts = diffWords(original, text)
  return parts
    .filter((p) => !p.removed)
    .map((p) => (p.added ? `<span class="jat-diff-added">${escapeHtml(p.value)}</span>` : escapeHtml(p.value)))
    .join('')
}

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

  function renderBlockHtml(block: ResumeBlock): string {
    // Headers and entry titles are structural labels (section names, job/degree
    // titles) -- always keep their own color, never diff-mark them. Only the
    // actual body content (bullets, plain lines like the profile summary) gets
    // compared against the original.
    if (block.type === 'header' || block.type === 'entry') return escapeHtml(block.text)
    return highlightChanges(block.text, originalResumeText ?? '')
  }

  function blockClass(type: ResumeBlock['type']): string {
    if (type === 'header') return 'jat-doc-header'
    if (type === 'entry') return 'jat-doc-entry'
    if (type === 'bullet') return 'jat-doc-bullet'
    return 'jat-doc-plain'
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
                <span className="jat-diff-swatch" /> shows what was changed from your original resume. Click any text to edit it.
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
                  {parsed.sidebar.map((block, i) => (
                    <EditableBlock
                      key={i}
                      initialHtml={renderBlockHtml(block)}
                      onChange={(text) => updateBlock('sidebar', i, text)}
                      className={blockClass(block.type)}
                    />
                  ))}
                </div>
                <div className="jat-doc-main">
                  {parsed.main.map((block, i) => (
                    <EditableBlock
                      key={i}
                      initialHtml={renderBlockHtml(block)}
                      onChange={(text) => updateBlock('main', i, text)}
                      className={blockClass(block.type)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
