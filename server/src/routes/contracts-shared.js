// ═══════════════════════════════════════
// Shared data & helpers for contracts
// ═══════════════════════════════════════
import PDFDocument from 'pdfkit';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===== DADOS DOS SERVIÇOS CHEVLA =====
export const CHEVLA_SERVICES = {
  institutional: {
    name: 'Site Institucional',
    value: 2500,
    features: [
      'Design exclusivo e responsivo',
      'Identidade visual aplicada',
      'Formulário de contato',
      'Integração com WhatsApp',
      'SEO (estrutura + indexação)',
      'Performance otimizada',
      'Configuração inicial na hospedagem do cliente',
      'Publicação do site',
      'Até 2 rodadas de revisão incluídas',
    ],
    type: 'site_creation',
  },
  institutional_blog: {
    name: 'Site Institucional + Blog',
    value: 3000,
    features: [
      'Tudo do Institucional +',
      'Área de blog',
      'Sistema de posts',
      'Categorias',
      'SEO para blog',
      'Painel de gerenciamento de conteúdo',
      'Até 2 rodadas de revisão incluídas',
    ],
    type: 'site_creation',
  },
  ecommerce: {
    name: 'E-commerce',
    value: 3000,
    features: [
      'Loja virtual completa',
      'Cadastro inicial de produtos (até 30)',
      'Carrinho de compras',
      'Integração com pagamento e frete',
      'Design responsivo',
      'SEO',
      'Configuração na hospedagem do cliente',
      'Publicação da loja',
      'Até 2 rodadas de revisão incluídas',
    ],
    type: 'site_creation',
  },
  essential_maintenance: {
    name: 'Plano Essencial - Manutenção',
    value: 250,
    features: [
      'Manutenção técnica',
      'Atualizações de sistema',
      'Correções de bugs',
      'Monitoramento do site',
      'Backup semanal',
      'Suporte técnico (resposta em até 48h, resolução em até 72h)',
      'Pequenas alterações de conteúdo (textos, imagens, banners simples)',
      'Atendimento seg-sex das 9h às 18h',
    ],
    excludes: [
      'Hospedagem',
      'Domínio',
      'Criação de novas páginas',
      'Novas funcionalidades',
      'SEO contínuo',
    ],
    type: 'maintenance',
  },
  pro_maintenance: {
    name: 'Plano Pro - Manutenção',
    value: 500,
    features: [
      'Tudo do Essencial +',
      'Backup diário',
      'Suporte prioritário (resposta em até 24h, resolução em até 48h)',
      'Criação de novas páginas',
      'Ajustes de layout e melhorias visuais',
      'Otimização de performance',
      'SEO on-page contínuo',
      'Atualização de conteúdos do blog',
      'Relatório mensal de desempenho',
      'Integração com ferramentas (Analytics, Pixel)',
      'Atendimento seg-sex das 9h às 18h',
    ],
    excludes: [
      'Hospedagem',
      'Domínio',
      'Tráfego pago (anúncios)',
    ],
    type: 'maintenance',
  },
};

// Cores Chevla
export const CHEVLA_BLUE = '#0077FF';
export const CHEVLA_VIOLET = '#7C5CE0';
export const CHEVLA_DARK = '#1A1A2E';
export const CHEVLA_GRAY = '#4A5568';
export const CHEVLA_LIGHT = '#F0F4FF';

// Company info — set via env or defaults
export const CHEVLA_CNPJ = process.env.CHEVLA_CNPJ || '';
export const CHEVLA_EMAIL = process.env.CHEVLA_EMAIL || 'contato@chevla.com';
export const CHEVLA_PHONE = process.env.CHEVLA_PHONE || '(11) 97886-1376';
export const CHEVLA_ADDRESS = process.env.CHEVLA_ADDRESS || 'Rua Ibitirama, 2060 - São Paulo/SP - CEP 03134-002';

