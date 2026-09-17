import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../AuthContext'
import {
  deleteApplication,
  fetchApplications,
  fetchProfile,
  insertCompanyRow,
  needsVerification,
  renameCompanyRow,
  runVerificationAndGeneration,
  updateDesiredRole,
  updateNotes,
  updateStatus,
  uploadResume,
} from '../lib/api'
import type { Application, ApplicationStatus, Profile } from '../types'
import DesiredRoleModal from '../components/DesiredRoleModal'
import AddCompanyModal from '../components/AddCompanyModal'
import StatusDropdown from '../components/StatusDropdown'
import { downloadAsWord } from '../lib/docExport'
import './DashboardScreen.css'

export default function DashboardScreen() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showRoleModal, setShowRoleModal] = useState(false)
  const [showCompanyModal, setShowCompanyModal] = useState(false)

  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  useEffect(() => {
    if (!user) return
    Promise.all([fetchProfile(user.id), fetchApplications(user.id)])
      .then(([p, apps]) => {
        setProfile(p)
        setApplications(apps)
        // Rows that never got a result (e.g. the page closed mid-check) retry themselves here.
        apps.filter(needsVerification).forEach((app) => {
          startVerification(app, p?.desired_role ?? null, p?.resume_text ?? null)
        })
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load your data.'))
      .finally(() => setLoading(false))
  }, [user])

  function markVerifying(id: string, on: boolean) {
    setVerifyingIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function startVerification(app: Application, desiredRole: string | null, resumeText: string | null) {
    markVerifying(app.id, true)
    runVerificationAndGeneration(app, desiredRole, resumeText)
      .then((updated) => {
        setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      })
      .catch((err) => {
        setApplications((prev) =>
          prev.map((a) =>
            a.id === app.id
              ? { ...a, verification_note: err instanceof Error ? err.message : 'Something went wrong.' }
              : a,
          ),
        )
      })
      .finally(() => markVerifying(app.id, false))
  }

  async function handleUploadClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChosen(file: File) {
    if (!user) return
    setUploading(true)
    setUploadError(null)
    try {
      const updated = await uploadResume(user.id, file)
      setProfile(updated)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload your resume.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSaveRole(role: string) {
    if (!user) return
    await updateDesiredRole(user.id, role)
    setProfile((prev) => (prev ? { ...prev, desired_role: role } : prev))
  }

  async function handleAddCompany(companyName: string) {
    if (!user) return
    const alreadyAdded = applications.some(
      (a) => a.company_name.trim().toLowerCase() === companyName.trim().toLowerCase(),
    )
    if (alreadyAdded) {
      throw new Error("You've already added that company.")
    }
    const row = await insertCompanyRow(user.id, companyName)
    setApplications((prev) => [row, ...prev])
    startVerification(row, profile?.desired_role ?? null, profile?.resume_text ?? null)
  }

  async function handleRetry(application: Application) {
    if (!editingName.trim()) return
    const renamed = await renameCompanyRow(application, editingName.trim())
    setApplications((prev) => prev.map((a) => (a.id === renamed.id ? renamed : a)))
    setEditingId(null)
    startVerification(renamed, profile?.desired_role ?? null, profile?.resume_text ?? null)
  }

  async function handleDelete(applicationId: string) {
    if (!window.confirm('Remove this company from your list?')) return
    await deleteApplication(applicationId)
    setApplications((prev) => prev.filter((a) => a.id !== applicationId))
  }

  async function handleStatusChange(applicationId: string, status: ApplicationStatus) {
    setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status } : a)))
    await updateStatus(applicationId, status)
  }

  function handleNotesEdit(applicationId: string, notes: string) {
    setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, notes } : a)))
  }

  async function handleNotesSave(applicationId: string, notes: string) {
    await updateNotes(applicationId, notes)
  }

  if (loading) {
    return <div className="jat-page-center">Loading…</div>
  }

  return (
    <div className="jat-dashboard">
      <header className="jat-dashboard-header">
        <div>
          <h1>Job Application Tracker</h1>
          {profile && <p className="jat-header-sub">Hi {profile.full_name || profile.email}</p>}
        </div>
        <button className="jat-btn jat-btn-secondary" onClick={signOut}>
          Sign out
        </button>
      </header>

      {loadError && <p className="jat-error">{loadError}</p>}

      <div className="jat-toolbar">
        <div className="jat-toolbar-item">
          <button className="jat-btn" onClick={handleUploadClick} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload resume'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileChosen(file)
              e.target.value = ''
            }}
          />
          {profile?.resume_file_path && (
            <span className="jat-toolbar-note">✓ {profile.resume_file_path.split('/').pop()}</span>
          )}
          {uploadError && <span className="jat-toolbar-note jat-error">{uploadError}</span>}
        </div>

        <div className="jat-toolbar-item">
          <button className="jat-btn" onClick={() => setShowRoleModal(true)}>
            Desired role
          </button>
          {profile?.desired_role && <span className="jat-toolbar-note">"{profile.desired_role}"</span>}
        </div>

        <div className="jat-toolbar-item">
          <button className="jat-btn" onClick={() => setShowCompanyModal(true)}>
            + Add a company
          </button>
        </div>
      </div>

      <div className="jat-table-wrap">
        <table className="jat-table">
          <thead>
            <tr>
              <th>Company name</th>
              <th>About</th>
              <th>New resume</th>
              <th>Cover letter</th>
              <th>Notes</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 && (
              <tr>
                <td colSpan={7} className="jat-empty-row">
                  No companies yet — click "+ Add a company" to get started.
                </td>
              </tr>
            )}
            {applications.map((app) => {
              const failed = !app.linkedin_verified && Boolean(app.verification_note)
              const verifying = verifyingIds.has(app.id)
              return (
                <tr key={app.id}>
                  <td className={failed ? 'jat-cell-failed' : undefined}>
                    {editingId === app.id ? (
                      <div className="jat-inline-edit">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                        />
                        <button className="jat-btn" onClick={() => handleRetry(app)}>
                          Retry
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className={failed ? 'jat-cell-failed-headline' : 'jat-company-name'}>
                          {app.company_name}
                        </div>
                        {verifying && <div className="jat-toolbar-note">Checking company…</div>}
                        {failed && (
                          <>
                            <div className="jat-cell-failed-message">{app.verification_note}</div>
                            <button
                              className="jat-link-btn"
                              onClick={() =>
                                startVerification(app, profile?.desired_role ?? null, profile?.resume_text ?? null)
                              }
                            >
                              Retry
                            </button>
                            {' · '}
                            <button
                              className="jat-link-btn"
                              onClick={() => {
                                setEditingId(app.id)
                                setEditingName(app.company_name)
                              }}
                            >
                              Edit company name
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    <div className="jat-cell-text">{app.about || (verifying ? '…' : '—')}</div>
                  </td>
                  <td>
                    <div className="jat-cell-text">{app.new_resume ? truncate(app.new_resume) : verifying ? '…' : '—'}</div>
                    {app.new_resume && (
                      <button
                        className="jat-link-btn"
                        onClick={() => downloadAsWord(`Resume — ${app.company_name}`, app.new_resume!, `resume-${slug(app.company_name)}`)}
                      >
                        Download
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="jat-cell-text">{app.cover_letter ? truncate(app.cover_letter) : verifying ? '…' : '—'}</div>
                    {app.cover_letter && (
                      <button
                        className="jat-link-btn"
                        onClick={() =>
                          downloadAsWord(`Cover letter — ${app.company_name}`, app.cover_letter!, `cover-letter-${slug(app.company_name)}`)
                        }
                      >
                        Download
                      </button>
                    )}
                  </td>
                  <td>
                    <textarea
                      className="jat-notes-input"
                      value={app.notes ?? ''}
                      placeholder="Add a note…"
                      onChange={(e) => handleNotesEdit(app.id, e.target.value)}
                      onBlur={(e) => handleNotesSave(app.id, e.target.value)}
                    />
                  </td>
                  <td>
                    <StatusDropdown
                      value={app.status}
                      disabled={!app.linkedin_verified}
                      onChange={(status) => handleStatusChange(app.id, status)}
                    />
                  </td>
                  <td>
                    <button
                      className="jat-delete-btn"
                      onClick={() => handleDelete(app.id)}
                      aria-label={`Remove ${app.company_name}`}
                      title="Remove"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showRoleModal && (
        <DesiredRoleModal
          initialValue={profile?.desired_role ?? ''}
          onClose={() => setShowRoleModal(false)}
          onSave={handleSaveRole}
        />
      )}

      {showCompanyModal && (
        <AddCompanyModal onClose={() => setShowCompanyModal(false)} onAdd={handleAddCompany} />
      )}
    </div>
  )
}

function truncate(text: string, max = 120): string {
  const clean = text
    .split('\n')
    .map((line) => line.trim().replace(/^##\s+/, '').replace(/^[-•]\s+/, '• '))
    .join(' ')
    .trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
