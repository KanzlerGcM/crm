import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useRealtimeRefresh } from '@/contexts/SocketContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { FileText, Download, Search, Plus, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { CONTRACT_STATUS_LABELS as STATUS_LABELS, PLAN_LABELS } from '@/lib/constants';
import type { Contract } from '@/lib/types';

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; number: string } | null>(null);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.contracts.list(params);
      setContracts(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContracts(); }, [page]);
  useRealtimeRefresh(['contract'], fetchContracts);

  const handleSearch = () => {
    setPage(1);
    fetchContracts();
  };

  const handleDelete = async (id: number, number: string) => {
    setDeleteTarget({ id, number });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.contracts.delete(deleteTarget.id);
      toast.success(`Contrato ${deleteTarget.number} removido`);
      fetchContracts();
    } catch {
      toast.error('Erro ao remover contrato');
    }
    setDeleteTarget(null);
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await api.contracts.update(id, { status });
      toast.success(`Status atualizado para ${STATUS_LABELS[status]}`);
      fetchContracts();
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDownloadPdf = async (id: number, contractNumber: string) => {
    try {
      await api.contracts.downloadPdf(id);
      toast.success(`PDF do contrato ${contractNumber} baixado`);
    } catch {
      toast.error('Erro ao baixar PDF');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remover contrato"
        message={`Deseja remover o contrato ${deleteTarget?.number}? Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmText="Remover"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Contratos</h1>
          <p className="text-gray-400 mt-1">{total} contrato(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => api.contracts.exportCsv().catch(() => toast.error('Erro ao exportar'))}
            className="inline-flex items-center gap-2 px-4 py-3 border border-white/[0.08] rounded-lg hover:bg-white/[0.03] transition-colors font-medium"
            title="Exportar CSV">
            <Download className="w-5 h-5" />CSV
          </button>
          <Link
            to="/contracts/new"
            className="inline-flex items-center gap-2.5 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-lg font-medium"
          >
            <Plus className="w-6 h-6" /> Novo Contrato
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar por número ou empresa..."
              className="w-full pl-12 pr-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button onClick={handleSearch}
            className="px-6 py-3 bg-red-600 text-white rounded-lg text-lg hover:bg-red-700">
            Buscar
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-6 h-6 border-[3px] border-red-500 border-t-transparent rounded-full" />
        </div>
      ) : contracts.length > 0 ? (
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                  <th className="text-left text-base font-medium text-gray-500 px-6 py-4">Nº Contrato</th>
                  <th className="text-left text-base font-medium text-gray-500 px-6 py-4">Cliente</th>
                  <th className="text-left text-base font-medium text-gray-500 px-6 py-4 hidden md:table-cell">Plano</th>
                  <th className="text-left text-base font-medium text-gray-500 px-6 py-4">Valor</th>
                  <th className="text-left text-base font-medium text-gray-500 px-6 py-4">Status</th>
                  <th className="text-right text-base font-medium text-gray-500 px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {contracts.map((ct) => (
                  <tr key={ct.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-base font-mono font-medium text-red-400">{ct.contract_number}</p>
                      <p className="text-sm text-gray-400">{new Date(ct.created_at).toLocaleDateString('pt-BR')}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/clients/${ct.client_id}`} className="text-base font-medium hover:text-red-400">
                        {ct.company_name}
                      </Link>
                      <p className="text-sm text-gray-500">{ct.contact_name}</p>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="text-base text-gray-600">{PLAN_LABELS[ct.plan_type] || ct.plan_type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-base font-medium">
                        R$ {Number(ct.final_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {ct.discount_percent > 0 && (
                        <p className="text-sm text-green-600">-{ct.discount_percent}%</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={ct.status}
                        onChange={(e) => handleStatusUpdate(ct.id, e.target.value)}
                        className="text-sm border border-white/[0.06] rounded-lg px-3 py-2 focus:ring-1 focus:ring-red-500 outline-none"
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Link
                          to={`/contracts/${ct.id}`}
                          className="p-2.5 text-gray-400 hover:text-red-400 rounded hover:bg-red-500/10"
                          title="Ver detalhes"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={() => handleDownloadPdf(ct.id, ct.contract_number)}
                          className="p-2.5 text-gray-400 hover:text-red-400 rounded hover:bg-red-500/10"
                          title="Download PDF"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(ct.id, ct.contract_number)}
                          className="p-2.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-500/10"
                          title="Remover"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.04]">
              <span className="text-sm text-gray-500">Página {page} de {totalPages} ({total} contratos)</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-white/[0.03] flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-white/[0.03] flex items-center gap-1">
                  Próxima <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-16 text-center">
          <FileText className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">Nenhum contrato encontrado</p>
          <Link to="/contracts/new" className="text-lg text-red-400 hover:text-red-300 mt-2 inline-block">
            Gerar primeiro contrato →
          </Link>
        </div>
      )}
    </div>
  );
}
