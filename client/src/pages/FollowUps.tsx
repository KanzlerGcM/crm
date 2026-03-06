import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useRealtimeRefresh } from '@/contexts/SocketContext';
import {
  Clock, Phone, Mail, MessageCircle, Calendar, FileText, Send,
  PhoneCall, AlertTriangle, CheckCircle, ArrowRight, RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FollowUpItem {
  id: number;
  client_id: number;
  company_name: string;
  contact_name: string;
  phone: string | null;
  email: string | null;
  client_status: string;
  type: string;
  description: string;
  next_follow_up: string;
  created_at: string;
}

const INTERACTION_ICONS: Record<string, LucideIcon> = {
  call: PhoneCall, email: Mail, whatsapp: MessageCircle,
  meeting: Calendar, note: FileText, proposal: Send,
};
const INTERACTION_LABELS: Record<string, string> = {
  call: 'Ligação', email: 'E-mail', whatsapp: 'WhatsApp',
  meeting: 'Reunião', note: 'Nota', proposal: 'Proposta',
};

export default function FollowUps() {
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchFollowUps = async () => {
    setLoading(true);
    try {
      const data = await api.clients.followUps() as unknown as FollowUpItem[];
      setFollowUps(data);
    } catch (err) {
      toast.error('Erro ao carregar follow-ups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFollowUps(); }, []);
  useRealtimeRefresh(['client'], fetchFollowUps);

  const isOverdue = (date: string) => new Date(date) < new Date(new Date().toISOString().split('T')[0]);
  const isToday = (date: string) => date === new Date().toISOString().split('T')[0];

  const overdue = followUps.filter(f => isOverdue(f.next_follow_up));
  const today = followUps.filter(f => isToday(f.next_follow_up));
  const upcoming = followUps.filter(f => !isOverdue(f.next_follow_up) && !isToday(f.next_follow_up));

  const FollowUpCard = ({ item, highlight }: { item: FollowUpItem; highlight: 'danger' | 'warning' | 'normal' }) => {
    const Icon = INTERACTION_ICONS[item.type] || FileText;
    const borderColor = highlight === 'danger' ? 'border-l-red-500' : highlight === 'warning' ? 'border-l-amber-500' : 'border-l-blue-500';
    
    const whatsappLink = item.phone
      ? `https://wa.me/55${item.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${item.contact_name}! Aqui é da Chevla.`)}`
      : '';

    return (
      <div className={`bg-[#14171D] rounded-xl border border-white/[0.06] border-l-4 ${borderColor} p-5 hover:shadow-md transition-shadow`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${
              highlight === 'danger' ? 'bg-red-500/10' : highlight === 'warning' ? 'bg-amber-500/10' : 'bg-blue-500/10'
            }`}>
              <Icon className={`w-5 h-5 ${
                highlight === 'danger' ? 'text-red-400' : highlight === 'warning' ? 'text-amber-400' : 'text-blue-400'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link to={`/clients/${item.client_id}`} className="text-lg font-semibold text-white hover:text-red-400">
                  {item.company_name}
                </Link>
                <span className={`badge badge-${item.client_status}`}>
                  {item.client_status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{item.contact_name}</p>
              <p className="text-base text-gray-300 mt-2">{item.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm text-gray-400">
                  {INTERACTION_LABELS[item.type] || item.type} · {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </span>
                <span className={`text-sm font-medium ${
                  highlight === 'danger' ? 'text-red-600' : highlight === 'warning' ? 'text-amber-600' : 'text-blue-600'
                }`}>
                  {isOverdue(item.next_follow_up) 
                    ? `Atrasado (${new Date(item.next_follow_up).toLocaleDateString('pt-BR')})`
                    : isToday(item.next_follow_up)
                    ? 'Hoje'
                    : new Date(item.next_follow_up).toLocaleDateString('pt-BR')
                  }
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {item.phone && (
              <a href={`tel:${item.phone}`} className="p-2.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-500/10" title="Ligar">
                <Phone className="w-5 h-5" />
              </a>
            )}
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="p-2.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-500/10" title="WhatsApp">
                <MessageCircle className="w-5 h-5" />
              </a>
            )}
            {item.email && (
              <a href={`mailto:${item.email}`} className="p-2.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-500/10" title="E-mail">
                <Mail className="w-5 h-5" />
              </a>
            )}
            <Link to={`/clients/${item.client_id}`} className="p-2.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10" title="Ver cliente">
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Follow-ups</h1>
          <p className="text-gray-400 mt-1">
            {followUps.length} follow-up(s) pendente(s) nos próximos 7 dias
          </p>
        </div>
        <button onClick={fetchFollowUps} className="btn-secondary">
          <RefreshCw className="w-5 h-5" />
          Atualizar
        </button>
      </div>

      {followUps.length === 0 ? (
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-12 text-center">
          <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-white mb-1">Tudo em dia!</h2>
          <p className="text-lg text-gray-500">Não há follow-ups pendentes para os próximos 7 dias.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {overdue.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold text-red-400">
                  Atrasados ({overdue.length})
                </h2>
              </div>
              <div className="space-y-3">
                {overdue.map(item => (
                  <FollowUpCard key={item.id} item={item} highlight="danger" />
                ))}
              </div>
            </div>
          )}

          {/* Today */}
          {today.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-amber-400">
                  Hoje ({today.length})
                </h2>
              </div>
              <div className="space-y-3">
                {today.map(item => (
                  <FollowUpCard key={item.id} item={item} highlight="warning" />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-blue-400">
                  Próximos dias ({upcoming.length})
                </h2>
              </div>
              <div className="space-y-3">
                {upcoming.map(item => (
                  <FollowUpCard key={item.id} item={item} highlight="normal" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
