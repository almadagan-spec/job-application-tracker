// Writes a tailored version of the user's resume and a cover letter -- using
// Claude. Doesn't invent anything: it's told to only re-emphasize and
// reorder facts already present in the user's real resume, never to add new
// claims or qualifications.
//
// Needs one secret set on the Supabase project: ANTHROPIC_API_KEY
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const MODEL = 'claude-sonnet-5'

interface RequestBody {
  companyName: string
  desiredRole: string
  resumeText: string
  about?: string
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
      max_tokens: 4000,
      thinking: { type: 'disabled' },
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Claude API failed (${res.status}): ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
  return textBlock?.text ?? ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as RequestBody
    const { companyName, desiredRole, resumeText, about } = body
    if (!companyName) {
      return jsonResponse({ error: 'companyName is required' }, 400)
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return jsonResponse({ error: 'AI writing is not configured yet (missing Anthropic API key).' }, 500)
    }

    const resumeAndCoverSystem = `You help a real job seeker tailor their real resume and write a cover letter for a specific company and role.
Absolute rules:
- Never invent facts, employers, dates, degrees, or skills that are not already in the resume text you're given.
- You may reorder, re-emphasize, and rephrase existing true details to highlight what's most relevant to this company and role (e.g. move a relevant school or project higher, emphasize a relevant skill).
- Keep it truthful and natural, in the candidate's voice.

Resume formatting -- keep the SAME section structure as the candidate's original resume (same section names, same order, e.g. Experience / Education / Skills):
- The candidate's name and contact line: plain text, no prefix.
- Each section header on its own line, prefixed with "## " (e.g. "## Experience").
- Each bullet point (job duties, skills, etc.) on its own line, prefixed with "- ".
- No other markdown -- no asterisks, no numbered lists.

Cover letter formatting: normal prose, 3-4 short paragraphs separated by a blank line, no headers or bullets.`

    const userMessage = `Candidate's desired role: ${desiredRole || 'not specified'}
Company they're applying to: ${companyName}
${about ? `About the company: ${about}\n` : ''}
Candidate's current resume (verbatim, including its section headers and structure):
"""
${resumeText || '(no resume text available)'}
"""

Produce two things, each separated by the exact line "=====":
1. The candidate's resume, rewritten to emphasize the qualities and experience most relevant to this company and role, using the formatting rules above -- same facts and same overall section structure as the original, re-emphasized and re-ordered within each section, nothing invented.
2. A cover letter (3-4 short paragraphs) for this company and role, based only on the resume above.`

    const combined = await callClaude(apiKey, resumeAndCoverSystem, userMessage)
    const [newResume, coverLetter] = combined.split('=====').map((s) => s.trim())

    return jsonResponse({
      newResume: newResume || combined.trim(),
      coverLetter: coverLetter || '',
    })
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
