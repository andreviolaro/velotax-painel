/**
 * api/executive-dashboard.js — Dashboard Executivo Receptivo
 *
 * GET /api/executive-dashboard
 * Calcula KPIs em tempo real a partir das chamadas ativas no Supabase
 * (gravadas pelo webhook da 55PBX via api/fila.js)
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
    const calls = await supabaseGet('calls_in_queue?order=received_at.asc&select=*');
    const now   = Date.now();

    // Agrupa por fila
    const queueMap = {};
    for (const call of calls) {
      const queue = call.call_queue || 'Sem fila';
      if (!queueMap[queue]) {
        queueMap[queue] = { queue, calls: [], waiting: 0, max_wait_s: 0, avg_wait_s: 0 };
      }
      const waitS = Math.floor((now - new Date(call.received_at).getTime()) / 1000);
      queueMap[queue].calls.push({ ...call, wait_s: waitS });
      queueMap[queue].waiting++;
      if (waitS > queueMap[queue].max_wait_s) queueMap[queue].max_wait_s = waitS;
    }

    // Calcula médias
    const by_queue = Object.values(queueMap).map(q => {
      const avg = q.calls.reduce((s, c) => s + c.wait_s, 0) / q.calls.length;
      return {
        queue:         q.queue,
        waiting_human: q.waiting,
        max_wait_s:    q.max_wait_s,
        avg_wait_s:    Math.round(avg),
        calls:         q.calls.map(c => ({
          call_id:        c.call_id,
          call_number:    c.call_number,
          call_area_code: c.call_area_code,
          call_status:    c.call_status,
          received_at:    c.received_at,
          wait_s:         c.wait_s,
        })),
      };
    });

    // Totais globais
    const allWaits = calls.map(c => Math.floor((now - new Date(c.received_at).getTime()) / 1000));
    const totalWaiting = calls.length;
    const maxWait = allWaits.length ? Math.max(...allWaits) : 0;
    const avgWait = allWaits.length ? Math.round(allWaits.reduce((a,b)=>a+b,0) / allWaits.length) : 0;

    return res.status(200).json({
      meta: {
        fonte:       'webhook_55pbx_supabase',
        online:      true,
        ts:          now,
        total_calls: calls.length,
      },
      totals: {
        waiting_human: totalWaiting,
        max_wait_s:    maxWait,
        avg_wait_s:    avgWait,
      },
      by_queue,
    });

  } catch (err) {
    console.error('[executive-dashboard]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
