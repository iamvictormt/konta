# Kontá

MVP da plataforma de gestão de Lojas e Comércio, construída com Next.js App Router e TypeScript. Serviços e Formação ficam para fases posteriores.

## Requisitos

- Node.js 22.12 ou superior.
- Um banco PostgreSQL no Neon.

## Configuração local

```powershell
npm install
Copy-Item .env.example .env
```

Copie a ligação do Neon para `DATABASE_URL` no `.env`. Gere uma chave para autenticação e coloque-a em `BETTER_AUTH_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Aplique as migrações ao banco configurado em `DATABASE_URL`.

```powershell
npm run db:migrate
```

Para criar o proprietário de outra organização já existente, indique o respectivo ID: `npm run db:create-admin -- --organization-id <id> --name "Nome do Proprietário"`. O comando não associa utilizadores a uma organização padrão implicitamente.

Crie separadamente uma conta para administração geral da plataforma:

```powershell
npm run db:create-platform-admin
```

Essa conta não recebe acesso a uma loja. Pode criar contas de loja, seleccionar os módulos e activar ou desactivar o acesso. O produto não processa pagamentos de subscrição: a cobrança é tratada fora da plataforma. O administrador geral consulta metadados das lojas; para consultar totais financeiros, precisa abrir um acesso temporário, indicar o motivo e cada leitura fica registada. Para conceder administração da plataforma a uma conta existente a partir de um terminal confiável, use `npm run db:grant-platform-admin -- utilizador@dominio.com`.

Depois, inicie a aplicação:

```powershell
npm run dev
```

Abra http://localhost:3000 e entre com a conta de administrador geral para aceder a **/plataforma** e cadastrar a primeira loja. O proprietário entra pelo mesmo endereço com a conta criada pelo administrador.

O módulo de Comércio usa `/loja` para o resumo e `/loja/vendas`, `/loja/produtos`, `/loja/caixa`, `/loja/relatorios` e `/loja/definicoes` para as suas páginas. Os endereços antigos são encaminhados para os novos. O prefixo organiza as rotas; a autorização continua a ser verificada no servidor, incluindo sessão, organização activa e módulo contratado.

O seletor de módulos mostra as opções autorizadas para a conta. `/servicos` e `/formacao` apresentam a disponibilidade futura desses módulos; as suas funcionalidades serão implementadas nas próximas fases.

## Autenticação, dados e sincronização

As fotos de produtos são opcionais. Configure `CLOUDINARY_URL` no ambiente do servidor e aplique as migrações antes de usar o upload. O cadastro com foto exige ligação à internet.

- Better Auth gere as sessões e as palavras-passe. A criação pública de contas está desactivada. O administrador geral cria cada organização e uma única conta proprietária com e-mail e palavra-passe inicial.
- Em **Minha Loja**, o proprietário pode alterar o nome da loja e o seu nome quando está online. O novo e-mail de acesso passa a valer assim que for guardado. Os campos usam as tabelas de organização e utilizador já existentes, sem uma nova migração.
- Cada organização guarda o estado (`active` ou `inactive`) e a lista de módulos seleccionados: Lojas e Comércio, Empresas e Serviços e Formação de Alunos. Nesta versão, só Comércio está disponível; contas sem esse módulo recebem uma página clara sobre a disponibilidade futura dos módulos seleccionados.
- A relação utilizador-loja é limitada pela base de dados a uma conta por organização. O proprietário gere apenas a sua loja; a plataforma geral gere o utilizador, a loja e os módulos. Não existe gestão de equipa dentro da loja.
- O papel Better Auth `platform-admin` é separado e tem permissões mínimas nos endpoints administrativos da biblioteca. A lista da plataforma mostra metadados da conta, sem totais financeiros.
- O suporte financeiro da plataforma exige motivo e autorização de 15, 30 ou 60 minutos para uma loja específica. Concessões, encerramentos e cada leitura do resumo financeiro são registados. O painel de suporte mostra totais agregados, não transações individuais.
- O painel geral permite pesquisar lojas, consultar o estado da conta, ver a data de registo, o nome do proprietário, o e-mail de acesso, os módulos activos e a última operação recebida. Não há um registo genérico de suporte; a auditoria é reservada a concessões, encerramentos e consultas financeiras. A data de sincronização não representa a ligação actual do dispositivo.
- Ao desactivar uma loja, a plataforma revoga as sessões do proprietário e bloqueia o acesso aos módulos. Reactivar a loja devolve o acesso se a conta não tiver sido suspensa por outro motivo.
- Organizações existentes ficam com Comércio activo por padrão. A migração mantém um único utilizador de loja por organização e termina acessos de equipa antigos; contas apenas de plataforma continuam separadas.
- O servidor e a autenticação Better Auth usam o mesmo PostgreSQL, configurado por `DATABASE_URL`.
- A aplicação aceita várias organizações na mesma instalação. Os dados operacionais e as operações de sincronização são sempre filtrados pela organização autenticada. A moeda de apresentação é Db; o país e os requisitos fiscais ainda não foram definidos.
- O primeiro acesso exige internet. Depois de uma autenticação válida, cada organização usa a sua própria base IndexedDB para catálogo, movimentos e fila de sincronização; o perfil offline fica num armazenamento separado. Vendas e despesas são guardadas antes de aparecerem como concluídas.
- A base global `konta-commerce` usada por versões anteriores só pode ser migrada para a organização local `default`. Outras organizações nunca importam essa fila ou catálogo; cada operação offline permanece no banco do seu próprio tenant ao trocar de conta no dispositivo.
- Sem ligação, o catálogo fica disponível para consulta e vendas, troco e despesas podem ser registados localmente. Criar produtos exige ligação.
- A fila envia lotes automaticamente enquanto a aplicação está aberta e a ligação regressa. O servidor valida os dados, grava cada operação em transação e usa um identificador único para aceitar novas tentativas sem duplicar vendas ou despesas.
- Cada dispositivo mantém uma sessão de caixa de cada vez. A abertura e o fecho, as vendas e as despesas ficam associados a essa sessão; o fecho regista o valor esperado, o dinheiro contado e a diferença. A sessão também pode ser aberta e fechada offline após o primeiro acesso online; a fila sincroniza os movimentos por ordem e recalcula a conferência se algum movimento chegar depois. Se uma operação falhar, as seguintes ficam guardadas até a falha ser corrigida e a fila ser tentada novamente.
- Vendas simultâneas offline podem deixar o stock negativo no servidor. A venda é preservada, a divergência fica visível e o administrador pode corrigir o saldo após uma contagem física; o ajuste fica registado no histórico de stock.
- A sessão de acesso local expira após sete dias sem validação online. Os dados de Comércio ficam no perfil local do navegador; limpar os dados do navegador remove a cópia desse dispositivo.
- O proprietário da loja pode gerir produtos, vendas, caixa, despesas, relatórios e os dados básicos da própria conta. O administrador geral gere o estado da conta e os módulos autorizados.
- A aplicação não encripta o IndexedDB. Proteja a conta do sistema e o dispositivo que guarda dados offline; em dispositivos partilhados, termine a sessão quando possível.

## Entrega e operação

Na hospedagem, configure `DATABASE_URL` com o PostgreSQL do Neon, `BETTER_AUTH_URL` com o endereço HTTPS da aplicação e uma `BETTER_AUTH_SECRET` aleatória. Defina um plano de cópia de segurança e restauro para o banco.

Se houver corte de energia, os dados confirmados pelo navegador permanecem no dispositivo, mas a loja precisa de energia para continuar a trabalhar; use uma UPS se for necessário manter o serviço ligado.

O plano de implementação e os critérios de aceitação estão em [`tasks/plan.md`](tasks/plan.md) e [`tasks/todo.md`](tasks/todo.md).
