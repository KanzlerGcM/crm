import {
  Handshake, FileText, MessageSquare, CheckCircle, Star, AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface EmailTemplate {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'first_contact',
    name: 'Primeiro Contato',
    icon: Handshake,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    subject: 'Apresentação institucional e proposta de parceria — Chevla',
    body: `Prezado(a) Sr(a). {nome},

Eu, Marcos Gabriel, fundador da Chevla — empresa especializada em desenvolvimento web e soluções digitais de alto desempenho —, dirijo-me a V.Sa. com o intuito de apresentar nossos serviços e propor uma parceria estratégica que poderá fortalecer significativamente a presença digital da {empresa}.

A Chevla atua no mercado de tecnologia com foco em excelência técnica e resultados mensuráveis. Dentre os serviços que disponibilizamos, destacam-se:

• Desenvolvimento de websites com design exclusivo e personalizado;
• Otimização de desempenho (nota superior a 90 no Google PageSpeed);
• Implementação de SEO técnico avançado;
• Suporte técnico humanizado e dedicado.

Caso V.Sa. julgue oportuno, teremos grande satisfação em elaborar uma proposta comercial personalizada, sem qualquer compromisso, adequada às necessidades específicas da {empresa}.

Coloco-me à inteira disposição para quaisquer esclarecimentos adicionais.

Atenciosamente,

Marcos Gabriel Alves Pereira
Fundador — Chevla
contato@chevla.com | (11) 97886-1376`,
  },
  {
    id: 'proposal_sent',
    name: 'Envio de Proposta',
    icon: FileText,
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    subject: 'Proposta comercial — {empresa} | Chevla',
    body: `Prezado(a) Sr(a). {nome},

Conforme previamente acordado, encaminho em anexo a proposta comercial referente ao projeto de desenvolvimento web da {empresa}.

No documento em anexo, V.Sa. encontrará as seguintes informações detalhadas:

• Descrição completa do escopo do projeto;
• Especificações das tecnologias a serem empregadas;
• Cronograma estimado de desenvolvimento e entrega;
• Condições comerciais e formas de pagamento.

Informamos que a presente proposta possui validade de 15 (quinze) dias corridos a partir da data de envio.

Caso V.Sa. deseje esclarecer qualquer ponto da proposta ou agendar uma reunião para discussão mais detalhada, estou à inteira disposição.

Aguardo, respeitosamente, o retorno de V.Sa.

Atenciosamente,

Marcos Gabriel Alves Pereira
Fundador — Chevla
contato@chevla.com | (11) 97886-1376`,
  },
  {
    id: 'follow_up',
    name: 'Acompanhamento',
    icon: MessageSquare,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    subject: 'Acompanhamento — Proposta comercial Chevla para {empresa}',
    body: `Prezado(a) Sr(a). {nome},

Permita-me entrar em contato para verificar se V.Sa. teve a oportunidade de analisar a proposta comercial encaminhada anteriormente, referente ao projeto da {empresa}.

Compreendo que a rotina empresarial demanda atenção em diversas frentes. Desse modo, caso V.Sa. considere conveniente, disponibilizo-me para agendar uma breve reunião — presencial ou por videoconferência — com o objetivo de esclarecer quaisquer dúvidas e alinhar eventuais ajustes necessários.

Caso V.Sa. prefira um contato mais direto, estou igualmente acessível pelo WhatsApp: (11) 97886-1376.

Permaneço à disposição e agradeço pela atenção dispensada.

Atenciosamente,

Marcos Gabriel Alves Pereira
Fundador — Chevla
contato@chevla.com | (11) 97886-1376`,
  },
  {
    id: 'contract_ready',
    name: 'Contrato Pronto',
    icon: CheckCircle,
    color: 'text-green-400 bg-green-500/10 border-green-500/20',
    subject: 'Contrato disponível para assinatura — {empresa} × Chevla',
    body: `Prezado(a) Sr(a). {nome},

Temos a satisfação de informar que o contrato de prestação de serviços referente ao projeto da {empresa} encontra-se devidamente elaborado e disponível para assinatura.

Seguem em anexo os documentos pertinentes:

• Contrato de Prestação de Serviços de Desenvolvimento Web;
• Termo de Aceite e Concordância.

Após a assinatura da documentação e a confirmação do pagamento inicial, daremos início imediato ao processo de desenvolvimento, conforme as seguintes etapas:

1. Formalização contratual mediante assinatura;
2. Envio do formulário de briefing para levantamento de requisitos;
3. Confirmação do pagamento do sinal contratual;
4. Início efetivo do desenvolvimento do projeto.

Caso V.Sa. necessite de algum esclarecimento adicional acerca dos termos contratuais, estou à inteira disposição.

Atenciosamente,

Marcos Gabriel Alves Pereira
Fundador — Chevla
contato@chevla.com | (11) 97886-1376`,
  },
  {
    id: 'project_done',
    name: 'Entrega do Projeto',
    icon: Star,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    subject: 'Conclusão e entrega do projeto — {empresa} | Chevla',
    body: `Prezado(a) Sr(a). {nome},

É com grande satisfação que comunicamos a conclusão e a publicação do projeto desenvolvido para a {empresa}.

Informamos que todos os componentes foram devidamente implementados e verificados, incluindo:

• Website publicado e em pleno funcionamento;
• Configuração completa de SEO técnico;
• Otimização de desempenho e velocidade de carregamento;
• Certificado SSL (HTTPS) ativo e configurado.

A partir desta data, V.Sa. dispõe de um período de 30 (trinta) dias de garantia técnica, que contempla:

• Correção de eventuais inconsistências técnicas;
• Ajustes dentro do escopo originalmente contratado;
• Suporte técnico para esclarecimento de dúvidas.

Caso V.Sa. tenha interesse em manter o website continuamente atualizado e seguro, convidamo-lo(a) a conhecer nossos planos de manutenção mensal.

Segue em anexo o Termo de Aceite e Recebimento para formalização da entrega.

Foi uma honra colaborar com a {empresa} neste projeto.

Atenciosamente,

Marcos Gabriel Alves Pereira
Fundador — Chevla
contato@chevla.com | (11) 97886-1376`,
  },
  {
    id: 'maintenance_remind',
    name: 'Lembrete de Manutenção',
    icon: AlertCircle,
    color: 'text-red-400 bg-red-500/10 border-red-500/20',
    subject: 'Aviso de pagamento — Manutenção mensal {empresa}',
    body: `Prezado(a) Sr(a). {nome},

Dirigimo-nos a V.Sa. para informar que se encontra pendente o pagamento referente ao serviço de manutenção mensal do website da {empresa}.

Caso o pagamento já tenha sido efetuado, solicitamos que desconsidere a presente comunicação, assim como as nossas sinceras desculpas pelo eventual desencontro de informações.

Caso V.Sa. deseje obter informações adicionais sobre o plano de manutenção contratado ou realizar qualquer alteração, estou à disposição para atendê-lo(a).

Atenciosamente,

Marcos Gabriel Alves Pereira
Fundador — Chevla
contato@chevla.com | (11) 97886-1376`,
  },
];

export const CONTRACT_TYPES = [
  { type: 'pdf', label: 'Contrato' },
  { type: 'proposal', label: 'Proposta Comercial' },
  { type: 'acceptance', label: 'Termo de Aceite' },
  { type: 'addendum', label: 'Aditivo' },
  { type: 'termination', label: 'Distrato' },
  { type: 'receipt', label: 'Recibo' },
  { type: 'briefing', label: 'Briefing' },
];
