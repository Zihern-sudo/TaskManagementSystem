"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginMode = "password" | "magic";

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      if (!res.ok) { setError(data.message || "Login failed."); return; }
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
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #0a2463 0%, #0747A6 40%, #1565C0 70%, #1976D2 100%)" }}>
      {/* Decorative background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #60a5fa, transparent)" }} />
        <div className="absolute top-1/2 -left-20 w-72 h-72 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #93c5fd, transparent)" }} />
        <div className="absolute -bottom-20 left-1/4 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />
        <div className="absolute top-20 right-1/3 w-40 h-40 rounded-full opacity-5" style={{ background: "radial-gradient(circle, #bfdbfe, transparent)" }} />
      </div>

      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-1/2 text-white relative z-10">
        <div className="max-w-lg">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight">RIO Task</span>
              <p className="text-blue-300 text-xs font-medium tracking-widest uppercase mt-0.5">Project Management</p>
            </div>
          </div>

          <h1 className="text-5xl font-bold leading-tight mb-5 tracking-tight">
            Manage your<br />
            <span style={{ color: "#93c5fd" }}>team&apos;s work,</span><br />
            all in one place
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed mb-10 max-w-sm">
            Plan, track, and release great software with your team using our Jira-inspired task management board.
          </p>

          {/* Feature pills */}
          <div className="flex flex-col gap-3">
            {[
              { icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2", label: "Kanban Boards", desc: "Visualise work in progress" },
              { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", label: "Task Tracking", desc: "Stay on top of deadlines" },
              { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", label: "Team Management", desc: "Invite and manage members" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(4px)" }}>
                <div className="w-8 h-8 rounded-lg bg-blue-500 bg-opacity-40 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.label}</p>
                  <p className="text-xs text-blue-300">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center px-6 lg:px-12 relative z-10">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Top accent bar */}
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #1d4ed8, #3b82f6, #60a5fa)" }} />

            <div className="px-8 pt-8 pb-10">
              {/* Mobile logo */}
              <div className="lg:hidden flex items-center gap-2.5 mb-8">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-xl font-bold text-gray-900">RIO Task</span>
              </div>

              <div className="mb-7">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
                <p className="text-gray-400 text-sm mt-1">Sign in to continue to your board</p>
              </div>

              {/* Mode tabs */}
              <div className="flex rounded-xl border border-gray-200 p-1 mb-7 bg-gray-50">
                {(["password", "magic"] as LoginMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-lg transition-all ${
                      mode === m
                        ? "bg-white text-blue-600 shadow-sm font-semibold"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {m === "password" ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Password
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Magic Link
                      </>
                    )}
                  </button>
                ))}
              </div>

              {/* Password login */}
              {mode === "password" && (
                <form onSubmit={handlePasswordLogin} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition"
                        placeholder="you@company.com"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition"
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
                      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-70"
                    style={{ background: loading ? "#93c5fd" : "linear-gradient(135deg, #1d4ed8, #2563eb)" }}
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
                      <>
                        Sign in
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Magic link */}
              {mode === "magic" && (
                <>
                  {magicSent ? (
                    <div className="flex flex-col items-center py-6 gap-5 text-center">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #dbeafe, #eff6ff)" }}>
                        <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-lg">Check your inbox</p>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                          If <span className="font-medium text-gray-700">{magicEmail}</span> is registered, a sign-in link has been sent. It expires in 15 minutes.
                        </p>
                      </div>
                      <button
                        onClick={() => { setMagicSent(false); setMagicEmail(""); }}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                      >
                        Use a different email
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleMagicLink} className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                        <div className="relative">
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <input
                            type="email"
                            value={magicEmail}
                            onChange={(e) => setMagicEmail(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition"
                            placeholder="you@company.com"
                            required
                            autoComplete="email"
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-gray-400">We&apos;ll send a one-click sign-in link. No password needed.</p>
                      </div>

                      {magicError && (
                        <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
                          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          {magicError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={magicLoading}
                        className="w-full text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-70"
                        style={{ background: magicLoading ? "#93c5fd" : "linear-gradient(135deg, #1d4ed8, #2563eb)" }}
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
                          <>
                            Send Magic Link
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </>
              )}

              <p className="mt-6 text-center text-xs text-gray-400">
                Don&apos;t have access?{" "}
                <span className="text-gray-500 font-medium">Contact your administrator</span>
              </p>
            </div>
          </div>

          {/* Bottom tagline */}
          <p className="text-center text-blue-300 text-xs mt-6 opacity-70">
            Secure • Fast • Built for teams
          </p>
        </div>
      </div>
    </div>
  );
}
