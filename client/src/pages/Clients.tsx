import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useRealtimeRefresh } from '@/contexts/SocketContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  Search, Plus, Filter, ChevronLeft, ChevronRight, Trash2,
  Building2, Phone, Mail, Download, Users, X, CheckSquare, Square, RefreshCw,
} from 'lucide-react';
import { STATUS_LABELS, INTEREST_LABELS, PRIORITY_LABELS } from '@/lib/constants';
import type { Client, Pagination } from '@/lib/types';

export default function Clients() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 15, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [interestFilter, setInterestFilter] = useState(searchParams.get('interest') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const toast = useToast();

  const fetchClients = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (interestFilter) params.interest = interestFilter;
      params.page = searchParams.get('page') || '1';
      params.limit = '15';

      const result = await api.clients.list(params);
      setClients(result.data);
      setPagination(result.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [searchParams]);
  useRealtimeRefresh(['client'], fetchClients);

  const applyFilters = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (interestFilter) params.interest = interestFilter;
    params.page = '1';
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setInterestFilter('');
    setSearchParams({});
  };

  const handleDelete = async (id: number, name: string) => {
    setDeleteTarget({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.clients.delete(deleteTarget.id);
      toast.success('Cliente removido', `"${deleteTarget.name}" foi removido com sucesso`);
      fetchClients();
    } catch (err) {
      toast.error('Erro ao remover cliente');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleExport = async () => {
    try {
      await api.clients.exportCsv();
      toast.success('Exportação concluída', 'Arquivo CSV baixado');
    } catch {
      toast.error('Erro ao exportar dados');
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === clients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clients.map(c => c.id)));
    }
  };

  const handleBulkStatus = async (status: string) => {
    try {
      const ids = Array.from(selectedIds);
      await api.clients.bulkStatus(ids, status);
      toast.success('Clientes atualizados', `${ids.length} cliente(s) alterado(s) para ${STATUS_LABELS[status] || status}`);
      setSelectedIds(new Set());
      fetchClients();
    } catch {
      toast.error('Erro ao atualizar clientes em massa');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const ids = Array.from(selectedIds);
      await api.clients.bulkDelete(ids);
      toast.success('Clientes removidos', `${ids.length} cliente(s) removido(s)`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      fetchClients();
    } catch {
      toast.error('Erro ao remover clientes em massa');
    }
  };

  const goToPage = (page: number) => {
    const params = Object.fromEntries(searchParams.entries());
    params.page = String(page);
    setSearchParams(params);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remover Cliente"
        message={`Deseja remover "${deleteTarget?.name}"? Todas as interações e contratos associados serão mantidos.`}
        confirmText="Remover"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Remover Clientes em Massa"
        message={`Deseja remover ${selectedIds.size} cliente(s) selecionado(s)? Esta ação não pode ser desfeita.`}
        confirmText="Remover Todos"
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Clientes & Leads</h1>
          <p className="text-gray-400 mt-1">{pagination.total || 0} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary" title="Exportar CSV">
            <Download className="w-6 h-6" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <Link
            to="/clients/new"
            className="btn-primary"
          >
            <Plus className="w-6 h-6" />
            Novo Lead
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-6 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder="Buscar por empresa, contato, email, telefone, CNPJ..."
              className="w-full pl-12 pr-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 border rounded-lg text-lg transition-colors ${
              showFilters ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'border-white/[0.08] hover:bg-white/[0.03]'
            }`}
          >
            <Filter className="w-6 h-6" />
          </button>
          <button
            onClick={applyFilters}
            className="px-6 py-3 bg-red-600 text-white rounded-lg text-lg hover:bg-red-700"
          >
            Buscar
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-3 border-t border-white/[0.04] animate-slide-in">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none"
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={interestFilter}
              onChange={(e) => setInterestFilter(e.target.value)}
              className="px-4 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none"
            >
              <option value="">Todos os interesses</option>
              {Object.entries(INTEREST_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button onClick={clearFilters} className="text-lg text-gray-500 hover:text-gray-300 underline">
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-wrap items-center gap-3 animate-slide-in">
          <span className="text-base font-medium text-red-300">
            {selectedIds.size} selecionado(s)
          </span>
          <div className="h-6 w-px bg-red-500/20" />
          <select
            onChange={(e) => { if (e.target.value) { handleBulkStatus(e.target.value); e.target.value = ''; } }}
            className="px-3 py-2 border border-red-500/30 rounded-lg text-base bg-[#14171D] focus:ring-2 focus:ring-red-500 outline-none"
            defaultValue=""
          >
            <option value="" disabled>Alterar status para...</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            onClick={() => setBulkDeleteOpen(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-base hover:bg-red-700 flex items-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            Remover
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-2 text-base text-gray-500 hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-6 h-6 border-[3px] border-red-500 border-t-transparent rounded-full" />
        </div>
      ) : clients.length > 0 ? (
        <>
          <div className="bg-[#14171D] rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                    <th className="w-12 px-4 py-4">
                      <button onClick={toggleSelectAll} className="text-gray-400 hover:text-red-400">
                        {selectedIds.size === clients.length && clients.length > 0 ? (
                          <CheckSquare className="w-6 h-6 text-red-400" />
                        ) : (
                          <Square className="w-6 h-6" />
                        )}
                      </button>
                    </th>
                    <th className="text-left text-base font-medium text-gray-500 px-6 py-4">Empresa / Contato</th>
                    <th className="text-left text-base font-medium text-gray-500 px-6 py-4 hidden md:table-cell">Contato</th>
                    <th className="text-left text-base font-medium text-gray-500 px-6 py-4">Status</th>
                    <th className="text-left text-base font-medium text-gray-500 px-6 py-4 hidden lg:table-cell">Interesse</th>
                    <th className="text-left text-base font-medium text-gray-500 px-6 py-4 hidden lg:table-cell">Prioridade</th>
                    <th className="text-right text-base font-medium text-gray-500 px-6 py-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {clients.map((client) => (
                    <tr key={client.id} className={`hover:bg-white/[0.02] transition-colors ${selectedIds.has(client.id) ? 'bg-red-500/5' : ''}`}>
                      <td className="w-12 px-4 py-4">
                        <button onClick={() => toggleSelect(client.id)} className="text-gray-400 hover:text-red-400">
                          {selectedIds.has(client.id) ? (
                            <CheckSquare className="w-6 h-6 text-red-400" />
                          ) : (
                            <Square className="w-6 h-6" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <Link to={`/clients/${client.id}`} className="block">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-base font-bold text-red-300">{client.company_name?.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="text-lg font-medium text-white hover:text-red-400">{client.company_name}</p>
                              <p className="text-base text-gray-500">{client.contact_name}</p>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="space-y-0.5">
                          {client.phone && (
                            <p className="text-base text-gray-500 flex items-center gap-1.5">
                              <Phone className="w-5 h-5" /> {client.phone}
                            </p>
                          )}
                          {client.email && (
                            <p className="text-base text-gray-500 flex items-center gap-1.5">
                              <Mail className="w-5 h-5" /> {client.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge badge-${client.status}`}>
                          {STATUS_LABELS[client.status] || client.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <span className="text-base text-gray-600">
                          {(client.interest && INTEREST_LABELS[client.interest]) || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <span className={`badge priority-${client.priority}`}>
                          {PRIORITY_LABELS[client.priority] || client.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Link
                            to={`/clients/${client.id}`}
                            className="p-2.5 text-gray-400 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors"
                            title="Ver detalhes"
                          >
                            <Building2 className="w-6 h-6" />
                          </Link>
                          <button
                            onClick={() => handleDelete(client.id, client.company_name)}
                            className="p-2.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-500/10 transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="w-6 h-6" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-base text-gray-500">
                Pág. {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-3 border rounded-lg hover:bg-white/[0.03] disabled:opacity-30"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-3 border rounded-lg hover:bg-white/[0.03] disabled:opacity-30"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-16 text-center">
          <Users className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">Nenhum cliente encontrado</p>
          <Link to="/clients/new" className="text-lg text-red-400 hover:text-red-300 mt-2 inline-block">
            Cadastrar novo lead →
          </Link>
        </div>
      )}
    </div>
  );
}
