import { withSupabase } from 'npm:@supabase/server'

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function dayParts() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Libreville', year: 'numeric', month: '2-digit', day: '2-digit' })
  const now = new Date()
  return { today: fmt.format(now), yesterday: fmt.format(new Date(now.getTime() - 86400000)) }
}

export default {
  fetch: withSupabase({ auth: 'secret:default' }, async (req, ctx) => {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

    const { data: site, error: siteErr } = await ctx.supabaseAdmin.from('site_data').select('data').eq('id', 'main').maybeSingle()
    if (siteErr) return Response.json({ error: siteErr.message }, { status: 500 })
    const articles = site?.data?.articles || []
    const { yesterday, today } = dayParts()
    const start = `${yesterday}T00:00:00+01:00`
    const end = `${today}T00:00:00+01:00`
    const list = articles.filter((a: any) => !a.deletedAt && a.status === 'published' && a.publishAt && new Date(a.publishAt) >= new Date(start) && new Date(a.publishAt) < new Date(end)).sort((a: any, b: any) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime())
    if (!list.length) return Response.json({ ok: true, sent: 0, message: 'Aucun article publié la veille.' })

    const { data: subs, error: subErr } = await ctx.supabaseAdmin.from('newsletter_subscribers').select('email,first_name,last_name')
    if (subErr) return Response.json({ error: subErr.message }, { status: 500 })
    const resend = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('NEWSLETTER_FROM')
    const publicSite = (Deno.env.get('PUBLIC_SITE_URL') || '').replace(/\/$/, '')
    if (!resend || !from || !publicSite) return Response.json({ error: 'RESEND_API_KEY, NEWSLETTER_FROM et PUBLIC_SITE_URL sont requis.' }, { status: 500 })

    let sent = 0, failed = 0
    for (const s of (subs || [])) {
      const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#122228"><div style="background:#007890;padding:18px;text-align:center;color:white;font-size:22px;font-weight:bold">AfriScope Media</div><div style="padding:24px"><p>Bonjour ${esc(s.first_name || '')},</p><p>Voici le récapitulatif des articles publiés hier par AfriScope Media.</p>${list.map((a: any) => { const link = `${publicSite}/#/article/${encodeURIComponent(a.slug)}`; const intro = String(a.excerpt || a.content || '').replace(/\s+/g, ' ').slice(0, 280); return `<article style="margin:0 0 26px;border-bottom:1px solid #e1e9eb;padding-bottom:20px"><img src="${esc(a.image || '')}" alt="" style="width:100%;max-height:320px;object-fit:cover;border-radius:6px"><h2 style="font-size:20px;line-height:1.3"><a href="${esc(link)}" style="color:#023f4d;text-decoration:none">${esc(a.title)}</a></h2><p style="font-size:15px;line-height:1.6;color:#48606a">${esc(intro)}</p><a href="${esc(link)}" style="display:inline-block;background:#007890;color:white;padding:9px 14px;border-radius:18px;text-decoration:none">Lire l’article</a></article>` }).join('')}</div><div style="background:#f4f8f9;padding:16px;text-align:center;color:#48606a;font-size:12px">© ${new Date().getFullYear()} AfriScope Media</div></div>`
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resend}` }, body: JSON.stringify({ from, to: [s.email], subject: `AfriScope Media — Les articles du ${yesterday}`, html }) })
      if (r.ok) sent++; else failed++
    }
    return Response.json({ ok: true, sent, failed, articles: list.length, date: yesterday })
  }),
}
