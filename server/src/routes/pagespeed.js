import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { validateUrl } from '../middleware/validate.js';
import PDFDocument from 'pdfkit';
import db from '../database.js';
import process from 'process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();
router.use(authMiddleware);

// ── Load Chevla logo for PDF ──
let logoBuffer = null;
try {
  logoBuffer = readFileSync(join(__dirname, '..', 'assets', 'chevla-logo.png'));
} catch (e) { console.warn('[PageSpeed] Logo not found — PDF will skip logo'); }

// ═══════════════════════════════════════════
//  Helper: fetch one strategy from Google API
// ═══════════════════════════════════════════
async function fetchStrategy(target, strategy) {
  const apiKey = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  let apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(target)}&strategy=${strategy}&category=performance&category=accessibility&category=best-practices&category=seo`;
  if (apiKey) apiUrl += `&key=${apiKey}`;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let response;
    try {
      response = await fetch(apiUrl, { signal: AbortSignal.timeout(120000) });
    } catch (err) {
      console.warn(`[PageSpeed] Fetch error (${strategy}, attempt ${attempt}/${MAX_RETRIES}):`, err.message || err);
      if (attempt < MAX_RETRIES) {
        const wait = attempt * 5000;
        console.log(`[PageSpeed] Retrying in ${wait / 1000}s...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw new Error('Falha de rede ou timeout ao consultar o PageSpeed Insights. Tente novamente.');
    }

    if (!response.ok) {
      let errMsg = 'Erro ao consultar PageSpeed Insights';
      let errJson = {};
      try { errMsg = await response.text(); try { errJson = JSON.parse(errMsg); errMsg = errJson?.error?.message || errMsg; } catch {} } catch {}

      const isQuota = response.status === 429 || /quota|rate|limit/i.test(errMsg);
      if ((isQuota || response.status >= 500) && attempt < MAX_RETRIES) {
        console.log(`[PageSpeed] HTTP ${response.status} (${strategy}, attempt ${attempt}) — waiting ${attempt * 15}s...`);
        await new Promise(r => setTimeout(r, attempt * 15000));
        continue;
      }

      if (/has not been used|disabled/i.test(errMsg)) {
        const m = errMsg.match(/project\s+(\d+)/i);
        const link = m ? `https://console.developers.google.com/apis/api/pagespeedonline.googleapis.com/overview?project=${m[1]}` : 'https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com';
        throw new Error(`A API PageSpeed não está ativada no Google Cloud. Ative em: ${link}`);
      }
      if (isQuota) throw new Error('Limite da API atingido. Aguarde 1-2 minutos e tente novamente.');
      throw new Error(errMsg);
    }

    const data = await response.json();
    const lh = data.lighthouseResult;
    if (!lh) throw new Error('Resultado vazio do PageSpeed');

    // Handle Lighthouse runtime errors (site unreachable, DNS fail, etc.)
    if (lh.runtimeError) {
      const code = lh.runtimeError.code || '';
      const raw = lh.runtimeError.message || '';
      const errMap = {
        'FAILED_DOCUMENT_REQUEST': `Não foi possível acessar o site "${target}". Verifique se o endereço está correto e se o site está no ar.`,
        'DNS_FAILURE':             `O domínio "${target}" não foi encontrado. Verifique se o endereço está correto.`,
        'ERRORED_DOCUMENT_REQUEST':`O site "${target}" retornou um erro ao carregar. Verifique se está funcionando normalmente.`,
        'INSECURE_DOCUMENT_REQUEST':`O certificado SSL do site "${target}" é inválido ou expirou.`,
        'CHROME_INTERSTITIAL_ERROR':`O site "${target}" exibe um aviso de segurança que impede a análise.`,
      };
      throw new Error(errMap[code] || `Erro ao analisar o site: ${raw}`);
    }

    const cats = lh.categories || {};
    const audits = lh.audits || {};

    const metrics = {
      fcp: audits['first-contentful-paint']?.displayValue || '-',
      fcp_score: Math.round((audits['first-contentful-paint']?.score || 0) * 100),
      lcp: audits['largest-contentful-paint']?.displayValue || '-',
      lcp_score: Math.round((audits['largest-contentful-paint']?.score || 0) * 100),
      tbt: audits['total-blocking-time']?.displayValue || '-',
      tbt_score: Math.round((audits['total-blocking-time']?.score || 0) * 100),
      cls: audits['cumulative-layout-shift']?.displayValue || '-',
      cls_score: Math.round((audits['cumulative-layout-shift']?.score || 0) * 100),
      si: audits['speed-index']?.displayValue || '-',
      si_score: Math.round((audits['speed-index']?.score || 0) * 100),
      tti: audits['interactive']?.displayValue || '-',
      tti_score: Math.round((audits['interactive']?.score || 0) * 100),
    };

    const opportunities = Object.values(audits)
      .filter(a => a.details?.type === 'opportunity' && a.score !== null && a.score < 1)
      .sort((a, b) => (a.score || 0) - (b.score || 0))
      .slice(0, 10)
      .map(a => ({ title: a.title, description: a.description, displayValue: a.displayValue || '', score: Math.round((a.score || 0) * 100) }));

    const diagnostics = Object.values(audits)
      .filter(a => a.details?.type === 'table' && a.score !== null && a.score < 1 && !opportunities.find(o => o.title === a.title))
      .sort((a, b) => (a.score || 0) - (b.score || 0))
      .slice(0, 8)
      .map(a => ({ title: a.title, description: a.description, displayValue: a.displayValue || '', score: Math.round((a.score || 0) * 100) }));

    return {
      strategy,
      scores: {
        performance: Math.round((cats.performance?.score || 0) * 100),
        accessibility: Math.round((cats.accessibility?.score || 0) * 100),
        bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
        seo: Math.round((cats.seo?.score || 0) * 100),
      },
      metrics, opportunities, diagnostics,
    };
  }
  throw new Error('Limite da API após múltiplas tentativas.');
}

