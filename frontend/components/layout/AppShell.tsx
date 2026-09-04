"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import DemoControlCenter from "../demo/DemoControlCenter";
import ResetConfirmationModal from "../common/ResetConfirmationModal";
import Toast from "../common/Toast";
import { resetDashboard } from "../../lib/api";

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
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    message: "",
    type: "success",
  });

  const handleResetConfirm = async () => {
    try {
      const res = await resetDashboard();
      setToast({
        isOpen: true,
        message:
          res.message ||
          "Dashboard reset successfully. All transaction and recovery data has been cleared.",
        type: "success",
      });
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      setToast({
        isOpen: true,
        message:
          err.message ||
          "Reset failed. No data was intentionally left in a partially reset state.",
        type: "error",
      });
      throw err;
    }
  };

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
            onOpenReset={() => setResetOpen(true)}
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

      {/* Global Reset Confirmation Modal */}
      <ResetConfirmationModal
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleResetConfirm}
      />

      {/* Toast Feedback Notification */}
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
