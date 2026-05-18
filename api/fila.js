/**
 * api/fila.js — Velotax Telefonia "Em Fila"
 *
 * POST → recebe webhook da 55PBX
 *   1º push: grava em calls_in_queue (chamada aguardando)
 *   2º push: remove de calls_in_queue + grava em calls_history_today (tempo real de espera)
 *
 * GET → retorna chamadas ativas agora (calls_in_queue)
 */

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'resolution=merge-duplicates' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path} → ${res.status}: ${await res.text()}`);
  return method === 'GET' ? res.json() : res.status;
}

function isFirstPush(body) {
  const hasAudio = body.call_url_audio && String(body.call_url_audio).trim() !== '';
  const hasTime  = Number(body.call_time) > 0;
  return !hasAudio && !hasTime;
}

function isReceptive(body) {
  const type = (body.call_type || '').toLowerCase();
  return type === 'receptivo' || type === 'receptive';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-webhook-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET → chamadas ativas agora ───────────────────────────────
  if (req.method === 'GET') {
    try {
      const calls = await supabase('GET', 'calls_in_queue?order=received_at.asc');
      return res.status(200).json({ ok: true, calls });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── POST → webhook 55PBX ──────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;
    if (!body?.call_id) return res.status(400).json({ error: 'call_id ausente' });

    const callId = String(body.call_id);

    console.log('[fila] POST | call_id:', callId,
      '| call_type:', body.call_type,
      '| call_queue:', body.call_queue || '(vazio)',
      '| call_time_waiting:', body.call_time_waiting,
      '| isFirst:', isFirstPush(body),
      '| isReceptive:', isReceptive(body));

    try {
      if (isFirstPush(body) && isReceptive(body)) {
        // 1º push — chamada entra na fila
        if (body.call_queue) {
          await supabase('POST', 'calls_in_queue', {
            call_id:        callId,
            call_number:    body.call_number    || '',
            call_area_code: body.call_area_code || '',
            call_queue:     body.call_queue,
            call_type:      body.call_type      || '',
            call_status:    body.call_status    || 'em_fila',
            call_ura:       body.call_ura       || '',
            central_id:     body.central_id     || '',
            branch_mask:    String(body.branch_mask || ''),
            received_at:    new Date().toISOString(),
          });
          console.log(`[fila] +queued ${callId} → ${body.call_queue}`);
        }
      } else {
        // 2º push — chamada encerrada

        // Remove da fila ativa
        await supabase('DELETE', `calls_in_queue?call_id=eq.${callId}`);

        // Grava no histórico do dia com o tempo real de espera
        // call_time_waiting vem em segundos no 2º push
        const waitingSecs = parseInt(body.call_time_waiting) || 0;
        if (isReceptive(body) && waitingSecs > 0) {
          await supabase('POST', 'calls_history_today', {
            call_id:          callId,
            call_queue:       body.call_queue || '',
            call_time_waiting: waitingSecs,
            call_status:      body.call_status || '',
            finished_at:      new Date().toISOString(),
          });
        }

        console.log(`[fila] -dequeued ${callId} | wait: ${waitingSecs}s | status: ${body.call_status}`);
      }
    } catch (err) {
      console.error('[fila] Supabase error:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
