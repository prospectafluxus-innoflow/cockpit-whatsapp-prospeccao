# Manual do Usuário — ProspectaFluxus

**Cockpit de Prospecção WhatsApp**
Versão 2.0 — Junho de 2026

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Acesso e Login](#2-acesso-e-login)
3. [Importando sua Planilha de Leads](#3-importando-sua-planilha-de-leads)
4. [Cockpit de Prospecção](#4-cockpit-de-prospecção)
5. [Enviando os Toques](#5-enviando-os-toques)
6. [Kanban CRM](#6-kanban-crm)
7. [Dashboard](#7-dashboard)
8. [Agendamento e Lembretes](#8-agendamento-e-lembretes)
9. [Personalizando as Mensagens dos Toques](#9-personalizando-as-mensagens-dos-toques)
10. [Administração](#10-administração)
11. [Dúvidas Frequentes](#11-dúvidas-frequentes)

---

## 1. Visão Geral

O **ProspectaFluxus** é um cockpit de prospecção via WhatsApp desenvolvido para a InnoFlow. Ele organiza seus leads em três camadas de prioridade (A, B e C), distribui os contatos ao longo do dia em janelas de horário (Manhã, Almoço, Meio da tarde e Fim do dia) e gera automaticamente os links do WhatsApp com a mensagem do toque já preenchida com o nome e a empresa de cada lead.

O sistema funciona de forma **100% autônoma** — hospedado no Railway com banco de dados Supabase, sem dependência de serviços externos.

---

## 2. Acesso e Login

Acesse o sistema pelo endereço: **[prospectafluxus-production.up.railway.app](https://prospectafluxus-production.up.railway.app)**

Na tela de login, informe seu **e-mail** e **senha** cadastrados. O sistema não usa login social (Google, Facebook) — apenas e-mail e senha próprios.

> Caso precise redefinir sua senha ou cadastrar um novo usuário, entre em contato com o administrador do sistema.

Após o login, você será direcionado automaticamente para o **Cockpit de Prospecção**.

---

## 3. Importando sua Planilha de Leads

### Formato esperado da planilha

A planilha deve estar no formato **.xlsx** (Excel) e conter as seguintes colunas:

| Coluna | Descrição | Obrigatório |
|---|---|---|
| Nome | Nome completo do lead | Sim |
| Empresa | Nome da empresa | Não |
| WhatsApp | Número com DDD (ex: 11999998888) | **Sim** |
| Camada | A, B ou C | Sim |
| Segmento | Setor de atuação | Não |
| Cidade | Cidade do lead | Não |

> **Atenção:** leads sem número de WhatsApp válido são automaticamente descartados na importação. Isso é esperado e correto.

### Como importar

1. Clique no botão **"Importar Planilha"** no canto superior direito do Cockpit.
2. Selecione o arquivo `.xlsx` no seu computador.
3. Acompanhe a **barra de progresso** que aparece abaixo do cabeçalho — ela mostra quantos leads já foram importados (ex: `300 / 1650`).
4. Ao concluir, uma mensagem de confirmação informa o total importado.

### Sobre a importação em lotes

Para garantir que todos os leads sejam importados sem timeout, o sistema envia os dados em **lotes de 50 leads** por vez. Em uma planilha com 1.650 leads, serão feitas aproximadamente 33 requisições sequenciais. O processo leva entre 1 e 3 minutos dependendo da velocidade da internet.

> **Reimportação:** ao importar uma nova planilha, os leads anteriores são **substituídos**. Certifique-se de que a nova planilha contém todos os leads desejados antes de importar.

---

## 4. Cockpit de Prospecção

O Cockpit é a tela principal do sistema. Ele exibe:

- **Filtros por camada:** botões "Todos", "Camada A", "Camada B" e "Camada C" com o total de leads em cada uma.
- **Busca:** campo para filtrar leads por nome ou empresa.
- **Fila do Dia:** quatro janelas de horário (Manhã, Almoço, Meio da tarde, Fim do dia) com os leads programados para hoje.
- **Fila Ativa:** lista completa dos leads que ainda não foram descartados ou fechados, ordenados por camada e prioridade.

### Entendendo as Camadas

| Camada | Perfil | Prioridade |
|---|---|---|
| **A** | Leads mais quentes, maior potencial | Alta |
| **B** | Leads com bom potencial, precisam de mais toques | Média |
| **C** | Leads frios, abordagem mais ampla | Baixa |

---

## 5. Enviando os Toques

Cada lead passa por até **3 toques** de abordagem. O sistema controla automaticamente qual toque deve ser enviado para cada lead.

### Como enviar um toque

1. Localize o lead na **Fila Ativa** ou na **Fila do Dia**.
2. Clique no botão do toque correspondente (**Toque 1**, **Toque 2** ou **Toque 3**).
3. O sistema abre automaticamente o **WhatsApp Web** (ou o app no celular) com a mensagem já preenchida com o nome e a empresa do lead.
4. Revise a mensagem e clique em **Enviar** no WhatsApp.
5. Volte ao sistema — o lead é automaticamente movido para o próximo estágio.

### Variáveis nas mensagens

As mensagens usam variáveis que são substituídas automaticamente:

| Variável | Substituído por |
|---|---|
| `{firstName}` | Primeiro nome do lead (ex: "Douglas") |
| `{company}` | Nome da empresa do lead (ex: "DLF Transportes") |

---

## 6. Kanban CRM

O **Kanban CRM** exibe todos os leads organizados em colunas por estágio do pipeline:

| Coluna | Significado |
|---|---|
| **Novo** | Lead importado, ainda não abordado |
| **Toque 1 Enviado** | Primeiro contato realizado |
| **Toque 2 Enviado** | Segundo contato realizado |
| **Toque 3 Enviado** | Terceiro contato realizado |
| **Respondeu** | Lead respondeu e está em negociação |
| **Fechado** | Negócio concluído |

Você pode arrastar os cards entre colunas para atualizar manualmente o estágio de um lead, ou usar os botões de toque no Cockpit para avançar automaticamente.

---

## 7. Dashboard

O Dashboard apresenta métricas consolidadas da sua prospecção:

- Total de leads por camada
- Quantidade de toques enviados por dia
- Taxa de resposta por camada
- Funil de conversão (Novo → Respondeu → Fechado)

Use o Dashboard para identificar quais camadas estão performando melhor e ajustar sua estratégia de abordagem.

---

## 8. Agendamento e Lembretes

A página de **Agendamento** permite configurar:

- **Janelas de horário:** defina os horários de cada janela (Manhã, Almoço, Meio da tarde, Fim do dia) para que o sistema distribua os leads ao longo do dia.
- **Lembretes:** ative notificações para receber alertas nos horários das janelas via celular ou WhatsApp.
- **Mensagens dos Toques:** personalize o texto de cada toque (veja seção 9).

---

## 9. Personalizando as Mensagens dos Toques

Na página de **Agendamento**, role até a seção **"Mensagens dos Toques"** para editar o texto de cada um dos 3 toques.

### Como editar

1. Clique no campo de texto do toque desejado.
2. Edite o texto livremente.
3. Use `{firstName}` onde quiser inserir o primeiro nome do lead.
4. Use `{company}` onde quiser inserir o nome da empresa.
5. Clique em **Salvar** para confirmar.
6. Para voltar ao texto original, clique em **Padrão**.

### Textos padrão

Os textos padrão já estão configurados com as mensagens da InnoFlow. Você pode alterá-los a qualquer momento — as alterações ficam salvas no banco de dados e são aplicadas imediatamente nos próximos toques.

> **Importante:** as mensagens são salvas **por usuário**. Cada usuário do sistema pode ter seus próprios textos personalizados.

---

## 10. Administração

A página de **Administração** é acessível apenas para usuários com perfil de **admin**. Nela você pode:

- **Aprovar novos usuários:** quando alguém se cadastra, o status inicial é "pendente". O admin precisa aprovar o acesso.
- **Rejeitar usuários:** bloqueia o acesso de um usuário.
- **Visualizar todos os usuários:** nome, e-mail, perfil e status de aprovação.

> Após aprovar um usuário, ele precisa fazer login novamente para que as permissões sejam aplicadas.

---

## 11. Dúvidas Frequentes

**Os leads sumiram após fazer login novamente.**
Isso pode ocorrer se o cookie de sessão estiver desatualizado. Faça **logout** e **login** novamente. Se o problema persistir, entre em contato com o suporte técnico.

**A importação parou no meio.**
O sistema importa em lotes de 50 leads. Se a barra de progresso parar, aguarde alguns segundos — pode ser lentidão temporária de rede. Se não retomar, reimporte a planilha. Os leads já importados serão substituídos.

**O WhatsApp não abre ao clicar no toque.**
Verifique se o WhatsApp Web está aberto no navegador ou se o aplicativo está instalado no celular. O sistema gera um link `wa.me` que requer o WhatsApp instalado.

**Posso usar o sistema em mais de um dispositivo ao mesmo tempo?**
Sim. O sistema é baseado em web e funciona em qualquer navegador. A sessão é mantida por cookie — cada dispositivo precisa fazer login separadamente.

**Como adicionar um novo usuário?**
O novo usuário acessa o sistema e se cadastra com e-mail e senha. Após o cadastro, um administrador precisa aprovar o acesso na página de Administração.

---

*Manual elaborado para uso interno da InnoFlow — ProspectaFluxus v2.0*
