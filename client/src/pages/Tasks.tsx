import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useRealtimeRefresh } from '@/contexts/SocketContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import SearchableDropdown, { DropdownOption } from '@/components/SearchableDropdown';
import {
  CheckSquare, Plus, Filter, Clock, AlertTriangle, CheckCircle,
  Circle, Play, Trash2, Edit, Calendar, Building2, X, Download, Square,
} from 'lucide-react';
import { TASK_STATUS_LABELS as STATUS_LABELS, PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/constants';
import type { Task, TaskStats } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';

const STATUS_ICONS: Record<string, LucideIcon> = {
  pending: Circle, in_progress: Play, completed: CheckCircle,
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'text-gray-400', in_progress: 'text-red-400', completed: 'text-emerald-500',
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [clientDisplayName, setClientDisplayName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const toast = useToast();

  const [form, setForm] = useState({
    title: '', description: '', client_id: '', priority: 'medium', due_date: '', status: 'pending',
  });

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.status = filter;
      if (priorityFilter) params.priority = priorityFilter;
      const [tasksData, statsData] = await Promise.all([
        api.tasks.list(params),
        api.tasks.stats(),
      ]);
      setTasks(tasksData.data);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [filter, priorityFilter]);
  useRealtimeRefresh(['task'], fetchTasks);

  // Search function for the client dropdown
  const searchClients = useCallback(async (term: string): Promise<DropdownOption[]> => {
    const params: Record<string, string> = { limit: '20' };
    if (term) params.search = term;
    const res = await api.clients.list(params);
    return (res.data || []).map((c: any) => ({
      id: c.id,
      label: c.company_name,
      sublabel: c.contact_name,
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        client_id: form.client_id ? Number(form.client_id) : null,
        due_date: form.due_date || null,
      };
      if (editingTask) {
        await api.tasks.update(editingTask.id, data);
        toast.success('Tarefa atualizada');
      } else {
        await api.tasks.create(data);
        toast.success('Tarefa criada');
      }
      setForm({ title: '', description: '', client_id: '', priority: 'medium', due_date: '', status: 'pending' });
      setClientDisplayName('');
      setShowForm(false);
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao salvar tarefa');
    }
  };

  const handleStatusToggle = async (task: Task) => {
    const nextStatus = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'completed' : 'pending';
    try {
      await api.tasks.update(task.id, { status: nextStatus });
      toast.success(`Tarefa: ${STATUS_LABELS[nextStatus]}`);
      fetchTasks();
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleEdit = (task: Task) => {
    setForm({
      title: task.title, description: task.description || '', client_id: task.client_id?.toString() || '',
      priority: task.priority, due_date: task.due_date || '', status: task.status,
    });
    setClientDisplayName(task.client_name || '');
    setEditingTask(task);
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.tasks.delete(deleteTarget);
      toast.success('Tarefa removida');
      fetchTasks();
    } catch {
      toast.error('Erro ao remover');
    }
    setDeleteTarget(null);
  };

  const isOverdue = (date: string | null) => date && new Date(date) < new Date(new Date().toISOString().split('T')[0]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map(t => t.id)));
    }
  };

  const handleBulkStatus = async (status: string) => {
    try {
      const ids = Array.from(selectedIds);
      await api.tasks.bulkStatus(ids, status);
      toast.success('Tarefas atualizadas', `${ids.length} tarefa(s) alterada(s)`);
      setSelectedIds(new Set());
      fetchTasks();
    } catch {
      toast.error('Erro ao atualizar tarefas em massa');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const ids = Array.from(selectedIds);
      await api.tasks.bulkDelete(ids);
      toast.success('Tarefas removidas', `${ids.length} tarefa(s) removida(s)`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      fetchTasks();
    } catch {
      toast.error('Erro ao remover tarefas em massa');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ConfirmDialog open={!!deleteTarget} title="Remover Tarefa"
        message="Deseja remover esta tarefa?" confirmText="Remover" variant="danger"
        onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />

      <ConfirmDialog open={bulkDeleteOpen} title="Remover Tarefas em Massa"
        message={`Deseja remover ${selectedIds.size} tarefa(s) selecionada(s)? Esta aÃ§Ã£o nÃ£o pode ser desfeita.`}
        confirmText="Remover Todas" variant="danger"
        onConfirm={handleBulkDelete} onCancel={() => setBulkDeleteOpen(false)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Tarefas</h1>
          <p className="text-gray-400 mt-1">Gerencie suas tarefas e to-dos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleSelectAll}
            className="btn-secondary" title={selectedIds.size === tasks.length && tasks.length > 0 ? 'Desmarcar todos' : 'Selecionar todos'}>
            {selectedIds.size === tasks.length && tasks.length > 0 ? (
              <CheckSquare className="w-5 h-5 text-red-400" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
          <button onClick={() => api.tasks.exportCsv().catch(() => toast.error('Erro ao exportar'))} className="btn-secondary" title="Exportar CSV">
            <Download className="w-5 h-5" />CSV
          </button>
          <button onClick={() => { setShowForm(!showForm); setEditingTask(null); setClientDisplayName(''); setForm({ title: '', description: '', client_id: '', priority: 'medium', due_date: '', status: 'pending' }); }}
            className="btn-primary">
            <Plus className="w-6 h-6" />{showForm ? 'Cancelar' : 'Nova Tarefa'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Pendentes', value: stats.pending, color: 'text-gray-600', bg: 'bg-[#111318]', border: 'border-white/[0.06]' },
            { label: 'Em Andamento', value: stats.in_progress, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
            { label: 'ConcluÃ­das', value: stats.completed, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
            { label: 'Atrasadas', value: stats.overdue, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
            { label: 'Para Hoje', value: stats.today, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4 text-center`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#14171D] rounded-xl border border-white/[0.06] p-6 space-y-4 animate-slide-in">
          <h3 className="text-lg font-semibold">{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-base font-medium text-gray-600 mb-1.5">TÃ­tulo *</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="input-base" placeholder="Descreva a tarefa..." required />
            </div>
            <div className="md:col-span-2">
              <label className="block text-base font-medium text-gray-600 mb-1.5">DescriÃ§Ã£o</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="input-base resize-none" rows={3} placeholder="Detalhes adicionais..." />
            </div>
            <SearchableDropdown
              value={form.client_id}
              onChange={(val) => setForm({ ...form, client_id: val })}
              onSearch={searchClients}
              label="Cliente"
              placeholder="Buscar cliente..."
              displayValue={clientDisplayName}
              emptyLabel="Nenhum cliente"
            />
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Prioridade</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="input-base">
                <option value="low">Baixa</option>
                <option value="medium">MÃ©dia</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Data Limite</label>
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="input-base" />
            </div>
            {editingTask && (
              <div>
                <label className="block text-base font-medium text-gray-600 mb-1.5">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input-base">
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em Andamento</option>
                  <option value="completed">ConcluÃ­da</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowForm(false); setEditingTask(null); }} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{editingTask ? 'Salvar' : 'Criar Tarefa'}</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: 'all', label: 'Todas' },
          { value: 'pending', label: 'Pendentes' },
          { value: 'in_progress', label: 'Em Andamento' },
          { value: 'completed', label: 'ConcluÃ­das' },
        ].map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-base font-medium transition-colors ${
              filter === f.value ? 'bg-red-600 text-white' : 'bg-[#14171D] border border-white/[0.06] text-gray-600 hover:bg-white/[0.03]'
            }`}>
            {f.label}
          </button>
        ))}
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="px-4 py-2 border border-white/[0.06] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none">
          <option value="">Todas as prioridades</option>
          {Object.entries(PRIORITY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-wrap items-center gap-3 animate-slide-in">
          <span className="text-base font-medium text-red-300">
            {selectedIds.size} selecionada(s)
          </span>
          <div className="h-6 w-px bg-red-500/20" />
          <select
            onChange={(e) => { if (e.target.value) { handleBulkStatus(e.target.value); e.target.value = ''; } }}
            className="px-3 py-2 border border-red-500/30 rounded-lg text-base bg-[#14171D] focus:ring-2 focus:ring-red-500 outline-none"
            defaultValue=""
          >
            <option value="" disabled>Alterar status para...</option>
            <option value="pending">Pendente</option>
            <option value="in_progress">Em Andamento</option>
            <option value="completed">ConcluÃ­da</option>
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

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-6 h-6 border-[3px] border-red-500 border-t-transparent rounded-full" />
        </div>
      ) : tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((task) => {
            const StatusIcon = STATUS_ICONS[task.status] || Circle;
            const overdue = isOverdue(task.due_date) && task.status !== 'completed';
            return (
              <div key={task.id} className={`bg-[#14171D] rounded-xl border p-4 flex items-start gap-3 hover:shadow-md shadow-black/20 transition-shadow ${
                selectedIds.has(task.id) ? 'ring-2 ring-red-300 ' : ''}${overdue ? 'border-red-500/20 bg-red-500/5' : task.status === 'completed' ? 'border-green-500/20 bg-green-500/10/30' : 'border-white/[0.06]'
              }`}>
                <button onClick={() => toggleSelect(task.id)}
                  className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-red-400">
                  {selectedIds.has(task.id) ? (
                    <CheckSquare className="w-6 h-6 text-red-400" />
                  ) : (
                    <Square className="w-6 h-6" />
                  )}
                </button>
                <button onClick={() => handleStatusToggle(task)}
                  className={`mt-0.5 flex-shrink-0 transition-colors ${STATUS_COLORS[task.status]} hover:text-red-400`}
                  title={`Marcar como ${STATUS_LABELS[task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'completed' : 'pending']}`}>
                  <StatusIcon className="w-6 h-6" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-lg font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-white'}`}>
                      {task.title}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                    {overdue && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />Atrasada
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {task.company_name && (
                      <Link to={`/clients/${task.client_id}`} className="text-sm text-red-400 hover:underline flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />{task.company_name}
                      </Link>
                    )}
                    {task.due_date && (
                      <span className={`text-sm flex items-center gap-1 ${overdue ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
                        <Calendar className="w-3.5 h-3.5" />{new Date(task.due_date).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {task.completed_at && (
                      <span className="text-sm text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />ConcluÃ­da {new Date(task.completed_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleEdit(task)}
                    className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10" title="Editar">
                    <Edit className="w-5 h-5" />
                  </button>
                  <button onClick={() => setDeleteTarget(task.id)}
                    className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10" title="Remover">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-12 text-center">
          <CheckSquare className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <p className="text-lg text-gray-500">Nenhuma tarefa encontrada</p>
          <button onClick={() => setShowForm(true)} className="text-lg text-red-400 hover:text-red-300 mt-2">
            Criar primeira tarefa â†’
          </button>
        </div>
      )}
    </div>
  );
}


