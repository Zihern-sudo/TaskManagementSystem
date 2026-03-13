"use client";

import { useEffect, useState } from "react";

interface ProfileData {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

interface TaskSummary {
  total: number;
  inProgress: number;
  overdue: number;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [taskSummary, setTaskSummary] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit name
  const [editName, setEditName] = useState(false);
  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState(false);

  // Change password
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  async function fetchProfile() {
    const res = await fetch("/api/profile");
    const data = await res.json();
    if (data.data) {
      setProfile(data.data.user);
      setTaskSummary(data.data.taskSummary);
      setFullName(data.data.user.fullName);
    }
    setLoading(false);
  }

  useEffect(() => { fetchProfile(); }, []);

  async function handleSaveName() {
    if (!fullName.trim()) { setNameError("Name cannot be empty."); return; }
    setSavingName(true);
    setNameError("");
    setNameSuccess(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const data = await res.json();
      if (!res.ok) { setNameError(data.message || "Failed to update."); return; }
      setProfile((prev) => prev ? { ...prev, fullName: data.data.user.fullName } : prev);
      setNameSuccess(true);
      setEditName(false);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch {
      setNameError("Network error.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword() {
    setPwError("");
    setPwSuccess(false);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError("All fields are required."); return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match."); return;
    }
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters."); return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.message || "Failed to update password."); return; }
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPwForm(false);
      setTimeout(() => setPwSuccess(false), 4000);
    } catch {
      setPwError("Network error.");
    } finally {
      setSavingPw(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
        <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading profile...
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500">Manage your personal information and security</p>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Profile card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Gradient banner */}
            <div className="h-24 w-full" style={{ background: "linear-gradient(135deg, #0747A6 0%, #1565C0 60%, #1976D2 100%)" }} />

            <div className="px-6 pb-6">
              {/* Avatar */}
              <div className="flex items-end justify-between -mt-10 mb-4">
                <div className="w-20 h-20 rounded-2xl bg-indigo-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg border-4 border-white">
                  {getInitials(profile.fullName)}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize border ${
                    profile.role === "admin" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200"
                  }`}>
                    {profile.role}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium capitalize bg-green-100 text-green-700 border border-green-200">
                    {profile.status}
                  </span>
                </div>
              </div>

              {/* Name display / edit */}
              {!editName ? (
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{profile.fullName}</h2>
                    <p className="text-gray-400 text-sm">{profile.email}</p>
                    <p className="text-gray-400 text-xs mt-1">Member since {formatDate(profile.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => { setEditName(true); setFullName(profile.fullName); setNameError(""); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-300"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit name
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {nameError && (
                    <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{nameError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2 transition"
                    >
                      {savingName ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Saving...
                        </>
                      ) : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditName(false); setNameError(""); }}
                      className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {nameSuccess && (
                <div className="mt-3 flex items-center gap-2 text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Name updated successfully!
                </div>
              )}
            </div>
          </div>

          {/* Task summary */}
          {taskSummary && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Assigned Tasks", value: taskSummary.total, color: "text-blue-600", bg: "bg-blue-50", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
                { label: "In Progress", value: taskSummary.inProgress, color: "text-indigo-600", bg: "bg-indigo-50", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
                { label: "Overdue", value: taskSummary.overdue, color: "text-red-600", bg: "bg-red-50", icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                    <svg className={`w-5 h-5 ${stat.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                    </svg>
                  </div>
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Security section */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Password & Security</h3>
                  <p className="text-xs text-gray-400">Update your account password</p>
                </div>
              </div>
              <button
                onClick={() => { setShowPwForm(!showPwForm); setPwError(""); setPwSuccess(false); }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showPwForm ? "Cancel" : "Change password"}
              </button>
            </div>

            {pwSuccess && (
              <div className="mx-6 mt-4 flex items-center gap-2 text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Password changed successfully!
              </div>
            )}

            {showPwForm && (
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Min. 8 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>
                {pwError && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{pwError}</p>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={savingPw}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl transition"
                >
                  {savingPw ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Updating...
                    </>
                  ) : "Update Password"}
                </button>
              </div>
            )}

            {!showPwForm && !pwSuccess && (
              <div className="px-6 py-4">
                <p className="text-sm text-gray-400">Your password was last set when your account was created.</p>
              </div>
            )}
          </div>

          {/* Account info */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Account Information</h3>
            </div>
            <div className="px-6 py-4 divide-y divide-gray-100">
              {[
                { label: "Email Address", value: profile.email },
                { label: "Role", value: profile.role.charAt(0).toUpperCase() + profile.role.slice(1) },
                { label: "Account Status", value: profile.status.charAt(0).toUpperCase() + profile.status.slice(1) },
                { label: "Member Since", value: formatDate(profile.createdAt) },
                { label: "User ID", value: profile.id },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-3">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900 font-mono text-right max-w-[60%] truncate">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
