import type { ApplicationStatus } from '../types'
import { STATUS_COLORS, STATUS_LABELS } from '../types'

interface StatusDropdownProps {
  value: ApplicationStatus
  onChange: (value: ApplicationStatus) => void
  disabled?: boolean
}

const OPTIONS: ApplicationStatus[] = ['received', 'under_review', 'denied', 'interview']

export default function StatusDropdown({ value, onChange, disabled }: StatusDropdownProps) {
  const color = STATUS_COLORS[value]
  const isDark = value === 'interview'
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ApplicationStatus)}
      style={{
        background: color,
        color: isDark ? '#ffffff' : '#1f2430',
        border: 'none',
        borderRadius: 6,
        padding: '6px 8px',
        fontWeight: 600,
        fontSize: 12,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {OPTIONS.map((status) => (
        <option key={status} value={status}>
          {STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  )
}
