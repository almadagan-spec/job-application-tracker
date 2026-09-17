// Checks whether a company name refers to a real, existing company, using
// Claude's own knowledge (no external search service, no separate account
// or billing needed beyond the Anthropic key already used elsewhere).
// If real, also writes the short "about" summary in the same call.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { companyName } = await req.json()
    if (!companyName || typeof companyName !== 'string') {
      return jsonResponse({ error: 'companyName is required' }, 400)
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return jsonResponse(
        { error: 'Company check is not configured yet (missing Anthropic API key).' },
        500,
      )
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        thinking: { type: 'disabled' },
        system:
          'You judge whether a name refers to a real, existing company (of any size, including startups) based on your knowledge. ' +
          'Reply with ONLY a JSON object, no other text: {"found": true or false, "about": "two-sentence plain-text summary of what the company does, or empty string if not found"}.',
        messages: [{ role: 'user', content: `Company name: "${companyName}"` }],
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Claude API failed (${res.status}): ${text.slice(0, 300)}`)
    }
    const data = await res.json()
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    const raw = textBlock?.text ?? '{}'

    let parsed: { found?: boolean; about?: string } = {}
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
    } catch {
      parsed = { found: false, about: '' }
    }

    return jsonResponse({
      found: Boolean(parsed.found),
      about: parsed.about ?? '',
    })
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
