import { motion } from 'motion/react';
import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { readAndCompressImage } from '../utils/imageUtils';

interface ImageUploadInputProps {
  label: string;
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  aspectRatio?: 'square' | 'portrait' | 'video';
  className?: string;
}

export const ImageUploadInput: React.FC<ImageUploadInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'https://... o carica un file locale',
  aspectRatio = 'square',
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const dataUrl = await readAndCompressImage(file);
      onChange(dataUrl);
    } catch (err: any) {
      setError(err?.message || 'Impossibile caricare l\'immagine.');
    } finally {
      setIsLoading(false);
      // Reset input value so the same file can be re-selected if wanted
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    onChange('');
    setError(null);
  };

  const isLocalUpload = value.startsWith('data:image/');

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-semibold text-[#8e8e93] tracking-widest uppercase">
          {label}
        </label>
        {isLocalUpload && (
          <span className="text-[10px] font-mono text-[#c7ff36] uppercase tracking-wider bg-[#c7ff36]/10 px-2 py-0.5 rounded-full">
            Caricato da locale
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Thumbnail Preview */}
        <div
          onClick={handleTriggerUpload}
          title="Clicca per caricare una nuova foto da locale"
          className={`relative group shrink-0 rounded-xl overflow-hidden bg-[#18181c] border border-[#2a2a32] flex items-center justify-center cursor-pointer hover:border-[#c7ff36] transition-all shadow-sm ${
            aspectRatio === 'square' ? 'w-14 h-14' : 'w-14 h-18'
          }`}
        >
          {value ? (
            <>
              <img src={value} alt="Anteprima" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Upload size={14} className="text-[#c7ff36]" />
              </div>
            </>
          ) : (
            <ImageIcon size={18} className="text-[#55555e] group-hover:text-[#c7ff36] transition-colors" />
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
              <Loader2 size={16} className="text-[#c7ff36] animate-spin" />
            </div>
          )}
        </div>

        {/* URL Input & Upload Action */}
        <div className="flex-1 min-w-0 w-full space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={isLocalUpload ? 'Foto locale caricata' : value}
              disabled={isLocalUpload}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={`flex-1 min-w-0 basis-28 bg-[#161619] border border-[#26262c] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#55555e] focus:outline-none focus:border-[#c7ff36] transition-colors ${
                isLocalUpload ? 'text-[#a3e635] bg-[#161c16] border-[#2d4023]' : ''
              }`}
            />

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Upload Button */}
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="button"
              onClick={handleTriggerUpload}
              disabled={isLoading}
              title="Carica un'immagine dal tuo computer o smartphone"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#222228] hover:bg-[#2d2d35] text-white text-xs font-semibold tracking-wider uppercase transition-colors shrink-0 cursor-pointer border border-[#33333e]"
            >
              <Upload size={13} className="text-[#c7ff36]" />
              <span className="hidden sm:inline">Carica file</span>
            </motion.button>

            {/* Clear Button */}
            {value && (
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                type="button"
                onClick={handleClear}
                title="Rimuovi immagine"
                className="p-2.5 rounded-xl bg-[#1b1b20] hover:bg-red-950/40 text-[#77777f] hover:text-red-400 transition-colors shrink-0 cursor-pointer border border-[#26262c]"
              >
                <X size={14} />
              </motion.button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#66666f]">
            <span>Supporta JPG, PNG, WEBP · Incolla URL o carica da file</span>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
};
