/* ============================================================
   GREENGRID — API client
   Talks to the backend in /backend. Every request carries the
   project API key (x-api-key) so the backend can distinguish
   trusted frontend traffic; login exchanges are additionally
   signed with a bearer token stored in localStorage.
   ============================================================ */
const GG_API = (function(){
  // Smart default: if the page was opened from localhost (dev on your own
  // machine), talk to localhost:4000 — the common case while building.
  // If the page is served from anywhere else (a real deployment — Render,
  // Railway, a VPS, a shared judge link), talk to the SAME hostname on
  // port 4000 instead of the visitor's own localhost, which would never
  // resolve to your backend and would fail with a silent CORS/connection
  // error. Override completely by setting window.GG_API_BASE before this
  // script loads if your backend lives at a different host/port/path.
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) || window.location.hostname === '';
  const inferredBase = isLocal
    ? 'http://localhost:4000/api'
    : `${window.location.protocol}//${window.location.hostname}:4000/api`;
  const BASE_URL = window.GG_API_BASE || inferredBase;
  // Demo key — ships in .env.example on the backend too. Swap both
  // in production; never hardcode real secrets in shipped frontend JS.
  const API_KEY = window.GG_API_KEY || 'gg_demo_9f2c1a7e4b6d0158';

  function token(){ return localStorage.getItem('gg_token') || ''; }
  function setToken(t){ if(t) localStorage.setItem('gg_token', t); }
  function clearToken(){ localStorage.removeItem('gg_token'); localStorage.removeItem('gg_user'); }
  function setUser(u){ localStorage.setItem('gg_user', JSON.stringify(u)); }
  function getUser(){ try{ return JSON.parse(localStorage.getItem('gg_user')||'null'); }catch(e){ return null; } }

  /* Shared HTML-escape utility — always use this when injecting any
     string from the API into innerHTML to prevent XSS. */
  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  async function request(path, opts={}){
    const headers = Object.assign({
      'Content-Type':'application/json',
      'x-api-key': API_KEY
    }, opts.headers||{});
    if(token()) headers['Authorization'] = 'Bearer ' + token();

    let res;
    try{
      res = await fetch(BASE_URL + path, Object.assign({}, opts, { headers }));
    }catch(err){
      throw new Error('Cannot reach the GreenGrid backend at ' + BASE_URL + '. Locally: is `npm start` running in /backend? Deployed: the backend must be reachable at that exact URL — set window.GG_API_BASE to its real address before assets/js/api.js loads if it lives somewhere else.');
    }
    const isJson = (res.headers.get('content-type')||'').includes('application/json');
    const body = isJson ? await res.json() : await res.text();
    if(!res.ok){
      const msg = (body && body.error) ? body.error : ('Request failed (' + res.status + ')');
      throw new Error(msg);
    }
    return body;
  }

  return {
    BASE_URL,
    API_KEY,
    esc,
    token, setToken, clearToken, setUser, getUser,
    get: (p)=>request(p,{method:'GET'}),
    post: (p,data)=>request(p,{method:'POST', body: JSON.stringify(data||{})}),
    put: (p,data)=>request(p,{method:'PUT', body: JSON.stringify(data||{})}),
    del: (p)=>request(p,{method:'DELETE'}),

    // ---- convenience endpoint helpers ----
    login: (email, password, role)=>request('/auth/login',{method:'POST', body:JSON.stringify({email,password,role})}),
    register: (payload)=>request('/auth/register',{method:'POST', body:JSON.stringify(payload)}),
    me: ()=>request('/auth/me',{method:'GET'}),

    dashboard: ()=>request('/dashboard',{method:'GET'}),
    events: (params='')=>request('/events'+params,{method:'GET'}),
    createEvent: (payload)=>request('/events',{method:'POST', body:JSON.stringify(payload)}),
    simulateEvent: (payload)=>request('/events/simulate',{method:'POST', body:JSON.stringify(payload)}),
    certifyEvent: (id)=>request('/events/'+id+'/certify',{method:'POST'}),

    missions: ()=>request('/missions',{method:'GET'}),
    completeMission: (id)=>request('/missions/'+id+'/complete',{method:'POST'}),

    leaderboard: ()=>request('/leaderboard',{method:'GET'}),
    guilds: ()=>request('/leaderboard/guilds',{method:'GET'}),

    reports: ()=>request('/reports',{method:'GET'}),
    submitReport: (payload)=>request('/reports',{method:'POST', body:JSON.stringify(payload)}),

    openData: ()=>request('/opendata',{method:'GET'}),

    adminOverview: ()=>request('/admin/overview',{method:'GET'}),
    adminReports: ()=>request('/admin/reports',{method:'GET'}),
    adminResolve: (id)=>request('/admin/reports/'+id+'/resolve',{method:'POST'}),

    // ---- impact layer ----
    eventReceipt: (id)=>request('/events/'+id+'/receipt',{method:'GET'}),
    eventRecommendations: (id)=>request('/events/'+id+'/recommendations',{method:'GET'}),
    patchChecklist: (id, payload)=>request('/events/'+id+'/checklist',{method:'PATCH', body:JSON.stringify(payload)}),
    modelAssumptions: ()=>request('/events/model/assumptions',{method:'GET'}),

    ecoPool: (eventId)=>request('/impact/ecopool/'+eventId,{method:'GET'}),
    joinEcoPool: (eventId, corridor)=>request('/impact/ecopool/'+eventId+'/join',{method:'POST', body:JSON.stringify({corridor})}),
    logAction: (payload)=>request('/impact/actions',{method:'POST', body:JSON.stringify(payload)}),
    trustTiers: ()=>request('/impact/trust-tiers',{method:'GET'}),
    eventGoal: (eventId)=>request('/impact/goal/'+eventId,{method:'GET'}),

    certificates: ()=>request('/impact/certificates',{method:'GET'}),
    issueCertificate: (eventId)=>request('/impact/certificates/issue',{method:'POST', body:JSON.stringify({eventId})}),
    // Public route — deliberately hits the unauthenticated embed path so
    // the same call works for someone outside GreenGrid entirely.
    verifyCertificate: (code)=>request('/embed/verify/'+code,{method:'GET'}),

    campaigns: ()=>request('/impact/campaigns',{method:'GET'}),
    rolloverCampaign: (id)=>request('/impact/campaigns/'+id+'/rollover',{method:'POST'}),

    redeemReward: (id)=>request('/rewards/'+id+'/redeem',{method:'POST'}),
    rewards: ()=>request('/rewards',{method:'GET'}),
  };
})();
window.GG_API = GG_API;
