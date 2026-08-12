# CLAUDE.md — MineraPonto

Sistema de gestão para pontos de extração de areia/saibro (portos de areia). Demo funcional que evolui para produto real. **Leia SPEC-MVP.md antes de qualquer implementação — ele é a fonte de verdade do escopo, modelo de dados e regras de negócio.**

## Stack (fixada — não substituir)

- Next.js 14+ (App Router) + TypeScript estrito
- Tailwind CSS (sem lib de componentes; componentes próprios seguindo os tokens da SPEC seção 5)
- Supabase: Postgres + Auth (email/senha) + Storage (fotos)
- Deploy: Vercel
- Datas: `date-fns` com locale `pt-BR`. Números/moeda: `Intl.NumberFormat('pt-BR')`

## Comandos

```bash
npm run dev          # desenvolvimento
npm run build        # build de produção (rodar antes de considerar fase concluída)
npx supabase db push # aplicar migrations (ou aplicar .sql via dashboard se CLI indisponível)
npm run seed         # popular dados de demonstração (script em /scripts/seed.ts)
```

## Convenções

- UI 100% em pt-BR, linguagem do setor ("carrada", "fiado", "acerto", "ponto"). Código, tabelas e variáveis em inglês.
- Server Components por padrão; Client Components só onde há interação.
- Mutations via Server Actions (não criar API routes desnecessárias).
- Todo valor monetário em **centavos (integer)** no banco; formatar só na borda da UI.
- Fonte única (Inter); números de dinheiro/quantidade sempre com classe utilitária `.num` (`tabular-nums` + peso 600–700 — ver SPEC seção 5). Sistema é **um tema só**, claro (fundo areia); não criar variante escura.
- Antes de construir qualquer tela nova, abrir `design-reference.html` (raiz do repo) e seguir os mesmos espaçamentos, raios e componentes — não improvisar um estilo novo.
- Rotas `/campo/*` são mobile-first (viewport ~380px, alvos de toque ≥ 56px, fonte ≥ 16px). Rotas `/app/*` são desktop-first mas responsivas.
- Nunca deletar venda/gasto/recebimento: cancelamento é `status='canceled'` + `cancel_reason` obrigatório.
- Timestamps: `timestamptz` sempre; `created_by` em toda tabela transacional.
- Acessibilidade mínima: foco visível, labels em inputs, contraste AA.

## O que NUNCA fazer neste projeto

- Nada de módulo fiscal: sem NF-e, sem cálculo de imposto, sem menção a emissão de nota. O recibo é documento de controle interno e leva o rodapé fixo definido na SPEC.
- Nada de funcionalidade que ajude a decidir "quais vendas emitir nota" — fora de escopo por decisão de produto e ética.
- Sem service worker / offline nesta fase (fica para v2 — ver SPEC seção 3).
- Sem libs pesadas de PDF: relatórios imprimíveis são páginas HTML de impressão (`/print/*`).
- Não inventar campos, telas ou regras fora da SPEC. Dúvida de negócio → perguntar, não assumir.

## Fluxo de trabalho

Implementar na ordem das fases da SPEC (seção 11). Ao concluir cada fase: rodar `npm run build`, verificar os critérios "pronto quando" da fase, e mostrar o resultado antes de avançar.
