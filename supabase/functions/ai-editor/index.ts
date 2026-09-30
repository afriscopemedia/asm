import { createSupabaseContext } from 'npm:@supabase/server'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const { data: ctx, error: authError } = await createSupabaseContext(req, { auth: 'user' })
  if (authError || !ctx?.userClaims?.sub) return json({ error: 'Authentification administrateur requise.' }, 401)

  const body = await req.json().catch(() => ({}))
  const topic = String(body.topic || '').trim()
  if (!topic) return json({ error: 'Sujet manquant.' }, 400)

  const angle = String(body.angle || 'ton journalistique rigoureux, factuel et lisible').trim()
  const category = String(body.category || 'Actualité').trim()
  const length = String(body.length || 'moyenne')
  const source = String(body.source || '').trim()
  const target = ({ courte: 250, moyenne: 500, longue: 800 } as Record<string, number>)[length] || 500

  const prompt = `Tu es rédacteur en chef adjoint d’AfriScope Media, média panafricain francophone.
Produis un article original, précis, structuré et prêt à être relu par un journaliste.

Sujet : ${topic}
Rubrique : ${category}
Angle : ${angle}
Longueur cible : environ ${target} mots.
Éléments/source fournis par le rédacteur : ${source || 'aucun'}

Ne fabrique aucun chiffre, nom, citation ou fait précis absent des éléments fournis.
Si des faits récents manquent, formule prudemment au lieu d’inventer.
Réponds exclusivement avec l’objet demandé.`

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.6-luna'
  if (!apiKey) return json({ error: 'OPENAI_API_KEY n’est pas configurée dans les secrets Edge Functions.' }, 500)
  if (!model) return json({ error: 'OPENAI_MODEL n’est pas configuré.' }, 500)

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      excerpt: { type: 'string' },
      content: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      seo_title: { type: 'string' },
      seo_description: { type: 'string' },
      og_description: { type: 'string' }
    },
    required: ['title','excerpt','content','tags','seo_title','seo_description','og_description']
  }

  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 5000,
      text: {
        format: {
          type: 'json_schema',
          name: 'afriscope_article',
          strict: true,
          schema
        }
      }
    }),
  })

  if (!r.ok) return json({ error: `OpenAI HTTP ${r.status}: ${(await r.text()).slice(0, 800)}` }, 502)

  const data = await r.json()
  const output = data.output_text || ''
  if (!output) return json({ error: 'OpenAI a retourné une réponse sans texte.' }, 502)

  try {
    return json({ article: JSON.parse(output) })
  } catch {
    return json({ error: 'Réponse OpenAI non conforme au JSON attendu.' }, 502)
  }
})
