import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { PageSpeedResult, StrategyData } from '@/lib/types';
import {
  Gauge, Globe, Smartphone, Monitor, Loader2, Download, Trash2,
  TrendingUp, Eye, ShieldCheck, Search, BarChart3, Clock, Zap,
  RefreshCw, AlertTriangle, CheckCircle,
} from 'lucide-react';

interface Opportunity {
  title: string; description: string; displayValue: string; score: number;
}

function scoreColor(score: number) {
  if (score >= 90) return { text: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: 'ring-emerald-200/60', gradient: 'from-emerald-50 to-emerald-100/50', iconBg: 'bg-emerald-500/10' };
  if (score >= 50) return { text: 'text-amber-600', bg: 'bg-amber-500/10', ring: 'ring-amber-200/60', gradient: 'from-amber-50 to-amber-100/50', iconBg: 'bg-amber-500/10' };
  return { text: 'text-red-500', bg: 'bg-red-500/10', ring: 'ring-red-200/60', gradient: 'from-red-50 to-red-100/50', iconBg: 'bg-red-500/10' };
}
function scoreLabel(s: number) { return s >= 90 ? 'Excelente' : s >= 70 ? 'Bom' : s >= 50 ? 'Melhorar' : 'Crítico'; }

const METRICS: Record<string, { label: string; icon: typeof Zap; desc: string }> = {
  fcp: { label: 'Primeira Renderização', icon: Zap, desc: 'Tempo para o 1º conteúdo aparecer' },
  lcp: { label: 'Maior Elemento', icon: Eye, desc: 'Tempo para o conteúdo principal aparecer' },
  tbt: { label: 'Tempo Bloqueado', icon: Clock, desc: 'Tempo em que a página trava (não responde)' },
  cls: { label: 'Estabilidade Visual', icon: BarChart3, desc: 'Elementos se movem na tela?' },
  si:  { label: 'Velocidade de Exibição', icon: TrendingUp, desc: 'Rapidez que o conteúdo aparece' },
  tti: { label: 'Tempo até Funcionar', icon: Gauge, desc: 'Quando a página responde a cliques' },
};

type SavedReport = PageSpeedResult & { id: number };

