import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, MessageSquare, ShieldCheck, ArrowRight, MousePointer2 } from 'lucide-react';

const Home = () => {
  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-64px)] flex flex-col items-center">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-400/10 blur-[120px] rounded-full pointer-events-none" />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 pt-20 pb-16 flex flex-col items-center text-center">
        {/* Slogan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4"
        >
          <span className="text-sm font-black text-muted-foreground uppercase tracking-[0.3em]">
            Krantos — Powering Africa's Energy Decisions
          </span>
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 mb-8"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">
            Calculateur Intelligent - Togo
          </span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-foreground"
        >
          Calculez vos besoins,<br />
          trouvez votre <span className="text-blue-500">groupe</span><br />
          <span className="text-yellow-400">électrogène.</span>
        </motion.h1>

        {/* Hero Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-xl text-muted-foreground text-base md:text-lg mb-10 leading-relaxed"
        >
          Krantos vous aide à dimensionner votre installation électrique en quelques clics et vous met en relation avec des vendeurs vérifiés via WhatsApp.
        </motion.p>

        {/* Hero Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 mb-24"
        >
          <Link
            to="/calculate-power"
            className="flex items-center gap-2 px-8 py-4 rounded-full bg-yellow-400 text-gray-900 font-bold text-lg hover:bg-yellow-500 transition-all hover:scale-105 active:scale-95 accent-glow"
          >
            <Zap className="w-5 h-5 fill-current" />
            Calculer ma puissance
          </Link>
          <Link
            to="/vendors"
            className="flex items-center gap-2 px-8 py-4 rounded-full bg-white/5 border border-white/10 dark:text-white text-foreground font-bold text-lg hover:bg-white/10 transition-all"
          >
            Voir les vendeurs
          </Link>
        </motion.div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          {[
            {
              icon: <MousePointer2 className="w-6 h-6 text-yellow-400" />,
              title: "Calcul automatique",
              desc: "Watts, Ampères, Volts — tout est converti pour vous."
            },
            {
              icon: <Zap className="w-6 h-6 text-yellow-400" />,
              title: "Recommandation instantanée",
              desc: "Le bon groupe pour votre puissance, avec marge de sécurité."
            },
            {
              icon: <MessageSquare className="w-6 h-6 text-yellow-400" />,
              title: "WhatsApp direct",
              desc: "Contact instantané avec un vendeur vérifié."
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
              className="glass-card p-6 rounded-3xl text-left border-white/5 dark:border-white/5 hover:border-white/20 transition-colors group"
            >
              <div className="p-3 rounded-2xl bg-white/5 w-fit mb-4 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="font-bold text-lg mb-2 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Footer Disclaimer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-20 flex flex-wrap justify-center gap-8 text-[10px] text-gray-500 uppercase tracking-[0.2em]"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-yellow-400" /> Vendeurs vérifiés
          </span>
          <span>Données sécurisées</span>
          <span>100% gratuit pour les particuliers</span>
        </motion.div>
      </main>
    </div>
  );
};

export default Home;
