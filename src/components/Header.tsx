import { Link, useLocation } from 'react-router-dom';
import { Zap, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const Header = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Calculer', path: '/calculate-power' },
    { name: 'Vendeurs', path: '/vendors' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] bg-[#0a0a0c]/80 backdrop-blur-lg border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
            <Zap className="w-5 h-5 text-gray-900 fill-current" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white animate-electric">Krantos</span>
        </Link>
        
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes electric-blink {
            0%, 100% { opacity: 1; filter: brightness(1); }
            10% { opacity: 0.8; filter: brightness(1.2); }
            12% { opacity: 1; filter: brightness(2); }
            14% { opacity: 0.9; filter: brightness(1.1); }
            16% { opacity: 1; filter: brightness(1.5); }
            18% { opacity: 0.8; filter: brightness(1); }
            20% { opacity: 1; filter: brightness(2.5); text-shadow: 0 0 10px rgba(234, 179, 8, 0.5); }
            22% { opacity: 0.9; filter: brightness(1); }
          }
          .animate-electric {
            animation: electric-blink 4s linear infinite;
          }
        `}} />

        {/* Desktop Nav */}
        <nav className="flex items-center gap-4 md:gap-8">
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-colors hover:text-yellow-400 ${
                  location.pathname === link.path ? 'text-yellow-400' : 'text-gray-400'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/business-login"
              className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
            >
              Pro
            </Link>

            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0a0a0c] border-b border-white/5 overflow-hidden"
          >
            <div className="flex flex-col p-4 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`text-lg font-bold px-4 py-2 rounded-xl ${
                    location.pathname === link.path ? 'bg-yellow-400/10 text-yellow-400' : 'text-gray-400'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
