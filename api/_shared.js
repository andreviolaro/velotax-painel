// Modulo compartilhado para todas as API functions do Vercel

const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

// Credenciais (via variaves de ambiente no Vercel)
const PBX_KEY     = process.env.PBX_KEY     || 'e59c885f-5c40-4cd3-94ab-933c8de3dcc0-20265620361';
const PBX_BASE    = process.env.PBX_BASE    || 'https://reportapi02.55pbx.com:50500';
const OCTA_KEY_NEW  = process.env.OCTA_KEY_NEW  || '4cd77bd3-3016-47df-8760-f1c469e77285.77c54187-56ea-4a43-af15-d288cd74a1e9';
const OCTA_BASE_NEW = process.env.OCTA_BASE_NEW || 'https://o199103-bfa.api001.octadesk.services';
const ADER_API_KEY  = process.env.ADER_API_KEY  || 'af29edb8-05a7-4d5d-869f-95b3935e5c1a-20265533862';

function request(targetUrl, headers, method, body) {
  headers = headers || {};
  method  = method  || 'GET';
  return new Promise(function(resolve, reject) {
    var parsed;
    try { parsed = new URL(targetUrl); } catch(e) { return reject(new Error('URL invalida: '+targetUrl)); }
    var opts = {
      hostname: parsed.hostname,
      port    : parsed.port || 443,
      path    : parsed.pathname + (parsed.search||''),
      method  : method,
      headers : Object.assign({ 'Accept': 'application/json' }, headers),
      timeout : 55000,
      rejectUnauthorized: false,
    };
    var req = https.request(opts, function(res) {
      var buf = '';
      res.on('data', function(chunk) { buf += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: buf }); });
    });
    req.on('timeout', function() { req.destroy(); reject(new Error('Timeout (55s)')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function octaNewGet(path) {
  var result = await request(OCTA_BASE_NEW + path, {
    'x-api-key'    : OCTA_KEY_NEW,
    'Content-Type' : 'application/json',
    'Accept'       : 'application/json',
  });
  try { return { status: result.status, data: JSON.parse(result.body) }; }
  catch(e) { return { status: result.status, data: result.body }; }
}

function to55Date(dateStr, end) {
  var DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var parts=dateStr.split('-').map(Number);
  var dt=new Date(parts[0],parts[1]-1,parts[2]);
  return DAYS[dt.getDay()]+' '+MONTHS[parts[1]-1]+' '+String(parts[2]).padStart(2,'0')+' '+parts[0]+' '+(end?'23:59:59':'00:00:00')+' GMT -0300';
}

function handleCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, data, status) {
  handleCors(res);
  res.status(status||200).json(data);
}

module.exports = { request, octaNewGet, to55Date, sendJson, handleCors,
  PBX_KEY, PBX_BASE, OCTA_KEY_NEW, OCTA_BASE_NEW, ADER_API_KEY, CORS };
