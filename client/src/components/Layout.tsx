import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket, useRealtimeRefresh } from '@/contexts/SocketContext';
import {
  LayoutDashboard, Users, FileText, LogOut, Menu, X, Clock, Settings,
  Mail, Search, Columns3, CheckSquare, CreditCard, Bell, Receipt,
  CalendarDays, ChevronRight, Gauge, Wifi, WifiOff, Activity, FileEdit,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import chevlaLogo from '@/assets/chevla-logo.webp';
import GlobalSearch from './GlobalSearch';
import { api } from '@/lib/api';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban', icon: Columns3, label: 'Pipeline' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/contracts', icon: FileText, label: 'Contratos' },
  { to: '/tasks', icon: CheckSquare, label: 'Tarefas' },
  { to: '/follow-ups', icon: Clock, label: 'Follow-ups' },
  { to: '/financial', icon: CreditCard, label: 'Financeiro' },
  { to: '/invoices', icon: Receipt, label: 'Notas Fiscais' },
  { to: '/calendar', icon: CalendarDays, label: 'Agenda' },
  { to: '/prospecting', icon: Search, label: 'Prospecção' },
  { to: '/email', icon: Mail, label: 'E-mail' },
  { to: '/email-templates', icon: FileEdit, label: 'Templates Email' },
  { to: '/pagespeed', icon: Gauge, label: 'PageSpeed' },
  { to: '/activity-log', icon: Activity, label: 'Log de Atividades' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { connected, onlineUsers } = useSocket();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  const fetchNotifications = useCallback(() => {
    api.analytics.notifications()
      .then((data) => setAlertCount(data?.counts?.total || 0))
      .catch(err => console.error('Notification fetch error', err));
  }, []);

  // Initial fetch + refresh on any data change via WebSocket
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useRealtimeRefresh(['client', 'contract', 'task', 'payment', 'calendar_event'], fetchNotifications);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-[#0D0F13]">
      {/* ═══ Sidebar - Desktop (War Command) ═══ */}
      <aside className="hidden lg:flex lg:flex-col w-[310px] bg-sidebar fixed h-full z-30 overflow-hidden border-r border-white/[0.04]">
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/[0.03] via-transparent to-transparent pointer-events-none" />

        {/* Logo */}
        <div className="relative p-5 flex items-center gap-3">
          <div className="bg-white/95 rounded-xl px-2.5 py-1.5 shadow-md shadow-black/20">
            <img src={chevlaLogo} alt="Chevla" className="h-9 w-auto" />
          </div>
          <div>
            <p className="text-lg font-black text-white tracking-[0.2em]">PROSPECTOR</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(255,23,68,0.5)]" />
              <p className="text-sm text-red-400/60 font-bold uppercase tracking-widest">Warzone</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative px-4 pb-4">
          <GlobalSearch variant="dark" />
        </div>

        {/* Nav */}
        <nav className="relative flex-1 px-3 space-y-1 overflow-y-auto dark-scroll">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-3.5 px-4 py-3 rounded-xl text-lg font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_12px_rgba(255,23,68,0.06)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`
              }
            >
              <Icon className="w-[22px] h-[22px] flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity" />
            </NavLink>
          ))}

          {/* Notifications */}
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `group flex items-center gap-3.5 px-4 py-3 rounded-xl text-lg font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`
            }
          >
            <div className="relative">
              <Bell className="w-[22px] h-[22px]" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-sidebar shadow-[0_0_6px_rgba(255,23,68,0.5)]">
                  {alertCount > 9 ? '!' : alertCount}
                </span>
              )}
            </div>
            <span className="flex-1">Notificações</span>
            {alertCount > 0 && (
              <span className="text-xs font-bold bg-red-500/15 text-red-400 px-2 py-0.5 rounded font-mono">{alertCount}</span>
            )}
          </NavLink>
        </nav>

        {/* User + Status */}
        <div className="relative p-4 border-t border-white/[0.04]">
          {/* Connection */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'bg-red-500 animate-pulse shadow-[0_0_6px_rgba(255,23,68,0.5)]'}`} />
            <span className="text-sm text-gray-500">{connected ? 'Online' : 'Reconectando…'}</span>
            {onlineUsers.length > 0 && (
              <div className="ml-auto flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {onlineUsers.slice(0, 4).map((u) => (
                    <div key={u.id} title={u.name}
                      className="w-5 h-5 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center ring-1 ring-sidebar text-[8px] font-bold text-white">
                      {u.name?.charAt(0)?.toUpperCase()}
                    </div>
                  ))}
                </div>
                <span className="text-sm text-gray-500">{onlineUsers.length} online</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/20">
              <span className="text-base font-bold text-white">{user?.name?.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-gray-200 truncate">{user?.name}</p>
              <p className="text-base text-gray-500">{user?.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-2 flex-1 px-3 py-2.5 rounded-lg text-lg transition-all ${
                  isActive ? 'bg-white/[0.06] text-gray-300' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                }`
              }
            >
              <Settings className="w-5 h-5" />
              Config.
            </NavLink>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* ═══ Mobile Overlay ═══ */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ═══ Sidebar - Mobile ═══ */}
      <aside className={`
        fixed top-0 left-0 h-full w-80 bg-sidebar z-50 transform transition-transform duration-300 lg:hidden border-r border-white/[0.04]
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/95 rounded-lg px-2 py-1">
              <img src={chevlaLogo} alt="Chevla" className="h-8 w-auto" />
            </div>
            <p className="text-lg font-black text-white tracking-[0.2em]">PROSPECTOR</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06]">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="px-3 py-2 space-y-1 overflow-y-auto dark-scroll" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-3 rounded-xl text-lg font-medium transition-all ${
                  isActive ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`
              }
            >
              <Icon className="w-[22px] h-[22px]" />
              {label}
            </NavLink>
          ))}
          <NavLink to="/notifications" onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-4 py-3 rounded-xl text-lg font-medium transition-all ${
                isActive ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`
            }>
            <Bell className="w-[22px] h-[22px]" />
            Notificações
            {alertCount > 0 && <span className="ml-auto text-sm font-bold bg-red-500/15 text-red-400 px-2 py-0.5 rounded font-mono">{alertCount}</span>}
          </NavLink>
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/[0.04]">
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10">
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 lg:ml-[310px]">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-[#0D0F13]/90 backdrop-blur-xl border-b border-white/[0.04] px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors text-gray-400">
            <Menu className="w-5 h-5" />
          </button>
          <img src={chevlaLogo} alt="Chevla" className="h-8 w-auto bg-white/90 rounded px-1.5 py-0.5" />
          <p className="text-sm font-black text-white tracking-[0.15em]">PROSPECTOR</p>
        </header>

        <main className="p-5 md:p-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
