"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

const ITEMS = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/vendas", label: "Vendas" },
  { href: "/app/clientes", label: "Clientes" },
  { href: "/app/financeiro", label: "Financeiro" },
  { href: "/app/gastos", label: "Gastos" },
  { href: "/app/retiradas", label: "Retiradas" },
  { href: "/app/cadastros", label: "Cadastros" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map((item) => {
        const active =
          item.href === "/app"
            ? pathname === "/app"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "whitespace-nowrap rounded-control px-3 py-2 text-[15px] font-medium transition-colors",
              active
                ? "bg-ink text-white"
                : "text-ink-soft hover:bg-sand-tint hover:text-ink"
            )}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/campo"
        className="whitespace-nowrap rounded-control px-3 py-2 text-[15px] font-medium text-ink-faint hover:bg-sand-tint hover:text-ink lg:mt-6"
      >
        Modo campo →
      </Link>
    </nav>
  );
}
