// Pulls the plain text out of an uploaded resume file (PDF or Word .docx),
// using the same permission the uploading user already has (their own login
// token, forwarded automatically by supabase.functions.invoke).
//
// Needs the ANTHROPIC_API_KEY secret for PDFs (Claude reads the PDF directly).
// .docx files are parsed locally with the "mammoth" library -- no AI call needed.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import mammoth from 'npm:mammoth@1.8.0'

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

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function extractFromPdf(bytes: Uint8Array): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('Resume text extraction is not configured yet (missing Anthropic API key).')

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
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: toBase64(bytes) },
            },
            { type: 'text', text: 'Extract the full plain text content of this resume, verbatim, with no commentary.' },
          ],
        },
      ],
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
    const { path, contentType } = await req.json()
    if (!path) return jsonResponse({ error: 'path is required' }, 400)

    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: file, error } = await supabase.storage.from('resumes').download(path)
    if (error || !file) throw error ?? new Error('Could not read the uploaded file.')

    const bytes = new Uint8Array(await file.arrayBuffer())
    const isDocx =
      contentType?.includes('officedocument.wordprocessingml') || path.toLowerCase().endsWith('.docx')

    let resumeText: string
    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer: bytes })
      resumeText = result.value
    } else {
      resumeText = await extractFromPdf(bytes)
    }

    return jsonResponse({ resumeText: resumeText.trim() })
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
