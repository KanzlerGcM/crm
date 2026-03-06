import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useRealtimeRefresh } from '@/contexts/SocketContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  ArrowLeft, Download, Trash2, Building2, User, Mail, Phone,
  DollarSign, Calendar, Clock, Edit3, Receipt, FileText,
} from 'lucide-react';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, formatCurrency } from '@/lib/constants';
import type { Invoice } from '@/lib/types';

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX', boleto: 'Boleto', cartao: 'Cartão', transferencia: 'Transferência', dinheiro: 'Dinheiro',
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  const fetchInvoice = useCallback(() => {
    api.invoices.get(Number(id))
      .then(setInvoice)
      .catch(() => {
        toast.error('Nota fiscal não encontrada');
        navigate('/invoices');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);
  useRealtimeRefresh(['invoice'], fetchInvoice);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.invoices.update(Number(id), { status: newStatus });
      if (invoice) setInvoice({ ...invoice, status: newStatus as Invoice['status'] });
      toast.success('Status atualizado');
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDelete = async () => {
    try {
      await api.invoices.delete(Number(id));
      toast.success('Nota fiscal removida');
      navigate('/invoices');
    } catch {
      toast.error('Erro ao remover nota fiscal');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      await api.invoices.downloadPdf(Number(id));
      toast.success('PDF baixado');
    } catch {
      toast.error('Erro ao gerar PDF');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!invoice) return null;

  const statusColor = INVOICE_STATUS_COLORS[invoice.status] || 'bg-white/[0.04] text-gray-200';

  return (
    <div className="space-y-6 animate-fade-in">
      <ConfirmDialog
        open={showDelete}
        title="Remover Nota Fiscal"
        message={`Deseja remover a nota ${invoice.invoice_number}? Esta ação não pode ser desfeita.`}
        confirmText="Remover"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link to="/invoices" className="p-2.5 rounded-lg hover:bg-white/[0.04] mt-0.5">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold font-mono">{invoice.invoice_number}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
                {INVOICE_STATUS_LABELS[invoice.status] || invoice.status}
              </span>
            </div>
            <p className="text-base text-gray-500 mt-1">
              Emitida em {new Date(invoice.issue_date).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-9 sm:ml-0">
          <Link to={`/invoices/${id}/edit`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-300 rounded-lg hover:bg-red-500/15 font-medium text-sm">
            <Edit3 className="w-4 h-4" /> Editar
          </Link>
          <button onClick={handleDownloadPdf} className="btn-primary">
            <Download className="w-5 h-5" /> PDF
          </button>
          <button onClick={() => setShowDelete(true)} className="btn-danger">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {invoice.description && (
            <div className="card p-7 space-y-4">
              <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-400" />
                Descrição
              </h2>
              <p className="text-base text-gray-300">{invoice.description}</p>
            </div>
          )}

          {/* Items Table */}
          <div className="card p-7 space-y-4">
            <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-red-400" />
              Itens da Nota
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-sm font-medium text-gray-500 pb-3">Descrição</th>
                    <th className="text-right text-sm font-medium text-gray-500 pb-3 w-20">Qtd</th>
                    <th className="text-right text-sm font-medium text-gray-500 pb-3 w-32">Valor Unit.</th>
                    <th className="text-right text-sm font-medium text-gray-500 pb-3 w-32">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item, idx) => (
                    <tr key={idx} className="border-b border-white/[0.04] last:border-0">
                      <td className="py-3 text-base text-white">{item.description}</td>
                      <td className="py-3 text-base text-gray-300 text-right">{item.quantity}</td>
                      <td className="py-3 text-base text-gray-300 text-right">{formatCurrency(item.unit_price, 2)}</td>
                      <td className="py-3 text-base font-medium text-white text-right">{formatCurrency(item.total, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financials */}
          <div className="card p-7 space-y-4">
            <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-red-400" />
              Resumo Financeiro
            </h2>
            <div className="space-y-3 max-w-sm ml-auto">
              <div className="flex justify-between text-base">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal, 2)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-base">
                  <span className="text-gray-500">Desconto</span>
                  <span className="font-medium text-red-600">- {formatCurrency(invoice.discount, 2)}</span>
                </div>
              )}
              {invoice.tax_rate > 0 && (
                <div className="flex justify-between text-base">
                  <span className="text-gray-500">Imposto ({invoice.tax_rate}%)</span>
                  <span className="font-medium">{formatCurrency(invoice.tax_amount, 2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold border-t pt-3">
                <span className="text-white">Total</span>
                <span className="text-red-400">{formatCurrency(invoice.total, 2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="card p-7 space-y-4">
              <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Observações
              </h2>
              <p className="text-base text-gray-600 whitespace-pre-wrap bg-[#111318] rounded-lg p-4">
                {invoice.notes}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client Info */}
          <div className="card p-7 space-y-5">
            <h2 className="text-lg font-semibold text-gray-300">Cliente</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center">
                  <span className="text-base font-bold text-white">{invoice.company_name?.charAt(0)}</span>
                </div>
                <div>
                  <Link to={`/clients/${invoice.client_id}`} className="text-lg font-semibold hover:text-red-400">
                    {invoice.company_name}
                  </Link>
                  <p className="text-base text-gray-500">{invoice.contact_name}</p>
                </div>
              </div>
            </div>
            {invoice.contract_id && (
              <div className="pt-3 border-t">
                <p className="text-sm text-gray-500 mb-1">Contrato Vinculado</p>
                <Link to={`/contracts/${invoice.contract_id}`} className="text-base font-medium text-red-400 hover:underline">
                  {invoice.contract_number || `#${invoice.contract_id}`}
                </Link>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="card p-7 space-y-4">
            <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-red-400" />
              Datas & Pagamento
            </h2>
            <div className="space-y-3 text-base">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-gray-500 text-sm">Emissão</p>
                  <p className="font-medium">{new Date(invoice.issue_date).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              {invoice.due_date && (
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-gray-500 text-sm">Vencimento</p>
                    <p className="font-medium">{new Date(invoice.due_date).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              )}
              {invoice.paid_date && (
                <div className="flex items-center gap-3">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-gray-500 text-sm">Data Pagamento</p>
                    <p className="font-medium text-green-400">{new Date(invoice.paid_date).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              )}
              {invoice.payment_method && (
                <div className="flex items-center gap-3">
                  <CreditCardIcon className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-gray-500 text-sm">Pagamento</p>
                    <p className="font-medium">{PAYMENT_LABELS[invoice.payment_method] || invoice.payment_method}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Change */}
          <div className="card p-7 space-y-4">
            <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-400" />
              Alterar Status
            </h2>
            <select
              value={invoice.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-4 py-3 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none"
            >
              {Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="space-y-2">
              {['draft', 'issued', 'paid', 'overdue', 'cancelled'].map((status) => (
                <div key={status} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    invoice.status === status ? 'bg-red-500 ring-2 ring-red-500/40' : 'bg-white/20'
                  }`} />
                  <span className={`text-sm ${
                    invoice.status === status ? 'text-red-300 font-medium' : 'text-gray-400'
                  }`}>
                    {INVOICE_STATUS_LABELS[status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple credit card icon wrapper to avoid import conflict
function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
