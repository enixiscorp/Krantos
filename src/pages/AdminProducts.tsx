import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Package, 
  Search, 
  Plus,
  Edit2,
  X,
  Zap,
  Building2,
  Tag,
  Save,
  Eye,
  EyeOff,
  ImageIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  power_rating: number | null;
  price: number | null;
  vendor_id: string;
  is_active: boolean | null;
  image_url: string | null;
  vendors?: { name: string };
};

const AdminProducts = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  
  const [newProduct, setNewProduct] = useState({
    name: '',
    vendor_id: '',
    category: 'Panneaux Solaires',
    price: 0,
    power_rating: 0,
    unit: 'W',
    is_active: true,
    image_url: ''
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          vendors:vendor_id (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRows(data || []);

      // Load all vendors (even pending ones) for manual attribution
      const { data: vData } = await supabase.from('vendors').select('id, name').order('name');
      setVendors(vData || []);
    } catch (e) {
      toast.error('Impossible de charger les produits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Tentative d\'enregistrement:', newProduct);

    if (!newProduct.vendor_id) {
      toast.error('Veuillez sélectionner une boutique');
      return;
    }
    if (!newProduct.name.trim()) {
      toast.error('Le nom du produit est requis');
      return;
    }

    setLoading(true);
    try {
      // Nettoyage de l'objet pour l'insertion
      const payload = {
        name: newProduct.name.trim(),
        vendor_id: newProduct.vendor_id,
        category: newProduct.category,
        price: Number(newProduct.price),
        power_rating: Number(newProduct.power_rating),
        unit: (newProduct as any).unit || 'W',
        is_active: true
      };

      const { data, error } = await supabase
        .from('products')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      // Image Upload if provided
      if (imageFile && data) {
        setUploading(true);
        const ext = imageFile.name.split('.').pop();
        const path = `${data.vendor_id}/${data.id}.${ext}`;
        
        await supabase.storage.from('product-images').upload(path, imageFile, { 
          upsert: true,
          cacheControl: '3600'
        });
        
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
        // Add timestamp as cache-buster
        const finalUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        
        await supabase.from('products').update({ image_url: finalUrl }).eq('id', data.id);
      }

      console.log('Succès enregistrement:', data);
      setShowSuccessModal(true);
      setShowAddModal(false);
      setNewProduct({ 
        name: '', 
        vendor_id: '', 
        category: 'Panneaux Solaires', 
        price: 0, 
        power_rating: 0, 
        unit: 'W', 
        is_active: true,
        image_url: ''
      });
      
      await load();
    } catch (err: any) {
      console.error('Erreur complète:', err);
      toast.error(`Erreur d'enregistrement : ${err.message || 'Problème de connexion'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: editProduct.name,
          category: editProduct.category,
          price: Number(editProduct.price),
          power_rating: Number(editProduct.power_rating),
          is_active: editProduct.is_active,
        })
        .eq('id', editProduct.id);
      if (error) throw error;
      toast.success('Produit mis à jour avec succès.');
      setEditProduct(null);
      await load();
    } catch (err: any) {
      toast.error(`Erreur : ${err.message}`);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      toast.success('Produit supprimé.');
      await load();
    } catch (err: any) {
      toast.error(`Erreur : ${err.message}`);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      toast.success(currentStatus ? 'Produit masqué.' : 'Produit activé.');
      await load();
    } catch (err: any) {
      toast.error(`Erreur : ${err.message}`);
    }
  };

  const filteredProducts = rows.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.vendors?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(rows.map(p => p.category).filter(Boolean) as string[])];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 pb-32">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group font-bold text-xs uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour Dashboard
          </Link>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tighter flex items-center gap-4">
            Catalogue <span className="text-cyan-400">Produits</span>
          </h1>
          <p className="text-gray-500 text-lg font-medium">Gestion globale des équipements et stocks partenaires.</p>
        </motion.div>

        <div className="flex items-center gap-3">
           <div className="glass-card px-6 py-4 rounded-2xl border-white/5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-400/10 flex items-center justify-center text-cyan-400">
                <Package size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Produits</p>
                <p className="text-xl font-black text-white leading-none">{rows.length}</p>
              </div>
           </div>
           <button
             onClick={() => setShowAddModal(true)}
             className="px-6 py-4 rounded-2xl bg-cyan-400 text-black font-black text-xs uppercase tracking-widest hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-400/20 flex items-center gap-2"
           >
             <Plus size={18} />
             Nouveau Produit
           </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
          <input
            type="text"
            placeholder="Rechercher un produit ou un vendeur..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400/50 transition-all font-medium"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`flex-shrink-0 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                categoryFilter === cat 
                  ? 'bg-cyan-400 text-black border-cyan-400 shadow-lg shadow-cyan-400/20' 
                  : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/20'
              }`}
            >
              {cat === 'all' ? 'Tous les produits' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
             [...Array(6)].map((_, i) => (
               <div key={i} className="h-64 glass-card rounded-[2.5rem] border-white/5 animate-pulse" />
             ))
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full py-32 text-center">
               <Package className="w-16 h-16 text-gray-800 mx-auto mb-6" />
               <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Aucun produit ne correspond à votre recherche.</p>
            </div>
          ) : (
            filteredProducts.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-8 rounded-[2.5rem] border-white/5 hover:border-cyan-400/30 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/5 blur-3xl -mr-16 -mt-16 group-hover:bg-cyan-400/10 transition-all" />
                <div className="aspect-video bg-black/40 relative overflow-hidden mb-6 rounded-2xl border border-white/5 group">
                  {p.image_url ? (
                    <img 
                      src={p.image_url} 
                      alt={p.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-800">
                      <Zap size={32} className="opacity-10" />
                    </div>
                  )}
                  <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${p.is_active ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} backdrop-blur-md`}>
                    {p.is_active ? 'En ligne' : 'Masqué'}
                  </div>
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2 truncate group-hover:text-cyan-400 transition-colors">{p.name}</h3>
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-500 uppercase tracking-widest">
                    <Building2 size={14} className="text-cyan-400/50" />
                    {p.vendors?.name || 'Vendeur inconnu'}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <Tag size={14} className="text-cyan-400/50" />
                    {p.category}
                  </div>
                </div>
                <div className="flex items-end justify-between pt-6 border-t border-white/5">
                  <div>
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Prix unitaire</p>
                    <p className="text-2xl font-black text-white tracking-tighter">
                      {Number(p.price || 0).toLocaleString('fr-FR')} <span className="text-xs text-gray-500">FCFA</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggleActive(p.id, p.is_active || false)} className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-all" title={p.is_active ? 'Masquer' : 'Afficher'}>
                      {p.is_active ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                    <button onClick={() => handleDeleteProduct(p.id)} className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Supprimer">
                      <X size={18} />
                    </button>
                    <button onClick={() => setEditProduct(p)} className="p-3 rounded-xl bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20 transition-all" title="Modifier">
                      <Edit2 size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[3rem] p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/5 blur-[100px] -mr-32 -mt-32" />
              <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-tight">Ajouter un Équipement</h2>
              
              <form onSubmit={handleCreateProduct} className="space-y-6 relative z-10">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Boutique / Vendeur</label>
                  <select
                    value={newProduct.vendor_id}
                    onChange={e => setNewProduct({...newProduct, vendor_id: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-cyan-400/50 outline-none transition-all appearance-none cursor-pointer"
                    required
                  >
                    <option value="" className="bg-[#0A0A0A]">Sélectionner un partenaire...</option>
                    {vendors.map(v => <option key={v.id} value={v.id} className="bg-[#0A0A0A]">{v.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Nom du Produit</label>
                  <input
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    placeholder="ex: Panneau Solaire 450W Mono"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-cyan-400/50 outline-none transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Catégorie</label>
                    <select
                      value={newProduct.category}
                      onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-cyan-400/50 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="Panneaux Solaires" className="bg-[#0A0A0A]">Panneaux Solaires</option>
                      <option value="Panneaux Eoliens" className="bg-[#0A0A0A]">Panneaux Éoliens</option>
                      <option value="Générateur Mécanique" className="bg-[#0A0A0A]">Générateur Mécanique</option>
                      <option value="Générateur Electrique" className="bg-[#0A0A0A]">Générateur Électrique</option>
                      <option value="Onduleurs" className="bg-[#0A0A0A]">Onduleurs</option>
                      <option value="Batteries" className="bg-[#0A0A0A]">Batteries</option>
                      <option value="Régulateurs" className="bg-[#0A0A0A]">Régulateurs</option>
                      <option value="Panneaux Solaires" className="bg-[#0A0A0B]">Panneaux Solaires</option>
                      <option value="Panneaux Eoliens" className="bg-[#0A0A0B]">Panneaux Eoliens</option>
                      <option value="Batteries" className="bg-[#0A0A0B]">Batteries</option>
                      <option value="Onduleurs" className="bg-[#0A0A0B]">Onduleurs</option>
                      <option value="Générateur Mécanique" className="bg-[#0A0A0B]">Générateur Mécanique</option>
                      <option value="Générateur Electrique" className="bg-[#0A0A0B]">Générateur Electrique</option>
                      <option value="Accessoires" className="bg-[#0A0A0B]">Accessoires</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Puissance / Capacité</label>
                      <input
                        type="number"
                        value={newProduct.power_rating}
                        onChange={e => setNewProduct({...newProduct, power_rating: Number(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-cyan-400/50 outline-none transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Unité</label>
                      <select
                        value={(newProduct as any).unit || 'W'}
                        onChange={e => setNewProduct({...newProduct, unit: e.target.value} as any)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-cyan-400/50 outline-none transition-all appearance-none cursor-pointer"
                      >
                        {['W', 'kW', 'MW', 'Wh', 'kWh', 'MWh', 'V', 'VA', 'kVA', 'MVA', 'A', 'Ah', 'mAh', 'Wc', 'L'].map(u => (
                          <option key={u} value={u} className="bg-[#0A0A0B]">{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Visuel du Produit (Optionnel)</label>
                  <div 
                    onClick={() => document.getElementById('new-product-img')?.click()}
                    className="w-full aspect-video bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-all overflow-hidden"
                  >
                    {imagePreview ? (
                      <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8 text-gray-700 mb-2" />
                        <span className="text-[10px] font-bold text-gray-600 uppercase">Cliquer pour uploader</span>
                      </>
                    )}
                    <input 
                      id="new-product-img" 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImageFile(file);
                          const reader = new FileReader();
                          reader.onload = (ev) => setImagePreview(ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Prix Unitaire (FCFA)</label>
                  <input
                    type="number"
                    value={newProduct.price}
                    onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-cyan-400/50 outline-none transition-all"
                    required
                  />
                </div>

                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all text-xs uppercase tracking-widest">Annuler</button>
                  <button type="submit" className="flex-[2] py-4 rounded-xl bg-cyan-400 text-black font-black hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-400/20 text-xs uppercase tracking-widest">Enregistrer le produit</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSuccessModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0A0A0A] border border-cyan-400/30 rounded-[3rem] p-12 text-center shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-cyan-400" />
              <div className="w-20 h-20 bg-cyan-400/10 rounded-full flex items-center justify-center mx-auto mb-8">
                <Package size={40} className="text-cyan-400" />
              </div>
              <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tight">Produit Enregistré</h2>
              <button onClick={() => setShowSuccessModal(false)} className="w-full py-5 rounded-2xl bg-cyan-400 text-black font-black uppercase tracking-widest hover:bg-cyan-500 transition-all">
                Génial, Continuer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditProduct(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0A0A0A] border border-cyan-400/20 rounded-[3rem] p-10 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto scrollbar-hide"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-yellow-400" />
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Modifier le Produit</h2>
                <button onClick={() => setEditProduct(null)} className="p-2 rounded-xl bg-white/5 text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <form onSubmit={handleSaveEdit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Nom du Produit</label>
                  <input value={editProduct.name} onChange={e => setEditProduct({...editProduct, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-cyan-400/50 outline-none" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Catégorie</label>
                    <select value={editProduct.category || ''} onChange={e => setEditProduct({...editProduct, category: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm focus:border-cyan-400/50 outline-none appearance-none">
                      {['Panneaux Solaires','Panneaux Eoliens','Batteries','Onduleurs','Générateur Mécanique','Générateur Electrique','Régulateurs','Accessoires'].map(c => <option key={c} value={c} className="bg-[#0A0A0A]">{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Statut</label>
                    <select value={editProduct.is_active ? 'true' : 'false'} onChange={e => setEditProduct({...editProduct, is_active: e.target.value === 'true'})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm focus:border-cyan-400/50 outline-none appearance-none">
                      <option value="true" className="bg-[#0A0A0A]">En ligne</option>
                      <option value="false" className="bg-[#0A0A0A]">Masqué</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Puissance (kVA)</label>
                    <input type="number" step="0.01" value={editProduct.power_rating || 0} onChange={e => setEditProduct({...editProduct, power_rating: Number(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-cyan-400/50 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Prix (FCFA)</label>
                    <input type="number" value={editProduct.price || 0} onChange={e => setEditProduct({...editProduct, price: Number(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-cyan-400/50 outline-none" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setEditProduct(null)} className="flex-1 py-4 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all text-xs uppercase tracking-widest">Annuler</button>
                  <button type="submit" disabled={editSaving} className="flex-[2] py-4 rounded-xl bg-cyan-400 text-black font-black hover:bg-cyan-500 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                    {editSaving ? <span className="animate-spin h-4 w-4 border-2 border-black/20 border-t-black rounded-full" /> : <><Save size={16} /> Enregistrer</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminProducts;
