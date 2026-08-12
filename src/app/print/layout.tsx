// Páginas de impressão (§8): fundo branco, tipografia limpa, sem nav.
export default function PrintLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-dvh bg-white text-ink">{children}</div>;
}
