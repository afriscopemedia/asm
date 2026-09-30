import { withSupabase } from 'npm:@supabase/server'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors })

    try {
      const b = await req.json()
      const path = String(b.path || '/').slice(0, 500)
      const referrer = String(b.referrer || 'direct').slice(0, 500)
      const device = String(b.device || 'ordinateur').slice(0, 30)
      const visitorId = String(b.visitorId || '').slice(0, 100)
      const sessionId = String(b.sessionId || '').slice(0, 100)
      const title = String(b.title || '').slice(0, 300)

      const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
      let country = 'Inconnu', region = '', city = ''
      if (ip && !/^(127\.0\.0\.1|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(ip)) {
        try {
          const geo = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { headers: { 'User-Agent': 'AfriScope-Media-Analytics/2.0' } })
          if (geo.ok) {
            const g = await geo.json()
            country = String(g.country_name || 'Inconnu').slice(0, 100)
            region = String(g.region || '').slice(0, 100)
            city = String(g.city || '').slice(0, 100)
          }
        } catch (_) {}
      }

      const { error } = await ctx.supabaseAdmin.from('analytics_events').insert({ path, title, visitor_id: visitorId, session_id: sessionId, device, referrer, country, region, city })
      if (error) throw error
      return Response.json({ ok: true }, { headers: { ...cors, 'Content-Type': 'application/json' } })
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
  }),
}
