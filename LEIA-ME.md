# Portfólio SALT-FAAMA — como instalar (versão 1)

Ordem importa: **banco → função → site**.

## 1. Banco (Supabase → SQL Editor)

Confira no topo que o projeto aberto é o do Portfólio (`wdyprczzcyjkzliimtow`).

1. Abra `supabase/01_estrutura.sql`, cole tudo no SQL Editor e clique em **Run**.
   Cria as tabelas, as regras de segurança e o depósito de fotos `fotos`.
2. **Authentication → Users → Add user → Create new user**: o seu e-mail e uma senha,
   com **Auto Confirm User** marcado.
3. Abra `supabase/02_primeiro_admin.sql`, troque `SEU-EMAIL@gmail.com` pelo e-mail do
   passo 2 e rode. Deve aparecer uma linha com `papel = admin`.
4. **Authentication → Sign In / Providers**: desligue **Allow new users to sign up**.
   As contas são criadas só pela função `api` (primeiro acesso e painel), nunca direto.

## 2. Função `api` (Supabase → Edge Functions)

1. **Deploy a new function → Via Editor**, nome **`api`** (exatamente assim).
2. Apague o exemplo, cole o conteúdo de `supabase/funcao_api.ts` e clique em **Deploy**.
3. Nos detalhes da função, **desligue "Verify JWT"** (ela confere quem chama sozinha).
4. Opcional: em **Edge Functions → Secrets**, crie `CODIGO_SALT` com um texto qualquer
   e comprido. Se não criar, vale um valor padrão.

## 3. Site (GitHub)

1. No repositório `portifoliofaama-app`, envie **o conteúdo da pasta `site/`**
   (o `index.html` tem de ficar na raiz) **num commit só**.
2. **Settings → Pages**: branch `main`, pasta `/ (root)`.
3. Espere o visto verde na lista de commits e abra
   https://nucleodemissoessaltfaama-netizen.github.io/portifoliofaama-app/

O único arquivo que muda na transferência para as contas da faculdade (ou para o
Cloudflare Pages) é `site/js/config.js`.

## 4. Primeiros passos no painel

1. Entre com o e-mail e a senha do passo 1.2: o app abre o **Painel do administrador**.
2. **Cadastro de turmas**: cadastre as turmas (aparecem no primeiro acesso).
3. **Professor orientador**: cadastre o nome como deve sair na folha de rosto.
4. **Cadastro de disciplinas**: crie a disciplina, preencha carga horária, período,
   horário e as horas de confecção do relatório, e cadastre os requisitos.
5. Os alunos entram pelo **Primeiro acesso** ou são cadastrados por você
   (o código vai pelo WhatsApp).

## Como o acesso funciona

- **Primeiro acesso**: o aluno preenche os dados, escolhe turma e disciplina e cria a
  senha (mínimo 8 caracteres). Entra na hora.
- **Cadastro pelo painel**: gera um código de 6 números, válido por **7 dias**.
  O aluno digita o e-mail e o código no lugar da senha e cria a senha dele.
- **Esqueci a senha**: o pedido chega no sino do administrador. Toque em
  **Gerar código** e mande pelo WhatsApp. Vale **15 minutos**.
- **Inativar** bloqueia a entrada sem apagar nada. **Excluir** apaga conta,
  portfólio e fotos (pede para digitar o nome).

## Testes feitos antes da entrega

- `teste/teste_sql.py`: 59 verificações do banco num Postgres 16 de verdade
  (segurança, limite de quantidade, período, troca de disciplina…).
- `teste/teste_telas.mjs`: 57 verificações de ponta a ponta no navegador, com um
  Supabase simulado que roda a função `api` de verdade.
- O Word gerado foi aberto no LibreOffice: 15 páginas, iguais às da prévia.

Nada foi testado contra o Supabase real (o ambiente de construção não alcança a
internet). Na primeira instalação, confira os nomes dos menus do Supabase.
