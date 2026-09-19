import React from 'react';
import { ArrowDownCircle } from 'lucide-react';

interface DownloadBadgeProps {
  quality?: string | null;
  className?: string;
  size?: number;
  showTooltip?: boolean;
}

export const DownloadBadge: React.FC<DownloadBadgeProps> = ({
  quality,
  className = '',
  size = 14,
  showTooltip = true,
}) => {
  const isHigh = quality === '320' || quality === 'high' || !quality; // default to high if not specified

  const tooltipText = isHigh
    ? 'Downloaded in High Quality (320 kbps)'
    : quality === '48' || quality === 'ultra'
    ? 'Downloaded in Ultra Saver (48 kbps)'
    : 'Downloaded in Data Saver (96 kbps)';

  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
      title={showTooltip ? tooltipText : undefined}
    >
      <ArrowDownCircle
        style={{ width: size, height: size }}
        className={
          isHigh
            ? 'text-emerald-400 fill-emerald-500/20 stroke-[2.2]'
            : 'text-sky-400 fill-sky-500/20 stroke-[2.2]'
        }
      />
    </span>
  );
};
