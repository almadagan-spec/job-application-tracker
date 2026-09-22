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
- Do this throughout the WHOLE resume, not just the profile/summary -- within each job's bullet points too: put the most relevant bullets first, and rephrase individual bullets to foreground the tools, skills, or outcomes most relevant to this role, while still describing the exact same real work. Don't leave the employment history untouched while only rewriting the summary -- if a job has bullets, actually re-emphasize and reorder them for this role too.
- Keep it truthful and natural, in the candidate's voice.
- The resume must NEVER mention the company name or say anything specific to this application (no "excited to join X") -- it should look like the candidate's normal resume, giving no sign it was tailored for anyone. Only the cover letter may reference the company.

Resume output format -- this exact lightweight markup, so it can be rendered as a proper two-column resume:
%%NAME%% <candidate's full name>
%%TITLE%% <candidate's professional title/role, e.g. "Product Manager">
%%SIDEBAR%%
<the compact/reference sections from the original resume, e.g. contact details, education, skills -- whatever the original puts in a quick-reference column>
%%MAIN%%
<the narrative sections, e.g. a short profile/summary and the work experience>

Within the SIDEBAR and MAIN parts, keep the SAME section names and order as the candidate's original resume, using:
- "## " for EVERY section header, with no exceptions -- every single section in both SIDEBAR and MAIN (Personal details, Education, Technical skills, Product skills, Profile, Employment, or whatever the original calls them) must start its line with "## ". A section header line must never appear without this prefix.
- "### " for an entry title within a section, e.g. a degree or job title (put its dates on the same line if the original does)
- a plain line right after an entry title for the institution/employer name
- "- " for each bullet point of detail under an entry
- plain lines for anything else (e.g. a contact detail, a skills list)
Do not use any other markdown (no asterisks, no numbered lists).

Worked example of the exact format (yours will have different content, but match this shape):
%%NAME%% Jane Doe
%%TITLE%% Product Manager
%%SIDEBAR%%
## Personal details
Jane Doe
jane@example.com
## Education
### BA Computer Science, 2018 - 2021
Some University
- Graduated with honors
%%MAIN%%
## Profile
Product manager with 3 years of experience...
## Employment
### Product Manager, 2021 - 2024
Acme Corp
- Led a team of 5 engineers
- Shipped feature X, increasing retention 20%

Cover letter formatting:
- First line: "Hello," on its own.
- Then 3-4 short paragraphs of normal prose, separated by a blank line, no headers or bullets, no %% markup.
- Last two lines: "Best regards," then the candidate's full name on the line after it.`

    const userMessage = `Candidate's desired role: ${desiredRole || 'not specified'}
Company they're applying to: ${companyName}
${about ? `About the company: ${about}\n` : ''}
Candidate's current resume (verbatim, including its section headers and structure):
"""
${resumeText || '(no resume text available)'}
"""

Produce two things, each separated by the exact line "=====":
1. The candidate's resume, rewritten to emphasize the qualities and experience most relevant to this role using the %% markup format above -- same facts and same overall section structure as the original, re-emphasized and re-ordered within each section, nothing invented, and no mention of the company anywhere in it.
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
