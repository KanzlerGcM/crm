import { useState, useMemo } from 'react';
import { Loader2, Send, Clock, Building2, Search, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import type { EmailMessage } from '@/lib/types';

interface EmailSentProps {
  sentEmails: EmailMessage[];
  loading: boolean;
  onComposeClick: () => void;
}

export default function EmailSent({ sentEmails, loading, onComposeClick }: EmailSentProps) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return sentEmails;
    const term = search.toLowerCase();
    return sentEmails.filter(e =>
      (e.to_address || '').toLowerCase().includes(term) ||
      (e.subject || '').toLowerCase().includes(term) ||
      (e.company_name || '').toLowerCase().includes(term)
    );
  }, [sentEmails, search]);

  if (loading) {
    return (
      <div className="card p-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-400 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Carregando e-mails enviados...</p>
      </div>
    );
  }

  if (sentEmails.length === 0) {
    return (
      <div className="card p-20 text-center" style={{ minHeight: '50vh' }}>
        <Send className="w-24 h-24 text-gray-200 mx-auto mb-6" />
        <p className="text-gray-400 text-2xl font-bold">Nenhum e-mail enviado</p>
        <p className="text-gray-300 text-base mt-2">Utilize um modelo pronto para enviar o seu primeiro e-mail</p>
        <button onClick={onComposeClick} className="btn-primary mt-6 text-lg px-8 py-3">
          <Send className="w-5 h-5" /> Escrever Agora
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats + Search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <span className="text-base font-bold text-gray-300 flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-500" />
            Enviados
            <span className="text-sm bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full font-bold">
              {sentEmails.length}
            </span>
          </span>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-white/[0.06] rounded-xl bg-[#14171D] focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
            placeholder="Buscar e-mails enviados..."
          />
        </div>
      </div>

      {/* Email list */}
      <div className="grid gap-3">
        {filtered.map((email, i) => {
          const isExpanded = expandedId === (email.id || i);
          return (
            <div
              key={email.id || i}
              className={`card transition-all ${isExpanded ? 'border-red-500/30 shadow-md' : 'hover:border-red-500/20 hover:shadow-md shadow-black/20'}`}
            >
              <div
                className="p-5 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : (email.id || i))}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-11 h-11 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Send className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-200">Para: {email.to_address}</p>
                      <p className="text-sm text-gray-600 font-medium mt-0.5">{email.subject}</p>
                      {email.company_name && (
                        <p className="text-sm text-red-400 mt-1 flex items-center gap-1 font-medium">
                          <Building2 className="w-4 h-4" /> {email.company_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(email.created_at || email.date || '').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
              </div>

              {/* Expanded body */}
              {isExpanded && email.body && (
                <div className="px-5 pb-5 pt-0 border-t border-white/[0.04]">
                  <pre className="whitespace-pre-wrap text-sm text-gray-600 font-sans leading-relaxed mt-4 bg-[#111318] rounded-xl p-4 max-h-64 overflow-y-auto">
                    {email.body}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && search && (
          <div className="card p-10 text-center">
            <p className="text-gray-400">Nenhum e-mail enviado corresponde à busca</p>
            <button onClick={() => setSearch('')} className="text-sm text-red-400 mt-2 hover:underline">Limpar busca</button>
          </div>
        )}
      </div>
    </div>
  );
}
