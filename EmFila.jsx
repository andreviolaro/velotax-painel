/**
 * EmFila.jsx — Velotax Telefonia "Em Fila"
 *
 * Faz polling em GET /api/fila a cada 3s e exibe as chamadas receptivas
 * aguardando atendimento. Sem WebSocket, sem dependência extra.
 *
 * Uso:
 *   import EmFila from './EmFila';
 *   <EmFila />
 */

import { useState, useEffect, useRef } from 'react';

// ─── Paleta Velotax ──────────────────────────────────────────────────────────
const C = {
  blue:   '#1634FF',
  navy:   '#000058',
  ice:    '#F3F7FC',
  teal:   '#006AB9',
  gold:   '#FCC200',
  green:  '#15A237',
  red:    '#C0392B',
  border: '#E2E8F0',
  text:   '#1A1D23',
  muted:  '#6B7280',
  bg:     '#F5F7FA',
  white:  '#FFFFFF',
};

// ─── Utilitários ─────────────────────────────────────────────────────────────
function fmtWait(receivedAt) {
  const ms = Date.now() - new Date(receivedAt).getTime();
  const s  = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function waitColor(receivedAt) {
  const s = (Date.now() - new Date(receivedAt).getTime()) / 1000;
  if (s < 60)  return C.green;
  if (s < 120) return '#B8860B';
  return C.red;
}

function fmtPhone(num = '') {
  return num
    .replace(/^\+55/, '+55 ')
    .replace(/(\d{2})(\d{4,5})(\d{4})$/, '$1 $2-$3') || '—';
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function Metric({ label, value, color }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color || C.text }}>{value}</div>
    </div>
  );
}

function QueueChip({ name }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
      background: 'rgba(22,52,255,0.07)', color: C.blue,
      border: `1px solid rgba(22,52,255,0.2)`,
      display: 'inline-block', maxWidth: 130,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>{name}</span>
  );
}

