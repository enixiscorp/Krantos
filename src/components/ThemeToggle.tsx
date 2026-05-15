import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-full backdrop-blur-sm">
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-full transition-all ${theme === 'light' ? 'bg-yellow-400 text-gray-900 shadow-lg' : 'text-gray-500 hover:text-white'}`}
        title="Mode Clair"
      >
        <Sun size={14} />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-full transition-all ${theme === 'dark' ? 'bg-yellow-400 text-gray-900 shadow-lg' : 'text-gray-500 hover:text-white'}`}
        title="Mode Sombre"
      >
        <Moon size={14} />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-2 rounded-full transition-all ${theme === 'system' ? 'bg-yellow-400 text-gray-900 shadow-lg' : 'text-gray-500 hover:text-white'}`}
        title="Système"
      >
        <Monitor size={14} />
      </button>
    </div>
  );
};

export default ThemeToggle;
