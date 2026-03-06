// ═══════════════════════════════════════
// Contract PDF Generation Routes
// ═══════════════════════════════════════
import { Router } from 'express';
import PDFDocument from 'pdfkit';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  CHEVLA_SERVICES, CHEVLA_BLUE, CHEVLA_DARK, CHEVLA_GRAY, CHEVLA_LIGHT,
  CHEVLA_CNPJ, CHEVLA_EMAIL, CHEVLA_PHONE,
  createPdfHelpers, addPageNumbers,
} from './contracts-shared.js';

const router = Router();
router.use(authMiddleware);

async function getContract(id, extraFields = '') {
  const fields = extraFields ? `, ${extraFields}` : '';
  return await db.get(`SELECT ct.*, c.company_name, c.contact_name, c.email, c.phone, c.cnpj, c.address, c.city, c.state${fields} FROM contracts ct JOIN clients c ON ct.client_id = c.id WHERE ct.id = ?`, [Number(id)]);
}

function createDoc(res, filename) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 60, left: 55, right: 55 }, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  doc.pipe(res);
  return doc;
}

function finalizePdf(doc, h, opts = {}) {
  addPageNumbers(doc);
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    h.drawFooter();
    if (opts.watermark) h.drawWatermark(opts.watermark);
  }
  doc.end();
}

