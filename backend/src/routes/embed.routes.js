/**
 * EMBED — the "we are a layer, not a competing app" proof.
 * ===============================================================
 * Any event page anywhere (AllCollegeEvent, a club's own site, a
 * Google Site) can render a live GreenScore badge with one tag:
 *
 *   <script src="http://localhost:4000/api/embed/widget.js"
 *           data-event-id="e_xxxx"></script>
 *
 * This matters strategically: GreenGrid does not need to be adopted as
 * a destination to be useful. The integration point already exists and
 * already works, which is a far stronger thing to show a partner than
 * a request to be integrated.
 *
 * These routes are mounted BEFORE the API-key middleware in server.js —
 * a public badge cannot carry a secret, since anyone viewing the host
 * page could read it. They are therefore strictly read-only and expose
 * only what the event page already shows publicly.
 */
const express = require('express');
const { Events, Pools, Goals, Certificates } = require('../data/db');
const { computeGreenScore } = require('../utils/greenscore');

const router = express.Router();

/** Public, read-only badge data for one event. */
router.get('/event/:id', (req, res) => {
  const ev = Events.find(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  const model = computeGreenScore(ev);
  const goal = Goals.forEvent(ev.id);
  res.json({
    id: ev.id,
    title: ev.title,
    greenScore: ev.greenScore,
    certified: ev.certified,
    co2EstimateKg: ev.co2EstimateKg,
    modelVersion: model.modelVersion,
    counterfactual: model.counterfactual,
    ecoPoolGroups: Pools.forEvent(ev.id).length,
    goal: goal ? { targetCo2Kg: goal.targetCo2Kg, currentCo2Kg: goal.currentCo2Kg, achieved: goal.achieved } : null,
  });
});

/**
 * The widget loader. Renders into the host page inside a shadow root so
 * the host site's CSS cannot leak in and GreenGrid's styles cannot leak
 * out — an embeddable badge that breaks someone's layout will simply be
 * removed, so isolation is the feature.
 */
router.get('/widget.js', (req, res) => {
  res.type('application/javascript');
  res.send(`(function(){
  var me = document.currentScript;
  var eventId = me && me.getAttribute('data-event-id');
  var theme = (me && me.getAttribute('data-theme')) || 'dark';
  var origin = new URL(me.src).origin;
  if (!eventId) { console.warn('[GreenGrid] data-event-id missing'); return; }

  var host = document.createElement('div');
  host.style.display = 'inline-block';
  me.parentNode.insertBefore(host, me);
  var root = host.attachShadow({ mode: 'open' });

  var dark = theme !== 'light';
  var bg = dark ? '#0D1F17' : '#F4F8F2';
  var fg = dark ? '#EEF3EA' : '#0D1F17';
  var dim = dark ? '#9FB3A8' : '#5A6B60';
  var line = dark ? 'rgba(238,243,234,.14)' : 'rgba(13,31,23,.12)';

  root.innerHTML = '<style>'
    + ':host{all:initial}'
    + '.gg{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;'
    + 'background:' + bg + ';color:' + fg + ';border:1px solid ' + line + ';border-radius:14px;'
    + 'padding:14px 16px;display:flex;gap:14px;align-items:center;min-width:250px;box-sizing:border-box}'
    + '.ring{position:relative;width:54px;height:54px;flex:0 0 54px}'
    + '.ring svg{transform:rotate(-90deg)}'
    + '.num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;'
    + 'font-weight:700;font-size:17px;font-variant-numeric:tabular-nums}'
    + '.t{font-weight:600;font-size:13px;line-height:1.25;margin-bottom:3px}'
    + '.s{font-size:11px;color:' + dim + ';line-height:1.4}'
    + '.tag{display:inline-block;margin-top:5px;font-size:9.5px;letter-spacing:.06em;'
    + 'text-transform:uppercase;color:#7CFFB2;border:1px solid rgba(124,255,178,.4);'
    + 'border-radius:99px;padding:2px 7px}'
    + '.gg a{color:' + dim + ';font-size:9.5px;text-decoration:none}'
    + '</style><div class="gg"><div class="ring"></div><div class="body"></div></div>';

  fetch(origin + '/api/embed/event/' + encodeURIComponent(eventId))
    .then(function(r){ if(!r.ok) throw new Error('not found'); return r.json(); })
    .then(function(d){
      var score = d.greenScore;
      var col = score >= 75 ? '#7CFFB2' : score >= 55 ? '#4DE8D4' : '#FFB84D';
      var C = 2 * Math.PI * 24;
      root.querySelector('.ring').innerHTML =
        '<svg width="54" height="54" viewBox="0 0 54 54">'
        + '<circle cx="27" cy="27" r="24" fill="none" stroke="' + line + '" stroke-width="5"/>'
        + '<circle cx="27" cy="27" r="24" fill="none" stroke="' + col + '" stroke-width="5"'
        + ' stroke-linecap="round" stroke-dasharray="' + C + '"'
        + ' stroke-dashoffset="' + (C - (score/100)*C) + '"/></svg>'
        + '<div class="num" style="color:' + col + '">' + score + '</div>';

      var cf = d.counterfactual || {};
      root.querySelector('.body').innerHTML =
        '<div class="t">' + (d.title || 'Event') + '</div>'
        + '<div class="s">GreenScore ' + score + '/100 · est. ' + d.co2EstimateKg + ' kg CO2e'
        + (cf.avoidedKg ? '<br>' + cf.avoidedKg + ' kg avoided vs. no measures' : '')
        + (d.ecoPoolGroups ? '<br>' + d.ecoPoolGroups + ' EcoPool group(s) forming' : '')
        + '</div>'
        + (d.certified ? '<span class="tag">Green Certified</span>' : '')
        + '<div><a href="' + origin + '" target="_blank" rel="noopener">Verified by GreenGrid · '
        + (d.modelVersion || '') + '</a></div>';
    })
    .catch(function(){
      root.querySelector('.body').innerHTML =
        '<div class="t">GreenScore unavailable</div><div class="s">Could not reach GreenGrid.</div>';
    });
})();`);
});

/**
 * Public certificate verification.
 * Lives here rather than in impact.routes.js because everything under
 * /api requires the project API key, and a credential that only a
 * GreenGrid client can check is not a credential. A recruiter or an
 * organiser must be able to confirm a code with nothing but the URL.
 * Returns only what a verifier needs — never the holder's account data.
 */
router.get('/verify/:code', (req, res) => {
  const cert = Certificates.byCode(req.params.code);
  if (!cert) return res.status(404).json({ valid: false, error: 'No certificate with that code.' });
  res.json({
    valid: true,
    certificate: {
      code: cert.code, holder: cert.userName, event: cert.eventTitle,
      actionsCompleted: cert.actionsCompleted, co2Kg: cert.co2Kg,
      eventGreenScore: cert.greenScore, issuedAt: cert.issuedAt,
    },
  });
});

module.exports = router;
