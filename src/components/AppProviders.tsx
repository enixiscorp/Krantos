import React from 'react';
import { ThemeProvider } from '../context/ThemeContext';
import { ConnectionProvider } from '../context/ConnectionContext';
import { Toaster } from 'sonner';

interface AppProvidersProps {
  children: React.ReactNode;
}

const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider>
      <ConnectionProvider>
        {children}
        <Toaster 
          position="bottom-right" 
          toastOptions={{
            style: {
              background: 'var(--krantos-glass)',
              color: 'var(--krantos-text)',
              border: '1px solid var(--krantos-glass-border)',
              backdropFilter: 'blur(10px)',
            },
          }}
        />
      </ConnectionProvider>
    </ThemeProvider>
  );
};

export default AppProviders;