function StatusBadge({ status }) {
  const isWaiting = status === 'em_fila' || !status;
  return (
    <span style={{
      padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500,
      background: isWaiting ? '#FFF8E1' : 'rgba(22,52,255,0.08)',
      color:      isWaiting ? '#7A5C00' : C.navy,
      border:     `1px solid ${isWaiting ? '#F9C74F' : 'rgba(22,52,255,0.25)'}`,
    }}>
      {isWaiting ? 'Aguardando' : 'Tocando'}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function EmFila() {
  const [calls, setCalls]     = useState([]);
  const [status, setStatus]   = useState('connecting'); // connecting | ok | error
  const [lastUpdate, setLast] = useState(null);
  const [filter, setFilter]   = useState('all');
  const [tick, setTick]       = useState(0);
  const intervalRef = useRef(null);

  // ── Polling a cada 3s ────────────────────────────────────────────────────
  async function fetchFila() {
    try {
      const res = await fetch('/api/fila');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCalls(data.calls || []);
      setLast(Date.now());
      setStatus('ok');
    } catch (err) {
      console.error('[EmFila] fetch error:', err.message);
      setStatus('error');
    }
  }

  useEffect(() => {
    fetchFila();
    intervalRef.current = setInterval(fetchFila, 3000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // ── Ticker para atualizar timers a cada 1s ───────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Métricas ─────────────────────────────────────────────────────────────
  const now    = Date.now();
  const waits  = calls.map(c => now - new Date(c.received_at).getTime());
  const avgMs  = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0;
  const maxMs  = waits.length ? Math.max(...waits) : 0;

  // ── Filtro ───────────────────────────────────────────────────────────────
  const displayed = calls.filter(c => {
    if (filter === 'all')     return true;
    if (filter === 'waiting') return c.call_status === 'em_fila' || !c.call_status;
    if (filter === 'ringing') return c.call_status !== 'em_fila';
    return true;
  });

  const cols = '28px 1fr 140px 100px 115px 110px';

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: C.bg, borderRadius: 14, padding: 20 }}>
      <style>{`
        @keyframes veloPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.85)} }
        .ef-row:hover { background: #EEF2FF !important; }
        .ef-filter { cursor:pointer; transition:all .15s; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Em fila</span>
        </div>

        {/* Status de conexão */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
          background: status === 'ok' ? 'rgba(21,162,55,.08)' : status === 'error' ? 'rgba(192,57,43,.08)' : 'rgba(107,114,128,.08)',
          color:      status === 'ok' ? C.green : status === 'error' ? C.red : C.muted,
          border:     `1px solid ${status === 'ok' ? 'rgba(21,162,55,.25)' : status === 'error' ? 'rgba(192,57,43,.25)' : 'rgba(107,114,128,.2)'}`,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: status === 'ok' ? C.green : status === 'error' ? C.red : C.muted,
            animation: status === 'ok' ? 'veloPulse 1.4s infinite' : 'none',
          }}/>
          {status === 'ok' ? 'Ao vivo' : status === 'error' ? 'Erro de conexão' : 'Conectando…'}
        </span>
      </div>

      {/* ── Métricas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <Metric label="Na fila"       value={calls.length}                          color={C.blue} />
        <Metric label="Espera média"  value={calls.length ? fmtWait(new Date(now - avgMs).toISOString()) : '—'} color="#B8860B" />
        <Metric label="Maior espera"  value={calls.length ? fmtWait(new Date(now - maxMs).toISOString()) : '—'} color={maxMs > 120000 ? C.red : C.text} />
        <Metric label="Atualizado em" value={lastUpdate ? fmtTime(new Date(lastUpdate).toISOString()) : '—'} color={C.muted} />
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
        {[{ k: 'all', l: 'Todas' }, { k: 'waiting', l: 'Aguardando' }, { k: 'ringing', l: 'Tocando' }].map(f => (
          <button key={f.k} className="ef-filter"
            onClick={() => setFilter(f.k)}
            style={{
              padding: '4px 13px', borderRadius: 20, fontSize: 12,
              border: filter === f.k ? `1.5px solid ${C.blue}` : `1px solid ${C.border}`,
              background: filter === f.k ? C.blue : C.white,
              color: filter === f.k ? '#fff' : C.muted,
              fontWeight: filter === f.k ? 600 : 400,
            }}>
            {f.l}
          </button>
        ))}
      </div>

      {/* ── Tabela ── */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '9px 16px', gap: 10, background: '#F8FAFC', borderBottom: `1px solid ${C.border}` }}>
          {['#', 'Número', 'Fila', 'Espera', 'Entrada', 'Status'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
          ))}
        </div>

        {/* Linhas */}
        {displayed.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px', gap: 10, color: C.muted }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
            <span style={{ fontSize: 13 }}>
              {status === 'error' ? 'Erro ao buscar dados — verifique a conexão.' : 'Nenhuma chamada na fila agora.'}
            </span>
          </div>
        ) : (
          displayed.map((call, i) => (
            <div key={call.call_id} className="ef-row"
              style={{ display: 'grid', gridTemplateColumns: cols, padding: '11px 16px', gap: 10, alignItems: 'center', borderBottom: i < displayed.length - 1 ? `1px solid ${C.border}` : 'none', background: C.white, transition: 'background .15s' }}>

              <span style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>{i + 1}</span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                  {fmtPhone(call.call_number)}
                </span>
                <span style={{ fontSize: 11, color: C.muted }}>
                  DDD {call.call_area_code || '—'} · {call.call_type}
                  {call.call_ura ? ` · URA: ${call.call_ura}` : ''}
                </span>
              </div>

              <QueueChip name={call.call_queue} />

              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: waitColor(call.received_at) }}>
                {fmtWait(call.received_at)}
              </span>

              <span style={{ fontSize: 12, color: C.muted, fontFamily: 'monospace' }}>
                {fmtTime(call.received_at)}
              </span>

              <StatusBadge status={call.call_status} />
            </div>
          ))
        )}
      </div>

      {/* ── Rodapé ── */}
      <div style={{ marginTop: 10, fontSize: 11, color: C.muted, paddingLeft: 2 }}>
        Webhook 55PBX → Supabase · polling 3s · timer via <code style={{ fontSize: 10 }}>received_at</code>
      </div>
    </div>
  );
}
