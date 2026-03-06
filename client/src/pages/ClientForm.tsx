import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { Save, ArrowLeft, Building2, User, Mail, Phone, MapPin, Globe, FileText, Search, Loader2 } from 'lucide-react';
import type { CnpjResult } from '@/lib/types';

export default function ClientForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const [form, setForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '', cnpj: '',
    address: '', city: '', state: '', website: '',
    status: 'prospect', interest: '', source: '', notes: '',
    priority: 'medium', estimated_value: '',
  });

  useEffect(() => {
    if (isEditing) {
      setLoading(true);
      api.clients.get(Number(id))
        .then((client) => {
          setForm({
            company_name: client.company_name || '',
            contact_name: client.contact_name || '',
            email: client.email || '',
            phone: client.phone || '',
            cnpj: client.cnpj || '',
            address: client.address || '',
            city: client.city || '',
            state: client.state || '',
            website: client.website || '',
            status: client.status || 'prospect',
            interest: client.interest || '',
            source: client.source || '',
            notes: client.notes || '',
            priority: client.priority || 'medium',
            estimated_value: client.estimated_value?.toString() || '',
          });
        })
        .catch(() => setError('Erro ao carregar cliente'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim() || !form.contact_name.trim()) {
      toast.error('Empresa e nome do contato sÃ£o obrigatÃ³rios');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data = {
        ...form,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
        interest: form.interest || null,
      };
      if (isEditing) {
        await api.clients.update(Number(id), data);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        const newClient = await api.clients.create(data);
        toast.success('Cliente criado com sucesso!');
        navigate(`/clients/${newClient.id}`);
        return;
      }
      navigate(`/clients/${id}`);
    } catch (err) {
      const msg = (err as Error).message || 'Erro ao salvar';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCnpjLookup = async () => {
    const clean = form.cnpj.replace(/[^\d]/g, '');
    if (clean.length !== 14) { toast.error('CNPJ deve ter 14 dÃ­gitos'); return; }
    setCnpjLoading(true);
    try {
      const data = await api.cnpj.lookup(clean) as CnpjResult;
      setForm(prev => ({
        ...prev,
        company_name: prev.company_name || data.trade_name || data.legal_name || '',
        contact_name: prev.contact_name || data.partners?.[0]?.name || '',
        email: prev.email || data.email || '',
        phone: prev.phone || data.phone || '',
        address: prev.address || data.address || '',
        city: prev.city || data.city || '',
        state: prev.state || data.state || '',
      }));
      toast.success('Dados do CNPJ preenchidos!');
    } catch (err) {
      toast.error((err as Error).message || 'CNPJ nÃ£o encontrado');
    } finally {
      setCnpjLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin w-6 h-6 border-[3px] border-red-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link to={isEditing ? `/clients/${id}` : '/clients'} className="p-2.5 rounded-lg hover:bg-white/[0.04]">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{isEditing ? 'Editar' : 'Novo'} Lead / Cliente</h1>
          <p className="text-lg text-gray-500">Preencha os dados do prospecto</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-3.5 rounded-lg text-lg">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-[#14171D] rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
        {/* Dados da Empresa */}
        <div className="p-7 space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-300">
            <Building2 className="w-6 h-6" /> Dados da Empresa
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Empresa *</label>
              <input name="company_name" value={form.company_name} onChange={handleChange} required
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="Nome da empresa" />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">CNPJ</label>
              <div className="flex gap-2">
                <input name="cnpj" value={form.cnpj} onChange={handleChange}
                  className="flex-1 px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="00.000.000/0001-00" />
                <button type="button" onClick={handleCnpjLookup} disabled={cnpjLoading} className="px-3 py-3 bg-red-500/10 text-red-300 border border-red-500/20 rounded-lg hover:bg-red-500/15 transition-colors" title="Buscar dados do CNPJ">
                  {cnpjLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Website</label>
              <input name="website" value={form.website} onChange={handleChange}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="https://exemplo.com" />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Origem / Fonte</label>
              <input name="source" value={form.source} onChange={handleChange}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="Google, Instagram, IndicaÃ§Ã£o..." />
            </div>
          </div>
        </div>

        {/* Dados do Contato */}
        <div className="p-7 space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-300">
            <User className="w-6 h-6" /> Dados do Contato
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Nome do contato *</label>
              <input name="contact_name" value={form.contact_name} onChange={handleChange} required
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="Nome completo" />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">E-mail</label>
              <input name="email" type="email" value={form.email} onChange={handleChange}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="email@empresa.com" />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Telefone</label>
              <input name="phone" value={form.phone} onChange={handleChange}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="(11) 99999-9999" />
            </div>
          </div>
        </div>

        {/* EndereÃ§o */}
        <div className="p-7 space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-300">
            <MapPin className="w-6 h-6" /> EndereÃ§o
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-3">
              <label className="block text-base font-medium text-gray-600 mb-1.5">EndereÃ§o</label>
              <input name="address" value={form.address} onChange={handleChange}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="Rua, nÂº, bairro" />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Cidade</label>
              <input name="city" value={form.city} onChange={handleChange}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="SÃ£o Paulo" />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Estado</label>
              <select name="state" value={form.state} onChange={handleChange}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none">
                <option value="">Selecione</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ClassificaÃ§Ã£o */}
        <div className="p-7 space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-300">
            <FileText className="w-6 h-6" /> ClassificaÃ§Ã£o
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Status</label>
              <select name="status" value={form.status} onChange={handleChange}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none">
                <option value="prospect">Prospect</option>
                <option value="contacted">Contactado</option>
                <option value="negotiating">Negociando</option>
                <option value="proposal_sent">Proposta Enviada</option>
                <option value="client">Cliente</option>
                <option value="lost">Perdido</option>
              </select>
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Interesse</label>
              <select name="interest" value={form.interest} onChange={handleChange}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none">
                <option value="">NÃ£o definido</option>
                <option value="institutional">Site Institucional (R$ 2.500)</option>
                <option value="institutional_blog">Site + Blog (R$ 3.000)</option>
                <option value="ecommerce">E-commerce (R$ 3.000)</option>
                <option value="essential_maintenance">ManutenÃ§Ã£o Essencial (R$ 250/mÃªs)</option>
                <option value="pro_maintenance">ManutenÃ§Ã£o Pro (R$ 500/mÃªs)</option>
                <option value="multiple">MÃºltiplos ServiÃ§os</option>
              </select>
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Prioridade</label>
              <select name="priority" value={form.priority} onChange={handleChange}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none">
                <option value="low">Baixa</option>
                <option value="medium">MÃ©dia</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Valor Estimado (R$)</label>
              <input name="estimated_value" type="number" step="0.01" value={form.estimated_value} onChange={handleChange}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="0,00" />
            </div>
          </div>
        </div>

        {/* ObservaÃ§Ãµes */}
        <div className="p-7 space-y-5">
          <label className="block text-base font-medium text-gray-600 mb-1.5">ObservaÃ§Ãµes / Notas</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={4}
            className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
            placeholder="InformaÃ§Ãµes adicionais sobre o cliente..." />
        </div>

        {/* Actions */}
        <div className="p-7 flex items-center justify-end gap-3">
          <Link to={isEditing ? `/clients/${id}` : '/clients'}
            className="px-6 py-3 border border-white/[0.08] rounded-lg text-lg hover:bg-white/[0.03]">
            Cancelar
          </Link>
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2.5 px-6 py-3 bg-red-600 text-white rounded-lg text-lg hover:bg-red-700 disabled:opacity-50">
            <Save className="w-6 h-6" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}


