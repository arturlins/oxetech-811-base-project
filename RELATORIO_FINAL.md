# Relatório Final Integrador de Evolução da Aplicação

> **Projeto:** Oxetech Helpdesk API  
> **Curso:** Engenharia de Software Moderna (811)  
> **Autor:** Artur Lins  
> **Data:** Julho / 2026  

---

## 1. Visão Geral e Estado Inicial da Codebase

A aplicação iniciou o curso como uma API REST rudimentar de suporte acadêmico construída em Express e TypeScript. No seu estado inicial (legado):

- **Monolito concentrado**: Toda a lógica da aplicação estava acoplada dentro de um único arquivo de rotas (`src/routes.ts`).
- **Falha grave de segurança**: A rota `GET /users` retornava a lista crua do banco de dados contendo o campo `password` de todos os usuários registrados.
- **Mistura de responsabilidades**: O arquivo de rotas realizava parsing HTTP, regras condicionais de prioridade de chamados e leitura/escrita direta no arquivo JSON em disco.
- **Inconsistência de código & Code Smells**: Presença de números mágicos (ex: `220` sem explicação de regra de negócio), strings literais repetidas manuais para `status` e `category`, e mensagens de erro HTTP formatadas de modo inconsistente (`message` vs `error`).
- **Falta de qualidade e infraestrutura**: Ausência completa de testes automatizados, linter, validação runtime de dados de entrada, containerização Docker ou pipeline de integração contínua (CI).

---

## 2. Linha do Tempo da Evolução (AV1 → AV2 → AV3)

A modernização da aplicação seguiu uma abordagem incremental e fundamentada nos conceitos de Engenharia de Software Moderna:

```
[Código Legado Inseguro]
        │
        ▼ (AV1: Clean Code & Refatoração Inicial)
[Senhas protegidas (PublicUser) + Abstração de Dados + Constantes + Erros Padronizados]
        │
        ▼ (AV2: Arquitetura em Camadas, Design Patterns, Docker & CI)
[Controllers/Services/Repositories + Strategy Pattern + Validação Runtime + Vitest + Docker + CI]
        │
        ▼ (AV3: Projeto Final Integrador & Consolidação)
[Logging HTTP + Healthcheck Dinâmico + UUIDs Nativos + Sanitização XSS + 28 Testes + Documentação Final]
```

---

## 3. Principais Problemas Encontrados e Melhorias Implementadas

| Categoria | Problema Identificado no Legado | Solução Aplicada (AV1 / AV2 / AV3) |
|---|---|---|
| **Segurança** | `GET /users` expunha senhas em texto puro | Introdução do tipo `PublicUser = Omit<User, "password">` e remoção no `UserService`. |
| **Segurança** | Vulnerabilidade a Script Injection / XSS | Criação de `sanitize.util.ts` limpando marcações HTML/scripts antes de validar o body. |
| **Arquitetura** | Violamento do SRP (rotas faziam tudo) | Separação estrita em camadas: **Controller** (HTTP), **Service** (Negócio) e **Repository** (Persistência). |
| **Design Patterns** | Regras de prioridade em condicionais frágeis | Aplicação do **Strategy Pattern** (`IPriorityRule` + `PriorityCalculator`). |
| **Design Patterns** | Acoplamento direto com o arquivo JSON | Aplicação do **Repository Pattern** (`UserRepository` e `TicketRepository`). |
| **Performance** | Algoritmo `enrichTicket` com complexidade $O(N \times M)$ | Indexação prévia dos usuários e comentários em memória usando `Map`, reduzindo para $O(N + M + C)$. |
| **Identificadores** | IDs gerados com `Date.now() + Math.random()` | Substituição por UUIDs criptográficos v4 com a API nativa `crypto.randomUUID()`. |
| **Erros & Validação** | Erros descentralizados e payloads sem validação | Criação da classe `AppError`, middleware `errorHandler` e middleware de validação schema runtime. |
| **Observabilidade** | API rodava sem logs de acesso e healthcheck estático | Middleware `requestLogger` (tempo em ms) e `/api/health` validando conectividade do banco em tempo real. |
| **DevOps & QA** | Sem testes, linter, Docker ou CI | Configuração do Vitest (28 testes passing), ESLint 9, Dockerfile multi-stage e GitHub Actions CI. |

