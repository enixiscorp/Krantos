// ============================================================
// Krantos Platform — Vendors Directory Page (/vendors) (Premium Dark)
// Requirements: 9.1, 9.3
// ============================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Phone,
  Mail,
  ChevronRight,
  Search,
  AlertCircle,
  Zap,
  Loader2,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vendor } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Vendors = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVendors = async () => {
      setIsLoading(true);
      const { data, error: supabaseError } = await supabase
        .from('vendors')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (supabaseError) {
        setError('Impossible de charger les partenaires.');
      } else {
        setVendors(data ?? []);
      }
      setIsLoading(false);
    };
    fetchVendors();
  }, []);

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-5xl font-black text-white mb-2">Partenaires</h1>
          <p className="text-gray-500 text-lg uppercase tracking-widest text-xs font-black">
             Annuaire des vendeurs vérifiés · Krantos Ecosystem
          </p>
        </div>
        <div className="relative group w-full md:w-96">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
           <input
             type="text"
             placeholder="Rechercher par nom ou catégorie..."
             value={searchQuery}
             onChange={e => setSearchQuery(e.target.value)}
             className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
           />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence>
          {filteredVendors.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="lg:col-span-3 py-20 text-center glass-card rounded-[3rem] border-white/5"
            >
               <Store className="w-16 h-16 text-gray-800 mx-auto mb-6" />
               <p className="text-gray-500 font-bold text-xl">Aucun partenaire trouvé.</p>
               <p className="text-sm text-gray-700 mt-2">Essayez d'autres mots-clés ou revenez plus tard.</p>
            </motion.div>
          ) : (
            filteredVendors.map((vendor, i) => (
              <motion.div
                key={vendor.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/vendor/${vendor.id}`}
                  className="glass-card p-6 rounded-[2rem] border-white/5 hover:border-white/10 transition-all flex flex-col group h-full"
                >
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-yellow-400/10 flex items-center justify-center group-hover:bg-yellow-400 group-hover:scale-110 transition-all">
                      <Store className="w-8 h-8 text-yellow-500 group-hover:text-gray-900" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-700 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all" />
                  </div>

                  <div className="mb-8">
                    <h3 className="text-xl font-black text-white tracking-tight mb-2 group-hover:text-yellow-400 transition-colors">{vendor.name}</h3>
                    <span className="px-3 py-1 rounded-lg bg-white/5 text-[9px] font-black uppercase tracking-widest text-gray-500 border border-white/5">
                      {vendor.category}
                    </span>
                  </div>

                  <div className="mt-auto space-y-3 pt-6 border-t border-white/5">
                    {vendor.phone && (
                      <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                        <Phone className="w-3.5 h-3.5 text-yellow-400/50" />
                        {vendor.phone}
                      </div>
                    )}
                    {vendor.email && (
                      <div className="flex items-center gap-3 text-xs font-bold text-gray-500 truncate">
                        <Mail className="w-3.5 h-3.5 text-yellow-400/50" />
                        <span className="truncate">{vendor.email}</span>
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Vendors;
