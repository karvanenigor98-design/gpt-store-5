"use client";

function formatBadgeCount(count: number): string {
  if (count > 9999) return "9999+";
  return String(count);
}

export function StaffNavBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  const label = formatBadgeCount(count);
  return (
    <span
      className="ml-auto flex h-5 min-w-5 max-w-[4.5rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white tabular-nums"
      title={`${count} непрочитанных`}
    >
      {label}
    </span>
  );
}
