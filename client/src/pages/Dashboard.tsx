import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useRealtimeRefresh } from '@/contexts/SocketContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import {
  Users, FileText, TrendingUp, Clock, Plus, ArrowRight,
  UserPlus, DollarSign, AlertCircle, CheckSquare, Bell,
  Target, Briefcase, CalendarDays, RefreshCw,
} from 'lucide-react';
import { SkeletonPage } from '@/components/Skeleton';
import {
  STATUS_LABELS, STATUS_COLORS, CONTRACT_STATUS_LABELS, PLAN_LABELS,
  CHART_COLORS, formatCurrency, formatMonth,
} from '@/lib/constants';
import type {
  ClientStats, DashboardData, NotificationData, TaskStats, Client,
} from '@/lib/types';

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1D23] border border-white/10 rounded-lg shadow-xl shadow-black/40 p-3 backdrop-blur-xl">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.dataKey === 'valor' ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

interface ChartItem { name: string; value: number; color?: string; total?: number }

export default function Dashboard() {
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [analytics, setAnalytics] = useState<DashboardData | null>(null);
  const [notifications, setNotifications] = useState<NotificationData | null>(null);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    Promise.allSettled([
      api.clients.stats(),
      api.clients.list({ sort: 'created_at', order: 'desc', limit: '5' }),
      api.analytics.dashboard(),
      api.analytics.notifications(),
      api.tasks.stats(),
    ]).then(([statsRes, clientsRes, analyticsRes, notifRes, taskRes]) => {
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (clientsRes.status === 'fulfilled') setRecentClients(clientsRes.value.data);
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value);
      if (notifRes.status === 'fulfilled') setNotifications(notifRes.value);
      if (taskRes.status === 'fulfilled') setTaskStats(taskRes.value);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeRefresh(['client', 'contract', 'task', 'payment'], loadData);

  if (loading) return <SkeletonPage />;

  const statusCounts = stats?.statusCounts;
  const contractStats = stats?.contractStats;
  const totalClients = statusCounts?.reduce((s, c) => s + c.count, 0) || 0;
  const activeClients = statusCounts?.find((s) => s.status === 'client')?.count || 0;
  const totalContracts = contractStats?.reduce((s, c) => s + c.count, 0) || 0;
  const totalContractValue = contractStats?.reduce((s, c) => s + c.total_value, 0) || 0;

  const cards = [
    { label: 'Total de Leads', value: totalClients, icon: Users, color: 'text-red-400', iconBg: 'bg-red-500/10 border border-red-500/20' },
    { label: 'Clientes Ativos', value: activeClients, icon: UserPlus, color: 'text-emerald-400', iconBg: 'bg-emerald-500/10 border border-emerald-500/20' },
    { label: 'Contratos', value: totalContracts, icon: FileText, color: 'text-violet-400', iconBg: 'bg-violet-500/10 border border-violet-500/20' },
    { label: 'Faturamento', value: formatCurrency(totalContractValue), icon: DollarSign, color: 'text-amber-400', iconBg: 'bg-amber-500/10 border border-amber-500/20' },
    { label: 'Tarefas Pendentes', value: taskStats?.pending || 0, icon: CheckSquare, color: 'text-orange-400', iconBg: 'bg-orange-500/10 border border-orange-500/20' },
    { label: 'Alertas', value: notifications?.counts?.total || 0, icon: Bell, color: 'text-red-400', iconBg: 'bg-red-500/10 border border-red-500/20' },
  ];

  const dashAny = analytics as Record<string, unknown> | null;
  const revenueData = (dashAny?.revenueByMonth as Array<{ month: string; total: number; count: number }> | undefined)?.map((m) => ({
    name: formatMonth(m.month), valor: m.total, contratos: m.count,
  })) || [];

  const clientsMonthData = (dashAny?.clientsByMonth as Array<{ month: string; count: number }> | undefined)?.map((m) => ({
    name: formatMonth(m.month), novos: m.count,
  })) || [];

  const funnelData: ChartItem[] = (dashAny?.funnel as Array<{ status: string; count: number }> | undefined)?.map((f) => ({
    name: STATUS_LABELS[f.status] || f.status, value: f.count,
    color: STATUS_COLORS[f.status] || '#94a3b8',
  })) || [];

  const serviceData: ChartItem[] = (dashAny?.serviceDistribution as Array<{ plan_type: string; count: number; total_value: number }> | undefined)?.map((s) => ({
    name: PLAN_LABELS[s.plan_type] || s.plan_type, value: s.count, total: s.total_value,
  })) || [];

  const contractStatusData: ChartItem[] = (dashAny?.contractsByStatus as Array<{ status: string; count: number }> | undefined)?.map((c) => ({
    name: CONTRACT_STATUS_LABELS[c.status] || c.status, value: c.count,
  })) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Central de Comando</h1>
          <p className="text-base text-gray-500 mt-0.5 font-mono uppercase tracking-wider">Visão geral · Prospector Chevla</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="btn-secondary" title="Atualizar"><RefreshCw className="w-4 h-4" /></button>
          <Link to="/tasks" className="btn-secondary"><CheckSquare className="w-4 h-4" />Tarefas</Link>
          <Link to="/clients/new" className="btn-primary"><Plus className="w-5 h-5" />Novo Lead</Link>
        </div>
      </div>

      {(notifications?.counts?.danger ?? 0) > 0 && (
        <Link to="/notifications" className="block bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4 hover:bg-red-500/10 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <Bell className="w-5 h-5 text-red-400 flex-shrink-0" />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-red-300">{notifications!.counts.danger} alerta(s) urgente(s)</p>
              <p className="text-sm text-red-400/60">Follow-ups atrasados, tarefas ou pagamentos pendentes</p>
            </div>
            <ArrowRight className="w-4 h-4 text-red-500/50" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 stagger-children">
        {cards.map((card) => (
          <div key={card.label} className="bg-[#14171D] rounded-xl p-4 border border-white/[0.06] hover:border-white/[0.1] transition-all group">
            <div className={`p-2 ${card.iconBg} rounded-lg w-fit mb-3`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-black text-white">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1 uppercase tracking-wider font-medium">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 stagger-children">
        <div className="bg-[#14171D] rounded-xl p-5 border border-white/[0.06]">
          <h2 className="text-base font-bold text-white mb-0.5 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-red-400" />Faturamento Mensal
          </h2>
          <p className="text-sm text-gray-500 mb-4">Valor dos contratos por mês</p>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF1744" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FF1744" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#6B7280' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 13, fill: '#6B7280' }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="valor" name="Valor" stroke="#FF1744" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-gray-600"><p className="text-sm">Sem dados de faturamento</p></div>
          )}
        </div>

        <div className="bg-[#14171D] rounded-xl p-5 border border-white/[0.06]">
          <h2 className="text-base font-bold text-white mb-0.5 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-violet-400" />Novos Leads por Mês
          </h2>
          <p className="text-sm text-gray-500 mb-4">Leads cadastrados por período</p>
          {clientsMonthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={clientsMonthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#6B7280' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 13, fill: '#6B7280' }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="novos" name="Novos Leads" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-gray-600"><p className="text-sm">Sem dados de leads</p></div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 stagger-children">
        <div className="bg-[#14171D] rounded-xl p-5 border border-white/[0.06]">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-red-400" />Funil de Vendas
          </h2>
          {funnelData.length > 0 ? (
            <div className="space-y-3">
              {funnelData.map((item) => {
                const max = Math.max(...funnelData.map((d) => d.value));
                const pct = max > 0 ? (item.value / max) * 100 : 0;
                return (
                  <div key={item.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400 font-medium">{item.name}</span>
                      <span className="font-bold text-white font-mono">{item.value}</span>
                    </div>
                    <div className="w-full bg-white/[0.04] rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8 text-sm">Sem dados</p>
          )}
        </div>

        <div className="bg-[#14171D] rounded-xl p-5 border border-white/[0.06]">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-cyan-400" />Serviços Contratados
          </h2>
          {serviceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={serviceData} cx="50%" cy="50%" outerRadius={75} innerRadius={38}
                  paddingAngle={3} dataKey="value" label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                  >
                  {serviceData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-600 text-center py-8 text-sm">Sem contratos</p>
          )}
        </div>

        <div className="bg-[#14171D] rounded-xl p-5 border border-white/[0.06]">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />Status dos Contratos
          </h2>
          {contractStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={contractStatusData} cx="50%" cy="50%" outerRadius={75} innerRadius={38}
                  paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}
                  labelLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                  >
                  {contractStatusData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-600 text-center py-8 text-sm">Sem contratos</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 stagger-children">
        <div className="bg-[#14171D] rounded-xl p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-400" />Leads Recentes
            </h2>
            <Link to="/clients" className="text-sm text-red-400/70 hover:text-red-400 flex items-center gap-1 transition-colors">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentClients.length > 0 ? (
            <div className="divide-y divide-white/[0.04]">
              {recentClients.map((client) => (
                <Link key={client.id} to={`/clients/${client.id}`}
                  className="flex items-center justify-between py-2.5 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-red-400">{client.company_name?.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-base font-medium text-gray-200">{client.company_name}</p>
                      <p className="text-sm text-gray-500">{client.contact_name}</p>
                    </div>
                  </div>
                  <span className={`badge badge-${client.status}`}>{STATUS_LABELS[client.status]}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Nenhum lead cadastrado</p>
            </div>
          )}
        </div>

        <div className="bg-[#14171D] rounded-xl p-5 border border-white/[0.06]">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />Top Clientes por Faturamento
          </h2>
          {(dashAny?.topClients as Array<{ id: number; company_name: string; contract_count: number; total_value: number }> | undefined)?.length ? (
            <div className="divide-y divide-white/[0.04]">
              {(dashAny!.topClients as Array<{ id: number; company_name: string; contract_count: number; total_value: number }>).slice(0, 7).map((client, i) => (
                <Link key={client.id} to={`/clients/${client.id}`}
                  className="flex items-center justify-between py-2 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white ${
                      i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-500' : i === 2 ? 'bg-orange-500' : 'bg-white/[0.06]'
                    } ${i > 2 ? 'text-gray-500' : ''}`}>{i + 1}</div>
                    <div>
                      <p className="text-sm font-medium text-gray-300">{client.company_name}</p>
                      <p className="text-xs text-gray-500">{client.contract_count} contrato(s)</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-400 font-mono">{formatCurrency(client.total_value)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8 text-sm">Sem dados</p>
          )}
          <div className="mt-4 pt-3 border-t border-white/[0.04] grid grid-cols-2 gap-3">
            <div className="bg-violet-500/[0.06] border border-violet-500/15 rounded-lg p-3 text-center">
              <p className="text-lg font-black text-violet-400">
                {dashAny?.avgContractValue ? formatCurrency(dashAny.avgContractValue as number) : 'R$ 0'}
              </p>
              <p className="text-xs text-violet-400/50 uppercase tracking-wider font-bold">Ticket Médio</p>
            </div>
            <div className="bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg p-3 text-center">
              <p className="text-lg font-black text-emerald-400">{taskStats?.completedThisMonth || 0}</p>
              <p className="text-xs text-emerald-400/50 uppercase tracking-wider font-bold">Tarefas (mês)</p>
            </div>
          </div>
        </div>
      </div>

      {(stats?.pendingFollowUps ?? 0) > 0 && (
        <Link to="/follow-ups" className="block bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-4 hover:bg-amber-500/10 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <CalendarDays className="w-5 h-5 text-amber-400 flex-shrink-0" />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-amber-300">{stats!.pendingFollowUps} follow-up(s) pendente(s)</p>
              <p className="text-sm text-amber-400/50">Clique para ver os próximos contatos agendados</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-500/50" />
          </div>
        </Link>
      )}
    </div>
  );
}
