import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import SearchableDropdown, { DropdownOption } from '@/components/SearchableDropdown';
import { ArrowLeft, FileText, Save, Check, DollarSign } from 'lucide-react';

const PLAN_INFO: Record<string, { name: string; value: number; type: string }> = {
  institutional: { name: 'Site Institucional', value: 2500, type: 'Pagamento Ãšnico' },
  institutional_blog: { name: 'Site Institucional + Blog', value: 3000, type: 'Pagamento Ãšnico' },
  ecommerce: { name: 'E-commerce', value: 3000, type: 'Pagamento Ãšnico' },
  essential_maintenance: { name: 'Plano Essencial - ManutenÃ§Ã£o', value: 250, type: 'Mensal' },
  pro_maintenance: { name: 'Plano Pro - ManutenÃ§Ã£o', value: 500, type: 'Mensal' },
};

export default function ContractForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get('client_id');

  const [clientDisplayName, setClientDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const [form, setForm] = useState({
    client_id: preselectedClientId || '',
    plan_type: '',
    payment_method: '',
    installments: '1',
    discount_percent: '',
    start_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    custom_clauses: '',
    notes: '',
  });

  // Resolve preselected client display name
  useEffect(() => {
    const init = async () => {
      try {
        if (preselectedClientId) {
          const detail = await api.clients.get(Number(preselectedClientId));
          setClientDisplayName(`${detail.company_name} â€” ${detail.contact_name}`);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [preselectedClientId]);

  // Search function for SearchableDropdown
  const searchClients = useCallback(async (term: string): Promise<DropdownOption[]> => {
    const params: Record<string, string> = { limit: '20' };
    if (term) params.search = term;
    const res = await api.clients.list(params);
    return (res.data || []).map((c) => ({
      id: c.id,
      label: c.company_name,
      sublabel: c.contact_name,
    }));
  }, []);

  // Auto-calculate discount for PIX
  useEffect(() => {
    if (form.payment_method === 'pix' && !form.discount_percent) {
      setForm(f => ({ ...f, discount_percent: '5' }));
    }
  }, [form.payment_method]);

  // Auto-calculate delivery date (30 days)
  useEffect(() => {
    if (form.start_date && form.plan_type && !form.plan_type.includes('maintenance')) {
      const start = new Date(form.start_date);
      start.setDate(start.getDate() + 30);
      setForm(f => ({ ...f, delivery_date: start.toISOString().split('T')[0] }));
    }
  }, [form.start_date, form.plan_type]);

  const selectedPlan = form.plan_type ? PLAN_INFO[form.plan_type] : null;
  const discount = parseFloat(form.discount_percent) || 0;
  const baseValue = selectedPlan?.value || 0;
  const finalValue = baseValue * (1 - discount / 100);
  const installmentValue = form.installments ? finalValue / parseInt(form.installments) : finalValue;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id || !form.plan_type) {
      setError('Selecione o cliente e o plano');
      toast.error('Selecione o cliente e o plano');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data = {
        client_id: parseInt(form.client_id),
        plan_type: form.plan_type,
        payment_method: form.payment_method || null,
        installments: parseInt(form.installments) || 1,
        discount_percent: parseFloat(form.discount_percent) || 0,
        start_date: form.start_date || null,
        delivery_date: form.delivery_date || null,
        custom_clauses: form.custom_clauses || null,
        notes: form.notes || null,
      };
      const contract = await api.contracts.create(data);
      toast.success('Contrato gerado com sucesso!');
      // Auto-download PDF
      try { await api.contracts.downloadPdf(contract.id); } catch (err) { console.error('PDF download error', err); }
      navigate('/contracts');
    } catch (err) {
      const msg = (err as Error).message || 'Erro ao gerar contrato';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
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
        <Link to="/contracts" className="p-2.5 rounded-lg hover:bg-white/[0.04]">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Gerar Contrato</h1>
          <p className="text-lg text-gray-500">Crie um contrato baseado nos serviÃ§os da Chevla</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-3.5 rounded-lg text-lg">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-[#14171D] rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
        {/* Cliente */}
        <div className="p-7 space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-300">
            <FileText className="w-5 h-5" /> Cliente
          </h2>
          <SearchableDropdown
            value={form.client_id}
            onChange={(val) => setForm(f => ({ ...f, client_id: val }))}
            onSearch={searchClients}
            placeholder="Pesquisar cliente por nome ou empresa..."
            displayValue={clientDisplayName}
            allowEmpty={false}
          />
          <input type="hidden" name="client_id" value={form.client_id} required />
        </div>

        {/* ServiÃ§o */}
        <div className="p-7 space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-300">
            <DollarSign className="w-5 h-5" /> ServiÃ§o
          </h2>

          <div className="grid grid-cols-1 gap-4">
            <p className="text-base text-gray-500 font-medium">CriaÃ§Ã£o de Sites (Pagamento Ãšnico)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {['institutional', 'institutional_blog', 'ecommerce'].map(key => {
                const plan = PLAN_INFO[key];
                const isSelected = form.plan_type === key;
                return (
                  <button key={key} type="button"
                    onClick={() => setForm({ ...form, plan_type: key })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected ? 'border-red-500 bg-red-500/10 ring-2 ring-red-200' : 'border-white/[0.06] hover:border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-base font-medium">{plan.name}</p>
                      {isSelected && <Check className="w-5 h-5 text-red-400" />}
                    </div>
                    <p className="text-xl font-bold text-red-400">R$ {plan.value.toLocaleString('pt-BR')}</p>
                    <p className="text-sm text-gray-500">{plan.type}</p>
                  </button>
                );
              })}
            </div>

            <p className="text-base text-gray-500 font-medium mt-3">ManutenÃ§Ã£o (Mensal)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {['essential_maintenance', 'pro_maintenance'].map(key => {
                const plan = PLAN_INFO[key];
                const isSelected = form.plan_type === key;
                return (
                  <button key={key} type="button"
                    onClick={() => setForm({ ...form, plan_type: key })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected ? 'border-red-500 bg-red-500/10 ring-2 ring-red-200' : 'border-white/[0.06] hover:border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-base font-medium">{plan.name}</p>
                      {isSelected && <Check className="w-5 h-5 text-red-400" />}
                    </div>
                    <p className="text-xl font-bold text-red-400">R$ {plan.value.toLocaleString('pt-BR')}<span className="text-sm text-gray-500">/mÃªs</span></p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pagamento */}
        {selectedPlan && (
          <div className="p-7 space-y-5">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-300">
              <DollarSign className="w-5 h-5" /> Pagamento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-base font-medium text-gray-600 mb-1.5">Forma de Pagamento</label>
                <select name="payment_method" value={form.payment_method}
                  onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                  className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none">
                  <option value="">Selecione</option>
                  <option value="pix">PIX (5% desconto)</option>
                  <option value="credit_card">CartÃ£o de CrÃ©dito</option>
                  <option value="bank_transfer">TransferÃªncia BancÃ¡ria</option>
                </select>
              </div>
              <div>
                <label className="block text-base font-medium text-gray-600 mb-1.5">Parcelas</label>
                <select name="installments" value={form.installments}
                  onChange={(e) => setForm({ ...form, installments: e.target.value })}
                  className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none">
                  <option value="1">1x (Ã  vista)</option>
                  {!form.plan_type.includes('maintenance') && (
                    <>
                      <option value="2">2x sem juros</option>
                      <option value="3">3x sem juros</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-base font-medium text-gray-600 mb-1.5">Desconto (%)</label>
                <input name="discount_percent" type="number" step="0.1" min="0" max="100"
                  value={form.discount_percent}
                  onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                  className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="0" />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
              <p className="text-base text-red-400 font-medium mb-3">Resumo do Contrato</p>
              <div className="space-y-2">
                <div className="flex justify-between text-base">
                  <span className="text-gray-600">ServiÃ§o:</span>
                  <span className="font-medium">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-gray-600">Valor base:</span>
                  <span>R$ {baseValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{selectedPlan.type === 'Mensal' ? '/mÃªs' : ''}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-base text-green-400">
                    <span>Desconto ({discount}%):</span>
                    <span>-R$ {(baseValue * discount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <hr className="border-red-500/20" />
                <div className="flex justify-between text-base font-bold">
                  <span>Valor final:</span>
                  <span className="text-red-300">
                    R$ {finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    {selectedPlan.type === 'Mensal' ? '/mÃªs' : ''}
                  </span>
                </div>
                {parseInt(form.installments) > 1 && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Parcelamento:</span>
                    <span>{form.installments}x de R$ {installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Datas */}
        <div className="p-7 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Data de InÃ­cio</label>
              <input type="date" value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none" />
            </div>
            {!form.plan_type.includes('maintenance') && (
              <div>
                <label className="block text-base font-medium text-gray-600 mb-1.5">PrevisÃ£o de Entrega</label>
                <input type="date" value={form.delivery_date}
                  onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                  className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
            )}
          </div>
        </div>

        {/* ClÃ¡usulas adicionais */}
        <div className="p-7 space-y-5">
          <div>
            <label className="block text-base font-medium text-gray-600 mb-1.5">ClÃ¡usulas Adicionais (opcional)</label>
            <textarea value={form.custom_clauses}
              onChange={(e) => setForm({ ...form, custom_clauses: e.target.value })}
              rows={3}
              className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none resize-none"
              placeholder="Adicione clÃ¡usulas especÃ­ficas para este contrato..." />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-600 mb-1.5">Notas Internas</label>
            <textarea value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-5 py-3 border border-white/[0.08] rounded-lg text-lg focus:ring-2 focus:ring-red-500 outline-none resize-none"
              placeholder="ObservaÃ§Ãµes internas (nÃ£o aparece no contrato)..." />
          </div>
        </div>

        {/* Actions */}
        <div className="p-7 flex items-center justify-between">
          <p className="text-sm text-gray-400">O contrato PDF serÃ¡ gerado automaticamente</p>
          <div className="flex gap-3">
            <Link to="/contracts" className="px-6 py-3 border border-white/[0.08] rounded-lg text-lg hover:bg-white/[0.03]">
              Cancelar
            </Link>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2.5 px-6 py-3 bg-red-600 text-white rounded-lg text-lg hover:bg-red-700 disabled:opacity-50">
              <Save className="w-5 h-5" />
              {saving ? 'Gerando...' : 'Gerar Contrato & PDF'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}


