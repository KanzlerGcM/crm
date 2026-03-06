import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useRealtimeRefresh } from '@/contexts/SocketContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  Receipt, Download, Search, Plus, Trash2, Eye, ChevronLeft, ChevronRight,
  FileText, DollarSign, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, formatCurrency } from '@/lib/constants';
import type { Invoice } from '@/lib/types';

interface InvoiceStats {
  total: number;
  issued: number;
  totalPaid: number;
  totalPending: number;
  overdue: number;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; number: string } | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.invoices.list(params);
      setInvoices(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const fetchStats = async () => {
    try {
      setStats(await api.invoices.stats());
    } catch { /* silent */ }
  };

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchStats(); }, []);
  useRealtimeRefresh(['invoice'], () => { fetchInvoices(); fetchStats(); });

  const handleSearch = () => {
    setPage(1);
    fetchInvoices();
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await api.invoices.update(id, { status });
      toast.success(`Status atualizado para ${INVOICE_STATUS_LABELS[status]}`);
      fetchInvoices();
      fetchStats();
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDownloadPdf = async (id: number, invoiceNumber: string) => {
    try {
      await api.invoices.downloadPdf(id);
      toast.success(`PDF da nota ${invoiceNumber} baixado`);
    } catch {
      toast.error('Erro ao baixar PDF');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.invoices.delete(deleteTarget.id);
      toast.success(`Nota fiscal ${deleteTarget.number} removida`);
      fetchInvoices();
      fetchStats();
    } catch {
      toast.error('Erro ao remover nota fiscal');
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remover nota fiscal"
        message={`Deseja remover a nota fiscal ${deleteTarget?.number}? Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmText="Remover"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Receipt className="w-8 h-8 text-red-400" />
            Notas Fiscais
          </h1>
          <p className="text-gray-400 mt-1">{total} nota(s) fiscal(is)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => api.invoices.exportCsv().catch(() => toast.error('Erro ao exportar'))}
            className="inline-flex items-center gap-2 px-4 py-3 border border-white/[0.08] rounded-lg hover:bg-white/[0.03] transition-colors font-medium"
            title="Exportar CSV">
            <Download className="w-5 h-5" /> CSV
          </button>
          <Link
            to="/invoices/new"
            className="inline-flex items-center gap-2.5 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-lg font-medium"
          >
            <Plus className="w-6 h-6" /> Nova Nota Fiscal
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Total Emitidas</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-gray-500">Total Recebido</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalPaid, 2)}</p>
          </div>
          <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-gray-500">Pendente</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.totalPending, 2)}</p>
          </div>
          <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-gray-500">Vencidas</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar por número, empresa ou descrição..."
              className="w-full pl-12 pr-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none">
            <option value="">Todos os status</option>
            {Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => (
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
      ) : invoices.length > 0 ? (
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                  <th className="text-left text-base font-medium text-gray-500 px-6 py-4">Nº Nota</th>
                  <th className="text-left text-base font-medium text-gray-500 px-6 py-4">Cliente</th>
                  <th className="text-left text-base font-medium text-gray-500 px-6 py-4 hidden md:table-cell">Emissão</th>
                  <th className="text-left text-base font-medium text-gray-500 px-6 py-4 hidden lg:table-cell">Vencimento</th>
                  <th className="text-right text-base font-medium text-gray-500 px-6 py-4">Total</th>
                  <th className="text-left text-base font-medium text-gray-500 px-6 py-4">Status</th>
                  <th className="text-right text-base font-medium text-gray-500 px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-base font-mono font-medium text-red-400">{inv.invoice_number}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/clients/${inv.client_id}`} className="text-base font-medium hover:text-red-400">
                        {inv.company_name}
                      </Link>
                      <p className="text-sm text-gray-500">{inv.contact_name}</p>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="text-base text-gray-600">
                        {inv.issue_date ? new Date(inv.issue_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className={`text-base ${inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'paid' && inv.status !== 'cancelled' ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {inv.due_date ? new Date(inv.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-base font-medium">
                        {formatCurrency(inv.total, 2)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={inv.status}
                        onChange={(e) => handleStatusUpdate(inv.id, e.target.value)}
                        className={`text-sm border rounded-lg px-3 py-2 focus:ring-1 focus:ring-red-500 outline-none ${INVOICE_STATUS_COLORS[inv.status] || ''}`}
                      >
                        {Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="p-2.5 text-gray-400 hover:text-red-400 rounded hover:bg-red-500/10"
                          title="Ver detalhes"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                          className="p-2.5 text-gray-400 hover:text-red-400 rounded hover:bg-red-500/10"
                          title="Download PDF"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: inv.id, number: inv.invoice_number })}
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
              <span className="text-sm text-gray-500">Página {page} de {totalPages} ({total} notas)</span>
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
          <Receipt className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">Nenhuma nota fiscal encontrada</p>
          <Link to="/invoices/new" className="text-lg text-red-400 hover:text-red-300 mt-2 inline-block">
            Emitir primeira nota fiscal →
          </Link>
        </div>
      )}
    </div>
  );
}
