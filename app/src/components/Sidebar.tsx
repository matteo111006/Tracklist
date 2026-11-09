import React from 'react';
import {
  ListOrdered,
  Radio,
  Plus,
  GitCompare,
  Sparkles,
  Trophy,
  Bookmark,
  BarChart3,
  User,
  DownloadCloud,
  X,
  House,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { AuthUser } from '../types';
import { Cloud } from 'lucide-react';

export type ActiveView =
  | 'esperienze'
  | 'classifica'
  | 'nuove_uscite'
  | 'aggiungi'
  | 'confronto'
  | 'wrapped'
  | 'awards'
  | 'raccolte'
  | 'statistiche'
  | 'profilo'
  | 'album_detail'
  | 'artista_detail';

interface SidebarProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  unratedCount: number;
  onOpenImportExport: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  authUser?: AuthUser | null;
  onOpenAuth?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  unratedCount,
  onOpenImportExport,
  isMobileOpen,
  onCloseMobile,
  authUser,
  onOpenAuth,
}) => {
  const navItems = [
    { id: 'esperienze' as ActiveView, label: 'Per te', icon: House },
    { id: 'classifica' as ActiveView, label: 'Classifica', icon: ListOrdered },
    {
      id: 'nuove_uscite' as ActiveView,
      label: 'Album da valutare',
      icon: Radio,
      badge: unratedCount > 0 ? unratedCount : undefined,
    },
    { id: 'aggiungi' as ActiveView, label: 'Aggiungi', icon: Plus },
    { id: 'confronto' as ActiveView, label: 'Confronto', icon: GitCompare },
    { id: 'wrapped' as ActiveView, label: 'Wrapped', icon: Sparkles },
    { id: 'awards' as ActiveView, label: 'Awards', icon: Trophy },
    { id: 'statistiche' as ActiveView, label: 'Statistiche', icon: BarChart3 },
    { id: 'raccolte' as ActiveView, label: 'Raccolte', icon: Bookmark },
    { id: 'profilo' as ActiveView, label: 'Profilo', icon: User },
  ];

  const handleSelect = (view: ActiveView) => {
    onNavigate(view);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
            onClick={onCloseMobile}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[295px] bg-[#0d0d0f] border-r border-[#1a1a1e] flex flex-col justify-between py-6 px-5 transition-transform duration-250 ease-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 flex flex-col min-h-0">
          {/* Logo with tactile hover */}
          <div className="flex items-center justify-between mb-6 pl-1 shrink-0">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect('esperienze')}
              className="flex items-center gap-3 group text-left cursor-pointer focus:outline-none"
            >
              {/* Concentric circle lime icon */}
              <div className="w-7 h-7 rounded-full border border-[#c7ff36]/60 flex items-center justify-center p-0.5 group-hover:border-[#c7ff36] group-hover:shadow-[0_0_12px_rgba(199,255,54,0.35)] transition-all">
                <div className="w-4 h-4 rounded-full border border-[#c7ff36]/80 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#c7ff36] group-hover:scale-125 transition-transform" />
                </div>
              </div>

              <div>
                <div className="text-white font-medium text-[15px] tracking-[0.25em] leading-tight font-sans">
                  TRACKLIST
                </div>
                <div className="text-[#66666e] text-[10px] tracking-[0.25em] font-medium leading-tight mt-0.5">
                  ARCHIVIO MUSICALE
                </div>
              </div>
            </motion.button>

            {/* Mobile close button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onCloseMobile}
              className="lg:hidden p-1 text-neutral-400 hover:text-white"
              aria-label="Chiudi menu"
            >
              <X size={20} />
            </motion.button>
          </div>

          {/* Unified Navigation List (Exact items 1 through 10, no separate collapsible Tracklist 2.0 box) */}
          <nav className="space-y-1 relative overflow-y-auto pr-1" aria-label="Navigazione principale">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={`w-full relative flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-colors cursor-pointer select-none ${
                    isActive ? 'text-white font-medium' : 'text-[#8e8e93] hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavBackground"
                      className="absolute inset-0 bg-[#1a1a1f] rounded-lg -z-10 shadow-sm border border-[#25252d]"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}

                  <div className="flex items-center gap-3">
                    <Icon
                      size={18}
                      className={isActive ? 'text-[#c7ff36]' : 'text-[#8e8e93]'}
                      strokeWidth={isActive ? 2 : 1.75}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <motion.span
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className="tl-unrated-count text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#222228] text-[#c7ff36] border border-[#c7ff36]/20 font-medium"
                    >
                      {item.badge}
                    </motion.span>
                  )}
                </motion.button>
              );
            })}

            {/* Item 10: Import / Export in the exact unified list */}
            <motion.button
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onOpenImportExport();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-[#8e8e93] hover:text-white hover:bg-[#141417] transition-colors cursor-pointer select-none"
            >
              <DownloadCloud size={18} className="text-[#8e8e93]" strokeWidth={1.75} />
              <span>Import / Export</span>
            </motion.button>
          </nav>
        </div>

        {/* Cloud Sync Account Status (Requirement 11 & 13) */}
        <div className="pt-3 border-t border-[#18181d] px-1 shrink-0">
          {authUser ? (
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="button"
              onClick={() => {
                if (onOpenAuth) onOpenAuth();
                onCloseMobile();
              }}
              title="Account collegato. Clicca per sincronizzare o gestire l'account"
              className="w-full flex items-center justify-between py-2 px-2.5 rounded-xl bg-[#121217] hover:bg-[#181820] border border-[#202028] hover:border-[#c7ff36]/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#c7ff36] shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-xs text-[#a3a3a8] group-hover:text-white truncate font-medium">{authUser.email}</span>
              </div>
              <span className="text-[10px] font-mono text-[#c7ff36] uppercase tracking-wider shrink-0">Cloud ✓</span>
            </motion.button>
          ) : (
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="button"
              onClick={() => {
                if (onOpenAuth) onOpenAuth();
                onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#141419] hover:bg-[#1a1a22] border border-[#23232c] hover:border-[#c7ff36]/50 text-xs text-[#c7ff36] font-medium transition-all cursor-pointer shadow-sm"
            >
              <Cloud size={14} />
              <span>Accedi / Sincronizza</span>
            </motion.button>
          )}
        </div>

        {/* Footer Brand Quote */}
        <div className="pt-3 border-t border-[#161619] px-2 text-xs leading-relaxed shrink-0">
          <p className="text-[#a3a3a3] font-normal">Il tuo archivio di ascolti.</p>
          <p className="text-[#555558] text-[11px]">Un voto per traccia, la media fa il resto.</p>
        </div>
      </aside>
    </>
  );
};