// ═══════════════════════════════════════════
//  POST /analyze — runs BOTH mobile + desktop
// ═══════════════════════════════════════════
router.post('/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL é obrigatória' });
    if (!validateUrl(url)) return res.status(400).json({ error: 'URL inválida' });

    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

    console.log(`[PageSpeed] Analysing ${target} (mobile + desktop)...`);

    // Sequential calls to avoid Google rate-limiting when doing parallel requests
    const mobile = await fetchStrategy(target, 'mobile');
    console.log(`[PageSpeed] Mobile done: ${mobile.scores.performance}`);
    const desktop = await fetchStrategy(target, 'desktop');
    console.log(`[PageSpeed] Desktop done: ${desktop.scores.performance}`);

    const result = { url: target, fetchTime: new Date().toISOString(), mobile, desktop };

    const info = await db.run(
      `INSERT INTO pagespeed_reports (url, strategy, scores_json, metrics_json, opportunities_json, diagnostics_json) VALUES (?, ?, ?, ?, ?, ?)`,
      [target, 'both',
        JSON.stringify({ mobile: mobile.scores, desktop: desktop.scores }),
        JSON.stringify({ mobile: mobile.metrics, desktop: desktop.metrics }),
        JSON.stringify({ mobile: mobile.opportunities, desktop: desktop.opportunities }),
        JSON.stringify({ mobile: mobile.diagnostics, desktop: desktop.diagnostics }),
      ]
    );
    result.id = info.lastInsertRowid;

    console.log(`[PageSpeed] Done: ${target} — Mobile: ${mobile.scores.performance} / Desktop: ${desktop.scores.performance}`);
    res.json(result);
  } catch (err) {
    console.error('[PageSpeed] Error:', err.message);
    const code = /quota|limit|rate/i.test(err.message) ? 429 : /ativada/i.test(err.message) ? 403 : 500;
    res.status(code).json({ error: err.message || 'Erro ao analisar site' });
  }
});

// ── List saved reports ──
router.get('/reports', async (req, res) => {
  try {
    const reports = await db.all('SELECT id, url, strategy, scores_json, created_at FROM pagespeed_reports ORDER BY created_at DESC LIMIT 50');
    const parsed = reports.map(r => {
      const scores = JSON.parse(r.scores_json);
      return { id: r.id, url: r.url, strategy: r.strategy, scores: scores.mobile ? scores : { mobile: scores, desktop: scores }, created_at: r.created_at };
    });
    res.json(parsed);
  } catch (err) { console.error('[PageSpeed] Reports error:', err); res.status(500).json({ error: 'Erro ao listar relatórios' }); }
});

// ── Delete ──
router.delete('/reports/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem excluir relatórios' });
    await db.run('DELETE FROM pagespeed_reports WHERE id = ?', [id]);
    res.json({ ok: true });
  }
  catch (err) { res.status(500).json({ error: 'Erro ao excluir relatório' }); }
});

// ── PDF from saved report ──
router.get('/reports/:id/pdf', async (req, res) => {
  try {
    const report = await db.get('SELECT * FROM pagespeed_reports WHERE id = ?', [Number(req.params.id)]);
    if (!report) return res.status(404).json({ error: 'Relatório não encontrado' });
    const scores = JSON.parse(report.scores_json);
    const metrics = JSON.parse(report.metrics_json);
    const opps = JSON.parse(report.opportunities_json || '[]');
    const diags = JSON.parse(report.diagnostics_json || '[]');
    const d = {
      url: report.url, created_at: report.created_at,
      mobile:  { scores: scores.mobile||scores, metrics: metrics.mobile||metrics, opportunities: opps.mobile||opps, diagnostics: diags.mobile||diags },
      desktop: { scores: scores.desktop||scores, metrics: metrics.desktop||metrics, opportunities: opps.desktop||opps, diagnostics: diags.desktop||diags },
    };
    generatePdf(res, d);
  } catch (err) { console.error('[PageSpeed] PDF error:', err); if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar PDF' }); }
});

// ── PDF from live result ──
router.post('/pdf', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.mobile) return res.status(400).json({ error: 'Dados inválidos' });
    generatePdf(res, data);
  } catch (err) { console.error('[PageSpeed] PDF error:', err); if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar PDF' }); }
});

