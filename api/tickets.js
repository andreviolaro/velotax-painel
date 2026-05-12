// api/tickets.js - Tickets do dia via Octadesk
const { octaNewGet, sendJson } = require('./_shared');

function calcularTempoUtil(inicio, fim) {
  var HORARIOS = [
    { ini: 9*60, fim: 15*60 },  // 0 dom
    { ini: 8*60, fim: 19*60 },  // 1 seg
    { ini: 8*60, fim: 19*60 },  // 2 ter
    { ini: 8*60, fim: 19*60 },  // 3 qua
    { ini: 8*60, fim: 19*60 },  // 4 qui
    { ini: 8*60, fim: 19*60 },  // 5 sex
    { ini: 9*60, fim: 17*60 },  // 6 sab
  ];
  function proximoUtil(dt) {
    var d = new Date(dt), h = d.getHours()*60+d.getMinutes(), hr = HORARIOS[d.getDay()];
    if (h < hr.ini) { d.setHours(Math.floor(hr.ini/60), hr.ini%60, 0, 0); }
    else if (h >= hr.fim) {
      d.setDate(d.getDate()+1); d.setHours(0,0,0,0);
      var ph = HORARIOS[d.getDay()]; d.setHours(Math.floor(ph.ini/60), ph.ini%60, 0, 0);
    }
    return d;
  }
  var cur = proximoUtil(new Date(inicio)), total = 0, max = 30;
  while (cur < fim && max-- > 0) {
    var hr = HORARIOS[cur.getDay()];
    var df = new Date(cur); df.setHours(Math.floor(hr.fim/60), hr.fim%60, 0, 0);
    var sf = fim < df ? fim : df;
    total += Math.max(0, (sf - cur)/1000);
    cur = new Date(df); cur.setDate(cur.getDate()+1);
    var ph = HORARIOS[cur.getDay()]; cur.setHours(Math.floor(ph.ini/60), ph.ini%60, 0, 0);
  }
  return total;
}

module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    var now = new Date();
    var dataHoje = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');

    var todosTickets = [], pagNum = 1;
    while (pagNum <= 200) {
      var r = await octaNewGet('/tickets?limit=100&page='+pagNum);
      if (r.status !== 200) break;
      var items = Array.isArray(r.data) ? r.data : (r.data && (r.data.data||r.data.items||[]));
      if (!items || items.length === 0) break;
      var temAnterior = false;
      items.forEach(function(t) {
        var dt = (t.createdAt||'').substring(0,10);
        if (dt === dataHoje) todosTickets.push(t);
        else if (dt && dt < dataHoje) temAnterior = true;
      });
      if (temAnterior || items.length < 100) break;
      pagNum++;
    }

    var contagens = { novo:0, emAndamento:0, pendente:0, resolvido:0, cancelado:0, outros:0 };
    var statusMap = {}, tmaSegs = [];
    todosTickets.forEach(function(t) {
      var sn = (t.status && t.status.name) || String(t.status||'');
      var sl = sn.toLowerCase();
      statusMap[sn] = (statusMap[sn]||0)+1;
      if      (sl.includes('novo'))      contagens.novo++;
      else if (sl.includes('andamento')) contagens.emAndamento++;
      else if (sl.includes('pendente'))  contagens.pendente++;
      else if (sl.includes('resolv'))    contagens.resolvido++;
      else if (sl.includes('cancel'))    contagens.cancelado++;
      else                               contagens.outros++;
      if (t.resolutionDate) {
        var diff = calcularTempoUtil(new Date(t.createdAt), new Date(t.resolutionDate));
        if (diff > 0) tmaSegs.push(diff);
      }
    });

    var tma = '—';
    if (tmaSegs.length > 0) {
      var med = Math.round(tmaSegs.reduce(function(a,b){return a+b;},0)/tmaSegs.length);
      var h=Math.floor(med/3600), m=Math.floor((med%3600)/60), s=med%60;
      tma = (h>0?String(h).padStart(2,'0')+'h ':'') + String(m).padStart(2,'0')+'m '+String(s).padStart(2,'0')+'s';
    }

    return sendJson(res, {
      data: dataHoje, total: todosTickets.length,
      contagens, statusEncontrados: statusMap,
      tma, tmaDetalhes: tmaSegs.length > 0 ? { baseTickets: tmaSegs.length } : null,
      notaSatisfacao: null, totalAvaliacoes: 0,
    });
  } catch(err) {
    return sendJson(res, { error: err.message }, 502);
  }
};