// ===== PDF HELPER FUNCTIONS =====
export function createPdfHelpers(doc) {
  const logoPath = join(__dirname, '..', 'assets', 'chevla-logo.png');

  const drawHeader = () => {
    try { doc.image(logoPath, 55, 40, { width: 130 }); }
    catch { doc.fontSize(28).font('Helvetica-Bold').fillColor(CHEVLA_BLUE).text('CHEVLA', 55, 45); }
    doc.fontSize(9).font('Helvetica').fillColor(CHEVLA_GRAY);
    doc.text(CHEVLA_EMAIL, 350, 45, { width: 180, align: 'right' });
    doc.text(CHEVLA_PHONE, 350, 57, { width: 180, align: 'right' });
    doc.text(CHEVLA_ADDRESS.split(' - CEP')[0], 350, 69, { width: 180, align: 'right' });
    const cep = CHEVLA_ADDRESS.match(/CEP\s*[\d-]+/)?.[0];
    if (cep) doc.text(cep, 350, 81, { width: 180, align: 'right' });
  };

  const drawGradientBar = (y) => {
    const steps = 50, barWidth = 485;
    for (let i = 0; i < steps; i++) {
      const ratio = i / steps;
      const r = Math.round(ratio * 124);
      const g = Math.round(119 + ratio * (92 - 119));
      const b = Math.round(255 + ratio * (224 - 255));
      const color = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
      doc.rect(55 + (barWidth / steps) * i, y, barWidth / steps + 1, 4).fill(color);
    }
  };

  const drawFooter = () => {
    const pageBottom = doc.page.height - 35;
    drawGradientBar(pageBottom);
    doc.fontSize(7).font('Helvetica').fillColor(CHEVLA_GRAY)
      .text('Chevla — Sites modernos e manutenção por assinatura | chevla.com', 55, pageBottom + 6, { width: 485, align: 'center' });
  };

  const drawWatermark = (text) => {
    doc.save();
    doc.fontSize(60).font('Helvetica-Bold').fillColor('#E5E7EB').opacity(0.3);
    doc.translate(doc.page.width / 2, doc.page.height / 2);
    doc.rotate(-45, { origin: [0, 0] });
    doc.text(text, -200, -30, { width: 400, align: 'center' });
    doc.restore();
  };

  const formatCurrency = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const sectionTitle = (num, title) => {
    checkPageSpace(60);
    doc.rect(55, doc.y, 4, 18).fill(CHEVLA_BLUE);
    doc.fontSize(14).font('Helvetica-Bold').fillColor(CHEVLA_DARK)
      .text(`${num}. ${title}`, 65, doc.y + 1);
    doc.moveDown(0.7);
  };

  const bodyText = (text, opts = {}) => {
    doc.fontSize(11).font('Helvetica').fillColor(CHEVLA_DARK).text(text, { lineGap: 3, ...opts });
  };
  const boldText = (text, opts = {}) => {
    doc.fontSize(11).font('Helvetica-Bold').fillColor(CHEVLA_DARK).text(text, { lineGap: 3, ...opts });
  };
  const smallText = (text, opts = {}) => {
    doc.fontSize(10).font('Helvetica').fillColor(CHEVLA_GRAY).text(text, { lineGap: 2, ...opts });
  };

  const drawSignatures = (company, contactName) => {
    checkPageSpace(80);
    const sigY = doc.y;
    doc.strokeColor(CHEVLA_BLUE).lineWidth(1);
    doc.moveTo(70, sigY).lineTo(260, sigY).stroke();
    doc.fontSize(11).font('Helvetica-Bold').fillColor(CHEVLA_DARK)
      .text('CONTRATADA', 70, sigY + 6, { width: 190, align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor(CHEVLA_GRAY)
      .text('Chevla — Desenvolvimento Web', 70, sigY + 20, { width: 190, align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor(CHEVLA_GRAY)
      .text(CHEVLA_EMAIL, 70, sigY + 33, { width: 190, align: 'center' });

    doc.strokeColor(CHEVLA_GRAY).lineWidth(0.8);
    doc.moveTo(320, sigY).lineTo(510, sigY).stroke();
    doc.fontSize(11).font('Helvetica-Bold').fillColor(CHEVLA_DARK)
      .text('CONTRATANTE', 320, sigY + 6, { width: 190, align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor(CHEVLA_GRAY)
      .text(company, 320, sigY + 20, { width: 190, align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor(CHEVLA_GRAY)
      .text(contactName, 320, sigY + 33, { width: 190, align: 'center' });
  };

  const checkPageSpace = (needed = 120) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - needed) { doc.addPage(); }
  };

  return { drawHeader, drawGradientBar, drawFooter, drawWatermark, formatCurrency, sectionTitle, bodyText, boldText, smallText, drawSignatures, checkPageSpace };
}

export function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).font('Helvetica').fillColor(CHEVLA_GRAY);
    doc.text(`Página ${i + 1} de ${range.count}`, 55, doc.page.height - 20, { width: 485, align: 'right' });
  }
}
