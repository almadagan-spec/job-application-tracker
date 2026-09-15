export type ApplicationStatus = 'received' | 'under_review' | 'denied' | 'interview'

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  received: 'Received',
  under_review: 'Upon examination',
  denied: 'Denied',
  interview: 'Waiting for interview',
}

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  received: '#9ca3af',
  under_review: '#f5c518',
  denied: '#ef4444',
  interview: '#22c55e',
}

export interface Profile {
  id: string
  full_name: string
  email: string
  desired_role: string | null
  resume_file_path: string | null
  resume_text: string | null
  created_at: string
}

export interface Application {
  id: string
  user_id: string
  company_name: string
  linkedin_verified: boolean
  verification_note: string | null
  about: string | null
  new_resume: string | null
  cover_letter: string | null
  notes: string | null
  status: ApplicationStatus
  created_at: string
}
