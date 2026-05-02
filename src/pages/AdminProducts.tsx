import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Loader2, 
  Package, 
  Search, 
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  Zap,
  Building2,
  Tag
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
  created_at: string;
  vendors?: { name: string };
};

const AdminProducts = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  
  const [newProduct, setNewProduct] = useState({
    name: '',
    vendor_id: '',
    category: 'Panneaux Solaires',
    price: 0,
    power_rating: 0,
    unit: 'W',
    is_active: true
  });

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

      const { data: vData } = await supabase.from('vendors').select('id, name').eq('status', 'active');
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
    if (!newProduct.vendor_id) {
      toast.error('Veuillez sélectionner un vendeur');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('products').insert(newProduct);
      if (error) throw error;
      toast.success('Produit ajouté au catalogue !');
      setShowAddModal(false);
      setNewProduct({ name: '', vendor_id: '', category: 'Panneaux Solaires', price: 0, power_rating: 0, unit: 'W', is_active: true });
      await load();
    } catch (err) {
      toast.error('Erreur lors de la création');
    } finally {
      setLoading(false);
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
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-cyan-400/10 group-hover:text-cyan-400 transition-all">
                    <Zap size={24} className="text-gray-500 group-hover:text-cyan-400" />
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${p.is_active ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
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
                  <Link to={`/admin/products/${p.id}`} className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-cyan-400 transition-all">
                    <ChevronRight size={20} />
                  </Link>
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
                      <option value="Accessoires" className="bg-[#0A0A0A]">Accessoires</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2 ml-1">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Puissance / Capacité</label>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={newProduct.power_rating}
                        onChange={e => setNewProduct({...newProduct, power_rating: Number(e.target.value)})}
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-cyan-400/50 outline-none transition-all"
                      />
                      <select
                        value={(newProduct as any).unit || 'W'}
                        onChange={e => setNewProduct({...newProduct, unit: e.target.value} as any)}
                        className="w-24 bg-white/5 border border-white/10 rounded-2xl px-2 py-4 text-white text-xs font-bold focus:border-cyan-400/50 outline-none transition-all appearance-none cursor-pointer text-center"
                      >
                        {['W', 'kW', 'MW', 'Wh', 'kWh', 'MWh', 'V', 'VA', 'kVA', 'MVA', 'A', 'Ah', 'mAh', 'Wc', 'L'].map(u => (
                          <option key={u} value={u} className="bg-[#0A0A0A]">{u}</option>
                        ))}
                      </select>
                    </div>
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
    </div>
  );
};

export default AdminProducts;
