/**
 * AI Insight — optional LLM narrative layer on top of the deterministic
 * GreenScore/ai-router engines.
 * ---------------------------------------------------------------
 * Design principle (kept from ai-router.js): the NUMBERS — category,
 * urgency, confidence, GreenScore — must stay deterministic and
 * reproducible. An LLM should never be the thing deciding a score,
 * because that becomes an unverifiable black box.
 *
 * What an LLM *is* good at: turning that structured, already-computed
 * output into a short, readable sentence for a human. That's all this
 * module does — it takes the deterministic result and asks Claude to
 * phrase it naturally. If ANTHROPIC_API_KEY isn't set, everything still
 * works; you just get the deterministic summary instead of the
 * LLM-phrased one. Nothing in the app depends on this being present.
 *
 * To enable: set ANTHROPIC_API_KEY=sk-ant-... in backend/.env
 * (get a key at https://console.anthropic.com/settings/keys).
 */
const MODEL = 'claude-sonnet-4-6';

async function narrateReport(report) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null; // caller falls back to the deterministic summary

  const prompt = `A student filed this campus environmental report:
Title: ${report.title}
Location: ${report.location}
Description: ${report.description}

Our deterministic engine already classified it as:
Category: ${report.ai.category}
Urgency: ${report.ai.urgency}
Responsible team: ${report.ai.responsibleTeam}
Confidence: ${report.ai.confidence}%

Write ONE short, human, reassuring sentence (max 30 words) for the student confirming what happens next. Do not invent new facts, categories, or teams beyond what's given. Return only the sentence, no preamble.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      console.warn('AI Insight: Anthropic API returned', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text = (data.content || []).map(b => b.text || '').join('').trim();
    return text || null;
  } catch (err) {
    console.warn('AI Insight: request failed, falling back to deterministic summary.', err.message);
    return null;
  }
}

module.exports = { narrateReport, ENABLED: !!process.env.ANTHROPIC_API_KEY };
