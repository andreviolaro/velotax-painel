/**
 * api/fila.js — Velotax Telefonia "Em Fila"
 * 
 * Mostra todos os estados de chamadas receptivas:
 * - Em URA (call_queue vazio, sem áudio, sem tempo)
 * - Em fila/espera (call_queue preenchido, sem áudio, sem tempo)
 * - Tocando / Em atendimento (call_queue preenchido, sem áudio, sem tempo — status diferente)
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${err}`);
  }
  return method === 'GET' ? res.json() : res.status;
}

// 1º push: sem áudio E sem tempo de fala
function isFirstPush(body) {
  const hasAudio = body.call_url_audio && String(body.call_url_audio).trim() !== '';
  const hasTime  = Number(body.call_time) > 0;
  return !hasAudio && !hasTime;
}

// Chamada receptiva (qualquer estado)
function isReceptive(body) {
  const type = (body.call_type || '').toLowerCase();
  return type === 'receptivo' || type === 'receptive';
}

// Determina o status para exibição no painel
function resolveStatus(body) {
  const status = (body.call_status || '').toLowerCase();
  const queue  = body.call_queue || '';

  if (!queue) return 'em_ura';                           // sem fila = na URA
  if (status.includes('attend')) return 'em_atendimento'; // call_attended
  if (status.includes('ring') || status === 'new_call') return 'tocando';
  return 'em_fila';                                       // aguardando na fila
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
    const body = req.body;

    console.log('[fila] POST | call_id:', body?.call_id,
      '| call_type:', body?.call_type,
      '| call_status:', body?.call_status,
      '| call_queue:', body?.call_queue || '(vazio)',
      '| call_time:', body?.call_time,
      '| audio:', body?.call_url_audio ? 'SIM' : 'NÃO',
      '| isFirst:', isFirstPush(body||{}),
      '| isReceptive:', isReceptive(body||{}));

    if (!body?.call_id) {
      return res.status(400).json({ error: 'call_id ausente' });
    }

    const callId = String(body.call_id);

    try {
      if (isFirstPush(body) && isReceptive(body)) {
        // 1º push → insere ou atualiza na tabela
        const status = resolveStatus(body);
        await supabase('POST', 'calls_in_queue', {
          call_id:        callId,
          call_number:    body.call_number    || '',
          call_area_code: body.call_area_code || '',
          call_queue:     body.call_queue     || '',
          call_type:      body.call_type      || '',
          call_status:    status,
          call_ura:       body.call_ura       || '',
          central_id:     body.central_id     || '',
          branch_mask:    String(body.branch_mask || ''),
          received_at:    new Date().toISOString(),
        });
        console.log(`[fila] +queued ${callId} → status: ${status} | fila: ${body.call_queue || 'URA'}`);
      } else {
        // 2º push → remove da tabela
        await supabase('DELETE', `calls_in_queue?call_id=eq.${callId}`);
        console.log(`[fila] -dequeued ${callId} | call_status: ${body.call_status}`);
      }
    } catch (err) {
      console.error('[fila] Supabase error:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