---

## 4. Conceitos de Engenharia de Software Aplicados

1. **Clean Code & Manutenibilidade**:
   - Nomes com revelação de intenção (`LONG_DESCRIPTION_THRESHOLD`, `PublicUser`, `sanitizeString`).
   - Funções pequenas e focadas em uma única tarefa.
2. **Princípios SOLID**:
   - **SRP (Single Responsibility Principle)**: Cada classe ou módulo possui uma única razão para mudar.
   - **OCP (Open/Closed Principle)**: Novas regras de prioridade podem ser adicionadas criando uma nova classe que implementa `IPriorityRule`, sem modificar o `PriorityCalculator`.
   - **DIP (Dependency Inversion Principle)**: Dependências injetadas via construtor, facilitando testes e substituição de componentes.
3. **Padrões de Projeto (Design Patterns)**:
   - **Repository Pattern**: Desacoplamento completo do meio de persistência.
   - **Strategy Pattern**: Decomposição de condicionais complexas em estratégias isoladas.
4. **DevOps, Containerização e CI/CD**:
   - **Docker Multi-Stage**: Estágio de compilação isolado de produção para gerar imagens leves e reproduzíveis.
   - **GitHub Actions**: Workflow automatizado executando `lint → typecheck → test → build` em cada push/PR.
   - **Developer Experience (.gitattributes)**: Atributo `linguist-generated` em `package-lock.json` para evitar poluição visual durante revisões de código.

---

## 5. Comparativo "Antes e Depois" do Código (Exemplos Práticos desde o Início)

### Exemplo 1: Proteção de Dados Sensíveis (Usuários)

**Antes (Legado Inicial):**
```typescript
// src/routes.ts - Retornava o array de usuários bruto do arquivo JSON
router.get("/users", (_request, response) => {
  const database = readDatabase();
  response.json(database.users); // VAZAMENTO DE SENHA!
});
```

**Depois (Projeto Refatorado):**
```typescript
// src/types.ts
export type PublicUser = Omit<User, "password">;

// src/services/UserService.ts
export class UserService {
  constructor(private userRepository: IUserRepository) {}

  listUsers(): PublicUser[] {
    const users = this.userRepository.findAll();
    return users.map(({ password: _, ...user }) => user); // Remove o campo password de forma segura
  }
}
```

---

### Exemplo 2: Estrutura da Rota vs Arquitetura em Camadas + Strategy Pattern

**Antes (Legado Inicial):**
```typescript
// src/routes.ts - Tudo misturado no handler da rota
router.post("/tickets", (request, response) => {
  const database = readDatabase();
  const { title, description, category, requesterId } = request.body;

  let priority = "low";
  if (category === "sistemas" || description.length > 220) {
    priority = "high";
  }

  const ticket = {
    id: Date.now().toString(),
    title,
    description,
    category,
    requesterId,
    priority,
    status: "open"
  };

  database.tickets.push(ticket);
  writeDatabase(database);
  response.json(ticket);
});
```

**Depois (Projeto Refatorado):**
```typescript
// src/routes.ts - Rota declarativa com middlewares
router.post("/tickets", validateBody(validateCreateTicket), ticketController.createTicket);

// src/services/TicketService.ts - Caso de uso com Injeção de Dependência e UUID
export class TicketService {
  private priorityCalculator = new PriorityCalculator();

  constructor(
    private ticketRepository: ITicketRepository,
    private userRepository: IUserRepository
  ) {}

  createTicket(data: CreateTicketDTO): Ticket {
    const requester = this.userRepository.findById(data.requesterId);
    if (!requester) throw new AppError("Solicitante inválido", 400);

    const priority = this.priorityCalculator.calculate(data.category, data.description);

    const ticket: Ticket = {
      id: generateId("ticket"), // UUID v4 criptográfico (crypto.randomUUID)
      title: data.title,
      description: data.description,
      category: data.category,
      requesterId: data.requesterId,
      status: "open",
      priority,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.ticketRepository.create(ticket);
  }
}
```

