import React, { useState } from 'react';
import { X, Eye, EyeOff, Loader2, Lock, Mail, User, Sparkles, CheckCircle2, Cloud, LogOut, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { storage } from '../services/storage';
import { AuthUser } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  required?: boolean;
  onClose: () => void;
  onAuthSuccess?: (user: AuthUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess, required = false }) => {
  const currentAuthUser = storage.getAuthUser();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'account'>(
    currentAuthUser ? 'account' : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setPassword('');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Inserisci un indirizzo email valido.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('La password deve contenere almeno 6 caratteri.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          name: name.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Errore durante la registrazione.');
      }

      storage.setAuthToken(data.token);
      storage.setAuthUser(data.user);

      // Update local profile with account credentials
      storage.saveProfile({
        id: data.user.id || storage.getProfile().id,
        name: data.user.name,
        email: data.user.email,
        avatarUrl: data.user.avatarUrl || '',
      });

      setSuccessMsg('Account creato. Il tuo archivio personale è pronto.');
      setTimeout(() => {
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Errore imprevisto durante la registrazione.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Inserisci la tua email.');
      return;
    }
    if (!password) {
      setErrorMsg('Inserisci la password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Credenziali non valide.');
      }

      storage.setAuthToken(data.token);
      storage.setAuthUser(data.user);

      await storage.loadLegacyCatalog();

      // Synchronize data from cloud
      const pulled = await storage.pullFromCloud();
      if (!pulled) {
        // If no cloud data yet, migrate current local state to cloud
        await storage.pushToCloud();
      }

      // Update profile view name & email
      storage.saveProfile({
        id: data.user.id || storage.getProfile().id,
        name: data.user.name,
        email: data.user.email,
        avatarUrl: data.user.avatarUrl || '',
      });

      setSuccessMsg('Accesso effettuato con successo!');
      setTimeout(() => {
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Accesso non riuscito.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Inserisci la tua email per il recupero.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Recupero password non disponibile.');
      setSuccessMsg(data.message || 'Se l\'email è registrata, abbiamo inviato il link di recupero.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Errore nella richiesta di recupero.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const pushed = await storage.pushToCloud();
      if (pushed && storage.getSyncStatus() === 'synced') {
        setSuccessMsg('Sincronizzazione completata! I tuoi voti e le personalizzazioni sono allineati sul cloud.');
      } else {
        setErrorMsg('Impossibile sincronizzare al momento. Verifica la connessione.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Errore durante la sincronizzazione.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    await storage.pushToCloud();
    try {
      const token = storage.getAuthToken();
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignore
    }
    storage.setAuthToken(null);
    storage.setAuthUser(null);
    setMode('login');
    resetForm();
    setSuccessMsg('Disconnessione completata.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md bg-[#0f0f13] border border-[#22222a] rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden"
      >
        {/* Close Button */}
        {!required && <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#18181f] border border-[#25252e] flex items-center justify-center text-[#8e8e93] hover:text-white transition-colors cursor-pointer"
          aria-label="Chiudi finestra"
        >
          <X size={16} />
        </motion.button>}

        {/* Brand header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full border border-[#c7ff36]/60 flex items-center justify-center p-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#c7ff36]" />
            </div>
            <span className="font-semibold text-xs tracking-[0.25em] text-[#c7ff36] uppercase">
              TRACKLIST ACCOUNT
            </span>
          </div>
          <h2 className="font-editorial text-2xl sm:text-3xl text-white font-normal">
            {mode === 'account' && 'Account & Sincronizzazione'}
            {mode === 'login' && 'Accedi al tuo profilo'}
            {mode === 'register' && 'Crea il tuo account'}
            {mode === 'forgot' && 'Recupera password'}
          </h2>
          <p className="text-xs text-[#8e8e93] mt-1 font-light">
            {mode === 'account' && 'Il tuo catalogo, valutazioni e artisti personalizzati sono sincronizzati con il cloud.'}
            {mode === 'login' && 'Sincronizza voti, bozze e schede artista su tutti i tuoi dispositivi.'}
            {mode === 'register' && 'Crea il tuo archivio personale: aggiungerai solo gli album che desideri.'}
            {mode === 'forgot' && 'Riceverai le istruzioni per impostare una nuova password.'}
          </p>
        </div>

        {/* Tab Switcher (Login / Register) */}
        {mode !== 'forgot' && mode !== 'account' && (
          <div className="grid grid-cols-2 p-1 bg-[#15151b] border border-[#22222a] rounded-xl mb-6">
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="button"
              onClick={() => {
                setMode('login');
                resetForm();
              }}
              className={`py-2 rounded-lg text-xs font-semibold tracking-wider transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#22222b] text-white shadow-sm'
                  : 'text-[#77777f] hover:text-white'
              }`}
            >
              ACCEDI
            </motion.button>
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="button"
              onClick={() => {
                setMode('register');
                resetForm();
              }}
              className={`py-2 rounded-lg text-xs font-semibold tracking-wider transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#22222b] text-[#c7ff36] shadow-sm'
                  : 'text-[#77777f] hover:text-white'
              }`}
            >
              REGISTRATI
            </motion.button>
          </div>
        )}

        {/* Mode Account Details */}
        {mode === 'account' && currentAuthUser && (
          <div className="space-y-4 mb-4">
            <div className="p-4 rounded-2xl bg-[#14141a] border border-[#23232e] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8e8e96]">Utente Connesso</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#c7ff36] bg-[#c7ff36]/10 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c7ff36]" />
                  Attivo
                </span>
              </div>
              <p className="text-sm font-semibold text-white truncate">{currentAuthUser.name || 'Utente Tracklist'}</p>
              <p className="text-xs text-[#a3a3a8] font-mono truncate">{currentAuthUser.email}</p>
            </div>

            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="w-full py-3 rounded-full bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(199,255,54,0.18)]"
            >
              {isSyncing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={15} />
              )}
              <span>{isSyncing ? 'Sincronizzazione in corso...' : 'Sincronizza Ora'}</span>
            </motion.button>

            <div className="flex items-center justify-between pt-2">
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                type="button"
                onClick={() => {
                  setMode('login');
                  resetForm();
                }}
                className="text-xs text-[#8e8e96] hover:text-white transition-colors cursor-pointer"
              >
                Accedi con un altro account
              </motion.button>
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                <LogOut size={13} />
                <span>Disconnetti</span>
              </motion.button>
            </div>
          </div>
        )}

        {/* Error / Success Feedback */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-[#11240c] border border-[#274f14] text-[#c7ff36] text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Forms */}
        {mode === 'login' && (
          <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-1.5">
                EMAIL
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="latua@email.it"
                  required
                  className="w-full bg-[#16161c] border border-[#262630] focus:border-[#c7ff36] rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-[#44444e] focus:outline-none transition-colors"
                />
                <Mail size={15} className="absolute left-3.5 top-3.5 text-[#55555e]" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-[#66666f] tracking-widest uppercase">
                  PASSWORD
                </label>
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    resetForm();
                  }}
                  className="text-[11px] text-[#8e8e93] hover:text-[#c7ff36] transition-colors cursor-pointer"
                >
                  Password dimenticata?
                </motion.button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#16161c] border border-[#262630] focus:border-[#c7ff36] rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm text-white placeholder-[#44444e] focus:outline-none transition-colors"
                />
                <Lock size={15} className="absolute left-3.5 top-3.5 text-[#55555e]" />
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-[#66666f] hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </motion.button>
              </div>
            </div>

            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-full bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(199,255,54,0.15)]"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>{isLoading ? 'Accesso in corso...' : 'Accedi'}</span>
            </motion.button>
          </motion.form>
        )}

        {mode === 'register' && (
          <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-1.5">
                NOME VISUALIZZATO
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Il tuo nome o nickname"
                  className="w-full bg-[#16161c] border border-[#262630] focus:border-[#c7ff36] rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-[#44444e] focus:outline-none transition-colors"
                />
                <User size={15} className="absolute left-3.5 top-3.5 text-[#55555e]" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-1.5">
                EMAIL
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="latua@email.it"
                  required
                  className="w-full bg-[#16161c] border border-[#262630] focus:border-[#c7ff36] rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-[#44444e] focus:outline-none transition-colors"
                />
                <Mail size={15} className="absolute left-3.5 top-3.5 text-[#55555e]" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-1.5">
                PASSWORD (MINIMO 6 CARATTERI)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-[#16161c] border border-[#262630] focus:border-[#c7ff36] rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm text-white placeholder-[#44444e] focus:outline-none transition-colors"
                />
                <Lock size={15} className="absolute left-3.5 top-3.5 text-[#55555e]" />
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-[#66666f] hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </motion.button>
              </div>
            </div>

            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-full bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(199,255,54,0.15)]"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={14} />}
              <span>{isLoading ? 'Creazione account...' : 'Crea account & Sincronizza'}</span>
            </motion.button>
          </motion.form>
        )}

        {mode === 'forgot' && (
          <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-1.5">
                INSERISCI LA TUA EMAIL
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="latua@email.it"
                  required
                  className="w-full bg-[#16161c] border border-[#262630] focus:border-[#c7ff36] rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-[#44444e] focus:outline-none transition-colors"
                />
                <Mail size={15} className="absolute left-3.5 top-3.5 text-[#55555e]" />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 rounded-full bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>{isLoading ? 'Invio in corso...' : 'Invia istruzioni'}</span>
              </motion.button>

              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                type="button"
                onClick={() => {
                  setMode('login');
                  resetForm();
                }}
                className="px-4 py-3 text-xs font-semibold tracking-wider text-[#8e8e93] hover:text-white uppercase transition-colors cursor-pointer"
              >
                Annulla
              </motion.button>
            </div>
          </motion.form>
        )}
      </motion.div>
    </div>
  );
};
