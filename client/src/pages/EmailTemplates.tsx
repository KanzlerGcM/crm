import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import type { EmailTemplate } from '@/lib/types';
import {
  Mail, Plus, Pencil, Trash2, Search, Save, X, FileText
} from 'lucide-react';

const CATEGORIES = [
  { value: 'general', label: 'Geral' },
  { value: 'welcome', label: 'Boas-vindas' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'contract', label: 'Contrato' },
  { value: 'invoice', label: 'Faturamento' },
  { value: 'support', label: 'Suporte' },
];

export default function EmailTemplates() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<EmailTemplate> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.emailTemplates.list();
      setTemplates(data);
    } catch {
      addToast('error', 'Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const filtered = templates.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!editing?.name || !editing?.subject || !editing?.body) {
      addToast('error', 'Preencha todos os campos obrigatórios');
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        await api.emailTemplates.update(editing.id, editing);
        addToast('success', 'Template atualizado');
      } else {
        await api.emailTemplates.create(editing);
        addToast('success', 'Template criado');
      }
      setEditing(null);
      fetchTemplates();
    } catch (err) {
      addToast('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;
    try {
      await api.emailTemplates.delete(id);
      addToast('success', 'Template removido');
      fetchTemplates();
    } catch (err) {
      addToast('error', (err as Error).message);
    }
  };

  // Editor view
  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">
            {editing.id ? 'Editar Template' : 'Novo Template'}
          </h1>
          <button onClick={() => setEditing(null)} className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-white/[0.03]">
            <X className="w-4 h-4" /> Cancelar
          </button>
        </div>

        <div className="bg-[#14171D] rounded-xl border p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nome *</label>
              <input
                type="text"
                value={editing.name || ''}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Nome do template"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Categoria</label>
              <select
                value={editing.category || 'general'}
                onChange={e => setEditing({ ...editing, category: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Assunto *</label>
            <input
              type="text"
              value={editing.subject || ''}
              onChange={e => setEditing({ ...editing, subject: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Assunto do email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Corpo *</label>
            <textarea
              rows={12}
              value={editing.body || ''}
              onChange={e => setEditing({ ...editing, body: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="Corpo do email (suporta HTML)"
            />
            <p className="text-sm text-gray-400 mt-1">
              Variáveis disponíveis: {'{{nome_empresa}}'}, {'{{nome_contato}}'}, {'{{email}}'}
            </p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Template'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-red-400" />
          <h1 className="text-2xl font-bold text-white">Templates de Email</h1>
        </div>
        <button
          onClick={() => setEditing({ name: '', subject: '', body: '', category: 'general' })}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <Plus className="w-4 h-4" /> Novo Template
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar templates..."
          className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Templates grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-3 border-red-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#14171D] rounded-xl border p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Nenhum template encontrado</p>
          <button
            onClick={() => setEditing({ name: '', subject: '', body: '', category: 'general' })}
            className="mt-4 text-sm text-red-400 hover:underline"
          >
            Criar primeiro template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(template => (
            <div key={template.id} className="bg-[#14171D] rounded-xl border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white">{template.name}</h3>
                  <span className="text-xs px-2 py-0.5 bg-white/[0.04] text-gray-600 rounded-full">
                    {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(template)}
                    className="p-1.5 hover:bg-white/[0.04] rounded"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-1.5 hover:bg-red-500/10 rounded"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Assunto:</strong> {template.subject}
              </p>
              <p className="text-sm text-gray-400 line-clamp-2">{template.body}</p>
              <div className="mt-3 flex items-center justify-between text-sm text-gray-400">
                <span>{template.created_by_name || 'Sistema'}</span>
                <span>{new Date(template.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
