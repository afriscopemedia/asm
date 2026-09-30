import { withSupabase } from 'npm:@supabase/server'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type, apikey, authorization',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
}

export default {
  fetch: withSupabase({auth:'none'}, async (req,ctx) => {
    if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
    if(req.method!=='POST') return Response.json({error:'Method not allowed'},{status:405,headers:cors})
    try{
      const b=await req.json().catch(()=>({}))
      const path=String(b.path||'/').slice(0,500)
      const device=String(b.device||'inconnu').slice(0,50)
      const referrer=String(b.referrer||'direct').slice(0,1000)
      const visitorId=String(b.visitorId||'').slice(0,100)
      const sessionId=String(b.sessionId||'').slice(0,100)
      const title=String(b.title||'AfriScope Media').slice(0,300)
      const country=String(req.headers.get('cf-ipcountry')||req.headers.get('x-vercel-ip-country')||'').slice(0,100)
      const region=String(req.headers.get('x-vercel-ip-country-region')||'').slice(0,100)
      const city=String(req.headers.get('x-vercel-ip-city')||'').slice(0,100)
      const {error}=await ctx.supabaseAdmin.from('analytics_events').insert({path,device,referrer,visitor_id:visitorId||null,session_id:sessionId||null,title,country:country||null,region:region||null,city:city||null})
      if(error) throw error
      return Response.json({ok:true},{headers:cors})
    }catch(e){
      console.error('track-visit',e)
      return Response.json({ok:false},{status:202,headers:cors})
    }
  })
}
