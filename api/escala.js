// api/escala.js — lê colaboradores do Supabase e calcula trabalhaHoje

const { sendJson } = require('./_shared');

const SUPA_URL = process.env.SUPABASE_URL || 'https://jxqpisrkjicapvtbyvzp.supabase.co';
const SUPA_KEY = process.env.SUPABASE_KEY || 'sb_publishable_s8dhxF04kGv-_pgPmVdl6w_gMZV0xxa';

// ── Calendário rotativo (ramal → semanas) ────────────────────────
// Referência: sábado 21/03/2026 = índice 0
// sab[i]: 'S'=trabalha, 'F'=folga no sábado  |  escSem[i]: 0=sem folga dia útil, 1-5=folga naquele dia
const SAB_REF = new Date(2026, 2, 21);
const CALENDARIO = {
  '5093':{ sab:['S','F','S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','F','F'], escSem:[1,0,2,3,0,4,5,0,1,0,2,3,0,4,5,0,2,3,0,4,5,0,0,0]}, // Adriana
  '5109':{ sab:['S','F','S','S','F','S','F','S','S','F','S','S','F','S','F','F','S','S','F','S','F','S','F','F'], escSem:[2,0,3,4,0,5,0,1,2,0,3,4,0,5,0,0,3,4,0,5,0,1,0,0]}, // Jeniffer
  '5096':{ sab:['S','F','S','F','S','S','F','S','S','F','S','F','S','S','F','F','S','F','S','S','F','S','F','F'], escSem:[4,0,5,0,1,2,0,3,4,0,5,0,1,2,0,0,5,0,1,2,0,3,0,0]}, // Vanessa P
  '5095':{ sab:['S','F','S','S','F','S','F','S','S','F','S','S','F','S','F','F','S','S','F','S','F','S','F','F'], escSem:[3,0,4,5,0,1,0,2,3,0,4,5,0,1,0,0,4,5,0,1,0,2,0,0]}, // Alini
  '5087':{ sab:['S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','S','F','F','F'], escSem:[1,2,0,3,4,0,5,0,1,2,0,3,4,0,5,2,0,3,4,0,5,0,0,0]}, // André
  '5098':{ sab:['F','S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','S','F','F'], escSem:[0,1,2,0,3,4,0,5,0,1,2,0,3,4,0,1,2,0,3,4,0,5,0,0]}, // Beatriz
  '5107':{ sab:['S','S','F','S','F','S','S','F','S','S','F','S','F','S','S','S','F','S','F','S','S','F','F','F'], escSem:[3,4,0,5,0,1,2,0,3,4,0,5,0,1,2,4,0,5,0,1,2,0,0,0]}, // Camila S
  '5100':{ sab:['F','S','S','F','S','F','S','S','F','S','S','F','S','F','S','S','S','F','S','F','S','S','F','F'], escSem:[0,3,4,0,5,0,1,2,0,3,4,0,5,0,1,3,4,0,5,0,1,2,0,0]}, // Claudia
  '5097':{ sab:['S','F','S','F','S','S','F','S','S','F','S','F','S','S','F','F','S','F','S','S','F','S','F','F'], escSem:[5,0,1,0,2,3,0,4,5,0,1,0,2,3,0,0,1,0,2,3,0,4,0,0]}, // Cristian
  '5106':{ sab:['F','S','F','S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','F'], escSem:[0,1,0,2,3,0,4,5,0,1,0,2,3,0,4,1,0,2,3,0,4,5,0,0]}, // Jonatas
  '5090':{ sab:['S','S','F','S','F','S','S','F','S','S','F','S','F','S','S','S','F','S','F','S','S','F','F','F'], escSem:[4,5,0,1,0,2,3,0,4,5,0,1,0,2,3,5,0,1,0,2,3,0,0,0]}, // Karina B
  '5099':{ sab:['F','S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','S','F','F'], escSem:[0,2,3,0,4,5,0,1,0,2,3,0,4,5,0,2,3,0,4,5,0,1,0,0]}, // Karina F
  '5105':{ sab:['F','S','F','S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','F'], escSem:[0,5,0,1,2,0,3,4,0,5,0,1,2,0,3,5,0,1,2,0,3,4,0,0]}, // Milena
  '5088':{ sab:['S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','S','F','F','F'], escSem:[2,3,0,4,5,0,1,0,2,3,0,4,5,0,1,3,0,4,5,0,1,0,0,0]}, // Nicolas
  '5103':{ sab:['F','S','S','F','S','F','S','S','F','S','S','F','S','F','S','S','S','F','S','F','S','S','F','F'], escSem:[0,4,5,0,1,0,2,3,0,4,5,0,1,0,2,4,5,0,1,0,2,3,0,0]}, // Vanessa A
  '5108':{ sab:['S','F','S','S','F','S','F','S','S','F','S','S','F','S','F','F','S','S','F','S','F','S','F','F'], escSem:[2,0,3,4,0,5,0,1,2,0,3,4,0,5,0,0,3,4,0,5,0,1,0,0]}, // Victor V
  '5092':{ sab:['S','F','S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','F','F'], escSem:[5,0,1,2,0,3,4,0,5,0,1,2,0,3,4,0,1,2,0,3,4,0,0,0]}, // Taniele
  '5110':{ sab:['S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','S','F','F','F'], escSem:[2,3,0,4,5,0,1,0,2,3,0,4,5,0,1,3,0,4,5,0,1,0,0,0]}, // Luiza
};

