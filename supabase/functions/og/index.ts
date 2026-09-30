import { withSupabase } from 'npm:@supabase/server'

const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

export default {
  fetch: withSupabase({ auth:'none' }, async (req, ctx) => {
    try{
      const slug=new URL(req.url).searchParams.get('slug')||''
      if(!slug) return new Response('Slug manquant',{status:400})
      const {data:a,error}=await ctx.supabaseAdmin
        .from('cms_articles').select('*').eq('slug',slug).is('deleted_at',null).limit(1).maybeSingle()
      if(error) return new Response('Base indisponible',{status:502})
      if(!a || !((a.status==='published') || (a.status==='scheduled' && a.publish_at && new Date(a.publish_at)<=new Date()))) return new Response('Article introuvable',{status:404})
      const site=(Deno.env.get('PUBLIC_SITE_URL')||'').replace(/\/$/,'')
      if(!site) return new Response('PUBLIC_SITE_URL non configurée',{status:500})
      const canonical=`${site}/article/${encodeURIComponent(a.slug)}/`
      const desc=String(a.seo_description||a.excerpt||a.content||'').replace(/\s+/g,' ').trim().slice(0,160)
      const title=esc(`${a.seo_title||a.title} | AfriScope Media`)
      const image=esc(a.image||'')
      const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:locale" content="fr_FR"><meta property="og:title" content="${title}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="article"><meta property="og:site_name" content="AfriScope Media"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${image}"><meta property="og:image:alt" content="${esc(a.title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${image}"><link rel="canonical" href="${esc(canonical)}"><meta http-equiv="refresh" content="0;url=${esc(canonical)}"></head><body><a href="${esc(canonical)}">Lire l’article</a><script>location.replace(${JSON.stringify(canonical)})</script></body></html>`
      return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public,max-age=300'}})
    }catch(e){ return new Response(`Erreur OG : ${String(e)}`,{status:500}) }
  })
}
