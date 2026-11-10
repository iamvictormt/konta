# Kontá

MVP da plataforma de gestão de Lojas e Comércio, construída com Next.js App Router e TypeScript. Serviços e Formação ficam para fases posteriores.

## Requisitos

- Node.js 22.12 ou superior.
- Docker Desktop com Docker Compose para executar PostgreSQL localmente.

## Configuração local

```powershell
npm install
Copy-Item .env.example .env
```

Gere uma chave local para autenticação e coloque-a em `BETTER_AUTH_SECRET` no `.env`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Inicialize o PostgreSQL, aplique as migrações e crie o primeiro administrador. O comando pede o e-mail e a palavra-passe sem os gravar no histórico do terminal; o nome inicial é `Admin`. Escolha uma palavra-passe única com pelo menos 12 caracteres.

```powershell
npm run db:setup
```

Para personalizar o nome, execute `npm run db:migrate` e depois `npm run db:create-admin -- --name "Nome do Administrador"`.

Depois, inicie a aplicação:

```powershell
npm run dev
```

Abra http://localhost:3000 e entre com a conta de administrador criada. O administrador pode criar acessos de colaboradores em **Definições**.

## Autenticação, dados e sincronização

- Better Auth gere as sessões e as palavras-passe. A criação pública de contas está desativada; o primeiro administrador é criado pela CLI e os colaboradores são criados por um administrador autenticado.
- O servidor e a autenticação Better Auth usam o mesmo PostgreSQL, executado pelo Docker Compose. A ligação local é configurada por `DATABASE_URL`; o volume nomeado `konta-postgres-data` mantém os dados quando o container pára.
- O modelo inicial contém uma loja por instalação, com a moeda apresentada como Db. O país e os requisitos fiscais ainda não foram definidos.
- O primeiro acesso exige internet. Depois de uma autenticação válida, o catálogo e os movimentos ficam guardados localmente no IndexedDB. Vendas e despesas são guardadas antes de aparecerem como concluídas.
- Sem ligação, o catálogo fica disponível para consulta e vendas, troco e despesas podem ser registados localmente. Criar produtos exige ligação.
- A fila envia lotes automaticamente enquanto a aplicação está aberta e a ligação regressa. O servidor valida os dados, grava cada operação em transação e usa um identificador único para aceitar novas tentativas sem duplicar vendas ou despesas.
- Vendas simultâneas offline podem deixar o stock negativo no servidor. A venda é preservada, a divergência fica visível e o administrador pode corrigir o saldo após uma contagem física; o ajuste fica registado no histórico de stock.
- A sessão de acesso local expira após sete dias sem validação online. Os dados de Comércio ficam no perfil local do navegador; limpar os dados do navegador remove a cópia desse dispositivo.
- O colaborador pode consultar produtos e registar vendas/despesas. Alteração de produtos, relatórios de custos e gestão de acessos ficam reservados ao administrador.
- A aplicação não encripta o IndexedDB. Proteja a conta do sistema e o dispositivo que guarda dados offline; em dispositivos partilhados, termine a sessão quando possível.

## Entrega e operação

O PostgreSQL do Docker é apenas para desenvolvimento local. Para produção, use um PostgreSQL gerido ou um servidor persistente, defina `DATABASE_URL`, domínio HTTPS, `BETTER_AUTH_URL`, uma `BETTER_AUTH_SECRET` aleatória e um plano de cópia de segurança/restauro. Não use as credenciais de desenvolvimento do `.env.example` fora da máquina local.

`npm run db:stop` pára o container sem apagar os dados. O volume só é removido com `docker compose down --volumes`; esse comando apaga o banco local.

Se houver corte de energia, os dados confirmados pelo navegador permanecem no dispositivo, mas a loja precisa de energia para continuar a trabalhar; use uma UPS se for necessário manter o serviço ligado.

O plano de implementação e os critérios de aceitação estão em [`tasks/plan.md`](tasks/plan.md) e [`tasks/todo.md`](tasks/todo.md).
