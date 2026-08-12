# MineraPonto

Demo funcional de gestão para portos de areia — administração financeira
(acerto entre sócios/dono do terreno) e venda em campo. Ver `SPEC-MVP.md`
(escopo/regras) e `CLAUDE.md` (convenções).

## Rodando localmente

```bash
npm install
npm run dev
```

Copie `.env.local` com as credenciais do projeto Supabase (URL, anon key,
service role key — ver `Project Settings → API` no dashboard).

## Banco de dados

As migrations em `supabase/migrations/` criam o schema, RLS, o bucket de
fotos e as funções (`create_sale`, `close_settlement`). Aplique-as pelo SQL
Editor do Supabase (na ordem dos nomes dos arquivos) ou via `npx supabase db push`.

## Seed de demonstração

```bash
npm run seed
```

Idempotente: se já existir um usuário `dono@demo.mineraponto.app`, o script
não faz nada. Cria ~60 dias de movimento em 2 pontos, com 1 acerto já
fechado por ponto.

**Usuários de demonstração** (senha única para todos):

| E-mail | Papel |
|---|---|
| `dono@demo.mineraponto.app` | owner |
| `escritorio@demo.mineraponto.app` | office |
| `campo@demo.mineraponto.app` | field |

Senha: `mineraponto-demo`

`role` decide o redirect após login: `field` → `/campo`, demais → `/app`.
