// Writes the company summary, a tailored version of the user's resume, and a
// cover letter -- using Claude. Doesn't invent anything: it's told to only
// re-emphasize and reorder facts already present in the user's real resume,
// never to add new claims or qualifications.
//
// Needs one secret set on the Supabase project: ANTHROPIC_API_KEY
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const MODEL = 'claude-sonnet-5'

interface RequestBody {
  companyName: string
  desiredRole: string
  resumeText: string
  website?: string
  linkedinUrl?: string
}

async function callClaude(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Claude API failed (${res.status}): ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  const block = data.content?.[0]
  return block?.type === 'text' ? block.text : ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as RequestBody
    const { companyName, desiredRole, resumeText, website, linkedinUrl } = body
    if (!companyName) {
      return jsonResponse({ error: 'companyName is required' }, 400)
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return jsonResponse({ error: 'AI writing is not configured yet (missing Anthropic API key).' }, 500)
    }

    const about = await callClaude(
      apiKey,
      'You write short, factual company summaries for a job seeker’s tracking table. Two to three sentences, plain text, no markdown, no preamble.',
      `Company: ${companyName}${website ? `\nWebsite: ${website}` : ''}${linkedinUrl ? `\nLinkedIn: ${linkedinUrl}` : ''}\n\nWrite a short "what does this company do" summary based on what you know about it.`,
    )

    const resumeAndCoverSystem = `You help a real job seeker tailor their real resume and write a cover letter for a specific company and role.
Absolute rules:
- Never invent facts, employers, dates, degrees, or skills that are not already in the resume text you're given.
- You may reorder, re-emphasize, and rephrase existing true details to highlight what's most relevant to this company and role (e.g. move a relevant school or project higher, emphasize a relevant skill).
- Keep it truthful and natural, in the candidate's voice.
- Output plain text only, no markdown formatting, no headings with #, no asterisks.`

    const userMessage = `Candidate's desired role: ${desiredRole || 'not specified'}
Company they're applying to: ${companyName}
${website ? `Company website: ${website}\n` : ''}${linkedinUrl ? `Company LinkedIn: ${linkedinUrl}\n` : ''}
Candidate's current resume (verbatim):
"""
${resumeText || '(no resume text available)'}
"""

Produce two things, each separated by the exact line "=====":
1. The candidate's resume, rewritten to emphasize the qualities and experience most relevant to this company and role -- same facts, re-emphasized and re-ordered, nothing invented.
2. A cover letter (3-4 short paragraphs) for this company and role, based only on the resume above.`

    const combined = await callClaude(apiKey, resumeAndCoverSystem, userMessage)
    const [newResume, coverLetter] = combined.split('=====').map((s) => s.trim())

    return jsonResponse({
      about: about.trim(),
      newResume: newResume || combined.trim(),
      coverLetter: coverLetter || '',
    })
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
