"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconPlus } from "@/components/ui/Icon";
import { CrudModal } from "@/components/app/cadastros/CrudModal";
import {
  createClientFull,
  saveMachine,
  savePartner,
  savePoint,
  saveProduct,
  saveVehicle,
  updateClient,
} from "@/lib/data/admin-actions";
import { formatBRL } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/labels";
import type {
  Client,
  Machine,
  Partner,
  Point,
  PointCounter,
  Product,
  Profile,
  Vehicle,
} from "@/lib/data/types";

type Props = {
  points: Point[];
  counters: PointCounter[];
  partners: Partner[];
  products: Product[];
  vehicles: Vehicle[];
  machines: Machine[];
  clients: Client[];
  profiles: Profile[];
};

const TABS = [
  "Pontos",
  "Sócios",
  "Produtos",
  "Clientes",
  "Veículos",
  "Máquinas",
  "Usuários",
] as const;

export function CadastrosTabs(props: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Pontos");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "border-b-2 px-3 py-2.5 text-[15px] font-semibold transition-colors " +
              (tab === t
                ? "border-ink text-ink"
                : "border-transparent text-ink-faint hover:text-ink-soft")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Pontos" && <PointsTab points={props.points} counters={props.counters} />}
      {tab === "Sócios" && <PartnersTab points={props.points} partners={props.partners} />}
      {tab === "Produtos" && <ProductsTab points={props.points} products={props.products} />}
      {tab === "Clientes" && <ClientsTab clients={props.clients} />}
      {tab === "Veículos" && <VehiclesTab vehicles={props.vehicles} />}
      {tab === "Máquinas" && <MachinesTab points={props.points} machines={props.machines} />}
      {tab === "Usuários" && <UsersTab profiles={props.profiles} />}
    </div>
  );
}

