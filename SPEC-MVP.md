# SPEC-MVP.md — MineraPonto

Especificação executável do MVP. Complementa `CLAUDE.md` (convenções). Documentos de contexto (não necessários para implementar): PRD `01-visao-e-escopo.md`, pesquisa `02-pesquisa-de-mercado.md`.

---

## 1. Contexto em 5 linhas

Portos de areia e saibreiras pequenos controlam tudo em caderno: venda na boca da cava (muito fiado, inclusive **pagamento misto** — parte à vista, parte anotada), gastos com diesel/peças, e um **acerto mensal entre sócios e dono do terreno que consome um dia inteiro de soma manual**. O MineraPonto registra a venda em segundos no celular do operador e entrega ao dono um painel onde **tudo que pode ser automático é automático**: extrato de cliente, contas a receber, e o acerto fechado em 1 clique. Este MVP é uma **demo funcional online** (Vercel + Supabase) para validar com os donos reais — e a base de dados já nasce pronta para evoluir a produto (multi-tenant, nada hard-coded).

## 2. Decisões fixadas

| Decisão | Valor |
|---|---|
| Natureza | Demo funcional que evolui para produto real |
| Público da demo | Donos de porto de areia (perfil "à moda antiga", baixa paciência com tela) |
| Hospedagem | Vercel + Supabase (link acessível de qualquer celular) |
| Escopo | Painel admin (foco: financeiro/acerto) **+** fluxo de venda em campo simplificado |
| Fora | Fiscal (NF-e/impostos), offline, impressão térmica, checklist de manutenção, multi-idioma |
| Princípio de UX | Máximo automático; toda ação frequente em 1 clique/toque; mínimo de digitação |

## 3. Fora de escopo explícito (não implementar nem "deixar pronto")

1. **Fiscal**: nenhuma emissão de nota, cálculo de imposto ou sugestão fiscal. O recibo é gerencial e leva rodapé fixo: *"Documento de controle interno — não substitui documento fiscal."*
2. **Offline/PWA**: sem service worker, sem fila local. (v2; a arquitetura de dados já é compatível — eventos nunca são deletados.)
3. **Checklist de manutenção / OS**: fora deste MVP. A tabela `machines` existe apenas para vincular gastos.
4. **Conciliação PIX automática, balança, NF-e, app do comprador**: v2+.
5. **Rateio de custos entre pontos**: cada ponto é uma ilha financeira neste MVP.

## 4. Premissas de negócio — defaults assumidos, A VALIDAR na demo

Estas regras foram assumidas sem confirmação do cliente real. Implementar os defaults abaixo; onde indicado, deixar configurável. Na demo, a tela de configuração vira pergunta ao vivo.

| # | Premissa | Default implementado | Configurável? |
|---|---|---|---|
| P1 | Regime do acerto | **Caixa**: divide-se o que ENTROU (à vista + fiado recebido) menos o que SAIU no período. Fiado não recebido aparece como "A receber" à parte, nunca some. | Não (v2 se pedirem competência) |
| P2 | Dono do terreno | Recebe **% sobre a receita bruta de vendas** do período (modelo arrendamento) | **Sim**: `revenue_pct` OU `fixed` (valor fixo por fechamento) — campo no cadastro do sócio tipo `landowner` |
| P3 | Retiradas de sócio | Existem e são frequentes ("vale"). Lançamento de 1 toque; descontadas individualmente no acerto | Não (sempre ativas) |
| P4 | Categorias de gasto | Fixas: `diesel`, `part_service` (peça/serviço), `labor` (mão de obra), `freight` (frete), `other` | Não neste MVP |
| P5 | Período do acerto | **Não é calendário fixo**: botão "Fechar acerto" pega tudo desde o último fechamento até agora | Não |
| P6 | Percentuais dos sócios | Somam 100% por ponto (validação com aviso, não bloqueio) | Editáveis no cadastro |

## 5. Identidade visual (tokens — usar exatamente)

Direção: **básico e legível** — fundo amarelo-areia claro, cartões brancos, texto preto. Uma única cor de ação (areia); verde/vermelho apenas para status. **Sem sombras** (o contraste cartão-branco sobre fundo-areia já separa) e **sem tema escuro** — o sistema inteiro é claro. Cartão preto (`ink`) é reservado para UM destaque por tela (ex.: o CTA "Fechar acerto" e o total do dia no campo). O arquivo **`design-reference.html`** na raiz do repo é a amostra oficial: ao construir qualquer tela, copiar os padrões de lá (espaçamento, raios, badges, listas).

