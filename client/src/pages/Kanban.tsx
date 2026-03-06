import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useRealtimeRefresh } from '@/contexts/SocketContext';
import {
  Columns3, Phone, Mail, MessageCircle, Building2,
  ArrowRight, GripVertical, DollarSign, RefreshCw,
} from 'lucide-react';
import { PIPELINE_STAGES } from '@/lib/constants';
import type { Client } from '@/lib/types';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500/30', medium: 'bg-red-500/30', high: 'bg-orange-500/40', urgent: 'bg-red-500/50',
};

export default function Kanban() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragItem, setDragItem] = useState<Client | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const toast = useToast();

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await api.clients.list({ limit: '500' });
      setClients(data.data);
    } catch {
      toast.error('Erro ao carregar pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);
  useRealtimeRefresh(['client'], fetchClients);

  // Memoize clients grouped by stage to avoid recalculating on every render
  const clientsByStage = useMemo(() => {
    const map: Record<string, Client[]> = {};
    for (const stage of PIPELINE_STAGES) {
      map[stage.key] = [];
    }
    for (const c of clients) {
      if (map[c.status]) {
        map[c.status].push(c);
      }
    }
    return map;
  }, [clients]);

  const totalsByStage = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [key, stageClients] of Object.entries(clientsByStage)) {
      map[key] = stageClients.reduce((sum, c) => sum + (c.estimated_value || 0), 0);
    }
    return map;
  }, [clientsByStage]);

  const handleDragStart = useCallback((e: React.DragEvent, client: Client) => {
    setDragItem(client);
    e.dataTransfer.effectAllowed = 'move';
    (e.target as HTMLElement).style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDragItem(null);
    setDragOverStage(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!dragItem || dragItem.status === stage) return;

    try {
      await api.clients.update(dragItem.id, { status: stage });
      setClients(prev => prev.map(c => c.id === dragItem.id ? { ...c, status: stage as Client['status'] } : c));
      toast.success(`${dragItem.company_name} movido para ${PIPELINE_STAGES.find(s => s.key === stage)?.label}`);
    } catch {
      toast.error('Erro ao mover cliente');
    }
  }, [dragItem, toast]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Columns3 className="w-8 h-8 text-red-400" />
            Pipeline Kanban
          </h1>
          <p className="text-gray-400 mt-1">Arraste e solte para mover clientes entre etapas</p>
        </div>
        <button onClick={fetchClients} className="btn-secondary">
          <RefreshCw className="w-5 h-5" />Atualizar
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto pb-4 print:flex-col" style={{ minHeight: '70vh' }}>
        {PIPELINE_STAGES.map((stage) => {
          const stageClients = clientsByStage[stage.key] || [];
          const totalValue = totalsByStage[stage.key] || 0;
          const isDragOver = dragOverStage === stage.key;

          return (
            <div
              key={stage.key}
              className={`flex-shrink-0 w-full lg:w-72 bg-[#111318] rounded-xl border-t-4 ${stage.color} ${
                isDragOver ? 'ring-2 ring-red-400 bg-red-500/5' : ''
              } transition-all print:break-inside-avoid`}
              onDragOver={(e) => handleDragOver(e, stage.key)}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => handleDrop(e, stage.key)}
            >
              {/* Column Header */}
              <div className="p-4 border-b border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-300">{stage.label}</h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${stage.bg} ${stage.textColor}`}>
                    {stageClients.length}
                  </span>
                </div>
                {totalValue > 0 && (
                  <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </p>
                )}
              </div>

              {/* Cards */}
              <div className="p-3 space-y-2 min-h-[200px]">
                {stageClients.map((client) => (
                  <div
                    key={client.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, client)}
                    onDragEnd={handleDragEnd}
                    className="bg-[#14171D] rounded-lg border border-white/[0.06] p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Link to={`/clients/${client.id}`} className="text-sm font-semibold text-white hover:text-red-400 block truncate">
                          {client.company_name}
                        </Link>
                        <p className="text-sm text-gray-500 truncate">{client.contact_name}</p>
                      </div>
                      <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Priority indicator */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[client.priority] || 'bg-white/20'}`} />
                      <span className="text-sm text-gray-400 capitalize">{client.priority || 'medium'}</span>
                      {client.estimated_value > 0 && (
                        <span className="text-xs text-green-600 font-medium ml-auto">
                          R$ {Number(client.estimated_value).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {client.phone && (
                        <a href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                          className="p-1 text-gray-400 hover:text-green-500 rounded" title="WhatsApp">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {client.phone && (
                        <a href={`tel:${client.phone}`} className="p-1 text-gray-400 hover:text-blue-500 rounded" title="Ligar">
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {client.email && (
                        <a href={`mailto:${client.email}`} className="p-1 text-gray-400 hover:text-blue-500 rounded" title="E-mail">
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <Link to={`/clients/${client.id}`} className="p-1 text-gray-400 hover:text-red-400 rounded ml-auto" title="Abrir">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}

                {stageClients.length === 0 && (
                  <div className="text-center py-8 text-gray-300">
                    <p className="text-sm">Vazio</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