function PointsTab({ points, counters }: { points: Point[]; counters: PointCounter[] }) {
  return (
    <div className="flex flex-col gap-3">
      <CrudModal
        title="Novo ponto"
        action={savePoint}
        trigger={
          <Button variant="primary">
            <IconPlus size={18} /> Novo ponto
          </Button>
        }
        fields={[
          { name: "name", label: "Nome", type: "text", required: true },
          { name: "city", label: "Cidade", type: "text" },
          { name: "prefix", label: "Prefixo do recibo (ex.: PA1)", type: "text", required: true },
        ]}
      />
      <Card padding="none">
        <div className="divide-y divide-line">
          {points.map((p) => {
            const counter = counters.find((c) => c.point_id === p.id);
            return (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-ink-faint">
                    {p.city ?? "sem cidade"} · prefixo {counter?.prefix ?? "—"}
                  </div>
                </div>
                <CrudModal
                  title="Editar ponto"
                  action={savePoint}
                  hidden={{ id: p.id }}
                  trigger={<button className="text-sm font-medium text-ink underline">Editar</button>}
                  fields={[
                    { name: "name", label: "Nome", type: "text", required: true, defaultValue: p.name },
                    { name: "city", label: "Cidade", type: "text", defaultValue: p.city ?? "" },
                    {
                      name: "prefix",
                      label: "Prefixo do recibo",
                      type: "text",
                      required: true,
                      defaultValue: counter?.prefix ?? "",
                    },
                  ]}
                />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function PartnersTab({ points, partners }: { points: Point[]; partners: Partner[] }) {
  return (
    <div className="flex flex-col gap-6">
      {points.map((point) => {
        const list = partners.filter((p) => p.point_id === point.id);
        const percentSum = list
          .filter((p) => p.kind === "partner")
          .reduce((s, p) => s + (p.percent ?? 0), 0);
        return (
          <div key={point.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{point.name}</h2>
              <CrudModal
                title="Novo sócio / dono do terreno"
                action={savePartner}
                hidden={{ point_id: point.id }}
                trigger={
                  <Button variant="ghost">
                    <IconPlus size={16} /> Novo
                  </Button>
                }
                fields={[
                  { name: "name", label: "Nome", type: "text", required: true },
                  {
                    name: "kind",
                    label: "Tipo",
                    type: "select",
                    options: [
                      { value: "partner", label: "Sócio" },
                      { value: "landowner", label: "Dono do terreno" },
                    ],
                  },
                  { name: "percent", label: "% do lucro (se sócio)", type: "number" },
                  {
                    name: "landowner_model",
                    label: "Modelo do terreno (se dono)",
                    type: "select",
                    options: [
                      { value: "revenue_pct", label: "% da receita bruta" },
                      { value: "fixed", label: "Valor fixo" },
                    ],
                  },
                  {
                    name: "landowner_value",
                    label: "Valor (centavos; % ex. 10% = 1000, fixo em centavos)",
                    type: "number",
                  },
                ]}
              />
            </div>
            {percentSum !== 0 && percentSum !== 100 && (
              <Badge tone="attention">Σ percentuais = {percentSum}% (esperado 100%)</Badge>
            )}
            <Card padding="none">
              <div className="divide-y divide-line">
                {list.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm text-ink-faint">
                        {p.kind === "partner"
                          ? `Sócio · ${p.percent}%`
                          : `Dono do terreno · ${p.landowner_model === "revenue_pct" ? `${(p.landowner_value ?? 0) / 100}% da receita` : formatBRL(p.landowner_value ?? 0) + " fixo"}`}
                      </div>
                    </div>
                    <CrudModal
                      title="Editar sócio"
                      action={savePartner}
                      hidden={{ id: p.id, point_id: point.id }}
                      trigger={<button className="text-sm font-medium text-ink underline">Editar</button>}
                      fields={[
                        { name: "name", label: "Nome", type: "text", required: true, defaultValue: p.name },
                        {
                          name: "kind",
                          label: "Tipo",
                          type: "select",
                          defaultValue: p.kind,
                          options: [
                            { value: "partner", label: "Sócio" },
                            { value: "landowner", label: "Dono do terreno" },
                          ],
                        },
                        {
                          name: "percent",
                          label: "% do lucro (se sócio)",
                          type: "number",
                          defaultValue: p.percent?.toString() ?? "",
                        },
                        {
                          name: "landowner_model",
                          label: "Modelo do terreno (se dono)",
                          type: "select",
                          defaultValue: p.landowner_model ?? "revenue_pct",
                          options: [
                            { value: "revenue_pct", label: "% da receita bruta" },
                            { value: "fixed", label: "Valor fixo" },
                          ],
                        },
                        {
                          name: "landowner_value",
                          label: "Valor (centavos)",
                          type: "number",
                          defaultValue: p.landowner_value?.toString() ?? "",
                        },
                      ]}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function ProductsTab({ points, products }: { points: Point[]; products: Product[] }) {
  return (
    <div className="flex flex-col gap-6">
      {points.map((point) => (
        <div key={point.id} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{point.name}</h2>
            <CrudModal
              title="Novo produto"
              action={saveProduct}
              hidden={{ point_id: point.id }}
              trigger={
                <Button variant="ghost">
                  <IconPlus size={16} /> Novo
                </Button>
              }
              fields={[
                { name: "name", label: "Nome", type: "text", required: true },
                { name: "price_per_m3", label: "Preço por m³ (centavos)", type: "number", required: true },
              ]}
            />
          </div>
          <Card padding="none">
            <div className="divide-y divide-line">
              {products
                .filter((p) => p.point_id === point.id)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="flex items-center gap-3">
                      <span className="num">{formatBRL(p.price_per_m3)}/m³</span>
                      <CrudModal
                        title="Editar produto"
                        action={saveProduct}
                        hidden={{ id: p.id, point_id: point.id }}
                        trigger={<button className="text-sm font-medium text-ink underline">Editar</button>}
                        fields={[
                          { name: "name", label: "Nome", type: "text", required: true, defaultValue: p.name },
                          {
                            name: "price_per_m3",
                            label: "Preço por m³ (centavos)",
                            type: "number",
                            required: true,
                            defaultValue: p.price_per_m3.toString(),
                          },
                        ]}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}

function ClientsTab({ clients }: { clients: Client[] }) {
  return (
    <div className="flex flex-col gap-3">
      <CrudModal
        title="Novo cliente"
        action={createClientFull}
        trigger={
          <Button variant="primary">
            <IconPlus size={18} /> Novo cliente
          </Button>
        }
        fields={[
          { name: "name", label: "Nome", type: "text", required: true },
          { name: "phone", label: "Telefone", type: "tel" },
          { name: "doc", label: "Documento (opcional)", type: "text" },
          { name: "credit_enabled", label: "Fiado habilitado", type: "checkbox" },
          { name: "credit_limit", label: "Limite de crédito (centavos; 0 = sem limite)", type: "number", defaultValue: "0" },
        ]}
      />
      <Card padding="none">
        <div className="divide-y divide-line">
          {clients.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-ink-faint">{c.phone ?? "sem telefone"}</div>
              </div>
              <div className="flex items-center gap-3">
                {c.credit_enabled ? <Badge tone="ok">Fiado liberado</Badge> : <Badge tone="neutral">Sem fiado</Badge>}
                <CrudModal
                  title="Editar cliente"
                  action={updateClient}
                  hidden={{ id: c.id }}
                  trigger={<button className="text-sm font-medium text-ink underline">Editar</button>}
                  fields={[
                    { name: "name", label: "Nome", type: "text", required: true, defaultValue: c.name },
                    { name: "phone", label: "Telefone", type: "tel", defaultValue: c.phone ?? "" },
                    { name: "doc", label: "Documento", type: "text", defaultValue: c.doc ?? "" },
                    { name: "credit_enabled", label: "Fiado habilitado", type: "checkbox", defaultChecked: c.credit_enabled },
                    {
                      name: "credit_limit",
                      label: "Limite de crédito (centavos)",
                      type: "number",
                      defaultValue: c.credit_limit.toString(),
                    },
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function VehiclesTab({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <div className="flex flex-col gap-3">
      <CrudModal
        title="Novo veículo"
        action={saveVehicle}
        trigger={
          <Button variant="primary">
            <IconPlus size={18} /> Novo veículo
          </Button>
        }
        fields={[
          { name: "label", label: "Descrição (ex.: Truck 8 m³)", type: "text", required: true },
          { name: "plate", label: "Placa (opcional)", type: "text" },
          { name: "capacity_m3", label: "Capacidade (m³)", type: "number", required: true },
        ]}
      />
      <Card padding="none">
        <div className="divide-y divide-line">
          {vehicles.map((v) => (
            <div key={v.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium">{v.label}</div>
                <div className="text-sm text-ink-faint">{v.plate ?? "sem placa"}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="num">{v.capacity_m3} m³</span>
                <CrudModal
                  title="Editar veículo"
                  action={saveVehicle}
                  hidden={{ id: v.id }}
                  trigger={<button className="text-sm font-medium text-ink underline">Editar</button>}
                  fields={[
                    { name: "label", label: "Descrição", type: "text", required: true, defaultValue: v.label },
                    { name: "plate", label: "Placa", type: "text", defaultValue: v.plate ?? "" },
                    {
                      name: "capacity_m3",
                      label: "Capacidade (m³)",
                      type: "number",
                      required: true,
                      defaultValue: v.capacity_m3.toString(),
                    },
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function MachinesTab({ points, machines }: { points: Point[]; machines: Machine[] }) {
  return (
    <div className="flex flex-col gap-6">
      {points.map((point) => (
        <div key={point.id} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{point.name}</h2>
            <CrudModal
              title="Nova máquina"
              action={saveMachine}
              hidden={{ point_id: point.id }}
              trigger={
                <Button variant="ghost">
                  <IconPlus size={16} /> Nova
                </Button>
              }
              fields={[{ name: "name", label: "Nome", type: "text", required: true }]}
            />
          </div>
          <Card padding="none">
            <div className="divide-y divide-line">
              {machines
                .filter((m) => m.point_id === point.id)
                .map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3">
                    <div className="font-medium">{m.name}</div>
                    <CrudModal
                      title="Editar máquina"
                      action={saveMachine}
                      hidden={{ id: m.id, point_id: point.id }}
                      trigger={<button className="text-sm font-medium text-ink underline">Editar</button>}
                      fields={[{ name: "name", label: "Nome", type: "text", required: true, defaultValue: m.name }]}
                    />
                  </div>
                ))}
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}

function UsersTab({ profiles }: { profiles: Profile[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Card variant="tint" className="text-[15px]">
        Usuários são criados via seed nesta demo. O cadastro de login real entra
        junto com a integração do Supabase Auth, na fase final do projeto.
      </Card>
      <Card padding="none">
        <div className="divide-y divide-line">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">{p.name}</span>
              <Badge tone="neutral">{ROLE_LABELS[p.role]}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
