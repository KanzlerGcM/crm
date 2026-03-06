import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useRealtimeRefresh } from '@/contexts/SocketContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  ArrowLeft, Download, Trash2, Building2, User, Mail, Phone,
  FileText, DollarSign, Calendar, Clock, Edit3,
  FileCheck, FileX, Receipt, FilePlus, Send,
} from 'lucide-react';
import { CONTRACT_STATUS_LABELS as STATUS_LABELS, PLAN_LABELS } from '@/lib/constants';
import type { Contract } from '@/lib/types';

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX', credit_card: 'Cartão de Crédito', bank_transfer: 'Transferência Bancária',
};

export default function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  const fetchContract = useCallback(() => {
    api.contracts.get(Number(id))
      .then(setContract)
      .catch(() => {
        toast.error('Contrato não encontrado');
        navigate('/contracts');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchContract(); }, [fetchContract]);
  useRealtimeRefresh(['contract'], fetchContract);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.contracts.update(Number(id), { status: newStatus });
      if (contract) setContract({ ...contract, status: newStatus as Contract['status'] });
      toast.success('Status atualizado');
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDelete = async () => {
    try {
      await api.contracts.delete(Number(id));
      toast.success('Contrato removido');
      navigate('/contracts');
    } catch {
      toast.error('Erro ao remover contrato');
    }
  };

  const handleDownload = async (fn: (id: number) => Promise<void>, successMsg: string, errorMsg: string) => {
    try { await fn(Number(id)); toast.success(successMsg); }
    catch { toast.error(errorMsg); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!contract) return null;

  const isMaintenance = contract.plan_type?.includes('maintenance');

  return (
    <div className="space-y-6 animate-fade-in">
      <ConfirmDialog
        open={showDelete}
        title="Remover Contrato"
        message={`Deseja remover o contrato ${contract.contract_number}? Esta ação não pode ser desfeita.`}
        confirmText="Remover"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link to="/contracts" className="p-2.5 rounded-lg hover:bg-white/[0.04] mt-0.5">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold font-mono">{contract.contract_number}</h1>
              <span className={`badge badge-${contract.status}`}>
                {STATUS_LABELS[contract.status] || contract.status}
              </span>
            </div>
            <p className="text-base text-gray-500 mt-1">
              Criado em {new Date(contract.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-9 sm:ml-0">
          <button onClick={() => handleDownload(api.contracts.downloadPdf, 'PDF baixado', 'Erro ao gerar PDF')} className="btn-primary">
            <Download className="w-5 h-5" />
            PDF
          </button>
          <button onClick={() => setShowDelete(true)} className="btn-danger">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Service Details */}
          <div className="card p-7 space-y-5">
            <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-400" />
              Detalhes do Serviço
            </h2>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <p className="text-base text-gray-500">Plano</p>
                <p className="text-lg font-medium">{PLAN_LABELS[contract.plan_type] || contract.plan_type}</p>
              </div>
              <div>
                <p className="text-base text-gray-500">Tipo</p>
                <p className="text-lg font-medium">{isMaintenance ? 'Manutenção Mensal' : 'Criação de Site'}</p>
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div className="card p-7 space-y-5">
            <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-red-400" />
              Financeiro
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <div>
                <p className="text-base text-gray-500">Valor Base</p>
                <p className="text-lg font-medium">
                  R$ {Number(contract.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-base text-gray-500">Desconto</p>
                <p className="text-lg font-medium text-green-600">
                  {contract.discount_percent > 0 ? `${contract.discount_percent}%` : 'Sem desconto'}
                </p>
              </div>
              <div>
                <p className="text-base text-gray-500">Valor Final</p>
                <p className="text-2xl font-bold text-red-300">
                  R$ {Number(contract.final_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  {isMaintenance ? <span className="text-sm text-gray-500 font-normal">/mês</span> : ''}
                </p>
              </div>
              <div>
                <p className="text-base text-gray-500">Pagamento</p>
                <p className="text-lg font-medium">
                  {(contract.payment_method && PAYMENT_LABELS[contract.payment_method]) || contract.payment_method || 'Não definido'}
                  {contract.installments > 1 ? ` (${contract.installments}x)` : ''}
                </p>
              </div>
            </div>
            {contract.installments > 1 && (
              <div className="bg-red-500/10 rounded-lg p-4">
                <p className="text-base text-red-400">
                  {contract.installments}x de R$ {(contract.final_value / contract.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem juros
                </p>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="card p-7 space-y-5">
            <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-red-400" />
              Prazos
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {contract.start_date && (
                <div>
                  <p className="text-base text-gray-500">Início</p>
                  <p className="text-lg font-medium">{new Date(contract.start_date).toLocaleDateString('pt-BR')}</p>
                </div>
              )}
              {contract.delivery_date && (
                <div>
                  <p className="text-base text-gray-500">Entrega Prevista</p>
                  <p className="text-lg font-medium">{new Date(contract.delivery_date).toLocaleDateString('pt-BR')}</p>
                </div>
              )}
              <div>
                <p className="text-base text-gray-500">Última Atualização</p>
                <p className="text-lg font-medium">{new Date(contract.updated_at || contract.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </div>

          {/* Custom Clauses */}
          {contract.custom_clauses && (
            <div className="card p-7 space-y-4">
              <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-red-400" />
                Cláusulas Adicionais
              </h2>
              <p className="text-base text-gray-300 whitespace-pre-wrap">{contract.custom_clauses}</p>
            </div>
          )}

          {/* Internal Notes */}
          {contract.notes && (
            <div className="card p-7 space-y-4">
              <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Notas Internas
              </h2>
              <p className="text-base text-gray-600 whitespace-pre-wrap bg-[#111318] rounded-lg p-4">{contract.notes}</p>
            </div>
          )}

          {/* Documents */}
          <div className="card p-7 space-y-4">
            <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-400" />
              Documentos
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <button onClick={() => handleDownload(api.contracts.downloadPdf, 'PDF baixado', 'Erro ao gerar PDF')} className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.06] hover:border-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium text-gray-300">
                <Download className="w-4 h-4 text-red-400" /> Contrato
              </button>
              <button onClick={() => handleDownload(api.contracts.downloadProposal, 'Proposta baixada', 'Erro ao gerar proposta')} className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.06] hover:border-blue-400 hover:bg-blue-500/10 transition-colors text-sm font-medium text-gray-300">
                <Send className="w-4 h-4 text-blue-600" /> Proposta Comercial
              </button>
              <button onClick={() => handleDownload(api.contracts.downloadAcceptance, 'Termo baixado', 'Erro ao gerar termo')} className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.06] hover:border-green-400 hover:bg-green-500/10 transition-colors text-sm font-medium text-gray-300">
                <FileCheck className="w-4 h-4 text-green-600" /> Termo de Aceite
              </button>
              <button onClick={() => handleDownload(api.contracts.downloadAddendum, 'Aditivo baixado', 'Erro ao gerar aditivo')} className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.06] hover:border-amber-400 hover:bg-amber-500/10 transition-colors text-sm font-medium text-gray-300">
                <FilePlus className="w-4 h-4 text-amber-600" /> Aditivo
              </button>
              <button onClick={() => handleDownload(api.contracts.downloadTermination, 'Distrato baixado', 'Erro ao gerar distrato')} className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.06] hover:border-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium text-gray-300">
                <FileX className="w-4 h-4 text-red-600" /> Distrato
              </button>
              <button onClick={() => handleDownload(api.contracts.downloadReceipt, 'Recibo baixado', 'Erro ao gerar recibo')} className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.06] hover:border-violet-400 hover:bg-violet-500/10 transition-colors text-sm font-medium text-gray-300">
                <Receipt className="w-4 h-4 text-violet-600" /> Recibo
              </button>
              <button onClick={() => handleDownload(api.contracts.downloadBriefing, 'Briefing baixado', 'Erro ao gerar briefing')} className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.06] hover:border-teal-400 hover:bg-teal-500/10 transition-colors text-sm font-medium text-gray-300">
                <FileText className="w-4 h-4 text-teal-600" /> Briefing
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client Info */}
          <div className="card p-7 space-y-5">
            <h2 className="text-lg font-semibold text-gray-300">Cliente</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center">
                  <span className="text-base font-bold text-white">{contract.company_name?.charAt(0)}</span>
                </div>
                <div>
                  <Link to={`/clients/${contract.client_id}`} className="text-lg font-semibold hover:text-red-400">
                    {contract.company_name}
                  </Link>
                  <p className="text-base text-gray-500">{contract.contact_name}</p>
                </div>
              </div>
              {contract.phone && (
                <div className="flex items-center gap-2 text-base text-gray-600">
                  <Phone className="w-5 h-5 text-gray-400" />
                  {contract.phone}
                </div>
              )}
              {contract.email && (
                <div className="flex items-center gap-2 text-base text-gray-600">
                  <Mail className="w-5 h-5 text-gray-400" />
                  {contract.email}
                </div>
              )}
              {contract.cnpj && (
                <div className="flex items-center gap-2 text-base text-gray-600">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  {contract.cnpj}
                </div>
              )}
            </div>
          </div>

          {/* Status Change */}
          <div className="card p-7 space-y-4">
            <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-400" />
              Status do Contrato
            </h2>
            <select
              value={contract.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="input-base"
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="space-y-2">
              {['draft', 'sent', 'signed', 'in_progress', 'delivered', 'completed'].map((status) => (
                <div key={status} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    getStatusOrder(contract.status) >= getStatusOrder(status) ? 'bg-red-500' : 'bg-white/20'
                  }`} />
                  <span className={`text-sm ${
                    getStatusOrder(contract.status) >= getStatusOrder(status) ? 'text-red-300 font-medium' : 'text-gray-400'
                  }`}>
                    {STATUS_LABELS[status]}
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

function getStatusOrder(status: string): number {
  const order: Record<string, number> = {
    draft: 0, sent: 1, signed: 2, in_progress: 3, delivered: 4, completed: 5, cancelled: -1,
  };
  return order[status] ?? -1;
}
