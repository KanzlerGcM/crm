import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useRealtimeRefresh } from '@/contexts/SocketContext';
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, CheckSquare,
  FileText, CreditCard, Plus, X, Edit3, Trash2, Save, Users,
  CalendarPlus, Palette,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MONTH_NAMES_FULL as MONTH_NAMES } from '@/lib/constants';
import type { CalendarEvent } from '@/lib/types';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  follow_up: { icon: Clock, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Follow-up' },
  task: { icon: CheckSquare, color: 'bg-red-500/10 text-red-300 border-red-500/20', label: 'Tarefa' },
  contract: { icon: FileText, color: 'bg-violet-500/10 text-violet-400 border-violet-500/20', label: 'Entrega' },
  payment: { icon: CreditCard, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Pagamento' },
  event: { icon: CalendarPlus, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Evento' },
};

const EVENT_COLORS = [
  { value: '#0077FF', label: 'Azul', bg: 'bg-blue-500' },
  { value: '#7C5CE0', label: 'Roxo', bg: 'bg-violet-500' },
  { value: '#10b981', label: 'Verde', bg: 'bg-emerald-500' },
  { value: '#f59e0b', label: 'Amarelo', bg: 'bg-amber-500' },
  { value: '#ef4444', label: 'Vermelho', bg: 'bg-red-500' },
  { value: '#ec4899', label: 'Rosa', bg: 'bg-pink-500' },
  { value: '#06b6d4', label: 'Ciano', bg: 'bg-cyan-500' },
  { value: '#8b5cf6', label: 'Violeta', bg: 'bg-purple-500' },
];

const CATEGORIES = [
  { value: 'event', label: 'Evento Geral' },
  { value: 'meeting', label: 'Reunião' },
  { value: 'deadline', label: 'Prazo / Deadline' },
  { value: 'reminder', label: 'Lembrete' },
  { value: 'personal', label: 'Pessoal' },
];

interface EventForm {
  title: string;
  description: string;
  date: string;
  time: string;
  end_date: string;
  end_time: string;
  color: string;
  category: string;
  all_day: boolean;
}

const EMPTY_FORM: EventForm = {
  title: '', description: '', date: '', time: '', end_date: '', end_time: '',
  color: '#0077FF', category: 'event', all_day: true,
};

export default function CalendarPage() {
  const toast = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Event modal
  const [showModal, setShowModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [form, setForm] = useState<EventForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
      const data = await api.analytics.calendar(start, end);
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useRealtimeRefresh(['calendar_event', 'task', 'payment'], fetchEvents);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { day: number; month: 'prev' | 'current' | 'next'; date: string }[] = [];

    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      days.push({ day: d, month: 'prev', date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i, month: 'current',
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const m = month + 2 > 12 ? 1 : month + 2;
      const y = month + 2 > 12 ? year + 1 : year;
      days.push({ day: i, month: 'next', date: `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}` });
    }

    return days;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  const todayStr = new Date().toISOString().split('T')[0];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(todayStr); };

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  // Modal handlers
  const openCreateModal = (date?: string) => {
    setEditingEventId(null);
    setForm({ ...EMPTY_FORM, date: date || selectedDate || todayStr });
    setShowModal(true);
  };

  const openEditModal = (ev: CalendarEvent & { editable?: boolean; event_id?: number; description?: string; time?: string; end_date?: string; end_time?: string; category?: string; all_day?: boolean }) => {
    if (!ev.editable || !ev.event_id) return;
    setEditingEventId(ev.event_id);
    setForm({
      title: ev.title || '',
      description: ev.description || '',
      date: ev.date || '',
      time: ev.time || '',
      end_date: ev.end_date || '',
      end_time: ev.end_time || '',
      color: ev.color || '#0077FF',
      category: ev.category || 'event',
      all_day: ev.all_day !== undefined ? !!ev.all_day : true,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.date) {
      toast.error('Título e data são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      if (editingEventId) {
        await api.analytics.updateEvent(editingEventId, form as any);
        toast.success('Evento atualizado!');
      } else {
        await api.analytics.createEvent(form as any);
        toast.success('Evento criado!');
      }
      setShowModal(false);
      fetchEvents();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao salvar evento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: number) => {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;
    try {
      await api.analytics.deleteEvent(eventId);
      toast.success('Evento excluído!');
      fetchEvents();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao excluir');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-red-400" />
            Agenda
          </h1>
          <p className="text-gray-400 mt-1">Eventos da equipe, follow-ups, tarefas, entregas e pagamentos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={goToday} className="btn-secondary">Hoje</button>
          <button onClick={() => openCreateModal()} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Novo Evento
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-[#14171D] rounded-xl border border-white/[0.06] p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="p-2 hover:bg-white/[0.04] rounded-lg transition">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white">
              {MONTH_NAMES[month]} {year}
            </h2>
            <button onClick={nextMonth} className="p-2 hover:bg-white/[0.04] rounded-lg transition">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-sm font-medium text-gray-500 py-2">{d}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-6 h-6 border-[3px] border-red-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((d, i) => {
                const dayEvents = eventsByDate[d.date] || [];
                const isToday = d.date === todayStr;
                const isSelected = d.date === selectedDate;
                const isCurrentMonth = d.month === 'current';

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(d.date)}
                    onDoubleClick={() => openCreateModal(d.date)}
                    className={`relative p-2 min-h-[72px] rounded-lg text-left transition-colors border ${
                      isSelected ? 'border-red-500 bg-red-500/10 ring-1 ring-red-400' :
                      isToday ? 'border-blue-300 bg-blue-500/10' :
                      isCurrentMonth ? 'border-transparent hover:bg-white/[0.03]' :
                      'border-transparent opacity-40'
                    }`}
                    title="Duplo clique para criar evento"
                  >
                    <span className={`text-sm font-medium ${
                      isToday ? 'text-blue-600' : isCurrentMonth ? 'text-gray-300' : 'text-gray-400'
                    }`}>
                      {d.day}
                    </span>

                    {dayEvents.length > 0 && (
                      <div className="flex flex-col gap-0.5 mt-1 w-full">
                        {dayEvents.slice(0, 2).map((ev, j) => (
                          <div key={j}
                            className="flex items-center gap-1 w-full min-w-0"
                            title={ev.title}
                          >
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color || '#6366f1' }} />
                            <span className="text-xs leading-tight text-gray-600 truncate">{ev.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-xs text-gray-400 font-medium">+{dayEvents.length - 2}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/[0.04] flex-wrap">
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5 text-sm text-gray-500">
                <cfg.icon className="w-3.5 h-3.5" />
                {cfg.label}
              </div>
            ))}
          </div>
        </div>

        {/* Selected day detail */}
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-300">
              {selectedDate
                ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
                : 'Selecione um dia'
              }
            </h3>
            {selectedDate && (
              <button
                onClick={() => openCreateModal(selectedDate)}
                className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/15 transition"
                title="Criar evento neste dia"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '55vh' }}>
            {selectedDate && selectedEvents.length > 0 ? (
              <div className="space-y-3">
                {selectedEvents.map((ev) => {
                  const cfg = TYPE_CONFIG[ev.type] || { icon: CalendarDays, color: 'bg-white/[0.04] text-gray-300 border-white/[0.06]', label: ev.type };
                  const Icon = cfg.icon;
                  const isCustomEvent = ev.editable && ev.event_id;

                  // Custom events: use their hex color as prominent left border + tinted bg
                  const customStyle = isCustomEvent && ev.color ? {
                    borderLeft: `4px solid ${ev.color}`,
                    backgroundColor: `${ev.color}12`,
                    borderColor: `${ev.color}30`,
                  } : undefined;

                  return (
                    <div key={ev.id}
                      className={`rounded-lg border p-3 transition-shadow ${isCustomEvent ? 'hover:shadow-md' : cfg.color}`}
                      style={customStyle}
                    >
                      <div className="flex items-start gap-2.5">
                        {isCustomEvent ? (
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${ev.color}20` }}>
                            <CalendarPlus className="w-4 h-4" style={{ color: ev.color }} />
                          </div>
                        ) : (
                          <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          {ev.link ? (
                            <Link to={ev.link} className="text-sm font-medium truncate block hover:underline">{ev.title}</Link>
                          ) : (
                            <p className="text-sm font-medium truncate">{ev.title}</p>
                          )}
                          {ev.description && <p className="text-sm opacity-75 mt-0.5">{ev.description}</p>}
                          {ev.time && (
                            <p className="text-xs opacity-60 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {ev.time}{ev.end_time ? ` — ${ev.end_time}` : ''}
                            </p>
                          )}
                          {ev.creator_name && (
                            <p className="text-xs opacity-50 mt-1 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {ev.creator_name}
                            </p>
                          )}
                        </div>
                        {isCustomEvent && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => openEditModal(ev)}
                              className="p-1 rounded hover:bg-white/50 transition"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(ev.event_id)}
                              className="p-1 rounded hover:bg-red-500/15 text-red-500 transition"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : selectedDate ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400 mb-3">Nenhum evento neste dia</p>
                <button
                  onClick={() => openCreateModal(selectedDate)}
                  className="text-sm text-red-400 hover:text-red-300 font-medium flex items-center gap-1.5 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Criar evento
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">Clique em um dia para ver seus eventos</p>
            )}
          </div>

          {/* Today's summary */}
          <div className="mt-6 pt-4 border-t border-white/[0.04]">
            <h4 className="text-base font-semibold text-gray-500 mb-2">Resumo de Hoje</h4>
            {(eventsByDate[todayStr] || []).length > 0 ? (
              <div className="space-y-2">
                {(eventsByDate[todayStr] || []).slice(0, 5).map((ev) => {
                  const cfg = TYPE_CONFIG[ev.type] || { icon: CalendarDays, color: 'bg-white/[0.04] text-gray-600', label: '' };
                  const Icon = cfg.icon;
                  const isCustom = ev.editable && ev.event_id;
                  return ev.link ? (
                    <Link key={ev.id} to={ev.link} className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-400">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="truncate">{ev.title}</span>
                    </Link>
                  ) : (
                    <div key={ev.id} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: ev.color || '#6366f1' }} />
                      <span className="truncate">{ev.title}</span>
                      {ev.time && <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{ev.time}</span>}
                    </div>
                  );
                })}
                {(eventsByDate[todayStr] || []).length > 5 && (
                  <p className="text-xs text-gray-400 pl-5">+{(eventsByDate[todayStr] || []).length - 5} mais</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nenhum evento hoje</p>
            )}
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[#14171D] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-white/[0.04]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center">
                    <CalendarPlus className="w-5 h-5 text-red-400" />
                  </div>
                  {editingEventId ? 'Editar Evento' : 'Novo Evento'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/[0.04] rounded-lg transition">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-400 mt-1 ml-[52px]">Visível para toda a equipe</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-2 block">Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-3 border border-white/[0.06] rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                  placeholder="Ex: Reunião com equipe, Prazo projeto..."
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-2 block">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-3 border border-white/[0.06] rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition resize-y"
                  rows={3}
                  placeholder="Detalhes do evento..."
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-2 block">Categoria</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-3 border border-white/[0.06] rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* All day toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, all_day: !f.all_day }))}
                  className={`relative w-12 h-7 rounded-full transition-colors ${form.all_day ? 'bg-red-600' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-[#14171D] rounded-full shadow transition-transform ${form.all_day ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-sm font-medium text-gray-300">Dia inteiro</span>
              </div>

              {/* Date / Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600 mb-2 block">{form.all_day ? 'Data *' : 'Data de Início *'}</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-4 py-3 border border-white/[0.06] rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                  />
                </div>
                {!form.all_day && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-2 block">Horário de Início</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                      className="w-full px-4 py-3 border border-white/[0.06] rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                    />
                  </div>
                )}
              </div>

              {!form.all_day && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-2 block">Data de Término</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                      className="w-full px-4 py-3 border border-white/[0.06] rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-2 block">Horário de Término</label>
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                      className="w-full px-4 py-3 border border-white/[0.06] rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                    />
                  </div>
                </div>
              )}

              {/* Color Picker */}
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Cor do Evento
                </label>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color: c.value }))}
                      className={`w-9 h-9 rounded-lg transition-all ${
                        form.color === c.value
                          ? 'ring-2 ring-offset-2 ring-red-500 scale-110 shadow-md'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
                {/* Color preview */}
                <div className="mt-3 flex items-center gap-3 p-3 rounded-lg border" style={{ borderLeft: `4px solid ${form.color}`, backgroundColor: `${form.color}10` }}>
                  <div className="w-6 h-6 rounded-md" style={{ backgroundColor: form.color }} />
                  <span className="text-sm text-gray-600">Pré-visualização da cor</span>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-6 border-t border-white/[0.04] flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Users className="w-4 h-4" />
                Visível para todos
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-400 bg-white/[0.04] rounded-xl hover:bg-white/10 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title.trim() || !form.date}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg shadow-red-900/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingEventId ? 'Salvar' : 'Criar Evento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
