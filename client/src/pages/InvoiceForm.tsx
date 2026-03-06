import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { Save, ArrowLeft, Plus, Trash2, Receipt } from 'lucide-react';
import { formatCurrency, INVOICE_STATUS_LABELS } from '@/lib/constants';
import type { Client, Contract, InvoiceItem } from '@/lib/types';

interface FormItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export default function InvoiceForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  const [form, setForm] = useState({
    client_id: '',
    contract_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    description: '',
    discount: '0',
    tax_rate: '0',
    payment_method: '',
    status: 'draft',
    notes: '',
    version: undefined as number | undefined,
  });

  const [items, setItems] = useState<FormItem[]>([
    { description: '', quantity: 1, unit_price: 0 },
  ]);

  useEffect(() => {
    // Load clients for dropdown
    api.clients.list({ limit: '500' }).then(res => setClients(res.data)).catch(() => {});
  }, []);

  // Load contracts when client changes
  useEffect(() => {
    if (form.client_id) {
      api.contracts.list({ client_id: form.client_id, limit: '100' })
        .then(res => setContracts(res.data))
        .catch(() => {});
    } else {
      setContracts([]);
    }
  }, [form.client_id]);

  useEffect(() => {
    if (isEditing) {
      setLoading(true);
      api.invoices.get(Number(id))
        .then((inv) => {
          setForm({
            client_id: String(inv.client_id),
            contract_id: inv.contract_id ? String(inv.contract_id) : '',
            issue_date: inv.issue_date || '',
            due_date: inv.due_date || '',
            description: inv.description || '',
            discount: String(inv.discount || 0),
            tax_rate: String(inv.tax_rate || 0),
            payment_method: inv.payment_method || '',
            status: inv.status,
            notes: inv.notes || '',
            version: inv.version,
          });
          if (inv.items && inv.items.length > 0) {
            setItems(inv.items.map((it: InvoiceItem) => ({
              description: it.description,
              quantity: it.quantity,
              unit_price: it.unit_price,
            })));
          }
        })
        .catch(() => toast.error('Erro ao carregar nota fiscal'))
        .finally(() => setLoading(false));
    }
  }, [id, isEditing, toast]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, field: keyof FormItem, value: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      if (field === 'description') {
        updated[index] = { ...updated[index], description: value as string };
      } else {
        updated[index] = { ...updated[index], [field]: parseFloat(String(value)) || 0 };
      }
      return updated;
    });
  };

  const addItem = () => {
    setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return toast.warning('A nota precisa ter pelo menos 1 item');
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = items.reduce((sum, it) => sum + (it.quantity || 0) * (it.unit_price || 0), 0);
  const discount = parseFloat(form.discount) || 0;
  const afterDiscount = subtotal - discount;
  const taxRate = parseFloat(form.tax_rate) || 0;
  const taxAmount = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) return toast.warning('Selecione um cliente');
    if (items.some(it => !it.description.trim())) return toast.warning('Preencha a descriÃ§Ã£o de todos os itens');
    if (items.some(it => it.unit_price <= 0)) return toast.warning('O valor unitÃ¡rio deve ser maior que zero');

    setSaving(true);
    try {
      const payload = {
        client_id: Number(form.client_id),
        contract_id: form.contract_id ? Number(form.contract_id) : null,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
        description: form.description || null,
        discount,
        tax_rate: taxRate,
        payment_method: form.payment_method || null,
        status: form.status,
        notes: form.notes || null,
        items: items.map(it => ({
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
        })),
        version: form.version,
      };

      if (isEditing) {
        await api.invoices.update(Number(id), payload);
        toast.success('Nota fiscal atualizada');
      } else {
        await api.invoices.create(payload);
        toast.success('Nota fiscal criada com sucesso');
      }
      navigate('/invoices');
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao salvar nota fiscal');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-3 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/invoices')} className="p-2 hover:bg-white/[0.04] rounded-lg">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-7 h-7 text-red-400" />
            {isEditing ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client & Contract */}
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Dados Gerais</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Cliente *</label>
              <select value={form.client_id} onChange={(e) => handleChange('client_id', e.target.value)}
                className="w-full px-4 py-3 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none"
                required>
                <option value="">Selecione um cliente</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name} â€” {c.contact_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Contrato (opcional)</label>
              <select value={form.contract_id} onChange={(e) => handleChange('contract_id', e.target.value)}
                className="w-full px-4 py-3 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none">
                <option value="">Sem contrato vinculado</option>
                {contracts.map(ct => (
                  <option key={ct.id} value={ct.id}>{ct.contract_number} â€” {formatCurrency(ct.final_value, 2)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Data de EmissÃ£o *</label>
              <input type="date" value={form.issue_date}
                onChange={(e) => handleChange('issue_date', e.target.value)}
                className="w-full px-4 py-3 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none"
                required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Data de Vencimento</label>
              <input type="date" value={form.due_date}
                onChange={(e) => handleChange('due_date', e.target.value)}
                className="w-full px-4 py-3 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">MÃ©todo de Pagamento</label>
              <select value={form.payment_method} onChange={(e) => handleChange('payment_method', e.target.value)}
                className="w-full px-4 py-3 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none">
                <option value="">NÃ£o definido</option>
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="cartao">CartÃ£o</option>
                <option value="transferencia">TransferÃªncia</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </div>

            {isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                <select value={form.status} onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-4 py-3 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none">
                  {Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">DescriÃ§Ã£o</label>
            <input type="text" value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Ex: Desenvolvimento de site institucional"
              className="w-full px-4 py-3 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none" />
          </div>
        </div>

        {/* Items */}
        <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Itens da Nota</h2>
            <button type="button" onClick={addItem}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-500/10 text-red-300 rounded-lg hover:bg-red-500/15 transition-colors text-sm font-medium">
              <Plus className="w-4 h-4" /> Adicionar Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-3 items-start bg-[#111318] rounded-lg p-4 border border-white/[0.04]">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-500 mb-1">DescriÃ§Ã£o</label>
                  <input type="text" value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    placeholder="DescriÃ§Ã£o do serviÃ§o/produto"
                    className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none"
                    required />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Qtd</label>
                  <input type="number" value={item.quantity} min="0.01" step="0.01"
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none"
                    required />
                </div>
                <div className="w-36">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Valor UnitÃ¡rio</label>
                  <input type="number" value={item.unit_price} min="0" step="0.01"
                    onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                    className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none"
                    required />
                </div>
                <div className="w-32 text-right">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Total</label>
                  <p className="py-2 text-base font-medium text-white">
                    {formatCurrency((item.quantity || 0) * (item.unit_price || 0), 2)}
                  </p>
                </div>
                <div className="pt-6">
                  <button type="button" onClick={() => removeItem(idx)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-500/10 rounded-lg"
                    title="Remover item">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">ObservaÃ§Ãµes</h2>
            <textarea value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="ObservaÃ§Ãµes internas, instruÃ§Ãµes de pagamento..."
              rows={4}
              className="w-full px-4 py-3 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none resize-none" />
          </div>

          <div className="bg-[#14171D] rounded-xl border border-white/[0.06] p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">Totais</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Desconto (R$)</label>
                <input type="number" value={form.discount} min="0" step="0.01"
                  onChange={(e) => handleChange('discount', e.target.value)}
                  className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Imposto (%)</label>
                <input type="number" value={form.tax_rate} min="0" max="100" step="0.01"
                  onChange={(e) => handleChange('tax_rate', e.target.value)}
                  className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-base focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-base">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal, 2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-base">
                  <span className="text-gray-500">Desconto</span>
                  <span className="font-medium text-red-600">- {formatCurrency(discount, 2)}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between text-base">
                  <span className="text-gray-500">Imposto ({taxRate}%)</span>
                  <span className="font-medium">{formatCurrency(taxAmount, 2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold border-t pt-2">
                <span className="text-white">Total</span>
                <span className="text-red-400">{formatCurrency(total, 2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/invoices')}
            className="px-6 py-3 border border-white/[0.08] rounded-lg text-base font-medium hover:bg-white/[0.03]">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-3 bg-red-600 text-white rounded-lg text-base font-medium hover:bg-red-700 disabled:opacity-50">
            <Save className="w-5 h-5" />
            {saving ? 'Salvando...' : isEditing ? 'Salvar AlteraÃ§Ãµes' : 'Emitir Nota Fiscal'}
          </button>
        </div>
      </form>
    </div>
  );
}
