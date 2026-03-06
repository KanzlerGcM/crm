// ═══════════════════════════════════════════════════════════
// Chevla Prospector — Shared Constants
// Single source of truth for labels, colors, and mappings
// ═══════════════════════════════════════════════════════════

// ── Client Status ──
export const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  contacted: 'Contactado',
  negotiating: 'Negociando',
  proposal_sent: 'Proposta Enviada',
  client: 'Cliente',
  lost: 'Perdido',
};

export const STATUS_COLORS: Record<string, string> = {
  prospect: '#0077FF',
  contacted: '#7C5CE0',
  negotiating: '#f59e0b',
  proposal_sent: '#6366f1',
  client: '#10b981',
  lost: '#ef4444',
};

export const STATUS_BG: Record<string, string> = {
  prospect: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
  contacted: 'bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20',
  negotiating: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
  proposal_sent: 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20',
  client: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  lost: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
};

// ── Contract Status ──
export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  signed: 'Assinado',
  in_progress: 'Em Andamento',
  delivered: 'Entregue',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const CONTRACT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  sent: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  signed: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  in_progress: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  delivered: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

// ── Payment Status ──
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  cancelled: 'Cancelado',
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  paid: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

// ── Invoice (Nota Fiscal) Status ──
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  issued: 'Emitida',
  paid: 'Paga',
  cancelled: 'Cancelada',
  overdue: 'Vencida',
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  issued: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  paid: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
  overdue: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
};

// ── Priority ──
export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  medium: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  high: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

// ── Interest / Plan Types ──
export const INTEREST_LABELS: Record<string, string> = {
  institutional: 'Site Institucional',
  institutional_blog: 'Site + Blog',
  ecommerce: 'E-commerce',
  essential_maintenance: 'Manut. Essencial',
  pro_maintenance: 'Manut. Pro',
  multiple: 'Múltiplos',
  website: 'Site',
  maintenance: 'Manutenção',
  marketing: 'Marketing',
  design: 'Design',
  other: 'Outro',
};

export const PLAN_LABELS: Record<string, string> = {
  institutional: 'Institucional',
  institutional_blog: 'Site + Blog',
  ecommerce: 'E-commerce',
  essential_maintenance: 'Manut. Essencial',
  pro_maintenance: 'Manut. Pro',
};

// ── Chart palette from Chevla website ──
export const CHART_COLORS = [
  '#0077FF', // Chevla Blue (primary)
  '#7C5CE0', // Violet (secondary)
  '#00C8FF', // Cyan (accent)
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];

// ── Pipeline stages for Kanban ──
export const PIPELINE_STAGES = [
  { key: 'prospect', label: 'Prospects', color: 'border-t-red-500', bg: 'bg-red-500/5', textColor: 'text-red-400' },
  { key: 'contacted', label: 'Contactados', color: 'border-t-violet-500', bg: 'bg-violet-500/5', textColor: 'text-violet-400' },
  { key: 'negotiating', label: 'Negociando', color: 'border-t-amber-500', bg: 'bg-amber-500/5', textColor: 'text-amber-400' },
  { key: 'proposal_sent', label: 'Proposta Enviada', color: 'border-t-indigo-500', bg: 'bg-indigo-500/5', textColor: 'text-indigo-400' },
  { key: 'client', label: 'Clientes', color: 'border-t-emerald-500', bg: 'bg-emerald-500/5', textColor: 'text-emerald-400' },
  { key: 'lost', label: 'Perdidos', color: 'border-t-red-500', bg: 'bg-red-500/5', textColor: 'text-red-400' },
];

// ── Month names (pt-BR) ──
export const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const MONTH_NAMES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ── Task Status ──
export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
};

// ── Brazilian states ──
export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

// ── Utility functions ──
export function formatCurrency(value: number, decimals = 0): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatMonth(month: string): string {
  if (!month) return '';
  const [y, m] = month.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]}/${y.slice(2)}`;
}
