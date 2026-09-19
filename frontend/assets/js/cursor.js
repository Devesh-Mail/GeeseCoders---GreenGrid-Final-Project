/* ============================================================
   GREENGRID — shared interaction layer
   Custom cursor · ambient particle field (parallax depth) ·
   magnetic buttons · 3D tilt cards · scroll reveal
   ============================================================ */
(function(){
  if (window.matchMedia('(max-width:860px)').matches) return; // skip heavy fx on mobile

  /* ---------- custom cursor ---------- */
  const dot = document.createElement('div'); dot.id='cur-dot';
  const ring = document.createElement('div'); ring.id='cur-ring';
  document.body.appendChild(dot); document.body.appendChild(ring);

  let mx=0,my=0, rx=0, ry=0;
  window.addEventListener('mousemove', e=>{
    mx=e.clientX; my=e.clientY; dot.style.left=mx+'px'; dot.style.top=my+'px';
  });
  (function loopCursor(){
    rx += (mx-rx)*0.18; ry += (my-ry)*0.18;
    ring.style.left=rx+'px'; ring.style.top=ry+'px';
    requestAnimationFrame(loopCursor);
  })();

  function wireHover(){
    document.querySelectorAll('button, a, .tilt-card, input, select, textarea, [data-magnetic], [data-magnetic-ember], [data-magnetic-violet], .side-link, .pill-tabs button').forEach(el=>{
      if (el.dataset.curWired) return;
      el.dataset.curWired = '1';
      el.addEventListener('mouseenter', ()=> ring.classList.add(
        el.hasAttribute('data-magnetic-ember') ? 'ember' :
        el.hasAttribute('data-magnetic-violet') ? 'violet' : 'hover'
      ));
      el.addEventListener('mouseleave', ()=> ring.classList.remove('hover','ember','violet'));
    });
    document.querySelectorAll('[data-magnetic],[data-magnetic-ember],[data-magnetic-violet]').forEach(el=>{
      if (el.dataset.magWired) return;
      el.dataset.magWired = '1';
      el.addEventListener('mousemove', e=>{
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left+r.width/2))*0.22;
        const dy = (e.clientY - (r.top+r.height/2))*0.22;
        el.style.transform = `translate(${dx}px,${dy}px)`;
      });
      el.addEventListener('mouseleave', ()=> el.style.transform = 'translate(0,0)');
    });
  }
  wireHover();
  window.GG_rewire = wireHover; // call after injecting dynamic content

  /* ---------- click ripple burst ---------- */
  window.addEventListener('mousedown', e=>{
    const ripple = document.createElement('div');
    ripple.className = 'cur-ripple';
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    document.body.appendChild(ripple);
    setTimeout(()=> ripple.remove(), 600);
    // small dust burst
    for (let i=0; i<5; i++){
      const p = document.createElement('div');
      p.className = 'cur-dust';
      const ang = Math.random()*Math.PI*2, dist = 14 + Math.random()*22;
      p.style.left = e.clientX + 'px'; p.style.top = e.clientY + 'px';
      p.style.setProperty('--dx', Math.cos(ang)*dist + 'px');
      p.style.setProperty('--dy', Math.sin(ang)*dist + 'px');
      document.body.appendChild(p);
      setTimeout(()=> p.remove(), 500);
    }
  });

  /* ---------- ambient particle field (mouse-parallax "depth") ---------- */
  const field = document.createElement('canvas');
  field.id='field';
  document.body.prepend(field);
  const fctx = field.getContext('2d');
  function resizeField(){ field.width=innerWidth; field.height=innerHeight; }
  resizeField(); window.addEventListener('resize', resizeField);

  const N = 70;
  const pts = Array.from({length:N}, ()=>({
    x: Math.random()*innerWidth, y: Math.random()*innerHeight,
    z: Math.random()*0.8+0.2, // depth layer -> parallax strength
    r: Math.random()*1.6+0.4,
    vx:(Math.random()-0.5)*0.15, vy:(Math.random()-0.5)*0.15
  }));
  let px=innerWidth/2, py=innerHeight/2;
  window.addEventListener('mousemove', e=>{ px=e.clientX; py=e.clientY; });
  function drawField(){
    fctx.clearRect(0,0,field.width,field.height);
    const cx = field.width/2, cy = field.height/2;
    const offX = (px-cx)*0.02, offY=(py-cy)*0.02;
    pts.forEach(p=>{
      p.x += p.vx; p.y += p.vy;
      if(p.x<0) p.x=field.width; if(p.x>field.width) p.x=0;
      if(p.y<0) p.y=field.height; if(p.y>field.height) p.y=0;
      const dx = p.x + offX*p.z*10, dy = p.y + offY*p.z*10;
      fctx.beginPath();
      fctx.fillStyle = `rgba(124,255,178,${0.10+p.z*0.18})`;
      fctx.arc(dx, dy, p.r*p.z*2.2, 0, Math.PI*2);
      fctx.fill();
    });
    // connective lines for near points (subtle web / "grid" feel)
    for(let i=0;i<pts.length;i++){
      for(let j=i+1;j<pts.length;j++){
        const a=pts[i], b=pts[j];
        const d = Math.hypot(a.x-b.x, a.y-b.y);
        if(d<90){
          fctx.strokeStyle = `rgba(77,232,212,${0.05*(1-d/90)})`;
          fctx.beginPath(); fctx.moveTo(a.x,a.y); fctx.lineTo(b.x,b.y); fctx.stroke();
        }
      }
    }
    requestAnimationFrame(drawField);
  }
  drawField();

  /* ---------- 3D tilt cards ---------- */
  function wireTilt(){
    document.querySelectorAll('.tilt-card').forEach(card=>{
      if(card.dataset.tiltWired) return;
      card.dataset.tiltWired='1';
      card.addEventListener('mousemove', e=>{
        const r = card.getBoundingClientRect();
        const cx = (e.clientX - r.left)/r.width - 0.5;
        const cy = (e.clientY - r.top)/r.height - 0.5;
        card.style.transform = `perspective(700px) rotateY(${cx*12}deg) rotateX(${-cy*12}deg) translateZ(6px)`;
        const glow = card.querySelector('.glow');
        if(glow){ glow.style.left=(e.clientX-r.left-100)+'px'; glow.style.top=(e.clientY-r.top-100)+'px'; }
      });
      card.addEventListener('mouseleave', ()=>{ card.style.transform='perspective(700px) rotateY(0) rotateX(0)'; });
    });
  }
  wireTilt();
  window.GG_wireTilt = wireTilt;

  /* ---------- scroll reveal ---------- */
  const io = new IntersectionObserver(entries=>{
    entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('in'); });
  },{threshold:0.15});
  function wireReveal(){ document.querySelectorAll('.reveal:not(.rv-wired)').forEach(el=>{ el.classList.add('rv-wired'); io.observe(el); }); }
  wireReveal();
  window.GG_wireReveal = wireReveal;
})();

/* ---------- toast / nudge system (works on all screens) ---------- */
window.GGToast = function(title, desc, icon){
  let stack = document.getElementById('toast-stack');
  if(!stack){ stack=document.createElement('div'); stack.id='toast-stack'; document.body.appendChild(stack); }
  const t = document.createElement('div'); t.className='toast';
  t.innerHTML = `<div class="ic">${icon||'🌱'}</div><div><div class="tt">${title}</div><div class="td">${desc||''}</div></div>`;
  stack.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(30px)'; t.style.transition='all .3s'; setTimeout(()=>t.remove(),300); }, 4200);
};