```
bg:         #F8F1E2   (fundo areia claro — todas as telas)
card:       #FFFFFF   (cartões)
ink:        #191510   (texto principal; cartão de destaque)
ink-soft:   #6E6553   (texto secundário)
ink-faint:  #998D75   (labels/captions)
line:       #ECE2CC   (bordas 1px)
sand:       #EBBF52   (ação primária — texto preto por cima)
sand-deep:  #D4A637   (hover/pressed; barra "vendido" no gráfico)
sand-tint:  #F8ECD0   (fundos de destaque suave; badge de atenção)
ok:         #2F7D4F   / ok-tint: #E4F1E8      (pago, positivo)
danger:     #C2452B   / danger-tint: #F9E6E0  (vencido, negativo)
```

Tipografia: **Inter** em tudo (via `next/font`), pesos 400–800. Todo número de dinheiro/quantidade com `font-variant-numeric: tabular-nums` + peso 600–700 (classe utilitária `.num`). Raios: 16px em cartões, 12px em controles, pill em chips e badges. Bordas 1px `line`. Ícones: SVG inline monocromático, traço 1.7 — nunca emoji. Alvos de toque ≥ 56px no `/campo`.

## 6. Modelo de dados (migrations SQL — Supabase/Postgres)

Multi-tenant desde já (`company_id` em tudo; a demo usa 1 empresa). Dinheiro em **centavos (bigint)**. Todas as tabelas: `id uuid default gen_random_uuid() primary key`, `created_at timestamptz default now()`.

```sql
companies(name text not null)

-- perfil espelha auth.users
profiles(
  id uuid pk references auth.users,
  company_id uuid not null references companies,
  name text not null,
  role text not null check (role in ('owner','office','field'))
)

points(company_id, name text not null, city text)

-- sócios e dono do terreno, por ponto
partners(
  company_id, point_id references points,
  name text not null,
  kind text not null check (kind in ('partner','landowner')),
  percent numeric(5,2),            -- para kind=partner (participação no lucro)
  landowner_model text check (landowner_model in ('revenue_pct','fixed')),
  landowner_value bigint           -- pct*100 (ex.: 10.00% = 1000) ou centavos fixos
)

machines(company_id, point_id, name text not null)

clients(
  company_id, name text not null, phone text, doc text,
  credit_enabled boolean not null default false,
  credit_limit bigint not null default 0    -- centavos; 0 = sem limite definido
)

vehicles(company_id, client_id nullable, plate text, label text not null, capacity_m3 numeric(6,2) not null)

products(company_id, point_id, name text not null, price_per_m3 bigint not null)  -- centavos

sales(
  company_id, point_id, product_id, client_id nullable,  -- null = venda avulsa
  qty_m3 numeric(8,2) not null,
  unit_price bigint not null,          -- snapshot do preço no momento
  discount_pct numeric(5,2) not null default 0,
  total bigint not null,               -- calculado e gravado
  receipt_no text not null,            -- ex.: 'PA1-000124' (sequência por ponto — ver §7.4)
  status text not null default 'active' check (status in ('active','canceled')),
  cancel_reason text, canceled_at timestamptz, canceled_by uuid,
  photo_url text, gps_lat numeric(9,6), gps_lng numeric(9,6),
  created_by uuid not null
)

-- pagamento misto: 1 venda → N linhas (ex.: cash 20000 + credit 80000)
sale_payments(
  sale_id references sales on delete cascade,
  method text not null check (method in ('cash','pix','credit')),
  amount bigint not null check (amount > 0)
)

-- baixa de fiado; point_id obrigatório para o caixa do acerto ser por ponto
receipts(
  company_id, point_id, client_id not null,
  amount bigint not null, method text not null check (method in ('cash','pix','transfer')),
  received_at timestamptz not null default now(), note text, created_by uuid not null,
  status text not null default 'active' check (status in ('active','canceled')), cancel_reason text
)

expenses(
  company_id, point_id, machine_id nullable,
  category text not null check (category in ('diesel','part_service','labor','freight','other')),
  amount bigint not null, liters numeric(8,2), note text, photo_url text,
  spent_at timestamptz not null default now(), created_by uuid not null,
  status text not null default 'active' check (status in ('active','canceled')), cancel_reason text
)

withdrawals(  -- retirada/vale de sócio
  company_id, point_id, partner_id not null references partners,
  amount bigint not null, note text,
  withdrawn_at timestamptz not null default now(), created_by uuid not null,
  status text not null default 'active' check (status in ('active','canceled')), cancel_reason text
)

production_logs(
  company_id, point_id, machine_id nullable,
  log_date date not null, trips int, m3 numeric(8,2) not null,  -- m3 informado ou trips*fator
  created_by uuid not null
)

settlements(  -- acerto fechado = snapshot imutável
  company_id, point_id,
  period_start timestamptz not null, period_end timestamptz not null,
  closed_at timestamptz not null default now(), closed_by uuid not null,
  cash_in bigint not null, gross_sales bigint not null,
  expenses_total bigint not null, landowner_payout bigint not null,
  profit_pool bigint not null,
  snapshot jsonb not null            -- todos os números e linhas, para auditoria
)

settlement_lines(
  settlement_id references settlements on delete cascade,
  partner_id, partner_name text not null, kind text not null,
  base_amount bigint not null,        -- fatia do lucro (ou payout do landowner)
  withdrawals_total bigint not null default 0,
  final_amount bigint not null        -- base - retiradas
)

-- contador de recibo por ponto
point_counters(point_id pk, prefix text not null, next_no int not null default 1)
```

