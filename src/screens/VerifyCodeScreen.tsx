import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import './RegisterScreen.css'

const CODE_LENGTH = 6

export default function VerifyCodeScreen() {
  const { verifyCode, pendingEmail, sendCode } = useAuth()
  const navigate = useNavigate()
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  if (!pendingEmail) {
    return <Navigate to="/register" replace />
  }

  function handleChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\D/g, '').slice(-1)
    setDigits((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
    if (value && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  async function handleSubmit() {
    const code = digits.join('')
    if (code.length !== CODE_LENGTH) {
      setError('Please enter the full 6-digit code.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await verifyCode(code)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code didn’t work. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (!pendingEmail) return
    setError(null)
    try {
      await sendCode('', pendingEmail, true)
      setResent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.')
    }
  }

  return (
    <div className="jat-auth-page">
      <div className="jat-auth-card">
        <h1>Check your email</h1>
        <p className="jat-auth-subtitle">
          We sent a 6-digit code to <strong>{pendingEmail}</strong>. Enter it below.
        </p>

        <div className="jat-code-boxes">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>

        {error && <p className="jat-error">{error}</p>}
        {resent && !error && <p style={{ fontSize: 13, color: '#16a34a', margin: 0 }}>New code sent.</p>}

        <button className="jat-btn jat-auth-submit" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Checking…' : 'Continue'}
        </button>

        <button className="jat-link-btn" onClick={handleResend} type="button">
          Resend code
        </button>
      </div>
    </div>
  )
}
