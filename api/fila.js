/**
 * api/fila.js — Velotax Telefonia "Em Fila"
 *
 * Solução definitiva para pushes tardios da 55PBX:
 * Em vez de deletar no 2º push, marca como finished_at.
 * Pushes tardios fazem upsert mas não apagam o finished_at (campo not null = encerrado).
 * O GET filtra apenas chamadas sem finished_at.
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

  // ── GET → chamadas ativas (sem finished_at) ───────────────
  if (req.method === 'GET') {
    try {
      // Limpa chamadas antigas (>2h) para evitar acúmulo
      await supabase('DELETE',
        `calls_in_queue?received_at=lt.${new Date(Date.now() - 2*60*60*1000).toISOString()}`
      );
      // Retorna apenas chamadas ainda na fila (sem finished_at)
      const calls = await supabase('GET',
        'calls_in_queue?finished_at=is.null&order=received_at.asc'
      );
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
        // ── 2º push — marca como encerrada (finished_at) ─────
        const now = new Date().toISOString();
        const waitingSecs = parseInt(body.call_time_waiting) || 0;

        // Marca a chamada como encerrada na calls_in_queue
        // Upsert: se não existia, cria com finished_at; se existia, atualiza finished_at
        await supabase('POST', 'calls_in_queue', {
          call_id:        callId,
          call_number:    body.call_number    || '',
          call_area_code: body.call_area_code || '',
          call_queue:     body.call_queue     || '',
          call_type:      body.call_type      || '',
          call_status:    body.call_status    || '',
          call_ura:       body.call_ura       || '',
          central_id:     body.central_id     || '',
          branch_mask:    String(body.branch_mask || ''),
          received_at:    now,
          finished_at:    now,  // ← marca como encerrada
        });

        // Grava no histórico com tempo real de espera
        if (recept && body.call_queue) {
          await supabase('POST', 'calls_history_today', {
            call_id:           callId,
            call_queue:        body.call_queue,
            call_time_waiting: waitingSecs,
            call_status:       body.call_status || '',
            finished_at:       now,
          });
        }

        console.log(`[fila] -finished ${callId} | wait: ${waitingSecs}s | status: ${body.call_status}`);

      } else if (recept && body.call_queue) {
        // ── 1º push — insere/atualiza SOMENTE se não estiver encerrada ──
        // O upsert com "resolution=merge-duplicates" atualiza campos
        // MAS não sobrescreve finished_at se já estiver preenchido
        // (usamos PATCH condicional via query filter)
        const patchRes = await fetch(
          `${SUPABASE_URL}/rest/v1/calls_in_queue?call_id=eq.${callId}&finished_at=is.null`,
          {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              call_number:    body.call_number    || '',
              call_area_code: body.call_area_code || '',
              call_queue:     body.call_queue,
              call_type:      body.call_type      || '',
              call_status:    'em_fila',
            }),
          }
        );

        // Se não atualizou nenhuma linha (chamada não existe ou já encerrada)
        const count = patchRes.headers.get('content-range');
        if (!count || count === '*/0') {
          // Verifica se já existe encerrada
          const existing = await supabase('GET',
            `calls_in_queue?call_id=eq.${callId}&select=finished_at&limit=1`
          );
          if (existing && existing.length > 0 && existing[0].finished_at) {
            console.log(`[fila] IGNORADO ${callId} — já encerrada`);
          } else {
            // Nova chamada — insere
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
              finished_at:    null,
            });
            console.log(`[fila] +queued ${callId} → ${body.call_queue}`);
          }
        } else {
          console.log(`[fila] ~updated ${callId} → ${body.call_queue}`);
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
