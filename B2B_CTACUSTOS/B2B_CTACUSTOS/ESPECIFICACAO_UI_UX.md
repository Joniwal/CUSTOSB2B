# Especificação visual e técnica

## Direção de interface

O sistema combina a leitura limpa da referência tabular com o caráter compacto da referência de dashboard. A interface usa cartões e painéis discretos, alto contraste, poucas sombras e forte alinhamento de dados. O cabeçalho usa exatamente `#DD7FD4` em todas as telas.

### Dashboard — desktop

- Topbar fixa de 68 px com marca, busca global, estado da sincronização, notificações e usuário.
- Sidebar fixa de 244 px com Dashboard, Atividades e atalhos por status.
- Cabeçalho de página com contexto, horário de atualização e ação principal.
- Quatro cartões de métrica: total, em andamento, concluídas e custo evitado.
- Grade principal em duas colunas: distribuição por status, relação de custos, tabela de atualizações recentes e lista de tipos.
- Conteúdo limitado a 1460 px para manter densidade e comprimento de linha controlados.

### Listagem — desktop

- Filtros agrupados no topo do painel: busca, status, tipo e limpeza.
- Tabela semântica com as colunas obrigatórias `ID`, `Tipo de Atividade`, `Status`, `Situação` e `Ações`.
- Ordenação acionada no cabeçalho, badges semânticos, ação de edição com ícone e rótulo acessível.
- Paginação com resumo do intervalo visível.
- Clique na linha cria o estado selecionado e oferece ação contextual; linhas canceladas usam estado inativo.

### Modal de edição

Os campos são agrupados por tarefa: identificação, empresa/equipe e custos da atividade. O bloco financeiro exibe Custo M.O, Custo Material, Custo Total, Custo Evitado e GAP. Os valores são apresentados em moeda com duas casas decimais; Custo Evitado acompanha automaticamente Custo M.O. O GAP equivale a `Custo M.O − (valor técnico/dia × técnicos × dias)` e usa seta verde, vermelha ou neutra conforme o sinal. Os demais campos financeiros históricos não aparecem no formulário e são preservados na edição. O modal usa foco inicial, fechamento por `Esc`, rótulos visíveis e botões consistentes.

### Calculadora de serviços

Cada linha da listagem começa com um botão de calculadora. A modal usa três áreas: catálogo pesquisável de `SERVICOS.xlsx`, lista de itens escolhidos com valor unitário/quantidade inteira/subtotal e resumo do novo Custo M.O. O resumo possui campos inteiros para técnicos e dias, recalcula o custo padrão da equipe em tempo real e apresenta o GAP com seta/cor. No tablet, o resumo ocupa uma faixa inferior; no celular, os três blocos são empilhados. Salvar recalcula o custo da linha exata e mantém a memória dos itens na aba `Calculo_Servicos`. Com a lista vazia, o custo padrão da equipe é exibido, o GAP fica neutro e o cálculo pode ser salvo normalmente.

### Mobile

- Topbar de 60 px com menu, marca e usuário.
- Sidebar vira drawer com backdrop e bloqueio de rolagem.
- Cartões ficam em grade 2 × 2; gráficos passam para uma coluna.
- A tabela detalhada mantém a semântica HTML, mas cada linha se apresenta como cartão com rótulos por campo.
- O modal ocupa a base da tela e seus campos passam de duas para uma coluna abaixo de 420 px.

## Sistema de design

### Cores

| Token | Valor | Uso |
|---|---:|---|
| `--color-primary` | `#DD7FD4` | Topbar e identidade |
| `--color-primary-strong` | `#7A2F73` | Botões, links e foco |
| `--color-primary-soft` | `#FBEAF8` | Seleção e superfícies de destaque |
| `--color-bg` | `#F6F4F7` | Fundo da aplicação |
| `--color-surface` | `#FFFFFF` | Cartões, tabela e modal |
| `--color-border` | `#E5DFE6` | Divisores e bordas |
| `--color-text` | `#18151A` | Texto principal |
| `--color-text-soft` | `#625B65` | Texto secundário |
| sucesso | `#167447` / `#E8F7EF` | Concluído e GAP positivo |
| aviso | `#946200` / `#FFF4D6` | Planejado e em andamento |
| erro | `#B4233B` / `#FCE8EC` | Risco, erro e GAP negativo |
| neutro | `#596274` / `#EEF0F4` | Inativo e cancelado |

O texto escuro usado sobre `#DD7FD4` evita depender de branco com contraste baixo. Badges combinam texto escuro e fundo suave para manter leitura em tamanhos compactos.

### Tipografia

- Família: `Inter`, com fallback para `Segoe UI`, `Roboto`, `Helvetica` e `Arial`.
- Pesos: 500 para conteúdo, 650–700 para controles, 750–800 para títulos e métricas.
- Escala: 10, 11, 12, 14, 15, 20, 26 e 34 px.
- Números financeiros usam alinhamento à direita; IDs usam fonte monoespaçada.

