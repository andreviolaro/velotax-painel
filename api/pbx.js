// api/pbx.js - Endpoints da 55PBX
const { request, to55Date, sendJson, PBX_KEY, PBX_BASE } = require('./_shared');

function getPbxDates() {
  var now = new Date();
  var y = now.getFullYear(), m = String(now.getMonth()+1).padStart(2,'0'), d = String(now.getDate()).padStart(2,'0');
  var today = y+'-'+m+'-'+d;
  return { start: to55Date(today, false), end: to55Date(today, true) };
}

async function getReport(report) {
  var { start, end } = getPbxDates();
  var s = encodeURIComponent(start), e = encodeURIComponent(end);
  var path = '/api/pbx/reports/metrics/'+s+'/'+e+'/all_queues/all_numbers/all_agent/'+report+'/undefined/-3';
  var r = await request(PBX_BASE + path, { 'key': PBX_KEY, 'Accept': 'application/json' });
  var data; try { data = JSON.parse(r.body); } catch(ex) { data = {}; }
  return { status: r.status, data: data };
}

module.exports = async function(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  var action = req.query.action || 'report01';

  try {
    if (action === 'report01') {
      var r = await getReport('report_01');
      if (r.status !== 200) return sendJson(res, { error: 'PBX HTTP '+r.status }, 502);
      var d = r.data;
      var raw = Array.isArray(d) ? d[0] : (d.data_report01 ? d.data_report01[0] : d);

      var proc  = raw.totalCallProcessedQueue || 0;
      var att   = raw.totalCallAttendedReceptive || 0;
      var aband = raw.totalCallAbandonedQueue || 0;
      var pctAtt  = proc > 0 ? ((att/proc)*100).toFixed(1) : '0.0';
      var pctAb   = proc > 0 ? ((aband/proc)*100).toFixed(1) : '0.0';

      function fmtTime(s) {
        if (!s) return '00:00:00';
        var parts = String(s).split(':');
        if (parts.length === 3) return parts.map(function(p){return String(p).padStart(2,'0');}).join(':');
        var sec = parseInt(s)||0;
        return String(Math.floor(sec/3600)).padStart(2,'0')+':'+String(Math.floor((sec%3600)/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
      }

      return sendJson(res, {
        processadas : proc,
        atendidas   : att,
        abandonadas : aband,
        pctAtendidas: pctAtt,
        pctAband    : pctAb,
        tma         : fmtTime(raw.timeMediumDurationCall),
        maxEspera   : fmtTime(raw.timeMaxWaitingAttendance),
        maxChamada  : fmtTime(raw.timeMaxDurationCall),
        notaAtendente: raw.quizAverageAttendant || null,
        notaSolucao  : raw.quizAverageSolution  || null,
        _raw: raw,
      });
    }

    if (action === 'notas') {
      var r2 = await getReport('report_02');
      if (r2.status !== 200) return sendJson(res, { notaAtendente: null, notaSolucao: null });
      var records = Array.isArray(r2.data) ? r2.data : (r2.data.data_report02 || r2.data.data || []);
      var somaAtt = 0, cntAtt = 0, somaSol = 0, cntSol = 0;
      records.forEach(function(rec) {
        var v2 = parseFloat(rec.wk_ivr_2_option); if (!isNaN(v2) && v2>0) { somaAtt+=v2; cntAtt++; }
        var v3 = parseFloat(rec.wk_ivr_3_option); if (!isNaN(v3) && v3>0) { somaSol+=v3; cntSol++; }
      });
      return sendJson(res, {
        notaAtendente: cntAtt>0 ? (somaAtt/cntAtt).toFixed(2) : null,
        notaSolucao  : cntSol>0 ? (somaSol/cntSol).toFixed(2) : null,
        totalAtt: cntAtt, totalSol: cntSol,
      });
    }

    if (action === 'espera') {
      return sendJson(res, { emEspera: 0, fonte: 'indisponivel' });
    }

    return sendJson(res, { error: 'action invalida' }, 400);

  } catch(err) {
    return sendJson(res, { error: err.message }, 502);
  }
};
