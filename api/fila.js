/**
 * api/fila.js — Velotax Telefonia "Em Fila"
 *
 * Recebe o webhook da 55PBX (POST) e responde ao painel (GET).
 * Grava/remove chamadas na tabela `calls_in_queue` do Supabase.
 *
 * Variáveis de ambiente necessárias no Vercel:
 *   SUPABASE_URL          → https://jxqpisrkjicapvtbyvzp.supabase.co
 *   SUPABASE_SERVICE_KEY  → chave "service_role" do Supabase (Settings → API)
 *   WEBHOOK_SECRET        → qualquer string segura, ex: velotax_fila_2026
 */

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WEBHOOK_SECRET      = process.env.WEBHOOK_SECRET;

// ─── Cliente Supabase mínimo (sem SDK, só fetch) ──────────────────────────────
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

// ─── Detectores de push ───────────────────────────────────────────────────────
function isFirstPush(body) {
  return !body.call_url_audio && !(Number(body.call_time) > 0);
}

function isReceptiveQueue(body) {
  const type = (body.call_type || '').toLowerCase();
  return (type === 'receptivo' || type === 'receptive') && Boolean(body.call_queue);
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS — permite o painel React chamar de qualquer origem
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-webhook-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET /api/fila → painel busca chamadas em fila ─────────────────────────
  if (req.method === 'GET') {
    try {
      const calls = await supabase('GET', 'calls_in_queue?order=received_at.asc');
      return res.status(200).json({ ok: true, calls });
    } catch (err) {
      console.error('[fila] GET error:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── POST /api/fila → webhook da 55PBX ─────────────────────────────────────
  if (req.method === 'POST') {
    // Validação do secret
    if (WEBHOOK_SECRET) {
      const token = req.headers['x-webhook-secret'] || req.headers['authorization'];
      const clean = (token || '').replace('Bearer ', '');
      if (clean !== WEBHOOK_SECRET) {
        console.warn('[fila] webhook token inválido');
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const body = req.body;
    if (!body?.call_id) {
      return res.status(400).json({ error: 'call_id ausente' });
    }

    const callId = String(body.call_id);

    try {
      if (isFirstPush(body) && isReceptiveQueue(body)) {
        // 1º push → insere na fila
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
        // 2º push → remove da fila
        await supabase('DELETE', `calls_in_queue?call_id=eq.${callId}`);
        console.log(`[fila] -dequeued ${callId} | status: ${body.call_status} | wait: ${body.call_time_waiting}s`);
      }
    } catch (err) {
      console.error('[fila] Supabase error:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
