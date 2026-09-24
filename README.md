# B2B CTACUSTOS

Aplicação local e responsiva para consultar e editar atividades armazenadas em Excel. Inclui dashboard, lista detalhada, filtros, ordenação, paginação, modal de edição, cálculos financeiros, descoberta automática de pastas OneDrive sincronizadas e configuração para gerar executável Windows. Não utiliza Microsoft Graph, Azure AD nem API de nuvem.

## Recursos atuais

- Dashboard iniciado sempre no mês atual, com seleção por mês, intervalo de datas e tecnologia.
- Comparação automática com o mês anterior ou com o intervalo anterior de mesma duração.
- KPIs de Custo Serviços, Custo Material, Custo Total e GAP.
- Blocos mensais de Implantação, Reparo e Ativação, cada um com Serviços, Materiais, Custo Total, GAP, quantidade de técnicos e valor da equipe.
- Gráficos por tipo de atividade, técnico e empresa, alternando quantidade, custo e GAP.
- Tabelas de resumo por tipo de atividade e tecnologia, com totais de Serviços e GAP do período filtrado.
- Filtros por mês ou intervalo de datas na página Atividades, aplicados também à exportação.
- Exportar Excel em uma versão resumida, com colunas fixas e formatação profissional, incluindo DRAFT.
- Campo DRAFT ao final da listagem e nos formulários de inclusão e edição.
- Inclusão e edição pelo mesmo formulário, com opções de status, empresa, EPS e técnico administradas no próprio aplicativo.
- Calculadora em duas abas, Materiais e Serviços, aberta pelo ícone antes de cada atividade e já vinculada ao registro correto.
- Catálogos lidos de `MATERIAIS.xlsx` e `SERVICOS.xlsx`, com seleção de itens, quantidades, subtotais, total de material e total de serviços.
- Página Configurações protegida por login, com custo mensal, mês, dias úteis, total de técnicos por categoria e cálculo automático do custo técnico/dia.
- Cadastros para incluir, alterar ou excluir Status, Tipos de atividade, Tecnologias com valor de serviço, Técnicos, Empresas e EPS, salvos na aba `Config`.
- Nos formulários de inclusão e edição, tecnologias configuradas preenchem o Custo Serviço automaticamente; ao selecionar `ERB`, o campo é liberado para receber o resultado de uma calculadora externa e o Custo Total é recalculado.
- Descoberta automática das três planilhas pelo nome nas pastas OneDrive/SharePoint sincronizadas, sem Microsoft Graph.
- Botões Atualizar e Encerrar em todas as áreas principais.

### Preservação da tabela ao incluir

Ao atualizar uma atividade, somente os valores das células correspondentes são alterados. Ao incluir, o aplicativo copia a formatação da última linha, mantém os formatos numéricos e amplia o intervalo da Tabela do Excel para abranger a nova linha. Para evitar conflitos de gravação, feche a planilha no Excel antes de incluir, editar ou salvar configurações.

A coluna `DRAFT` é preservada na base e criada ao final, quando ausente, na primeira gravação. O botão **Exportar Excel** gera uma versão resumida estável com ID, data, atividade, status, situação, tecnologia, empresa, EPS, matrícula, técnico, custos, quantidades, GAP e DRAFT. O arquivo exportado possui cabeçalho formatado, tabela com filtros, linhas alternadas, painel congelado e formatos próprios para datas, moeda e números. A exportação respeita os filtros ativos — inclusive mês ou intervalo de datas — sem depender da paginação e sem modificar o arquivo original.

As telas principais oferecem **Atualizar**, que relê os dados do arquivo Excel, e **Encerrar**, que finaliza o servidor local e libera a porta. O encerramento exige confirmação e só é aceito a partir do próprio computador.

## Executar o protótipo

No PowerShell, dentro desta pasta:

```powershell
py -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python app.py
```

Abra `http://127.0.0.1:8765`. O aplicativo abre o navegador automaticamente. Para evitar isso, use `python app.py --no-browser`.

