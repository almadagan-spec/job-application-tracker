import { supabase } from './supabaseClient'
import type { Application, ApplicationStatus, Profile } from '../types'

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  return supabase
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const sb = requireClient()
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export async function fetchApplications(userId: string): Promise<Application[]> {
  const sb = requireClient()
  const { data, error } = await sb
    .from('applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updateDesiredRole(userId: string, desiredRole: string): Promise<void> {
  const sb = requireClient()
  const { error } = await sb.from('profiles').update({ desired_role: desiredRole }).eq('id', userId)
  if (error) throw error
}

// Uploads the resume file to storage, then asks the "extract-resume" backend
// function to pull the plain text out of it (works for PDF and DOCX).
export async function uploadResume(userId: string, file: File): Promise<Profile> {
  const sb = requireClient()
  const extension = file.name.split('.').pop() ?? 'pdf'
  const path = `${userId}/resume.${extension}`

  const { error: uploadError } = await sb.storage
    .from('resumes')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const { data: fnData, error: fnError } = await sb.functions.invoke('extract-resume', {
    body: { path, contentType: file.type },
  })
  if (fnError) throw fnError

  const resumeText = (fnData as { resumeText?: string })?.resumeText ?? ''

  const { data, error } = await sb
    .from('profiles')
    .update({ resume_file_path: path, resume_text: resumeText })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// Adds the new row immediately (so the UI can show it right away); the
// actual Google/LinkedIn check and AI writing happen afterwards, in
// runVerificationAndGeneration, so the table doesn't freeze while that runs.
export async function insertCompanyRow(userId: string, companyName: string): Promise<Application> {
  const sb = requireClient()
  const { data, error } = await sb
    .from('applications')
    .insert({ user_id: userId, company_name: companyName })
    .select()
    .single()
  if (error) throw error
  return data
}

// Re-checks a company after the user edits the name on a row that failed verification.
export async function renameCompanyRow(application: Application, newCompanyName: string): Promise<Application> {
  const sb = requireClient()
  const { data, error } = await sb
    .from('applications')
    .update({ company_name: newCompanyName, verification_note: null })
    .eq('id', application.id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function runVerificationAndGeneration(
  application: Application,
  desiredRole: string | null,
  resumeText: string | null,
): Promise<Application> {
  const sb = requireClient()

  const { data: verifyData, error: verifyError } = await sb.functions.invoke('verify-company', {
    body: { companyName: application.company_name },
  })
  if (verifyError) throw verifyError

  const found = Boolean((verifyData as { found?: boolean })?.found)

  if (!found) {
    const { data, error } = await sb
      .from('applications')
      .update({
        linkedin_verified: false,
        verification_note: "didn't find the company you're looking for",
      })
      .eq('id', application.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const website = (verifyData as { website?: string })?.website ?? ''
  const linkedinUrl = (verifyData as { linkedinUrl?: string })?.linkedinUrl ?? ''

  const { data: genData, error: genError } = await sb.functions.invoke('generate-application', {
    body: {
      companyName: application.company_name,
      desiredRole: desiredRole ?? '',
      resumeText: resumeText ?? '',
      website,
      linkedinUrl,
    },
  })
  if (genError) throw genError

  const gen = genData as { about?: string; newResume?: string; coverLetter?: string }

  const { data, error } = await sb
    .from('applications')
    .update({
      linkedin_verified: true,
      verification_note: null,
      about: gen.about ?? '',
      new_resume: gen.newResume ?? '',
      cover_letter: gen.coverLetter ?? '',
    })
    .eq('id', application.id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStatus(applicationId: string, status: ApplicationStatus): Promise<void> {
  const sb = requireClient()
  const { error } = await sb.from('applications').update({ status }).eq('id', applicationId)
  if (error) throw error
}

export async function updateNotes(applicationId: string, notes: string): Promise<void> {
  const sb = requireClient()
  const { error } = await sb.from('applications').update({ notes }).eq('id', applicationId)
  if (error) throw error
}
