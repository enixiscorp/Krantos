import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Loader2, 
  Package, 
  Filter, 
  Search, 
  Download,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Zap,
  Building2,
  Tag
} from 'lucide-react';
import { getAdminProducts } from '../services/productService';
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
    } catch (e) {
      toast.error('Impossible de charger les produits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredProducts = rows.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.vendors?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(rows.map(p => p.category).filter(Boolean))];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 pb-32">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
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
              onClick={() => setCategoryFilter(cat!)}
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
                {/* Accent glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/5 blur-3xl -mr-16 -mt-16 group-hover:bg-cyan-400/10 transition-all" />
                
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-cyan-400/10 group-hover:text-cyan-400 transition-all">
                    <Zap size={24} className="text-gray-500 group-hover:text-cyan-400" />
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${p.is_active ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                    {p.is_active ? 'En ligne' : 'Masqué'}
                  </div>
                </div>

                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2 truncate group-hover:text-cyan-400 transition-colors">
                  {p.name}
                </h3>
                
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
                      {p.price?.toLocaleString('fr-FR')} <span className="text-xs text-gray-500">FCFA</span>
                    </p>
                  </div>
                  <Link 
                    to={`/vendor/${p.vendor_id}`}
                    className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-white hover:bg-cyan-400 hover:text-black transition-all"
                  >
                    <ChevronRight size={20} />
                  </Link>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminProducts;
