/**
 * VELOTAX - PROXY DE OPERACOES
 * Porta: 3355
 * Requisitos: Node.js 18+ (sem dependencias externas)
 */

// Carrega .env se existir (para SUPABASE_SERVICE_KEY)
try {
  var fs2 = require('fs'), path2 = require('path');
  var envPath = path2.join(__dirname, '.env');
  if (fs2.existsSync(envPath)) {
    var envLines = fs2.readFileSync(envPath, 'utf8').split(/\r?\n/);
    envLines.forEach(function(line) {
      var m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    });
    console.log('[ENV] .env carregado');
  }
} catch(e) { console.log('[ENV] erro: ' + e.message); }

const http  = require('http');
const https = require('https');
const url   = require('url');
const fs    = require('fs');
const path  = require('path');
let XLSX = null;
try {
  XLSX = require('xlsx');
  console.log('[XLSX] modulo carregado com sucesso');
} catch(e) {
  try {
    XLSX = require(require('path').join(process.cwd(), 'node_modules', 'xlsx'));
    console.log('[XLSX] modulo carregado via path alternativo');
  } catch(e2) {
    console.error('[XLSX] FALHA ao carregar: ' + e.message);
    console.error('[XLSX] Execute na pasta Realtime: npm install xlsx');
  }
}

const PORT       = 3355;
const PBX_KEY    = 'e59c885f-5c40-4cd3-94ab-933c8de3dcc0-20265620361';
const PBX_BASE   = 'https://reportapi02.55pbx.com:50500';
const OCTA_TOKEN     = 'octa.f1tj3mm6Zf7y.pWy4Q5nxumXd';
const OCTA_TOKEN_55  = 'octa.wXV8KeAZmf8S.hnS5YPIC5b2D';
const OCTA_TOKEN_DASH= 'octa.V87PQLBgS88e.TJmKoH7HrTUY';
const OCTA_TOKEN_WFM = 'octa.zLIyq6sSo7qi.ookANKyjtqkR';
const OCTA_SUBDOMAIN = 'velotax';
const OCTA_USERNAME  = 'andre.violaro@velotax.com.br';
const OCTA_BASE        = 'https://api.octadesk.services';
const OCTA_BASE_NEW    = 'https://o199103-bfa.api001.octadesk.services';
const OCTA_KEY_NEW     = '4cd77bd3-3016-47df-8760-f1c469e77285.77c54187-56ea-4a43-af15-d288cd74a1e9';

// ── Configuracao Aderencia ───────────────────────────────────
var EXCEL_PATH   = path.join(__dirname, 'escala_completa.xlsx');
var ADER_API_KEY = 'af29edb8-05a7-4d5d-869f-95b3935e5c1a-20265533862';
var TOLERANCE    = 5;

var WORK_DAYS = {
  'velo':        [1,2,3,4,5],
  'job_segsex':  [1,2,3,4,5],
  'job_sabaqua': [0,1,2,3,6],
  'job_rot':     [1,2,3,4,5,6],
};

function lerEscala() {
  console.log('[ADERENCIA] lerEscala() cwd='+process.cwd());
  var nomes = ['Mai26_escala_completa.xlsx','escala_completa.xlsx','escala_completa_34_v3.xlsx'];
  var dirs  = [process.cwd(), __dirname];
  var xlsxPath = null;
  for (var d=0; d<dirs.length && !xlsxPath; d++) {
    for (var i=0; i<nomes.length && !xlsxPath; i++) {
      var p = path.join(dirs[d], nomes[i]);
      if (fs.existsSync(p)) { xlsxPath = p; console.log('[ADERENCIA] Excel encontrado: '+p); }
    }
  }
  if (!xlsxPath) {
    try {
      var files = fs.readdirSync(process.cwd()).filter(function(f){ return f.endsWith('.xlsx'); });
      console.log('[ADERENCIA] xlsx no cwd ('+process.cwd()+'): '+JSON.stringify(files));
      var files2 = fs.readdirSync(__dirname).filter(function(f){ return f.endsWith('.xlsx'); });
      console.log('[ADERENCIA] xlsx no __dirname ('+__dirname+'): '+JSON.stringify(files2));
    } catch(e) { console.log('[ADERENCIA] erro listando: '+e.message); }
    console.log('[ADERENCIA] Excel NAO encontrado');
    return null;
  }
  if (!XLSX) { console.log('[ADERENCIA] xlsx nao carregado'); return null; }
  try {
    var wb = XLSX.readFile(xlsxPath);
    var ws55   = wb.Sheets['55'];
    var rows55 = XLSX.utils.sheet_to_json(ws55, { header: 1 });
    var mapaRamal = {};
    for (var r55 = 1; r55 < rows55.length; r55++) {
      var n55 = rows55[r55][0], id55 = rows55[r55][1], rm55 = rows55[r55][2];
      if (n55 && id55 && rm55) mapaRamal[String(n55).trim()] = { ramal:String(rm55).trim(), id:String(id55).trim() };
    }
    console.log('[ADERENCIA] aba 55: '+Object.keys(mapaRamal).length+' entradas');

    var DOW_COL = {0:10, 1:4, 2:5, 3:6, 4:7, 5:8, 6:9};
    var dow = new Date().getDay();
    var colHoje = DOW_COL[dow];

    var wsSem  = wb.Sheets['Semana Atual'];
    var rowsSem = XLSX.utils.sheet_to_json(wsSem, { header: 1 });
    var staff = [], grupoAtual = 'velo';

    for (var i = 0; i < rowsSem.length; i++) {
      var row  = rowsSem[i];
      var col0 = row[0] ? String(row[0]).trim() : '';
      var col1 = row[1] ? String(row[1]).trim() : '';
      if (!col1 && (col0.includes('VELOTAX')||col0.includes('Velotax')))               { grupoAtual='velo'; continue; }
      if (!col1 && (col0.includes('JOBCENTER')||col0.includes('JobCenter')||col0.includes('JOB'))) { grupoAtual='job'; continue; }
      if (col1 !== 'Velotax' && col1 !== 'JobCenter') continue;

      var nome    = col0;
      var empresa = col1;
      var horario = row[2] ? String(row[2]).trim() : '';
      var tipo    = row[3] ? String(row[3]).trim() : '';
      var horHoje = row[colHoje] ? String(row[colHoje]).trim() : '';

      var info = mapaRamal[nome];
      if (!info) {
        var chave = Object.keys(mapaRamal).find(function(k){
          return k.toLowerCase().startsWith(nome.toLowerCase().slice(0,10));
        });
        if (chave) info = mapaRamal[chave];
      }
      if (!info) { console.log('[ADERENCIA] sem ramal: '+nome); continue; }

      var hp = horario.replace(/[-\u2013\u2014]/g,'-').split('-');
      var entrada = hp[0] ? hp[0].trim() : '09:00';
      var saida   = hp[1] ? hp[1].trim() : '18:00';

      var trabalhaHoje = true;
      if (tipo.toUpperCase() === 'FOLGA') {
        trabalhaHoje = false;
      } else if (!horHoje || horHoje.toUpperCase() === 'FOLGA') {
        trabalhaHoje = false;
      } else {
        var hp2 = horHoje.replace(/[-\u2013\u2014]/g,'-').split('-');
        if (hp2.length >= 2 && horHoje !== horario) { entrada=hp2[0].trim(); saida=hp2[1].trim(); }
      }

      staff.push({ name:nome, empresa:empresa, grupo:grupoAtual,
        entrada:entrada, saida:saida, tipo:tipo,
        ramal:info.ramal, id:info.id, trabalhaHoje:trabalhaHoje });
    }
    console.log('[ADERENCIA] '+staff.length+' colaboradores, '+
      staff.filter(function(s){return s.trabalhaHoje;}).length+' hoje (dow='+dow+')');
    return staff;
  } catch(e) {
    console.error('[ADERENCIA] Erro: '+e.message);
    return null;
  }
}

