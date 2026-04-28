import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

export default function AdminLayout(props: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-yellow-400 selection:text-gray-900">
      {/* Subtle admin-only glows (no public header) */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-yellow-400/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[140px] rounded-full pointer-events-none" />
      <main className="min-h-screen">
        <Outlet />
        {props.children}
      </main>
    </div>
  );
}

