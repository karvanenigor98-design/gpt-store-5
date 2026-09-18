import Link from "next/link";

/** Minimal prev/next pager for admin list pages (no design change). */
export function AdminListPager(props: {
  page: number;
  pageSize: number;
  total: number | null;
  /** Base path with existing query, e.g. /admin/users?site=gpt-store */
  baseHref: string;
}) {
  const { page, pageSize, total, baseHref } = props;
  const hasPrev = page > 1;
  const hasNext =
    total != null ? page * pageSize < total : true; /* unknown total → show next until empty */

  if (!hasPrev && (total != null ? total <= pageSize : !hasNext)) {
    return null;
  }

  const hrefFor = (p: number) => {
    const sep = baseHref.includes("?") ? "&" : "?";
    return `${baseHref}${sep}page=${p}`;
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
      {hasPrev ? (
        <Link href={hrefFor(page - 1)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50">
          ← Назад
        </Link>
      ) : (
        <span className="rounded-lg border border-transparent px-3 py-1.5 text-gray-300">← Назад</span>
      )}
      <span>
        Стр. {page}
        {total != null ? ` · ${total}` : ""}
      </span>
      {hasNext ? (
        <Link href={hrefFor(page + 1)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50">
          Вперёд →
        </Link>
      ) : (
        <span className="rounded-lg border border-transparent px-3 py-1.5 text-gray-300">Вперёд →</span>
      )}
    </div>
  );
}