export default function PageSpeed() {
  const toast = useToast();
  const [url, setUrl] = useState(() => sessionStorage.getItem('ps_url') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PageSpeedResult | null>(() => {
    try {
      const saved = sessionStorage.getItem('ps_result');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => { loadReports(); }, []);

  // Persist result to sessionStorage so alt-tab doesn't lose it
  useEffect(() => {
    if (result) sessionStorage.setItem('ps_result', JSON.stringify(result));
    sessionStorage.setItem('ps_url', url);
  }, [result, url]);

  const loadReports = async () => {
    try {
      setLoadingReports(true);
      setReports(await api.pagespeed.reports() as SavedReport[]);
    } catch { /* silent */ } finally { setLoadingReports(false); }
  };

  const handleAnalyze = async () => {
    if (!url.trim()) return toast.warning('Digite uma URL para analisar');
    setLoading(true);
    setResult(null);
    try {
      const data = await api.pagespeed.analyze(url.trim());
      setResult(data);
      const mP = data.mobile?.scores?.performance ?? 0;
      const dP = data.desktop?.scores?.performance ?? 0;
      toast.success(`Análise concluída — Celular: ${mP} | Computador: ${dP}`);
      loadReports();
    } catch (err) {
      const msg = (err as Error).message || 'Erro ao analisar';
      const linkMatch = msg.match(/(https:\/\/console[^\s]+)/);
      if (linkMatch) {
        toast.error('API PageSpeed não ativada no Google Cloud');
        window.open(linkMatch[1], '_blank');
      } else {
        toast.error(msg);
      }
    } finally { setLoading(false); }
  };

  const handleDownloadPdf = async () => {
    if (!result) return;
    try { await api.pagespeed.downloadPdf(result as unknown as Record<string, unknown>); toast.success('PDF gerado'); }
    catch { toast.error('Erro ao gerar PDF'); }
  };

  const handleDownloadSavedPdf = async (id: number) => {
    try { await api.pagespeed.downloadReportPdf(id); toast.success('PDF baixado'); }
    catch { toast.error('Erro ao baixar PDF'); }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.pagespeed.deleteReport(id);
      setReports(prev => prev.filter(r => r.id !== id));
      toast.success('Relatório excluído');
    } catch { toast.error('Erro ao excluir'); }
  };

  const mobile = result?.mobile;
  const desktop = result?.desktop;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Gauge className="w-8 h-8 text-red-400" />
            PageSpeed Insights
          </h1>
          <p className="text-gray-400 mt-1">Analise a performance de sites — Celular e Computador</p>
        </div>
        {result && (
          <div className="flex gap-2">
            <button onClick={handleDownloadPdf} className="btn-secondary">
              <Download className="w-5 h-5" /> Baixar PDF
            </button>
            <button onClick={handleAnalyze} className="btn-primary">
              <RefreshCw className="w-5 h-5" /> Reanalisar
            </button>
          </div>
        )}
      </div>

      {/* ── Analysis Form ── */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-red-400" /> Analisar Site
        </h2>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
              placeholder="https://exemplo.com.br"
              className="input-base"
              disabled={loading}
            />
          </div>
          <button onClick={handleAnalyze} disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {loading ? 'Analisando...' : 'Analisar'}
          </button>
        </div>

        {loading && (
          <div className="mt-6 flex flex-col items-center py-10">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-base font-medium text-gray-300">Consultando Google PageSpeed Insights...</p>
            <p className="text-sm text-gray-400 mt-1">Analisando versão celular e computador — pode levar até 2 minutos</p>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {result && mobile && desktop && !loading && (
        <>
          {/* URL info bar */}
          <div className="bg-red-500/10 border border-red-500/20/60 rounded-xl px-5 py-3 flex items-center gap-3">
            <Globe className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-sm font-medium text-red-300 truncate flex-1">{result.url}</span>
            <div className="flex gap-1.5">
              <span className="badge badge-contacted flex items-center gap-1"><Smartphone className="w-3 h-3" /> Celular</span>
              <span className="badge badge-proposal_sent flex items-center gap-1"><Monitor className="w-3 h-3" /> Computador</span>
            </div>
          </div>

          {/* Score Comparison — Side by side */}
          <div className="grid md:grid-cols-2 gap-4">
            <StrategyScoreCard title="Celular" icon={<Smartphone className="w-5 h-5" />} data={mobile} />
            <StrategyScoreCard title="Computador" icon={<Monitor className="w-5 h-5" />} data={desktop} />
          </div>

          {/* Detailed Metrics Table */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-400" /> Métricas Detalhadas
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#111318] border-b border-white/[0.04]">
                    <th className="text-left py-3 px-4 font-semibold text-gray-300">Métrica</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-300">
                      <span className="flex items-center justify-center gap-1"><Smartphone className="w-3.5 h-3.5" /> Celular</span>
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-300">
                      <span className="flex items-center justify-center gap-1"><Monitor className="w-3.5 h-3.5" /> Computador</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(METRICS).map(([key, meta]) => {
                    const Icon = meta.icon;
                    const mVal = String(mobile.metrics?.[key] ?? '-');
                    const dVal = String(desktop.metrics?.[key] ?? '-');
                    const mScore = Number(mobile.metrics?.[key + '_score'] ?? 50);
                    const dScore = Number(desktop.metrics?.[key + '_score'] ?? 50);
                    return (
                      <tr key={key} className="border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-red-500/15 rounded-lg flex items-center justify-center">
                              <Icon className="w-4 h-4 text-red-300" />
                            </div>
                            <div>
                              <p className="font-medium text-white">{meta.label}</p>
                              <p className="text-sm text-gray-400">{meta.desc}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-base font-bold ${scoreColor(mScore).text}`}>{mVal}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-base font-bold ${scoreColor(dScore).text}`}>{dVal}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Opportunities — side by side */}
          <div className="grid lg:grid-cols-2 gap-6 stagger-children">
            <OppList title="Oportunidades — Celular" icon={<Smartphone className="w-4 h-4" />} items={mobile.opportunities as Opportunity[]} />
            <OppList title="Oportunidades — Computador" icon={<Monitor className="w-4 h-4" />} items={desktop.opportunities as Opportunity[]} />
          </div>

          {/* Diagnostics merge */}
          {((mobile.diagnostics?.length || 0) + (desktop.diagnostics?.length || 0)) > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-red-400" /> Diagnósticos
              </h2>
              <div className="grid md:grid-cols-2 gap-3">
                {[...(mobile.diagnostics || []).map(d => ({ ...d, from: 'Celular' })),
                  ...(desktop.diagnostics || []).map(d => ({ ...d, from: 'Computador' }))]
                  .filter((d, i, arr) => arr.findIndex(x => x.title === d.title) === i)
                  .map((diag, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                    <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-violet-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{diag.title}</p>
                        <span className="text-xs text-gray-400">({diag.from})</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">
                        {diag.description?.replace(/\[.*?\]\(.*?\)/g, '').substring(0, 120)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Saved Reports ── */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-400" /> Histórico de Análises
          </h2>
          {reports.length > 0 && (
            <span className="text-sm font-medium text-gray-400">{reports.length} relatório(s)</span>
          )}
        </div>

        {loadingReports ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <Gauge className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-base">Nenhuma análise salva ainda</p>
            <p className="text-sm text-gray-300 mt-1">Analise um site acima para começar</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {reports.map((r) => {
              const mob = r.mobile || (r.scores ? { scores: r.scores } as any : null);
              const desk = r.desktop || (r.scores ? { scores: r.scores } as any : null);
              const mPerf = mob?.scores?.performance ?? 0;
              const dPerf = desk?.scores?.performance ?? 0;
              return (
                <div key={r.id} className="flex items-center gap-4 py-3 hover:bg-white/[0.03] -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-white truncate">{r.url}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                        <Smartphone className="w-3 h-3" /> {mPerf}
                      </span>
                      <span className="text-xs text-gray-300">/</span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600">
                        <Monitor className="w-3 h-3" /> {dPerf}
                      </span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">
                        {new Date(r.created_at!).toLocaleDateString('pt-BR')}{' '}
                        {new Date(r.created_at!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5">
                    <ScorePill label="Cel" score={mPerf} />
                    <ScorePill label="PC" score={dPerf} />
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDownloadSavedPdf(r.id)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Baixar PDF">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StrategyScoreCard({ title, icon, data }: { title: string; icon: React.ReactNode; data: StrategyData }) {
  const cats = [
    { label: 'Performance', score: data.scores.performance, icon: TrendingUp },
    { label: 'Acessibilidade', score: data.scores.accessibility, icon: Eye },
    { label: 'Boas Práticas', score: data.scores.bestPractices, icon: ShieldCheck },
    { label: 'SEO', score: data.scores.seo, icon: Search },
  ];
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-gray-200">
        {icon} {title}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {cats.map(item => {
          const c = scoreColor(item.score);
          return (
            <div key={item.label} className={`bg-gradient-to-br ${c.gradient} rounded-xl p-3.5 border border-white/60`}>
              <div className="flex items-center gap-2 mb-1">
                <item.icon className={`w-4 h-4 ${c.text}`} />
                <span className="text-sm text-gray-500">{item.label}</span>
              </div>
              <p className={`text-2xl font-bold ${c.text}`}>{item.score}</p>
              <p className="text-sm text-gray-400 mt-0.5">{scoreLabel(item.score)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OppList({ title, icon, items }: { title: string; icon: React.ReactNode; items: Opportunity[] }) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-400" /> {title}
        {icon}
        <span className="ml-auto text-xs font-medium text-gray-400">{items.length} item(s)</span>
      </h2>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((opp, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5 border-b border-white/[0.06] last:border-0">
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${opp.score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white truncate">{opp.title}</p>
                  {opp.displayValue && <span className="badge badge-contacted text-xs !py-0.5 !px-2 flex-shrink-0">{opp.displayValue}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <CheckCircle className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Nenhuma oportunidade</p>
        </div>
      )}
    </div>
  );
}

function ScorePill({ label, score }: { label: string; score: number }) {
  const c = scoreColor(score);
  return (
    <div className={`${c.bg} ring-1 ${c.ring} rounded-full px-2.5 py-1 text-center min-w-[52px]`}>
      <p className={`text-xs font-bold ${c.text}`}>{score}</p>
      <p className="text-xs text-gray-400 leading-none">{label}</p>
    </div>
  );
}