Por segurança, o repositório não versiona arquivos `.xlsx` ou `.xlsm`. Antes de executar, sincronize a pasta compartilhada do OneDrive e configure o nome da base no `.env`.

## Configurar o Excel compartilhado

O sistema localiza a fonte por **nome do arquivo** e **nome exato da aba**, conforme solicitado.

### Funcionamento recomendado: pasta compartilhada sincronizada

1. Compartilhe a pasta no OneDrive/SharePoint.
2. Cada usuário sincroniza essa pasta no Windows.
3. Deixe `EXCEL_PATH=` e `EXCEL_SEARCH_ROOTS=` vazios no `.env`.
4. Configure apenas `EXCEL_FILENAME` e `EXCEL_SHEET_NAME`.

O aplicativo detecta os OneDrives pessoais e corporativos do usuário pelas variáveis do Windows, pelo Registro e pelas pastas `OneDrive*` do perfil. Inclui também os pontos locais de bibliotecas SharePoint registrados pelo cliente de sincronização, mesmo quando estão fora de uma pasta `OneDrive*`. Depois pesquisa recursivamente o arquivo pelo nome. Assim, o mesmo `.exe` e o mesmo `.env` funcionam para usuários com nomes e caminhos diferentes.

Configurações antigas que ainda usam `EXCEL_FILE_NAME` continuam compatíveis. Se `EXCEL_SEARCH_ROOTS` estiver vazio, apontar para uma pasta inexistente ou ainda contiver os textos de exemplo `SEU_USUARIO`/`SUA EMPRESA`, o aplicativo ignora essa configuração e procura automaticamente nos OneDrives sincronizados do usuário.

A base operacional também pode usar os cabeçalhos `Obra Executada`, `Status Obra`, `Detalhes Obra`, `Custo Material`, `Vol. Técnicos`, `Tempo Execução` e `Data`; o aplicativo os converte automaticamente para os campos exibidos na interface. Nesse formato, o custo total é tratado como a soma direta de `Custo Material` e `Custo MO` quando for recalculado.

Na primeira execução, Status, Tipos de atividade, Tecnologias, Técnicos, Empresas e EPS são sugeridos a partir dos registros existentes. Depois que a página Configurações for salva, a aba `Config` passa a ser a fonte desses seis cadastros. Excluir uma opção não altera o histórico da aba `Atividades`; apenas remove a opção dos novos formulários.

### Acesso administrativo e bases da calculadora

Copie `.env.example` para `.env` e defina `ADMIN_USERNAME` e uma senha exclusiva em `ADMIN_PASSWORD` antes de iniciar ou distribuir o aplicativo. O arquivo `.env` é local, está ignorado pelo Git e não deve ser publicado. A sessão permanece apenas enquanto o navegador e o aplicativo estiverem abertos.

A base principal e as duas bases da calculadora são localizadas independentemente pelo nome, usando a mesma descoberta de pastas sincronizadas. Os nomes padrão são `B2B_CTACUSTOS.xlsx`, `SERVICOS.xlsx` e `MATERIAIS.xlsx`. Não é necessário enviar arquivos pela página Configurações nem manter uma pasta de importações.

Serviços aceita `CODIGO`, `SERVICO`, `CUSTO_UNITARIO` e `UNIDADE`. Materiais aceita `Mat_Code`, `Material`, `Unidade` e `Valor`. Código pode ficar vazio nas duas bases. Os nomes, abas e caminhos podem ser ajustados pelas variáveis `SERVICES_*` e `MATERIALS_*`; a comparação do nome da aba ignora maiúsculas, acentos e pontuação. Se o arquivo tiver uma única aba, ela será usada automaticamente.

