/**
 * api/executive-dashboard.js — Velotax Dashboard Executivo Receptivo
 *
 * GET /api/executive-dashboard
 * Retorna KPIs em tempo real por fila, lidos do Supabase
 * (gravados pelo proxy local via WebSocket 55PBX)
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
    const queues = await supabaseGet(
      'realtime_queues?order=queue_name.asc&select=*'
    );

    // Calcula totais
    const totals = queues.reduce((acc, q) => ({
      in_ura:           acc.in_ura           + (q.in_ura           || 0),
      waiting_human:    acc.waiting_human    + (q.waiting_human    || 0),
      in_human_service: acc.in_human_service + (q.in_human_service || 0),
      free_agents:      acc.free_agents      + (q.free_agents      || 0),
    }), { in_ura: 0, waiting_human: 0, in_human_service: 0, free_agents: 0 });

    // Idade do dado mais antigo (proxy pode ter parado)
    const oldest = queues.reduce((min, q) => {
      const t = new Date(q.updated_at).getTime();
      return t < min ? t : min;
    }, Date.now());
    const age_ms = queues.length ? Date.now() - oldest : null;
    const online = age_ms !== null && age_ms < 30000;

    return res.status(200).json({
      meta: {
        fonte:  'websocket_55pbx_via_supabase',
        online,
        age_ms,
        queues_count: queues.length,
      },
      totals,
      by_queue: queues.map(q => ({
        queue:            q.queue_name,
        in_ura:           q.in_ura           || 0,
        waiting_human:    q.waiting_human    || 0,
        in_human_service: q.in_human_service || 0,
        free_agents:      q.free_agents      || 0,
        agents_paused:    q.agents_paused    || 0,
        agents_busy:      q.agents_busy      || 0,
        updated_at:       q.updated_at,
      })),
    });

  } catch (err) {
    console.error('[executive-dashboard]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
