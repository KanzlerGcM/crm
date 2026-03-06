// ═══════════════════════════════════════
// Prospector Chevla — TypeScript Types
// ═══════════════════════════════════════

export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'user';
  active?: number;
  created_at: string;
}

export interface Client {
  id: number;
  company_name: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  status: 'prospect' | 'contacted' | 'negotiating' | 'proposal_sent' | 'client' | 'lost';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  interest: string | null;
  estimated_value: number;
  notes: string | null;
  next_follow_up: string | null;
  assigned_to: number | null;
  assigned_name?: string;
  lead_score?: number;
  version?: number;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: number;
  client_id: number;
  type: 'call' | 'email' | 'whatsapp' | 'meeting' | 'note' | 'proposal';
  description: string;
  next_follow_up?: string | null;
  created_at: string;
  user_name?: string;
}

export interface Contract {
  id: number;
  client_id: number;
  contract_number: string;
  contract_type: 'site_creation' | 'maintenance';
  plan_type: string;
  value: number;
  payment_method: string | null;
  installments: number;
  discount_percent: number;
  final_value: number;
  status: 'draft' | 'sent' | 'signed' | 'active' | 'in_progress' | 'delivered' | 'completed' | 'cancelled';
  start_date: string | null;
  delivery_date: string | null;
  renewal_date: string | null;
  custom_clauses: string | null;
  notes: string | null;
  version?: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  client_name?: string;
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  cnpj?: string;
  address?: string;
  city?: string;
  state?: string;
  website?: string;
  service_name?: string;
  service_type?: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  client_id: number | null;
  contract_id: number | null;
  assigned_to: number;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  completed_at: string | null;
  recurrence_rule: 'daily' | 'weekly' | 'monthly' | null;
  version?: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  client_name?: string;
  company_name?: string;
  contact_name?: string;
  contract_number?: string;
  assigned_name?: string;
}

export interface Payment {
  id: number;
  contract_id: number;
  client_id: number;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: 'pending' | 'paid' | 'cancelled';
  payment_method: string | null;
  installment_number: number;
  notes: string | null;
  version?: number;
  created_at: string;
  updated_at?: string;
  // Joined fields
  company_name?: string;
  contact_name?: string;
  contract_number?: string;
  plan_type?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface DashboardData {
  clients: { total: number; new_this_month: number; by_status: Record<string, number> };
  contracts: { total: number; active: number; revenue: number; by_type: Record<string, number> };
  tasks: { total: number; pending: number; overdue: number; completed_this_month: number };
  payments: { received: number; pending: number; overdue: number };
  recent_activity: ActivityLog[];
}

export interface ActivityLog {
  id: number;
  user_id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  details: string;
  created_at: string;
  user_name?: string;
}

export interface PaymentStats {
  totalReceived: number;
  totalPending: number;
  totalOverdue: number;
  countPending: number;
  countOverdue: number;
  countPaid: number;
  monthly: { month: string; total: number }[];
}

export interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  today: number;
  completedThisMonth?: number;
}

export interface ClientStats {
  statusCounts: Array<{ status: string; count: number }>;
  interestCounts: Array<{ interest: string; count: number }>;
  priorityCounts: Array<{ priority: string; count: number }>;
  totalEstimatedValue: number;
  monthlyNew: Array<{ month: string; count: number }>;
  pendingFollowUps: number;
  contractStats: Array<{ status: string; count: number; total_value: number }>;
}

export interface NotificationCounts {
  total: number;
  danger: number;
  warning: number;
}

export interface NotificationData {
  counts: NotificationCounts;
  notifications: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string | null;
    date: string;
    link: string;
    entity_type: string;
    entity_id: number;
  }>;
}

export interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  type: string;
  color: string;
  entity_id: number;
}

export interface ServicePlan {
  name: string;
  value: number;
  features: string[];
  excludes?: string[];
  type: 'site_creation' | 'maintenance';
}

export interface PageSpeedScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface StrategyData {
  strategy: string;
  scores: PageSpeedScores;
  metrics: Record<string, string | number>;
  opportunities: { title: string; description: string; displayValue: string; score: number }[];
  diagnostics: { title: string; description: string; displayValue: string; score: number }[];
}

export interface PageSpeedResult {
  id?: number;
  url: string;
  strategy?: string;
  fetchTime?: string;
  scores?: PageSpeedScores;
  mobile?: StrategyData;
  desktop?: StrategyData;
  created_at?: string;
}

export interface EmailMessage {
  uid: number;
  id?: number;
  from: string;
  from_address?: string;
  to: string;
  to_address?: string;
  cc?: string;
  subject: string;
  date: string;
  text?: string;
  html?: string;
  body?: string;
  seen: boolean;
  hasAttachments?: boolean;
  attachments?: Array<{ filename: string; size: number }>;
  // Sent email joined fields
  company_name?: string;
  created_at?: string;
}

export interface EmailSettings {
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  email_address: string;
  email_password: string;
}

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  category: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: number;
  client_id: number | null;
  phone: string;
  message: string;
  template_name: string | null;
  sent_by: number;
  sent_by_name?: string;
  company_name?: string;
  contact_name?: string;
  created_at: string;
}

export interface CnpjResult {
  cnpj: string;
  trade_name: string;
  legal_name: string;
  company_name: string;
  status: string;
  type: string;
  opening_date: string;
  share_capital?: number;
  email: string;
  phone: string;
  address: string;
  neighborhood?: string;
  city: string;
  state: string;
  main_activity: string;
  partners: Array<{ name: string; role: string }>;
}

export interface Attachment {
  id: number;
  entity_type: 'client' | 'contract' | 'task' | 'payment';
  entity_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_by: number;
  uploaded_by_name?: string;
  created_at: string;
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  client_id: number;
  contract_id: number | null;
  issue_date: string;
  due_date: string | null;
  description: string | null;
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: 'draft' | 'issued' | 'paid' | 'cancelled' | 'overdue';
  payment_method: string | null;
  paid_date: string | null;
  notes: string | null;
  created_by: number | null;
  version?: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  company_name?: string;
  contact_name?: string;
  contract_number?: string;
  items?: InvoiceItem[];
}