A busca também aceita `MATERIAL.xlsx`, `SERVIÇOS.xlsx` e as mesmas variantes em `.xlsm`. Nomes alternativos podem ser definidos em `MATERIALS_EXCEL_FILENAME_ALIASES` e `SERVICES_EXCEL_FILENAME_ALIASES`, separados por `;`. O nome principal tem prioridade. Um caminho absoluto antigo em `SERVICES_EXCEL_PATH` ou `MATERIALS_EXCEL_PATH` não interrompe a busca quando não existe no computador atual. Arquivos no SharePoint precisam estar sincronizados com este computador pelo OneDrive, visíveis no Explorador de Arquivos e disponíveis localmente; um link de compartilhamento ou arquivo disponível apenas no navegador não é acessado sem uma API de nuvem. A base principal deste projeto permanece `B2B_CTACUSTOS.xlsx`, aba `Atividades`; `ATIVACAO.xlsx` com outro esquema não a substitui.

Para validar uma nova máquina, abra a biblioteca compartilhada no Explorador de Arquivos e confirme que as três planilhas aparecem localmente. Se estiverem somente na seção “Compartilhado” do site, use **Sincronizar** ou **Adicionar atalho ao Meu OneDrive** no SharePoint e aguarde o cliente do OneDrive concluir. Marque os arquivos como **Sempre manter neste dispositivo**. Para um `.env` portátil, deixe `EXCEL_PATH=`, `SERVICES_EXCEL_PATH=` e `MATERIALS_EXCEL_PATH=` vazios. Se houver duas cópias com o mesmo nome, informe o caminho correto para eliminar a ambiguidade.

É possível restringir a procura a várias raízes em `EXCEL_SEARCH_ROOTS`, separadas por `;` no Windows. Se houver mais de uma cópia com o mesmo nome, o aplicativo interrompe a inicialização e mostra os caminhos encontrados, evitando gravar silenciosamente no arquivo errado.

### Caminho manual

Preencha `EXCEL_PATH` somente quando quiser usar um caminho completo ou relativo específico. Essa opção tem prioridade sobre a descoberta automática:

```ini
EXCEL_PATH=C:\Users\USUARIO\OneDrive - Empresa\Pasta Compartilhada\B2B_CTACUSTOS.xlsx
```

Mantenha `EXCEL_FALLBACK_SAMPLE=false` para exigir a base compartilhada. Se precisar de uma base local de testes, informe seu caminho em `EXCEL_PATH`; arquivos Excel dentro de `data/` permanecem ignorados pelo Git.

## Estrutura esperada da aba `Atividades`

| Coluna | Campo |
|---|---|
| A–D | ID, Tipo de Atividade, Status, Situação |
| E–H | Material Utilizado, Cod. Material, Quantidade, Custo Mat |
| I–K | Serviço M.O, Qtde Serviço, Custo M.O |
| L–R | Custo Total, Custo Evitado, Custo Técnico / Dia, Qtde Técnicos, Qtde Dias, Custo por Técnico, GAP |
| S | Atualizado Em |
| T | DRAFT (opcional; criado ao final quando ausente) |

Os nomes podem variar em acentos, espaços ou pontuação, mas os quatro primeiros campos são obrigatórios. A base operacional existente também é aceita pelos aliases de cabeçalhos descritos acima; a ordem das colunas não precisa seguir este exemplo.

## Regras de cálculo

```text
Custo de materiais = Custo Material consolidado
Custo de serviços = valor cadastrado para a tecnologia escolhida
Custo Total = Custo Material + Custo Serviços
Custo Evitado = Custo Serviços
Valor mensal da equipe da categoria = Custo mensal do técnico × Total de técnicos da categoria
GAP da categoria = Total de Serviços da categoria − Valor mensal da equipe da categoria
```

O formulário comum de inclusão e edição usa uma lista de tecnologias administrada em Configurações. Ao escolher uma tecnologia, o valor correspondente preenche `Custo Serviço`, e `Custo Total` soma esse valor ao material. O formulário não calcula técnicos × dias: o GAP é consolidado no Dashboard por Implantação, Reparo e Ativação. Os campos técnicos históricos ocultos são preservados nas edições. A calculadora detalhada de materiais e serviços mantém sua própria regra de equipe e memória de itens.

O custo diário padrão é calculado por `Custo mensal do técnico ÷ Dias úteis do mês`. O valor inicial é R$ 15.000,00 e a contagem automática considera segunda a sexta; os dias úteis podem ser ajustados manualmente para feriados.

