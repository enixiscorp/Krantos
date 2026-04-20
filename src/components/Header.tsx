import { Link, useLocation } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const Header = () => {
  const location = useLocation();

  const navLinks = [
    { name: 'Calculer', path: '/calculate-power' },
    { name: 'Vendeurs', path: '/vendors' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0c]/80 backdrop-blur-lg border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
            <Zap className="w-5 h-5 text-gray-900 fill-current" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">Krantos</span>
        </Link>

        <nav className="flex items-center gap-8">
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
          <Link
            to="/business-login"
            className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
          >
            Pro
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
