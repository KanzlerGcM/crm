import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useRealtimeRefresh, useSocket } from '@/contexts/SocketContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  ArrowLeft, Edit, Phone, Mail, Globe, MapPin, Building2,
  MessageCircle, PhoneCall, Calendar, FileText, Plus, Clock,
  Download, Send, Trash2,
} from 'lucide-react';
import { STATUS_LABELS, INTEREST_LABELS, PRIORITY_LABELS } from '@/lib/constants';
import type { Client, Contract, Interaction } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';

const INTERACTION_ICONS: Record<string, LucideIcon> = {
  call: PhoneCall, email: Mail, whatsapp: MessageCircle,
  meeting: Calendar, note: FileText, proposal: Send,
};
const INTERACTION_LABELS: Record<string, string> = {
  call: 'Ligação', email: 'E-mail', whatsapp: 'WhatsApp',
  meeting: 'Reunião', note: 'Nota', proposal: 'Proposta',
};
const CONTRACT_STATUS: Record<string, string> = {
  draft: 'Rascunho', sent: 'Enviado', signed: 'Assinado',
  in_progress: 'Em Andamento', delivered: 'Entregue', completed: 'Concluído', cancelled: 'Cancelado',
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [client, setClient] = useState<(Client & { interactions?: Interaction[]; contracts?: Contract[]; emailsSent?: Array<{ id: number; to_address: string; subject: string; sent_at: string }> }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [interactionForm, setInteractionForm] = useState({
    type: 'note', description: '', next_follow_up: '',
  });
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [deleteInteraction, setDeleteInteraction] = useState<number | null>(null);

  const fetchClient = async () => {
    try {
      const data = await api.clients.get(Number(id));
      setClient(data);
    } catch {
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClient(); }, [id]);
  useRealtimeRefresh(['client'], fetchClient);

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInteraction(true);
    try {
      await api.clients.addInteraction(Number(id), {
        ...interactionForm,
        next_follow_up: interactionForm.next_follow_up || null,
      });
      setInteractionForm({ type: 'note', description: '', next_follow_up: '' });
      setShowInteractionForm(false);
      toast.success('Interação registrada');
      fetchClient();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao salvar interação');
    } finally {
      setSavingInteraction(false);
    }
  };

  const handleDeleteInteraction = async () => {
    if (!deleteInteraction) return;
    try {
      await api.clients.deleteInteraction(Number(id), deleteInteraction);
      toast.success('Interação removida');
      fetchClient();
    } catch {
      toast.error('Erro ao remover interação');
    } finally {
      setDeleteInteraction(null);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.clients.update(Number(id), { status: newStatus });
      toast.success('Status atualizado', `Alterado para ${STATUS_LABELS[newStatus]}`);
      fetchClient();
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDownloadPdf = async (contractId: number) => {
    try {
      await api.contracts.downloadPdf(contractId);
      toast.success('PDF baixado');
    } catch {
      toast.error('Erro ao gerar PDF');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin w-6 h-6 border-[3px] border-red-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!client) return null;

  const whatsappLink = client.phone
    ? `https://wa.me/55${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${client.contact_name}! Aqui é da Chevla. Tudo bem?`)}`
    : '';

  return (
    <div className="space-y-6 animate-fade-in">
      <ConfirmDialog
        open={!!deleteInteraction}
        title="Remover Interação"
        message="Deseja remover esta interação do histórico?"
        confirmText="Remover"
        variant="danger"
        onConfirm={handleDeleteInteraction}
        onCancel={() => setDeleteInteraction(null)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link to="/clients" className="p-2.5 rounded-lg hover:bg-white/[0.04] mt-0.5">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold">{client.company_name}</h1>
              <span className={`badge badge-${client.status}`}>
                {STATUS_LABELS[client.status]}
              </span>
              <span className={`badge priority-${client.priority}`}>
                {PRIORITY_LABELS[client.priority]}
              </span>
            </div>
            <p className="text-lg text-gray-500 mt-1">{client.contact_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-9 sm:ml-0">
          <Link to={`/clients/${id}/edit`}
            className="inline-flex items-center gap-2 px-5 py-3 border border-white/[0.08] rounded-lg text-lg hover:bg-white/[0.03]">
            <Edit className="w-5 h-5" /> Editar
          </Link>
          <Link to={`/contracts/new?client_id=${id}`}
            className="inline-flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-lg text-lg hover:bg-red-700">
            <FileText className="w-5 h-5" /> Gerar Contrato
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Client Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-7 space-y-5">
            <h2 className="text-lg font-semibold text-gray-300">Informações</h2>

            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-6 h-6 text-gray-400" />
                <div>
                  <p className="text-lg">{client.phone}</p>
                  {whatsappLink && (
                    <a href={whatsappLink} target="_blank" rel="noopener" className="text-base text-green-600 hover:underline flex items-center gap-1">
                      <MessageCircle className="w-5 h-5" /> Abrir WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-6 h-6 text-gray-400" />
                <a href={`mailto:${client.email}`} className="text-lg text-red-400 hover:underline">{client.email}</a>
              </div>
            )}
            {client.website && (
              <div className="flex items-center gap-3">
                <Globe className="w-6 h-6 text-gray-400" />
                <a href={client.website} target="_blank" rel="noopener" className="text-lg text-red-400 hover:underline">{client.website}</a>
              </div>
            )}
            {client.cnpj && (
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-gray-400" />
                <p className="text-lg">{client.cnpj}</p>
              </div>
            )}
            {(client.address || client.city) && (
              <div className="flex items-start gap-3">
                <MapPin className="w-6 h-6 text-gray-400 mt-0.5" />
                <p className="text-lg">
                  {[client.address, client.city, client.state].filter(Boolean).join(', ')}
                </p>
              </div>
            )}

            <hr className="border-white/[0.04]" />

            <div>
              <p className="text-base text-gray-500 mb-1">Interesse</p>
              <p className="text-lg font-medium">{(client.interest && INTEREST_LABELS[client.interest]) || 'Não definido'}</p>
            </div>
            {client.estimated_value && (
              <div>
                <p className="text-base text-gray-500 mb-1">Valor Estimado</p>
                <p className="text-lg font-medium text-green-600">
                  R$ {Number(client.estimated_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
            {client.source && (
              <div>
                <p className="text-base text-gray-500 mb-1">Origem</p>
                <p className="text-lg">{client.source}</p>
              </div>
            )}
            {client.notes && (
              <div>
                <p className="text-base text-gray-500 mb-1">Notas</p>
                <p className="text-lg text-gray-600 whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}

            <hr className="border-white/[0.04]" />

            <div>
              <p className="text-base text-gray-500 mb-2">Alterar Status</p>
              <select
                value={client.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none"
              >
                <option value="prospect">Prospect</option>
                <option value="contacted">Contactado</option>
                <option value="negotiating">Negociando</option>
                <option value="proposal_sent">Proposta Enviada</option>
                <option value="client">Cliente</option>
                <option value="lost">Perdido</option>
              </select>
            </div>
          </div>

          {/* Contracts */}
          {(client.contracts?.length ?? 0) > 0 && (
            <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-7">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">Contratos</h2>
              <div className="space-y-3">
                {client.contracts?.map((ct) => (
                  <div key={ct.id} className="flex items-center justify-between p-4 bg-[#111318] rounded-lg">
                    <div>
                      <p className="text-lg font-medium">{ct.contract_number}</p>
                      <p className="text-base text-gray-500">
                        R$ {Number(ct.final_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${ct.status === 'completed' ? 'badge-client' : ct.status === 'cancelled' ? 'badge-lost' : 'badge-negotiating'}`}>
                        {CONTRACT_STATUS[ct.status] || ct.status}
                      </span>
                      <button
                        onClick={() => handleDownloadPdf(ct.id)}
                        className="p-2 text-gray-400 hover:text-red-400 rounded"
                        title="Download PDF"
                      >
                        <Download className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timeline / Interactions */}
        <div className="lg:col-span-2">
          <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-300">Histórico de Interações</h2>
              <button
                onClick={() => setShowInteractionForm(!showInteractionForm)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-300 rounded-lg text-base font-medium hover:bg-red-500/15"
              >
                <Plus className="w-5 h-5" />
                Nova Interação
              </button>
            </div>

            {/* Add Interaction Form */}
            {showInteractionForm && (
              <form onSubmit={handleAddInteraction} className="mb-6 p-5 bg-[#111318] rounded-xl space-y-4 animate-slide-in">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-medium text-gray-600 mb-1.5">Tipo</label>
                    <select
                      value={interactionForm.type}
                      onChange={(e) => setInteractionForm({ ...interactionForm, type: e.target.value })}
                      className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none"
                    >
                      <option value="note">Nota</option>
                      <option value="call">Ligação</option>
                      <option value="email">E-mail</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="meeting">Reunião</option>
                      <option value="proposal">Proposta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-base font-medium text-gray-600 mb-1.5">Próximo Follow-up</label>
                    <input
                      type="date"
                      value={interactionForm.next_follow_up}
                      onChange={(e) => setInteractionForm({ ...interactionForm, next_follow_up: e.target.value })}
                      className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-600 mb-1.5">Descrição *</label>
                  <textarea
                    value={interactionForm.description}
                    onChange={(e) => setInteractionForm({ ...interactionForm, description: e.target.value })}
                    required rows={3}
                    className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none resize-none"
                    placeholder="Descreva o que aconteceu nesta interação..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowInteractionForm(false)}
                    className="px-5 py-2.5 border border-white/[0.08] rounded-lg text-base hover:bg-white/[0.03]">
                    Cancelar
                  </button>
                  <button type="submit" disabled={savingInteraction}
                    className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-base hover:bg-red-700 disabled:opacity-50">
                    {savingInteraction ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            )}

            {/* Timeline */}
            {(client.interactions?.length ?? 0) > 0 ? (
              <div className="space-y-4">
                {client.interactions?.map((interaction, idx) => {
                  const Icon = INTERACTION_ICONS[interaction.type] || FileText;
                  return (
                    <div key={interaction.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-red-400" />
                        </div>
                        {idx < (client.interactions?.length ?? 0) - 1 && (
                          <div className="w-px flex-1 bg-white/10 mt-2" />
                        )}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-base font-medium text-red-300 bg-red-500/10 px-3 py-0.5 rounded">
                              {INTERACTION_LABELS[interaction.type] || interaction.type}
                            </span>
                            <span className="text-base text-gray-400">
                              {new Date(interaction.created_at).toLocaleString('pt-BR')}
                            </span>
                            {interaction.user_name && (
                              <span className="text-base text-gray-400">por {interaction.user_name}</span>
                            )}
                          </div>
                          <button
                            onClick={() => setDeleteInteraction(interaction.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded hover:bg-red-500/10 transition-colors"
                            title="Remover interação"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        <p className="text-lg text-gray-300 whitespace-pre-wrap">{interaction.description}</p>
                        {interaction.next_follow_up && (
                          <div className="flex items-center gap-1.5 mt-2 text-base text-amber-600">
                            <Clock className="w-5 h-5" />
                            Follow-up: {new Date(interaction.next_follow_up).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-lg text-gray-400">Nenhuma interação registrada</p>
                <button
                  onClick={() => setShowInteractionForm(true)}
                  className="text-lg text-red-400 hover:text-red-300 mt-2"
                >
                  Registrar primeira interação →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
