import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  Inbox, Send, Mail, Paperclip,
  Loader2, Search, User, FileText,
  Zap, CheckCircle, AlertCircle,
  Upload, X, File,
} from 'lucide-react';
import type { Client, Contract, EmailMessage } from '@/lib/types';
import { EMAIL_TEMPLATES, CONTRACT_TYPES } from './email-templates';
import EmailInbox from './email-inbox';
import EmailSent from './email-sent';

// ============================================================
// COMPONENT
// ============================================================
export default function EmailPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'inbox' | 'compose' | 'sent'>('inbox');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Compose
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);

  // Clients for template fill
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientPicker, setShowClientPicker] = useState(false);

  // Contract attachment
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [showContractPicker, setShowContractPicker] = useState(false);
  const [selectedContracts, setSelectedContracts] = useState<{ id: number; type: string; label: string }[]>([]);

  // File attachments
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings check
  const [hasSettings, setHasSettings] = useState<boolean | null>(null);

  // Active template
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  // Search
  const [inboxSearch, setInboxSearch] = useState('');

  useEffect(() => {
    checkSettings();
    // Don't load clients eagerly â€” only when compose tab opens
  }, []);

  const checkSettings = async () => {
    try {
      const settings = await api.email.getSettings();
      setHasSettings(!!settings?.smtp_host);
      if (settings?.smtp_host) loadInbox();
    } catch {
      setHasSettings(false);
    }
  };

  const loadClients = useCallback(async (search?: string) => {
    try {
      const params: Record<string, string> = { limit: '30' };
      if (search) params.search = search;
      const data = await api.clients.list(params);
      setClients(data.data || []);
    } catch (err) { console.error('Failed to load clients', err); }
  }, []);

  const loadContracts = async (clientId?: number) => {
    try {
      const params: Record<string, string> = {};
      if (clientId) params.client_id = String(clientId);
      const res = await api.contracts.list(params);
      setContracts(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
    } catch {
      setContracts([]);
    }
  };

  const loadInbox = async (p = 1) => {
    setLoading(true);
    setSelectedEmail(null);
    try {
      const data = await api.email.inbox(p, 30);
      setEmails(data.messages || []);
      setTotalPages(Math.ceil((data.total || 1) / 30));
      setPage(p);
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao carregar inbox');
    } finally {
      setLoading(false);
    }
  };

  const loadSent = async () => {
    setLoading(true);
    try {
      const data = await api.email.sent();
      setSentEmails(data.messages || []);
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao carregar enviados');
    } finally {
      setLoading(false);
    }
  };

  const handleReadEmail = async (uid: number) => {
    setDetailLoading(true);
    try {
      const email = await api.email.getMessage(uid);
      setSelectedEmail(email);
    } catch {
      toast.error('Erro ao ler e-mail');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSend = async () => {
    if (!to || !subject) {
      toast.error('Preencha destinatÃ¡rio e assunto');
      return;
    }
    setSending(true);
    try {
      // Build FormData if there are attachments, otherwise JSON
      if (uploadedFiles.length > 0 || selectedContracts.length > 0) {
        const formData = new FormData();
        formData.append('to', to);
        formData.append('subject', subject);
        formData.append('body', body);
        if (selectedClientId) formData.append('client_id', String(selectedClientId));
        if (selectedContracts.length > 0) {
          formData.append('contractAttachments', JSON.stringify(selectedContracts));
        }
        for (const file of uploadedFiles) {
          formData.append('files', file);
        }
        await api.email.sendWithAttachments(formData);
      } else {
        await api.email.send({ to, subject, body, client_id: selectedClientId });
      }

      toast.success('E-mail enviado com sucesso!');
      resetCompose();
      setTab('sent');
      loadSent();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao enviar');
    } finally {
      setSending(false);
    }
  };

  const resetCompose = () => {
    setTo('');
    setSubject('');
    setBody('');
    setSelectedClientId(undefined);
    setSelectedContracts([]);
    setUploadedFiles([]);
    setActiveTemplate(null);
  };

  const applyTemplate = (template: typeof EMAIL_TEMPLATES[0], client?: Client) => {
    const nome = client?.contact_name || '{nome}';
    const empresa = client?.company_name || '{empresa}';
    setSubject(template.subject.replace(/\{nome\}/g, nome).replace(/\{empresa\}/g, empresa));
    setBody(template.body.replace(/\{nome\}/g, nome).replace(/\{empresa\}/g, empresa));
    setActiveTemplate(template.id);
    if (client?.email) {
      setTo(client.email);
      setSelectedClientId(client.id);
    }
    setTab('compose');
  };

  const selectClient = (client: Client) => {
    setTo(client.email || '');
    setSelectedClientId(client.id);
    setShowClientPicker(false);
    setClientSearch('');
    loadContracts(client.id);
    // Replace placeholders in current subject/body
    if (subject.includes('{nome}') || subject.includes('{empresa}') || body.includes('{nome}') || body.includes('{empresa}')) {
      setSubject(prev => prev.replace(/\{nome\}/g, client.contact_name || '').replace(/\{empresa\}/g, client.company_name || ''));
      setBody(prev => prev.replace(/\{nome\}/g, client.contact_name || '').replace(/\{empresa\}/g, client.company_name || ''));
    }
  };

  const addContractAttachment = (contract: Contract, type: string, label: string) => {
    const exists = selectedContracts.find(c => c.id === contract.id && c.type === type);
    if (!exists) {
      setSelectedContracts(prev => [...prev, { id: contract.id, type, label: `${label} â€” ${contract.client_name || 'Contrato'} #${contract.id}` }]);
    }
    setShowContractPicker(false);
  };

  const removeContractAttachment = (index: number) => {
    setSelectedContracts(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleReply = (email: EmailMessage) => {
    setTo(email.from_address || email.from || '');
    setSubject(`Re: ${email.subject}`);
    setBody(`\n\n--- Mensagem original ---\nDe: ${email.from}\n${email.text?.substring(0, 500) || ''}`);
    setTab('compose');
  };

  const filteredClients = clients;

  const totalAttachments = selectedContracts.length + uploadedFiles.length;

  // Not configured
  if (hasSettings === false) {
    return (
      <div className="space-y-8 animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tight">E-mail</h1>
        <div className="card p-16 text-center max-w-2xl mx-auto">
          <Mail className="w-20 h-20 text-gray-300 mx-auto mb-6" />
          <h2 className="text-2xl font-semibold mb-3">Configure o seu e-mail</h2>
          <p className="text-gray-500 text-lg mb-8">Acesse as <strong>ConfiguraÃ§Ãµes</strong> para conectar o seu e-mail Hostinger (ou outro provedor SMTP/IMAP).</p>
          <a href="/settings" className="btn-primary inline-flex text-lg px-8 py-3">Ir para ConfiguraÃ§Ãµes</a>
        </div>
      </div>
    );
  }

  if (hasSettings === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-red-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Mail className="w-8 h-8 text-red-400" />
          E-mail
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setTab('inbox'); if (emails.length === 0) loadInbox(); }}
            className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
              tab === 'inbox'
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                : 'bg-[#14171D] text-gray-600 border border-white/[0.06] hover:bg-white/[0.03] hover:border-white/[0.08]'
            }`}
          >
            <Inbox className="w-5 h-5" />
            Recebidos
            {emails.filter(e => !e.seen).length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                {emails.filter(e => !e.seen).length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setTab('compose'); loadContracts(); if (clients.length === 0) loadClients(); }}
            className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
              tab === 'compose'
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                : 'bg-[#14171D] text-gray-600 border border-white/[0.06] hover:bg-white/[0.03] hover:border-white/[0.08]'
            }`}
          >
            <Send className="w-5 h-5" /> Escrever
          </button>
          <button
            onClick={() => { setTab('sent'); loadSent(); }}
            className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
              tab === 'sent'
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                : 'bg-[#14171D] text-gray-600 border border-white/[0.06] hover:bg-white/[0.03] hover:border-white/[0.08]'
            }`}
          >
            <Mail className="w-5 h-5" /> Enviados
            {sentEmails.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 rounded-full">
                {sentEmails.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* INBOX                                                        */}
      {/* ============================================================ */}
      {tab === 'inbox' && (
        <EmailInbox
          emails={emails}
          selectedEmail={selectedEmail}
          loading={loading}
          detailLoading={detailLoading}
          page={page}
          totalPages={totalPages}
          onLoadPage={loadInbox}
          onReadEmail={handleReadEmail}
          onReply={handleReply}
          searchTerm={inboxSearch}
          onSearchChange={setInboxSearch}
        />
      )}

      {/* ============================================================ */}
      {/* COMPOSE                                                      */}
      {/* ============================================================ */}
      {tab === 'compose' && (
        <div className="space-y-6">
          {/* Top bar: Client picker + quick template buttons */}
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Client selector */}
            <div className="lg:col-span-5">
              <div className="card p-6">
                <h3 className="text-base font-bold text-gray-300 mb-4 flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-red-500/15 rounded-lg flex items-center justify-center">
                    <User className="w-5 h-5 text-red-400" />
                  </div>
                  Selecionar Cliente
                </h3>
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={e => {
                      setClientSearch(e.target.value);
                      setShowClientPicker(true);
                      loadClients(e.target.value || undefined);
                    }}
                    onFocus={() => setShowClientPicker(true)}
                    className="w-full pl-11 pr-4 py-3 text-base border border-white/[0.06] rounded-xl bg-[#14171D] focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                    placeholder="Buscar por nome, empresa ou e-mail..."
                  />
                </div>
                {showClientPicker && (
                  <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5 border border-white/[0.04] rounded-xl p-2 bg-white/[0.02]">
                    {filteredClients.slice(0, 20).map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectClient(c)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-all text-left"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-white">{c.company_name?.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-200 truncate">{c.company_name}</p>
                          <p className="text-sm text-gray-500 truncate">
                            {c.contact_name && <span className="text-red-400 font-medium">{c.contact_name}</span>}
                            {c.contact_name && c.email && ' â€” '}
                            {c.email || 'Sem e-mail cadastrado'}
                          </p>
                        </div>
                      </button>
                    ))}
                    {filteredClients.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">Nenhum cliente encontrado</p>
                    )}
                  </div>
                )}
                {selectedClientId && (
                  <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm font-semibold text-red-300">
                      Cliente selecionado: {clients.find(c => c.id === selectedClientId)?.company_name}
                    </span>
                    <button onClick={() => { setSelectedClientId(undefined); setTo(''); }} className="ml-auto">
                      <X className="w-4 h-4 text-red-400 hover:text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Templates grid */}
            <div className="lg:col-span-7">
              <div className="card p-6">
                <h3 className="text-base font-bold text-gray-300 mb-4 flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  Modelos Prontos
                </h3>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {EMAIL_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t, clients.find(c => c.id === selectedClientId))}
                      className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all text-center group hover:shadow-md ${
                        activeTemplate === t.id
                          ? 'border-red-500 bg-red-500/10 shadow-md'
                          : 'border-white/[0.04] hover:border-red-500/30 hover:bg-red-500/5'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${t.color} border`}>
                        <t.icon className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-semibold text-gray-300 group-hover:text-red-300 leading-tight">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main compose area â€” full width */}
          <div className="card p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-200 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center">
                  <Send className="w-5 h-5 text-red-400" />
                </div>
                Escrever E-mail
              </h3>
              {activeTemplate && (
                <span className="text-sm font-medium text-red-400 bg-red-500/10 px-4 py-1.5 rounded-full border border-red-500/20">
                  Modelo: {EMAIL_TEMPLATES.find(t => t.id === activeTemplate)?.name}
                </span>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-2 block">DestinatÃ¡rio</label>
                <input
                  type="email"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-white/[0.06] rounded-xl bg-[#14171D] focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-2 block">Assunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-white/[0.06] rounded-xl bg-[#14171D] focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  placeholder="Assunto do e-mail"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-600 mb-2 block">Mensagem</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                className="w-full px-5 py-4 text-base leading-relaxed border border-white/[0.06] rounded-xl bg-[#14171D] focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-y"
                rows={18}
                placeholder="Escreva sua mensagem ou selecione um modelo pronto acima..."
              />
            </div>

            {/* Placeholder warning */}
            {(subject.includes('{nome}') || subject.includes('{empresa}') || body.includes('{nome}') || body.includes('{empresa}')) && (
              <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-base text-amber-400">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <span>Selecione um cliente acima para preencher <strong>{'{nome}'}</strong> e <strong>{'{empresa}'}</strong> automaticamente.</span>
              </div>
            )}

            {/* ATTACHMENTS SECTION */}
            <div className="border-t pt-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h4 className="text-base font-bold text-gray-300 flex items-center gap-2.5">
                  <Paperclip className="w-5 h-5 text-gray-500" />
                  Anexos {totalAttachments > 0 && (
                    <span className="text-xs bg-red-500/15 text-red-300 font-bold px-2.5 py-1 rounded-full">{totalAttachments}</span>
                  )}
                </h4>
                <div className="flex gap-3">
                  {/* Attach contract from system */}
                  <button
                    onClick={() => setShowContractPicker(!showContractPicker)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-xl hover:bg-violet-100 transition-all"
                  >
                    <FileText className="w-5 h-5" />
                    Anexar Contrato do Sistema
                  </button>
                  {/* Attach file from computer */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-500/15 transition-all"
                  >
                    <Upload className="w-5 h-5" />
                    Anexar Arquivo do Computador
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.rar,.txt,.csv"
                  />
                </div>
              </div>

              {/* Contract picker dropdown */}
              {showContractPicker && (
                <div className="border border-violet-500/20 rounded-xl p-5 bg-violet-500/10/50 space-y-3">
                  <p className="text-sm font-semibold text-violet-400">Selecione o contrato e o tipo de documento:</p>
                  {contracts.length === 0 ? (
                    <p className="text-sm text-gray-500 py-3">
                      {selectedClientId
                        ? 'Nenhum contrato encontrado para este cliente.'
                        : 'Selecione um cliente primeiro para ver seus contratos.'}
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {contracts.map((contract) => (
                          <div key={contract.id} className="bg-[#14171D] rounded-xl border border-violet-500/20 p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-violet-400" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-200">
                                {contract.client_name || 'Contrato'} #{contract.id}
                              </p>
                              <p className="text-sm text-gray-500">{contract.service_name || contract.service_type}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {CONTRACT_TYPES.map(ct => (
                              <button
                                key={ct.type}
                                onClick={() => addContractAttachment(contract, ct.type, ct.label)}
                                disabled={selectedContracts.some(sc => sc.id === contract.id && sc.type === ct.type)}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-500/20 bg-[#14171D] hover:bg-violet-500/10 text-violet-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {ct.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Attached items list */}
              {totalAttachments > 0 && (
                <div className="flex flex-wrap gap-3">
                  {selectedContracts.map((sc, i) => (
                    <div key={`contract-${i}`} className="flex items-center gap-2.5 px-4 py-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                      <FileText className="w-5 h-5 text-violet-400" />
                      <span className="text-sm font-medium text-violet-300">{sc.label}</span>
                      <button onClick={() => removeContractAttachment(i)} className="ml-1 hover:bg-violet-500/15 rounded-full p-0.5 transition">
                        <X className="w-4 h-4 text-violet-400 hover:text-violet-400" />
                      </button>
                    </div>
                  ))}
                  {uploadedFiles.map((file, i) => (
                    <div key={`file-${i}`} className="flex items-center gap-2.5 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <File className="w-5 h-5 text-blue-400" />
                      <span className="text-sm font-medium text-blue-300">{file.name}</span>
                      <span className="text-xs text-blue-500">({(file.size / 1024).toFixed(0)}KB)</span>
                      <button onClick={() => removeUploadedFile(i)} className="ml-1 hover:bg-blue-500/15 rounded-full p-0.5 transition">
                        <X className="w-4 h-4 text-blue-400 hover:text-blue-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-between items-center pt-4 border-t">
              <button
                onClick={resetCompose}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-400 bg-white/[0.04] rounded-xl hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" /> Limpar Tudo
              </button>
              <div className="flex gap-4">
                <button onClick={() => setTab('inbox')} className="px-6 py-2.5 text-sm font-semibold text-gray-400 bg-white/[0.04] rounded-xl hover:bg-white/10 transition">
                  Cancelar
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !to || !subject}
                  className="flex items-center gap-2.5 px-8 py-3 text-base font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg shadow-red-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {sending ? 'Enviando...' : 'Enviar E-mail'}
                  {totalAttachments > 0 && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{totalAttachments} anexo{totalAttachments > 1 ? 's' : ''}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SENT                                                         */}
      {/* ============================================================ */}
      {tab === 'sent' && (
        <EmailSent
          sentEmails={sentEmails}
          loading={loading}
          onComposeClick={() => setTab('compose')}
        />
      )}
    </div>
  );
}