### Espaçamento e forma

- Escala base: 4, 8, 12, 16, 20, 24, 32 e 40 px.
- Radius: 8 px para controles, 12 px para painéis e 18 px para modal.
- Bordas: 1 px, neutras e contínuas.
- Sombra pequena em painéis e média somente no modal/toast.
- Ícones: traço de 1.8–2 px no padrão Feather/Lucide, incorporados como SVG para evitar dependência externa.

## Inventário de componentes

| Componente | Comportamento |
|---|---|
| Topbar | Fixa, com cor obrigatória e estado de sincronização |
| Sidebar | Fixa no desktop; drawer com overlay no mobile |
| Card de métrica | Custo M.O, Material, Total e GAP com comparação ao período anterior |
| Painel | Cabeçalho padrão, conteúdo e borda leve |
| Tabela | Cabeçalho ordenável, hover, seleção, estado inativo e ação por linha |
| Badge | Variantes `success`, `warning`, `error`, `info` e `neutral` |
| Filtros | Busca com debounce, selects por status/tipo e período mensal ou personalizado |
| Paginação | Anterior/próxima, janela de páginas e `aria-current` |
| Modal | Inclusão/edição em três seções, opções lidas do Excel e total calculado ao digitar |
| Calculadora de serviços | Botão por linha, catálogo pesquisável, inclusão por `+`, quantidade, remoção, total e persistência vinculada à atividade |
| Gráfico analítico | Ranking por tipo, técnico e empresa com quantidade, custo ou GAP |
| Configurações | Login administrativo, custo mensal/dias úteis, cadastros editáveis e upload das bases de Serviços e Materiais |
| Toast | Confirmação ou erro com região `aria-live` |
| Estado vazio | Mensagem objetiva sem quebrar a estrutura da tabela |
| Atualizar | Relê dashboard ou listagem diretamente do Excel e mostra progresso |
| Encerrar | Confirma a intenção, encerra somente o servidor local e exibe estado final |

Classes de estado previstas: `.row--hover`, `.row--selected`, `.row--disabled`, `.badge--success`, `.badge--warning`, `.badge--error`, `.badge--info` e `.badge--neutral`.

## Responsividade

- `>= 1200 px`: quatro métricas, dashboard em duas colunas e sidebar de 244 px.
- `768–1199 px`: métricas em 2 × 2, dashboard em uma coluna e sidebar de 216 px.
- `< 768 px`: sidebar overlay, tabela em cartões, ações compactas e modal tipo bottom sheet.
- `< 420 px`: formulários e legenda em uma coluna.

## Acessibilidade

- Estrutura com `header`, `aside`, `nav`, `main`, `section`, `article`, `table`, `thead`, `tbody`, `th scope="col"` e `dialog`.
- Link “Ir para o conteúdo principal”.
- Botões de ícone com `aria-label` e `title`.
- Ordenação exposta por `aria-sort`; paginação com `aria-current`.
- Estado selecionado exposto por `aria-selected`.
- Toast e salvamento usam regiões `aria-live`.
- Foco visível de 3 px, contraste mínimo AA e respeito a `prefers-reduced-motion`.
- A cor nunca é o único sinal: badges trazem texto e os cálculos exibem valor/sinal.

## Arquitetura de front-end

```text
web/
├── index.html              Dashboard semântico
├── atividades.html         Listagem e modal
└── static/
    ├── app.css             Tokens e componentes
    ├── app.js              API, filtros, tabela e modal
    ├── logo-mark.svg       Marca vetorial
    ├── favicon.svg         Favicon moderno
    └── favicon.ico         Site legado e executável Windows
```

O CSS usa custom properties e componentes com nomes de responsabilidade clara. O JavaScript não depende de framework. Para React ou Vue, cada painel, filtro, tabela, linha, badge e seção do modal pode virar componente sem alterar o contrato da API.

## Notas de implementação e testes

- Escape de conteúdo vindo do Excel antes de inserir HTML.
- Validação repetida no servidor e limite de tamanho no corpo da requisição.
- Gráficos em CSS/HTML, sem biblioteca externa e sem bloqueio por CDN.
- Cache desabilitado na API; arquivos estáticos usam cache curto.
- Testes de usabilidade: localizar uma atividade em até 15 segundos, filtrar status, abrir edição, compreender a fórmula e confirmar persistência.
- Testes técnicos: 320, 768, 1199 e 1440 px; teclado completo; zoom de 200%; redução de movimento; arquivo Excel bloqueado; aba ausente; duplicidade de nome; edição concorrente.
- Próxima evolução para alto volume: banco transacional e trilha de auditoria, mantendo o Excel como sincronização/importação.
