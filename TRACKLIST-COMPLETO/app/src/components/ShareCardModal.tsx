import { motion } from 'motion/react';
import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import { Album } from '../types';
import { calculateAlbumStats, formatRating } from '../utils/musicMath';

interface ShareCardModalProps {
  album: Album | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  album,
  isOpen,
  onClose,
}) => {

  const [aspect, setAspect] = useState<'1:1' | '9:16' | '16:9'>('1:1');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stats = calculateAlbumStats(album?.tracks || []);

  useEffect(() => {
    if (!isOpen || !album) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsReady(false);
    setDownloadError('');
    let cancelled = false;

    let width = 1080;
    let height = 1080;
    if (aspect === '9:16') {
      width = 1080;
      height = 1920;
    } else if (aspect === '16:9') {
      width = 1920;
      height = 1080;
    }

    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, width, height);

    // Subtle border
    ctx.strokeStyle = '#202025';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // Logo at top
    ctx.fillStyle = '#c7ff36';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('((•)) TRACKLIST', 80, 110);
    ctx.fillStyle = '#66666f';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('ARCHIVIO MUSICALE', 80, 140);

    // Load image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const draw = (withCover: boolean) => {
      if (cancelled) return;
      const coverSize = aspect === '9:16' ? 440 : 360;
      const coverX = 80;
      const coverY = aspect === '9:16' ? 240 : 200;

      // Draw rounded cover
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, 24);
      ctx.clip();
      if (withCover) ctx.drawImage(img, coverX, coverY, coverSize, coverSize);
      else { ctx.fillStyle = '#202025'; ctx.fillRect(coverX, coverY, coverSize, coverSize); }
      ctx.restore();

      // Titles
      const textX = aspect === '16:9' ? 500 : 80;
      const textY = aspect === '16:9' ? 260 : coverY + coverSize + 80;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px Georgia, serif';
      ctx.fillText(album.title.slice(0, 22), textX, textY);

      ctx.fillStyle = '#a3a3a3';
      ctx.font = '32px sans-serif';
      ctx.fillText(album.artistName, textX, textY + 50);

      ctx.fillStyle = '#66666f';
      ctx.font = '22px monospace';
      ctx.fillText(
        `${album.year} · ${album.tracks.length} TRACCE · ${album.editionType.toUpperCase()}`,
        textX,
        textY + 100
      );

      // Score
      ctx.fillStyle = '#c7ff36';
      ctx.font = 'bold 84px Georgia, serif';
      ctx.fillText(formatRating(stats.averageRating), textX, textY + 200);

      ctx.fillStyle = '#8e8e93';
      ctx.font = '20px sans-serif';
      ctx.fillText('VOTO MEDIO TRACCIA PER TRACCIA', textX, textY + 240);

      // Top tracks snippet
      if (stats.topTracks.length > 0 && aspect !== '1:1') {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText('BRANI MIGLIORI', textX, textY + 310);

        stats.topTracks.slice(0, 3).forEach((tr, i) => {
          ctx.fillStyle = '#e4e4e7';
          ctx.font = '22px sans-serif';
          ctx.fillText(`${i + 1}. ${tr.title}`, textX, textY + 360 + i * 40);

          ctx.fillStyle = '#c7ff36';
          ctx.font = 'bold 22px monospace';
          ctx.fillText(formatRating(tr.rating, 2), textX + 400, textY + 360 + i * 40);
        });
      }
      setIsReady(true);
    };
    img.onload = () => draw(true);
    img.onerror = () => draw(false);
    if (album.coverUrl) img.src = album.coverUrl;
    else draw(false);
    return () => { cancelled = true; };
  }, [album, aspect, isOpen]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !album || !isReady) return;
    let url: string;
    try { url = canvas.toDataURL('image/png'); }
    catch { setDownloadError('Impossibile esportare la copertina remota. Carica una copertina locale e riprova.'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracklist-${album.title.toLowerCase().replace(/\s+/g, '-')}-${aspect}.png`;
    a.click();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  if (!isOpen || !album) return null;

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div data-motion-panel className="bg-[#111114] border border-[#26262c] rounded-3xl p-6 sm:p-8 max-w-2xl w-full flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[#1c1c20] mb-6">
          <h3 className="font-editorial text-2xl text-white">Condividi Grafica (2.0)</h3>
          <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
            onClick={onClose}
            className="text-[#66666f] hover:text-white p-1 transition-colors cursor-pointer"
          >
            <X size={18} />
          </motion.button>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="flex gap-2 p-1 bg-[#16161a] border border-[#222227] rounded-xl mb-6 self-center">
          {(['1:1', '9:16', '16:9'] as const).map((r) => (
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              key={r}
              onClick={() => setAspect(r)}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                aspect === r ? 'bg-[#22222a] text-[#c7ff36]' : 'text-[#8e8e93] hover:text-white'
              }`}
            >
              {r === '1:1' ? 'Quadrato (1:1)' : r === '9:16' ? 'Storie (9:16)' : 'Orizzontale (16:9)'}
            </motion.button>
          ))}
        </div>

        {/* Canvas Preview */}
        <div className="flex items-center justify-center bg-[#09090b] rounded-2xl p-4 border border-[#1e1e23] mb-6 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="max-h-[380px] w-auto max-w-full rounded-xl shadow-2xl object-contain border border-[#26262c]"
          />
        </div>

        {downloadError && <p className="text-sm text-red-300" role="alert">{downloadError}</p>}
        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#77777f] hover:text-white uppercase font-semibold"
          >
            Chiudi
          </motion.button>
          <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
            type="button"
            onClick={handleDownload}
            disabled={!isReady}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 transition-all cursor-pointer shadow-sm"
          >
            {downloadSuccess ? <Check size={14} /> : <Download size={14} />}
            <span>{downloadSuccess ? 'Scaricata!' : 'Scarica PNG'}</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
};
