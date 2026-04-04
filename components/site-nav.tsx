import Link from "next/link";

type SiteNavProps = {
  current?: "map" | "practice" | "about";
};

const links = [
  { href: "/", label: "Map", key: "map" },
  { href: "/practice", label: "Practice", key: "practice" },
  { href: "/about", label: "About", key: "about" },
] as const;

export function SiteNav({ current }: SiteNavProps) {
  return (
    <nav className="relative mx-auto flex max-w-[94vw] items-center justify-between px-6 pt-6 lg:px-10">
      <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em] text-indigo-100">
        <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
        Jeopardy Mind Map
      </div>
      <div className="flex items-center gap-2">
        {links.map((link) => {
          const isCurrent = current === link.key;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                isCurrent
                  ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-100"
                  : "border-white/15 text-indigo-50 hover:border-white/40 hover:bg-white/10"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
