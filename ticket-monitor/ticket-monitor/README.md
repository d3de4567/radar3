# 🎟️ Radar de Ingressos

Um aplicativo que fica de olho, sozinho, na página de venda de ingressos de um
evento, e te avisa (som + notificação + Telegram) assim que ingressos voltarem
a ficar disponíveis — mesmo que você feche o navegador.

Este README foi escrito para quem **nunca programou**. Vá seguindo os passos
na ordem, sem pular nenhum.

---

## Índice

1. [O que é este projeto](#1-o-que-é-este-projeto)
2. [Como instalar no seu computador](#2-como-instalar-no-seu-computador)
3. [Como executar localmente](#3-como-executar-localmente)
4. [Como configurar as notificações do Telegram](#4-como-configurar-as-notificações-do-telegram)
5. [Como colocar o sistema na internet (deploy)](#5-como-colocar-o-sistema-na-internet-deploy)
6. [Como acessar pelo tablet/celular Android](#6-como-acessar-pelo-tablet-celular-android)
7. [Como usar o aplicativo no dia a dia](#7-como-usar-o-aplicativo-no-dia-a-dia)
8. [Como o monitoramento decide "esgotado" ou "disponível"](#8-como-o-monitoramento-decide-esgotado-ou-disponível)
9. [Problemas comuns e soluções](#9-problemas-comuns-e-soluções)
10. [Limites e uso responsável](#10-limites-e-uso-responsável)
11. [Melhorias futuras](#11-melhorias-futuras)

---

## 1. O que é este projeto

Você cadastra um evento (nome, data, link da página de venda). O sistema
verifica essa página de tempos em tempos (por exemplo, a cada 20 segundos) e,
quando percebe que os ingressos apareceram, te avisa com:

- 🔊 um som no aplicativo;
- 📱 uma notificação no navegador/tablet;
- ✈️ uma mensagem no Telegram (funciona mesmo com o app fechado).

**O sistema nunca compra nada por você.** Ele só avisa — a compra continua
sendo feita manualmente, por você.

### Como o projeto é organizado

```
ticket-monitor/
├── backend/     → o "cérebro" do sistema (roda no servidor, faz as verificações)
└── frontend/    → a parte visual (o que você vê e usa no navegador/tablet)
```

- **backend**: um servidor feito em **Node.js**. Ele guarda os eventos num
  banco de dados simples (SQLite) e fica checando cada evento no intervalo que
  você configurou.
- **frontend**: páginas em **HTML, CSS e JavaScript puro** (sem frameworks
  complicados), pensadas para funcionar bem em telas de toque.

O ponto mais importante: **o monitoramento roda no servidor, não no seu
tablet.** Isso significa que você pode fechar o app, apagar a tela, ou até
desligar o tablet, que o servidor continua verificando e vai te avisar (pelo
Telegram, que funciona independente do app estar aberto).

---

## 2. Como instalar no seu computador

Esta etapa é só para testar o sistema no seu computador antes de colocá-lo na
internet. Se quiser pular direto para colocar online, vá para a
[seção 5](#5-como-colocar-o-sistema-na-internet-deploy) — os passos abaixo não
são obrigatórios, mas ajudam a entender e testar o sistema com calma.

### 2.1. Instalar o Node.js

O Node.js é o programa que faz o backend funcionar.

1. Acesse **https://nodejs.org**
2. Baixe a versão marcada como **"LTS"** (é a mais estável).
3. Abra o arquivo baixado e clique em "Avançar" até o fim da instalação
   (pode manter todas as opções padrão marcadas).
4. Para confirmar que instalou certo:
   - **Windows**: aperte a tecla Windows, digite `cmd` e pressione Enter — isso
     abre o **Terminal** (também chamado de "Prompt de Comando").
   - **Mac**: aperte `Cmd + Espaço`, digite `Terminal` e pressione Enter.
   - No terminal que abriu, digite `node -v` e pressione Enter. Deve aparecer
     algo como `v20.11.0`. Se aparecer um número, deu certo.

### 2.2. Baixar os arquivos do projeto

Você recebeu (ou vai receber) uma pasta chamada `ticket-monitor`, contendo as
pastas `backend` e `frontend`. Salve essa pasta em um lugar fácil de achar,
por exemplo na sua área de trabalho (Desktop).

---

## 3. Como executar localmente

1. **Abra o terminal** (veja como no passo 2.1).

2. Navegue até a pasta do backend. Se você salvou o projeto na área de
   trabalho, digite (ajustando o caminho se necessário):

   ```
   cd Desktop/ticket-monitor/backend
   ```

3. Instale as dependências do projeto (bibliotecas que o sistema usa por
   baixo dos panos). Digite:

   ```
   npm install
   ```

   Isso pode demorar um ou dois minutos na primeira vez. É normal aparecer
   bastante texto passando na tela.

4. **Crie um arquivo chamado `.env`** dentro da pasta `backend` (é o arquivo
   que guarda suas configurações secretas). O jeito mais simples:

   - No terminal, ainda dentro da pasta `backend`, digite:
     ```
     cp .env.example .env
     ```
     (No Windows, use `copy .env.example .env`)

   - Depois, abra o arquivo `.env` com o Bloco de Notas (Windows) ou TextEdit
     (Mac) e troque o valor de `JWT_SECRET` por qualquer frase longa e
     aleatória, por exemplo:
     ```
     JWT_SECRET=uma-frase-bem-dificil-de-adivinhar-12345
     ```

5. Inicie o servidor:

   ```
   npm start
   ```

   Se tudo deu certo, vai aparecer no terminal:
   ```
   Servidor rodando na porta 3000
   ```

6. Abra o navegador (Chrome, por exemplo) e acesse:

   ```
   http://localhost:3000
   ```

   Você verá a tela de login do **Radar de Ingressos**. Clique em "Ainda não
   tenho conta — criar agora", cadastre um e-mail e senha, e pronto: você já
   pode cadastrar seu primeiro evento (veja a [seção 7](#7-como-usar-o-aplicativo-no-dia-a-dia)).

   Para parar o servidor, volte ao terminal e aperte `Ctrl + C`.

---

## 4. Como configurar as notificações do Telegram

Esta é a forma mais confiável de receber o aviso, porque funciona mesmo com o
app fechado ou o tablet com a tela apagada.

### 4.1. Criar seu próprio bot no Telegram (gratuito, leva 2 minutos)

1. Abra o Telegram (no celular ou computador).
2. Procure por **@BotFather** (é o "criador oficial de bots" do Telegram).
3. Envie a mensagem `/newbot`.
4. Escolha um nome para o bot (ex: `Meu Radar de Ingressos`).
5. Escolha um "username" que termine em `bot` (ex: `meuradaringressos_bot`).
6. O BotFather vai te enviar um **token**, parecido com isto:
   ```
   123456789:ABCdefGhIJKlmnoPQRstuVWXyz
   ```
   **Copie esse token** — você vai colar no arquivo `.env` (localmente) ou nas
   variáveis de ambiente do site de hospedagem (na internet), no campo
   `TELEGRAM_BOT_TOKEN`.

### 4.2. Descobrir seu ID de chat

1. No Telegram, procure por **@userinfobot**.
2. Envie qualquer mensagem para ele (ex: "oi").
3. Ele vai responder com várias informações, incluindo um número de "Id"
   (ex: `987654321`). Copie esse número.

### 4.3. Conectar no aplicativo

1. Dentro do Radar de Ingressos, clique no ícone de engrenagem ⚙️ (canto
   superior direito).
2. Cole o número de "Id" no campo **"Seu ID de chat do Telegram"** e clique em
   **Salvar**.
3. Procure pelo bot que você criou (pelo nome/username que escolheu no passo
   4.1) e envie `/start` para ele. Isso é necessário para que o Telegram
   permita que o bot te envie mensagens.
4. Pronto! Quando um ingresso aparecer, você vai receber uma mensagem do seu
   bot.

---

## 5. Como colocar o sistema na internet (deploy)

Para o monitoramento funcionar 24 horas por dia (mesmo com seu computador
desligado), o backend precisa rodar em um servidor na internet.

**Recomendação: Render.com.** Por quê: ao contrário de algumas hospedagens
gratuitas que "desligam" o servidor quando ele fica sem uso, o plano pago mais
barato do Render mantém o processo rodando continuamente — o que é essencial
aqui, porque o monitoramento precisa ficar ativo o tempo todo. (O plano
gratuito do Render existe, mas "dorme" depois de alguns minutos sem acesso e
"acorda" devagar quando alguém acessa — isso interromperia o monitoramento
enquanto o app estivesse dormindo. Para monitoramento contínuo de verdade, é
necessário o plano pago de baixo custo, ou outro serviço equivalente como
Railway ou Fly.io, que funcionam de forma parecida.)

### Passo a passo — Render.com

**PASSO 1**
Acesse **https://render.com** e clique em **"Get Started"**.

**PASSO 2**
Crie uma conta (pode usar sua conta do GitHub, Google, ou e-mail).

**PASSO 3**
Você vai precisar que o projeto esteja em um repositório do **GitHub** (é
como uma "pasta na nuvem" para código). Se você ainda não tem:
- Acesse **https://github.com** e crie uma conta gratuita.
- Clique no botão verde **"New"** para criar um novo repositório. Dê um nome,
  por exemplo `radar-ingressos`, e clique em **"Create repository"**.
- Na página do repositório recém-criado, clique em **"uploading an existing
  file"** e arraste toda a pasta `ticket-monitor` (com as subpastas `backend`
  e `frontend`) para dentro. Clique em **"Commit changes"** para salvar.

**PASSO 4**
De volta ao Render, clique em **"New +"** → **"Web Service"**.

**PASSO 5**
Conecte sua conta do GitHub e selecione o repositório `radar-ingressos` que
você criou.

**PASSO 6**
Preencha as configurações do serviço:
- **Name**: `radar-ingressos` (ou o nome que quiser)
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: escolha o plano pago mais barato disponível (necessário
  para o monitoramento ficar sempre ativo, sem "dormir")

**PASSO 7**
Role até **"Environment Variables"** (variáveis de ambiente) e adicione,
clicando em "Add Environment Variable" para cada uma:
- `JWT_SECRET` → uma frase longa e secreta, escolhida por você
- `TELEGRAM_BOT_TOKEN` → o token que você pegou no passo 4.1
- `MIN_INTERVAL_SECONDS` → `10`

**PASSO 8**
Clique em **"Create Web Service"**. O Render vai instalar tudo e iniciar o
servidor automaticamente. Isso leva alguns minutos.

**PASSO 9**
Quando terminar, o Render mostra uma URL no topo da página, parecida com:
```
https://radar-ingressos.onrender.com
```
Essa é a URL do seu aplicativo! Abra ela no navegador do computador ou do
tablet. É a mesma tela de login que você viu ao testar localmente.

> Sempre que você quiser atualizar o sistema no futuro, basta subir os
> arquivos atualizados no GitHub (repita o passo 3) — o Render detecta a
> mudança e atualiza o site sozinho.

---

## 6. Como acessar pelo tablet/celular Android

1. Abra o **Google Chrome** no tablet.
2. Acesse a URL que o Render te deu (ex: `https://radar-ingressos.onrender.com`).
3. Faça login com o e-mail e senha que você cadastrou.
4. Para deixar o aplicativo com "cara de app" na tela inicial:
   - Toque nos **três pontinhos** no canto superior direito do Chrome.
   - Toque em **"Adicionar à tela inicial"** (ou "Instalar aplicativo").
   - Confirme. Vai aparecer um ícone do Radar de Ingressos na tela do tablet,
     como se fosse um app baixado da loja.

### Sobre fechar o app/apagar a tela

O Android pode "pausar" abas do navegador quando a tela está apagada por
muito tempo, para economizar bateria. **Isso não é um problema aqui**, porque
o monitoramento de verdade não acontece no navegador — ele acontece no
servidor (na internet), o tempo todo, independente do tablet estar ligado ou
não. O navegador só serve para você ver o status e cadastrar eventos.

Por isso a recomendação forte é: **configure o Telegram** (seção 4). Assim,
mesmo que o tablet esteja desligado no momento em que o ingresso aparecer,
você recebe o aviso no seu celular assim que ligar o Telegram.

As notificações do navegador (sino 🔔) são um bônus, mas dependem do
navegador/aba estar pelo menos em segundo plano e do sistema não ter
"matado" o processo — por isso não são 100% garantidas em segundo plano no
Android, diferente do Telegram.

---

## 7. Como usar o aplicativo no dia a dia

### Cadastrar um evento

1. Toque no botão **"+ Novo evento"**.
2. Preencha:
   - **Nome do evento** (ex: "Balada X — 22/08")
   - **Data do evento**
   - **Horário** (opcional)
   - **Link da página do evento** (cole a URL da página de venda)
   - **Verificar a cada**: escolha o intervalo (recomendado: 20 ou 30 segundos)
3. Marque as opções que quiser:
   - "Iniciar monitoramento automaticamente ao salvar"
   - "Abrir o evento automaticamente quando encontrar disponibilidade"
   - "Emitir alerta sonoro"
   - "Mostrar notificação no navegador"
4. Toque em **"Salvar evento"**.

### Iniciar/parar o monitoramento

Cada card de evento tem um botão **"Monitorar"** (fica verde/ativo) ou
**"Parar"**. Você pode ligar e desligar o monitoramento a qualquer momento.

### Ver o histórico

Toque no ícone 🕘 no card do evento para ver as últimas verificações e os
horários em que o status mudou.

### Testar o alerta (sem esperar um ingresso real)

Toque no ícone 🔔 no card do evento. O sistema vai simular
"🎟️ INGRESSO DISPONÍVEL!" e disparar som, notificação e Telegram (se
configurados), só para você confirmar que está tudo funcionando.

### Abas

- **Todos**: todos os eventos cadastrados.
- **Ativos**: eventos com monitoramento ligado no momento.
- **Próximos**: eventos futuros que ainda não estão sendo monitorados.
- **Finalizados**: eventos cuja data já passou.

---

## 8. Como o monitoramento decide "esgotado" ou "disponível"

O sistema faz uma requisição simples à página do evento (o mesmo tipo de
acesso que seu navegador faz para carregar a página) e procura por palavras
que indicam esgotado ou disponível.

Por padrão, ele procura por palavras comuns como "esgotado", "sold out",
"indisponível" (esgotado) e "comprar ingresso", "add to cart", "disponível"
(disponível).

**Sobre o site da ARQZIN, especificamente:** muitos sites de venda de
ingressos hoje carregam a disponibilidade através de JavaScript, depois que a
página inicial já carregou (ou seja, a informação não está no HTML puro, e
sim é buscada por trás através de uma chamada a uma API). Se for o caso do
site que você quer monitorar, a verificação simples pode não conseguir "ver"
essa informação, e o status ficará como "monitorando" sem detectar mudanças.

Se isso acontecer, um passo mais avançado (que você pode pedir para alguém
com conhecimento técnico te ajudar, ou pedir para o Claude te ajudar depois,
mostrando o que encontrar) é:

1. No computador, abra a página do evento no Chrome.
2. Aperte `F12` para abrir as "Ferramentas do Desenvolvedor".
3. Clique na aba **"Rede"** (Network).
4. Recarregue a página.
5. Procure, na lista de requisições, por algo que pareça buscar a
   disponibilidade dos ingressos (geralmente tem "api" no nome, e o resultado
   aparece em formato JSON).
6. Se encontrar, copie o endereço (URL) dessa requisição e use-o como a "URL"
   do evento, em vez do endereço da página visual. Assim, o sistema vai
   verificar diretamente essa fonte de dados, que costuma ser mais confiável.

Você também pode personalizar, na tela de cadastro do evento, em "Opções
avançadas de detecção", quais palavras exatas o sistema deve procurar —
inspecione o HTML/JSON da página para descobrir os termos certos.

---

## 9. Problemas comuns e soluções

**"O status do evento nunca muda, mesmo eu sabendo que abriu vaga."**
→ É provável que o site carregue a disponibilidade via JavaScript/API, como
explicado na seção 8. Tente encontrar o endereço da API real, ou ajuste as
palavras de detecção nas opções avançadas.

**"Recebi um erro dizendo HTTP 429 ou 'muitas requisições'."**
→ O site está limitando o número de acessos. Aumente o intervalo de
verificação do evento (por exemplo, de 10 para 30 ou 60 segundos).

**"Não recebo notificação no Telegram."**
→ Confira se você enviou `/start` para o seu bot (seção 4.3, passo 3) e se o
`TELEGRAM_BOT_TOKEN` está configurado corretamente no servidor.

**"Não recebo notificação do navegador."**
→ Abra as Configurações ⚙️ dentro do app e toque em "Ativar notificações do
navegador". Se o navegador tiver bloqueado no passado, você precisa liberar
manualmente nas configurações do site, dentro do Chrome.

**"O servidor gratuito 'dorme' e demora para responder."**
→ Isso é esperado em planos totalmente gratuitos de hospedagem. Para
monitoramento contínuo de verdade, é necessário um plano pago (mesmo que
barato) que mantenha o processo sempre ativo — veja a seção 5.

**"Esqueci minha senha."**
→ A primeira versão do sistema não tem "recuperar senha" (para manter tudo
simples). Se precisar, crie uma nova conta com outro e-mail, ou peça ajuda
para alguém com conhecimento técnico redefinir a senha diretamente no banco
de dados.

---

## 10. Limites e uso responsável

Este sistema foi projetado para consultar disponibilidade de forma
responsável, e propositalmente **não faz** algumas coisas:

- Não compra ingressos automaticamente — a compra é sempre manual, feita por
  você.
- Não tenta burlar CAPTCHA, fila virtual, login ou qualquer mecanismo de
  proteção do site.
- Não permite configurar intervalos menores que 10 segundos, para evitar
  sobrecarregar o site monitorado.
- Recomenda-se sempre respeitar os termos de uso do site que está sendo
  monitorado.

---

## 11. Melhorias futuras

A estrutura do projeto já foi pensada para, no futuro, crescer para:

- monitorar vários sites de ingressos diferentes (não só um formato de site);
- monitorar eventos de várias cidades/casas de shows ao mesmo tempo;
- avisos por WhatsApp, além do Telegram;
- estatísticas e histórico mais avançado (ex: gráficos de quando os ingressos
  costumam abrir);
- múltiplos usuários com um painel administrativo;
- planos gratuitos e pagos.

Nenhuma dessas melhorias é necessária para a primeira versão funcionar — a
ideia foi entregar algo simples, funcional, e fácil de colocar no ar primeiro.
