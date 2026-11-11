# ADR-001: Separar a administração da loja da administração da plataforma

## Estado

Aceite; a cardinalidade de uma conta por loja e o provisionamento pela plataforma foram actualizados em ADR-002.

## Data

2026-11-10

## Contexto

Este registo documenta a decisão inicial. A gestão de colaboradores e a transferência de propriedade descritas abaixo foram substituídas em parte pela decisão posterior, que limita cada loja a uma conta proprietária.

A Kontá precisa de um proprietário que administre uma loja e a sua equipa, além de administradores da plataforma que prestem suporte a várias lojas. A implementação anterior usava o papel `admin` do Better Auth para administradores da loja, activando também endpoints administrativos globais da biblioteca. O suporte da plataforma não deve receber acesso financeiro permanente a todas as lojas.

## Decisão

- A associação à loja e os papéis `admin`/`collaborator` ficam nos dados do utilizador com escopo de organização. Na migração, o primeiro administrador activo de cada organização existente passa a proprietário protegido.
- Os papéis Better Auth usam permissões mínimas: o administrador da loja só pode criar contas de colaborador; colaboradores e administradores gerais não recebem permissões administrativas globais da biblioteca.
- A autoridade da plataforma é concedida separadamente por um comando de terminal confiável e validada no registo persistido em cada pedido ao servidor.
- A lista da plataforma mostra metadados da conta. O suporte financeiro usa uma autorização por utilizador e por loja, exige motivo, expira entre 15 e 60 minutos, pode ser revogada e gera auditoria em cada leitura do resumo agregado.
- O administrador da plataforma mantém solicitações internas de suporte por loja, com prioridade, estado e notas. O histórico administrativo comum não é guardado; o registo de auditoria é reservado ao acesso financeiro, e a última operação sincronizada é exibida como referência histórica, nunca como presença online.
- A transferência de propriedade é uma transação limitada à organização. O novo proprietário passa a administrador; o anterior continua administrador. O proprietário actual não pode ser rebaixado nem suspenso antes da transferência.

## Alternativas consideradas

### Reutilizar o papel Better Auth `admin` para proprietários de lojas

Rejeitada porque dá a um administrador de inquilino acesso a endpoints administrativos da aplicação inteira e mistura autoridade da loja com autoridade da plataforma.

### Dar aos administradores da plataforma acesso financeiro permanente

Rejeitada porque o acesso de suporte deve limitar-se à loja e ao motivo de um atendimento específico. A listagem apenas com metadados reduz a exposição.

### Exigir aprovação de um segundo administrador da plataforma

Adiada para depois da MVP. Prazo limitado, motivo obrigatório, acção explícita, revogação e auditoria por leitura formam um fluxo mínimo sem exigir uma equipa de aprovação permanente.

## Consequências

- A protecção do proprietário e o escopo da equipa são aplicados na API e na base de dados, não apenas na interface.
- Contas existentes precisam da migração, que converte os valores antigos `admin`/`user` em papéis da loja e escolhe um proprietário.
- Contas apenas de plataforma são provisionadas em separado e não recebem associação a uma loja por padrão.
- O painel de suporte devolve apenas totais agregados; uma investigação por transacção exige um fluxo de suporte próprio.
- Uma pessoa que seja administradora da plataforma e de uma loja pode manter as duas autoridades, verificadas separadamente.
