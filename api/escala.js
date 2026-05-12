// api/escala.js - Escala completa dos colaboradores
// ─────────────────────────────────────────────────────────────────
// Velotax + JobCenter — lógica rotativa calculada por calendário.
// ─────────────────────────────────────────────────────────────────

const { sendJson } = require('./_shared');

// ── VELOTAX — Seg a Sex ──────────────────────────────────────────
const VELOTAX = [
  { id:'681b559f2149f38615dd7f71', name:'Dimas Henrique Gonçalves do Nascimento', ramal:'5049', empresa:'Velotax', entrada:'08:00', saida:'18:00' },
  { id:'67f53458794e8e871e02a9bf', name:'Gabrielli Ribeiro de Assunção',          ramal:'5042', empresa:'Velotax', entrada:'08:00', saida:'18:00' },
  { id:'682f12a4d33feaad25210882', name:'Juliana Aparecida Rofino',               ramal:'5067', empresa:'Velotax', entrada:'08:00', saida:'18:00' },
  { id:'681b5574bd4349860ec7fc10', name:'Laura Ketheleen de Freitas Guedes',      ramal:'5048', empresa:'Velotax', entrada:'08:00', saida:'18:00' },
  { id:'67f534364bdef6cc3c7d028b', name:'Monike Samara Nascimento da Silva',      ramal:'5041', empresa:'Velotax', entrada:'08:00', saida:'18:00' },
  { id:'697cb567b80b2a8b949029df', name:'Victor Oliveira Lima da Silva',          ramal:'5085', empresa:'Velotax', entrada:'08:00', saida:'18:00' },
  { id:'681f83b72a230c105fb420ab', name:'Viviane Barros Silva',                   ramal:'5061', empresa:'Velotax', entrada:'08:00', saida:'18:00' },
  { id:'697cb5032d27488bb70d4289', name:'Camila Nahra Gonçalves',                 ramal:'5084', empresa:'Velotax', entrada:'09:00', saida:'18:00' },
  { id:'681bc0db6889f88627ac40fb', name:'Murilo Mazin Cersozimo Caetano',         ramal:'5057', empresa:'Velotax', entrada:'09:00', saida:'19:00' },
  { id:'67d35c675dd30d5ba62bb287', name:'Laura Porto de Almeida',                 ramal:'5025', empresa:'Velotax', entrada:'09:00', saida:'19:00' },
];

// ── JOBCENTER fixo Sáb–Qua (Dom,Seg,Ter,Qua,Sáb) ────────────────
const JOB_FIXO_SABQUA = [
  { id:'69eb72fcf8f33e17dfa2bd12', name:'Emileiny Siqueira',                    ramal:'5111', empresa:'JobCenter', entrada:'08:00', saida:'16:12' },
  { id:'69ee0af30863f517bcb2ef66', name:'Vinícius de Assunção Ribeiro',         ramal:'5114', empresa:'JobCenter', entrada:'08:00', saida:'16:12' },
  { id:'69ee0acdf8f33e17dfa2d454', name:'Francisco das Chagas de Sousa Filho',  ramal:'5113', empresa:'JobCenter', entrada:'08:00', saida:'16:12' },
  { id:'69ee0a9e7baccb17f52db020', name:'Jonathas Ricardo Miranda',             ramal:'5112', empresa:'JobCenter', entrada:'11:00', saida:'19:00' },
];

// ── JOBCENTER fixo Seg–Sex ───────────────────────────────────────
const JOB_FIXO_SEGSEX = [
  { id:'69aec079ae69eb32259b7175', name:'Guilherme Fernandes Pimentel', ramal:'5089', empresa:'JobCenter', entrada:'09:00', saida:'17:12' },
  { id:'69aec086ae69eb32259b7679', name:'Marcelo Rodrigues de Souza',   ramal:'5101', empresa:'JobCenter', entrada:'09:00', saida:'17:12' },
];