// PDF: CONTRATO COMPLETO
router.get('/:id/pdf', async (req, res) => {
  try {
    const contract = await getContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contrato não encontrado' });
    const service = CHEVLA_SERVICES[contract.plan_type];
    const doc = createDoc(res, `contrato-${contract.contract_number}.pdf`);
    const h = createPdfHelpers(doc);

    h.drawHeader();
    h.drawGradientBar(100);
    doc.y = 124;

    doc.fontSize(20).font('Helvetica-Bold').fillColor(CHEVLA_DARK)
      .text(`CONTRATO DE ${service.type === 'maintenance' ? 'MANUTENÇÃO' : 'PRESTAÇÃO DE SERVIÇOS'}`, 55, doc.y, { align: 'center', width: 485 });
    doc.moveDown(0.4);
    doc.fontSize(13).font('Helvetica').fillColor(CHEVLA_BLUE)
      .text(`Nº ${contract.contract_number}`, { align: 'center', width: 485 });
    doc.moveDown(1.2);

    // 1. DAS PARTES
    h.sectionTitle('1', 'DAS PARTES');
    h.boldText('CONTRATADA:');
    h.bodyText('Chevla — Desenvolvimento Web e Consultoria Digital');
    h.smallText(CHEVLA_CNPJ ? `CNPJ: ${CHEVLA_CNPJ}` : 'MEI — Chevla Desenvolvimento Web');
    h.smallText(`E-mail: ${CHEVLA_EMAIL} | Telefone: ${CHEVLA_PHONE}`);
    h.smallText(`Endereço: Rua Ibitirama, 2060 - São Paulo/SP - CEP 03134-002`);
    doc.moveDown(0.6);
    h.boldText('CONTRATANTE:');
    h.bodyText(`Empresa: ${contract.company_name}`);
    h.bodyText(`Responsável: ${contract.contact_name}`);
    if (contract.cnpj) h.smallText(`CNPJ: ${contract.cnpj}`);
    if (contract.email) h.smallText(`E-mail: ${contract.email}`);
    if (contract.phone) h.smallText(`Telefone: ${contract.phone}`);
    if (contract.address) {
      let addr = contract.address;
      if (contract.city) addr += ` - ${contract.city}`;
      if (contract.state) addr += `/${contract.state}`;
      h.smallText(`Endereço: ${addr}`);
    }
    doc.moveDown(1);

    // 2. DO OBJETO
    h.sectionTitle('2', 'DO OBJETO');
    if (service.type === 'site_creation') {
      h.bodyText(`O presente contrato tem por objeto a prestação de serviços de desenvolvimento e criação de ${service.name} pela CONTRATADA à CONTRATANTE, conforme especificações abaixo:`);
    } else {
      h.bodyText(`O presente contrato tem por objeto a prestação de serviços de manutenção mensal (${service.name}) do site/aplicação web da CONTRATANTE, conforme especificações abaixo:`);
    }
    doc.moveDown(0.5);
    h.boldText('Serviços inclusos:');
    service.features.forEach(f => { doc.fontSize(11).font('Helvetica').fillColor(CHEVLA_DARK).text(`  [+]  ${f}`, { lineGap: 2 }); });
    doc.moveDown(0.4);
    if (service.excludes) {
      h.boldText('Serviços NÃO inclusos:');
      service.excludes.forEach(f => { doc.fontSize(11).font('Helvetica').fillColor('#DC2626').text(`  [-]  ${f}`, { lineGap: 2 }); });
      doc.moveDown(0.4);
    }
    if (service.type === 'site_creation') {
      doc.moveDown(0.2);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(CHEVLA_BLUE)
        .text('Nota: Hospedagem e domínio não estão inclusos. Esses serviços são contratados e pagos diretamente pelo CONTRATANTE.');
    }
    doc.moveDown(1);

    // 3. DOS VALORES E PAGAMENTO
    h.checkPageSpace(200);
    h.sectionTitle('3', 'DOS VALORES E PAGAMENTO');
    const boxY = doc.y;
    doc.rect(55, boxY, 485, service.type === 'site_creation' ? 70 : 55).fill(CHEVLA_LIGHT);
    doc.y = boxY + 10;
    if (service.type === 'site_creation') {
      doc.fontSize(11).font('Helvetica').fillColor(CHEVLA_DARK).text(`Valor do serviço:  ${h.formatCurrency(contract.value)}`, 70);
      if (contract.discount_percent > 0) doc.fontSize(11).font('Helvetica').fillColor('#16A34A').text(`Desconto:  ${contract.discount_percent}%`, 70);
      doc.fontSize(14).font('Helvetica-Bold').fillColor(CHEVLA_BLUE).text(`Valor Final:  ${h.formatCurrency(contract.final_value)}`, 70);
    } else {
      doc.fontSize(11).font('Helvetica').fillColor(CHEVLA_DARK).text(`Valor mensal:  ${h.formatCurrency(contract.value)}`, 70);
      if (contract.discount_percent > 0) {
        doc.fontSize(11).font('Helvetica').fillColor('#16A34A').text(`Desconto: ${contract.discount_percent}%  →  `, 70, doc.y, { continued: true });
        doc.font('Helvetica-Bold').fillColor(CHEVLA_BLUE).text(`${h.formatCurrency(contract.final_value)}/mês`);
      }
    }
    doc.y = boxY + (service.type === 'site_creation' ? 80 : 65);
    doc.moveDown(0.3);
    const payNames = { pix: 'PIX', credit_card: 'Cartão de Crédito', bank_transfer: 'Transferência Bancária' };
    if (contract.payment_method) h.bodyText(`Forma de pagamento: ${payNames[contract.payment_method] || contract.payment_method}`);
    if (contract.installments > 1) h.bodyText(`Parcelamento: ${contract.installments}x de ${h.formatCurrency(contract.final_value / contract.installments)} sem juros`);
    doc.moveDown(0.3);
    if (service.type === 'site_creation') {
      h.smallText('Condições de pagamento:');
      h.smallText('  • 50% na aprovação do projeto');
      h.smallText('  • 50% na entrega final');
      h.smallText('  • Pagamento via PIX: 5% de desconto sobre o valor total');
      h.smallText('  • Parcelamento em até 3x sem juros no cartão de crédito');
    } else {
      h.smallText('A cobrança será realizada mensalmente, com vencimento no mesmo dia da contratação.');
      h.smallText('O CONTRATANTE pode cancelar o plano a qualquer momento, sem multa.');
    }
    doc.moveDown(0.3);
    h.smallText('Nota fiscal será emitida a cada pagamento realizado.');
    doc.moveDown(1);

    // 4. DOS PRAZOS
    h.checkPageSpace(150);
    h.sectionTitle('4', 'DOS PRAZOS');
    if (service.type === 'site_creation') {
      h.bodyText('Prazo de entrega estimado: 30 (trinta) dias corridos, contados a partir da aprovação do briefing e recebimento do sinal.');
      if (contract.start_date) h.bodyText(`Data de início: ${new Date(contract.start_date).toLocaleDateString('pt-BR')}`);
      if (contract.delivery_date) h.bodyText(`Previsão de entrega: ${new Date(contract.delivery_date).toLocaleDateString('pt-BR')}`);
      doc.moveDown(0.3);
      h.smallText('O projeto inclui até 2 (duas) rodadas de revisão. Revisões adicionais serão cobradas à parte, no valor de R$ 200,00 por rodada.');
      h.smallText('Atrasos no envio de materiais pelo CONTRATANTE (textos, imagens, logos) poderão impactar o prazo de entrega.');
    } else {
      h.bodyText('O plano de manutenção tem vigência mensal, renovado automaticamente a cada mês.');
      h.bodyText('O cancelamento pode ser solicitado a qualquer momento, sem multas ou contratos engessados.');
      if (contract.start_date) h.bodyText(`Data de início: ${new Date(contract.start_date).toLocaleDateString('pt-BR')}`);
    }
    doc.moveDown(1);

    // 5. DA GARANTIA
    h.checkPageSpace(150);
    h.sectionTitle('5', 'DA GARANTIA');
    if (service.type === 'site_creation') {
      h.bodyText('A CONTRATADA oferece garantia de 30 (trinta) dias após a entrega do projeto, cobrindo:');
      h.bodyText('  [+]  Correção de bugs e erros no código entregue');
      h.bodyText('  [+]  Ajustes técnicos relacionados ao escopo contratado');
      h.bodyText('  [+]  Suporte para dúvidas sobre o funcionamento do site');
      doc.moveDown(0.3);
      h.smallText('Não estão cobertos pela garantia: alterações de escopo, conteúdos novos, funcionalidades adicionais ou problemas causados por intervenções de terceiros.');
    } else {
      h.bodyText('O plano de manutenção garante suporte técnico contínuo conforme os serviços inclusos.');
      const rt = contract.plan_type === 'pro_maintenance' ? '24h' : '48h';
      const rv = contract.plan_type === 'pro_maintenance' ? '48h' : '72h';
      h.boldText(`Tempo de resposta: até ${rt} | Resolução: até ${rv}`);
    }
    doc.moveDown(1);

    // 6-12: Standard clauses
    h.checkPageSpace(130);
    h.sectionTitle('6', 'DA PROPRIEDADE INTELECTUAL');
    h.bodyText('Após o pagamento integral:');
    h.bodyText('  •  O CONTRATANTE detém os direitos sobre o produto final entregue');
    h.bodyText('  •  A CONTRATADA mantém direitos sobre códigos proprietários e bibliotecas reutilizáveis');
    h.bodyText('  •  A CONTRATADA pode exibir o projeto em seu portfólio, salvo acordo em contrário');
    doc.moveDown(1);

    h.checkPageSpace(130);
    h.sectionTitle('7', 'DA INADIMPLÊNCIA');
    h.bodyText('Em caso de atraso no pagamento:');
    h.bodyText('  •  Multa de 2% (dois por cento) sobre o valor devido');
    h.bodyText('  •  Juros de mora de 1% (um por cento) ao mês');
    h.bodyText('  •  Após 30 dias de inadimplência, a CONTRATADA reserva-se o direito de suspender os serviços');
    if (service.type === 'maintenance') h.bodyText('  •  Após 60 dias de inadimplência, o plano será automaticamente cancelado');
    doc.moveDown(1);

    h.checkPageSpace(130);
    h.sectionTitle('8', 'DA CONFIDENCIALIDADE');
    h.bodyText('Ambas as partes comprometem-se a:');
    h.bodyText('  •  Manter sigilo sobre informações técnicas, comerciais e estratégicas compartilhadas');
    h.bodyText('  •  Não divulgar dados confidenciais a terceiros sem autorização prévia por escrito');
    h.bodyText('  •  Utilizar as informações exclusivamente para os fins deste contrato');
    h.smallText('Esta obrigação de confidencialidade permanece vigente mesmo após o término do contrato.');
    doc.moveDown(1);

    h.checkPageSpace(170);
    h.sectionTitle('9', 'PROTEÇÃO DE DADOS (LGPD)');
    h.bodyText('Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018):');
    h.bodyText('  •  A CONTRATADA se compromete a tratar os dados pessoais do CONTRATANTE apenas para os fins necessários à execução deste contrato');
    h.bodyText('  •  Os dados serão armazenados com medidas técnicas de segurança adequadas');
    h.bodyText('  •  O CONTRATANTE pode solicitar a exclusão de seus dados a qualquer momento após o término do contrato');
    h.bodyText('  •  Não haverá compartilhamento de dados com terceiros sem consentimento prévio');
    h.smallText(`Para questões de privacidade: ${CHEVLA_EMAIL}`);
    doc.moveDown(1);

    h.checkPageSpace(130);
    h.sectionTitle('10', 'DO CANCELAMENTO');
    if (service.type === 'site_creation') {
      h.bodyText('  •  Cancelamento antes do início: reembolso integral do sinal');
      h.bodyText('  •  Cancelamento durante o projeto: cobrança proporcional ao trabalho realizado');
      h.bodyText('  •  Após aprovação de etapa: trabalho aprovado não é reembolsável');
    } else {
      h.bodyText('  •  Sem contratos engessados — cancele quando quiser');
      h.bodyText('  •  Todo o site e conteúdo criado permanece com o CONTRATANTE');
      h.bodyText(`  •  A solicitação deve ser feita por e-mail para ${CHEVLA_EMAIL}`);
    }
    doc.moveDown(1);

    h.checkPageSpace(130);
    h.sectionTitle('11', 'DA FORÇA MAIOR');
    h.bodyText('Nenhuma das partes será responsabilizada por atrasos ou falhas causados por eventos de força maior, incluindo, mas não se limitando a: desastres naturais, pandemias, falhas de infraestrutura de internet, ataques cibernéticos ou determinações governamentais.');
    doc.moveDown(1);

    let next = 12;
    if (contract.custom_clauses) {
      h.checkPageSpace(130);
      h.sectionTitle('12', 'CLÁUSULAS ADICIONAIS');
      h.bodyText(contract.custom_clauses);
      doc.moveDown(1);
      next = 13;
    }

    h.checkPageSpace(130);
    h.sectionTitle(`${next}`, 'DO FORO');
    h.bodyText('Fica eleito o Foro da Comarca de São Paulo/SP para dirimir quaisquer dúvidas ou litígios oriundos deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.');
    doc.moveDown(1.5);

    doc.fontSize(12).font('Helvetica').fillColor(CHEVLA_DARK)
      .text(`São Paulo, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'center' });
    doc.moveDown(2.5);

    h.drawSignatures(contract.company_name, contract.contact_name);

    doc.moveDown(3);
    h.checkPageSpace(60);
    const wY2 = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(CHEVLA_DARK).text('TESTEMUNHAS:', 55, wY2);
    doc.moveDown(1.5);
    const wY = doc.y;
    doc.strokeColor(CHEVLA_GRAY).lineWidth(0.5);
    doc.moveTo(70, wY).lineTo(250, wY).stroke();
    doc.fontSize(9).font('Helvetica').fillColor(CHEVLA_GRAY).text('Testemunha 1 — Nome / CPF', 70, wY + 4, { width: 180, align: 'center' });
    doc.moveTo(320, wY).lineTo(500, wY).stroke();
    doc.fontSize(9).font('Helvetica').fillColor(CHEVLA_GRAY).text('Testemunha 2 — Nome / CPF', 320, wY + 4, { width: 180, align: 'center' });

    finalizePdf(doc, h, { watermark: contract.status === 'draft' ? 'RASCUNHO' : null });
  } catch (error) { console.error('Erro ao gerar PDF:', error); res.status(500).json({ error: 'Erro ao gerar contrato PDF' }); }
});

// PDF: PROPOSTA COMERCIAL
router.get('/:id/proposal', async (req, res) => {
  try {
    const contract = await getContract(req.params.id, 'c.website');
    if (!contract) return res.status(404).json({ error: 'Contrato não encontrado' });
    const service = CHEVLA_SERVICES[contract.plan_type];
    const doc = createDoc(res, `proposta-${contract.contract_number}.pdf`);
    const h = createPdfHelpers(doc);
    h.drawHeader();
    h.drawGradientBar(100);
    doc.y = 124;

    doc.fontSize(24).font('Helvetica-Bold').fillColor(CHEVLA_DARK).text('PROPOSTA COMERCIAL', 55, doc.y, { align: 'center', width: 485 });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').fillColor(CHEVLA_BLUE).text(service.name, { align: 'center', width: 485 });
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica').fillColor(CHEVLA_GRAY).text(`Preparada para: ${contract.company_name}`, { align: 'center', width: 485 });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor(CHEVLA_GRAY).text(`Ref: ${contract.contract_number} | ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center', width: 485 });
    doc.moveDown(2);

    h.sectionTitle('1', 'SOBRE A CHEVLA');
    h.bodyText('A Chevla é uma empresa de desenvolvimento web e consultoria digital focada em entregar soluções modernas, performáticas e com design profissional.');
    doc.moveDown(0.3);
    h.bodyText('Trabalhamos com tecnologias de ponta para criar sites e aplicações que geram resultados reais para nossos clientes.');
    doc.moveDown(0.5);
    h.boldText('Nossos diferenciais:');
    ['Design exclusivo — nada de templates prontos', 'Performance otimizada (nota 90+ no Google PageSpeed)', 'SEO técnico incluído em todos os projetos', 'Suporte humanizado e comunicação transparente', 'Código limpo e moderno (React, Next.js, Tailwind)', 'Manutenção mensal por assinatura sem fidelidade'].forEach(d => {
      doc.fontSize(11).font('Helvetica').fillColor(CHEVLA_DARK).text(`  -  ${d}`, { lineGap: 2 });
    });
    doc.moveDown(1);

    h.checkPageSpace(200);
    h.sectionTitle('2', 'ESCOPO DA PROPOSTA');
    h.boldText(`Serviço: ${service.name}`);
    doc.moveDown(0.5);
    h.boldText('O que está incluso:');
    service.features.forEach(f => { doc.fontSize(11).font('Helvetica').fillColor(CHEVLA_DARK).text(`  [+]  ${f}`, { lineGap: 2 }); });
    doc.moveDown(0.5);
    if (service.excludes) {
      h.boldText('O que NÃO está incluso:');
      service.excludes.forEach(f => { doc.fontSize(11).font('Helvetica').fillColor('#DC2626').text(`  [-]  ${f}`, { lineGap: 2 }); });
      doc.moveDown(0.5);
    }
    if (service.type === 'site_creation') {
      doc.fontSize(10).font('Helvetica-Bold').fillColor(CHEVLA_BLUE).text('Nota: Hospedagem e domínio são contratados e pagos diretamente pelo cliente.');
    }
    doc.moveDown(1);

    h.checkPageSpace(200);
    h.sectionTitle('3', 'INVESTIMENTO');
    const pY = doc.y;
    doc.rect(55, pY, 485, 90).fill(CHEVLA_LIGHT);
    doc.roundedRect(55, pY, 485, 90, 6).lineWidth(1).strokeColor(CHEVLA_BLUE).stroke();
    doc.fontSize(12).font('Helvetica').fillColor(CHEVLA_GRAY)
      .text(service.type === 'maintenance' ? 'Investimento mensal:' : 'Investimento total:', 70, pY + 15);
    doc.fontSize(28).font('Helvetica-Bold').fillColor(CHEVLA_BLUE).text(h.formatCurrency(contract.final_value), 70, pY + 35);
    if (contract.discount_percent > 0) {
      doc.fontSize(11).font('Helvetica').fillColor('#16A34A').text(`${contract.discount_percent}% de desconto já aplicado (de ${h.formatCurrency(contract.value)})`, 70, pY + 68);
    }
    doc.y = pY + 100;
    doc.moveDown(0.5);
    if (service.type === 'site_creation') {
      h.boldText('Formas de pagamento:');
      h.bodyText('  •  PIX: 5% de desconto');
      h.bodyText('  •  Cartão de crédito: até 3x sem juros');
      h.bodyText('  •  50% na aprovação + 50% na entrega');
    } else {
      h.boldText('Pagamento mensal recorrente');
      h.bodyText('Sem fidelidade. Cancele quando quiser.');
    }
    doc.moveDown(1);

    h.checkPageSpace(130);
    h.sectionTitle('4', 'PRAZOS');
    if (service.type === 'site_creation') {
      h.bodyText('Prazo estimado: 30 dias corridos após aprovação do briefing.');
      h.bodyText('Inclui 2 rodadas de revisão.');
    } else {
      h.bodyText('Início imediato após a confirmação do pagamento.');
      h.bodyText('Vigência mensal com renovação automática.');
    }
    doc.moveDown(1);

    h.checkPageSpace(150);
    h.sectionTitle('5', 'PRÓXIMOS PASSOS');
    const passos = service.type === 'site_creation' ? ['Aprovação desta proposta', 'Envio do briefing (formulário que enviaremos)', 'Pagamento do sinal (50%)', 'Início do desenvolvimento', 'Apresentação para revisão', 'Ajustes finais e publicação', 'Pagamento final (50%)'] : ['Aprovação desta proposta', 'Assinatura do contrato de manutenção', 'Configuração dos acessos', 'Início dos serviços de manutenção'];
    passos.forEach((p, i) => { doc.fontSize(11).font('Helvetica').fillColor(CHEVLA_DARK).text(`  ${i + 1}.  ${p}`, { lineGap: 3 }); });
    doc.moveDown(1);

    h.checkPageSpace(100);
    h.sectionTitle('6', 'VALIDADE DA PROPOSTA');
    h.bodyText('Esta proposta é válida por 15 (quinze) dias a partir da data de emissão.');
    doc.moveDown(1.5);

    doc.fontSize(14).font('Helvetica-Bold').fillColor(CHEVLA_BLUE).text('Vamos começar?', { align: 'center', width: 485 });
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica').fillColor(CHEVLA_DARK).text('Entre em contato:', { align: 'center', width: 485 });
    doc.fontSize(12).font('Helvetica-Bold').fillColor(CHEVLA_BLUE).text(`${CHEVLA_EMAIL} | ${CHEVLA_PHONE}`, { align: 'center', width: 485 });

    finalizePdf(doc, h);
  } catch (error) { console.error('Erro ao gerar proposta:', error); res.status(500).json({ error: 'Erro ao gerar proposta comercial' }); }
});

// PDF: TERMO DE ACEITE E RECEBIMENTO
router.get('/:id/acceptance', async (req, res) => {
  try {
    const contract = await getContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contrato não encontrado' });
    const service = CHEVLA_SERVICES[contract.plan_type];
    const doc = createDoc(res, `termo-aceite-${contract.contract_number}.pdf`);
    const h = createPdfHelpers(doc);
    h.drawHeader();
    h.drawGradientBar(100);
    doc.y = 124;

    doc.fontSize(20).font('Helvetica-Bold').fillColor(CHEVLA_DARK).text('TERMO DE ACEITE E RECEBIMENTO', 55, doc.y, { align: 'center', width: 485 });
    doc.moveDown(0.4);
    doc.fontSize(13).font('Helvetica').fillColor(CHEVLA_BLUE).text(`Ref. Contrato ${contract.contract_number}`, { align: 'center', width: 485 });
    doc.moveDown(1.5);

    h.bodyText(`Pelo presente instrumento, a empresa ${contract.company_name}, neste ato representada por ${contract.contact_name}${contract.cnpj ? ` (CNPJ: ${contract.cnpj})` : ''}, doravante denominada CONTRATANTE, declara que:`);
    doc.moveDown(1);

    [
      `Recebeu o projeto de ${service.name} desenvolvido pela Chevla — Desenvolvimento Web e Consultoria Digital, conforme contrato nº ${contract.contract_number}.`,
      'Verificou e testou todas as funcionalidades entregues conforme o escopo contratado.',
      'Confirma que o projeto atende às especificações acordadas e está de acordo com o briefing aprovado.',
      'Está ciente de que a garantia de 30 (trinta) dias cobre apenas correções de bugs e ajustes técnicos do escopo original.',
      'Alterações de escopo, funcionalidades adicionais ou modificações solicitadas após esta data são consideradas serviços novos e serão orçadas separadamente.',
      'Reconhece que o site foi publicado e está funcionando corretamente na data de entrega.',
    ].forEach((item, i) => { h.bodyText(`${i + 1}. ${item}`); doc.moveDown(0.5); });

    doc.moveDown(1);
    h.boldText('Serviços entregues:');
    service.features.forEach(f => { doc.fontSize(11).font('Helvetica').fillColor(CHEVLA_DARK).text(`  [+]  ${f}`, { lineGap: 2 }); });
    doc.moveDown(1.5);

    doc.fontSize(12).font('Helvetica').fillColor(CHEVLA_DARK).text(`São Paulo, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'center' });
    doc.moveDown(2.5);
    h.drawSignatures(contract.company_name, contract.contact_name);

    finalizePdf(doc, h);
  } catch (error) { console.error('Erro ao gerar termo:', error); res.status(500).json({ error: 'Erro ao gerar termo de aceite' }); }
});

// PDF: ADITIVO CONTRATUAL
router.get('/:id/addendum', async (req, res) => {
  try {
    const contract = await getContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contrato não encontrado' });
    const doc = createDoc(res, `aditivo-${contract.contract_number}.pdf`);
    const h = createPdfHelpers(doc);
    h.drawHeader(); h.drawGradientBar(100); doc.y = 124;

    doc.fontSize(20).font('Helvetica-Bold').fillColor(CHEVLA_DARK).text('ADITIVO CONTRATUAL', 55, doc.y, { align: 'center', width: 485 });
    doc.moveDown(0.4);
    doc.fontSize(13).font('Helvetica').fillColor(CHEVLA_BLUE).text(`Ref. Contrato ${contract.contract_number}`, { align: 'center', width: 485 });
    doc.moveDown(1.5);

    h.bodyText(`Pelo presente instrumento, as partes abaixo identificadas resolvem, de comum acordo, aditar o contrato nº ${contract.contract_number}, nos seguintes termos:`);
    doc.moveDown(1);
    h.sectionTitle('1', 'DAS PARTES');
    h.boldText('CONTRATADA: Chevla — Desenvolvimento Web e Consultoria Digital');
    h.boldText(`CONTRATANTE: ${contract.company_name} — ${contract.contact_name}`);
    doc.moveDown(1);
    h.sectionTitle('2', 'DAS ALTERAÇÕES');
    h.bodyText('[Descrever aqui as alterações ao contrato original]');
    doc.moveDown(1); h.bodyText('_____________________________________________________________'); doc.moveDown(0.3);
    h.bodyText('_____________________________________________________________'); doc.moveDown(0.3);
    h.bodyText('_____________________________________________________________'); doc.moveDown(1.5);
    h.sectionTitle('3', 'DO VALOR ADICIONAL');
    h.bodyText('Valor adicional do aditivo: R$ __________');
    h.bodyText('Forma de pagamento: __________');
    doc.moveDown(1);
    h.sectionTitle('4', 'DA VIGÊNCIA');
    h.bodyText('As demais cláusulas do contrato original permanecem inalteradas.');
    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica').fillColor(CHEVLA_DARK).text(`São Paulo, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'center' });
    doc.moveDown(2.5);
    h.drawSignatures(contract.company_name, contract.contact_name);
    finalizePdf(doc, h);
  } catch (error) { console.error('Erro ao gerar aditivo:', error); res.status(500).json({ error: 'Erro ao gerar aditivo' }); }
});

