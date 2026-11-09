import React from 'react';
import { House, Search, Plus, LibraryBig } from 'lucide-react';
import type { ActiveView } from './Sidebar';
export function MobileNavigation({ activeView, onNavigate, onSearch }: { activeView: ActiveView; onNavigate: (view: ActiveView) => void; onSearch: () => void }) {
  return <nav aria-label="Navigazione rapida mobile" className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#2b3522] bg-[#0d120a]/95 backdrop-blur-md grid grid-cols-4 px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))]">
    {([{ name: 'Per te', view: 'esperienze', icon: House }, { name: 'Cerca', view: undefined, icon: Search }, { name: 'Aggiungi', view: 'aggiungi', icon: Plus }, { name: 'Archivio', view: 'classifica', icon: LibraryBig }] as const).map(item => <button key={item.name} aria-current={item.view === activeView ? 'page' : undefined} onClick={() => item.view ? onNavigate(item.view) : onSearch()} className={`flex flex-col items-center gap-1 py-2 text-[11px] rounded-xl ${item.view === activeView ? 'text-[#c7ff36] bg-[#203012]' : 'text-[#9ba98f]'}`}><item.icon size={20} /><span>{item.name}</span></button>)}
  </nav>;
}