// ── JOBCENTER Rotativos (Seg–Sex + Sáb rotativo) ─────────────────
// Calendário: semana índice 0 = semana com Sáb 21/03/2026
// sab[i]:    'S' = trabalha no sábado daquela semana, 'F' = folga
// escSem[i]: dia útil de folga naquela semana: 0=nenhum, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex
const JOB_ROTATIVO = [
  {
    id:'69aec07dae69eb32259b7301', name:'Adriana Pimentel dos Santos', ramal:'5093',
    empresa:'JobCenter', entrada:'08:00', saida:'16:12',
    sab:    ['S','F','S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','F','F'],
    escSem: [ 1,  0,  2,  3,  0,  4,  5,  0,  1,  0,  2,  3,  0,  4,  5,  0,  2,  3,  0,  4,  5,  0,  0,  0],
  },
  {
    id:'69eb72c526437217d30a6650', name:'Jeniffer Kethelyn Rodrigues de Oliveira', ramal:'5109',
    empresa:'JobCenter', entrada:'08:00', saida:'16:12',
    sab:    ['S','F','S','S','F','S','F','S','S','F','S','S','F','S','F','F','S','S','F','S','F','S','F','F'],
    escSem: [ 2,  0,  3,  4,  0,  5,  0,  1,  2,  0,  3,  4,  0,  5,  0,  0,  3,  4,  0,  5,  0,  1,  0,  0],
  },
  {
    id:'69aec081ae69eb32259b743f', name:'Vanessa Pinheiro Barros', ramal:'5096',
    empresa:'JobCenter', entrada:'08:00', saida:'16:12',
    sab:    ['S','F','S','F','S','S','F','S','S','F','S','F','S','S','F','F','S','F','S','S','F','S','F','F'],
    escSem: [ 4,  0,  5,  0,  1,  2,  0,  3,  4,  0,  5,  0,  1,  2,  0,  0,  5,  0,  1,  2,  0,  3,  0,  0],
  },
  {
    id:'69aec07fae69eb32259b73d3', name:'Alini Regina dos Santos', ramal:'5095',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['S','F','S','S','F','S','F','S','S','F','S','S','F','S','F','F','S','S','F','S','F','S','F','F'],
    escSem: [ 3,  0,  4,  5,  0,  1,  0,  2,  3,  0,  4,  5,  0,  1,  0,  0,  4,  5,  0,  1,  0,  2,  0,  0],
  },
  {
    id:'69aec076ae69eb32259b70bb', name:'André Nunes da Silva', ramal:'5087',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','S','F','F','F'],
    escSem: [ 1,  2,  0,  3,  4,  0,  5,  0,  1,  2,  0,  3,  4,  0,  5,  2,  0,  3,  4,  0,  5,  0,  0,  0],
  },
  {
    id:'69aec083ae69eb32259b751d', name:'Beatriz Dutra de Lima', ramal:'5098',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['F','S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','S','F','F'],
    escSem: [ 0,  1,  2,  0,  3,  4,  0,  5,  0,  1,  2,  0,  3,  4,  0,  1,  2,  0,  3,  4,  0,  5,  0,  0],
  },
  {
    id:'69d6939aad410d574c8a2e60', name:'Camila de Almeida Sousa', ramal:'5107',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['S','S','F','S','F','S','S','F','S','S','F','S','F','S','S','S','F','S','F','S','S','F','F','F'],
    escSem: [ 3,  4,  0,  5,  0,  1,  2,  0,  3,  4,  0,  5,  0,  1,  2,  4,  0,  5,  0,  1,  2,  0,  0,  0],
  },
  {
    id:'69aec085ae69eb32259b7603', name:'Claudia Silva Sobral', ramal:'5100',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['F','S','S','F','S','F','S','S','F','S','S','F','S','F','S','S','S','F','S','F','S','S','F','F'],
    escSem: [ 0,  3,  4,  0,  5,  0,  1,  2,  0,  3,  4,  0,  5,  0,  1,  3,  4,  0,  5,  0,  1,  2,  0,  0],
  },
  {
    id:'69aec082ae69eb32259b74ad', name:'Cristian Lima Ramos', ramal:'5097',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['S','F','S','F','S','S','F','S','S','F','S','F','S','S','F','F','S','F','S','S','F','S','F','F'],
    escSem: [ 5,  0,  1,  0,  2,  3,  0,  4,  5,  0,  1,  0,  2,  3,  0,  0,  1,  0,  2,  3,  0,  4,  0,  0],
  },
  {
    id:'69caa59b16454a57680188ac', name:'Jonatas Souza Santos', ramal:'5106',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['F','S','F','S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','F'],
    escSem: [ 0,  1,  0,  2,  3,  0,  4,  5,  0,  1,  0,  2,  3,  0,  4,  1,  0,  2,  3,  0,  4,  5,  0,  0],
  },
  {
    id:'69aec07aae69eb32259b71d5', name:'Karina Bhering', ramal:'5090',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['S','S','F','S','F','S','S','F','S','S','F','S','F','S','S','S','F','S','F','S','S','F','F','F'],
    escSem: [ 4,  5,  0,  1,  0,  2,  3,  0,  4,  5,  0,  1,  0,  2,  3,  5,  0,  1,  0,  2,  3,  0,  0,  0],
  },
  {
    id:'69aec084ae69eb32259b758f', name:'Karina Finoti', ramal:'5099',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['F','S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','S','F','F'],
    escSem: [ 0,  2,  3,  0,  4,  5,  0,  1,  0,  2,  3,  0,  4,  5,  0,  2,  3,  0,  4,  5,  0,  1,  0,  0],
  },
  {
    id:'69caa57dc45f3f57556c539c', name:'Milena Coimbra dos Santos', ramal:'5105',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['F','S','F','S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','F'],
    escSem: [ 0,  5,  0,  1,  2,  0,  3,  4,  0,  5,  0,  1,  2,  0,  3,  5,  0,  1,  2,  0,  3,  4,  0,  0],
  },
  {
    id:'69aec077ae69eb32259b7117', name:'Nicolas Rocha Santos', ramal:'5088',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','S','F','F','F'],
    escSem: [ 2,  3,  0,  4,  5,  0,  1,  0,  2,  3,  0,  4,  5,  0,  1,  3,  0,  4,  5,  0,  1,  0,  0,  0],
  },
  {
    id:'69badd355ffbab2f6114dd84', name:'Vanessa Alves de Oliveira', ramal:'5103',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['F','S','S','F','S','F','S','S','F','S','S','F','S','F','S','S','S','F','S','F','S','S','F','F'],
    escSem: [ 0,  4,  5,  0,  1,  0,  2,  3,  0,  4,  5,  0,  1,  0,  2,  4,  5,  0,  1,  0,  2,  3,  0,  0],
  },
  {
    id:'69d693b70973fea05ba3010c', name:'Victor Vinicius Barros Silva', ramal:'5108',
    empresa:'JobCenter', entrada:'09:00', saida:'17:12',
    sab:    ['S','F','S','S','F','S','F','S','S','F','S','S','F','S','F','F','S','S','F','S','F','S','F','F'],
    escSem: [ 2,  0,  3,  4,  0,  5,  0,  1,  2,  0,  3,  4,  0,  5,  0,  0,  3,  4,  0,  5,  0,  1,  0,  0],
  },
  {
    id:'69aec07cae69eb32259b729b', name:'Taniele Miranda Dourado', ramal:'5092',
    empresa:'JobCenter', entrada:'11:00', saida:'19:00',
    sab:    ['S','F','S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','F','F'],
    escSem: [ 5,  0,  1,  2,  0,  3,  4,  0,  5,  0,  1,  2,  0,  3,  4,  0,  1,  2,  0,  3,  4,  0,  0,  0],
  },
  {
    id:'69eb72dd0ce05e17c41cde4f', name:'Luiza Paiva da Silva', ramal:'5110',
    empresa:'JobCenter', entrada:'11:00', saida:'19:00',
    sab:    ['S','S','F','S','S','F','S','F','S','S','F','S','S','F','S','S','F','S','S','F','S','F','F','F'],
    escSem: [ 2,  3,  0,  4,  5,  0,  1,  0,  2,  3,  0,  4,  5,  0,  1,  3,  0,  4,  5,  0,  1,  0,  0,  0],
  },
];

