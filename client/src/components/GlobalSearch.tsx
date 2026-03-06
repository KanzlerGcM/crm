import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Search, Users, FileText, CheckSquare, X, Loader2 } from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  client: Users,
  contract: FileText,
  task: CheckSquare,
};

const LABEL_MAP: Record<string, string> = {
  client: 'Cliente',
  contract: 'Contrato',
  task: 'Tarefa',
};

const LINK_MAP: Record<string, (id: number) => string> = {
  client: (id) => `/clients/${id}`,
  contract: (id) => `/contracts/${id}`,
  task: () => `/tasks`,
};

export default function GlobalSearch({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDark = variant === 'dark';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
        setResults([]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setResults([]); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.analytics.search(value) as { results?: Array<{ entity_type?: string; type?: string; link?: string; id: number; name?: string }> };
        setResults(data.results || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  };

  const handleSelect = (item: { entity_type?: string; type?: string; link?: string; id: number }) => {
    const type = item.entity_type || item.type || '';
    const link = item.link || LINK_MAP[type]?.(item.id) || '/';
    navigate(link);
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all w-full ${
          isDark
            ? 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10'
            : 'bg-white/[0.04] hover:bg-white/10 text-gray-400'
        }`}
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className={`hidden sm:inline text-[10px] px-1.5 py-0.5 rounded font-mono ${
          isDark ? 'bg-white/10 text-gray-500 border border-white/10' : 'bg-[#14171D] px-1.5 py-0.5 rounded border border-white/[0.06]'
        }`}>Ctrl+K</kbd>
      </button>

      {/* Search Panel */}
      {open && (
        <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-xl z-50 min-w-[320px] max-w-md overflow-hidden ${
          isDark ? 'bg-sidebar-light border-white/10' : 'bg-[#14171D] border-white/[0.06]'
        }`}>
          <div className={`flex items-center gap-2 px-4 py-3 border-b ${
            isDark ? 'border-white/10' : 'border-white/[0.04]'
          }`}>
            <Search className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar clientes, contratos, tarefas..."
              className={`flex-1 bg-transparent outline-none text-sm placeholder-gray-500 ${
                isDark ? 'text-gray-200' : 'text-gray-300'
              }`}
              autoFocus
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults([]); }} className={isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : results.length > 0 ? (
              <div className="py-2">
                {results.map((item, i) => {
                  const type = item.entity_type || item.type;
                  const Icon = ICON_MAP[type] || Search;
                  return (
                    <button
                      key={`${type}-${item.id}-${i}`}
                      onClick={() => handleSelect(item)}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
                        isDark ? 'hover:bg-white/5' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isDark ? 'bg-white/10' : 'bg-white/[0.04]'
                      }`}>
                        <Icon className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-300'}`}>{item.label || item.title}</p>
                        <p className="text-xs text-gray-500">{LABEL_MAP[type] || type}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : query.length >= 2 ? (
              <p className="text-sm text-gray-500 text-center py-8">Nenhum resultado para "{query}"</p>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">Digite ao menos 2 caracteres</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
