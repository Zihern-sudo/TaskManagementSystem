"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { User, UserRole, AccountStatus } from "@/types";

const STATUS_STYLES: Record<AccountStatus, string> = {
  active: "bg-green-100 text-green-700 border border-green-200",
  invited: "bg-amber-100 text-amber-700 border border-amber-200",
  pending: "bg-gray-100 text-gray-600 border border-gray-200",
};

const STATUS_DOTS: Record<AccountStatus, string> = {
  active: "bg-green-500",
  invited: "bg-amber-400",
  pending: "bg-gray-400",
};

const ROLE_STYLES: Record<UserRole, string> = {
  admin: "bg-blue-100 text-blue-700 border border-blue-200",
  member: "bg-gray-100 text-gray-600 border border-gray-200",
};

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-blue-500", "bg-purple-500",
  "bg-pink-500", "bg-teal-500", "bg-orange-500",
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ── Sort helpers ──────────────────────────────────────────────────────────

type SortField = "idx" | "fullName" | "email" | "role" | "status" | "createdAt";
type SortDir = "asc" | "desc" | "none";

function sortUsers(users: User[], field: SortField, dir: SortDir): User[] {
  if (dir === "none") return users;
  return [...users].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "fullName": cmp = a.fullName.localeCompare(b.fullName); break;
      case "email": cmp = a.email.localeCompare(b.email); break;
      case "role": cmp = a.role.localeCompare(b.role); break;
      case "status": cmp = a.status.localeCompare(b.status); break;
      case "idx":
      case "createdAt": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function SortTh({
  field, label, sortField, sortDir, onSort, className,
}: {
  field: SortField; label: string; sortField: SortField; sortDir: SortDir;
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = sortField === field && sortDir !== "none";
  return (
    <th
      className={`text-left px-5 py-3.5 font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors group ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={`text-xs transition-opacity ${active ? "opacity-100 text-blue-500" : "opacity-0 group-hover:opacity-40"}`}>
          {sortDir === "asc" && sortField === field ? "↑" : sortDir === "desc" && sortField === field ? "↓" : "↕"}
        </span>
      </div>
    </th>
  );
}

// ── User Modal ─────────────────────────────────────────────────────────────

interface UserModalProps {
  user: User | null;
  onClose: () => void;
  onSave: (user: User) => void;
}

function UserModal({ user, onClose, onSave }: UserModalProps) {
  const isEdit = !!user;
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? "member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!fullName.trim() || !email.trim()) { setError("Name and email are required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(isEdit ? `/api/admin/users/${user!.id}` : "/api/admin/users", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to save user."); return; }
      onSave(data.data.user);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Modal header with accent */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 to-blue-400" />
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? "Edit User" : "Add New User"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition"
              placeholder="john@company.com"
            />
            {isEdit && <p className="text-xs text-gray-400 mt-1">Email cannot be changed after creation.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl flex items-center gap-2 transition"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : isEdit ? "Save Changes" : "Add User"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Table ─────────────────────────────────────────────────────────────

export default function UserManagementTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<UserRole | "">("");
  const [filterStatus, setFilterStatus] = useState<AccountStatus | "">("");
  const [editUser, setEditUser] = useState<User | null | undefined>(undefined);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  async function fetchUsers() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (data.data?.users) setUsers(data.data.users);
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

  function handleSort(field: SortField) {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("asc");
    } else {
      setSortDir((prev) => (prev === "none" ? "asc" : prev === "asc" ? "desc" : "none"));
    }
  }

  async function handleInvite(userId: string) {
    await fetch(`/api/admin/users/${userId}/invite`, { method: "POST" });
    await fetchUsers();
  }

  async function handleDeactivate(userId: string) {
    if (!confirm("Deactivate this user? They will no longer be able to sign in.")) return;
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
    });
    await fetchUsers();
  }

  async function handleRevokeInvite(userId: string) {
    if (!confirm("Revoke this invitation? The email link will be invalidated.")) return;
    await fetch(`/api/admin/users/${userId}/revoke-invite`, { method: "POST" });
    await fetchUsers();
  }

  async function handleDelete(userId: string) {
    if (!confirm("Permanently delete this user? This cannot be undone.")) return;
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    await fetchUsers();
  }

  function handleSaved(user: User) {
    setUsers((prev) => {
      const exists = prev.find((u) => u.id === user.id);
      return exists ? prev.map((u) => u.id === user.id ? user : u) : [user, ...prev];
    });
    setEditUser(undefined);
  }

  const filtered = users.filter((u) => {
    const matchSearch = !search || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    const matchStatus = !filterStatus || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const sorted = sortUsers(filtered, sortField, sortDir);

  // Stats
  const activeCount = users.filter((u) => u.status === "active").length;
  const invitedCount = users.filter((u) => u.status === "invited").length;
  const pendingCount = users.filter((u) => u.status === "pending").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">{users.length} total users</p>
        </div>
        <button
          onClick={() => setEditUser(null)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-6">
        <div className="flex items-center gap-1.5 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="font-semibold text-gray-800">{activeCount}</span>
          <span className="text-gray-400">active</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-semibold text-gray-800">{invitedCount}</span>
          <span className="text-gray-400">invited</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="font-semibold text-gray-800">{pendingCount}</span>
          <span className="text-gray-400">pending</span>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as UserRole | "")}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as AccountStatus | "")}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="pending">Pending</option>
        </select>
        {(search || filterRole || filterStatus) && (
          <button
            onClick={() => { setSearch(""); setFilterRole(""); setFilterStatus(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} of {users.length} shown</span>
      </div>

      {/* Table */}
      <div className="flex-1 p-6 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-gray-400">
            <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading users...
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <SortTh field="idx" label="#" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="w-12" />
                  <SortTh field="fullName" label="User" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  <SortTh field="role" label="Role" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                  <SortTh field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                  <SortTh field="createdAt" label="Joined" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden xl:table-cell" />
                  <th className="text-right px-5 py-3.5 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-sm">No users found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sorted.map((user, idx) => (
                    <tr
                      key={user.id}
                      className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                    >
                      <td className="px-5 py-4 text-gray-400 text-xs font-mono">{idx + 1}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm overflow-hidden`}
                          >
                            {user.avatarUrl ? (
                              <Image src={user.avatarUrl} alt={user.fullName} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                            ) : (
                              getInitials(user.fullName)
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{user.fullName}</div>
                            <div className="text-xs text-gray-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${ROLE_STYLES[user.role]}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <span className={`text-xs px-2.5 py-1.5 rounded-full font-medium capitalize flex items-center gap-1.5 w-fit ${STATUS_STYLES[user.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[user.status]}`} />
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden xl:table-cell text-gray-500 text-xs">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {user.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleInvite(user.id)}
                                className="text-xs px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium transition-colors border border-green-200"
                              >
                                Invite
                              </button>
                              <button
                                onClick={() => setEditUser(user)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                          {user.status === "invited" && (
                            <>
                              <button
                                onClick={() => setEditUser(user)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleRevokeInvite(user.id)}
                                className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg font-medium transition-colors border border-amber-200"
                              >
                                Revoke
                              </button>
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                          {user.status === "active" && (
                            <>
                              <button
                                onClick={() => setEditUser(user)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeactivate(user.id)}
                                className="text-xs px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors border border-red-200"
                              >
                                Deactivate
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Modal */}
      {editUser !== undefined && (
        <UserModal
          user={editUser}
          onClose={() => setEditUser(undefined)}
          onSave={handleSaved}
        />
      )}
    </div>
  );
}
