import { AssignedUser } from "@/types";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-teal-500",
];

interface AvatarGroupProps {
  users: AssignedUser[];
  max?: number;
  size?: "sm" | "md";
}

export default function AvatarGroup({ users, max = 3, size = "sm" }: AvatarGroupProps) {
  if (!users || users.length === 0) return null;

  const visible = users.slice(0, max);
  const overflow = users.length - max;
  const dim = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";

  return (
    <div className="flex items-center">
      {visible.map((user, i) => (
        <div
          key={user.id}
          title={user.fullName}
          className={`${dim} rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold shrink-0 ring-2 ring-white`}
          style={{ marginLeft: i === 0 ? 0 : "-6px", zIndex: visible.length - i }}
        >
          {getInitials(user.fullName)}
        </div>
      ))}
      {overflow > 0 && (
        <div
          title={users.slice(max).map((u) => u.fullName).join(", ")}
          className={`${dim} rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold shrink-0 ring-2 ring-white`}
          style={{ marginLeft: "-6px" }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
