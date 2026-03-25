"use client";

import { useState } from "react";
import Link from "next/link";
import Sidebar from "./Sidebar";
import { SessionUser } from "@/types";

interface DashboardShellProps {
  user: SessionUser;
  needsPasswordSetup: boolean;
  children: React.ReactNode;
}

export default function DashboardShell({ user, needsPasswordSetup, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const showBanner = needsPasswordSetup && !bannerDismissed;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile backdrop — covers content behind the open drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar user={user} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 lg:ml-64 min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-200 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span className="font-semibold text-slate-900 text-sm">RIO Task</span>
          </div>
        </div>

        {/* Password setup banner — shown to SSO users who haven't set a password */}
        {showBanner && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900">
            <div className="flex items-center gap-2.5 min-w-0">
              <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-[13px] leading-snug">
                <span className="font-semibold">Secure your account.</span>{" "}
                You signed in with Google but haven&apos;t set a password yet — you won&apos;t be able to log in if Google SSO is unavailable.{" "}
                <Link href="/profile" className="underline font-semibold hover:text-amber-700 transition-colors">
                  Set a password
                </Link>
              </p>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              className="shrink-0 p-1 rounded hover:bg-amber-100 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
