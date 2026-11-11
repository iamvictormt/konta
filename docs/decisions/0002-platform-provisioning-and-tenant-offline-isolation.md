# ADR-002: Provisionamento de lojas e isolamento offline por organização

## Estado

Aceite

## Data

2026-11-11

## Contexto

A Kontá será usada por várias lojas. O proprietário paga fora da aplicação e o administrador geral provisiona a loja e as credenciais. Cada loja terá um único utilizador proprietário. O painel geral precisa mostrar dados de conta e permitir seleccionar os módulos activos; os módulos de Serviços e Formação ainda não têm funcionalidades nesta versão.

A aplicação também precisa de preservar operações offline sem misturar produtos ou filas quando o mesmo navegador autentica contas de lojas diferentes.

## Decisão

- A inscrição pública e a cobrança dentro da aplicação permanecem desactivadas. O administrador geral cria a organização e a conta do proprietário, define a palavra-passe inicial e selecciona um ou mais módulos.
- Os módulos são `commerce`, `services` e `training`. A base de dados limita os valores permitidos e exige pelo menos um módulo. Só `commerce` abre o produto funcional nesta fase; contas sem Comércio recebem uma página de disponibilidade futura.
- Cada organização tem um estado `active` ou `inactive`. A desactivação bloqueia as rotas da loja, termina as sessões do proprietário e preserva a organização e os dados. A reactivação restaura o acesso apenas quando a conta não estiver suspensa por outro motivo.
- A base de dados limita a um utilizador de loja por organização. Contas de colaboradores existentes deixam de ter associação de loja na migração, sem apagar a identidade Better Auth nem outras funções de plataforma.
- Cada organização usa uma base IndexedDB com nome próprio. A sessão offline fica num banco separado, e cada operação local abre explicitamente o banco da organização autenticada.
- A antiga base IndexedDB `konta-commerce` só pode ser importada para a organização local `default`, uma única vez. Outras organizações começam com bancos vazios e não recebem a fila legada.
- A chave idempotente das operações sincronizadas é composta por `(organization_id, id)`, para que uma operação de uma loja não colida com uma operação de outra.
- A listagem da plataforma guarda apenas estado e metadados da conta. Não é criado um histórico genérico de suporte ou de alterações de estado. Consultas financeiras continuam temporárias e auditadas.

## Alternativas consideradas

### Criar vários colaboradores dentro da loja

Rejeitada para esta fase. A operação comercial será feita com uma única conta por loja; criar a conta e distribuir o acesso fica sob responsabilidade do administrador geral.

### Guardar todos os tenants na mesma base IndexedDB

Rejeitada porque a fila global poderia combinar operações locais de contas diferentes durante reconciliação ou sincronização. Um banco por organização mantém o isolamento explícito em leituras, escrita e fila.

### Cobrar subscrições dentro da Kontá

Fora do produto. A cobrança será feita pessoalmente, sem integração de pagamentos ou faturação de subscrição nesta versão.

## Consequências

- O provisionamento só fica completo depois de aplicar a migração 006 e abrir **Criar loja e acesso** na administração da plataforma.
- Contas provisionadas apenas com Serviços ou Formação podem autenticar e ver os módulos configurados, mas as suas funcionalidades ainda não estão disponíveis.
- Trocar de conta no mesmo dispositivo mantém as filas separadas. Uma operação pendente só será enviada quando a conta da mesma organização estiver autenticada.
- A aplicação não consegue revogar acesso offline enquanto o dispositivo permanece sem conexão; a validade local mantém o limite já configurado de sete dias.
- `db:setup` continua a criar a organização `default` apenas para desenvolvimento. A migração geral não cria uma loja padrão.