// ── Lógica de semana ─────────────────────────────────────────────
// Sábado de referência: 21/03/2026 = índice 0
const SAB_REF = new Date(2026, 2, 21); // mês 2 = março (0-based)

function getWeekIndex(hoje) {
  const diff = hoje.getTime() - SAB_REF.getTime();
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.floor(dias / 7));
}

module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0=Dom 1=Seg 2=Ter 3=Qua 4=Qui 5=Sex 6=Sáb
  const semIdx = getWeekIndex(hoje);

  const escala = [];

  // Velotax: Seg–Sex
  for (const a of VELOTAX) {
    escala.push({ ...a, tipo: 'velo',
      trabalhaHoje: diaSemana >= 1 && diaSemana <= 5 });
  }

  // JobCenter fixo Sáb–Qua
  for (const a of JOB_FIXO_SABQUA) {
    escala.push({ ...a, tipo: 'job_sabqua',
      trabalhaHoje: [0,1,2,3,6].includes(diaSemana) });
  }

  // JobCenter fixo Seg–Sex
  for (const a of JOB_FIXO_SEGSEX) {
    escala.push({ ...a, tipo: 'job_segsex',
      trabalhaHoje: diaSemana >= 1 && diaSemana <= 5 });
  }

  // JobCenter rotativos
  for (const a of JOB_ROTATIVO) {
    const maxIdx = a.sab.length - 1;
    const idx = Math.min(semIdx, maxIdx);
    const trabalhaSab = a.sab[idx] === 'S';
    const escTipo = a.escSem[idx] || 0;

    let trabalhaHoje;
    if (diaSemana === 0) {
      trabalhaHoje = false;
    } else if (diaSemana === 6) {
      trabalhaHoje = trabalhaSab;
    } else {
      trabalhaHoje = escTipo !== diaSemana; // folga no dia indicado, trabalha nos outros
    }

    const { sab, escSem, ...agente } = a;
    escala.push({ ...agente, tipo: 'job_rot', trabalhaHoje });
  }

  return sendJson(res, escala, 200);
};