function to55DateAder(dateStr, end) {
  var DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var parts=dateStr.split('-').map(Number);
  var dt=new Date(parts[0],parts[1]-1,parts[2]);
  return DAYS[dt.getDay()]+' '+MONTHS[parts[1]-1]+' '+String(parts[2]).padStart(2,'0')+' '+parts[0]+' '+(end?'23:59:00':'00:00:00')+' GMT -0300';
}

async function handleEscala(req, res) {
  var staff = lerEscala();
  if (!staff) {
    res.writeHead(200, Object.assign({'Content-Type':'application/json'}, CORS));
    return res.end(JSON.stringify([]));
  }
  res.writeHead(200, Object.assign({'Content-Type':'application/json'}, CORS));
  res.end(JSON.stringify(staff));
}

async function handleAderencia(req, res) {
  var body = '';
  req.on('data', function(c){ body+=c; });
  req.on('end', async function() {
    try {
      var payload = JSON.parse(body);
      var agents = payload.agents, date = payload.date;
      if (!agents||!date) { res.writeHead(400,CORS); return res.end(JSON.stringify({error:'invalido'})); }

      var start = to55DateAder(date,false);
      var end   = to55DateAder(date,true);
      var s = encodeURIComponent(start), e = encodeURIComponent(end);
      var apiPath = '/api/pbx/reports/metrics/'+s+'/'+e+'/all_queues/all_numbers/all_agent/report_04/undefined/-3';

      var r = await request('https://reportapi02.55pbx.com:50500'+apiPath, {'key': ADER_API_KEY, 'Accept':'application/json'});
      var parsed; try { parsed=JSON.parse(r.body); } catch(ex){ parsed={}; }

      var allRecords=[];
      if (Array.isArray(parsed)) allRecords=parsed;
      else if (Array.isArray(parsed.data_report04)) allRecords=parsed.data_report04;
      else if (Array.isArray(parsed.data)) allRecords=parsed.data;

      var results = agents.map(function(agent) {
        var ramal=String(agent.ramal);
        var mine=allRecords.filter(function(rec){ return String(rec.branch)===ramal; });
        var logins=mine.filter(function(rec){ return rec.event&&rec.event.toLowerCase().includes('online')&&!rec.event.toLowerCase().includes('pausa'); })
          .sort(function(a,b){ return new Date(a.time)-new Date(b.time); });
        return { id:agent.id, name:agent.name, firstLogin:logins[0]||null };
      });

      res.writeHead(200, Object.assign({'Content-Type':'application/json'}, CORS));
      res.end(JSON.stringify({ date:date, results:results }));
    } catch(err) {
      res.writeHead(500, Object.assign({'Content-Type':'application/json'}, CORS));
      res.end(JSON.stringify({error:err.message}));
    }
  });
}

// ── QUIZ IDs ─────────────────────────────────────────────────
var QUIZ_ID_ATENDENTE = null;
var QUIZ_ID_SOLUCAO   = null;

const FILA_CORES = [
  { match: 'ativo',        cor: '#1634FF' },
  { match: 'credito p1',   cor: '#006AB9' },
  { match: 'crédito p1',   cor: '#006AB9' },
  { match: 'consumidor',   cor: '#15A237' },
  { match: 'calculadora',  cor: '#FCC200' },
  { match: 'credito p2',   cor: '#e03030' },
  { match: 'crédito p2',   cor: '#e03030' },
  { match: 'credito - p2', cor: '#e03030' },
  { match: 'cobranca',     cor: '#e07000' },
  { match: 'cobrança',     cor: '#e07000' },
  { match: 'irpf',         cor: '#8B5CF6' },
  { match: 'suporte',      cor: '#000058' },
  { match: 'ecac',         cor: '#000058' },
  { match: 'ramal',        cor: '#888888' },
];

function corDaFila(nome) {
  if (!nome) return '#888888';
  var lower = nome.toLowerCase();
  for (var i = 0; i < FILA_CORES.length; i++) {
    if (lower.indexOf(FILA_CORES[i].match) !== -1) return FILA_CORES[i].cor;
  }
  return '#888888';
}

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Supabase realtime_queues upsert ──────────────────────────
var SUPA_URL = 'https://jxqpisrkjicapvtbyvzp.supabase.co';
var SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || '';