// PDF: DISTRATO / CANCELAMENTO
router.get('/:id/termination', async (req, res) => {
  try {
    const contract = await getContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contrato não encontrado' });
    const service = CHEVLA_SERVICES[contract.plan_type];
    const doc = createDoc(res, `distrato-${contract.contract_number}.pdf`);
    const h = createPdfHelpers(doc);
    h.drawHeader(); h.drawGradientBar(100); doc.y = 124;

    doc.fontSize(20).font('Helvetica-Bold').fillColor(CHEVLA_DARK).text('TERMO DE DISTRATO', 55, doc.y, { align: 'center', width: 485 });
    doc.moveDown(0.4);
    doc.fontSize(13).font('Helvetica').fillColor(CHEVLA_BLUE).text(`Ref. Contrato ${contract.contract_number}`, { align: 'center', width: 485 });
    doc.moveDown(1.5);

    h.bodyText(`Pelo presente instrumento, as partes abaixo identificadas resolvem, de comum acordo, encerrar o contrato nº ${contract.contract_number}, firmado em ${new Date(contract.created_at).toLocaleDateString('pt-BR')}, nos seguintes termos:`);
    doc.moveDown(1);
    h.sectionTitle('1', 'DAS PARTES');
    h.boldText('CONTRATADA: Chevla — Desenvolvimento Web e Consultoria Digital');
    h.boldText(`CONTRATANTE: ${contract.company_name} — ${contract.contact_name}`);
    doc.moveDown(1);
    h.sectionTitle('2', 'DO ENCERRAMENTO');
    h.bodyText(`Fica rescindido, por mútuo acordo, o contrato de ${service.type === 'maintenance' ? 'manutenção mensal' : 'prestação de serviços'} (${service.name}) a partir desta data.`);
    doc.moveDown(1);
    h.sectionTitle('3', 'DAS OBRIGAÇÕES REMANESCENTES');
    h.bodyText('  •  Eventuais valores devidos devem ser quitados em até 15 (quinze) dias');
    h.bodyText('  •  Todo conteúdo e material produzido permanece com o CONTRATANTE');
    h.bodyText('  •  Acessos e credenciais serão transferidos ao CONTRATANTE');
    h.bodyText('  •  A obrigação de confidencialidade permanece vigente');
    doc.moveDown(1);
    h.sectionTitle('4', 'DA QUITAÇÃO');
    h.bodyText('As partes dão mútua e irrevogável quitação de todas as obrigações contratuais, nada mais tendo a reclamar uma da outra, ressalvadas as obrigações previstas neste instrumento.');
    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica').fillColor(CHEVLA_DARK).text(`São Paulo, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'center' });
    doc.moveDown(2.5);
    h.drawSignatures(contract.company_name, contract.contact_name);
    finalizePdf(doc, h);
  } catch (error) { console.error('Erro ao gerar distrato:', error); res.status(500).json({ error: 'Erro ao gerar distrato' }); }
});

