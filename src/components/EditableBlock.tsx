import { useEffect, useRef, type CSSProperties } from 'react'

interface EditableBlockProps {
  initialHtml: string
  onChange: (plainText: string) => void
  className?: string
  style?: CSSProperties
  placeholder?: string
}

// A contentEditable region that's seeded with HTML once (so it can show the
// red diff-highlighting on load) and then left alone by React -- writing to
// it on every keystroke would fight the user's cursor and the highlighting
// with it. Plain text is read back out via onInput.
export default function EditableBlock({ initialHtml, onChange, className, style, placeholder }: EditableBlockProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml || ''
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
