"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { IconArrowRight, IconCamera, IconCheck, IconTruck, IconWarning, IconWhatsApp } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Stepper } from "@/components/ui/Stepper";
import { createClient, createSale } from "@/lib/data/actions";
import type { ClientWithBalance } from "@/lib/data/queries";
import type { Point, Product, Vehicle } from "@/lib/data/types";
import { formatBRL, formatM3 } from "@/lib/format";
import { centsToDecimalString, decimalStringToCents } from "@/lib/money";
import { DEMO_PIX_KEY } from "@/lib/config";

type Props = {
  point: Point;
  clients: ClientWithBalance[];
  products: Product[];
  vehicles: Vehicle[];
};

type PayMethod = "cash" | "pix";

const STEP_TITLES = ["Cliente", "Produto", "Quantidade", "Pagamento", "Foto"];

export function SaleWizard({ point, clients: initialClients, products, vehicles }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string | null | "avulsa">(null);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientPending, startNewClient] = useTransition();

  const [productId, setProductId] = useState<string | null>(
    products[0]?.id ?? null
  );

  const [qtyM3, setQtyM3] = useState(1);
  const [vehicleId, setVehicleId] = useState<string | null>(null);

  const [payingNow, setPayingNow] = useState(0); // centavos
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [pixCopied, setPixCopied] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "ok" | "off">("idle");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ saleId: string; receiptNo: string } | null>(null);

  const selectedClient = useMemo(
    () => (typeof clientId === "string" ? clients.find((c) => c.id === clientId) ?? null : null),
    [clientId, clients]
  );
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [productId, products]
  );

  const total = selectedProduct ? Math.round(qtyM3 * selectedProduct.price_per_m3) : 0;
  const creditAmount = Math.max(0, total - payingNow);

  // ao entrar no passo 4, pré-preenche "quanto está pagando agora" com o total (§7.1)
  useEffect(() => {
    if (step === 4) setPayingNow(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step !== 5 || gpsStatus !== "idle") return;
    if (!navigator.geolocation) {
      setGpsStatus("off");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus("ok");
      },
      () => setGpsStatus("off"),
      { timeout: 6000 }
    );
  }, [step, gpsStatus]);

  const filteredClients = clients.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
  });

  const creditAllowed = Boolean(selectedClient?.credit_enabled);
  const creditBlocked = creditAmount > 0 && !creditAllowed;
  const overLimit =
    creditAmount > 0 &&
    selectedClient !== null &&
    selectedClient.credit_limit > 0 &&
    selectedClient.balance + creditAmount > selectedClient.credit_limit;

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleNewClient(formData: FormData) {
    startNewClient(async () => {
      const created = await createClient(formData);
      const newClient: ClientWithBalance = {
        id: created.id,
        created_at: new Date().toISOString(),
        company_id: "",
        name: created.name,
        phone: created.phone,
        doc: null,
        credit_enabled: false,
        credit_limit: 0,
        balance: 0,
      };
      setClients((prev) => [...prev, newClient]);
      setClientId(newClient.id);
      setNewClientOpen(false);
      setStep(2);
    });
  }

  function onPhotoChange(file: File | null) {
    setPhotoFile(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit() {
    if (!selectedProduct || !photoFile) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("product_id", selectedProduct.id);
      if (selectedClient) fd.set("client_id", selectedClient.id);
      fd.set("qty_m3", String(qtyM3));
      fd.set("paying_now_amount", String(payingNow));
      fd.set("paying_now_method", payMethod);
      if (gps) {
        fd.set("gps_lat", String(gps.lat));
        fd.set("gps_lng", String(gps.lng));
      }
      fd.set("photo", photoFile);

      const res = await createSale(fd);
      setResult(res);
      setStep(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível registrar a venda.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 6 && result) {
    return (
      <ReceiptStep
        point={point}
        product={selectedProduct}
        client={selectedClient}
        qtyM3={qtyM3}
        total={total}
        payingNow={payingNow}
        payMethod={payMethod}
        creditAmount={creditAmount}
        receiptNo={result.receiptNo}
        saleId={result.saleId}
        onDone={() => router.push("/campo")}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Voltar"
            className="flex h-10 w-10 items-center justify-center rounded-control border border-line bg-card"
          >
            <IconArrowRight size={18} className="rotate-180" />
          </button>
        ) : null}
        <div className="flex flex-col">
          <span className="text-sm text-ink-faint">
            Passo {step} de 5 · {point.name}
          </span>
          <h1 className="text-xl font-bold">{STEP_TITLES[step - 1]}</h1>
        </div>
      </header>

      {step === 1 && (
        <section className="flex flex-col gap-3">
          <Input
            label="Buscar cliente"
            placeholder="Nome ou telefone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setClientId("avulsa");
                setStep(2);
              }}
              className="text-left"
            >
              <Card className="flex items-center justify-between hover:bg-sand-tint">
                <span className="font-semibold">Venda avulsa</span>
                <span className="text-sm text-ink-faint">sem cliente cadastrado</span>
              </Card>
            </button>

            {filteredClients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setClientId(c.id);
                  setStep(2);
                }}
                className="text-left"
              >
                <Card className="flex items-center justify-between hover:bg-sand-tint">
                  <div className="flex flex-col">
                    <span className="font-semibold">{c.name}</span>
                    {c.phone ? (
                      <span className="text-sm text-ink-faint">{c.phone}</span>
                    ) : null}
                  </div>
                  {c.balance > 0 ? (
                    <Badge tone="danger">{formatBRL(c.balance)} em aberto</Badge>
                  ) : null}
                </Card>
              </button>
            ))}
          </div>

          <Button variant="ghost" onClick={() => setNewClientOpen(true)}>
            + Cliente novo
          </Button>
        </section>
      )}

      {step === 2 && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setProductId(p.id);
                setStep(3);
              }}
              className="text-left"
            >
              <Card
                className={
                  productId === p.id
                    ? "border-ink hover:bg-sand-tint"
                    : "hover:bg-sand-tint"
                }
              >
                <span className="font-semibold">{p.name}</span>
                <div className="num-strong mt-1 text-lg">
                  {formatBRL(p.price_per_m3)}
                  <span className="ml-1 text-sm font-medium text-ink-soft">/m³</span>
                </div>
              </Card>
            </button>
          ))}
        </section>
      )}

      {step === 3 && selectedProduct && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {vehicles.map((v) => (
              <Chip
                key={v.id}
                selected={vehicleId === v.id}
                onClick={() => {
                  setVehicleId(v.id);
                  setQtyM3(v.capacity_m3);
                }}
              >
                <IconTruck size={16} /> {v.label}
              </Chip>
            ))}
          </div>
          <Stepper
            label="Quantidade"
            value={qtyM3}
            onChange={(v) => {
              setQtyM3(v);
              setVehicleId(null);
            }}
            min={0.5}
            step={0.5}
            suffix="m³"
          />
          <Card variant="tint" className="flex items-baseline justify-between">
            <span className="text-ink-soft">Total</span>
            <span className="num-strong text-xl">{formatBRL(total)}</span>
          </Card>
          <Button variant="primary" size="lg" fullWidth onClick={() => setStep(4)}>
            Continuar
          </Button>
        </section>
      )}

      {step === 4 && (
        <section className="flex flex-col gap-4">
          <Card variant="ink" className="flex items-baseline justify-between">
            <CardLabel className="text-white/60">Total da venda</CardLabel>
            <span className="num-strong text-2xl">{formatBRL(total)}</span>
          </Card>

          <Input
            label="Quanto está pagando agora?"
            inputMode="decimal"
            value={centsToDecimalString(payingNow)}
            onChange={(e) => setPayingNow(Math.max(0, decimalStringToCents(e.target.value)))}
          />

          <div className="flex gap-2">
            <Chip selected={payMethod === "cash"} onClick={() => setPayMethod("cash")}>
              Dinheiro
            </Chip>
            <Chip selected={payMethod === "pix"} onClick={() => setPayMethod("pix")}>
              PIX
            </Chip>
          </div>

          {payMethod === "pix" && (
            <Card className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <CardLabel>Chave PIX</CardLabel>
                <span className="num text-[15px]">{DEMO_PIX_KEY}</span>
              </div>
              <Button
                variant="ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(DEMO_PIX_KEY);
                  setPixCopied(true);
                  setTimeout(() => setPixCopied(false), 2000);
                }}
              >
                {pixCopied ? "Copiado!" : "Copiar"}
              </Button>
            </Card>
          )}

          {creditAmount > 0 && !creditBlocked && (
            <Card variant="tint" className="flex items-baseline justify-between">
              <span className="text-ink-soft">Fica fiado</span>
              <span className="num-strong text-lg">{formatBRL(creditAmount)}</span>
            </Card>
          )}

          {creditBlocked && (
            <Card className="flex items-center gap-2 border-danger bg-danger-tint">
              <IconWarning size={20} className="shrink-0 text-danger" />
              <p className="text-[15px] text-danger">
                {selectedClient
                  ? "Este cliente não tem fiado habilitado — o pagamento precisa cobrir o total."
                  : "Venda avulsa não pode ficar fiado — o pagamento precisa cobrir o total."}
              </p>
            </Card>
          )}

          {overLimit && (
            <Card variant="tint" className="flex items-center gap-2">
              <IconWarning size={20} className="shrink-0 text-ink" />
              <p className="text-[15px]">
                Este fiado estoura o limite de crédito do cliente (
                {formatBRL(selectedClient!.credit_limit)}). Você pode continuar mesmo
                assim.
              </p>
            </Card>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={creditBlocked}
            onClick={() => setStep(5)}
          >
            Continuar
          </Button>
        </section>
      )}

      {step === 5 && (
        <section className="flex flex-col gap-4">
          <PhotoPicker preview={photoPreview} onChange={onPhotoChange} />

          <p className="text-sm text-ink-faint">
            Ao registrar a foto, a localização e o horário da retirada são
            gravados automaticamente para controle interno.
          </p>

          <div className="text-sm text-ink-soft">
            {gpsStatus === "loading" && "Obtendo localização…"}
            {gpsStatus === "ok" && "Localização registrada."}
            {gpsStatus === "off" && "Localização indisponível — a venda segue sem GPS."}
          </div>

          {error && (
            <Card className="border-danger bg-danger-tint">
              <p className="text-[15px] text-danger">{error}</p>
            </Card>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!photoFile || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Registrando…" : "Concluir venda"}
          </Button>
        </section>
      )}

      <Modal
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        title="Cliente novo"
      >
        <form
          action={handleNewClient}
          className="flex flex-col gap-4"
        >
          <Input label="Nome" name="name" required autoFocus />
          <Input label="Telefone" name="phone" type="tel" placeholder="(31) 99999-0000" />
          <Button type="submit" variant="primary" fullWidth disabled={newClientPending}>
            {newClientPending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function PhotoPicker({
  preview,
  onChange,
}: {
  preview: string | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <button type="button" onClick={() => inputRef.current?.click()} className="text-left">
        <Card className="flex min-h-[220px] items-center justify-center overflow-hidden hover:bg-sand-tint">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Foto de retirada" className="h-full max-h-[300px] w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-ink-soft">
              <IconCamera size={32} />
              <span className="font-medium">Toque para tirar a foto de retirada</span>
            </div>
          )}
        </Card>
      </button>
    </div>
  );
}

function ReceiptStep({
  point,
  product,
  client,
  qtyM3,
  total,
  payingNow,
  payMethod,
  creditAmount,
  receiptNo,
  saleId,
  onDone,
}: {
  point: Point;
  product: Product | null;
  client: ClientWithBalance | null;
  qtyM3: number;
  total: number;
  payingNow: number;
  payMethod: PayMethod;
  creditAmount: number;
  receiptNo: string;
  saleId: string;
  onDone: () => void;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");

  useEffect(() => {
    setReceiptUrl(`${window.location.origin}/r/${saleId}`);
  }, [saleId]);

  useEffect(() => {
    if (!qrOpen || !receiptUrl) return;
    QRCode.toDataURL(receiptUrl, { margin: 1, width: 240 }).then(setQrDataUrl);
  }, [qrOpen, receiptUrl]);

  const whatsappHref = receiptUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Recibo MineraPonto ${receiptNo} — ${point.name}\n${receiptUrl}`
      )}`
    : "#";

  return (
    <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-5 px-4 py-6">
      <header className="flex flex-col items-center gap-2 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ok-tint text-ok">
          <IconCheck size={28} />
        </div>
        <h1 className="text-xl font-bold">Venda registrada</h1>
        <span className="num-strong text-lg text-ink-soft">{receiptNo}</span>
      </header>

      <Card className="flex flex-col gap-2">
        <Row label="Ponto" value={point.name} />
        <Row label="Cliente" value={client?.name ?? "Venda avulsa"} />
        <Row label="Produto" value={product?.name ?? "—"} />
        <Row label="Quantidade" value={formatM3(qtyM3)} />
        <div className="border-t border-line pt-2">
          <Row label="Total" value={formatBRL(total)} strong />
        </div>
        <Row
          label={payMethod === "cash" ? "Pago agora (dinheiro)" : "Pago agora (PIX)"}
          value={formatBRL(payingNow)}
        />
        {creditAmount > 0 && <Row label="Fiado" value={formatBRL(creditAmount)} />}
      </Card>

      <div className="flex flex-col gap-3">
        <a href={whatsappHref} target="_blank" rel="noreferrer">
          <Button variant="primary" size="lg" fullWidth>
            <IconWhatsApp size={20} /> Enviar recibo no WhatsApp
          </Button>
        </a>
        <Button variant="ghost" size="lg" fullWidth onClick={() => setQrOpen(true)}>
          Mostrar QR
        </Button>
        <Button variant="ink" size="lg" fullWidth onClick={onDone}>
          Concluir
        </Button>
      </div>

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="QR do recibo">
        <div className="flex flex-col items-center gap-3">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR code do recibo" width={240} height={240} />
          ) : (
            <div className="flex h-[240px] w-[240px] items-center justify-center text-ink-faint">
              Gerando…
            </div>
          )}
          <p className="break-all text-center text-sm text-ink-faint">{receiptUrl}</p>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className={strong ? "num-strong text-lg" : "num text-[15px]"}>{value}</span>
    </div>
  );
}