**Views/consultas derivadas** (implementar como SQL views ou queries): 
- `client_balance(client_id)` = Σ `sale_payments.credit` de vendas `active` − Σ `receipts.active` do cliente.
- Caixa do ponto no período = Σ (`cash`+`pix` de vendas `active` no período) + Σ (`receipts.active` do ponto no período).

**RLS**: habilitar em todas as tabelas; policy única por tabela: `company_id = (select company_id from profiles where id = auth.uid())`. Storage: bucket `photos` privado; URLs assinadas.

## 7. Regras de negócio críticas

### 7.1 Venda com pagamento misto (o caso normal, não a exceção)
Fluxo de pagamento no campo: mostrar o total e perguntar **"Quanto está pagando agora?"** com o total pré-preenchido.
- Pagou tudo → 1 linha `cash` ou `pix`.
- Pagou parte (ex.: R$ 200 de R$ 1.000) → linha `cash/pix` de 200 **e automaticamente** linha `credit` de 800. Zero cliques extras: a diferença vira fiado sozinha.
- `credit` só permitido se `client.credit_enabled`; se o saldo devedor + novo fiado estourar `credit_limit` (>0), mostrar aviso âmbar mas **não bloquear** (o operador decide; fica registrado).
- Venda avulsa (sem cliente) não pode ter `credit`.

### 7.2 Acerto (o recurso central — 1 clique)
Ao clicar **"Fechar acerto"** no ponto:
1. `period_start` = `period_end` do último settlement do ponto (ou primeira movimentação); `period_end` = agora.
2. `cash_in` = à vista do período + fiado recebido no período (por ponto).
3. `gross_sales` = Σ `total` de vendas `active` do período (base do landowner `revenue_pct` e exibição).
4. `landowner_payout` = `gross_sales × pct` ou valor fixo, conforme cadastro. Sem landowner cadastrado → 0.
5. `expenses_total` = Σ gastos `active` do período.
6. `profit_pool` = `cash_in − expenses_total − landowner_payout` (pode ser negativo; exibir em vermelho, dividir normalmente).
7. Para cada sócio `partner`: `base = profit_pool × percent/100`; `final = base − retiradas dele no período`.
8. Mostrar **prévia** (tela de conferência com todos os números e um bloco "A receber pendente" = fiado do período ainda não pago, para ninguém achar que sumiu dinheiro). Botão "Confirmar e fechar" grava settlement + lines + snapshot JSON. **Fechado = imutável.**
9. Após fechar: botão "Imprimir/PDF" abre `/print/acerto/[id]`.

### 7.3 Cancelamentos
Venda, gasto, recebimento e retirada nunca são deletados: `status='canceled'` + motivo obrigatório, só por `owner`/`office`, só se **nenhum settlement fechado cobre o período do lançamento** (senão, bloquear com mensagem "período já fechado — lance um ajuste"). Ajuste = lançamento novo no período aberto.

### 7.4 Número de recibo
Sequencial por ponto via `point_counters` com `select ... for update` na transação da venda (ex.: prefixo `PA1` → `PA1-000124`).

### 7.5 Detector de desvio
No dashboard, por ponto/mês: `m3 produzidos` (production_logs) vs `m3 vendidos` (sales active). Divergência > 5% → destaque âmbar. É informativo, não bloqueia nada.

## 8. Telas

