import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function esc(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
Deno.serve(async (req)=>{
  const url=new URL(req.url), slug=url.searchParams.get('slug')||''
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const {data,error}=await supabase.from('site_data').select('data').eq('id','main').maybeSingle()
  const db=data?.data||{}
  const a=(db.articles||[]).find((x:any)=>x.slug===slug && !x.deletedAt && (x.status==='published' || (x.status==='scheduled' && x.publishAt && new Date(x.publishAt)<=new Date())))
  const site=(Deno.env.get('PUBLIC_SITE_URL')||'').replace(/\/$/,'')
  if(error||!a) return new Response('Article introuvable',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}})
  const canonical=`${site}/#/article/${encodeURIComponent(a.slug)}`
  const desc=String(a.excerpt||a.content||'').replace(/\s+/g,' ').slice(0,160)
  const title=esc(`${a.title} | AfriScope Media`)
  const image=esc(a.image||'')
  const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><meta name="description" content="${esc(desc)}"><meta property="og:title" content="${title}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="article"><meta property="og:site_name" content="AfriScope Media"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${image}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${image}"><link rel="canonical" href="${esc(canonical)}"><meta http-equiv="refresh" content="1;url=${esc(canonical)}"></head><body><p>Ouverture de l’article… <a href="${esc(canonical)}">Continuer vers AfriScope Media</a></p><script>location.replace(${JSON.stringify(canonical)})</script></body></html>`
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=300'}})
})
