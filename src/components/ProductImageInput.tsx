// ============================================================
// Krantos Platform — Product image field: pick a file OR paste a link
// ============================================================
// A pasted link is checked visually: the image is really loaded in the
// browser, and common "page" links (Google Images, Drive, Dropbox) are turned
// into direct image links. The form must not save while the link is invalid.

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ImageIcon, Link2, Loader2, Upload, X, AlertCircle } from 'lucide-react';
import {
  IMAGE_LINK_NOT_AN_IMAGE,
  checkImageLoads,
  normalizeProductImageUrl,
  validateProductImageFile,
  validateProductImageUrl,
} from '../services/productImageService';

export type ImageLinkStatus = 'idle' | 'checking' | 'ok' | 'error';

export interface ProductImageValue {
  /** File chosen from the device (takes priority over the link). */
  file: File | null;
  /** Pasted image link, or the product's current image URL. */
  url: string;
  /** Result of the visual check of `url` (absent = not checked yet). */
  urlStatus?: ImageLinkStatus;
}

/** Message to show when the form must not be saved yet, or null when it can. */
export function productImageBlockingReason(value: ProductImageValue): string | null {
  if (value.file || !value.url.trim()) return null;
  if (value.urlStatus === 'checking') return "Vérification de l'image en cours, patientez une seconde.";
  if (value.urlStatus === 'error') return IMAGE_LINK_NOT_AN_IMAGE;
  return validateProductImageUrl(value.url);
}

export function ProductImageInput(props: {
  value: ProductImageValue;
  onChange: (value: ProductImageValue) => void;
  accent?: 'yellow' | 'cyan';
}) {
  const { value, onChange, accent = 'yellow' } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState('');

  // Keep the latest value/onChange for the async link check
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  const filePreview = useMemo(() => (value.file ? URL.createObjectURL(value.file) : null), [value.file]);
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview); }, [filePreview]);

  const link = value.file ? '' : value.url.trim();
  const linkFormatError = link ? validateProductImageUrl(link) : null;
  const directLink = link && !linkFormatError ? normalizeProductImageUrl(link) : '';

  // Visual check of the pasted link (debounced)
  useEffect(() => {
    if (!directLink) return;
    let cancelled = false;
    const update = (urlStatus: ImageLinkStatus, url?: string) => {
      const { value: v, onChange: emit } = latest.current;
      if (v.file || v.url.trim() !== link) return; // value changed meanwhile
      emit({ ...v, url: url ?? v.url, urlStatus });
    };
    update('checking');
    const timer = setTimeout(async () => {
      const ok = await checkImageLoads(directLink);
      if (cancelled) return;
      // Replace a page link (Drive, Google…) by its direct image link
      update(ok ? 'ok' : 'error', ok && directLink !== link ? directLink : undefined);
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directLink]);

  const status: ImageLinkStatus = linkFormatError ? 'error' : (value.urlStatus ?? 'idle');
  const preview = filePreview ?? (directLink && status === 'ok' ? directLink : null);

  const ring = accent === 'cyan' ? 'focus-within:border-cyan-400/50' : 'focus-within:border-yellow-400/50';
  const hover = accent === 'cyan' ? 'hover:border-cyan-400/40' : 'hover:border-yellow-400/40';
  const linkBorder = !link ? 'border-white/10' : status === 'ok' ? 'border-green-500/40' : status === 'error' ? 'border-red-500/40' : 'border-white/10';

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    const err = validateProductImageFile(file);
    setFileError(err ?? '');
    if (!err) onChange({ file, url: '', urlStatus: undefined });
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
        className={`relative aspect-square max-h-72 w-full rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden bg-white/[0.02] ${preview ? 'border-transparent' : `border-white/10 ${hover}`}`}
      >
        {preview ? (
          <>
            <img src={preview} alt="Aperçu du produit" referrerPolicy="no-referrer" className="w-full h-full object-contain p-2" />
            <button
              type="button"
              title="Retirer l'image"
              onClick={(e) => { e.stopPropagation(); setFileError(''); onChange({ file: null, url: '', urlStatus: undefined }); }}
              className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 text-white hover:bg-red-500 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : status === 'checking' ? (
          <>
            <Loader2 className="w-8 h-8 text-gray-500 animate-spin mb-3" />
            <p className="text-sm font-bold text-gray-400">Vérification de l'image…</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
              <ImageIcon className="w-7 h-7 text-gray-600" />
            </div>
            <p className="text-sm font-bold text-gray-400">Cliquez ou déposez une image</p>
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

      <div className={`flex items-center gap-3 bg-white/5 border rounded-2xl px-4 py-3 transition-all ${linkBorder} ${ring}`}>
        <Link2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <input
          type="url"
          inputMode="url"
          value={value.file ? '' : value.url}
          placeholder="Coller le lien de l'image (https://…)"
          onChange={(e) => onChange({ file: null, url: e.target.value, urlStatus: undefined })}
          className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm min-w-0"
        />
        {link && status === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />}
        {link && status === 'ok' && <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />}
        {link && status === 'error' && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
      </div>

      {value.file && <p className="text-[11px] text-gray-500">Fichier sélectionné : {value.file.name}</p>}
      {link && status === 'ok' && <p className="text-[11px] font-bold text-green-400">Image valide, elle s'affichera sur la fiche produit.</p>}
      {link && status === 'error' && (
        <p className="text-[11px] font-bold text-red-400">{linkFormatError ?? IMAGE_LINK_NOT_AN_IMAGE}</p>
      )}
      {fileError && <p className="text-xs font-bold text-red-400">{fileError}</p>}
    </div>
  );
}
