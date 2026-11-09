import React, { useState } from 'react';
import { Mic2, Music } from 'lucide-react';

interface ArtistAvatarProps {
  imageUrl?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  iconOnly?: boolean;
}

export const ArtistAvatar: React.FC<ArtistAvatarProps> = ({
  imageUrl,
  name = 'Artista',
  size = 'md',
  className = '',
  iconOnly = false,
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-20 h-20',
    xl: 'w-28 h-28 sm:w-32 sm:h-32',
    '2xl': 'w-36 h-36 sm:w-44 sm:h-44',
  };

  const iconSizes = {
    xs: 12,
    sm: 14,
    md: 18,
    lg: 30,
    xl: 44,
    '2xl': 56,
  };

  const hasValidImage = Boolean(imageUrl && imageUrl.trim() && !hasError && !iconOnly);

  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 border border-[#222228] bg-[#141418] flex items-center justify-center select-none shadow-sm ${
        sizeClasses[size]
      } ${className}`}
    >
      {hasValidImage ? (
        <img
          src={imageUrl}
          alt={name}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        /* Neutral modern graphic placeholder - NEVER initial letters (Requirement 3) */
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a20] to-[#101014] text-[#6b6b76]">
          {size === 'xs' || size === 'sm' ? (
            <Music size={iconSizes[size]} className="opacity-70" />
          ) : (
            <Mic2 size={iconSizes[size]} className="opacity-60" />
          )}
        </div>
      )}
    </div>
  );
};
