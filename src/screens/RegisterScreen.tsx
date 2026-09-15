import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import './RegisterScreen.css'

export default function RegisterScreen() {
  const { sendCode, configured } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!fullName.trim() || !email.trim()) {
      setError('Please fill in your name and email.')
      return
    }
    setSubmitting(true)
    try {
      await sendCode(fullName.trim(), email.trim(), rememberMe)
      navigate('/verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="jat-auth-page">
      <form className="jat-auth-card" onSubmit={handleSubmit}>
        <h1>Job Application Tracker</h1>
        <p className="jat-auth-subtitle">Create your account to get started.</p>

        {!configured && (
          <p className="jat-config-warning">
            This app isn't connected to its account system yet, so you can look around
            but registering won't actually work until that's set up.
          </p>
        )}

        <label className="jat-field">
          <span>Full name</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alma Dagan"
            autoComplete="name"
          />
        </label>

        <label className="jat-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label className="jat-checkbox-row">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <span>Remember me</span>
        </label>

        {error && <p className="jat-error">{error}</p>}

        <button type="submit" className="jat-btn jat-auth-submit" disabled={submitting}>
          {submitting ? 'Sending code…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