function getWeekIndex(hoje) {
  const diff = hoje.getTime() - SAB_REF.getTime();
  return Math.max(0, Math.floor(diff / (7 * 24 * 3600 * 1000)));
}

function calculaTrabalhaHoje(tipo_escala, ramal, diaSemana, semIdx, folgaDiaBanco) {
  if (tipo_escala === 'velo')     return diaSemana >= 1 && diaSemana <= 5;
  if (tipo_escala === 'job_sabqua') return [0,1,2,3,6].includes(diaSemana);
  if (tipo_escala === 'job_segsex') return diaSemana >= 1 && diaSemana <= 5;
  if (tipo_escala === 'job_rot') {
    // Usa folga_dia cadastrado no painel (0=sem folga, 1-5=dia da semana)
    // Fallback: calendário anual codificado
    const folgaDia = parseInt(folgaDiaBanco) || 0;
    const cal = CALENDARIO[ramal];
    const calIdx = cal ? Math.min(semIdx, cal.sab.length - 1) : -1;

    if (diaSemana === 0) return false; // Dom: nunca
    if (diaSemana === 6) {
      // Sáb: usa calendário anual se disponível
      return cal ? cal.sab[calIdx] === 'S' : false;
    }
    // Dia útil: usa folga_dia do banco se configurado, senão calendário
    const diaFolga = folgaDia > 0 ? folgaDia : (cal ? (cal.escSem[calIdx] || 0) : 0);
    return diaFolga !== diaSemana;
  }
  return false;
}

module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const resp = await fetch(
      SUPA_URL + '/rest/v1/colaboradores?ativo=eq.true&order=empresa.asc,nome.asc&select=*',
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    );

    if (!resp.ok) {
      const err = await resp.text();
      return sendJson(res, { error: 'Supabase: ' + err }, 502);
    }

    const agentes = await resp.json();
    const hoje    = new Date();
    const dia     = hoje.getDay();
    const semIdx  = getWeekIndex(hoje);

    const escala = agentes.map(a => ({
      id:           a.id,
      name:         a.nome,
      ramal:        a.ramal,
      empresa:      a.empresa,
      entrada:      a.entrada,
      saida:        a.saida,
      tipo:         a.tipo_escala,
      trabalhaHoje: calculaTrabalhaHoje(a.tipo_escala, a.ramal, dia, semIdx, a.folga_dia),
    }));

    return sendJson(res, escala, 200);

  } catch (err) {
    return sendJson(res, { error: err.message }, 502);
  }
};
