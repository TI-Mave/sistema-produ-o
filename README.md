# Mave · Sistema de Registro de Produção

Sistema web para **apontamento de produção do chão de fábrica** da Mave (Grupo Doca).
Substitui as planilhas de Excel por um registro centralizado, com dados consistentes,
controle de acesso e um painel (dashboard) de acompanhamento em tempo real.

> © 2026 Mave Comércio de Acessórios Ltda · versão v0.1 (protótipo)

---

## 1. Para que serve

Operadores e supervisores registram, por dia/turno, o que cada estação produziu.
O sistema guarda tudo num banco na nuvem (Supabase), calcula totais e progresso de
metas automaticamente, e permite exportar os dados para CSV (compatível com Excel BR).

Hoje o sistema cobre **três estações de produção**:

| Estação | O que registra | Unidade |
|---|---|---|
| **Trançadeiras** | Peso produzido por tipo de caixa, linha, cor e diâmetro | kg |
| **Grampeadeiras** | Produção por operador/turno, com hora extra e desconto de horas | unidades |
| **Extensor Metro** | Produção por cor e diâmetro | unidades |

Além do registro, oferece:

- **Dashboard** com KPIs do dia, progresso de metas e atividade recente.
- **Configurações** — cadastros de referência usados nos formulários (cores, diâmetros,
  tipos de caixa, tamanhos, ganchos, linhas de produção, turnos, operadores e metas).
- **Usuários** (apenas administradores) — aprovação de cadastros novos e gestão de permissões.
- **Exportação CSV** por estação, com filtro por período e por operador.
- **Tema claro/escuro**.

---

## 2. Tecnologias (stack)

O projeto é intencionalmente simples: **site estático + banco gerenciado**, sem build.

