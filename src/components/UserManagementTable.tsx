"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { User, UserRole, AccountStatus } from "@/types";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useCustomFields } from "@/contexts/CustomFieldsContext";
import CustomFieldFormModal from "@/components/CustomFieldFormModal";

const STATUS_STYLES: Record<AccountStatus, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  invited: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-slate-100 text-slate-500 border-slate-200",
};

const STATUS_DOTS: Record<AccountStatus, string> = {
  active: "bg-green-500",
  invited: "bg-amber-400",
  pending: "bg-slate-400",
};

const ROLE_STYLES: Record<UserRole, string> = {
  admin: "bg-indigo-50 text-indigo-700 border-indigo-200",
  member: "bg-slate-100 text-slate-600 border-slate-200",
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
      className={`text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors group ${active ? "text-indigo-600 bg-indigo-50/60" : "text-slate-500 hover:bg-slate-50/80 hover:text-slate-700"} ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <span className={`text-[10px] transition-all ${active ? "opacity-100 text-indigo-500" : "opacity-0 group-hover:opacity-50"}`}>
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
  const { userFields } = useCustomFields();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? "member");
  const [cfValues, setCfValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    user?.customFields?.forEach((cf) => { init[cf.fieldId] = cf.value; });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!fullName.trim() || !email.trim()) { setError("Name and email are required."); return; }
    setSaving(true);
    setError("");
    try {
      const customFieldValues = Object.entries(cfValues)
        .filter(([, v]) => v.trim() !== "")
        .map(([fieldId, value]) => ({ fieldId, value }));

      const res = await fetch(isEdit ? `/api/admin/users/${user!.id}` : "/api/admin/users", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), role, customFieldValues }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to save user."); return; }
      toast.success(isEdit ? "User updated" : "User created");
      onSave(data.data.user);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,0.2)] w-full max-w-md overflow-hidden animate-scale-in">
        {/* Gradient accent bar */}
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899)" }} />
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">{isEdit ? "Edit User" : "Add New User"}</h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">{isEdit ? "Update team member details" : "Invite someone to your team"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all placeholder-slate-400"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder-slate-400"
              placeholder="john@company.com"
            />
            {isEdit && <p className="text-xs text-slate-400 mt-1.5 font-medium">Email address cannot be changed after creation.</p>}
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {userFields.length > 0 && (
            <>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Custom Fields</p>
                <div className="space-y-3">
                  {userFields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
                      </label>
                      {field.type === "picklist" ? (
                        <select
                          value={cfValues[field.id] ?? ""}
                          onChange={(e) => setCfValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                        >
                          <option value="">— Select —</option>
                          {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={cfValues[field.id] ?? ""}
                          onChange={(e) => setCfValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all placeholder-slate-400"
                          placeholder={`Enter ${field.label.toLowerCase()}…`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.97] disabled:opacity-50 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
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
  const { userFields, refresh: refreshFields } = useCustomFields();
  const listCustomFields = userFields.filter((f) => f.showInListView);
  const [showCFModal, setShowCFModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<UserRole | "">("");
  const [filterStatus, setFilterStatus] = useState<AccountStatus | "">("");
  const [editUser, setEditUser] = useState<User | null | undefined>(undefined);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [confirmState, setConfirmState] = useState<{
    title: string; message: string; confirmLabel: string;
    variant: "danger" | "warning"; onConfirm: () => void;
  } | null>(null);

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
    const res = await fetch(`/api/admin/users/${userId}/invite`, { method: "POST" });
    if (res.ok) toast.success("Invitation sent");
    else toast.error("Failed to send invitation.");
    await fetchUsers();
  }

  function promptDeactivate(userId: string) {
    setConfirmState({
      title: "Deactivate User",
      message: "This user will no longer be able to sign in.",
      confirmLabel: "Deactivate",
      variant: "warning",
      onConfirm: async () => {
        setConfirmState(null);
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "pending" }),
        });
        if (res.ok) toast.success("User deactivated");
        else toast.error("Failed to deactivate user.");
        await fetchUsers();
      },
    });
  }

  function promptRevokeInvite(userId: string) {
    setConfirmState({
      title: "Revoke Invitation",
      message: "The invitation email link will be invalidated immediately.",
      confirmLabel: "Revoke",
      variant: "warning",
      onConfirm: async () => {
        setConfirmState(null);
        const res = await fetch(`/api/admin/users/${userId}/revoke-invite`, { method: "POST" });
        if (res.ok) toast.success("Invitation revoked");
        else toast.error("Failed to revoke invitation.");
        await fetchUsers();
      },
    });
  }

  function promptDelete(userId: string) {
    setConfirmState({
      title: "Delete User",
      message: "This user will be permanently deleted and cannot be recovered.",
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        setConfirmState(null);
        const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
        if (res.ok) toast.success("User deleted");
        else toast.error("Failed to delete user.");
        await fetchUsers();
      },
    });
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
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">User Management</h1>
          <p className="text-sm text-slate-400 font-medium mt-0.5">{users.length} total team members</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCFModal(true)}
            className="hidden sm:flex items-center gap-1.5 h-9 px-3 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Custom Field
          </button>
          <button
            onClick={() => setEditUser(null)}
            className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.97]"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="px-4 sm:px-6 py-4 bg-white border-b border-slate-100 grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-bold text-green-700 leading-none">{activeCount}</p>
            <p className="text-xs font-semibold text-green-500 mt-0.5">Active</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-bold text-amber-700 leading-none">{invitedCount}</p>
            <p className="text-xs font-semibold text-amber-500 mt-0.5">Invited</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-700 leading-none">{pendingCount}</p>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">Pending</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent w-64 bg-slate-50 focus:bg-white transition-all"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as UserRole | "")}
          className="text-sm border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all font-medium"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as AccountStatus | "")}
          className="text-sm border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all font-medium"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="pending">Pending</option>
        </select>
        {(search || filterRole || filterStatus) && (
          <button
            onClick={() => { setSearch(""); setFilterRole(""); setFilterStatus(""); }}
            className="text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors font-semibold"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 font-medium">{filtered.length} of {users.length} shown</span>
      </div>

      {/* Table */}
      <div className="flex-1 p-6 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
            <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading users...
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Top accent bar */}
            <div className="h-1" style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed, #a855f7)" }} />
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b-2 border-slate-100 bg-gradient-to-b from-slate-50 to-white">
                  <SortTh field="idx" label="#" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="w-12" />
                  <SortTh field="fullName" label="User" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  <SortTh field="role" label="Role" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                  <SortTh field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                  <SortTh field="createdAt" label="Joined" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden xl:table-cell" />
                  {listCustomFields.map((cf) => (
                    <th key={cf.id} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden 2xl:table-cell">
                      {cf.label}
                    </th>
                  ))}
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-20">
                      <div className="flex flex-col items-center gap-4 text-slate-400">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                          <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-600">No users found</p>
                          <p className="text-xs text-slate-400 mt-0.5">Try adjusting your filters</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sorted.map((user, idx) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors group"
                    >
                      <td className="px-5 py-4 text-slate-300 text-xs font-mono w-12">{idx + 1}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm overflow-hidden ring-2 ring-white`}
                          >
                            {user.avatarUrl ? (
                              <Image src={user.avatarUrl} alt={user.fullName} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                            ) : (
                              getInitials(user.fullName)
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{user.fullName}</div>
                            <div className="text-xs text-slate-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold border capitalize ${ROLE_STYLES[user.role]}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold border capitalize gap-1.5 w-fit ${STATUS_STYLES[user.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[user.status]}`} />
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden xl:table-cell text-slate-400 text-xs font-medium">
                        {formatDate(user.createdAt)}
                      </td>
                      {listCustomFields.map((cf) => {
                        const val = user.customFields?.find((c) => c.fieldId === cf.id)?.value ?? "";
                        return (
                          <td key={cf.id} className="px-4 py-4 hidden 2xl:table-cell text-xs text-slate-600 font-medium max-w-[140px] truncate">
                            {val || <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          {user.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleInvite(user.id)}
                                className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-semibold transition-colors border border-emerald-200"
                              >
                                Invite
                              </button>
                              <button
                                onClick={() => setEditUser(user)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => promptDelete(user.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => promptRevokeInvite(user.id)}
                                className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg font-semibold transition-colors border border-amber-200"
                              >
                                Revoke
                              </button>
                              <button
                                onClick={() => promptDelete(user.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => promptDeactivate(user.id)}
                                className="text-xs px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-semibold transition-colors border border-red-200"
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

      {/* Confirm Dialog */}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          variant={confirmState.variant}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {/* Custom Field Modal */}
      {showCFModal && (
        <CustomFieldFormModal
          defaultEntity="user"
          onClose={() => setShowCFModal(false)}
          onSaved={(_saved) => { refreshFields(); setShowCFModal(false); }}
        />
      )}
    </div>
  );
}
