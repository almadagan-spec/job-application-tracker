import type { ReactNode } from 'react'
import './Modal.css'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export default function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="jat-modal-backdrop" onClick={onClose}>
      <div className="jat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jat-modal-header">
          <h2>{title}</h2>
          <button className="jat-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