// PDF: RECIBO DE PAGAMENTO
router.get('/:id/receipt', async (req, res) => {
  try {
    const contract = await getContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contrato não encontrado' });
    const service = CHEVLA_SERVICES[contract.plan_type];
    const doc = createDoc(res, `recibo-${contract.contract_number}.pdf`);
    const h = createPdfHelpers(doc);
    h.drawHeader(); h.drawGradientBar(100); doc.y = 124;

    doc.fontSize(20).font('Helvetica-Bold').fillColor(CHEVLA_DARK).text('RECIBO DE PAGAMENTO', 55, doc.y, { align: 'center', width: 485 });
    doc.moveDown(0.4);
    doc.fontSize(13).font('Helvetica').fillColor(CHEVLA_BLUE).text(`Ref. Contrato ${contract.contract_number}`, { align: 'center', width: 485 });
    doc.moveDown(1.5);

    h.bodyText('Recebi(emos) da empresa:');
    doc.moveDown(0.3);
    h.boldText(contract.company_name);
    if (contract.cnpj) h.smallText(`CNPJ: ${contract.cnpj}`);
    h.smallText(`Responsável: ${contract.contact_name}`);
    doc.moveDown(1);
    h.bodyText('A importância de:');
    doc.moveDown(0.3);
    const vY = doc.y;
    doc.rect(55, vY, 485, 50).fill(CHEVLA_LIGHT);
    doc.roundedRect(55, vY, 485, 50, 6).lineWidth(1).strokeColor(CHEVLA_BLUE).stroke();
    doc.fontSize(24).font('Helvetica-Bold').fillColor(CHEVLA_BLUE).text(h.formatCurrency(contract.final_value), 70, vY + 12, { width: 455, align: 'center' });
    doc.y = vY + 60;
    doc.moveDown(0.5);
    h.bodyText(`Referente a: ${service.name} — Contrato ${contract.contract_number}`);
    doc.moveDown(0.3);
    const payNames = { pix: 'PIX', credit_card: 'Cartão de Crédito', bank_transfer: 'Transferência Bancária' };
    h.bodyText(`Forma de pagamento: ${payNames[contract.payment_method] || contract.payment_method || 'Não especificada'}`);
    doc.moveDown(0.3);
    h.bodyText(`Data: ${new Date().toLocaleDateString('pt-BR')}`);
    doc.moveDown(2);
    h.bodyText('Para maior clareza, firmamos o presente recibo.');
    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica').fillColor(CHEVLA_DARK).text(`São Paulo, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'center' });
    doc.moveDown(3);
    const sY = doc.y;
    doc.strokeColor(CHEVLA_BLUE).lineWidth(1);
    doc.moveTo(160, sY).lineTo(380, sY).stroke();
    doc.fontSize(11).font('Helvetica-Bold').fillColor(CHEVLA_DARK).text('Chevla — Desenvolvimento Web', 160, sY + 6, { width: 220, align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor(CHEVLA_GRAY).text(`${CHEVLA_EMAIL} | ${CHEVLA_PHONE}`, 160, sY + 20, { width: 220, align: 'center' });

    finalizePdf(doc, h);
  } catch (error) { console.error('Erro ao gerar recibo:', error); res.status(500).json({ error: 'Erro ao gerar recibo' }); }
});

// PDF: BRIEFING DO CLIENTE
router.get('/:id/briefing', async (req, res) => {
  try {
    const contract = await getContract(req.params.id, 'c.website');
    if (!contract) return res.status(404).json({ error: 'Contrato não encontrado' });
    const service = CHEVLA_SERVICES[contract.plan_type];
    const doc = createDoc(res, `briefing-${contract.contract_number}.pdf`);
    const h = createPdfHelpers(doc);

    h.drawHeader();
    h.drawGradientBar(100);
    doc.y = 140;

    doc.fontSize(28).font('Helvetica-Bold').fillColor(CHEVLA_DARK).text('BRIEFING', 55, doc.y, { align: 'center', width: 485 });
    doc.moveDown(0.15);
    doc.fontSize(16).font('Helvetica').fillColor(CHEVLA_BLUE).text('Formulário de Levantamento de Requisitos', { align: 'center', width: 485 });
    doc.moveDown(2);

    const boxY2 = doc.y;
    doc.roundedRect(55, boxY2, 485, 100, 6).fillAndStroke(CHEVLA_LIGHT, '#D1D5DB');
    doc.fontSize(11).font('Helvetica-Bold').fillColor(CHEVLA_DARK);
    doc.text('DADOS DO PROJETO', 75, boxY2 + 14);
    doc.fontSize(10).font('Helvetica').fillColor(CHEVLA_GRAY);
    doc.text(`Cliente: ${contract.company_name}`, 75, boxY2 + 32);
    doc.text(`Contato: ${contract.contact_name || '-'}`, 75, boxY2 + 47);
    doc.text(`E-mail: ${contract.email || '-'}`, 75, boxY2 + 62);
    doc.text(`Telefone: ${contract.phone || '-'}`, 75, boxY2 + 77);
    doc.text(`Plano: ${service.name}`, 320, boxY2 + 32);
    doc.text(`Contrato: ${contract.contract_number}`, 320, boxY2 + 47);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 320, boxY2 + 62);
    doc.text(`CNPJ: ${contract.cnpj || '-'}`, 320, boxY2 + 77);
    doc.y = boxY2 + 115;

    doc.roundedRect(55, doc.y, 485, 50, 6).fillAndStroke('#EFF6FF', '#93C5FD');
    doc.fontSize(10).font('Helvetica-Bold').fillColor(CHEVLA_BLUE).text('INSTRUCOES DE PREENCHIMENTO', 75, doc.y + 10);
    doc.fontSize(9).font('Helvetica').fillColor(CHEVLA_DARK)
      .text('Preencha com o maximo de detalhes possivel. Quanto mais informacoes, melhor sera o resultado final.', 75, doc.y + 24, { width: 440 });
    doc.y += 65;

    // Helpers
    const drawField = (label, lines = 2, hint) => {
      h.checkPageSpace(30 + lines * 18);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(CHEVLA_DARK).text(label, 55);
      if (hint) doc.fontSize(8).font('Helvetica').fillColor(CHEVLA_GRAY).text(hint, 55);
      doc.moveDown(0.2);
      for (let i = 0; i < lines; i++) {
        const ly = doc.y;
        doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(55, ly + 14).lineTo(540, ly + 14).stroke();
        doc.moveDown(1);
      }
      doc.moveDown(0.35);
    };

    const drawChoice = (label, options, hint) => {
      h.checkPageSpace(35);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(CHEVLA_DARK).text(label, 55);
      if (hint) doc.fontSize(8).font('Helvetica').fillColor(CHEVLA_GRAY).text(hint, 55);
      doc.moveDown(0.2);
      const cols = Math.min(options.length, 4);
      const colW = 470 / cols;
      const startY = doc.y;
      options.forEach((o, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = 65 + col * colW;
        const cy = startY + row * 16;
        doc.roundedRect(cx, cy, 10, 10, 2).lineWidth(0.8).strokeColor('#94A3B8').stroke();
        doc.fontSize(9).font('Helvetica').fillColor(CHEVLA_DARK).text(o, cx + 14, cy + 1, { width: colW - 20 });
      });
      const totalRows = Math.ceil(options.length / cols);
      doc.y = startY + totalRows * 16 + 8;
    };

    const drawSectionHeader = (num, title, subtitle) => {
      h.checkPageSpace(80);
      doc.moveDown(0.5);
      doc.roundedRect(55, doc.y, 485, 28, 4).fill(CHEVLA_BLUE);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text(`${num}. ${title.toUpperCase()}`, 70, doc.y + 7, { width: 455 });
      doc.y += 32;
      if (subtitle) {
        doc.fontSize(9).font('Helvetica').fillColor(CHEVLA_GRAY).text(subtitle, 55, doc.y, { width: 485 });
        doc.moveDown(0.5);
      }
      doc.moveDown(0.3);
    };

    // SECTIONS 1-10 (same briefing sections as before)
    drawSectionHeader('1', 'Informacoes da Empresa', 'Nos ajude a entender melhor o seu negocio para criarmos um projeto sob medida.');
    drawField('Nome completo da empresa ou marca:', 1);
    drawField('Ramo de atuacao / segmento de mercado:', 1);
    drawField('Descreva detalhadamente o que a sua empresa faz:', 4, 'Quais produtos ou servicos oferece? Qual o diferencial?');
    drawField('Missao, visao e valores da empresa (se houver):', 3);
    drawField('Historia da empresa (breve resumo):', 3);
    drawField('Endereco completo e horario de funcionamento:', 2);

    drawSectionHeader('2', 'Mercado e Concorrencia', 'Conhecer o mercado nos permite criar algo que se destaque.');
    drawField('Quais sao os seus 3 principais concorrentes?', 3, 'Inclua os enderecos dos sites deles.');
    drawField('O que voce admira nos concorrentes? O que nao gosta?', 3);
    drawField('Qual o principal diferencial competitivo da sua empresa?', 3);
    drawChoice('Faixa de preco dos seus produtos/servicos:', ['Baixo custo / popular', 'Preco medio', 'Premium / alto padrao', 'Variado']);

    drawSectionHeader('3', 'Publico-Alvo e Cliente Ideal', 'Saber para quem estamos criando e essencial para acertar na comunicacao.');
    drawField('Descreva o perfil do seu cliente ideal:', 3);
    drawChoice('Tipo de publico:', ['B2B (vende para empresas)', 'B2C (vende para consumidor final)', 'Ambos']);
    drawField('De onde vem a maioria dos seus clientes atualmente?', 2);
    drawField('Qual a principal dor ou necessidade que seu cliente tem?', 3);
    drawField('Qual a regiao de atuacao?', 1);

    drawSectionHeader('4', 'Identidade Visual e Design', 'Vamos garantir que o site reflita a personalidade da sua marca.');
    drawChoice('Ja possui logotipo profissional?', ['Sim, tenho em alta resolucao', 'Sim, mas precisa de ajustes', 'Nao possuo', 'Quero criar do zero']);
    drawChoice('Possui manual de identidade visual?', ['Sim, completo', 'Sim, parcial', 'Nao possuo']);
    drawField('Cores que representam a marca:', 1);
    drawField('Fontes/tipografias preferidas:', 1);
    drawChoice('Estilo visual desejado:', ['Moderno / Clean', 'Corporativo / Serio', 'Criativo / Ousado', 'Minimalista', 'Sofisticado / Luxo', 'Jovem / Colorido']);
    drawField('Sites que voce gosta visualmente (3-5):', 4);
    drawField('Algo que voce NAO quer no site?', 2);

    drawSectionHeader('5', 'Estrutura e Conteudo do Site', 'Defina as paginas e funcionalidades.');
    drawChoice('Quais paginas?', ['Home', 'Sobre nos', 'Servicos / Produtos', 'Portfolio', 'Blog', 'Contato']);
    drawField('Paginas adicionais ou personalizadas:', 2);
    drawField('Slogan ou frase principal:', 1);
    drawChoice('Ja possui textos prontos?', ['Sim, todos', 'Tenho parte', 'Nao tenho', 'Quero que a Chevla escreva']);
    drawChoice('Possui fotos profissionais?', ['Sim', 'Tenho algumas', 'Nao, usem banco de imagens', 'Quero contratar fotografo']);

    drawSectionHeader('6', 'Funcionalidades e Integracoes', 'Selecione os recursos necessarios.');
    drawChoice('Funcionalidades desejadas:', ['Formulario de contato', 'Chat / WhatsApp', 'Agendamento', 'Calculadora / Orcamento', 'Area de login', 'Loja virtual', 'Blog', 'Newsletter', 'Galeria', 'Mapa', 'Depoimentos', 'Integracao CRM']);
    drawChoice('Redes sociais:', ['Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'TikTok', 'Twitter/X']);
    drawChoice('Ferramentas:', ['Google Analytics', 'Search Console', 'Meta Pixel', 'Google Ads', 'RD Station', 'Mailchimp']);

    drawSectionHeader('7', 'SEO e Presenca Digital', 'Para ser encontrado no Google.');
    drawField('Palavras-chave desejadas no Google:', 2);
    drawChoice('Google Meu Negocio:', ['Sim', 'Nao', 'Nao sei']);
    drawChoice('Redes sociais ativas:', ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'Nenhuma']);
    drawField('Links das redes sociais:', 3);
    drawChoice('Investe em trafego pago?', ['Google Ads', 'Meta Ads', 'Ambos', 'Nao', 'Quero comecar']);

    drawSectionHeader('8', 'Dominio e Hospedagem', 'Informacoes tecnicas.');
    drawChoice('Possui dominio?', ['Sim', 'Nao, preciso registrar']);
    drawField('Qual o dominio?', 1);
    drawChoice('Possui hospedagem?', ['Sim', 'Nao, preciso contratar']);
    drawField('Provedor de hospedagem:', 1);
    drawField('Possui e-mails profissionais?', 1);

    drawSectionHeader('9', 'Expectativas, Prazos e Prioridades', 'Entender suas expectativas garante entregas alinhadas.');
    drawField('Principal objetivo do site:', 3);
    drawField('Meta especifica:', 2);
    drawChoice('Prioridade numero 1:', ['Design bonito', 'Velocidade / Performance', 'SEO / Google', 'Gerar contatos / Vendas', 'Presenca online']);
    drawField('Data limite para ficar pronto:', 1);

    drawSectionHeader('10', 'Observacoes e Informacoes Adicionais', 'Espaco livre para informacoes extras.');
    drawField('Observacoes gerais:', 6);
    drawField('Responsavel pela aprovacao:', 1);

    h.checkPageSpace(100);
    doc.moveDown(1.5);
    doc.roundedRect(55, doc.y, 485, 70, 6).fillAndStroke(CHEVLA_LIGHT, '#D1D5DB');
    doc.fontSize(10).font('Helvetica-Bold').fillColor(CHEVLA_DARK).text('APOS PREENCHER, ENVIE ESTE DOCUMENTO PARA:', 75, doc.y + 12, { width: 440, align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(CHEVLA_BLUE).text(CHEVLA_EMAIL, 75, doc.y, { width: 440, align: 'center' });
    doc.fontSize(11).font('Helvetica').fillColor(CHEVLA_GRAY).text(`WhatsApp: ${CHEVLA_PHONE}`, 75, doc.y + 16, { width: 440, align: 'center' });
    doc.y += 85;

    doc.fontSize(8).font('Helvetica').fillColor(CHEVLA_GRAY)
      .text('As informacoes fornecidas neste briefing sao confidenciais e serao utilizadas exclusivamente para o desenvolvimento do projeto contratado.', 55, doc.y, { width: 485, align: 'center' });

    finalizePdf(doc, h);
  } catch (error) { console.error('Erro ao gerar briefing:', error); res.status(500).json({ error: 'Erro ao gerar briefing PDF' }); }
});

export default router;
