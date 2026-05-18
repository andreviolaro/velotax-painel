/**
 * api/fila.js — Velotax Telefonia "Em Fila"
 *
 * Problema identificado: a 55PBX envia 3+ pushes por ligação.
 * Solução: só insere na fila se o call_id não estiver no histórico de hoje
 * (ou seja, se ainda não foi encerrado).
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

  // ── GET → chamadas ativas agora ───────────────────────────
  if (req.method === 'GET') {
    try {
      // Limpeza de segurança: remove chamadas com mais de 2h
      await supabase('DELETE',
        `calls_in_queue?received_at=lt.${new Date(Date.now() - 2*60*60*1000).toISOString()}`
      );
      const calls = await supabase('GET', 'calls_in_queue?order=received_at.asc');
      return res.status(200).json({ ok: true, calls });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── POST → webhook 55PBX ──────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;
    if (!body?.call_id) return res.status(400).json({ error: 'call_id ausente' });

    const callId = String(body.call_id);
    const first  = isFirstPush(body);
    const recept = isReceptive(body);

    console.log('[fila]', callId,
      '| queue:', body.call_queue || '(vazio)',
      '| call_time:', body.call_time,
      '| audio:', body.call_url_audio ? 'SIM' : 'NÃO',
      '| wait:', body.call_time_waiting,
      '| isFirst:', first);

    try {
      if (!first) {
        // ── 2º push (tem áudio ou call_time > 0) → encerra ──────
        await supabase('DELETE', `calls_in_queue?call_id=eq.${callId}`);

        const waitingSecs = parseInt(body.call_time_waiting) || 0;
        if (recept && waitingSecs > 0 && body.call_queue) {
          await supabase('POST', 'calls_history_today', {
            call_id:           callId,
            call_queue:        body.call_queue,
            call_time_waiting: waitingSecs,
            call_status:       body.call_status || '',
            finished_at:       new Date().toISOString(),
          });
        }
        console.log(`[fila] -dequeued ${callId} | wait: ${waitingSecs}s | status: ${body.call_status}`);

      } else if (recept && body.call_queue) {
        // ── Push sem áudio/tempo — só insere se NÃO foi encerrado ainda ──
        // Verifica se já está no histórico de hoje (já encerrado)
        const already = await supabase('GET',
          `calls_history_today?call_id=eq.${callId}&select=call_id&limit=1`
        );

        if (already && already.length > 0) {
          // Já encerrado — ignora e garante remoção da fila ativa
          await supabase('DELETE', `calls_in_queue?call_id=eq.${callId}`);
          console.log(`[fila] IGNORADO ${callId} — já no histórico (encerrado)`);
        } else {
          // Ainda não encerrado — insere/atualiza na fila ativa
          await supabase('POST', 'calls_in_queue', {
            call_id:        callId,
            call_number:    body.call_number    || '',
            call_area_code: body.call_area_code || '',
            call_queue:     body.call_queue,
            call_type:      body.call_type      || '',
            call_status:    'em_fila',
            call_ura:       body.call_ura       || '',
            central_id:     body.central_id     || '',
            branch_mask:    String(body.branch_mask || ''),
            received_at:    new Date().toISOString(),
          });
          console.log(`[fila] +queued ${callId} → ${body.call_queue}`);
        }
      }
    } catch (err) {
      console.error('[fila] error:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