- **Front-end:** HTML + CSS + JavaScript puro (vanilla, sem framework nem bundler).
- **Backend / Banco:** [Supabase](https://supabase.com) (PostgreSQL + Auth + Row Level Security).
  O cliente JS do Supabase é carregado via CDN.
- **Hospedagem:** [Vercel](https://vercel.com) (servindo os arquivos estáticos).
- **Fonte:** IBM Plex Sans (Google Fonts).

Não há Node, npm, passo de build ou servidor próprio. O navegador fala direto com o Supabase.

---

## 3. Estrutura de arquivos

```
sistema-produ-o/
├── index.html            # Toda a interface (telas de auth + app com abas)
├── app.js                # Toda a lógica (auth, CRUD, dashboard, exportação) ~2800 linhas
├── styles.css            # Estilos e tema claro/escuro
├── supabase-config.js    # URL e chave pública (anon) do projeto Supabase
├── vercel.json           # Config de deploy e cabeçalhos de cache
└── supabase/             # Scripts SQL (schema + migrações), rodados no SQL Editor
    ├── schema.sql             # Base: cores, config_items, registros_* + RLS + seeds
    ├── user-approval.sql      # Perfis, aprovação por admin, RLS por status
    ├── operadores.sql         # Tabela operadores (+ migração de config_items)
    ├── linhas.sql             # Tabela linhas (+ migração)
    ├── turnos.sql             # Tabela turnos (+ migração)
    ├── metas.sql              # Tabela metas (+ migração)
    ├── delete-user.sql        # RPC delete_user_account (admin remove usuário)
    ├── restrict-email-domain.sql   # Trigger que exige e-mail @mavebr.com
    ├── turnos-almoco.sql      # + colunas almoco_inicio/almoco_fim em turnos
    ├── grampeadeira-almoco.sql# + coluna almoco em registros_grampeadeira
    ├── desconto-hora.sql      # + colunas desconto/desconto_dados na grampeadeira
    ├── extensor-sem-tipocaixa.sql  # remove tipo_caixa do extensor
    ├── tam-texto.sql          # tam (grampeadeira) numeric -> text ("8m")
    ├── tamanho-gancho.sql     # + tipos 'tamanho' e 'gancho' em config_items
    ├── metas-tipo-livre.sql   # metas.tipo passa a aceitar texto livre
    └── mangueiras-cordas-retorno.sql  # Tabelas mangueira/corda/retorno + tipo 'pacote'
```

### Como o front está organizado (`app.js`)

O `app.js` é um único arquivo, dividido em blocos comentados:

- **Data Layer** — funções `dbLoad*`, `TO_DB`/`FROM_DB` (mapeiam `snake_case` do banco ↔ `camelCase` do app).
- **Estado** — objeto global `state` (config, registros, perfil, filtros, edição em andamento).
- **Telas de autenticação** — login, cadastro, aguardando aprovação, esqueci a senha, nova senha.
- **Configurações** — CRUD das listas de referência e das tabelas (operadores, linhas, turnos, metas).
- **Registros** — formulários, modo de edição, tabelas, remoção e exportação CSV.
- **Dashboard** — KPIs, metas e atividade recente.
- **Usuários** — painel de aprovação (só admin).
- **Bootstrap** — `enterApp()` e `bootstrap()` amarram tudo no carregamento.

---

## 4. Modelo de dados (Supabase / PostgreSQL)

Todas as tabelas ficam no schema `public`. IDs são `uuid`. Datas de criação em `timestamptz`.

### Cadastros de referência

| Tabela | Campos principais | Uso |
|---|---|---|
| `cores` | `nome`, `hex` | Cores disponíveis nos formulários |
| `config_items` | `tipo` (`diametro`/`caixa`/`tamanho`/`gancho`), `valor` | Listas simples de referência |
| `linhas` | `nome`, `capacidade_produtiva` | Linhas de produção |
| `turnos` | `nome`, `hora_inicio`, `hora_fim`, `almoco_inicio`, `almoco_fim` | Turnos e intervalo de almoço |
| `operadores` | `nome`, `matricula`, `funcao`, `turno`, `capacidade_produtiva` | Operadores |
| `metas` | `tipo` (texto livre), `operador`, `valor` | Metas diárias de produção |

### Registros de produção

| Tabela | Campos principais |
|---|---|
| `registros_trancadeira` | `data`, `tipo_caixa`, `linha`, `cor`, `diametro`, `peso`, `hora` |
| `registros_grampeadeira` | `data`, `op`, `hi`, `hf`, `operador`, `qtd`, `tam`, `gancho`, `he` + `he_dados` (jsonb), `desconto` + `desconto_dados` (jsonb), `almoco`, `hora` |
| `registros_extensor` | `data`, `cor`, `diametro`, `qtd`, `hora` |

Todos os registros têm `user_id` (quem lançou) e `hora` (hora do apontamento, texto `HH:MM`).
`he_dados` guarda `{ hi, hf, tam, qtd, gancho }` da hora extra; `desconto_dados` guarda `{ motivo, duracao }`.

### Usuários e permissões

| Tabela | Campos | Observação |
|---|---|---|
| `user_profiles` | `id` (= `auth.users.id`), `email`, `role` (`user`/`admin`), `status` (`pending`/`approved`/`rejected`), `approved_at`, `approved_by` | Um perfil por conta |

---

## 5. Autenticação e controle de acesso

Fluxo de acesso (implementado em `app.js` + triggers no banco):

1. **Cadastro** com e-mail e senha. **Só e-mails `@mavebr.com`** são aceitos — validado no
   front e reforçado por um trigger no banco (`enforce_mavebr_domain`).
2. Ao criar a conta, um trigger (`handle_new_user`) cria automaticamente o `user_profiles`:
   - **O primeiro usuário do sistema vira `admin` e já entra `approved`.**
   - Os demais entram como `user` / `pending` (tela "Aguardando aprovação").
3. Um **administrador** aprova/rejeita o cadastro na aba **Usuários**, e pode promover/rebaixar
   admins ou remover contas (via RPC `delete_user_account`, que só admin executa).
4. Só quem está **`approved`** consegue ler/gravar dados.

Também há **recuperação de senha** por e-mail (link do Supabase), com suporte a três formatos de
link (implicit `#type=recovery`, `token_hash` moderno e `code` PKCE).

### Segurança dos dados (RLS)

Row Level Security está ativo em **todas** as tabelas. O modelo é de **dados compartilhados do chão
de fábrica**: qualquer usuário **aprovado** pode ler e escrever **todos** os registros e cadastros
(policies `is_approved()`). A tabela `user_profiles` é mais restrita — cada um vê o próprio perfil,
e só admins veem/editam todos (`is_admin()`).

> A chave `anonKey` em `supabase-config.js` é **pública por design** — pode ficar no front-end
> porque é o RLS que protege os dados. Não confundir com a `service_role` key (essa nunca vai pro front).

---

## 6. Regras de negócio que valem conhecer

Detalhes que não são óbvios só olhando as telas:

- **Lançamento em lote (grampeadeira e trançadeira):** você adiciona vários itens/pesos de uma vez;
  cada item vira uma linha no banco. Hora extra e desconto são gravados **só no primeiro** item do
  lote, para não duplicar no dashboard.
- **Campos "grudentos" (sticky):** ao salvar na grampeadeira/trançadeira, o formulário limpa os itens
  mas **mantém** operador, linha, data, etc., e já sugere a próxima "Hora Início" = "Hora Fim"
  anterior — para agilizar apontamentos em sequência.
- **Validação de turno:** se o operador tem turno definido, o horário do registro precisa cair
  dentro do turno; fora dele, o sistema pede para marcar "Houve hora extra". Turnos que cruzam a
  meia-noite são tratados corretamente.
- **Almoço automático:** o campo Almoço é preenchido com a duração do intervalo do turno do operador.
- **Metas no dashboard:** metas cujo tipo contém "Geral" somam toda a produção do dia
  (grampeadeira + extensor); metas com "Operador" somam a produção daquele operador (incluindo HE);
  outros tipos aparecem apenas como alvo cadastrado. A barra fica verde a ≥100%, amarela abaixo de 60%.
- **Exportação CSV:** usa `;` como separador e vírgula decimal, com BOM UTF-8 — abre certinho no
  Excel em português.

---

## 7. Como rodar / configurar

### Pré-requisitos
- Um projeto no [Supabase](https://supabase.com).
- Um navegador (para uso) e, para editar, qualquer servidor estático simples.

### Passo a passo (primeira configuração do banco)

No **SQL Editor** do Supabase, rode os scripts da pasta `supabase/` **nesta ordem**:

1. `schema.sql` (base + seeds)
2. `user-approval.sql` (perfis e aprovação)
3. `operadores.sql`, `linhas.sql`, `turnos.sql`, `metas.sql` (tabelas estruturadas)
4. As migrações incrementais: `turnos-almoco.sql`, `grampeadeira-almoco.sql`, `desconto-hora.sql`,
   `extensor-sem-tipocaixa.sql`, `tam-texto.sql`, `tamanho-gancho.sql`, `metas-tipo-livre.sql`,
   `mangueiras-cordas-retorno.sql`
5. `restrict-email-domain.sql` e `delete-user.sql`

> Os scripts são **idempotentes** (usam `if not exists` / `if exists`) — dá pra rodar de novo sem quebrar.

### Configurar as credenciais

Em `supabase-config.js`, coloque a **URL** e a **anon public key** do projeto
(Supabase → Settings → API):

```js
window.SUPABASE_CONFIG = {
  url: 'https://SEU-PROJETO.supabase.co',
  anonKey: 'sua-anon-public-key',
};
```

### Rodar localmente

Como é site estático, basta servir a pasta. Exemplos:

```bash
# Python
python -m http.server 5500

# ou Node
npx serve .
```

Abra `http://localhost:5500`. **O primeiro cadastro `@mavebr.com` vira admin automaticamente.**

### Deploy (Vercel)

O `vercel.json` já está pronto: sem build, servindo a raiz como estático, com cabeçalhos de cache
para forçar o navegador a sempre pegar a versão nova do `index.html` e do `supabase-config.js`.
Basta conectar o repositório à Vercel e publicar.

---

## 8. Limitações e pontos de atenção

Coisas boas de saber (é um protótipo v0.1):

- **Dados compartilhados sem trilha por operação:** todo aprovado enxerga e edita tudo. Não há
  histórico de alterações/auditoria de quem mudou o quê.
- **Sem testes automatizados** e sem etapa de build/lint.
- **Cache "quebrado" de propósito:** os arquivos são referenciados com `?v=37` no `index.html`.
  Ao publicar mudanças em `app.js`/`styles.css`, **incremente esse número** para os usuários
  pegarem a versão nova.
- **Cadastro de operador não define turno/capacidade** pelo formulário (ficam nulos). Como as regras
  de validação de turno e o preenchimento automático de almoço dependem do turno do operador, esses
  recursos só entram em ação quando o `turno` do operador estiver preenchido (hoje, via banco).
- Datas usam o **fuso do navegador** (`toISOString`), o que na prática funciona para o dia local,
  mas vale ter em mente perto da meia-noite.

---

## 9. Glossário rápido

- **Trançadeira / Grampeadeira / Extensor Metro** — as três estações/máquinas de produção.
- **HE** — Hora Extra.
- **Gancho / Tamanho / Tipo de Caixa** — atributos do produto registrados no apontamento.
- **Meta** — alvo diário de produção, com progresso mostrado no dashboard.
- **RLS (Row Level Security)** — regras do PostgreSQL que decidem quem pode ler/gravar cada linha.
```
