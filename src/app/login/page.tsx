"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginMode = "password" | "magic";

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("password");

  // Password login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Magic link state
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState("");

  const router = useRouter();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Login failed.");
        return;
      }
      router.push("/tasks");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setMagicLoading(true);
    setMagicError("");
    try {
      await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: magicEmail }),
      });
      // Always show success to prevent email enumeration
      setMagicSent(true);
    } catch {
      setMagicError("Network error. Please try again.");
    } finally {
      setMagicLoading(false);
    }
  }

  function switchMode(next: LoginMode) {
    setMode(next);
    setError("");
    setMagicError("");
    setMagicSent(false);
  }

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #0747A6 0%, #0052CC 50%, #0065FF 100%)" }}>
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-1/2 text-white">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-2xl font-bold tracking-tight">RIO Task</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Manage your team&apos;s work, all in one place
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed">
            Plan, track, and release great software with your team using our Jira-inspired task management board.
          </p>
          <div className="mt-10 flex gap-6">
            {["Kanban Boards", "Task Tracking", "Team Management"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-blue-100">
                <div className="w-4 h-4 rounded-full bg-green-400 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">RIO Task</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Sign in to your account</h2>
            <p className="text-gray-500 text-sm mt-1">Enter your credentials to access the board</p>
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-lg border border-gray-200 p-1 mb-6 bg-gray-50">
            <button
              onClick={() => switchMode("password")}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
                mode === "password"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Password
            </button>
            <button
              onClick={() => switchMode("magic")}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
                mode === "magic"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Magic Link
            </button>
          </div>

          {/* Password login */}
          {mode === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          )}

          {/* Magic link */}
          {mode === "magic" && (
            <>
              {magicSent ? (
                <div className="flex flex-col items-center py-6 gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Check your inbox</p>
                    <p className="text-sm text-gray-500 mt-1">
                      If <span className="font-medium">{magicEmail}</span> is registered, a sign-in link has been sent. It expires in 15 minutes.
                    </p>
                  </div>
                  <button
                    onClick={() => { setMagicSent(false); setMagicEmail(""); }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Send to a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={magicEmail}
                      onChange={(e) => setMagicEmail(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                    />
                    <p className="mt-1.5 text-xs text-gray-400">
                      We&apos;ll send a one-click sign-in link to your inbox. No password needed.
                    </p>
                  </div>

                  {magicError && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {magicError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={magicLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {magicLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      "Send Magic Link"
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          <p className="mt-6 text-center text-xs text-gray-400">
            Contact your administrator to get access
          </p>
        </div>
      </div>
    </div>
  );
}
