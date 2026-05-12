// api/escala.js - Escala dos agentes embutida diretamente no código
// ─────────────────────────────────────────────────────────────────
// Como o Vercel não tem filesystem persistente, a escala fica aqui.
// Edite o array ESCALA abaixo para adicionar/remover colaboradores.
//
// Campos obrigatórios por agente:
//   id        : identificador único (string)
//   name      : nome do colaborador
//   ramal     : ramal na 55PBX (usado para cruzar com report_04)
//   empresa   : 'Velotax' ou 'JobCenter'
//   entrada   : horário de entrada no formato 'HH:MM'
//   saida     : horário de saída no formato 'HH:MM'
//   tipo      : 'velo' | 'job' | 'job_segsex' | 'job_sabaqua' | 'job_rot'
//               (define quais dias da semana o agente trabalha)
//
// Tipos de escala (dias trabalhados):
//   velo        → Seg a Sex (dias 1–5)
//   job         → Dom a Sab (dias 0–6, todos)
//   job_segsex  → Seg a Sex (dias 1–5)
//   job_sabaqua → Dom, Seg, Ter, Qua, Sab (dias 0,1,2,3,6)
//   job_rot     → Seg a Sab (dias 1–6)
// ─────────────────────────────────────────────────────────────────

const { sendJson } = require('./_shared');

const WORK_DAYS = {
  velo:       [1,2,3,4,5],
  job:        [0,1,2,3,4,5,6],
  job_segsex: [1,2,3,4,5],
  job_sabaqua:[0,1,2,3,6],
  job_rot:    [1,2,3,4,5,6],
};

// ── EDITE AQUI: lista de colaboradores ──────────────────────────
const ESCALA = [
  // Exemplo Velotax:
  // { id:'1', name:'Ana Silva',       ramal:'1001', empresa:'Velotax',   entrada:'08:00', saida:'17:00', tipo:'velo' },
  // { id:'2', name:'Bruno Costa',     ramal:'1002', empresa:'Velotax',   entrada:'09:00', saida:'18:00', tipo:'velo' },

  // Exemplo JobCenter:
  // { id:'3', name:'Carla Souza',     ramal:'2001', empresa:'JobCenter', entrada:'08:00', saida:'17:00', tipo:'job_segsex' },
  // { id:'4', name:'Diego Martins',   ramal:'2002', empresa:'JobCenter', entrada:'09:00', saida:'18:00', tipo:'job_sabaqua' },

  // ↓↓↓ SUBSTITUA PELOS SEUS COLABORADORES REAIS ↓↓↓

];
// ────────────────────────────────────────────────────────────────

module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0=Dom, 1=Seg, ..., 6=Sab

  // Enriquece cada agente com flag trabalhaHoje
  const escalaDia = ESCALA.map(function(a) {
    var dias = WORK_DAYS[a.tipo] || WORK_DAYS.velo;
    return Object.assign({}, a, { trabalhaHoje: dias.includes(diaSemana) });
  });

  return sendJson(res, escalaDia, 200);
};
