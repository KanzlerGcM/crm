import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useRealtimeRefresh } from '@/contexts/SocketContext';
import {
  Bell, AlertTriangle, Clock, CreditCard, FileText, CheckSquare,
  ArrowRight, RefreshCw, CheckCircle, AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NotificationData } from '@/lib/types';

interface NotifItem { id: string; type: string; severity: string; title: string; description?: string | null; date: string; link: string; entity_type?: string; entity_id?: number }

const TYPE_CONFIG: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  follow_up_overdue: { icon: Clock, label: 'Follow-up Atrasado', color: 'text-red-500' },
  follow_up_today: { icon: Clock, label: 'Follow-up Hoje', color: 'text-amber-500' },
  task_overdue: { icon: CheckSquare, label: 'Tarefa Atrasada', color: 'text-red-500' },
  payment_overdue: { icon: CreditCard, label: 'Pagamento Atrasado', color: 'text-red-500' },
  contract_delivery: { icon: FileText, label: 'Entrega PrÃ³xima', color: 'text-amber-500' },
};

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: LucideIcon }> = {
  danger: { bg: 'bg-red-500/10', border: 'border-l-red-500', icon: AlertTriangle },
  warning: { bg: 'bg-amber-500/10', border: 'border-l-amber-500', icon: AlertCircle },
  info: { bg: 'bg-blue-500/10', border: 'border-l-blue-500', icon: Bell },
};

export default function Notifications() {
  const [data, setData] = useState<NotificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const result = await api.analytics.notifications();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);
  useRealtimeRefresh(['client', 'contract', 'task', 'payment'], fetchNotifications);

  const filteredNotifications = filterType
    ? data?.notifications?.filter((n) => n.type === filterType) || []
    : data?.notifications || [];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-red-400" />
            NotificaÃ§Ãµes
          </h1>
          <p className="text-gray-400 mt-1">
            {data?.counts?.total || 0} alerta(s) â€” {data?.counts?.danger || 0} urgente(s)
          </p>
        </div>
        <button onClick={fetchNotifications} className="btn-secondary">
          <RefreshCw className="w-5 h-5" />Atualizar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-400">{data?.counts?.danger || 0}</p>
          <p className="text-sm text-red-500">Urgentes</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
          <AlertCircle className="w-6 h-6 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-amber-400">{data?.counts?.warning || 0}</p>
          <p className="text-sm text-amber-500">Avisos</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center cursor-pointer" onClick={fetchNotifications}>
          <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-400">{data?.counts?.total === 0 ? 'âœ“' : data?.counts?.total}</p>
          <p className="text-sm text-green-500">Total</p>
        </div>
        <Link to="/tasks" className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center hover:bg-blue-500/15 transition-colors">
          <CheckSquare className="w-6 h-6 text-blue-500 mx-auto mb-1" />
          <p className="text-sm font-medium text-blue-400">Ver Tarefas</p>
          <p className="text-sm text-blue-500 mt-1">Gerenciar to-dos</p>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterType('')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !filterType ? 'bg-red-600 text-white' : 'bg-[#14171D] border border-white/[0.06] text-gray-600 hover:bg-white/[0.03]'
          }`}>
          Todos
        </button>
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <button key={key} onClick={() => setFilterType(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === key ? 'bg-red-600 text-white' : 'bg-[#14171D] border border-white/[0.06] text-gray-600 hover:bg-white/[0.03]'
            }`}>
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {filteredNotifications.length > 0 ? (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => {
            const typeConfig = TYPE_CONFIG[notif.type] || { icon: Bell, label: notif.type, color: 'text-gray-500' };
            const severityStyle = SEVERITY_STYLES[notif.severity] || SEVERITY_STYLES.info;
            const TypeIcon = typeConfig.icon;

            return (
              <Link key={notif.id} to={notif.link}
                className={`block ${severityStyle.bg} rounded-xl border border-white/[0.06] border-l-4 ${severityStyle.border} p-4 hover:shadow-md transition-shadow`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        notif.severity === 'danger' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {typeConfig.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(notif.date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-base font-medium text-white mt-1">{notif.title}</p>
                    {notif.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{notif.description}</p>
                    )}
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-12 text-center">
          <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-white mb-1">Tudo em dia!</h2>
          <p className="text-lg text-gray-500">NÃ£o hÃ¡ alertas pendentes.</p>
        </div>
      )}
    </div>
  );
}


