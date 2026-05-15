/**
 * api/fila.js — Velotax Telefonia "Em Fila"
 */

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WEBHOOK_SECRET       = process.env.WEBHOOK_SECRET;

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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${err}`);
  }
  return method === 'GET' ? res.json() : res.status;
}

function isFirstPush(body) {
  // 1º push: sem áudio e call_time ausente ou zero
  const hasAudio = body.call_url_audio && String(body.call_url_audio).trim() !== '';
  const hasTime  = Number(body.call_time) > 0;
  return !hasAudio && !hasTime;
}

function isReceptiveQueue(body) {
  const type = (body.call_type || '').toLowerCase();
  return (type === 'receptivo' || type === 'receptive') && Boolean(body.call_queue);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-webhook-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET → painel busca chamadas ──────────────────────────────
  if (req.method === 'GET') {
    try {
      const calls = await supabase('GET', 'calls_in_queue?order=received_at.asc');
      return res.status(200).json({ ok: true, calls });
    } catch (err) {
      console.error('[fila] GET error:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── POST → webhook da 55PBX ──────────────────────────────────
  if (req.method === 'POST') {
    // Valida secret: aceita via header OU via campo no body (como a 55PBX envia)
    if (WEBHOOK_SECRET) {
      const headerToken = req.headers['x-webhook-secret']
        || req.headers['authorization']?.replace('Bearer ', '')
        || '';
      const bodyToken = req.body?.chave || req.body?.key || req.body?.secret || '';
      const token = headerToken || bodyToken;

      if (token !== WEBHOOK_SECRET) {
        console.warn('[fila] token inválido | header:', headerToken, '| body:', bodyToken);
        // Log do body para diagnóstico sem bloquear — remove depois de confirmar
        console.log('[fila] body recebido:', JSON.stringify(req.body || {}).substring(0, 300));
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const body = req.body;

    // Log completo para diagnóstico
    console.log('[fila] POST recebido | call_id:', body?.call_id, '| call_type:', body?.call_type,
      '| call_queue:', body?.call_queue, '| call_time:', body?.call_time,
      '| call_url_audio:', body?.call_url_audio ? 'SIM' : 'NÃO',
      '| isFirst:', isFirstPush(body||{}), '| isReceptive:', isReceptiveQueue(body||{}));

    if (!body?.call_id) {
      return res.status(400).json({ error: 'call_id ausente' });
    }

    const callId = String(body.call_id);

    try {
      if (isFirstPush(body) && isReceptiveQueue(body)) {
        await supabase('POST', 'calls_in_queue', {
          call_id:        callId,
          call_number:    body.call_number    || '',
          call_area_code: body.call_area_code || '',
          call_queue:     body.call_queue,
          call_type:      body.call_type,
          call_status:    body.call_status    || 'em_fila',
          call_ura:       body.call_ura       || '',
          central_id:     body.central_id     || '',
          branch_mask:    String(body.branch_mask || ''),
          received_at:    new Date().toISOString(),
        });
        console.log(`[fila] +queued ${callId} → ${body.call_queue}`);
      } else {
        await supabase('DELETE', `calls_in_queue?call_id=eq.${callId}`);
        console.log(`[fila] -dequeued ${callId} | status: ${body.call_status}`);
      }
    } catch (err) {
      console.error('[fila] Supabase error:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