### Campo — `/campo` (mobile-first)
| Rota | Conteúdo |
|---|---|
| `/campo` | Header: nome do ponto + "hoje: R$ X · Y m³". Dois botões grandes: **Venda** (destaque âmbar) e **Produção / Gasto** |
| `/campo/venda` | Wizard 5 passos, 1 decisão por tela: **1** Cliente (busca + cards; "Venda avulsa"; "+ Cliente novo" com só nome+telefone) → **2** Produto (grade de cards com preço/m³) → **3** Quantidade (chips de veículos cadastrados preenchem m³; stepper manual 0,5) → **4** Pagamento ("Quanto está pagando agora?" — regra §7.1; PIX mostra chave copia-e-cola) → **5** Foto de retirada (`<input type="file" accept="image/*" capture="environment">`, upload ao Storage; GPS via `navigator.geolocation` best-effort; aviso fixo de consentimento) → **Recibo** (resumo + ações: WhatsApp via `wa.me` com link do recibo, "Mostrar QR" do link, Concluir) |
| `/campo/producao` | Duas abas: **Produção** (máquina em chips → nº de viagens stepper OU m³ direto → salvar) e **Gasto** (categoria em chips → valor → litros se diesel → máquina opcional → foto opcional → salvar). 1 toque para salvar |
| `/r/[saleId]` | **Página pública do recibo** (sem login): nº, data/hora, ponto, cliente, produto, qtd, valores, forma(s) de pagamento, miniatura da foto de retirada + GPS/hora, chave PIX, rodapé fiscal fixo. É o link que vai no WhatsApp |

### Admin — `/app` (desktop-first)
| Rota | Conteúdo |
|---|---|
| `/app` | Dashboard: KPIs (vendas hoje/mês R$ e m³ por ponto; a receber total + vencidos; gasto do mês; retiradas do mês), barra Produção×Venda com destaque de desvio (§7.5), lista "Atenção hoje" |
| `/app/vendas` | Tabela com filtros (ponto, período, cliente, pagamento); linha abre painel com foto/GPS; cancelar com motivo (§7.3) |
| `/app/clientes` | Lista com saldo devedor e status de crédito. Detalhe `/app/clientes/[id]`: extrato corrido (vendas, pagamentos, saldo acumulado) + 3 ações de 1 clique: **Lançar recebimento** (modal: valor, forma, ponto), **Bloquear/liberar a prazo** (toggle), **Extrato para imprimir** (`/print/extrato/[clientId]?period=`) |
| `/app/financeiro` | O coração. Por ponto: período aberto (desde o último acerto) com **Entradas** (à vista + fiado recebido), **Saídas** (gastos por categoria), **Retiradas** (por sócio), **A receber pendente**, e projeção do `profit_pool` ao vivo. Botão grande **"Fechar acerto"** → prévia → confirmar (§7.2). Abaixo: histórico de acertos fechados com link de impressão |
| `/app/gastos` | Lançamento rápido (mesmo form do campo, em desktop) + lista/filtros |
| `/app/retiradas` | Lançar retirada (sócio, valor, obs — 3 campos) + lista |
| `/app/cadastros` | CRUDs enxutos: Pontos · Sócios & dono do terreno (percentuais + modelo do landowner; aviso se Σ≠100%) · Produtos & preços por ponto · Clientes · Veículos/caçambas · Máquinas · Usuários |
| `/print/acerto/[id]`, `/print/extrato/[clientId]` | Páginas de impressão (fundo branco, tipografia limpa, `@media print`); botão "Imprimir/Salvar PDF" chama `window.print()` |

Login único (`/login`, Supabase email+senha); `role` decide o redirect (`field`→`/campo`, demais→`/app`). Sem tela de cadastro público (usuários criados via seed).

## 9. Automações "1 clique" (checklist do princípio de UX)

1. Venda a prazo/mista → extrato do cliente e contas a receber atualizam sozinhos.
2. Diferença entre "pagando agora" e total → vira fiado automaticamente (§7.1).
3. Chips de veículo → m³ e total calculados sozinhos.
4. GPS + data/hora → gravados sozinhos na foto de retirada.
5. Gasto/retirada lançados → já entram no período aberto do acerto.
6. "Fechar acerto" → todo o cálculo + divisão + desconto de retiradas em 1 clique (§7.2).
7. Extrato do cliente → 1 clique para versão imprimível; recibo → 1 clique para WhatsApp.
8. Recebimento de fiado → modal de 3 campos, saldo abate sozinho.

## 10. Seed de demonstração (obrigatório — painel vazio não vende)

