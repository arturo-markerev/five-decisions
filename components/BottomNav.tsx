"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: "◆" },
  { href: "/play", label: "Play", icon: "▶" },
  { href: "/courses", label: "Courses", icon: "⛳" },
  { href: "/rounds", label: "Rounds", icon: "▤" },
  { href: "/my-game", label: "My Game", icon: "◈" },
];

export default function BottomNav() {
  const pathname = usePathname();
  // Durante la ronda la navegacion estorba: pantalla limpia.
  if (pathname.startsWith("/play/round")) return null;

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className="nav-item" data-active={active}>
              <span style={{ fontSize: 17 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