// ═══════════════════════════════════════════════════════════
//   Translation — 100% Portuguese, no English ever
// ═══════════════════════════════════════════════════════════
const METRIC_INFO = {
  fcp: { nome: 'Primeira Renderização',   o_que: 'Tempo até o primeiro texto ou imagem aparecer na tela.',   ideal: 'Menos de 1,8 s' },
  lcp: { nome: 'Conteúdo Principal',      o_que: 'Tempo até o maior bloco de conteúdo ficar visível.',      ideal: 'Menos de 2,5 s' },
  tbt: { nome: 'Tempo de Travamento',     o_que: 'Quanto tempo a página fica travada sem responder.',       ideal: 'Menos de 200 ms' },
  cls: { nome: 'Estabilidade da Página',   o_que: 'Se os elementos pulam ou se movem durante o carregamento.', ideal: 'Menos de 0,1' },
  si:  { nome: 'Velocidade de Exibição',  o_que: 'Rapidez com que o conteúdo todo aparece na tela.',        ideal: 'Menos de 3,4 s' },
  tti: { nome: 'Pronta para Usar',        o_que: 'Quando a página começa a responder a cliques e toques.',  ideal: 'Menos de 3,8 s' },
};

// Full map: Google audit title → { t: titulo em pt, d: descrição em pt }
const OPP_MAP = {
  'Eliminate render-blocking resources':              { t: 'Remover recursos que travam o carregamento',           d: 'Arquivos CSS e JavaScript estão bloqueando a exibição. Adiar ou remover esses arquivos acelera o carregamento.' },
  'Properly size images':                             { t: 'Redimensionar imagens corretamente',                   d: 'Imagens maiores do que o necessário estão sendo enviadas, desperdiçando banda e tempo de carregamento.' },
  'Defer offscreen images':                           { t: 'Carregar imagens fora da tela sob demanda',            d: 'Imagens não visíveis estão sendo carregadas imediatamente. Adiá-las economiza tempo e dados.' },
  'Minify CSS':                                       { t: 'Reduzir tamanho dos arquivos de estilo',               d: 'Os arquivos CSS contêm espaços e comentários desnecessários que aumentam o download.' },
  'Minify JavaScript':                                { t: 'Reduzir tamanho dos arquivos de código',               d: 'Os arquivos JavaScript podem ser compactados para carregar mais rápido.' },
  'Remove unused CSS':                                { t: 'Remover estilos CSS não utilizados',                   d: 'Parte do CSS carregado nunca é usada nesta página, consumindo banda.' },
  'Remove unused JavaScript':                         { t: 'Remover código JavaScript não utilizado',              d: 'Parte do JavaScript não é necessária nesta página, atrasando a interatividade.' },
  'Reduce unused CSS':                                { t: 'Reduzir CSS não utilizado',                            d: 'Há código CSS que não é usado nesta página e está atrasando o carregamento.' },
  'Reduce unused JavaScript':                         { t: 'Reduzir JavaScript não utilizado',                     d: 'Há código JavaScript que não é usado nesta página e está atrasando o carregamento.' },
  'Efficiently encode images':                        { t: 'Comprimir imagens sem perder qualidade',               d: 'As imagens podem ser comprimidas sem perda visível, reduzindo o tempo de download.' },
  'Serve images in next-gen formats':                 { t: 'Usar formatos modernos de imagem (WebP)',              d: 'Converter para WebP ou AVIF reduz o tamanho das imagens em até 50%.' },
  'Enable text compression':                          { t: 'Ativar compressão Gzip no servidor',                   d: 'O servidor não comprime os arquivos, o que aumenta o tempo de transferência.' },
  'Reduce initial server response time':              { t: 'Melhorar tempo de resposta do servidor',               d: 'O servidor demora a responder à primeira requisição, afetando todo o carregamento.' },
  'Preconnect to required origins':                   { t: 'Conexão antecipada com servidores externos',           d: 'Conectar antecipadamente a servidores de fontes, analytics etc. ganha tempo.' },
  'Reduce JavaScript execution time':                 { t: 'Reduzir tempo de execução do JavaScript',              d: 'O JavaScript está levando muito tempo para executar, travando a página.' },
  'Avoid serving legacy JavaScript to modern browsers':{ t: 'Remover código antigo desnecessário',                 d: 'Código para navegadores antigos está sendo enviado sem necessidade.' },
  'Avoid an excessive DOM size':                      { t: 'Simplificar a estrutura HTML da página',               d: 'A página tem elementos HTML demais, deixando o navegador mais lento.' },
  'Avoid enormous network payloads':                  { t: 'Reduzir peso total da página',                         d: 'O total de downloads é grande demais. Comprimir e remover recursos ajuda.' },
  'Minimize main-thread work':                        { t: 'Reduzir processamento pesado',                         d: 'O navegador gasta muito tempo processando scripts e estilos no carregamento.' },
  'Largest Contentful Paint element':                 { t: 'Otimizar o maior elemento visível',                    d: 'O conteúdo principal demora a aparecer. Otimizá-lo melhora a experiência.' },
  'Avoid large layout shifts':                        { t: 'Evitar saltos de elementos na tela',                   d: 'Elementos mudam de posição ao carregar, causando experiência visual ruim.' },
  'Reduce the impact of third-party code':            { t: 'Reduzir impacto de scripts externos',                  d: 'Scripts como Analytics, chat e pixels de anúncio estão atrasando a página.' },
  'Lazy load third-party resources with facades':     { t: 'Carregar recursos externos sob demanda',               d: 'Widgets e iframes de terceiros podem ser adiados até o usuário interagir.' },
  'Avoid chaining critical requests':                 { t: 'Evitar cadeia sequencial de requisições',               d: 'Vários arquivos dependem uns dos outros em sequência, atrasando tudo.' },
  'Use video formats for animated content':           { t: 'Usar vídeo em vez de GIF',                             d: 'Animações GIF são pesadas. Converter para vídeo reduz o tamanho.' },
  'Third-party code':                                 { t: 'Reduzir scripts de terceiros',                         d: 'Códigos externos (analytics, chat, mapas) estão consumindo processamento.' },
  'Image elements do not have explicit width and height': { t: 'Definir dimensões nas imagens',                    d: 'Imagens sem largura e altura causam saltos no layout ao carregar.' },
  'Does not use passive listeners to improve scrolling performance': { t: 'Melhorar rolagem no celular',           d: 'Eventos de toque estão travando a rolagem.' },
  'Serve static assets with an efficient cache policy': { t: 'Usar cache eficiente para arquivos estáticos',       d: 'Arquivos estáticos não estão sendo cacheados, forçando download repetido.' },
  'Avoid multiple page redirects':                    { t: 'Evitar redirecionamentos múltiplos',                    d: 'A página redireciona várias vezes antes de carregar, atrasando a exibição.' },
  'Use HTTP/2':                                       { t: 'Usar protocolo HTTP/2 no servidor',                    d: 'O servidor usa protocolo antigo. HTTP/2 carrega recursos em paralelo.' },
  'Preload key requests':                             { t: 'Pré-carregar recursos importantes',                    d: 'Recursos essenciais deveriam ser carregados com prioridade.' },
  'Avoid document.write()':                           { t: 'Evitar scripts que bloqueiam a página',                 d: 'Uso de document.write() bloqueia a renderização em conexões lentas.' },
  'Has a <meta name="viewport"> tag with width or initial-scale': { t: 'Adicionar tag viewport',                   d: 'Sem viewport configurado, a página não se adapta a telas de celular.' },
  'Avoids unload event listeners':                    { t: 'Remover eventos de saída da página',                    d: 'Eventos "unload" impedem o navegador de usar cache de navegação.' },
  'Back/forward cache':                               { t: 'Compatibilidade com cache de navegação',               d: 'A página não é compatível com o cache de voltar/avançar do navegador.' },
  'Largest Contentful Paint image was not lazily loaded': { t: 'Não adiar o carregamento da imagem principal',      d: 'A imagem principal está com carregamento adiado, o que atrasa sua exibição.' },
  'Avoid long main-thread tasks':                     { t: 'Evitar tarefas pesadas no carregamento',                d: 'Tarefas longas estão travando a interatividade da página.' },
  'User Timing marks and measures':                   { t: 'Marcadores de tempo do desenvolvedor',                 d: 'Métricas de tempo personalizadas encontradas no site.' },
  'Ensure text remains visible during webfont load':  { t: 'Manter texto visível enquanto fontes carregam',         d: 'O texto fica invisível até as fontes carregarem, atrasando a leitura.' },
  'Keep request counts low and transfer sizes small': { t: 'Manter quantidade de requisições baixa',               d: 'O número de requisições e o tamanho dos downloads estão altos.' },
  'Avoid non-composited animations':                  { t: 'Otimizar animações da página',                         d: 'Animações não otimizadas estão consumindo processamento.' },
  'Image elements have explicit width and height':    { t: 'Imagens com dimensões definidas',                      d: 'Definir largura e altura nas imagens evita saltos de layout.' },
  'Uses efficient cache policy on static assets':     { t: 'Usar cache eficiente para arquivos estáticos',         d: 'Arquivos estáticos não possuem política de cache adequada.' },
  'Document does not have a meta description':        { t: 'Adicionar descrição da página (meta description)',     d: 'A página não tem meta description, o que prejudica o SEO no Google.' },
  'Links do not have descriptive text':               { t: 'Melhorar os textos dos links',                         d: 'Links com textos genéricos como "clique aqui" prejudicam acessibilidade e SEO.' },
  'Heading elements are not in a sequentially-descending order': { t: 'Organizar títulos da página',               d: 'Os títulos (H1, H2, H3) não estão na ordem correta.' },
};

