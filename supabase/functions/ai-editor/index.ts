import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return Response.json({ error: 'Authentification administrateur requise.' }, { status: 401, headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  )
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return Response.json({ error: 'Session Supabase invalide.' }, { status: 401, headers: cors })

  const body = await req.json()
  const topic = String(body.topic || '').trim()
  if (!topic) return Response.json({ error: 'Sujet manquant.' }, { status: 400, headers: cors })

  const angle = String(body.angle || 'ton journalistique rigoureux, factuel et lisible').trim()
  const category = String(body.category || 'Actualité').trim()
  const length = String(body.length || 'moyenne')
  const source = String(body.source || '').trim()
  const target = ({ courte: 250, moyenne: 500, longue: 800 } as Record<string, number>)[length] || 500

  const prompt = `Tu es le rédacteur en chef adjoint d'AfriScope Media, média panafricain francophone. Produis un article journalistique original, précis et structuré.
Sujet : ${topic}
Rubrique : ${category}
Angle : ${angle}
Longueur cible : environ ${target} mots.
Éléments/source fournis par le rédacteur : ${source || 'aucun'}

Contraintes : ne fabrique aucun chiffre, nom, citation ou fait précis absent des éléments fournis. Si le sujet exige des faits récents qui ne sont pas fournis, formule le texte de manière prudente et générique plutôt que d'inventer. Le résultat doit être directement exploitable après relecture humaine.

Retourne UNIQUEMENT du JSON valide :
{
  "title":"titre journalistique",
  "excerpt":"chapô de 1 à 2 phrases",
  "content":"article en paragraphes séparés par deux retours à la ligne",
  "tags":["tag1","tag2","tag3","tag4"],
  "seo_title":"titre SEO, maximum environ 60 caractères si possible",
  "seo_description":"description SEO/OG de 140 à 160 caractères environ",
  "og_description":"court extrait pour partage social"
}`

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY n’est pas configurée dans Supabase Edge Function Secrets.' }, { status: 500, headers: cors })

  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-5.6-luna',
      input: prompt,
      max_output_tokens: 5000,
    }),
  })
  if (!r.ok) return Response.json({ error: `OpenAI HTTP ${r.status}: ${(await r.text()).slice(0,500)}` }, { status: 502, headers: cors })
  const data = await r.json()
  const text = data.output_text || (data.output || []).flatMap((x: any) => x.content || []).map((x: any) => x.text || '').join('\n')
  let article: any
  try {
    const clean = String(text).replace(/```json/gi,'').replace(/```/g,'').trim()
    article = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1))
  } catch (_) {
    return Response.json({ error: 'Réponse IA non JSON.', raw: String(text).slice(0,1000) }, { status: 502, headers: cors })
  }
  return Response.json({ article }, { headers: { ...cors, 'Content-Type': 'application/json' } })
})
