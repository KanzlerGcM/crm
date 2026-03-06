import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

export interface DropdownOption {
  id: number | string;
  label: string;
  sublabel?: string;
}

interface SearchableDropdownProps {
  /** Current selected value (option id) */
  value: string;
  /** Called when user selects an option */
  onChange: (value: string, option?: DropdownOption) => void;
  /** Async function to load/search options */
  onSearch: (term: string) => Promise<DropdownOption[]>;
  /** Placeholder for the search input */
  placeholder?: string;
  /** Label displayed above the input */
  label?: string;
  /** Initial display text (e.g. when editing) */
  displayValue?: string;
  /** Whether to show the "none" option */
  allowEmpty?: boolean;
  /** Text for the empty option */
  emptyLabel?: string;
  /** CSS class for the container */
  className?: string;
  /** Debounce delay in ms */
  debounceMs?: number;
}

export default function SearchableDropdown({
  value,
  onChange,
  onSearch,
  placeholder = 'Buscar...',
  label,
  displayValue = '',
  allowEmpty = true,
  emptyLabel = 'Nenhum',
  className = '',
  debounceMs = 300,
}: SearchableDropdownProps) {
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [searchText, setSearchText] = useState(displayValue);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync displayValue changes (e.g. when editing an existing item)
  useEffect(() => {
    setSearchText(displayValue);
  }, [displayValue]);

  // Load initial options
  useEffect(() => {
    onSearch('').then(setOptions).catch(err => console.error('SearchableDropdown: initial load failed', err));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleSearch = useCallback((term: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(term);
        setOptions(results);
      } catch (err) {
        console.error('SearchableDropdown: search failed', err);
      }
    }, debounceMs);
  }, [onSearch, debounceMs]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearchText(v);
    setShowDropdown(true);
    if (v.length >= 2) {
      handleSearch(v);
    } else if (!v) {
      onChange('');
      onSearch('').then(setOptions).catch(() => {});
    }
  };

  const handleSelect = (option: DropdownOption) => {
    onChange(String(option.id), option);
    setSearchText(option.label);
    setShowDropdown(false);
  };

  const handleClear = () => {
    onChange('');
    setSearchText('');
    onSearch('').then(setOptions).catch(() => {});
  };

  return (
    <div className={className}>
      {label && <label className="block text-base font-medium text-gray-600 mb-1.5">{label}</label>}
      <div className="relative" ref={dropdownRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchText}
          onChange={handleInputChange}
          onFocus={() => setShowDropdown(true)}
          className="input-base pl-9 pr-8"
          placeholder={placeholder}
          autoComplete="off"
        />
        {value && (
          <button type="button" onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
        {showDropdown && options.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-[#14171D] border border-white/[0.06] rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {allowEmpty && (
              <button type="button"
                onClick={() => { onChange(''); setSearchText(''); setShowDropdown(false); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-white/[0.03]">
                {emptyLabel}
              </button>
            )}
            {options.map(opt => (
              <button type="button" key={opt.id}
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-red-500/10 ${
                  String(opt.id) === value ? 'bg-red-500/10 text-red-300 font-medium' : 'text-gray-300'
                }`}>
                {opt.label}
                {opt.sublabel && <span className="text-gray-400 ml-1">— {opt.sublabel}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
