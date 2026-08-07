import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Full-screen modal portaled to document.body so it stacks above the fixed header.
 */
export default function AppModal({
  open,
  onClose,
  children,
  panelClassName = '',
  panelStyle,
  closeOnBackdrop = true,
  'aria-labelledby': ariaLabelledBy,
}) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="modal-overlay"
      role="presentation"
      onClick={closeOnBackdrop && onClose ? () => onClose() : undefined}
    >
      <div
        className={`modal-panel ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        onClick={e => e.stopPropagation()}
        style={panelStyle}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
