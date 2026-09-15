// Checks whether a company name is a real, findable company, using Google's
// Custom Search API. It looks specifically for a linkedin.com/company page
// (the strongest signal) and otherwise falls back to a general web presence.
//
// Needs two secrets set on the Supabase project:
//   GOOGLE_SEARCH_API_KEY  -- an API key with the "Custom Search API" enabled
//   GOOGLE_SEARCH_CX       -- the "Search engine ID" of a Programmable Search
//                             Engine configured to search the entire web
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

interface SearchItem {
  title?: string
  link?: string
  snippet?: string
}

async function googleSearch(query: string, apiKey: string, cx: string): Promise<SearchItem[]> {
  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('cx', cx)
  url.searchParams.set('q', query)
  url.searchParams.set('num', '5')

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Google search failed (${res.status})`)
  }
  const data = await res.json()
  return (data.items ?? []) as SearchItem[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { companyName } = await req.json()
    if (!companyName || typeof companyName !== 'string') {
      return jsonResponse({ error: 'companyName is required' }, 400)
    }

    const apiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY')
    const cx = Deno.env.get('GOOGLE_SEARCH_CX')
    if (!apiKey || !cx) {
      return jsonResponse(
        { error: 'Company search is not configured yet (missing Google Search API key).' },
        500,
      )
    }

    const linkedinResults = await googleSearch(`"${companyName}" site:linkedin.com/company`, apiKey, cx)
    const linkedinMatch = linkedinResults.find((item) => item.link?.includes('linkedin.com/company'))

    let generalResults: SearchItem[] = []
    if (!linkedinMatch) {
      generalResults = await googleSearch(`"${companyName}" company`, apiKey, cx)
    }

    const found = Boolean(linkedinMatch) || generalResults.length > 0
    const best = linkedinMatch ?? generalResults[0]

    return jsonResponse({
      found,
      linkedinUrl: linkedinMatch?.link ?? null,
      website: !linkedinMatch ? best?.link ?? null : null,
      snippet: best?.snippet ?? null,
    })
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
