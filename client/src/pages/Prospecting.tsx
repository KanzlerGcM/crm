import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Building2, Loader2, MapPin, Globe, Phone as PhoneIcon, ExternalLink } from 'lucide-react';
import type { CnpjResult } from '@/lib/types';

interface MapsResult {
  place_id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  email?: string;
  category?: string;
  opening_hours?: string;
  lat: number;
  lon: number;
  maps_url?: string;
}

export default function Prospecting() {
  const toast = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'cnpj' | 'maps'>('cnpj');

  // CNPJ Lookup
  const [cnpjQuery, setCnpjQuery] = useState('');
  const [cnpjResult, setCnpjResult] = useState<CnpjResult | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  // Maps Search
  const [mapsQuery, setMapsQuery] = useState('');
  const [mapsCity, setMapsCity] = useState('');
  const [mapsResults, setMapsResults] = useState<MapsResult[]>([]);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsSearched, setMapsSearched] = useState(false);

  // ---------- CNPJ ----------

  const handleCnpjLookup = async () => {
    const clean = cnpjQuery.replace(/[^\d]/g, '');
    if (clean.length !== 14) {
      toast.error('CNPJ deve ter 14 dígitos');
      return;
    }
    setCnpjLoading(true);
    setCnpjResult(null);
    try {
      const data = await api.cnpj.lookup(clean) as CnpjResult;
      setCnpjResult(data);
    } catch (err) {
      toast.error((err as Error).message || 'CNPJ não encontrado');
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleImportCnpj = async () => {
    if (!cnpjResult) return;
    try {
      const clientData = {
        company_name: cnpjResult.trade_name || cnpjResult.legal_name || cnpjResult.company_name,
        contact_name: cnpjResult.partners?.[0]?.name || cnpjResult.company_name,
        email: cnpjResult.email || '',
        phone: cnpjResult.phone || '',
        cnpj: cnpjResult.cnpj || '',
        address: cnpjResult.address || '',
        city: cnpjResult.city || '',
        state: cnpjResult.state || '',
        source: 'cnpj_lookup',
        status: 'prospect',
        notes: `Importado via CNPJ\nRazão Social: ${cnpjResult.legal_name}\nAtividade: ${cnpjResult.main_activity}\nSituação: ${cnpjResult.status}\nAbertura: ${cnpjResult.opening_date}`,
      };
      const newClient = await api.clients.create(clientData);
      toast.success('Empresa importada como cliente!');
      navigate(`/clients/${newClient.id}`);
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao importar');
    }
  };

  const formatCnpj = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  };

  // ---------- Maps ----------

  const handleMapsSearch = async () => {
    if (!mapsQuery.trim()) {
      toast.error('Informe o tipo de negócio');
      return;
    }
    setMapsLoading(true);
    setMapsResults([]);
    setMapsSearched(true);
    try {
      const data = await api.maps.search(mapsQuery, mapsCity || undefined);
      setMapsResults((data.results || []) as unknown as MapsResult[]);
      if ((data.results || []).length === 0) {
        toast.warning('Nenhum resultado encontrado', 'Tente outro termo ou cidade');
      }
    } catch (err) {
      toast.error((err as Error).message || 'Erro na busca');
    } finally {
      setMapsLoading(false);
    }
  };

  const handleImportMaps = async (result: MapsResult) => {
    try {
      const clientData = {
        company_name: result.name,
        contact_name: result.name,
        email: result.email || '',
        phone: result.phone || '',
        address: result.address || '',
        website: result.website || '',
        source: 'maps_search',
        status: 'prospect',
        notes: `Importado via busca no mapa\nCategoria: ${result.category || 'N/A'}\nHorário: ${result.opening_hours || 'N/A'}\nCoordenadas: ${result.lat}, ${result.lon}`,
      };
      const newClient = await api.clients.create(clientData);
      toast.success('Empresa importada!', result.name);
      navigate(`/clients/${newClient.id}`);
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao importar');
    }
  };

  // ---------- Render ----------

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Prospecção</h1>
        <p className="text-gray-400 mt-1">Consulte empresas pelo CNPJ ou busque no mapa</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.04] rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('cnpj')}
          className={`px-5 py-2.5 rounded-md text-base font-medium transition-colors ${
            activeTab === 'cnpj' ? 'bg-[#14171D] text-red-300 shadow-md shadow-black/20' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Building2 className="w-4 h-4 inline mr-2" />
          Consulta CNPJ
        </button>
        <button
          onClick={() => setActiveTab('maps')}
          className={`px-5 py-2.5 rounded-md text-base font-medium transition-colors ${
            activeTab === 'maps' ? 'bg-[#14171D] text-red-300 shadow-md shadow-black/20' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <MapPin className="w-4 h-4 inline mr-2" />
          Buscar Empresas
        </button>
      </div>

      {/* CNPJ Tab */}
      {activeTab === 'cnpj' && (
        <div className="space-y-6">
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm text-gray-500 mb-1 block">CNPJ da empresa</label>
              <input
                type="text" value={cnpjQuery}
                onChange={e => setCnpjQuery(formatCnpj(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && handleCnpjLookup()}
                className="input-base font-mono text-lg" placeholder="00.000.000/0000-00" maxLength={18}
              />
            </div>
            <button onClick={handleCnpjLookup} disabled={cnpjLoading} className="btn-primary whitespace-nowrap">
              {cnpjLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Consultar
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-2">Consulta gratuita via ReceitaWS (limite: 3 consultas/minuto)</p>
        </div>

        {cnpjResult && (
          <div className="card p-7 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-200">{cnpjResult.trade_name || cnpjResult.legal_name}</h3>
                {cnpjResult.trade_name && cnpjResult.legal_name !== cnpjResult.trade_name && (
                  <p className="text-sm text-gray-500">{cnpjResult.legal_name}</p>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${cnpjResult.status === 'ATIVA' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {cnpjResult.status}
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block">CNPJ</span>
                <span className="font-mono font-medium">{cnpjResult.cnpj}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Tipo</span>
                <span>{cnpjResult.type}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Abertura</span>
                <span>{cnpjResult.opening_date}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Capital Social</span>
                <span>{cnpjResult.share_capital ? `R$ ${Number(cnpjResult.share_capital).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'}</span>
              </div>
              {cnpjResult.email && (
                <div>
                  <span className="text-gray-500 block">E-mail</span>
                  <span>{cnpjResult.email}</span>
                </div>
              )}
              {cnpjResult.phone && (
                <div>
                  <span className="text-gray-500 block">Telefone</span>
                  <span>{cnpjResult.phone}</span>
                </div>
              )}
              <div className="md:col-span-2">
                <span className="text-gray-500 block">Endereço</span>
                <span>{[cnpjResult.address, cnpjResult.neighborhood, cnpjResult.city, cnpjResult.state].filter(Boolean).join(' - ')}</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-gray-500 block">Atividade Principal</span>
                <span>{cnpjResult.main_activity}</span>
              </div>
            </div>

            {cnpjResult.partners?.length > 0 && (
              <div>
                <h4 className="text-base font-semibold text-gray-500 mb-2">Sócios</h4>
                <div className="space-y-1.5">
                  {(cnpjResult.partners as Array<{ name: string; role: string }>).map((p, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 bg-red-500/15 rounded-full flex items-center justify-center text-xs font-bold text-red-300">
                        {p.name?.charAt(0)}
                      </div>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-gray-400 text-sm">({p.role})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t">
              <button onClick={handleImportCnpj} className="btn-primary">
                <Plus className="w-4 h-4" /> Importar como Cliente
              </button>
            </div>
          </div>
        )}

        {!cnpjResult && !cnpjLoading && (
          <div className="card p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Digite um CNPJ para consultar dados da empresa</p>
            <p className="text-sm text-gray-400 mt-1">Os dados são obtidos da Receita Federal</p>
          </div>
        )}
      </div>
      )}

      {/* Maps Tab */}
      {activeTab === 'maps' && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm text-gray-500 mb-1 block">Tipo de negócio</label>
                <input
                  type="text" value={mapsQuery}
                  onChange={e => setMapsQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleMapsSearch()}
                  className="input-base text-lg" placeholder="Ex: restaurante, clínica, loja de roupas..."
                />
              </div>
              <div className="flex-1">
                <label className="text-sm text-gray-500 mb-1 block">Cidade / Localização</label>
                <input
                  type="text" value={mapsCity}
                  onChange={e => setMapsCity(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleMapsSearch()}
                  className="input-base text-lg" placeholder="Ex: São Paulo, Curitiba..."
                />
              </div>
              <button onClick={handleMapsSearch} disabled={mapsLoading} className="btn-primary whitespace-nowrap">
                {mapsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Buscar
              </button>
            </div>
            <p className="text-sm text-gray-400 mt-2">Busca via OpenStreetMap — Resultados podem variar conforme a região</p>
          </div>

          {mapsResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">{mapsResults.length} resultado(s) encontrado(s)</p>
              <div className="grid gap-3 md:grid-cols-2">
                {mapsResults.map((result) => (
                  <div key={result.place_id} className="card p-5 space-y-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-200">{result.name}</h3>
                        {result.category && (
                          <span className="text-xs px-2 py-0.5 bg-red-500/10 text-red-300 rounded-full">{result.category}</span>
                        )}
                      </div>
                      {result.maps_url && (
                        <a href={result.maps_url} target="_blank" rel="noopener noreferrer"
                          className="text-gray-400 hover:text-red-400 flex-shrink-0" title="Abrir no mapa">
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      )}
                    </div>

                    <div className="space-y-1.5 text-sm">
                      {result.address && (
                        <p className="text-gray-500 flex items-center gap-2">
                          <MapPin className="w-4 h-4 flex-shrink-0" /> {result.address}
                        </p>
                      )}
                      {result.phone && (
                        <p className="text-gray-500 flex items-center gap-2">
                          <PhoneIcon className="w-4 h-4 flex-shrink-0" /> {result.phone}
                        </p>
                      )}
                      {result.website && (
                        <p className="text-gray-500 flex items-center gap-2">
                          <Globe className="w-4 h-4 flex-shrink-0" />
                          <a href={result.website.startsWith('http') ? result.website : `https://${result.website}`}
                            target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline truncate">
                            {result.website}
                          </a>
                        </p>
                      )}
                      {result.opening_hours && (
                        <p className="text-gray-400 text-sm">{result.opening_hours}</p>
                      )}
                    </div>

                    <div className="pt-2 border-t">
                      <button onClick={() => handleImportMaps(result)} className="btn-primary text-sm py-2">
                        <Plus className="w-4 h-4" /> Importar como Cliente
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mapsSearched && mapsResults.length === 0 && !mapsLoading && (
            <div className="card p-12 text-center">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum resultado encontrado</p>
              <p className="text-sm text-gray-400 mt-1">Tente outro tipo de negócio ou cidade</p>
            </div>
          )}

          {!mapsSearched && !mapsLoading && (
            <div className="card p-12 text-center">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Busque empresas por tipo de negócio e localização</p>
              <p className="text-sm text-gray-400 mt-1">Encontre leads próximos à sua área de atuação</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
