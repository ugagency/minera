"use client";

import { Button } from "@/components/ui/Button";
import { IconPrint } from "@/components/ui/Icon";

export function PrintButton() {
  return (
    <Button variant="primary" onClick={() => window.print()} className="print:hidden">
      <IconPrint size={18} /> Imprimir / Salvar PDF
    </Button>
  );
}