async function upsertQueues(byQueue) {
  if (!SUPA_KEY || !byQueue.length) return;
  try {
    var rows = byQueue.map(function(q) {
      return {
        queue_id:         q.queue,
        queue_name:       q.queue,
        in_ura:           q.in_ura           || 0,
        waiting_human:    q.waiting_human    || 0,
        in_human_service: q.in_human_service || 0,
        free_agents:      q.free_agents      || 0,
        agents_paused:    q.agents_paused    || 0,
        agents_busy:      q.agents_busy      || 0,
        updated_at:       new Date().toISOString(),
      };
    });
    var body = JSON.stringify(rows);
    var opts = {
      hostname: 'jxqpisrkjicapvtbyvzp.supabase.co',
      port: 443,
      path: '/rest/v1/realtime_queues',
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(body),
      },
      rejectUnauthorized: false,
    };
    await new Promise(function(resolve, reject) {
      var req = https.request(opts, function(res) {
        res.on('data', function(){});
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    console.log('[REALTIME] upsert ' + rows.length + ' filas no Supabase');
  } catch(e) {
    console.warn('[REALTIME] upsert erro: ' + e.message);
  }
}

function request(targetUrl, headers, method, body) {
  headers = headers || {};
  method  = method  || 'GET';
  return new Promise(function(resolve, reject) {
    var parsed = new URL(targetUrl);
    var opts = {
      hostname: parsed.hostname,
      port    : parsed.port || 443,
      path    : parsed.pathname + parsed.search,
      method  : method,
      headers : Object.assign({ 'Accept': 'application/json' }, headers),
      timeout : 35000,
      rejectUnauthorized: false,
    };
    var req = https.request(opts, function(res) {
      var buf = '';
      res.on('data', function(chunk) { buf += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: buf }); });
    });
    req.on('timeout', function() { req.destroy(); reject(new Error('Timeout (35s)')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function todayRange() {
  var now    = new Date();
  var days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return {
    start: days[now.getDay()] + ' ' + months[now.getMonth()] + ' ' + String(now.getDate()).padStart(2,'0') + ' ' + now.getFullYear() + ' 00:00:00 GMT -0300',
    end  : days[now.getDay()] + ' ' + months[now.getMonth()] + ' ' + String(now.getDate()).padStart(2,'0') + ' ' + now.getFullYear() + ' 23:59:59 GMT -0300',
  };
}

function todayStr() {
  var now = new Date();
  var dd  = String(now.getDate()).padStart(2,'0');
  var mm  = String(now.getMonth()+1).padStart(2,'0');
  var yy  = now.getFullYear();
  return dd + '/' + mm + '/' + yy;
}

function filtrarHoje(chamadas) {
  var hoje = todayStr();
  var hojeSlash = hoje;
  var hojeHifen = hoje.substring(0,5).replace('/','/') + '-' + hoje.substring(6);

  var filtradas = chamadas.filter(function(c) {
    if (c.call_date) {
      var cd = String(c.call_date).trim();
      if (cd === hojeSlash || cd === hojeHifen) return true;
      var partes = cd.replace('-','/').split('/');
      if (partes.length === 3) {
        var reconstruido = partes[0] + '/' + partes[1] + '/' + partes[2];
        if (reconstruido === hojeSlash) return true;
      }
    }
    if (c.wl_attended_date) {
      var wd = String(c.wl_attended_date).trim();
      if (wd === hojeSlash || wd === hojeHifen) return true;
    }
    if (c.wl_time_attended) {
      var ts = String(c.wl_time_attended).substring(0,10);
      var partes2 = ts.split('-');
      if (partes2.length === 3) {
        var reconst = partes2[2] + '/' + partes2[1] + '/' + partes2[0];
        if (reconst === hojeSlash) return true;
      }
    }
    return false;
  });

  if (filtradas.length === 0 && chamadas.length > 0) {
    console.warn('[FILTRO DATA] Nenhuma chamada passou pelo filtro de hoje (' + hoje + '). Usando todas as ' + chamadas.length + ' chamadas.');
    return chamadas;
  }

  console.log('[FILTRO DATA] ' + filtradas.length + ' de ' + chamadas.length + ' chamadas sao de hoje (' + hoje + ')');
  return filtradas;
}

function buildPbxPath(report, queueId, quizId) {
  var r = todayRange();
  var q = queueId || 'all_queues';
  var qz = quizId || 'undefined';
  return '/api/pbx/reports/metrics'
    + '/' + encodeURIComponent(r.start)
    + '/' + encodeURIComponent(r.end)
    + '/' + encodeURIComponent(q) + '/all_numbers/all_agent'
    + '/' + report + '/' + qz + '/-3';
}

async function pbxGet(report, queueId, quizId) {
  var path = buildPbxPath(report, queueId, quizId);
  var result = await request(PBX_BASE + path, { key: PBX_KEY });
  try { return JSON.parse(result.body); } catch(e) { return {}; }
}

async function handlePbxReport(req, res, report) {
  var pbxPath = buildPbxPath(report, 'all_queues', 'undefined');
  console.log('[55PBX] ' + report + ' -> ' + PBX_BASE + pbxPath);
  try {
    var result = await request(PBX_BASE + pbxPath, { key: PBX_KEY });
    res.writeHead(result.status, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(result.body);
  } catch(err) {
    res.writeHead(502, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ── /pbx/notas — CORRIGIDO: lê wh_question_* diretamente ────
async function handleNotas(req, res) {
  console.log('[55PBX NOTAS] buscando notas de satisfacao...');

  try {
    var data = await pbxGet('report_02', 'all_queues', 'undefined');

    var chamadas = [];
    if (Array.isArray(data)) chamadas = data;
    else if (data && Array.isArray(data.data)) chamadas = data.data;
    else {
      var keys = Object.keys(data || {});
      for (var i = 0; i < keys.length; i++) {
        if (Array.isArray(data[keys[i]]) && data[keys[i]].length > 0) {
          chamadas = data[keys[i]]; break;
        }
      }
    }

    // Lê diretamente os campos corretos — sem mapeamento via wk_ivr que continha CPFs
    var CAMPO_ATENDENTE = 'wh_question_2_1_PERGUNTA_ATENDENTE';
    var CAMPO_SOLUCAO   = 'wh_question_2_2_PERGUNTA_SOLUCAO';

    var distAtendente = {};
    var distSolucao   = {};

    // Escala 55PBX confirmada: 1=Ruim, 5=Excelente (sem inversão)
    chamadas.forEach(function(c) {
      // Atendente
      var va = c[CAMPO_ATENDENTE];
      if (va !== undefined && va !== null && va !== '') {
        var na = parseFloat(String(va).replace(',', '.'));
        if (!isNaN(na) && na >= 1 && na <= 5) {
          var ka = Math.round(na);
          distAtendente[ka] = (distAtendente[ka] || 0) + 1;
        }
        // "Abandonada" e textos sem nota numérica são ignorados
      }

      // Solução
      var vs = c[CAMPO_SOLUCAO];
      if (vs !== undefined && vs !== null && vs !== '') {
        var ns = parseFloat(String(vs).replace(',', '.'));
        if (!isNaN(ns) && ns >= 1 && ns <= 5) {
          var ks = Math.round(ns);
          distSolucao[ks] = (distSolucao[ks] || 0) + 1;
        }
      }
    });

    // Média ponderada: Σ(nota × qtd) / Σ(qtd)
    function mediaPonderada(dist) {
      var somaTotal = 0, somaQtd = 0;
      Object.keys(dist).forEach(function(nota) {
        var n   = parseFloat(nota);
        var qtd = dist[nota];
        somaTotal += n * qtd;
        somaQtd   += qtd;
      });
      if (somaQtd === 0) return null;
      return {
        media        : parseFloat((somaTotal / somaQtd).toFixed(2)),
        total        : somaQtd,
        distribuicao : dist,
        _debug       : { somaTotal: somaTotal, somaQtd: somaQtd },
      };
    }

    var resultAtendente = mediaPonderada(distAtendente);
    var resultSolucao   = mediaPonderada(distSolucao);

    var medias_por_campo = {};
    if (resultAtendente) medias_por_campo['PERGUNTA_ATENDENTE'] = resultAtendente;
    if (resultSolucao)   medias_por_campo['PERGUNTA_SOLUCAO']   = resultSolucao;

    console.log('[55PBX NOTAS] Atendente:', resultAtendente ? resultAtendente.media + ' (' + resultAtendente.total + ' avaliacoes)' : 'sem dados');
    console.log('[55PBX NOTAS] Solucao:  ', resultSolucao   ? resultSolucao.media   + ' (' + resultSolucao.total   + ' avaliacoes)' : 'sem dados');

    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({
      fonte            : 'report_02_wh_question_direto',
      total_chamadas   : chamadas.length,
      campos_lidos     : [CAMPO_ATENDENTE, CAMPO_SOLUCAO],
      medias_por_campo : medias_por_campo,
    }));

  } catch(err) {
    console.error('[55PBX NOTAS] Erro: ' + err.message);
    res.writeHead(502, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ── /pbx/quiz-scan ────────────────────────────────────────────
async function handleQuizScan(req, res) {
  console.log('[55PBX QUIZ-SCAN] varrendo report_02...');
  try {
    var data = await pbxGet('report_02', 'all_queues', 'undefined');
    var chamadas = [];
    if (Array.isArray(data)) chamadas = data;
    else if (data && Array.isArray(data.data)) chamadas = data.data;
    else {
      var keys = Object.keys(data || {});
      for (var i = 0; i < keys.length; i++) {
        if (Array.isArray(data[keys[i]]) && data[keys[i]].length > 0) { chamadas = data[keys[i]]; break; }
      }
    }
    chamadas = filtrarHoje(chamadas);
    var camposUnicos = {};
    chamadas.forEach(function(c) {
      Object.keys(c).forEach(function(k) {
        if (!camposUnicos[k]) camposUnicos[k] = { valores_distintos: new Set(), count: 0 };
        if (c[k] !== null && c[k] !== '' && c[k] !== undefined) {
          camposUnicos[k].valores_distintos.add(String(c[k]).substring(0,50));
          camposUnicos[k].count++;
        }
      });
    });
    var camposQuiz = {};
    Object.keys(camposUnicos).forEach(function(k) {
      if (k.indexOf('wh_') === 0 || k.indexOf('quiz') !== -1 || k.indexOf('satisf') !== -1
          || (k.indexOf('wk_ivr') === 0 && camposUnicos[k].count > 0)) {
        camposQuiz[k] = {
          preenchido_em : camposUnicos[k].count + ' de ' + chamadas.length + ' chamadas',
          exemplos      : Array.from(camposUnicos[k].valores_distintos).slice(0,5),
        };
      }
    });
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({
      total_chamadas_analisadas : chamadas.length,
      campos_quiz_no_report02   : camposQuiz,
      quiz_id_configurado_agora : { atendente: QUIZ_ID_ATENDENTE, solucao: QUIZ_ID_SOLUCAO },
      como_configurar           : ['1. As notas já são lidas automaticamente dos campos wh_question_*','2. Não é necessário configurar quiz_id'],
      amostra_1a_chamada        : chamadas[0] || null,
    }, null, 2));
  } catch(err) {
    res.writeHead(502, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ── /pbx/notas-teste ─────────────────────────────────────────
async function handleNotasTeste(req, res, reqUrl) {
  var quizId = reqUrl.query && reqUrl.query.quiz;
  if (!quizId) {
    res.writeHead(400, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    return res.end(JSON.stringify({ error: 'Passe ?quiz=SEU_QUIZ_ID na URL' }));
  }
  try {
    var d = await pbxGet('report_01', 'all_queues', quizId);
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({
      quiz_id_testado  : quizId,
      notaAtendente    : d.quizAverageAttendant || 'nao retornado',
      notaSolucao      : d.quizAverageSolution  || 'nao retornado',
      totalAvaliacoes  : d.quizTotalAnswers      || 'nao retornado',
      sucesso          : !!(d.quizAverageAttendant || d.quizAverageSolution),
      _campos_quiz_raw : { quizAverageAttendant: d.quizAverageAttendant, quizAverageSolution: d.quizAverageSolution },
    }, null, 2));
  } catch(err) {
    res.writeHead(502, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ── /pbx/filas-por-chamada ────────────────────────────────────
async function handleFilasPorChamada(req, res) {
  console.log('[55PBX FILAS] buscando report_02...');
  try {
    var data = await pbxGet('report_02', 'all_queues', 'undefined');
    var chamadas = [];
    if (Array.isArray(data)) chamadas = data;
    else if (data && Array.isArray(data.data)) chamadas = data.data;
    else {
      var keys = Object.keys(data || {});
      for (var i = 0; i < keys.length; i++) {
        if (Array.isArray(data[keys[i]]) && data[keys[i]].length > 0) { chamadas = data[keys[i]]; break; }
      }
    }
    chamadas = filtrarHoje(chamadas);
    var filaMap = {};
    chamadas.forEach(function(c) {
      var nome = c.queue_name || c.queueName || c.queue || 'Sem fila';
      var id   = c.wx_queue_id || c.queue_id || nome;
      var aband = (c.call_disconnection || '').toLowerCase().indexOf('abandon') !== -1
               || (c.status || '').toLowerCase().indexOf('abandon') !== -1;
      if (!filaMap[id]) filaMap[id] = { id:id, nome:nome, cor:corDaFila(nome), processadas:0, atendidas:0, abandonadas:0, tmas:[] };
      filaMap[id].processadas++;
      if (aband) {
        filaMap[id].abandonadas++;
      } else if (c.call_time_spoken && c.call_time_spoken !== '00:00:00' && c.call_time_spoken !== '') {
        filaMap[id].atendidas++;
        filaMap[id].tmas.push(c.call_time_spoken);
      } else if (c.branch_number_agent || c.name) {
        filaMap[id].atendidas++;
      }
    });
    var filas = Object.values(filaMap).map(function(f) {
      var tma = '—';
      if (f.tmas.length > 0) {
        var totalSec = f.tmas.reduce(function(acc, t) {
          var parts = t.split(':');
          if (parts.length === 3) return acc + parseInt(parts[0])*3600 + parseInt(parts[1])*60 + parseInt(parts[2]);
          if (parts.length === 2) return acc + parseInt(parts[0])*60 + parseInt(parts[1]);
          return acc;
        }, 0);
        var avg = Math.round(totalSec / f.tmas.length);
        var h = Math.floor(avg/3600), m = Math.floor((avg%3600)/60), s = avg%60;
        var pad = function(n){ return String(n).padStart(2,'0'); };
        tma = (h > 0 ? pad(h)+':' : '') + pad(m) + ':' + pad(s);
      }
      return { id:f.id, nome:f.nome, cor:f.cor, processadas:f.processadas, atendidas:f.atendidas, abandonadas:f.abandonadas, tma:tma };
    });
    filas.sort(function(a,b){ return b.processadas - a.processadas; });
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ filas:filas, total:chamadas.length }));
  } catch(err) {
    res.writeHead(502, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ── Cache realtime WebSocket ──────────────────────────────────
var _esperaCache = 0;
var _esperaTs    = 0;
var _esperaAtivo = false;
// Estado completo do realtime — atualizado pelo WebSocket da 55PBX
var _realtimeState = {
  ts: 0,
  totals: { in_ura: 0, waiting_human: 0, in_human_service: 0, free_agents: 0 },
  by_queue: [],
};
var RT_HOST   = 'realtimeapi02.55pbx.com';
var RT_PORT   = 60019;
var RT_ORIGIN = 'https://realtime.55pbx.com:8600';

function iniciarSocketEspera() {
  if (_esperaAtivo) return;
  _esperaAtivo = true;

  var CLIENT_ID = '671ff27d2aa76c6382d819fd';
  var USER_ID   = '672baff98528cb4546ef5d30';

  // Passo 1: handshake polling para obter SID
  var handshakeOpts = {
    hostname: RT_HOST, port: RT_PORT,
    path: '/socket.io/?EIO=4&transport=polling',
    method: 'GET',
    headers: {
      'Origin': RT_ORIGIN,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
      'Cache-Control': 'no-cache',
    },
    rejectUnauthorized: false, timeout: 8000,
  };

  var hreq = https.request(handshakeOpts, function(hres) {
    var buf = '';
    hres.on('data', function(c) { buf += c; });
    hres.on('end', function() {
      var sid;
      try { sid = JSON.parse(buf.replace(/^[\d]+/, '')).sid; } catch(e) {}
      if (!sid) {
        console.log('[ESPERA] sem sid, retry 5s');
        _esperaAtivo = false;
        return setTimeout(iniciarSocketEspera, 5000);
      }
      console.log('[ESPERA] sid obtido, abrindo WebSocket...');
      abrirWS(sid);
    });
  });
  hreq.on('error', function(e) { _esperaAtivo = false; setTimeout(iniciarSocketEspera, 5000); });
  hreq.on('timeout', function() { hreq.destroy(); _esperaAtivo = false; setTimeout(iniciarSocketEspera, 5000); });
  hreq.end();

  function abrirWS(sid) {
    var crypto = require('crypto');
    var wsKey  = crypto.randomBytes(16).toString('base64');
    var wsOpts = {
      hostname: RT_HOST, port: RT_PORT,
      path: '/socket.io/?EIO=4&transport=websocket&sid=' + encodeURIComponent(sid),
      method: 'GET',
      headers: {
        'Connection': 'Upgrade', 'Upgrade': 'websocket',
        'Sec-WebSocket-Key': wsKey, 'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
        'Origin': RT_ORIGIN, 'Host': RT_HOST + ':' + RT_PORT,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      rejectUnauthorized: false,
    };

    var wreq = https.request(wsOpts);
    wreq.on('upgrade', function(wres, socket) {
      console.log('[ESPERA] WebSocket aberto');
      var recvBuf  = Buffer.alloc(0);
      var pingTimer = null;
      var upgraded  = false;

      function wsSend(txt) {
        var payload = Buffer.from(txt, 'utf8');
        var mask    = crypto.randomBytes(4);
        var plen    = payload.length;
        var frame;
        if (plen < 126) {
          frame = Buffer.allocUnsafe(2 + 4 + plen);
          frame[0] = 0x81; // FIN + opcode text
          frame[1] = 0x80 | plen; // MASK bit + length
          mask.copy(frame, 2);
          for (var i = 0; i < plen; i++) frame[6 + i] = payload[i] ^ mask[i % 4];
        } else if (plen < 65536) {
          frame = Buffer.allocUnsafe(4 + 4 + plen);
          frame[0] = 0x81;
          frame[1] = 0x80 | 126; // MASK + extended 16-bit length
          frame.writeUInt16BE(plen, 2);
          mask.copy(frame, 4);
          for (var i = 0; i < plen; i++) frame[8 + i] = payload[i] ^ mask[i % 4];
        } else {
          frame = Buffer.allocUnsafe(10 + 4 + plen);
          frame[0] = 0x81;
          frame[1] = 0x80 | 127;
          frame.writeUInt32BE(0, 2);
          frame.writeUInt32BE(plen, 6);
          mask.copy(frame, 10);
          for (var i = 0; i < plen; i++) frame[14 + i] = payload[i] ^ mask[i % 4];
        }
        try { socket.write(frame); } catch(e) { console.log('[ESPERA] wsSend err: ' + e.message); }
      }

      function handleMsg(data) {
        // Responde pings do servidor IMEDIATAMENTE (priority máxima)
        if (data === '2') { wsSend('3'); return; }

        // Passo 1: servidor confirmou probe → enviamos upgrade + namespace join
        if (data === '3probe') {
          if (!upgraded) {
            upgraded = true;
            wsSend('5');  // confirma upgrade de polling → websocket
            wsSend('40'); // join namespace /
          }
          return;
        }

        // Passo 2: servidor confirmou namespace → enviamos o filter
        // NÃO enviamos pings — no EIO=4 só o servidor pinga, cliente apenas responde
        if (data === '40' || data.startsWith('40{')) {
          console.log('[ESPERA] namespace conectado');
          setTimeout(function() {
            var filterEvt = '42["change.realtime.filter",{"client_id":"' + CLIENT_ID +
              '","queue_id":"all_queue","user_id":"' + USER_ID +
              '","id_socket":"' + sid + '"}]';
            wsSend(filterEvt);
            console.log('[ESPERA] autenticado, aguardando eventos...');
          }, 100);
          return;
        }
        if (data.startsWith('42')) {
          try {
            var arr = JSON.parse(data.slice(2));
            if (Array.isArray(arr) && arr[0] === 'pbx.report.realtime.event') {
              var payload = arr[1] || {};
              var queues  = payload.queues || [];
              var totWaiting = 0, totInUra = 0, totService = 0, totFree = 0;
              var byQueue = [];

              queues.forEach(function(q) {
                if (!q) return;
                var calls   = q.calls || {};
                var waiting = Array.isArray(calls.waiting)   ? calls.waiting.length   : 0;
                var service = Array.isArray(calls.attendance) ? calls.attendance.length : 0;
                var agents  = Array.isArray(q.agents) ? q.agents : [];
                var free    = agents.filter(function(a) {
                  return a && !a.active_pause_state && (a.active_sum_calls_attendance || 0) === 0;
                }).length;

                totWaiting += waiting;
                totService += service;
                totFree    += free;

                var qName = q.name || q.queue_id || (q._id ? String(q._id).slice(-6) : 'fila');
                byQueue.push({
                  queue: qName, in_ura: 0,
                  waiting_human: waiting, in_human_service: service, free_agents: free,
                });
              });

              totInUra = parseInt(payload.quantity_ura || 0);

              console.log('[ESPERA] waiting=' + totWaiting + ' ura=' + totInUra + ' service=' + totService + ' queues=' + byQueue.length);

              _esperaCache = totWaiting;
              _esperaTs    = Date.now();
              _realtimeState = {
                ts: Date.now(),
                totals: { in_ura: totInUra, waiting_human: totWaiting, in_human_service: totService, free_agents: totFree },
                by_queue: byQueue,
              };
              if (byQueue.length > 0 || totWaiting === 0) upsertQueues(byQueue.length > 0 ? byQueue : [{queue:'_zero',in_ura:0,waiting_human:0,in_human_service:0,free_agents:0}]);
            }
          } catch(e) { console.log('[ESPERA] parse err: ' + e.message); }
        }
      }

      // Inicia handshake WebSocket
      wsSend('2probe');

      socket.on('data', function(chunk) {
        recvBuf = Buffer.concat([recvBuf, chunk]);
        while (recvBuf.length >= 2) {
          var fin    = (recvBuf[0] & 0x80) !== 0;
          var opcode = recvBuf[0] & 0x0F;
          var masked = (recvBuf[1] & 0x80) !== 0;
          var plen   = recvBuf[1] & 0x7F;
          var off    = 2;
          if (plen === 126) { if (recvBuf.length < 4) break; plen = recvBuf.readUInt16BE(2); off = 4; }
          else if (plen === 127) { if (recvBuf.length < 10) break; plen = recvBuf.readUInt32BE(6); off = 10; }
          if (masked) off += 4;
          if (recvBuf.length < off + plen) break;
          var frameData = recvBuf.slice(off, off + plen);
          recvBuf = recvBuf.slice(off + plen);
          if (opcode === 0x8) {
            var closeCode = frameData.length >= 2 ? frameData.readUInt16BE(0) : 0;
            var closeReason = frameData.length > 2 ? frameData.slice(2).toString('utf8') : '';
            console.log('[ESPERA] close frame code=' + closeCode + ' reason=' + closeReason);
            reconectar('close frame ' + closeCode);
            return;
          }
          if (opcode === 0x9) { socket.write(Buffer.from([0x8A, 0x00])); continue; }
          if (opcode !== 0x1) continue;
          handleMsg(frameData.toString('utf8'));
        }
      });

      function reconectar(motivo) {
        if (pingTimer) clearInterval(pingTimer);
        console.log('[ESPERA] reconectando (' + motivo + ')...');
        _esperaAtivo = false;
        setTimeout(iniciarSocketEspera, 3000);
      }

      socket.on('close', function() { reconectar('socket close'); });
      socket.on('error', function(e) { reconectar(e.message); });
    });

    wreq.on('error', function(e) {
      console.log('[ESPERA] WS err: ' + e.message);
      _esperaAtivo = false;
      setTimeout(iniciarSocketEspera, 5000);
    });
    wreq.end();
  }
}

async function handlePbxEspera(req, res) {
  iniciarSocketEspera();
  res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
  res.end(JSON.stringify({ emEspera: _esperaCache, fonte: _esperaTs > 0 ? 'realtime_ws' : 'aguardando', idadeMs: Date.now() - _esperaTs }));
}

async function handleRealtimeDashboard(req, res) {
  iniciarSocketEspera();
  var ageMs  = _realtimeState.ts > 0 ? Date.now() - _realtimeState.ts : null;
  var online = _realtimeState.ts > 0 && ageMs < 35000;
  // Se dados estiverem velhos (>35s), retorna zeros explícitos
  var totals   = online ? _realtimeState.totals   : { in_ura: 0, waiting_human: 0, in_human_service: 0, free_agents: 0 };
  var by_queue = online ? _realtimeState.by_queue : [];
  res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
  res.end(JSON.stringify({
    meta: {
      fonte:    'websocket_55pbx',
      online:   online,
      age_ms:   ageMs,
      ts:       _realtimeState.ts,
      conectado: _esperaAtivo,
    },
    totals:   totals,
    by_queue: by_queue,
  }));
}

async function handlePbxDebug(req, res) {
  try {
    var d = await pbxGet('report_01', 'all_queues', 'undefined');
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify(d, null, 2));
  } catch(err) {
    res.writeHead(502, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ error: err.message }));
  }
}

var _octaAccessToken  = null;
var _octaTokenExpires = 0;

async function octaLogin() {
  var tentativas = [
    { path: '/person/login', body: { subdomain: 'velotax', userApiToken: OCTA_TOKEN, login: OCTA_USERNAME } },
  ];
  for (var i = 0; i < tentativas.length; i++) {
    var t = tentativas[i];
    var bodyStr = JSON.stringify(t.body);
    try {
      var result = await request(OCTA_BASE + t.path, { 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(bodyStr) }, 'POST', bodyStr);
      var data; try { data = JSON.parse(result.body); } catch(e) { data = {}; }
      var token = data.token || data.accessToken || null;
      if (token) { _octaAccessToken = token; _octaTokenExpires = Date.now() + 50*60*1000; return token; }
    } catch(err) {}
  }
  _octaAccessToken = OCTA_TOKEN;
  _octaTokenExpires = Date.now() + 10*60*1000;
  return OCTA_TOKEN;
}

async function octaNewGet(path) {
  var result = await request(OCTA_BASE_NEW + path, { 'x-api-key':OCTA_KEY_NEW, 'Content-Type':'application/json' });
  try { return { status: result.status, data: JSON.parse(result.body) }; } catch(e) { return { status: result.status, data: result.body }; }
}

async function handleOctaTickets(req, res) {
  var hoje = new Date();
  var dd = String(hoje.getDate()).padStart(2,'0');
  var mm = String(hoje.getMonth()+1).padStart(2,'0');
  var yyyy = hoje.getFullYear();
  var dataHoje = yyyy + '-' + mm + '-' + dd;
  try {
    var todosTickets = [];
    var pagNum = 1;
    while (pagNum <= 200) {
      var rPage = await octaNewGet('/tickets?limit=100&page=' + pagNum);
      if (rPage.status !== 200) break;
      var iPage = Array.isArray(rPage.data) ? rPage.data : (rPage.data && (rPage.data.data || rPage.data.items || []));
      if (!iPage || iPage.length === 0) break;
      var temAnterior = false;
      iPage.forEach(function(t) {
        var dt = (t.createdAt || '').substring(0, 10);
        if (dt === dataHoje) todosTickets.push(t);
        else if (dt && dt < dataHoje) temAnterior = true;
      });
      if (temAnterior || iPage.length < 100) break;
      pagNum++;
    }
    var contagens = { novo:0, emAndamento:0, pendente:0, resolvido:0, cancelado:0, outros:0 };
    var statusMap = {};
    var tmaSegundos = [];
    var notas = [];
    todosTickets.forEach(function(t) {
      var statusNome = (t.status && t.status.name) || String(t.status||'');
      var sl = statusNome.toLowerCase();
      statusMap[statusNome] = (statusMap[statusNome]||0) + 1;
      if      (sl.indexOf('novo') !== -1 || sl === 'new' || sl === 'open')     contagens.novo++;
      else if (sl.indexOf('andamento') !== -1 || sl.indexOf('progress') !== -1) contagens.emAndamento++;
      else if (sl.indexOf('pendente') !== -1 || sl.indexOf('pending') !== -1)   contagens.pendente++;
      else if (sl.indexOf('resolv') !== -1 || sl.indexOf('solved') !== -1)      contagens.resolvido++;
      else if (sl.indexOf('cancel') !== -1)                                      contagens.cancelado++;
      else                                                                         contagens.outros++;
      if (t.resolutionDate || t.resolvedAt) {
        var criado = new Date(t.createdAt); var fechado = new Date(t.resolutionDate || t.resolvedAt);
        if (!isNaN(criado) && !isNaN(fechado) && fechado > criado) {
          var diff = calcularTempoUtil(criado, fechado);
          if (diff > 0) tmaSegundos.push(diff);
        }
      }
      var nota = t.satisfactionScore || t.satisfaction || t.rating;
      if (nota !== undefined && nota !== null) { var n = parseFloat(nota); if (!isNaN(n) && n > 0) notas.push(n); }
    });
    var tmaFormatado = '—';
    if (tmaSegundos.length > 0) {
      var mediaSeg = Math.round(tmaSegundos.reduce(function(a,b){return a+b;},0) / tmaSegundos.length);
      var th = Math.floor(mediaSeg/3600), tm = Math.floor((mediaSeg%3600)/60), ts = mediaSeg%60;
      tmaFormatado = (th>0?String(th).padStart(2,'0')+'h ':'') + String(tm).padStart(2,'0')+'m ' + String(ts).padStart(2,'0')+'s';
    }
    var notaMedia = null;
    if (notas.length > 0) notaMedia = parseFloat((notas.reduce(function(a,b){return a+b;},0)/notas.length).toFixed(2));
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ data:dataHoje, total:todosTickets.length, contagens:contagens, statusEncontrados:statusMap, tma:tmaFormatado, tmaDetalhes: tmaSegundos.length ? { baseTickets: tmaSegundos.length } : null, notaSatisfacao:notaMedia, totalAvaliacoes:notas.length }));
  } catch(err) {
    res.writeHead(502, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ error: err.message }));
  }
}

function calcularTempoUtil(inicio, fim) {
  var HORARIOS = [null,{ini:8*60,fim:19*60},{ini:8*60,fim:19*60},{ini:8*60,fim:19*60},{ini:8*60,fim:19*60},{ini:8*60,fim:19*60},{ini:9*60,fim:17*60}];
  var HORARIO_DOM = {ini:9*60,fim:15*60};
  function horarioDia(dw) { return dw === 0 ? HORARIO_DOM : HORARIOS[dw]; }
  function proximoHorarioUtil(dt) {
    var d = new Date(dt), dw = d.getDay(), h = d.getHours()*60+d.getMinutes(), hr = horarioDia(dw);
    if (h < hr.ini) { d.setHours(Math.floor(hr.ini/60), hr.ini%60, 0, 0); }
    else if (h >= hr.fim) { d.setDate(d.getDate()+1); d.setHours(0,0,0,0); var proxHr=horarioDia(d.getDay()); d.setHours(Math.floor(proxHr.ini/60),proxHr.ini%60,0,0); }
    return d;
  }
  var cur = proximoHorarioUtil(new Date(inicio)), total = 0, maxIter = 30;
  while (cur < fim && maxIter-- > 0) {
    var hr = horarioDia(cur.getDay()), diaFim = new Date(cur);
    diaFim.setHours(Math.floor(hr.fim/60), hr.fim%60, 0, 0);
    var segFim = fim < diaFim ? fim : diaFim;
    total += Math.max(0, (segFim - cur) / 1000);
    cur = new Date(diaFim); cur.setDate(cur.getDate()+1);
    var proxHr = horarioDia(cur.getDay()); cur.setHours(Math.floor(proxHr.ini/60),proxHr.ini%60,0,0);
  }
  return total;
}

async function handleOctaDebug(req, res) {
  try {
    var amostra = await octaNewGet('/tickets?pageSize=3');
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify(amostra.data, null, 2));
  } catch(e) {
    res.writeHead(500, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ error: e.message }));
  }
}

async function handleOctadesk(req, res, reqUrl) {
  var sub = reqUrl.pathname.replace(/^\/octadesk/, '');
  try {
    var result = await request(OCTA_BASE + sub + (reqUrl.search||''), { 'Authorization': OCTA_TOKEN });
    res.writeHead(result.status, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(result.body);
  } catch(err) {
    res.writeHead(502, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleHealth(res) {
  res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
  res.end(JSON.stringify({ status:'ok', hora:new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}), rotas:['GET /health','GET /api/escala','POST /api/aderencia','GET /pbx/notas','GET /pbx/espera','GET /pbx/realtime-dashboard','GET /octa/tickets'] }));
}

var server = http.createServer(async function(req, res) {
  var reqUrl   = url.parse(req.url, true);
  var pathname = reqUrl.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  console.log(new Date().toLocaleTimeString('pt-BR') + ' ' + req.method + ' ' + pathname);
  if (pathname === '/health')                  return handleHealth(res);
  if (pathname === '/api/escala')              return handleEscala(req, res);
  if (pathname === '/api/aderencia')           return handleAderencia(req, res);
  if (pathname === '/api/ping')                return (res.writeHead(200, Object.assign({'Content-Type':'application/json'},CORS)), res.end(JSON.stringify({ok:true})));
  if (pathname === '/pbx/report01')            return handlePbxReport(req, res, 'report_01');
  if (pathname === '/pbx/report02')            return handlePbxReport(req, res, 'report_02');
  if (pathname === '/pbx/filas-por-chamada')   return handleFilasPorChamada(req, res);
  if (pathname === '/pbx/filas-todas')         return handleFilasPorChamada(req, res);
  if (pathname === '/pbx/notas')               return handleNotas(req, res);
  if (pathname === '/pbx/quiz-scan')           return handleQuizScan(req, res);
  if (pathname === '/pbx/notas-teste')         return handleNotasTeste(req, res, reqUrl);
  if (pathname === '/pbx/debug')               return handlePbxDebug(req, res);
  if (pathname === '/pbx/espera')              return handlePbxEspera(req, res);
  if (pathname === '/pbx/realtime-dashboard')  return handleRealtimeDashboard(req, res);
  if (pathname === '/octa/tickets')            return handleOctaTickets(req, res);
  if (pathname === '/octa/debug')              return handleOctaDebug(req, res);
  if (pathname.startsWith('/octadesk'))        return handleOctadesk(req, res, reqUrl);
  if (pathname === '/api/pbx') {
    var action = reqUrl.query && reqUrl.query.action;
    if (action === 'notas')    return handleNotas(req, res);
    if (action === 'report01') return handlePbxReport(req, res, 'report_01');
    if (action === 'espera')   return handlePbxEspera(req, res);
    return handlePbxReport(req, res, 'report_01');
  }
  res.writeHead(404, Object.assign({ 'Content-Type': 'application/json' }, CORS));
  res.end(JSON.stringify({ error: 'Rota nao encontrada', path: pathname }));
});

server.listen(PORT, function() {
  console.log('');
  console.log('=========================================');
  console.log('  VELOTAX PROXY - OPERACOES');
  console.log('=========================================');
  console.log('  Rodando em  http://localhost:' + PORT);
  console.log('  Health:     http://localhost:' + PORT + '/health');
  console.log('  Notas:      http://localhost:' + PORT + '/pbx/notas');
  console.log('  Realtime:   http://localhost:' + PORT + '/pbx/realtime-dashboard');
  console.log('=========================================');
  console.log('');
  setTimeout(iniciarSocketEspera, 2000);

  // ── TTL Realtime: zera estado se nenhum evento chegou em 35s ──────────────
  setInterval(function() {
    if (_realtimeState.ts === 0) return; // ainda não recebeu nenhum dado
    var ageMs = Date.now() - _realtimeState.ts;
    if (ageMs > 35000) {
      console.log('[REALTIME] sem eventos há ' + Math.round(ageMs/1000) + 's — zerando estado');
      _realtimeState = {
        ts: 0,
        totals: { in_ura: 0, waiting_human: 0, in_human_service: 0, free_agents: 0 },
        by_queue: [],
      };
      _esperaCache = 0;
      _esperaTs    = 0;
    }
  }, 5000); // checa a cada 5s
});

server.on('error', function(err) {
  if (err.code === 'EADDRINUSE') { console.error('\n[ERRO] Porta ' + PORT + ' ja esta em uso.\n'); }
  else { console.error('[ERRO] ' + err.message); }
  process.exit(1);
});

process.on('uncaughtException', function(err) { console.error('[ERRO NAO TRATADO] ' + err.message); });
process.on('unhandledRejection', function(reason) { console.error('[PROMISE REJEITADA] ' + (reason && reason.message ? reason.message : String(reason))); });