// Fallback word-by-word translator for any title not in the map
const WORD_MAP = {
  'reduce': 'reduzir', 'remove': 'remover', 'avoid': 'evitar', 'eliminate': 'eliminar', 'minimize': 'minimizar',
  'enable': 'ativar', 'ensure': 'garantir', 'serve': 'servir', 'use': 'usar', 'defer': 'adiar',
  'unused': 'não utilizado', 'render-blocking': 'que travam carregamento', 'blocking': 'bloqueante',
  'images': 'imagens', 'image': 'imagem', 'resources': 'recursos', 'resource': 'recurso',
  'javascript': 'JavaScript', 'css': 'CSS', 'code': 'código', 'text': 'texto',
  'compression': 'compressão', 'cache': 'cache', 'server': 'servidor', 'network': 'rede',
  'page': 'página', 'document': 'documento', 'font': 'fonte', 'fonts': 'fontes',
  'properly': 'corretamente', 'efficiently': 'eficientemente', 'initial': 'inicial',
  'size': 'tamanho', 'sizes': 'tamanhos', 'large': 'grande', 'long': 'longo',
  'time': 'tempo', 'response': 'resposta', 'request': 'requisição', 'requests': 'requisições',
  'execution': 'execução', 'main-thread': 'thread principal', 'work': 'trabalho',
  'layout': 'layout', 'shift': 'mudança', 'shifts': 'mudanças', 'the': 'o', 'a': 'um',
  'third-party': 'de terceiros', 'offscreen': 'fora da tela', 'animated': 'animado',
  'content': 'conteúdo', 'format': 'formato', 'formats': 'formatos', 'video': 'vídeo',
  'static': 'estático', 'assets': 'arquivos', 'policy': 'política', 'efficient': 'eficiente',
  'explicit': 'explícita', 'width': 'largura', 'height': 'altura', 'elements': 'elementos',
  'element': 'elemento', 'excessive': 'excessivo', 'enormous': 'enorme', 'payloads': 'downloads',
  'an': 'um', 'and': 'e', 'with': 'com', 'to': 'para', 'of': 'de', 'for': 'para',
  'not': 'não', 'do': '', 'does': '', 'is': 'é', 'are': 'são', 'has': 'tem', 'have': 'ter',
  'impact': 'impacto', 'critical': 'crítico', 'key': 'chave', 'chaining': 'encadeamento',
  'multiple': 'múltiplos', 'redirects': 'redirecionamentos', 'preload': 'pré-carregar',
  'preconnect': 'pré-conectar', 'required': 'necessários', 'origins': 'origens',
  'modern': 'modernos', 'browsers': 'navegadores', 'legacy': 'antigo', 'next-gen': 'modernos',
  'passive': 'passivos', 'listeners': 'ouvintes', 'scrolling': 'rolagem', 'performance': 'desempenho',
  'loading': 'carregamento', 'load': 'carregar', 'loaded': 'carregado', 'visible': 'visível',
  'during': 'durante', 'webfont': 'fonte web', 'remains': 'permaneça', 'low': 'baixa',
  'small': 'pequeno', 'counts': 'contagem', 'transfer': 'transferência', 'keep': 'manter',
  'tasks': 'tarefas', 'task': 'tarefa', 'composited': 'compostas', 'animations': 'animações',
  'non-composited': 'não otimizadas', 'paint': 'pintura', 'dom': 'DOM', 'http/2': 'HTTP/2',
  'meta': 'meta', 'viewport': 'viewport', 'description': 'descrição', 'descriptive': 'descritivos',
  'links': 'links', 'heading': 'títulos', 'sequentially-descending': 'ordem decrescente', 'order': 'ordem',
  'back/forward': 'voltar/avançar', 'unload': 'saída', 'event': 'evento', 'events': 'eventos',
  'marks': 'marcadores', 'measures': 'medidas', 'timing': 'tempo', 'user': 'usuário',
  'speed': 'velocidade', 'index': 'índice', 'interactive': 'interativo', 'cumulative': 'cumulativo',
  'first': 'primeira', 'contentful': 'de conteúdo', 'largest': 'maior', 'total': 'total',
  'improve': 'melhorar', 'improving': 'melhorando',
};

