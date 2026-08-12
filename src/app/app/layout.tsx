import Link from "next/link";
import { AppNav } from "@/components/app/AppNav";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col lg:flex-row">
      <aside className="shrink-0 border-b border-line px-4 py-4 lg:min-h-dvh lg:w-56 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <Link href="/app" className="mb-4 block text-lg font-extrabold lg:mb-8">
          MineraPonto
        </Link>
        <AppNav />
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
