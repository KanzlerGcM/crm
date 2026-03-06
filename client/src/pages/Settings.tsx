import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import { Settings as SettingsIcon, Lock, User, UserPlus, Shield, Eye, EyeOff, Save, Mail, CheckCircle2, Power, RefreshCw } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Create user state (admin only)
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'user' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Email settings
  const [emailSettings, setEmailSettings] = useState({
    smtp_host: '', smtp_port: 587, imap_host: '', imap_port: 993,
    email_address: '', email_password: '', from_name: 'Chevla',
  });
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    loadEmailSettings();
  }, []);

  const loadEmailSettings = async () => {
    try {
      const data = await api.email.getSettings();
      if (data?.smtp_host) {
        setEmailSettings(prev => ({ ...prev, ...data, email_password: '' }));
      }
    } catch (err) { console.error('Failed to load email settings', err); }
  };

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSettings.smtp_host || !emailSettings.email_address || !emailSettings.email_password) {
      toast.error('Preencha host SMTP, e-mail e senha');
      return;
    }
    setSavingEmail(true);
    try {
      await api.email.saveSettings(emailSettings);
      toast.success('Configurações de e-mail salvas');
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao salvar');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      await api.email.test();
      toast.success('Conexão SMTP verificada com sucesso!');
    } catch (err) {
      toast.error((err as Error).message || 'Falha na conexão');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    setChangingPassword(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      toast.success('Senha alterada com sucesso');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao alterar senha');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.name) {
      toast.error('Preencha todos os campos');
      return;
    }
    setCreatingUser(true);
    try {
      await api.auth.register(newUser);
      toast.success(`Usuário "${newUser.username}" criado`);
      setNewUser({ username: '', password: '', name: '', role: 'user' });
      loadUsers();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao criar usuário');
    } finally {
      setCreatingUser(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.auth.users();
      setUsers(data);
    } catch {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoadingUsers(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-red-400" />
          Configurações
        </h1>
        <p className="text-gray-400 mt-1">Gerencie sua conta e preferências</p>
      </div>

      {/* Profile Info */}
      <div className="card p-7 space-y-5">
        <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
          <User className="w-5 h-5" />
          Perfil
        </h2>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-base text-gray-500">Nome</p>
            <p className="text-lg font-medium">{user?.name}</p>
          </div>
          <div>
            <p className="text-base text-gray-500">Usuário</p>
            <p className="text-lg font-medium">{user?.username}</p>
          </div>
          <div>
            <p className="text-base text-gray-500">Função</p>
            <p className="text-lg font-medium">
              <span className={`badge ${user?.role === 'admin' ? 'bg-red-500/15 text-red-300' : 'bg-white/[0.04] text-gray-300'}`}>
                {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card p-7 space-y-5">
        <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Alterar Senha
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-5">
          <div>
            <label className="block text-base font-medium text-gray-600 mb-1.5">Senha Atual</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-base pr-10"
                required
              />
              <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" tabIndex={-1}>
                {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Nova Senha</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-base"
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Confirmar Nova Senha</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`input-base ${confirmPassword && newPassword !== confirmPassword ? 'border-red-300 focus:ring-red-500' : ''}`}
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-red-500 mt-1">As senhas não coincidem</p>
              )}
            </div>
          </div>
          <button type="submit" disabled={changingPassword} className="btn-primary">
            <Save className="w-5 h-5" />
            {changingPassword ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </form>
      </div>

      {/* Email Settings */}
      <div className="card p-7 space-y-5">
        <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Configurações de E-mail
        </h2>
        <p className="text-sm text-gray-500">Configure seu e-mail Hostinger (ou outro provedor) para enviar e receber e-mails pelo Prospector.</p>
        <form onSubmit={handleSaveEmailSettings} className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Host SMTP</label>
              <input type="text" value={emailSettings.smtp_host} onChange={e => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })} className="input-base" placeholder="smtp.hostinger.com" required />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Porta SMTP</label>
              <input type="number" value={emailSettings.smtp_port} onChange={e => setEmailSettings({ ...emailSettings, smtp_port: Number(e.target.value) })} className="input-base" placeholder="587" />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Host IMAP</label>
              <input type="text" value={emailSettings.imap_host} onChange={e => setEmailSettings({ ...emailSettings, imap_host: e.target.value })} className="input-base" placeholder="imap.hostinger.com" />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Porta IMAP</label>
              <input type="number" value={emailSettings.imap_port} onChange={e => setEmailSettings({ ...emailSettings, imap_port: Number(e.target.value) })} className="input-base" placeholder="993" />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">E-mail</label>
              <input type="email" value={emailSettings.email_address} onChange={e => setEmailSettings({ ...emailSettings, email_address: e.target.value })} className="input-base" placeholder="contato@seudominio.com" required />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Senha do E-mail</label>
              <input type="password" value={emailSettings.email_password} onChange={e => setEmailSettings({ ...emailSettings, email_password: e.target.value })} className="input-base" placeholder="••••••••" required />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-600 mb-1.5">Nome do Remetente</label>
              <input type="text" value={emailSettings.from_name} onChange={e => setEmailSettings({ ...emailSettings, from_name: e.target.value })} className="input-base" placeholder="Chevla" />
            </div>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-4 text-sm text-blue-400">
            <p className="font-medium mb-1">Para Hostinger, use:</p>
            <p>SMTP: smtp.hostinger.com (porta 465 ou 587)</p>
            <p>IMAP: imap.hostinger.com (porta 993)</p>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={savingEmail} className="btn-primary">
              <Save className="w-5 h-5" />
              {savingEmail ? 'Salvando...' : 'Salvar Configurações'}
            </button>
            <button type="button" onClick={handleTestEmail} disabled={testingEmail} className="btn-secondary">
              <CheckCircle2 className="w-5 h-5" />
              {testingEmail ? 'Testando...' : 'Testar Conexão'}
            </button>
          </div>
        </form>
      </div>

      {/* Admin: Create User */}
      {user?.role === 'admin' && (
        <>
          <div className="card p-7 space-y-5">
            <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Criar Novo Usuário
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-base font-medium text-gray-600 mb-1.5">Nome Completo</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="input-base"
                    placeholder="Nome do colaborador"
                    required
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-600 mb-1.5">Usuário</label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="input-base"
                    placeholder="Login"
                    required
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-600 mb-1.5">Senha</label>
                  <input
                    type="text"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="input-base"
                    placeholder="Senha inicial"
                    required
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-600 mb-1.5">Função</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="input-base"
                  >
                    <option value="user">Usuário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={creatingUser} className="btn-primary">
                <UserPlus className="w-5 h-5" />
                {creatingUser ? 'Criando...' : 'Criar Usuário'}
              </button>
            </form>
          </div>

          {/* Admin: Users List */}
          <div className="card p-7 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Usuários do Sistema
              </h2>
              <button onClick={loadUsers} className="text-base text-red-400 hover:text-red-300">
                {loadingUsers ? 'Carregando...' : 'Carregar lista'}
              </button>
            </div>
            {users.length > 0 && (
              <div className="divide-y divide-white/[0.04]">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${u.active !== 0 ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-white/10'}`}>
                        <span className="text-base font-bold text-white">{u.name?.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-lg font-medium">{u.name}</p>
                        <p className="text-base text-gray-500">@{u.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${u.role === 'admin' ? 'bg-red-500/15 text-red-300' : 'bg-white/[0.04] text-gray-300'}`}>
                        {u.role === 'admin' ? 'Admin' : 'Usuário'}
                      </span>
                      <span className={`badge ${u.active !== 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {u.active !== 0 ? 'Ativo' : 'Inativo'}
                      </span>
                      {u.id !== user?.id && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                await api.auth.toggleUserActive(u.id);
                                toast.success(u.active !== 0 ? 'Usuário desativado' : 'Usuário ativado');
                                loadUsers();
                              } catch { toast.error('Erro ao alterar status'); }
                            }}
                            title={u.active !== 0 ? 'Desativar' : 'Ativar'}
                            className={`p-1.5 rounded-lg transition-colors ${u.active !== 0 ? 'text-red-500 hover:bg-red-500/10' : 'text-green-500 hover:bg-green-500/10'}`}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const newRole = u.role === 'admin' ? 'user' : 'admin';
                                await api.auth.changeUserRole(u.id, newRole);
                                toast.success(`Função alterada para ${newRole === 'admin' ? 'Administrador' : 'Usuário'}`);
                                loadUsers();
                              } catch { toast.error('Erro ao alterar função'); }
                            }}
                            title={u.role === 'admin' ? 'Rebaixar para Usuário' : 'Promover a Admin'}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
