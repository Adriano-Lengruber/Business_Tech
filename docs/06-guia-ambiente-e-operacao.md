# 06 — Guia de Ambiente Isolado, Git Flow e Operação

> Este guia garante que todo o desenvolvimento rode **isolado dentro do projeto**, sem poluir ou entrar em conflito com pacotes e bancos instalados globalmente na máquina.

---

## 1. Estratégia de Isolamento no Windows

### 1.1 Node.js & pnpm
- A versão esperada de Node.js está fixada em [`.nvmrc`](file:///c:/dev/OS_Tech_AI/.nvmrc) (`24`) e validada pelo campo `engines` no [`package.json`](file:///c:/dev/OS_Tech_AI/package.json) junto com `engine-strict=true` no [`.npmrc`](file:///c:/dev/OS_Tech_AI/.npmrc).
- **Atenção no PowerShell do Windows:** caso a política de execução de scripts (`ExecutionPolicy`) bloqueie `pnpm`, **não é necessário alterar políticas globais do sistema** — basta invocar `pnpm.cmd`:
  ```powershell
  pnpm.cmd install
  pnpm.cmd dev
  ```
- Todas as dependências ficam confinadas ao `node_modules` do workspace (`shamefully-hoist=false`). Nunca instale bibliotecas globais (`npm install -g`) para tarefas do projeto.

### 1.2 Infraestrutura em Docker Compose (Zero Conflito de Portas/Serviços)
Todos os serviços externos rodam em containers isolados definidos em [`infra/docker/docker-compose.yml`](file:///c:/dev/OS_Tech_AI/infra/docker/docker-compose.yml), com volumes persistidos localmente em `infra/docker/volumes/` (ignorado pelo Git).

**Perfis disponíveis para economizar RAM/CPU:**
- **Core (Banco + Cache + Storage S3):**
  ```powershell
  pnpm.cmd infra:up
  ```
  Sobe `postgres` (`pgvector:pg16`), `redis` (`7-alpine`) e `s3` (`rustfs/rustfs` S3-compatible).
- **Com WhatsApp (Evolution API):**
  ```powershell
  pnpm.cmd infra:up:whatsapp
  ```
- **Com IA Local (Ollama + Faster-Whisper):**
  ```powershell
  pnpm.cmd infra:up:ai
  ```
- **Stack Completa:**
  ```powershell
  pnpm.cmd infra:up:full
  ```

> **Dica:** Se você já possuir Ollama ou PostgreSQL instalados diretamente no Windows, ajuste as portas no seu `.env` local (ex: `POSTGRES_PORT=5433` ou `OLLAMA_BASE_URL=http://host.docker.internal:11434`) para evitar qualquer conflito de porta sem tocar no `docker-compose.yml`.

---

## 2. Padrão de Versionamento com Git

Adotamos **Git Flow Simplificado (Trunk-Based com Feature Branches)** e **Conventional Commits**:

### Branches
- `main`: sempre estável, testada e pronta para deploy.
- `feat/<escopo>`: novas funcionalidades (ex: `feat/os-balcao-intake`, `feat/whatsapp-handoff`).
- `fix/<escopo>`: correções de bugs.
- `docs/<escopo>`: evolução de documentação e ADRs.
- `chore/<escopo>`: setup, dependências, Docker e CI.

### Formato de Commits (Conventional Commits)
```text
<tipo>(<escopo>): <descrição curta no imperativo>

Exemplos:
chore(repo): initialize isolated monorepo, docker infra and docs
feat(os): add quick counter intake form and qr token generation
feat(whatsapp): implement 4s message debounce and human handoff state machine
fix(database): enforce rls tenant context inside transaction wrapper
```

---

## 3. Segurança Operacional e Backups

1. **Segredos:** `.env` nunca entra no Git (protegido pelo `.gitignore`). Gere chaves aleatórias fortes para `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY` e `EVOLUTION_API_KEY` antes de subir produção.
2. **LGPD na prática:**
   - Senhas de dispositivos (ex: PIN de desbloqueio do notebook do cliente) devem ser criptografadas em repouso (AES-256-GCM) e expirar automaticamente após a entrega/garantia ou serem coletadas apenas quando indispensáveis.
   - Nunca imprimir `CPF`, `CNPJ`, `telefone` ou `tokens` em logs de aplicação.
3. **Backup & Restore:**
   - Dump lógico diário do PostgreSQL (`pg_dump -Fc`) + sincronização do bucket privado MinIO para storage externo criptografado, com teste periódico de restauração em container limpo.