### Calculadora de materiais e serviços

Na página Atividades, o botão de calculadora aparece antes do ID. A primeira aba apresenta o catálogo de materiais, os itens escolhidos e o novo Custo Material. A segunda aba recebe esse total, apresenta os serviços e o novo Total de Serviços. O painel detalhado permite informar técnicos e dias, atualiza `custo técnico/dia × técnicos × dias` imediatamente e mostra `GAP = Serviços − custo da equipe` com indicação visual. Quantidades de materiais aceitam frações; quantidades de serviços aceitam apenas inteiros como `1`, `2`, `1000` ou `3000`. Ao salvar:

1. `Custo Material` recebe a soma dos materiais e os campos descritivos da base são consolidados.
2. `Custo MO` recebe a soma dos serviços ou, sem serviços, o custo padrão da equipe.
3. `Custo Total` é recalculado com `Custo Material + Custo MO` e `Custo Evitado` recebe o mesmo valor de `Custo MO`.
4. Técnicos, dias e as memórias detalhadas são gravados nas abas `Calculo_Materiais` e `Calculo_Servicos`.

Ao usar **Limpar**, o botão Salvar permanece disponível. Sem serviços selecionados, `Custo MO` recebe o custo padrão da equipe: `custo técnico/dia × quantidade de técnicos × quantidade de dias`.

O vínculo interno combina a linha com o ID da atividade. Portanto, mesmo que o arquivo possua IDs repetidos, a edição e a calculadora atualizam exatamente a linha selecionada. Se as linhas forem movidas externamente enquanto a janela estiver aberta, o aplicativo pede para atualizar a lista antes de salvar.

## Gerar o executável Windows

Execute:

```powershell
python build_exe.py
```

O script cria automaticamente a pasta `.venv`, instala as dependências e gera
o aplicativo sem abrir uma janela de console. Em builds seguintes, quando as
dependências já estiverem instaladas, pode ser usado:

```powershell
python build_exe.py --skip-install
```

O comando anterior `./build_exe.ps1` continua disponível.

O resultado fica em `dist/B2B_CTACUSTOS/`. O ícone `web/static/favicon.ico` é aplicado ao executável e o mesmo símbolo aparece como favicon no site. A base compartilhada é localizada nas pastas sincronizadas do usuário, conforme o `.env`; nenhum Excel real deve ser publicado no GitHub.

## API interna

- `GET /api/health`: conexão e fonte ativa.
- `GET /api/dashboard`: métricas, comparação e resumos por atividade/tecnologia; filtros `month`, `start`, `end` e `technology`.
- `GET /api/activities`: filtros `q`, `status`, `type`, `technology`, `sort`, `direction`, `page` e `per_page`.
- `GET /api/activities/export`: baixa a versão resumida formatada com colunas fixas e os filtros ativos.
- `POST /api/activities`: inclui uma atividade e amplia a tabela formatada do Excel.
- `PUT /api/activities/{referência}`: valida e atualiza a linha exata da atividade.
- `GET /api/service-calculation?activity={referência}`: carrega catálogo, atividade e cálculo já salvo.
- `POST /api/service-calculation?activity={referência}`: salva os itens, atualiza o Custo Serviço na coluna compatível do Excel e recalcula Custo Total.
- `POST /api/admin/login` e `POST /api/admin/logout`: controlam a sessão administrativa local.
- `GET/POST /api/settings`: consulta ou salva indicadores e cadastros; exige login administrativo.
- `POST /api/shutdown`: encerra o servidor; disponível apenas em localhost.

## Testes

```powershell
py -m unittest discover -s tests -v
```

Teste também o arquivo compartilhado com dois usuários. A gravação respeita o bloqueio do Excel e informa quando o arquivo está aberto para edição. Para concorrência intensa e auditoria centralizada, o próximo passo recomendado é uma API com banco de dados, mantendo o Excel como importação/exportação.

Consulte `ESPECIFICACAO_UI_UX.md` para tokens, componentes, estados responsivos e critérios de acessibilidade.
