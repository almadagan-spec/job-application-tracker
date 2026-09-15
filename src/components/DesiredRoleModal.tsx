import { useState } from 'react'
import Modal from './Modal'

interface DesiredRoleModalProps {
  initialValue: string
  onClose: () => void
  onSave: (value: string) => Promise<void>
}

export default function DesiredRoleModal({ initialValue, onClose, onSave }: DesiredRoleModalProps) {
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!value.trim()) {
      setError('Please describe the kind of job you want.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(value.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Desired role" onClose={onClose}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
        Describe, in your own words, the kind of job you're looking for. e.g. "product
        manager", "head of engineering", "analyst or junior product manager".
      </p>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. senior product manager, ideally at a design-focused company"
      />
      {error && <p className="jat-error">{error}</p>}
      <button className="jat-btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </Modal>
  )
}
