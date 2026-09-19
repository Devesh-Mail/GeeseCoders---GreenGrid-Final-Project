/**
 * SRI — floating assistant widget
 * ---------------------------------------------------------------
 * Drop <script src="assets/js/sri.js"></script> on any page and a
 * round "Sri" button appears bottom-right. Clicking it opens a popup.
 *
 * Every answer comes from /api/sri/ask, which reads real platform
 * records — so the widget renders a "sources" line under each reply
 * showing exactly which records produced it. That line is the point:
 * an assistant that cites what it read is checkable, one that doesn't
 * is just confident-sounding text.
 */
(function () {
  if (window.__sriLoaded) return;
  window.__sriLoaded = true;

  const css = `
  .sri-fab{
    position:fixed; right:22px; bottom:22px; z-index:8000;
    width:60px; height:60px; border-radius:50%; border:none; cursor:pointer;
    background:linear-gradient(145deg,#7CFFB2,#4DE8D4); color:#07130E;
    font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:15px;
    box-shadow:0 8px 28px rgba(124,255,178,.32), 0 2px 8px rgba(0,0,0,.4);
    display:flex; align-items:center; justify-content:center;
    transition:transform .25s cubic-bezier(.2,.8,.3,1), box-shadow .25s;
  }
  .sri-fab:hover{ transform:scale(1.08) translateY(-2px); box-shadow:0 12px 34px rgba(124,255,178,.42); }
  .sri-fab.open{ transform:scale(.9) rotate(90deg); }
  .sri-fab .pulse{
    position:absolute; inset:-4px; border-radius:50%; border:2px solid rgba(124,255,178,.5);
    animation:sri-pulse 2.4s ease-out infinite; pointer-events:none;
  }
  @keyframes sri-pulse{ 0%{transform:scale(.95);opacity:.8} 70%{transform:scale(1.35);opacity:0} 100%{opacity:0} }

  .sri-panel{
    position:fixed; right:22px; bottom:94px; z-index:8001;
    width:390px; max-width:calc(100vw - 32px); height:560px; max-height:calc(100vh - 130px);
    background:#0D1F17; border:1px solid rgba(238,243,234,.12); border-radius:20px;
    display:none; flex-direction:column; overflow:hidden;
    box-shadow:0 24px 70px rgba(0,0,0,.6);
    font-family:'Inter',sans-serif;
    transform-origin:bottom right;
  }
  .sri-panel.show{ display:flex; animation:sri-in .32s cubic-bezier(.2,.8,.3,1); }
  @keyframes sri-in{ from{opacity:0; transform:translateY(14px) scale(.94);} to{opacity:1; transform:none;} }

  .sri-head{ padding:16px 18px; border-bottom:1px solid rgba(238,243,234,.09); display:flex; gap:12px; align-items:center; }
  .sri-av{ width:38px;height:38px;border-radius:50%;background:linear-gradient(145deg,#7CFFB2,#4DE8D4);
           display:flex;align-items:center;justify-content:center;color:#07130E;font-weight:700;font-size:14px;
           font-family:'Space Grotesk',sans-serif; flex-shrink:0; }
  .sri-head .n{ font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:15px; color:#EEF3EA; }
  .sri-head .s{ font-size:11px; color:#9FB3A8; margin-top:2px; }
  .sri-x{ margin-left:auto; background:none;border:none;color:#9FB3A8;cursor:pointer;font-size:20px;line-height:1;padding:4px; }
  .sri-x:hover{ color:#EEF3EA; }

  .sri-body{ flex:1; overflow-y:auto; padding:16px 18px; display:flex; flex-direction:column; gap:14px; }
  .sri-body::-webkit-scrollbar{ width:6px; }
  .sri-body::-webkit-scrollbar-thumb{ background:rgba(238,243,234,.14); border-radius:99px; }

  .sri-msg{ max-width:88%; font-size:13.2px; line-height:1.62; white-space:pre-wrap; }
  .sri-msg.bot{ align-self:flex-start; color:#EEF3EA; background:#122A20;
                border:1px solid rgba(238,243,234,.08); border-radius:14px 14px 14px 4px; padding:12px 14px; }
  .sri-msg.me{ align-self:flex-end; color:#07130E; background:#7CFFB2;
               border-radius:14px 14px 4px 14px; padding:11px 14px; font-weight:500; }
  .sri-src{ font-size:10px; color:#6C8F7E; margin-top:8px; padding-top:7px;
            border-top:1px solid rgba(238,243,234,.07); font-family:'JetBrains Mono',monospace; line-height:1.5; }
  .sri-chips{ display:flex; flex-wrap:wrap; gap:7px; }
  .sri-chip{ background:rgba(124,255,178,.08); border:1px solid rgba(124,255,178,.3); color:#7CFFB2;
             border-radius:99px; padding:7px 12px; font-size:11.5px; cursor:pointer; font-family:'Inter',sans-serif; }
  .sri-chip:hover{ background:rgba(124,255,178,.16); }

  .sri-typing{ align-self:flex-start; display:flex; gap:4px; padding:12px 14px; background:#122A20;
               border-radius:14px 14px 14px 4px; border:1px solid rgba(238,243,234,.08); }
  .sri-typing i{ width:6px;height:6px;border-radius:50%;background:#7CFFB2;display:block;
                 animation:sri-dot 1.3s infinite ease-in-out; }
  .sri-typing i:nth-child(2){ animation-delay:.18s } .sri-typing i:nth-child(3){ animation-delay:.36s }
  @keyframes sri-dot{ 0%,60%,100%{opacity:.3;transform:translateY(0)} 30%{opacity:1;transform:translateY(-4px)} }

  .sri-foot{ padding:12px 14px; border-top:1px solid rgba(238,243,234,.09); display:flex; gap:8px; }
  .sri-foot input{ flex:1; background:#122A20; border:1px solid rgba(238,243,234,.1); border-radius:11px;
                   padding:11px 13px; color:#EEF3EA; font-size:13px; outline:none; font-family:'Inter',sans-serif; }
  .sri-foot input:focus{ border-color:#7CFFB2; }
  .sri-foot button{ background:#7CFFB2; color:#07130E; border:none; border-radius:11px; padding:0 15px;
                    cursor:pointer; font-weight:700; font-size:14px; }
  .sri-foot button:disabled{ opacity:.5; cursor:not-allowed; }
  .sri-note{ font-size:9.5px; color:#6C8F7E; text-align:center; padding:0 14px 10px; line-height:1.5; }
  @media (max-width:520px){ .sri-panel{ right:12px; left:12px; width:auto; bottom:88px; } }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const fab = document.createElement('button');
  fab.className = 'sri-fab';
  fab.setAttribute('aria-label', 'Open Sri, the GreenGrid assistant');
  fab.innerHTML = '<span class="pulse"></span>Sri';

  const panel = document.createElement('div');
  panel.className = 'sri-panel';
  panel.innerHTML = `
    <div class="sri-head">
      <div class="sri-av">Sri</div>
      <div>
        <div class="n">Sri</div>
        <div class="s" id="sriStatus">Reads live platform data</div>
      </div>
      <button class="sri-x" aria-label="Close">×</button>
    </div>
    <div class="sri-body" id="sriBody"></div>
    <div class="sri-foot">
      <input id="sriInput" placeholder="Ask about scores, events, mentors…" autocomplete="off">
      <button id="sriSend">↑</button>
    </div>
    <div class="sri-note">Sri answers from real records and cites them. It doesn't invent numbers.</div>`;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const body = panel.querySelector('#sriBody');
  const input = panel.querySelector('#sriInput');
  const sendBtn = panel.querySelector('#sriSend');
  let started = false;

  function esc(s){ return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

  function addMsg(text, who, sources) {
    const el = document.createElement('div');
    el.className = 'sri-msg ' + who;
    el.innerHTML = esc(text);
    if (sources && sources.length) {
      const s = document.createElement('div');
      s.className = 'sri-src';
      s.textContent = 'read: ' + sources.join(' · ');
      el.appendChild(s);
    }
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function addChips(actions) {
    if (!actions || !actions.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'sri-chips';
    actions.forEach(a => {
      const c = document.createElement('button');
      c.className = 'sri-chip';
      c.textContent = a.label;
      c.onclick = () => {
        if (a.open) { window.location.href = a.open; return; }
        wrap.remove();
        ask(a.send || a.label);
      };
      wrap.appendChild(c);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  /* ---- client-side fallback answers for common questions ---- *
   * These fire ONLY when the backend is unreachable. They are clearly
   * labelled as offline answers so nothing is presented as live data.
   * -------------------------------------------------------------- */
  const OFFLINE_INTENTS = [
    { words: ['hello','hi ','hey','help','what can you','who are you','what is greengrid'],
      reply: `Hi, I'm Sri! I'm GreenGrid's assistant.\n\nI answer questions from live platform data — scores, missions, events, mentors and more. Right now I can't reach the backend, so I'm working from cached knowledge.\n\nOnce the backend is running I'll give you real numbers.` },
    { words: ['greenscore','how is the score','how do you calculate','how does the score','what is greenscore','score calculated'],
      reply: `GreenScore rates an event's sustainability from 0 to 100.\n\nFive categories:\n• Transport — one round trip per attendee (doesn't scale with event length)\n• Energy — HVAC, lighting, AV per attendee per hour\n• Food — meals derived from event duration\n• Waste — one-time per attendee\n• Materials — badges, certs, signage\n\nThe score is the ratio of your footprint to the event's own duration-aware budget — so a 24-hour hackathon and a 2-hour seminar can both score 90 by being well-run for what they are.\n\n(Offline answer — real scores from the backend when it's running.)` },
    { words: ['mission','what should i do','earn xp','earn points','quest','task'],
      reply: `Eco-Missions are daily actions that earn XP and GreenPoints — things like carpooling, reducing waste or attending a certified event.\n\nEach completed mission logs a real action with a trust tier, so your CO₂ number reflects evidence, not just a count.\n\n(Offline — open the Missions panel for today's list once the backend is running.)` },
    { words: ['event','upcoming','attend','register','greenest','whats on'],
      reply: `Events are scored by the GreenScore engine before they happen, so you can compare their environmental impact before registering.\n\nGreen-certified events (score ≥ 60) are marked with a 🌿 badge.\n\n(Offline — the full event list loads once the backend is running.)` },
    { words: ['trust','cheat','fake','lie','verify','anti-cheat','self-report'],
      reply: `GreenGrid uses trust tiers instead of banning people:\n• Self-reported — weight 0.4, can't draw sponsor funds\n• Event-verified — weight 0.85\n• Sensor-verified — weight 1.0\n\nSelf-reported actions still earn XP and keep streaks alive. They just carry less weight in totals. No one is accused of anything — the number simply reflects how well the claim is evidenced.` },
  ];

  function offlineFallback(text) {
    const q = ' ' + text.toLowerCase() + ' ';
    for (const intent of OFFLINE_INTENTS) {
      if (intent.words.some(w => q.includes(w))) return intent.reply;
    }
    return `I can't reach the GreenGrid backend right now, so I'd rather say nothing than guess.\n\nTry: "What is GreenScore?", "How do missions work?", or "What are trust tiers?" — I can answer those offline.\n\nFor live data (your impact, real scores, events), start the backend and ask again.`;
  }

  function getApi() {
    return (typeof GG_API !== 'undefined' ? GG_API : (window.GG_API || null));
  }
  function getApiKey() {
    const api = getApi();
    return (api && api.API_KEY) || window.GG_API_KEY || 'gg_demo_9f2c1a7e4b6d0158';
  }
  function getBaseUrl() {
    const api = getApi();
    return (api && api.BASE_URL) || window.GG_API_BASE || 'http://localhost:4000/api';
  }
  function getAuthToken() {
    const api = getApi();
    return (api && typeof api.token === 'function') ? api.token() : (localStorage.getItem('gg_token') || '');
  }

  async function ask(text) {
    addMsg(text, 'me');
    input.value = '';
    sendBtn.disabled = true;

    const typing = document.createElement('div');
    typing.className = 'sri-typing';
    typing.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
      };
      const t = getAuthToken();
      if (t) headers['Authorization'] = 'Bearer ' + t;

      const base = getBaseUrl();
      const r = await fetch(base + '/sri/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text }),
      });
      const data = await r.json();
      typing.remove();
      // Show the server's own error message instead of the generic
      // "can't reach" text — 500s and 400s were silently masked before.
      if (!r.ok) throw new Error(data.error || ('Server error ' + r.status));
      addMsg(data.reply, 'bot', data.sources);
      addChips(data.actions);
      document.getElementById('sriStatus').textContent =
        data.phrasedByLlm ? 'Facts from records · phrasing by Claude' : 'Reads live platform data';
    } catch (e) {
      typing.remove();
      // If it's a network error (fetch itself threw), use the offline fallback.
      // If the server replied with an error, show that message directly.
      const isNetworkError = e instanceof TypeError || e.message.includes('Failed to fetch') || e.message.includes('Cannot reach');
      if (isNetworkError) {
        addMsg(offlineFallback(text), 'bot');
        document.getElementById('sriStatus').textContent = 'Offline mode — limited answers';
      } else {
        addMsg('Sorry, something went wrong: ' + e.message, 'bot');
      }
    }
    sendBtn.disabled = false;
    input.focus();
  }

  async function start() {
    if (started) return;
    started = true;
    addMsg("Hi — I'm Sri.\n\nI answer from GreenGrid's live data, and I show you which records I read, so you can check anything I say.", 'bot');
    try {
      const base = getBaseUrl();
      const r = await fetch(base + '/sri/capabilities', {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': getApiKey(),
        },
      });
      const d = await r.json();
      addChips((d.starters || []).slice(0, 4).map(s => ({ label: s, send: s })));
    } catch (e) { /* chips are optional */ }
  }

  function toggle(force) {
    const show = force !== undefined ? force : !panel.classList.contains('show');
    panel.classList.toggle('show', show);
    fab.classList.toggle('open', show);
    fab.innerHTML = show ? '×' : '<span class="pulse"></span>Sri';
    if (show) { start(); setTimeout(() => input.focus(), 260); }
  }

  fab.onclick = () => toggle();
  panel.querySelector('.sri-x').onclick = () => toggle(false);
  sendBtn.onclick = () => { const v = input.value.trim(); if (v) ask(v); };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const v = input.value.trim(); if (v) ask(v); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });

  window.Sri = { open: () => toggle(true), close: () => toggle(false), ask };
})();