---

### Exemplo 3: Desempenho no Enriquecimento de Dados (`enrichTicket`)

**Antes (AV1 - Busca Linear O(N * M)):**
```typescript
// Buscava usuários e filtrava comentários iterativamente para cada ticket em O(N * M)
const requester = users.find(u => u.id === ticket.requesterId);
const comments = allComments.filter(c => c.ticketId === ticket.id);
```

**Depois (AV2 / AV3 - Indexação em Memória O(N + M + C)):**
```typescript
// Indexação prévia em Map para busca O(1)
const usersMap = new Map(users.map((u) => [u.id, u]));
const commentCountsMap = new Map<string, number>();

for (const comment of comments) {
  commentCountsMap.set(comment.ticketId, (commentCountsMap.get(comment.ticketId) || 0) + 1);
}
```

---

### Exemplo 4: Geração de Identificadores Únicos

**Antes (Legado / AV1 / AV2):**
```typescript
private generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}
```

**Depois (AV3 - UUID Nativo):**
```typescript
// src/utils/id.util.ts
import { randomUUID } from "node:crypto";

export function generateId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
```

---

### Exemplo 5: Tratamento de Erros e Sanitização

**Antes (Legado Inicial):**
```typescript
// Erros com formatos arbitrários e aceitação de scripts maliciosos sem tratamento
if (!ticket) return response.status(404).json({ message: "Not found" });
```

**Depois (Projeto Refatorado):**
```typescript
// src/errors/AppError.ts
export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message);
  }
}

// src/utils/sanitize.util.ts
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return input;
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "");
}
```

---

## 6. Evidências de Funcionamento

A suíte de testes passou por um crescimento consistente ao longo do projeto:

- **Legado**: 0 testes.
- **AV1**: 11 testes.
- **AV2**: 22 testes.
- **AV3 (Projeto Final)**: **28 testes unitários passando em 8 suítes**.

```
 ✓ src/__tests__/logger.test.ts (1 test)
 ✓ src/__tests__/users.test.ts (2 tests)
 ✓ src/__tests__/database.test.ts (2 tests)
 ✓ src/__tests__/UserController.test.ts (1 test)
 ✓ src/__tests__/utils.test.ts (4 tests)
 ✓ src/__tests__/priority.test.ts (7 tests)
 ✓ src/__tests__/validation.test.ts (8 tests)
 ✓ src/__tests__/TicketService.test.ts (3 tests)

 Test Files  8 passed (8)
      Tests  28 passed (28)
```

Validação do Pipeline CI e Builds:
- `npm run lint` → 0 problemas.
- `npm run typecheck` → 0 erros de compilação.
- `npm run build` → Compilação concluída para `dist/`.
- `docker build .` → Imagem construída com sucesso.

---

## 7. Limitações Conhecidas e Próximos Passos

### Limitações Conhecidas
1. **Persistência Local Síncrona**: O banco de dados continua sendo um arquivo JSON manipulado via I/O síncrono. Em produção com alta concorrência, isso gera gargalo no event loop do Node.js.
2. **Autenticação**: O sistema não implementa autenticação com senhas hash ou tokens JWT/OAuth2. O usuário é identificado informando seu ID nas requisições.

### Próximos Passos
1. **Migração para Banco de Dados Relacional**: Implementar uma nova classe de repositório (`PostgresTicketRepository`) que satisfaça a interface `ITicketRepository` usando um ORM como Prisma ou Kysely.
2. **Autenticação com JWT & Hashing de Senhas**: Adicionar autenticação com `bcrypt` para senhas e emissão de tokens Bearer JWT nas requisições.
3. **Documentação Swagger/OpenAPI**: Adicionar especificação OpenAPI 3.0 para geração automatizada de documentação interativa.
