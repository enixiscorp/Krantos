// ============================================================
// Krantos Platform — Vendor Detail Page (/vendor/:id) (Premium Dark)
// Requirements: 9.2
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Phone,
  Mail,
  Package,
  ArrowLeft,
  AlertCircle,
  Zap,
  Tag,
  Loader2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import type { Vendor, Product } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const VendorDetail = () => {
  const { id } = useParams<{ id: string }>();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setIsLoading(true);
      const [vRes, pRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', id).eq('status', 'active').single(),
        supabase.from('products').select('*').eq('vendor_id', id).eq('is_active', true).order('price', { ascending: true }),
      ]);
      if (vRes.error || !vRes.data) {
        setError('Vendeur non trouvé.');
      } else {
        setVendor(vRes.data);
        setProducts(pRes.data ?? []);
      }
      setIsLoading(false);
    };
    fetchData();
  }, [id]);

  if (isLoading) return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
    </div>
  );

  if (error || !vendor) return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center text-center p-4">
       <AlertCircle className="w-16 h-16 text-red-500/20 mb-6" />
       <h2 className="text-2xl font-black text-white mb-2">Partenaire introuvable</h2>
       <Link to="/vendors" className="text-yellow-400 font-bold hover:underline">Retour à l'annuaire</Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header / Profile */}
      <div className="flex flex-col md:flex-row gap-12 mb-20">
        <div className="flex-1">
          <Link to="/vendors" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-8 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour à l'annuaire
          </Link>
          
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-[2rem] bg-yellow-400/10 flex items-center justify-center border border-yellow-400/20">
               <Store className="w-12 h-12 text-yellow-400" />
            </div>
            <div>
               <div className="flex items-center gap-3 mb-2">
                 <h1 className="text-4xl font-black text-white tracking-tight">{vendor.name}</h1>
                 <span className="px-3 py-1 rounded-lg bg-yellow-400/10 text-[10px] font-black uppercase tracking-widest text-yellow-500 border border-yellow-400/20 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" />
                    Vérifié
                 </span>
               </div>
               <p className="text-gray-500 text-sm font-black uppercase tracking-[0.2em]">{vendor.category}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             {vendor.phone && (
               <a href={`tel:${vendor.phone}`} className="glass-card p-6 rounded-3xl border-white/5 flex items-center gap-4 hover:border-yellow-400/30 transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-yellow-400/10 transition-all">
                     <Phone className="w-5 h-5 text-gray-500 group-hover:text-yellow-400" />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-0.5">Téléphone</p>
                     <p className="text-sm font-bold text-white">{vendor.phone}</p>
                  </div>
               </a>
             )}
             {vendor.email && (
               <a href={`mailto:${vendor.email}`} className="glass-card p-6 rounded-3xl border-white/5 flex items-center gap-4 hover:border-yellow-400/30 transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-yellow-400/10 transition-all">
                     <Mail className="w-5 h-5 text-gray-500 group-hover:text-yellow-400" />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-0.5">Email</p>
                     <p className="text-sm font-bold text-white truncate max-w-[150px]">{vendor.email}</p>
                  </div>
               </a>
             )}
          </div>
        </div>

        <div className="w-full md:w-80">
           <div className="glass-card p-8 rounded-[2.5rem] border-yellow-400/10 bg-yellow-400/[0.01] accent-glow sticky top-24">
              <h3 className="text-lg font-black text-white mb-4 tracking-tight">Besoin d'aide ?</h3>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                 Utilisez notre calculateur pour déterminer la puissance exacte nécessaire pour votre projet avant de contacter {vendor.name}.
              </p>
              <Link to="/calculate-power" className="w-full h-14 rounded-2xl bg-yellow-400 text-gray-900 font-black text-sm flex items-center justify-center gap-2 hover:bg-yellow-500 transition-all shadow-xl shadow-yellow-400/10">
                 Calculer mes besoins
                 <ChevronRight className="w-4 h-4" />
              </Link>
           </div>
        </div>
      </div>

      {/* Products */}
      <div className="space-y-8">
        <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-4 px-2">
           Catalogue Produits
           <span className="text-sm font-black text-gray-700 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">{products.length}</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-8 rounded-[2rem] border-white/5 hover:border-white/10 transition-all flex flex-col group"
            >
               <div className="flex items-start justify-between mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-all">
                     <Package className="w-7 h-7 text-gray-600 group-hover:text-yellow-400" />
                  </div>
                  <div className="text-right">
                     <p className="text-xl font-black text-white">{product.price.toLocaleString('fr-FR')} <span className="text-[10px] text-yellow-400 ml-1">FCFA</span></p>
                  </div>
               </div>

               <div className="mb-8">
                  <h3 className="text-lg font-black text-white mb-2 leading-tight group-hover:text-yellow-400 transition-colors">{product.name}</h3>
                  <div className="flex items-center gap-3">
                     <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[8px] font-black uppercase tracking-widest text-gray-600 border border-white/5 flex items-center gap-1.5">
                        <Tag className="w-3 h-3" />
                        {product.category}
                     </span>
                     <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[8px] font-black uppercase tracking-widest text-gray-600 border border-white/5 flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        {product.power_rating} kVA
                     </span>
                  </div>
               </div>

               {product.description && (
                 <p className="text-xs text-gray-500 font-medium leading-relaxed mb-6 line-clamp-3">
                    {product.description}
                 </p>
               )}

               <div className="mt-auto pt-6 border-t border-white/5">
                  <button className="w-full py-3 rounded-xl bg-white/5 text-xs font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all">
                     Voir l'offre
                  </button>
               </div>
            </motion.div>
          ))}
          {products.length === 0 && (
            <div className="lg:col-span-3 py-20 text-center glass-card rounded-[3rem] border-white/5">
               <Package className="w-12 h-12 text-gray-800 mx-auto mb-4" />
               <p className="text-gray-500 font-bold">Aucun produit listé pour le moment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorDetail;
