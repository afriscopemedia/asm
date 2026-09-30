import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'content-type, apikey, authorization', 'Access-Control-Allow-Methods':'POST, OPTIONS' }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:cors})
  if (req.method !== 'POST') return new Response('Method not allowed',{status:405,headers:cors})
  try {
    const b=await req.json()
    const path=String(b.path||'/').slice(0,500)
    const referrer=String(b.referrer||'direct').slice(0,500)
    const device=String(b.device||'ordinateur').slice(0,30)
    const visitorId=String(b.visitorId||'').slice(0,100)
    const sessionId=String(b.sessionId||'').slice(0,100)
    const title=String(b.title||'').slice(0,300)
    const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')||'').split(',')[0].trim()
    let country='Inconnu', region='', city=''
    if(ip && !/^(127\.0\.0\.1|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(ip)) {
      try {
        const geo=await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`,{headers:{'User-Agent':'AfriScope-Media-Analytics/1.0'}})
        if(geo.ok){ const g=await geo.json(); country=String(g.country_name||'Inconnu').slice(0,100); region=String(g.region||'').slice(0,100); city=String(g.city||'').slice(0,100) }
      } catch (_) {}
    }
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const {error}=await admin.from('analytics_events').insert({path,title,visitor_id:visitorId,session_id:sessionId,device,referrer,country,region,city})
    if(error) throw error
    return Response.json({ok:true},{headers:{...cors,'Content-Type':'application/json'}})
  } catch(e) { return Response.json({ok:false,error:String(e)},{status:200,headers:{...cors,'Content-Type':'application/json'}}) }
})
