// ============================================================
// Krantos Platform — Product image field: pick a file OR paste a link
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageIcon, Link2, Upload, X } from 'lucide-react';
import { validateProductImageFile, validateProductImageUrl } from '../services/productImageService';

export interface ProductImageValue {
  /** File chosen from the device (takes priority over the link). */
  file: File | null;
  /** Pasted image link, or the product's current image URL. */
  url: string;
}

export function ProductImageInput(props: {
  value: ProductImageValue;
  onChange: (value: ProductImageValue) => void;
  accent?: 'yellow' | 'cyan';
}) {
  const { value, onChange, accent = 'yellow' } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [previewBroken, setPreviewBroken] = useState(false);

  const filePreview = useMemo(() => (value.file ? URL.createObjectURL(value.file) : null), [value.file]);
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview); }, [filePreview]);

  const preview = filePreview ?? (value.url.trim() && !validateProductImageUrl(value.url) ? value.url.trim() : null);
  useEffect(() => setPreviewBroken(false), [preview]);

  const ring = accent === 'cyan' ? 'focus-within:border-cyan-400/50' : 'focus-within:border-yellow-400/50';
  const hover = accent === 'cyan' ? 'hover:border-cyan-400/40' : 'hover:border-yellow-400/40';

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    const err = validateProductImageFile(file);
    setError(err ?? '');
    if (!err) onChange({ file, url: '' });
  };

  return (
    <div className="space-y-4 text-left">
      {/* Preview / drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}
        className={`relative aspect-square max-h-72 w-full rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${preview ? 'border-transparent' : `border-white/10 ${hover}`}`}
      >
        {preview && !previewBroken ? (
          <>
            <img src={preview} alt="Aperçu du produit" className="w-full h-full object-cover" onError={() => setPreviewBroken(true)} />
            <button
              type="button"
              title="Retirer l'image"
              onClick={(e) => { e.stopPropagation(); setError(''); onChange({ file: null, url: '' }); }}
              className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 text-white hover:bg-red-500 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
              <ImageIcon className="w-7 h-7 text-gray-600" />
            </div>
            <p className="text-sm font-bold text-gray-400">
              {previewBroken ? "Impossible d'afficher cette image" : 'Cliquez ou déposez une image'}
            </p>
            <p className="text-[10px] text-gray-600 mt-1 uppercase font-black">JPEG, PNG, WEBP · 5 Mo max</p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
      >
        <Upload className="w-4 h-4" />
        {value.file ? 'Changer le fichier' : "Téléverser depuis l'appareil"}
      </button>

      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-600">
        <span className="h-px flex-1 bg-white/10" /> ou <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className={`flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 transition-all ${ring}`}>
        <Link2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <input
          type="url"
          inputMode="url"
          value={value.file ? '' : value.url}
          placeholder="Coller le lien de l'image (https://…)"
          onChange={(e) => {
            const url = e.target.value;
            setError(validateProductImageUrl(url) ?? '');
            onChange({ file: null, url });
          }}
          className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
        />
      </div>
      {value.file && (
        <p className="text-[10px] text-gray-500">Fichier sélectionné : {value.file.name}</p>
      )}

      {error && <p className="text-xs font-bold text-red-400">{error}</p>}
    </div>
  );
}
