import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import type { ActivityLog, Pagination } from '@/lib/types';
import {
  Activity, Search, Filter, ChevronLeft, ChevronRight,
  User, FileText, CheckSquare, DollarSign, Calendar, Mail,
  Clock, RefreshCw
} from 'lucide-react';

const ENTITY_ICONS: Record<string, typeof Activity> = {
  client: User,
  contract: FileText,
  task: CheckSquare,
  payment: DollarSign,
  calendar_event: Calendar,
  email: Mail,
  email_template: Mail,
  attachment: FileText,
  whatsapp: Mail,
};

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-500/10 text-green-400',
  updated: 'bg-blue-500/10 text-blue-400',
  deleted: 'bg-red-500/10 text-red-400',
  status_changed: 'bg-yellow-500/10 text-yellow-400',
  sent: 'bg-purple-500/10 text-purple-400',
  uploaded: 'bg-indigo-500/10 text-indigo-400',
};

export default function ActivityLogPage() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(pagination.page),
        limit: String(pagination.limit),
      };
      if (entityFilter) params.entity_type = entityFilter;
      if (actionFilter) params.action = actionFilter;
      if (search) params.search = search;

      const res = await api.analytics.activity(params);
      if (Array.isArray(res)) {
        // Fallback if not paginated
        setLogs(res as unknown as ActivityLog[]);
        setPagination(p => ({ ...p, total: (res as unknown as ActivityLog[]).length, totalPages: 1 }));
      } else {
        setLogs(res.data);
        setPagination(p => ({ ...p, ...res.pagination }));
      }
    } catch {
      addToast('error', 'Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, entityFilter, actionFilter, search, addToast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-red-400" />
          <h1 className="text-2xl font-bold text-white">Log de Atividades</h1>
        </div>
        <button onClick={fetchLogs} className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-white/[0.03]">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#14171D] rounded-xl border p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar nos detalhes..."
            className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm"
            value={search}
            onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={entityFilter}
            onChange={e => { setEntityFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          >
            <option value="">Todas entidades</option>
            <option value="client">Clientes</option>
            <option value="contract">Contratos</option>
            <option value="task">Tarefas</option>
            <option value="payment">Pagamentos</option>
            <option value="email_template">Templates Email</option>
            <option value="attachment">Anexos</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          >
            <option value="">Todas ações</option>
            <option value="created">Criado</option>
            <option value="updated">Atualizado</option>
            <option value="deleted">Excluído</option>
            <option value="status_changed">Status alterado</option>
            <option value="sent">Enviado</option>
            <option value="uploaded">Upload</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#14171D] rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-3 border-red-500 border-t-transparent rounded-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Nenhuma atividade encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111318] border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Usuário</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Entidade</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ação</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map(log => {
                  const Icon = ENTITY_ICONS[log.entity_type] || Activity;
                  const actionColor = ACTION_COLORS[log.action] || 'bg-white/[0.04] text-gray-300';
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(log.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-white">
                        {log.user_name || 'Sistema'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="capitalize">{log.entity_type}</span>
                          {log.entity_id && <span className="text-gray-400">#{log.entity_id}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColor}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={log.details || ''}>
                        {log.details || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="border-t px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                className="p-1.5 border rounded hover:bg-white/[0.03] disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2">{pagination.page} / {pagination.totalPages}</span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                className="p-1.5 border rounded hover:bg-white/[0.03] disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
