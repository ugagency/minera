"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import {
  IconCamera,
  IconCoins,
  IconPrint,
  IconTruck,
  IconWarning,
  IconWhatsApp,
} from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Stepper } from "@/components/ui/Stepper";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { formatBRL, formatM3 } from "@/lib/format";

const vehicles = [
  { label: "Toco 4 m³", m3: 4 },
  { label: "Truck 8 m³", m3: 8 },
  { label: "Caçamba 12 m³", m3: 12 },
  { label: "Carreta 25 m³", m3: 25 },
];

const sales = [
  { receipt: "PA1-000124", client: "Constr. Silva", qty: 8, total: 96000, status: "pago" },
  { receipt: "PA1-000123", client: "Venda avulsa", qty: 4, total: 48000, status: "pago" },
  { receipt: "PA1-000122", client: "J. Pereira Ltda", qty: 12, total: 144000, status: "fiado" },
  { receipt: "PA1-000121", client: "M. Obras", qty: 25, total: 175000, status: "vencido" },
];

export default function DesignPage() {
  const [qty, setQty] = useState(8);
  const [vehicle, setVehicle] = useState<string | null>("Truck 8 m³");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">MineraPonto — amostra visual</h1>
        <p className="text-ink-soft">
          Página de referência dos componentes primitivos (SPEC §5). Fundo
          areia, cartões brancos, sem sombras, tema único claro.
        </p>
      </header>

      {/* KPIs */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Cartões e KPIs</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <CardLabel>Vendas hoje</CardLabel>
            <div className="num-strong mt-1 text-2xl">{formatBRL(463000)}</div>
            <div className="mt-1 text-sm text-ink-soft">
              {formatM3(49)} · 6 carradas
            </div>
          </Card>
          <Card>
            <CardLabel>A receber</CardLabel>
            <div className="num-strong mt-1 text-2xl">{formatBRL(1284500)}</div>
            <div className="mt-1">
              <Badge tone="danger">{formatBRL(320000)} vencido</Badge>
            </div>
          </Card>
          {/* Cartão ink: reservado a UM destaque por tela */}
          <Card variant="ink">
            <CardLabel className="text-white/60">Período aberto</CardLabel>
            <div className="num-strong mt-1 text-2xl">{formatBRL(2145800)}</div>
            <Button
              variant="primary"
              size="md"
              className="mt-3 w-full"
              onClick={() => setModalOpen(true)}
            >
              Fechar acerto
            </Button>
          </Card>
        </div>
        <Card variant="tint" className="flex items-center gap-3">
          <IconWarning size={22} className="shrink-0 text-ink" />
          <p className="text-[15px]">
            <strong>Areal 1:</strong> produção 7% acima do vendido no mês —
            conferir com o operador.
          </p>
        </Card>
      </section>

      {/* Botões */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Botões</h2>
        <Card className="flex flex-wrap items-center gap-3">
          <Button variant="primary">
            <IconCoins size={18} /> Nova venda
          </Button>
          <Button variant="ghost">
            <IconPrint size={18} /> Imprimir
          </Button>
          <Button variant="ink">Fechar acerto</Button>
          <Button variant="primary" disabled>
            Desabilitado
          </Button>
          <Button variant="primary" size="lg" fullWidth>
            <IconWhatsApp size={20} /> Enviar recibo no WhatsApp
          </Button>
        </Card>
      </section>

      {/* Badges */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Badges de status</h2>
        <Card className="flex flex-wrap items-center gap-2">
          <Badge tone="ok">Pago</Badge>
          <Badge tone="danger">Vencido</Badge>
          <Badge tone="attention">Limite estourado</Badge>
          <Badge tone="neutral">Fiado</Badge>
        </Card>
      </section>

      {/* Chips + Stepper (fluxo de quantidade do campo) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Chips de veículo + stepper</h2>
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {vehicles.map((v) => (
              <Chip
                key={v.label}
                selected={vehicle === v.label}
                onClick={() => {
                  setVehicle(v.label);
                  setQty(v.m3);
                }}
              >
                <IconTruck size={18} /> {v.label}
              </Chip>
            ))}
          </div>
          <Stepper
            label="Quantidade"
            value={qty}
            onChange={(v) => {
              setQty(v);
              setVehicle(null);
            }}
            step={0.5}
            suffix="m³"
          />
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-ink-soft">Total (areia lavada, R$ 120/m³)</span>
            <span className="num-strong text-xl">{formatBRL(qty * 12000)}</span>
          </div>
        </Card>
      </section>

      {/* Inputs */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Formulário</h2>
        <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nome do cliente" placeholder="Ex.: Construtora Silva" />
          <Input
            label="Telefone"
            type="tel"
            placeholder="(31) 99999-0000"
            hint="Usado para enviar o recibo no WhatsApp"
          />
          <Input
            label="Valor recebido"
            inputMode="decimal"
            placeholder="0,00"
            error="Informe um valor maior que zero"
          />
          <Input label="Observação" placeholder="Opcional" />
        </Card>
      </section>

      {/* Tabela */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Tabela</h2>
        <Card padding="none">
          <Table>
            <THead>
              <TR>
                <TH>Recibo</TH>
                <TH>Cliente</TH>
                <TH className="text-right">Qtd</TH>
                <TH className="text-right">Total</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {sales.map((s) => (
                <TR key={s.receipt}>
                  <TD className="num">{s.receipt}</TD>
                  <TD>{s.client}</TD>
                  <TD className="num text-right">{formatM3(s.qty)}</TD>
                  <TD className="num text-right">{formatBRL(s.total)}</TD>
                  <TD>
                    {s.status === "pago" && <Badge tone="ok">Pago</Badge>}
                    {s.status === "fiado" && <Badge tone="neutral">Fiado</Badge>}
                    {s.status === "vencido" && (
                      <Badge tone="danger">Vencido</Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </section>

      {/* Botões grandes do campo */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Ações do campo (alvo ≥ 56px)</h2>
        <div className="mx-auto flex w-full max-w-[380px] flex-col gap-3">
          <Button variant="primary" size="lg" fullWidth>
            <IconCoins size={22} /> Venda
          </Button>
          <Button variant="ghost" size="lg" fullWidth>
            <IconCamera size={22} /> Produção / Gasto
          </Button>
        </div>
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Lançar recebimento"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Valor" inputMode="decimal" placeholder="0,00" />
          <Input label="Forma" placeholder="Dinheiro / PIX / Transferência" />
          <Input label="Ponto" placeholder="Areal 1 — Rio Betim" />
        </div>
      </Modal>
    </main>
  );
}
