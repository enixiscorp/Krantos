// ============================================================
// Krantos Platform - Product picture with a clean fallback
// ============================================================
// Shows the whole product (object-contain, no cropping) and falls back to a
// neutral placeholder when there is no image or the link is broken.

import { useEffect, useState, type ReactNode } from 'react';
import { ImageIcon } from 'lucide-react';

export function ProductImage(props: {
  src?: string | null;
  alt: string;
  className?: string;
  /** Placeholder content; defaults to an image icon. */
  fallback?: ReactNode;
}) {
  const { src, alt, className = '', fallback } = props;
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  if (!src || broken) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        {fallback ?? <ImageIcon className="w-10 h-10 text-white/10" />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`w-full h-full object-contain p-3 ${className}`}
    />
  );
}
