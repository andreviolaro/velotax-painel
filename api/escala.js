// api/escala.js - Leitura da escala via Excel (armazenado em /tmp no Vercel)
// NOTA: No Vercel, o Excel precisa ser enviado via API ou armazenado em variavel de ambiente
// Por enquanto retorna dados mockados ate configurar storage

const { sendJson } = require('./_shared');

module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  // No Vercel nao ha sistema de arquivos persistente
  // A escala sera carregada via upload ou variavel de ambiente
  // Por ora retorna array vazio com mensagem
  return sendJson(res, [], 200);
};
