import { useEffect, useRef, type CSSProperties } from 'react'

interface EditableBlockProps {
  initialHtml: string
  onChange: (plainText: string) => void
  className?: string
  style?: CSSProperties
  placeholder?: string
  autoFocus?: boolean
}

// A contentEditable region that's seeded with HTML once (so it can show
// diff-highlighting on load) and then left alone by React -- writing to it
// on every keystroke would fight the user's cursor. Plain text is read back
// out via onInput.
export default function EditableBlock({ initialHtml, onChange, className, style, placeholder, autoFocus }: EditableBlockProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = initialHtml || ''
    if (autoFocus) ref.current.focus()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerText)}
    />
  )
}
