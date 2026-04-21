// Centre super admin — vue globale des produits
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Package, Filter } from 'lucide-react';
import { getAdminProducts } from '../services/productService';

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  power_rating: number | null;
  price: number | null;
  vendor_id: string;
  is_active: boolean | null;
  created_at: string;
};

type SortKey = 'price' | 'popularity' | 'vendor';

const AdminProducts = () => {
  const [sort, setSort] = useState<SortKey>('price');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProductRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { products } = await getAdminProducts(sort);
      setRows((products ?? []) as ProductRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2">
              <Package className="w-8 h-8 text-cyan-400" />
              Produits (tous)
            </h1>
            <p className="text-gray-500 text-sm">Tri : prix, popularité (recommandations leads), vendeur</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Filter className="w-4 h-4" />
          <span>Trier :</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-white"
          >
            <option value="price">Prix</option>
            <option value="popularity">Popularité</option>
            <option value="vendor">Vendeur (ID)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl border-white/5 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase border-b border-white/5">
                  <th className="p-4">Produit</th>
                  <th className="p-4">Catégorie</th>
                  <th className="p-4">Puissance (W)</th>
                  <th className="p-4">Prix</th>
                  <th className="p-4">Vendeur</th>
                  <th className="p-4">Actif</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4 font-medium text-white">{p.name}</td>
                    <td className="p-4 text-gray-400">{p.category ?? '—'}</td>
                    <td className="p-4 text-gray-300">{p.power_rating ?? '—'}</td>
                    <td className="p-4 text-cyan-300/90">
                      {p.price != null ? `${p.price.toLocaleString('fr-FR')} F` : '—'}
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-500">{p.vendor_id.slice(0, 8)}…</td>
                    <td className="p-4">{p.is_active ? 'Oui' : 'Non'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AdminProducts;
