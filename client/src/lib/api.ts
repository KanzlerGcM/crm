import type {
  User, Client, Contract, Task, Payment, Interaction,
  PaginatedResponse, DashboardData, PaymentStats, TaskStats,
  ClientStats, NotificationData, CalendarEvent, ServicePlan,
  PageSpeedResult, EmailMessage, EmailSettings, ActivityLog,
  EmailTemplate, WhatsAppMessage, Attachment, CnpjResult, Invoice,
} from './types';

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${url}`, { ...options, headers });
  } catch {
    // Network error (server down, no connectivity) — DON'T redirect to login
    throw new Error('Erro de conexão com o servidor. Verifique sua rede.');
  }

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(error.error || 'Erro na requisição');
  }

  // Handle PDF / blob responses
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/pdf') || contentType.includes('text/csv')) {
    return response.blob() as unknown as T;
  }

  return response.json();
}

async function downloadFile(url: string, filename: string) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Erro ao fazer download');
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

// Auth
export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    me: () => request<User>('/auth/me'),
    register: (data: { username: string; password: string; name: string; role?: string }) =>
      request<User>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ message: string }>('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    users: () => request<User[]>('/auth/users'),
    toggleUserActive: (id: number) =>
      request<{ message: string }>(`/auth/users/${id}/toggle-active`, { method: 'PUT' }),
    changeUserRole: (id: number, role: string) =>
      request<{ message: string }>(`/auth/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  },
  clients: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<PaginatedResponse<Client>>(`/clients${qs}`);
    },
    get: (id: number) => request<Client & { interactions?: Interaction[] }>(`/clients/${id}`),
    create: (data: Record<string, unknown>) => request<Client>('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Record<string, unknown>) =>
      request<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ message: string }>(`/clients/${id}`, { method: 'DELETE' }),
    stats: () => request<ClientStats>('/clients/stats'),
    addInteraction: (clientId: number, data: Record<string, unknown>) =>
      request<Interaction>(`/clients/${clientId}/interactions`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteInteraction: (clientId: number, interactionId: number) =>
      request<{ message: string }>(`/clients/${clientId}/interactions/${interactionId}`, { method: 'DELETE' }),
    followUps: () => request<Client[]>('/clients/follow-ups/pending'),
    exportCsv: () => downloadFile('/clients/export/csv', `clientes-${new Date().toISOString().split('T')[0]}.csv`),
    calculateLeadScores: () => request<{ message: string; updated: number }>('/clients/calculate-lead-scores', { method: 'POST' }),
    bulkStatus: (ids: number[], status: string) =>
      request<{ message: string; updated: number }>('/clients/bulk/status', { method: 'POST', body: JSON.stringify({ ids, status }) }),
    bulkDelete: (ids: number[]) =>
      request<{ message: string; deleted: number }>('/clients/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  },
  contracts: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<PaginatedResponse<Contract>>(`/contracts${qs}`);
    },
    get: (id: number) => request<Contract>(`/contracts/${id}`),
    create: (data: Record<string, unknown>) =>
      request<Contract>('/contracts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Record<string, unknown>) =>
      request<Contract>(`/contracts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ message: string }>(`/contracts/${id}`, { method: 'DELETE' }),
    services: () => request<Record<string, ServicePlan>>('/contracts/services'),
    downloadPdf: (id: number) => downloadFile(`/contracts/${id}/pdf`, `contrato-${id}.pdf`),
    downloadProposal: (id: number) => downloadFile(`/contracts/${id}/proposal`, `proposta-${id}.pdf`),
    downloadAcceptance: (id: number) => downloadFile(`/contracts/${id}/acceptance`, `termo-aceite-${id}.pdf`),
    downloadAddendum: (id: number) => downloadFile(`/contracts/${id}/addendum`, `aditivo-${id}.pdf`),
    downloadTermination: (id: number) => downloadFile(`/contracts/${id}/termination`, `distrato-${id}.pdf`),
    downloadReceipt: (id: number) => downloadFile(`/contracts/${id}/receipt`, `recibo-${id}.pdf`),
    downloadBriefing: (id: number) => downloadFile(`/contracts/${id}/briefing`, `briefing-${id}.pdf`),
    exportCsv: () => downloadFile('/contracts/export/csv', `contratos-${new Date().toISOString().split('T')[0]}.csv`),
    renewals: (days?: number) => {
      const qs = days ? `?days=${days}` : '';
      return request<Contract[]>(`/contracts/renewals/upcoming${qs}`);
    },
  },
  cnpj: {
    lookup: (cnpj: string) => request<CnpjResult>(`/cnpj/${cnpj.replace(/[^\d]/g, '')}`),
  },
  maps: {
    search: (query: string, location?: string) => {
      const params = new URLSearchParams({ query });
      if (location) params.set('location', location);
      return request<{ results: Array<Record<string, unknown>> }>(`/maps/search?${params.toString()}`);
    },
    details: (placeId: string) => request<Record<string, unknown>>(`/maps/details/${encodeURIComponent(placeId)}`),
  },
  email: {
    getSettings: () => request<EmailSettings>('/email/settings'),
    saveSettings: (data: Partial<EmailSettings>) => request<{ message: string }>('/email/settings', { method: 'POST', body: JSON.stringify(data) }),
    test: () => request<{ message: string }>('/email/test', { method: 'POST' }),
    send: (data: { to: string; subject: string; body: string; html?: string; client_id?: number }) =>
      request<{ message: string }>('/email/send', { method: 'POST', body: JSON.stringify(data) }),
    sendWithAttachments: async (formData: FormData): Promise<{ message: string }> => {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      // Do NOT set Content-Type — browser sets multipart boundary automatically
      const response = await fetch(`${API_BASE}/email/send-with-attachments`, {
        method: 'POST',
        headers,
        body: formData,
      });
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Sessão expirada');
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(error.error || 'Erro na requisição');
      }
      return response.json();
    },
    inbox: (page?: number, limit?: number) => {
      const params = new URLSearchParams();
      if (page) params.set('page', String(page));
      if (limit) params.set('limit', String(limit));
      return request<{ messages: EmailMessage[]; total: number }>(`/email/inbox?${params.toString()}`);
    },
    getMessage: (uid: number) => request<EmailMessage>(`/email/message/${uid}`),
    sent: (page?: number) => request<{ messages: EmailMessage[]; total: number }>(`/email/sent?page=${page || 0}`),
  },
  tasks: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<PaginatedResponse<Task>>(`/tasks${qs}`);
    },
    stats: () => request<TaskStats>('/tasks/stats'),
    create: (data: Record<string, unknown>) => request<{ id: number; message: string }>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Record<string, unknown>) => request<{ message: string }>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ message: string }>(`/tasks/${id}`, { method: 'DELETE' }),
    processRecurring: () => request<{ message: string; created: number }>('/tasks/process-recurring', { method: 'POST' }),
    exportCsv: () => downloadFile('/tasks/export/csv', `tarefas-${new Date().toISOString().split('T')[0]}.csv`),
    bulkStatus: (ids: number[], status: string) =>
      request<{ message: string; updated: number }>('/tasks/bulk/status', { method: 'POST', body: JSON.stringify({ ids, status }) }),
    bulkDelete: (ids: number[]) =>
      request<{ message: string; deleted: number }>('/tasks/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  },
  payments: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<PaginatedResponse<Payment>>(`/payments${qs}`);
    },
    stats: () => request<PaymentStats>('/payments/stats'),
    create: (data: Partial<Payment>) => request<{ id: number; message: string }>('/payments', { method: 'POST', body: JSON.stringify(data) }),
    generate: (contractId: number) => request<{ message: string; installments: number }>('/payments/generate', { method: 'POST', body: JSON.stringify({ contract_id: contractId }) }),
    update: (id: number, data: Partial<Payment>) => request<{ message: string }>(`/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ message: string }>(`/payments/${id}`, { method: 'DELETE' }),
    exportCsv: () => downloadFile('/payments/export/csv', `pagamentos-${new Date().toISOString().split('T')[0]}.csv`),
  },
  analytics: {
    dashboard: () => request<DashboardData>('/analytics/dashboard'),
    notifications: () => request<NotificationData>('/analytics'),
    search: (q: string) => request<Record<string, unknown>>(`/analytics/search?q=${encodeURIComponent(q)}`),
    calendar: (start?: string, end?: string) => {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      return request<CalendarEvent[]>(`/analytics/calendar?${params.toString()}`);
    },
    createEvent: (data: Record<string, unknown>) =>
      request<{ id: number; message: string }>('/analytics/calendar/events', { method: 'POST', body: JSON.stringify(data) }),
    updateEvent: (id: number, data: Record<string, unknown>) =>
      request<{ message: string }>(`/analytics/calendar/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEvent: (id: number) =>
      request<{ message: string }>(`/analytics/calendar/events/${id}`, { method: 'DELETE' }),
    activity: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<PaginatedResponse<ActivityLog>>(`/analytics/activity${qs}`);
    },
  },
  pagespeed: {
    analyze: (url: string) =>
      request<PageSpeedResult>('/pagespeed/analyze', { method: 'POST', body: JSON.stringify({ url }) }),
    reports: () => request<PageSpeedResult[]>('/pagespeed/reports'),
    deleteReport: (id: number) => request<{ message: string }>(`/pagespeed/reports/${id}`, { method: 'DELETE' }),
    downloadReportPdf: (id: number) =>
      downloadFile(`/pagespeed/reports/${id}/pdf`, `pagespeed-report-${id}.pdf`),
    downloadPdf: (data: Record<string, unknown>) => {
      const token = getToken();
      return fetch(`${API_BASE}/pagespeed/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error('Erro ao gerar PDF');
        const blob = await r.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `pagespeed-${String(data.url || '').replace(/[^a-z0-9]/gi, '_') || 'report'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      });
    },
  },
  emailTemplates: {
    list: () => request<EmailTemplate[]>('/email-templates'),
    get: (id: number) => request<EmailTemplate>(`/email-templates/${id}`),
    create: (data: Partial<EmailTemplate>) =>
      request<{ id: number; message: string }>('/email-templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<EmailTemplate>) =>
      request<{ message: string }>(`/email-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ message: string }>(`/email-templates/${id}`, { method: 'DELETE' }),
  },
  whatsapp: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<PaginatedResponse<WhatsAppMessage>>(`/whatsapp${qs}`);
    },
    byClient: (clientId: number) => request<WhatsAppMessage[]>(`/whatsapp/client/${clientId}`),
    send: (data: { client_id?: number; phone: string; message: string; template_name?: string }) =>
      request<{ id: number; message: string }>('/whatsapp', { method: 'POST', body: JSON.stringify(data) }),
  },
  attachments: {
    list: (entityType: string, entityId: number) =>
      request<Attachment[]>(`/attachments/${entityType}/${entityId}`),
    upload: async (entityType: string, entityId: number, file: File): Promise<Attachment> => {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_BASE}/attachments/${entityType}/${entityId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || 'Erro ao enviar arquivo');
      }
      return response.json();
    },
    download: (id: number) => downloadFile(`/attachments/download/${id}`, `anexo-${id}`),
    delete: (id: number) => request<{ message: string }>(`/attachments/${id}`, { method: 'DELETE' }),
  },
  invoices: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<PaginatedResponse<Invoice>>(`/invoices${qs}`);
    },
    get: (id: number) => request<Invoice>(`/invoices/${id}`),
    create: (data: Record<string, unknown>) =>
      request<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Record<string, unknown>) =>
      request<Invoice>(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ message: string }>(`/invoices/${id}`, { method: 'DELETE' }),
    stats: () => request<{ total: number; issued: number; totalPaid: number; totalPending: number; overdue: number }>('/invoices/stats'),
    downloadPdf: (id: number) => downloadFile(`/invoices/${id}/pdf`, `nota-fiscal-${id}.pdf`),
    exportCsv: () => downloadFile('/invoices/export/csv', `notas-fiscais-${new Date().toISOString().split('T')[0]}.csv`),
  },
};