Script `scripts/seed.ts` idempotente criando:
- 1 empresa; usuários: `dono@demo.mineraponto.app` (owner), `escritorio@…` (office), `campo@…` (field) — senha única de demo documentada no README.
- 2 pontos: **Areal 1 — Rio Betim** (prefixo PA1) e **Saibreira — Esmeraldas** (SB1).
- Areal 1: sócios João (50%) e Antônio (30%) + Carlos (20%); dono do terreno Sr. Geraldo (`revenue_pct` 10%). Saibreira: João (60%), Antônio (40%), landowner `fixed` R$ 1.500.
- Produtos com preços/m³ realistas (areia lavada 120, areia fina 110, saibro 70, cascalho 90 — em reais).
- 8 clientes (3 com fiado habilitado e saldo aberto), 10 veículos (Toco 4m³ … Carreta 25m³), 4 máquinas.
- **~60 dias de movimento**: 6–14 vendas/dia útil por ponto com mix realista (≈45% dinheiro, 25% PIX, 30% com componente fiado, várias mistas), gastos (diesel 2–3×/semana com litros, peças esporádicas, mão de obra), retiradas de sócios (2–5/mês cada), production_logs com divergência proposital: Areal 1 vendendo ~7% menos que produz (para o detector acender) e Saibreira saudável.
- **1 acerto já fechado** por ponto (mês anterior) para o histórico existir, e o período atual aberto com números vivos.

## 11. Fases de implementação (executar em ordem; validar "pronto quando" antes de seguir)

**F0 — Fundação.** Next+TS+Tailwind com tokens §5, fonte Inter, layout base (único tema, claro), componentes primitivos (Button, Card, Input, Chip, Stepper, Badge, Modal, Table) espelhando `design-reference.html`. *Pronto quando:* `npm run build` passa e uma página de amostra reproduz fielmente a referência visual.

**F1 — Dados e auth.** Migrations §6 completas + RLS + bucket; auth email/senha; middleware de proteção e redirect por role; script de seed §10 rodando. *Pronto quando:* login funciona com os 3 usuários e o Supabase mostra as tabelas populadas.

**F2 — Venda de campo.** `/campo` completo (wizard §8, regra §7.1, contador §7.4, upload de foto, GPS) + recibo público `/r/[id]` + WhatsApp/QR. *Pronto quando:* uma venda mista feita no celular aparece no banco com 2 sale_payments, foto e nº sequencial, e o link do recibo abre sem login.

**F3 — Clientes e recebimentos.** `/app/clientes` com extrato, recebimento, toggle de crédito, `/print/extrato`. `/app/vendas` com cancelamento §7.3. *Pronto quando:* lançar um recebimento reduz o saldo e aparece no extrato imprimível.

**F4 — Financeiro e acerto.** `/app/gastos`, `/app/retiradas`, `/app/financeiro` com período aberto ao vivo, prévia e fechamento §7.2, histórico, `/print/acerto`. *Pronto quando:* fechar o acerto do seed gera settlement + lines coerentes (conferir à mão com os números do seed) e a página de impressão sai limpa.

**F5 — Dashboard, produção e polimento.** `/app` com KPIs e detector §7.5; `/campo/producao`; `/app/cadastros`; revisão de responsividade e estados vazios/erro em pt-BR. *Pronto quando:* o roteiro da §12 roda de ponta a ponta sem improviso.

**F6 — Deploy.** Vercel + envs; seed aplicado no projeto Supabase de produção; smoke test no celular. *Pronto quando:* o link público roda o roteiro §12 num celular real.

## 12. Roteiro da demo (5 minutos — também é o critério de aceite final)

1. Abrir `/campo` no celular → fazer uma venda **mista** (R$ 1.000: R$ 200 PIX + R$ 800 fiado) com foto → recibo chega no WhatsApp do "cliente".
2. Abrir `/app` no notebook → a venda já está no dashboard; o cliente já aparece devendo R$ 800 a mais, sem ninguém digitar nada.
3. Entrar no cliente → extrato pronto → lançar um recebimento de R$ 500 em 3 campos → saldo abate na hora.
4. Ir em `/app/financeiro` → mostrar o período aberto com entradas/saídas/retiradas ao vivo → **"Fechar acerto"** → prévia com a divisão por sócio já descontando as retiradas de cada um → confirmar → abrir a versão de impressão. Frase da demo: *"isso aqui é o dia inteiro de vocês somando notinha — em um clique"*.
5. Voltar ao dashboard → apontar o alerta âmbar de Produção×Venda do Areal 1 (−7%) → *"e isso avisa quando o que saiu da cava não bate com o que entrou no caixa"*.

## 13. Notas para evolução (não implementar agora; não atrapalhar)

Offline/PWA na rota `/campo`; NF-e via emissor parceiro; módulo CFEM/RAL; conciliação PIX; checklist/OS de manutenção; competência além de caixa no acerto; rateio entre pontos. O schema atual suporta todos sem migração destrutiva.
