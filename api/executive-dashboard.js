/**
 * api/executive-dashboard.js — Dashboard Executivo Receptivo
 *
 * GET /api/executive-dashboard
 *
 * Retorna:
 * - Na fila agora: chamadas ativas em calls_in_queue (tempo real)
 * - Espera média do dia: média de call_time_waiting de calls_history_today
 * - Maior espera do dia: max de call_time_waiting de calls_history_today
 * - Por fila: abertura das métricas acima por fila
 */

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  try {
    // Busca em paralelo: fila ativa + histórico do dia
    const [active, history] = await Promise.all([
      supabaseGet('calls_in_queue?order=received_at.asc&select=call_id,call_queue,received_at'),
      supabaseGet('calls_history_today?select=call_id,call_queue,call_time_waiting'),
    ]);

    // ── Fila ativa (tempo real) ───────────────────────────────
    // Agrupa por fila
    const activeByQueue = {};
    for (const call of active) {
      const q = call.call_queue || 'Sem fila';
      if (!activeByQueue[q]) activeByQueue[q] = 0;
      activeByQueue[q]++;
    }

    // ── Histórico do dia (espera real do 2º push) ─────────────
    const histByQueue = {};
    for (const h of history) {
      const q = h.call_queue || 'Sem fila';
      if (!histByQueue[q]) histByQueue[q] = [];
      histByQueue[q].push(h.call_time_waiting);
    }

    // Totais histórico
    const allWaits  = history.map(h => h.call_time_waiting);
    const avgWait   = allWaits.length ? Math.round(allWaits.reduce((a,b)=>a+b,0) / allWaits.length) : 0;
    const maxWait   = allWaits.length ? Math.max(...allWaits) : 0;

    // ── Por fila — só filas com chamada ativa OU com histórico ─
    const allQueues = new Set([
      ...Object.keys(activeByQueue),
      ...Object.keys(histByQueue),
    ]);

    const by_queue = Array.from(allQueues)
      .map(q => {
        const waits  = histByQueue[q] || [];
        const avg    = waits.length ? Math.round(waits.reduce((a,b)=>a+b,0) / waits.length) : 0;
        const max    = waits.length ? Math.max(...waits) : 0;
        const active_now = activeByQueue[q] || 0;
        return { queue: q, waiting_now: active_now, avg_wait_s: avg, max_wait_s: max };
      })
      // Mostra só filas que têm espera agora ou tiveram espera hoje
      .filter(q => q.waiting_now > 0 || q.avg_wait_s > 0)
      .sort((a,b) => b.waiting_now - a.waiting_now);

    return res.status(200).json({
      meta: { fonte: 'webhook_55pbx_supabase', ts: Date.now() },
      totals: {
        waiting_now: active.length,   // chamadas na fila agora
        avg_wait_s:  avgWait,          // espera média do dia
        max_wait_s:  maxWait,          // maior espera do dia
      },
      by_queue,
    });

  } catch (err) {
    console.error('[executive-dashboard]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
