import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useRealtimeRefresh } from '@/contexts/SocketContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, TrendingUp, AlertTriangle, CheckCircle, Clock,
  Plus, RefreshCw, CreditCard, ArrowRight, Trash2, Check,
  FileText, Building2, Download,
} from 'lucide-react';
import {
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, MONTH_NAMES, formatCurrency,
} from '@/lib/constants';
import type { Payment, PaymentStats, Contract } from '@/lib/types';

const STATUS_LABELS = PAYMENT_STATUS_LABELS;
const STATUS_COLORS = PAYMENT_STATUS_COLORS;

export default function Financial() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedContract, setSelectedContract] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const toast = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.status = filter;
      const [paymentsData, statsData, contractsData] = await Promise.all([
        api.payments.list(params),
        api.payments.stats(),
        api.contracts.list({ limit: '500' }),
      ]);
      setPayments(paymentsData.data);
      setStats(statsData);
      setContracts(contractsData.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);
  useRealtimeRefresh(['payment', 'contract'], fetchData);

  const handleMarkPaid = async (id: number) => {
    try {
      await api.payments.update(id, { status: 'paid' });
      toast.success('Pagamento confirmado');
      fetchData();
    } catch {
      toast.error('Erro ao confirmar pagamento');
    }
  };

  const handleGenerateInstallments = async () => {
    if (!selectedContract) return;
    try {
      const result = await api.payments.generate(Number(selectedContract));
      toast.success(result.message);
      setShowGenerate(false);
      setSelectedContract('');
      fetchData();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao gerar parcelas');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.payments.delete(deleteTarget);
      toast.success('Pagamento removido');
      fetchData();
    } catch {
      toast.error('Erro ao remover');
    }
    setDeleteTarget(null);
  };

  const isOverdue = (date: string, status: string) => status === 'pending' && new Date(date) < new Date(new Date().toISOString().split('T')[0]);

  const monthlyData = stats?.monthly?.map((m) => ({
    name: (() => { const [y, mo] = m.month.split('-'); return `${MONTH_NAMES[parseInt(mo) - 1]}/${y.slice(2)}`; })(),
    valor: m.total,
  })) || [];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <ConfirmDialog open={!!deleteTarget} title="Remover Pagamento"
        message="Deseja remover este registro de pagamento?" confirmText="Remover" variant="danger"
        onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-red-400" />
            Financeiro
          </h1>
          <p className="text-gray-400 mt-1">Controle de pagamentos e receitas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => api.payments.exportCsv().catch(() => toast.error('Erro ao exportar'))} className="btn-secondary" title="Exportar CSV">
            <Download className="w-5 h-5" />CSV
          </button>
          <button onClick={() => setShowGenerate(!showGenerate)} className="btn-secondary">
            <Plus className="w-5 h-5" />Gerar Parcelas
          </button>
          <button onClick={fetchData} className="btn-secondary"><RefreshCw className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">
          <CheckCircle className="w-6 h-6 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-green-400">{formatCurrency(stats?.totalReceived || 0)}</p>
          <p className="text-sm text-green-500">Recebido ({stats?.countPaid || 0})</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
          <Clock className="w-6 h-6 text-amber-500 mb-2" />
          <p className="text-2xl font-bold text-amber-400">{formatCurrency(stats?.totalPending || 0)}</p>
          <p className="text-sm text-amber-500">A Receber ({stats?.countPending || 0})</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
          <AlertTriangle className="w-6 h-6 text-red-500 mb-2" />
          <p className="text-2xl font-bold text-red-400">{formatCurrency(stats?.totalOverdue || 0)}</p>
          <p className="text-sm text-red-500">Em Atraso ({stats?.countOverdue || 0})</p>
        </div>
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-5">
          <TrendingUp className="w-6 h-6 text-violet-500 mb-2" />
          <p className="text-2xl font-bold text-violet-400">
            {formatCurrency((stats?.totalReceived || 0) + (stats?.totalPending || 0))}
          </p>
          <p className="text-sm text-violet-500">Total Geral</p>
        </div>
      </div>

      {/* Revenue Chart */}
      {monthlyData.length > 0 && (
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-red-400" />Receita Mensal (pagos)
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number | string | undefined) => [formatCurrency(Number(v || 0)), 'Valor']} />
              <Bar dataKey="valor" fill="#0077FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Generate Installments */}
      {showGenerate && (
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-6 animate-slide-in">
          <h3 className="text-lg font-semibold mb-3">Gerar Parcelas de Contrato</h3>
          <p className="text-sm text-gray-500 mb-4">Selecione um contrato para gerar automaticamente as parcelas com base no valor e nÃºmero de parcelas.</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-base font-medium text-gray-600 mb-1.5">Contrato</label>
              <select value={selectedContract} onChange={e => setSelectedContract(e.target.value)} className="input-base">
                <option value="">Selecione um contrato...</option>
                {contracts.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.contract_number} â€” {ct.company_name} â€” R$ {Number(ct.final_value).toLocaleString('pt-BR')} ({ct.installments}x)
                  </option>
                ))}
              </select>
            </div>
            <button onClick={handleGenerateInstallments} disabled={!selectedContract} className="btn-primary whitespace-nowrap">
              Gerar Parcelas
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: 'all', label: 'Todos' },
          { value: 'pending', label: 'Pendentes' },
          { value: 'paid', label: 'Pagos' },
        ].map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-base font-medium transition-colors ${
              filter === f.value ? 'bg-red-600 text-white' : 'bg-[#14171D] border border-white/[0.06] text-gray-600 hover:bg-white/[0.03]'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Payments List */}
      {payments.length > 0 ? (
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                  <th className="text-left text-sm font-medium text-gray-500 px-5 py-3">Cliente</th>
                  <th className="text-left text-sm font-medium text-gray-500 px-5 py-3">Contrato</th>
                  <th className="text-left text-sm font-medium text-gray-500 px-5 py-3">Parcela</th>
                  <th className="text-left text-sm font-medium text-gray-500 px-5 py-3">Valor</th>
                  <th className="text-left text-sm font-medium text-gray-500 px-5 py-3">Vencimento</th>
                  <th className="text-left text-sm font-medium text-gray-500 px-5 py-3">Status</th>
                  <th className="text-right text-sm font-medium text-gray-500 px-5 py-3">AÃ§Ãµes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {payments.map((p) => {
                  const overdue = isOverdue(p.due_date, p.status);
                  return (
                    <tr key={p.id} className={`hover:bg-white/[0.02] transition-colors ${overdue ? 'bg-red-500/5' : ''}`}>
                      <td className="px-5 py-3">
                        <Link to={`/clients/${p.client_id}`} className="text-sm font-medium hover:text-red-400 flex items-center gap-1">
                          <Building2 className="w-4 h-4 text-gray-400" />{p.company_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm font-mono text-red-400">{p.contract_number}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">{p.installment_number}Âª</td>
                      <td className="px-5 py-3">
                        <span className="text-sm font-bold">{formatCurrency(p.amount)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-sm ${overdue ? 'text-red-400 font-medium' : 'text-gray-600'}`}>
                          {new Date(p.due_date).toLocaleDateString('pt-BR')}
                        </span>
                        {overdue && <span className="ml-1 text-xs text-red-500">(atrasado)</span>}
                        {p.paid_date && <p className="text-xs text-green-400">Pago: {new Date(p.paid_date).toLocaleDateString('pt-BR')}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[p.status]}`}>
                          {STATUS_LABELS[p.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          {p.status === 'pending' && (
                            <button onClick={() => handleMarkPaid(p.id)}
                              className="p-2 text-gray-400 hover:text-green-400 rounded hover:bg-green-500/10" title="Marcar como pago">
                              <Check className="w-5 h-5" />
                            </button>
                          )}
                          <button onClick={() => setDeleteTarget(p.id)}
                            className="p-2 text-gray-400 hover:text-red-400 rounded hover:bg-red-500/10" title="Remover">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-12 text-center">
          <CreditCard className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <p className="text-lg text-gray-500">Nenhum pagamento registrado</p>
          <button onClick={() => setShowGenerate(true)} className="text-lg text-red-400 hover:text-red-300 mt-2">
            Gerar parcelas de um contrato â†’
          </button>
        </div>
      )}
    </div>
  );
}


