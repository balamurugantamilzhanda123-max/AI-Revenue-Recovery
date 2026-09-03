"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import DemoControlCenter from "../demo/DemoControlCenter";

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function AppShell({
  children,
  title,
  description,
  onRefresh,
  isRefreshing = false,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col antialiased">
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Persistent Sidebar */}
        <div className="hidden lg:block shrink-0">
          <Sidebar />
        </div>

        {/* Mobile Sidebar Overlay Drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative z-10 w-72 h-full bg-white shadow-2xl">
              <Sidebar onCloseMobile={() => setMobileNavOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <Header
            title={title}
            description={description}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onOpenDemo={() => setDemoOpen(true)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8">
            {children}
          </main>
        </div>
      </div>

      {/* Global Demo Control Modal */}
      <DemoControlCenter
        isOpen={demoOpen}
        onClose={() => setDemoOpen(false)}
        onDataChanged={onRefresh}
      />
    </div>
  );
}
