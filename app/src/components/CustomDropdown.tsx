import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
}

interface CustomDropdownProps<T extends string | number> {
  label?: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function CustomDropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className = '',
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between bg-[#141418] border border-[#25252c] hover:border-[#383844] rounded-xl px-3.5 py-2.5 text-xs text-white uppercase tracking-wider transition-all cursor-pointer focus:outline-none focus:border-[#c7ff36] shadow-sm select-none"
      >
        <span className="truncate pr-2 font-medium">{selectedOption?.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} className="text-[#8e8e93]" />
        </motion.div>
      </motion.button>

      {/* Animated Dropdown Menu (Requirement 13) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#121216] border border-[#26262e] rounded-xl shadow-2xl py-1.5 max-h-60 overflow-y-auto backdrop-blur-md"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-xs uppercase tracking-wide text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#1e2712] text-[#c7ff36] font-semibold'
                      : 'text-neutral-300 hover:bg-[#1a1a20] hover:text-white'
                  }`}
                >
                  <span className="truncate pr-2">{opt.label}</span>
                  {isSelected && <Check size={13} className="text-[#c7ff36] shrink-0" />}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
