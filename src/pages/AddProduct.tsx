// ============================================================
// Krantos Platform — /add-product (Premium Dark Overhaul)
// Requirements: 12.1, 12.2, 12.4, 14.4
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Package,
  LayoutDashboard,
  Users,
  LogOut,
  Zap,
  Loader2,
  Upload,
  X,
  CheckCircle,
  ImageIcon,
  ArrowLeft,
  Plus,
  DollarSign,
  Info,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'Groupe électrogène',
  'Panneau solaire',
  'Onduleur',
  'Batterie',
  'Climatiseur',
  'Réfrigérateur',
  'Éclairage',
  'Électroménager',
  'Matériel électrique',
  'Autre',
];

const MAX_IMAGE_SIZE_MB = 5;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AddProduct = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    category: '',
    power_rating: '',
    price: '',
    description: '',
    keywords: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/business-login', { replace: true });
        return;
      }
      const userId = sessionData.session.user.id;
      const { data: vendorData } = await supabase.from('vendors').select('id, status').eq('profile_id', userId).single();
      if (!vendorData || vendorData.status !== 'active') {
        await supabase.auth.signOut();
        navigate('/business-login', { replace: true });
        return;
      }
      if (mounted) {
        setVendorId(vendorData.id);
        
        // Fetch products
        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .eq('vendor_id', vendorData.id)
          .order('created_at', { ascending: false });
          
        if (productsData) setProducts(productsData);

        setLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, [navigate]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Nom requis';
    if (!form.category) newErrors.category = 'Catégorie requise';
    if (!form.power_rating || parseFloat(form.power_rating) <= 0) newErrors.power_rating = 'Nombre positif requis';
    if (!form.price || parseFloat(form.price) <= 0) newErrors.price = 'Nombre positif requis';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Format non supporté (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setImageError(`Max ${MAX_IMAGE_SIZE_MB} Mo.`);
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !vendorId) return;
    setSubmitting(true);
    try {
      let productId = editingProductId;

      if (editingProductId) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: form.name.trim(),
            category: form.category,
            power_rating: parseFloat(form.power_rating),
            price: parseFloat(form.price),
            description: form.description.trim() || null,
            keywords: form.keywords.trim() || null,
          })
          .eq('id', editingProductId);
        if (updateError) throw updateError;
      } else {
        const { data: newProduct, error: insertError } = await supabase
          .from('products')
          .insert({
            vendor_id: vendorId,
            name: form.name.trim(),
            category: form.category,
            power_rating: parseFloat(form.power_rating),
            price: parseFloat(form.price),
            description: form.description.trim() || null,
            keywords: form.keywords.trim() || null,
            is_active: true,
          })
          .select('id')
          .single();
        if (insertError || !newProduct) throw insertError;
        productId = newProduct.id;
      }

      if (imageFile && productId) {
        setUploadingImage(true);
        const ext = imageFile.name.split('.').pop();
        const path = `${vendorId}/${productId}.${ext}`;
        await supabase.storage.from('product-images').upload(path, imageFile, { 
          upsert: true,
          cacheControl: '3600'
        });
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
        // Add timestamp as cache-buster to avoid stale cache
        const finalUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        await supabase.from('products').update({ image_url: finalUrl }).eq('id', productId);
        setUploadingImage(false);
      }

      // Refresh products
      const { data: updatedProducts } = await supabase.from('products').select('*').eq('vendor_id', vendorId).order('created_at', { ascending: false });
      if (updatedProducts) setProducts(updatedProducts);

      setSuccess(true);
      toast.success(editingProductId ? 'Produit mis à jour !' : 'Produit ajouté !');
      setForm({ name: '', category: '', power_rating: '', price: '', description: '', keywords: '' });
      setImagePreview(null); setImageFile(null);
      setEditingProductId(null);
    } catch (err) {
      toast.error('Erreur lors de l’ajout.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProductId(product.id);
    setForm({
      name: product.name,
      category: product.category,
      power_rating: product.power_rating.toString(),
      price: product.price.toString(),
      description: product.description || '',
      keywords: product.keywords || '',
    });
    setImagePreview(product.image_url || null);
    setImageFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts(products.filter(p => p.id !== id));
      toast.success('Produit supprimé.');
    } catch (err) {
      toast.error('Erreur lors de la suppression.');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      setProducts(products.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
      toast.success(currentStatus ? 'Produit masqué.' : 'Produit activé.');
    } catch (err) {
      toast.error('Erreur lors de la modification.');
    }
  };

  if (loading) return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <Link to="/business-dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Retour Dashboard
        </Link>
        <h1 className="text-4xl font-black text-white mb-2">{editingProductId ? 'Modifier le produit' : 'Ajouter un produit'}</h1>
        <p className="text-gray-500 text-lg">Publiez vos équipements pour qu'ils soient recommandés aux clients.</p>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card mb-8 p-6 rounded-3xl border-green-500/20 bg-green-500/[0.05] flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-400" />
               </div>
               <p className="text-green-400 font-bold">Produit ajouté avec succès !</p>
            </div>
            <button onClick={() => setSuccess(false)} className="text-xs font-black uppercase tracking-widest text-green-400/50 hover:text-green-400">Ok</button>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-10 rounded-[2.5rem] border-white/5 space-y-6">
            <div>
              <label className="block text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-3 ml-1">Nom du produit</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Ex: Groupe électrogène 5 kVA"
                className={`w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50 ${errors.name ? 'border-red-500' : ''}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-3 ml-1">Catégorie</label>
                <select
                  value={form.category}
                  onChange={e => setForm({...form, category: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                >
                  <option value="" className="bg-[#0a0a0c]">Choisir...</option>
                  {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0a0a0c]">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-3 ml-1">Puissance (kVA)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.power_rating}
                  onChange={e => setForm({...form, power_rating: e.target.value})}
                  placeholder="0.0"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-3 ml-1">Prix (FCFA)</label>
              <div className="relative group">
                 <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-yellow-400 transition-colors" />
                 <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm({...form, price: e.target.value})}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                 />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-3 ml-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Détails techniques, garantie..."
                rows={5}
                className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4 text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50 resize-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-8">
           {/* Image Upload */}
           <div className="glass-card p-8 rounded-[2rem] border-white/5 text-center">
              <label className="block text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-6">Image du produit</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${imagePreview ? 'border-transparent' : 'border-white/10 hover:border-yellow-400/40 hover:bg-yellow-400/[0.02]'}`}
              >
                 {imagePreview ? (
                   <>
                     <img src={imagePreview} className="w-full h-full object-cover rounded-3xl" alt="Preview" />
                     <button 
                       onClick={e => { e.stopPropagation(); setImagePreview(null); setImageFile(null); }}
                       className="absolute top-4 right-4 p-2 rounded-xl bg-black/60 text-white hover:bg-red-500 transition-all"
                     >
                        <X className="w-4 h-4" />
                     </button>
                   </>
                 ) : (
                   <>
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                         <ImageIcon className="w-8 h-8 text-gray-700" />
                      </div>
                      <p className="text-sm font-bold text-gray-500">Cliquez pour ajouter</p>
                      <p className="text-[10px] text-gray-700 mt-1 uppercase font-black">JPEG, PNG, WEBP</p>
                   </>
                 )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
              {imageError && <p className="mt-4 text-xs font-bold text-red-500 uppercase tracking-widest">{imageError}</p>}
           </div>

           {/* Info card */}
           <div className="glass-card p-6 rounded-2xl border-white/5 bg-white/[0.02]">
              <div className="flex gap-3">
                 <Info className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                 <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                    Votre produit sera instantanément indexé par notre IA pour être proposé lors des simulations clients.
                 </p>
              </div>
           </div>

           <button
             type="submit"
             disabled={submitting || uploadingImage}
             className="w-full h-16 rounded-[1.5rem] bg-yellow-400 text-gray-900 font-black text-lg hover:bg-yellow-500 transition-all flex items-center justify-center gap-3 accent-glow shadow-2xl shadow-yellow-400/20"
           >
             {submitting || uploadingImage ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
             {editingProductId ? 'Enregistrer les modifications' : 'Publier le produit'}
           </button>
           
           {editingProductId && (
             <button
               type="button"
               onClick={() => {
                 setEditingProductId(null);
                 setForm({ name: '', category: '', power_rating: '', price: '', description: '', keywords: '' });
                 setImagePreview(null);
                 setImageFile(null);
               }}
               className="w-full mt-4 py-4 rounded-[1.5rem] bg-white/5 text-gray-400 font-bold hover:bg-white/10 transition-all"
             >
               Annuler la modification
             </button>
           )}
        </div>
      </form>

      {/* Products List */}
      <div className="mt-20">
        <h2 className="text-2xl font-black text-white mb-8">Mes Produits ({products.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`glass-card rounded-[2rem] border-white/5 overflow-hidden flex flex-col transition-all ${!product.is_active ? 'opacity-50 grayscale' : 'hover:border-white/10'}`}
            >
              <div className="aspect-video bg-black/20 relative">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-white/10" />
                  </div>
                )}
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={() => handleToggleActive(product.id, product.is_active)}
                    className="p-2 rounded-xl bg-black/60 text-white hover:bg-white/20 transition-all"
                    title={product.is_active ? 'Masquer' : 'Afficher'}
                  >
                    {product.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => handleEdit(product)}
                    className="p-2 rounded-xl bg-black/60 text-white hover:bg-blue-500 transition-all"
                    title="Modifier"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(product.id)}
                    className="p-2 rounded-xl bg-black/60 text-white hover:bg-red-500 transition-all"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-white text-lg leading-tight mb-1">{product.name}</h3>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{product.category}</p>
                  </div>
                </div>
                <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/5">
                  <span className="text-yellow-400 font-black">{product.price.toLocaleString('fr-FR')} FCFA</span>
                  <span className="text-xs text-gray-400 font-bold">{product.power_rating} kVA</span>
                </div>
              </div>
            </motion.div>
          ))}
          {products.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-600 font-bold text-sm">
              Vous n'avez pas encore ajouté de produit.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddProduct;