function translateTitle(title) {
  // First check exact match
  if (OPP_MAP[title]) return OPP_MAP[title].t;
  // Word-by-word fallback
  return title.toLowerCase().split(/\s+/).map(w => WORD_MAP[w.toLowerCase()] ?? w).join(' ')
    .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
}

function translateDesc(title, rawDesc) {
  // First check map
  if (OPP_MAP[title]?.d) return OPP_MAP[title].d;
  // Clean markdown links and return empty (don't show raw English)
  if (!rawDesc) return '';
  // Strip markdown links, trim
  let clean = rawDesc.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
  if (!clean || /^[a-zA-Z]/.test(clean)) return ''; // Skip if still English
  return clean;
}

function sLabel(s) { return s >= 90 ? 'Excelente' : s >= 70 ? 'Bom' : s >= 50 ? 'Atenção' : 'Crítico'; }
function sHex(s)   { return s >= 90 ? '#059669' : s >= 50 ? '#d97706' : '#dc2626'; }
function sAlt(s)   { return s >= 90 ? '#ecfdf5' : s >= 50 ? '#fffbeb' : '#fef2f2'; }

// ═══════════════════════════════════════════════════════════
//   PDF Generation — Clean Professional Layout, 100% PT-BR
// ═══════════════════════════════════════════════════════════
function generatePdf(res, data) {
  const M = 50;                     // margin
  const W = 595 - M * 2;           // usable width = 495
  const PAGE_BOTTOM = 760;
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-${data.url.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
  doc.pipe(res);

  const dark = '#1e293b';
  const blue = '#0066ee';
  const muted = '#64748b';
  const now = new Date(data.created_at || Date.now());
  let y = 0;

  // ── Helpers ──
  function checkPage(need) { if (y > PAGE_BOTTOM - (need || 60)) { doc.addPage(); y = M; } }

  function drawText(text, x, py, opts = {}) {
    const { font = 'Helvetica', size = 9, color = dark, width, align, lineGap } = opts;
    doc.font(font).fontSize(size).fill(color);
    const textOpts = { lineBreak: false };
    if (width) { textOpts.width = width; textOpts.lineBreak = true; }
    if (align) textOpts.align = align;
    if (lineGap) textOpts.lineGap = lineGap;
    doc.text(text, x, py, textOpts);
  }

  // ─────────────────────────────────────────
  //  CAPA
  // ─────────────────────────────────────────
  doc.rect(0, 0, 595, 120).fill('#0f172a');
  let hY = 25;
  if (logoBuffer) {
    try { doc.image(logoBuffer, M, hY, { height: 36 }); hY += 44; } catch {}
  }
  drawText('Relatório de Performance', M, hY, { font: 'Helvetica-Bold', size: 22, color: '#ffffff', width: W });
  drawText(
    `Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    M, hY + 30, { size: 10, color: '#94a3b8' }
  );

  y = 140;
  drawText('Site analisado', M, y, { font: 'Helvetica-Bold', size: 11 });
  y += 18;
  drawText(data.url, M, y, { size: 11, color: blue });
  y += 20;
  drawText(
    'Este relatório analisa automaticamente a versão celular e a versão computador do site, usando a ferramenta oficial do Google (PageSpeed Insights). Notas de 0 a 100.',
    M, y, { size: 9, color: muted, width: W }
  );
  y += 32;

  // Separator
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
  y += 12;

  // ─────────────────────────────────────────
  //  TABELA DE NOTAS GERAIS
  // ─────────────────────────────────────────
  drawText('Notas Gerais', M, y, { font: 'Helvetica-Bold', size: 14 });
  y += 24;

  // Column positions
  const C1 = M;        // Categoria
  const C2 = M + 210;  // Celular
  const C3 = M + 320;  // Computador
  const C4 = M + 430;  // Situação
  const ROW_H = 32;

  // Header
  doc.rect(M, y, W, 26).fill('#0f172a');
  drawText('Categoria',  C1 + 10, y + 8, { font: 'Helvetica-Bold', size: 9, color: '#ffffff' });
  drawText('Celular',    C2 + 10, y + 8, { font: 'Helvetica-Bold', size: 9, color: '#ffffff' });
  drawText('Computador', C3 + 10, y + 8, { font: 'Helvetica-Bold', size: 9, color: '#ffffff' });
  drawText('Situação',   C4 + 10, y + 8, { font: 'Helvetica-Bold', size: 9, color: '#ffffff' });
  y += 26;

  const cats = [
    { label: 'Performance (Velocidade)', key: 'performance' },
    { label: 'Acessibilidade',           key: 'accessibility' },
    { label: 'Boas Práticas',            key: 'bestPractices' },
    { label: 'SEO (Posicionamento)',     key: 'seo' },
  ];

  cats.forEach((cat, i) => {
    const mS = data.mobile.scores[cat.key] || 0;
    const dS = data.desktop.scores[cat.key] || 0;
    const avg = Math.round((mS + dS) / 2);

    doc.rect(M, y, W, ROW_H).fill(i % 2 === 0 ? '#f8fafc' : '#ffffff');
    drawText(cat.label,     C1 + 10, y + 10, { size: 9 });
    drawText(String(mS),    C2 + 10, y + 8,  { font: 'Helvetica-Bold', size: 15, color: sHex(mS) });
    drawText(sLabel(mS),    C2 + 42, y + 12, { size: 7, color: muted });
    drawText(String(dS),    C3 + 10, y + 8,  { font: 'Helvetica-Bold', size: 15, color: sHex(dS) });
    drawText(sLabel(dS),    C3 + 42, y + 12, { size: 7, color: muted });
    drawText(sLabel(avg),   C4 + 10, y + 10, { font: 'Helvetica-Bold', size: 9, color: sHex(avg) });
    y += ROW_H;
  });

  y += 8;
  drawText('Verde (90+) = Excelente   ·   Amarelo (50-89) = Atenção   ·   Vermelho (0-49) = Crítico', M, y, { size: 7, color: '#94a3b8' });
  y += 16;

  // Separator
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
  y += 12;

  // ─────────────────────────────────────────
  //  RESUMO
  // ─────────────────────────────────────────
  const mP = data.mobile.scores.performance || 0;
  const dP = data.desktop.scores.performance || 0;

  drawText('Resumo da Análise', M, y, { font: 'Helvetica-Bold', size: 13 });
  y += 20;

  let resumo;
  if (mP < 50 && dP < 50)
    resumo = `O site apresenta performance crítica tanto no celular (nota ${mP}) quanto no computador (nota ${dP}). Os visitantes esperam demais para a página carregar, causando abandono e prejudicando o posicionamento no Google. Recomendamos ação imediata.`;
  else if (mP < 50)
    resumo = `A versão celular está muito lenta (nota ${mP}), enquanto a versão computador está melhor (nota ${dP}). Como mais de 60% dos acessos vêm de celulares, isso prejudica visitantes e vendas. Priorize otimizações para celular.`;
  else if (mP < 70)
    resumo = `O site funciona mas está abaixo do ideal no celular (nota ${mP}, computador: ${dP}). Concorrentes mais rápidos ganham posição no Google. As melhorias sugeridas podem trazer ganhos significativos.`;
  else if (mP < 90)
    resumo = `Boa performance geral: nota ${mP} no celular e ${dP} no computador. Ainda há espaço para melhorias que podem elevar as notas para excelente.`;
  else
    resumo = `Performance excelente: nota ${mP} no celular e ${dP} no computador. Site otimizado e rápido. Recomendamos monitorar periodicamente.`;

  const resumoH = 52;
  doc.roundedRect(M, y, W, resumoH, 4).fill(sAlt(mP));
  drawText(resumo, M + 14, y + 10, { size: 9, color: dark, width: W - 28, lineGap: 2 });
  y += resumoH + 14;

  // ─────────────────────────────────────────
  //  MÉTRICAS DE VELOCIDADE (nova página)
  // ─────────────────────────────────────────
  doc.addPage(); y = M;

  drawText('Métricas de Velocidade', M, y, { font: 'Helvetica-Bold', size: 14 });
  y += 18;
  drawText('Cada métrica mede um aspecto diferente do carregamento. Valores menores são melhores.', M, y, { size: 8, color: muted, width: W });
  y += 20;

  const MET_KEYS = ['fcp', 'lcp', 'tbt', 'cls', 'si', 'tti'];
  const MET_ROW = 56;

  MET_KEYS.forEach((key, i) => {
    checkPage(MET_ROW + 10);
    const info = METRIC_INFO[key];
    const mVal = data.mobile.metrics[key] || '-';
    const dVal = data.desktop.metrics[key] || '-';
    const mSc  = data.mobile.metrics[key + '_score'] ?? 50;
    const dSc  = data.desktop.metrics[key + '_score'] ?? 50;

    // Row background
    doc.rect(M, y, W, MET_ROW).fill(i % 2 === 0 ? '#f8fafc' : '#ffffff');

    // Left: name + explanation + ideal
    drawText(info.nome,                M + 12, y + 8,  { font: 'Helvetica-Bold', size: 10 });
    drawText(info.o_que,               M + 12, y + 22, { size: 8, color: muted, width: 270 });
    drawText('Ideal: ' + info.ideal,   M + 12, y + 38, { size: 7, color: '#94a3b8' });

    // Right: values
    const RV1 = M + 320;
    const RV2 = M + 420;
    drawText('Celular',     RV1, y + 6,  { size: 7, color: muted });
    drawText(mVal,          RV1, y + 18, { font: 'Helvetica-Bold', size: 15, color: sHex(mSc) });
    drawText('Computador',  RV2, y + 6,  { size: 7, color: muted });
    drawText(dVal,          RV2, y + 18, { font: 'Helvetica-Bold', size: 15, color: sHex(dSc) });

    y += MET_ROW;
  });

  // ─────────────────────────────────────────
  //  RECOMENDAÇÕES (nova página)
  // ─────────────────────────────────────────
  doc.addPage(); y = M;

  drawText('Recomendações de Melhoria', M, y, { font: 'Helvetica-Bold', size: 14 });
  y += 18;
  drawText('Ações práticas para melhorar o site. Organizadas por urgência.', M, y, { size: 8, color: muted, width: W });
  y += 22;

  const renderOpps = (opps, titulo) => {
    if (!opps || opps.length === 0) return;
    checkPage(44);

    // Section title
    doc.roundedRect(M, y, W, 22, 3).fill('#f1f5f9');
    drawText(titulo, M + 12, y + 5, { font: 'Helvetica-Bold', size: 10 });
    y += 30;

    opps.forEach((opp, idx) => {
      checkPage(52);

      const oppTitle = translateTitle(opp.title);
      const desc = translateDesc(opp.title, opp.description);
      const urg = opp.score < 30 ? 'Urgente' : opp.score < 60 ? 'Importante' : 'Recomendado';
      const urgColor = opp.score < 30 ? '#dc2626' : opp.score < 60 ? '#d97706' : '#059669';

      // Number + translated title
      drawText(`${idx + 1}.  ${oppTitle}`, M + 4, y, { font: 'Helvetica-Bold', size: 9, width: W - 90 });

      // Urgency badge
      doc.roundedRect(M + W - 82, y - 2, 76, 15, 3).fill(sAlt(opp.score));
      drawText(urg, M + W - 80, y + 1, { font: 'Helvetica-Bold', size: 7, color: urgColor, width: 72, align: 'center' });

      y += 16;

      // Description (always Portuguese)
      if (desc) {
        drawText(desc, M + 16, y, { size: 8, color: muted, width: W - 32 });
        y += 18;
      }

      // Economy
      if (opp.displayValue) {
        drawText('Economia estimada: ' + opp.displayValue, M + 16, y, { size: 7, color: blue });
        y += 14;
      }

      y += 6;
    });
    y += 8;
  };

  renderOpps(data.mobile.opportunities, 'Versão Celular');
  renderOpps(data.desktop.opportunities, 'Versão Computador');

  // ─────────────────────────────────────────
  //  DIAGNÓSTICOS
  // ─────────────────────────────────────────
  const allDiags = [
    ...(data.mobile.diagnostics || []).map(d => ({ ...d, from: 'Celular' })),
    ...(data.desktop.diagnostics || []).map(d => ({ ...d, from: 'Computador' })),
  ];
  const seen = new Set();
  const uniq = allDiags.filter(d => { if (seen.has(d.title)) return false; seen.add(d.title); return true; });

  if (uniq.length > 0) {
    checkPage(50);
    doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
    y += 12;
    drawText('Outros Pontos de Atenção', M, y, { font: 'Helvetica-Bold', size: 13 });
    y += 22;

    uniq.forEach((diag) => {
      checkPage(40);
      const titulo = translateTitle(diag.title);
      const desc = translateDesc(diag.title, diag.description);

      // Purple bar + title
      doc.rect(M, y, 3, 13).fill('#6366f1');
      drawText(titulo, M + 12, y + 1, { font: 'Helvetica-Bold', size: 8, width: W - 80 });
      drawText(diag.from, M + W - 60, y + 2, { size: 7, color: muted, width: 55, align: 'right' });
      y += 16;

      if (desc) {
        drawText(desc, M + 12, y, { size: 7, color: muted, width: W - 24 });
        y += 16;
      }
      y += 6;
    });
  }

  // ─────────────────────────────────────────
  //  BLOCO CTA
  // ─────────────────────────────────────────
  checkPage(100);
  y += 20;
  doc.roundedRect(M, y, W, 80, 6).fill('#0f172a');
  drawText('Quer melhorar essas notas?', M + 20, y + 16, { font: 'Helvetica-Bold', size: 14, color: '#ffffff' });
  drawText(
    'A Chevla pode implementar todas as otimizações deste relatório e elevar a performance do seu site.',
    M + 20, y + 38, { size: 9, color: '#94a3b8', width: W - 40 }
  );
  drawText('Fale conosco: chevla.com', M + 20, y + 58, { font: 'Helvetica-Bold', size: 10, color: blue });

  // ─────────────────────────────────────────
  //  RODAPÉ
  // ─────────────────────────────────────────
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.moveTo(M, 790).lineTo(M + W, 790).lineWidth(0.4).strokeColor('#e2e8f0').stroke();
    drawText(`Página ${i + 1} de ${pages.count}`, M, 795, { size: 7, color: '#94a3b8' });
    drawText('Chevla  ·  chevla.com  ·  Relatório Prospector', M + W / 2, 795, { size: 7, color: '#94a3b8', width: W / 2, align: 'right' });
  }

  doc.end();
}

export default router;
