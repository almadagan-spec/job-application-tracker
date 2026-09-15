import { useState } from 'react'
import Modal from './Modal'

interface AddCompanyModalProps {
  onClose: () => void
  onAdd: (companyName: string) => Promise<void>
}

export default function AddCompanyModal({ onClose, onAdd }: AddCompanyModalProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!name.trim()) {
      setError('Please enter a company name.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onAdd(name.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the company. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Add a company" onClose={onClose}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
        Type the company's name. We'll check that it's a real company before adding
        it to your table.
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Figma"
        autoFocus
      />
      {error && <p className="jat-error">{error}</p>}
      <button className="jat-btn" onClick={handleAdd} disabled={submitting}>
        {submitting ? 'Checking…' : 'Add company'}
      </button>
    </Modal>
  )
}
