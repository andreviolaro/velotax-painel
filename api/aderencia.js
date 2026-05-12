// api/aderencia.js - Consulta logins via 55PBX report_04
const { request, to55Date, sendJson, ADER_API_KEY } = require('./_shared');

module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendJson(res, { error: 'POST apenas' }, 405);

  try {
    var body = req.body || {};
    var { agents, date } = body;
    if (!agents || !date) return sendJson(res, { error: 'agents e date obrigatorios' }, 400);

    var start = to55Date(date, false), end = to55Date(date, true);
    var s = encodeURIComponent(start), e = encodeURIComponent(end);
    var path = '/api/pbx/reports/metrics/'+s+'/'+e+'/all_queues/all_numbers/all_agent/report_04/undefined/-3';

    var r = await request('https://reportapi02.55pbx.com:50500'+path, { 'key': ADER_API_KEY, 'Accept': 'application/json' });
    var parsed; try { parsed = JSON.parse(r.body); } catch(e) { parsed = {}; }

    var allRecords = [];
    if (Array.isArray(parsed)) allRecords = parsed;
    else if (Array.isArray(parsed.data_report04)) allRecords = parsed.data_report04;
    else if (Array.isArray(parsed.data)) allRecords = parsed.data;

    var results = agents.map(function(agent) {
      var ramal = String(agent.ramal);
      var mine  = allRecords.filter(function(rec){ return String(rec.branch) === ramal; });
      var logins = mine.filter(function(rec){
        return rec.event && rec.event.toLowerCase().includes('online') && !rec.event.toLowerCase().includes('pausa');
      }).sort(function(a,b){ return new Date(a.time)-new Date(b.time); });
      return { id: agent.id, name: agent.name, firstLogin: logins[0]||null };
    });

    return sendJson(res, { date, results });
  } catch(err) {
    return sendJson(res, { error: err.message }, 502);
  }
};
