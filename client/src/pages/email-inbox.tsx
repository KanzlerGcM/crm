import { useMemo } from 'react';
import {
  Inbox, RefreshCw, Loader2, Clock, Paperclip,
  Mail, ArrowLeft, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { EmailMessage } from '@/lib/types';

interface EmailInboxProps {
  emails: EmailMessage[];
  selectedEmail: EmailMessage | null;
  loading: boolean;
  detailLoading: boolean;
  page: number;
  totalPages: number;
  onLoadPage: (page: number) => void;
  onReadEmail: (uid: number) => void;
  onReply: (email: EmailMessage) => void;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
}

export default function EmailInbox({
  emails, selectedEmail, loading, detailLoading,
  page, totalPages, onLoadPage, onReadEmail, onReply,
  searchTerm = '', onSearchChange,
}: EmailInboxProps) {
  const filteredEmails = useMemo(() => {
    if (!searchTerm.trim()) return emails;
    const term = searchTerm.toLowerCase();
    return emails.filter(e =>
      (e.from || '').toLowerCase().includes(term) ||
      (e.from_address || '').toLowerCase().includes(term) ||
      (e.subject || '').toLowerCase().includes(term)
    );
  }, [emails, searchTerm]);

  return (
    <div className="grid lg:grid-cols-12 gap-6" style={{ minHeight: '78vh' }}>
      {/* Email list */}
      <div className="lg:col-span-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-bold text-gray-300 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-red-400" /> Caixa de Entrada
            {emails.length > 0 && (
              <span className="text-xs bg-white/[0.04] text-gray-500 px-2 py-0.5 rounded-full font-medium">{emails.length}</span>
            )}
          </span>
          <button onClick={() => onLoadPage(page)} className="p-2 rounded-lg hover:bg-white/[0.04] transition" title="Atualizar">
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        {onSearchChange && (
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-white/[0.06] rounded-xl bg-[#14171D] focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
              placeholder="Buscar por remetente ou assunto..."
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '68vh' }}>
          {loading && emails.length === 0 && (
            <div className="card p-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-red-400 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Conectando ao servidor de e-mail...</p>
            </div>
          )}
          {!loading && filteredEmails.length === 0 && (
            <div className="card p-16 text-center">
              <Inbox className="w-14 h-14 text-gray-200 mx-auto mb-3" />
              <p className="text-base text-gray-400 font-medium">
                {searchTerm ? 'Nenhum e-mail encontrado' : 'Nenhum e-mail recebido'}
              </p>
              {searchTerm && (
                <button onClick={() => onSearchChange?.('')} className="text-sm text-red-400 mt-2 hover:underline">
                  Limpar busca
                </button>
              )}
            </div>
          )}
          {filteredEmails.map((email, i) => (
            <div key={i}
              className={`card p-4 cursor-pointer transition-all hover:border-red-500/30 hover:shadow-md ${
                selectedEmail?.uid === email.uid ? 'border-red-500 bg-red-500/10/80 shadow-md ring-1 ring-red-200' : ''
              } ${!email.seen ? 'border-l-4 border-l-red-500' : ''}`}
              onClick={() => onReadEmail(email.uid)}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  !email.seen
                    ? 'bg-gradient-to-br from-red-500 to-red-700'
                    : 'bg-white/10'
                }`}>
                  <span className={`text-sm font-bold ${!email.seen ? 'text-white' : 'text-gray-500'}`}>
                    {(email.from_address || email.from)?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${!email.seen ? 'font-bold text-white' : 'font-medium text-gray-600'}`}>
                    {email.from_address || email.from}
                  </p>
                  <p className={`text-sm truncate mt-0.5 ${!email.seen ? 'text-gray-200 font-semibold' : 'text-gray-500'}`}>{email.subject}</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {email.date ? new Date(email.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                    {email.hasAttachments && <Paperclip className="w-3 h-3 text-red-400" />}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t mt-3">
            <button onClick={() => onLoadPage(page - 1)} disabled={page <= 1} className="btn-secondary px-3 py-2 flex items-center gap-1 text-sm disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-sm text-gray-500 font-semibold">{page} / {totalPages}</span>
            <button onClick={() => onLoadPage(page + 1)} disabled={page >= totalPages} className="btn-secondary px-3 py-2 flex items-center gap-1 text-sm disabled:opacity-40">
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Read panel */}
      <div className="lg:col-span-8">
        {detailLoading && (
          <div className="card p-20 text-center h-full flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-red-400 mb-3" />
            <p className="text-sm text-gray-400">Carregando e-mail...</p>
          </div>
        )}
        {selectedEmail && !detailLoading && (
          <div className="card p-8 space-y-6 h-full overflow-y-auto" style={{ maxHeight: '78vh' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-gray-200 leading-tight">{selectedEmail.subject}</h2>
                <div className="mt-3 space-y-1.5">
                  <p className="text-base text-gray-500">
                    De: <span className="text-gray-200 font-semibold">{selectedEmail.from}</span>
                  </p>
                  <p className="text-base text-gray-500">
                    Para: <span className="text-gray-300">{selectedEmail.to}</span>
                    {selectedEmail.cc && <span className="text-gray-400"> | CC: {selectedEmail.cc}</span>}
                  </p>
                  <p className="text-sm text-gray-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {selectedEmail.date ? new Date(selectedEmail.date).toLocaleString('pt-BR') : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onReply(selectedEmail)}
                className="btn-primary flex-shrink-0 flex items-center gap-2 px-5 py-2.5"
              >
                <ArrowLeft className="w-5 h-5" /> Responder
              </button>
            </div>
            {(selectedEmail.attachments?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-2.5 pb-3">
                {selectedEmail.attachments?.map((a, i: number) => (
                  <span key={i} className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.04] rounded-xl text-sm font-medium text-gray-300">
                    <Paperclip className="w-4 h-4 text-gray-500" /> {a.filename} ({(a.size / 1024).toFixed(1)}KB)
                  </span>
                ))}
              </div>
            ) : null}
            <div className="border-t pt-6">
              {selectedEmail.html ? (
                <div className="prose prose-base max-w-none" dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
              ) : (
                <pre className="whitespace-pre-wrap text-base text-gray-300 font-sans leading-relaxed">{selectedEmail.text}</pre>
              )}
            </div>
          </div>
        )}
        {!selectedEmail && !detailLoading && (
          <div className="card p-20 text-center h-full flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
            <Mail className="w-24 h-24 text-gray-200 mb-6" />
            <p className="text-gray-400 text-xl font-semibold">Selecione um e-mail para ler</p>
            <p className="text-gray-300 text-base mt-2">Clique em qualquer e-mail na lista ao lado</p>
          </div>
        )}
      </div>
    </div>
  );
}
