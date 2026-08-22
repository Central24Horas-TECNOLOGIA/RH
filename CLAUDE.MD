# Diretrizes de Desenvolvimento

Este documento define as regras permanentes para qualquer implementação neste projeto.

Todo código gerado deve seguir estas diretrizes.

Caso exista conflito entre código existente e estas diretrizes, priorize preservar a arquitetura definida no SYSTEM.md.

---

# Objetivo

O objetivo é construir uma plataforma robusta, modular e escalável para monitoramento de Contact Centers.

Toda implementação deve priorizar:

- simplicidade;
- modularidade;
- legibilidade;
- desempenho;
- baixo consumo de memória;
- baixo consumo de CPU;
- facilidade de manutenção;
- facilidade de expansão.

---

# Antes de Implementar

Antes de escrever qualquer código:

1. Leia o SYSTEM.md.
2. Compreenda o fluxo envolvido.
3. Identifique os módulos afetados.
4. Analise impactos.
5. Apresente um plano de implementação.
6. Aguarde aprovação.

Nunca implemente diretamente sem análise prévia.

---

# Arquitetura

A arquitetura definida no SYSTEM.md é a referência oficial.

Nunca altere a arquitetura sem solicitação explícita.

Nunca altere contratos públicos.

Nunca altere fluxos existentes apenas para simplificar código.

---

# Implementação

Toda implementação deve seguir os princípios abaixo.

## Responsabilidade Única

Cada arquivo deve possuir apenas uma responsabilidade.

Cada classe deve possuir apenas uma responsabilidade.

Cada função deve possuir apenas uma responsabilidade.

---

## Modularidade

Evite arquivos grandes.

Prefira dividir funcionalidades em módulos menores.

Se um arquivo começar a concentrar múltiplas responsabilidades, proponha sua divisão.

---

## Acoplamento

Mantenha baixo acoplamento entre módulos.

Evite dependências desnecessárias.

Um módulo nunca deve conhecer detalhes internos de outro módulo.

---

## Reutilização

Nunca duplique código.

Sempre reutilize funções existentes quando possível.

Caso não exista uma implementação reutilizável, crie uma.

---

# Estrutura

Sempre respeite a estrutura do projeto.

Não mova arquivos sem necessidade.

Não renomeie módulos públicos.

Não altere nomes de configurações já existentes.

---

# Configuração

Nenhum valor deve ficar fixo no código.

Todo parâmetro configurável deve permanecer externo.

Exemplos:

- URLs
- Endpoints
- Credenciais
- Intervalos
- Timeouts
- Queues
- Tokens

---

# APIs

Toda integração externa deve ocorrer através de Connectors.

Nunca realize chamadas HTTP diretamente em Workers, Services ou Rotas.

A lógica de autenticação deve permanecer isolada.

---

# Workers

Workers executam apenas:

- solicitar dados;
- processar;
- atualizar informações.

Workers não devem:

- autenticar;
- conhecer URLs;
- conhecer payloads;
- conhecer detalhes da API.

---

# Tratamento de Erros

Toda exceção deve ser tratada.

Nunca silencie erros.

Sempre registre informações suficientes para diagnóstico.

Uma falha nunca deve interromper os demais Workers.

---

# Performance

Priorize:

- baixo consumo de memória;
- baixo consumo de CPU;
- poucas alocações;
- reutilização de objetos;
- processamento assíncrono.

Evite processamento desnecessário.

---

# Código

Sempre produza código:

- simples;
- limpo;
- legível;
- modular;
- comentado apenas quando necessário.

Prefira nomes claros.

Evite abreviações desnecessárias.

---

# Refatoração

Ao identificar problemas arquiteturais:

não implemente mudanças automaticamente.

Primeiro proponha a alteração.

Explique:

- problema;
- impacto;
- benefício.

Aguarde aprovação.

---

# Segurança

Nunca exponha:

- credenciais;
- tokens;
- secrets;
- URLs privadas.

Nunca grave informações sensíveis em logs.

---

# Dependências

Não adicione bibliotecas sem necessidade.

Sempre priorize soluções utilizando a biblioteca padrão do Python.

Quando necessário utilizar terceiros, justifique.

---

# Documentação

Sempre que criar um módulo novo:

explique rapidamente:

- objetivo;
- responsabilidade;
- integração com o restante do sistema.

---

# Restrições

Nunca:

- criar código duplicado;
- quebrar compatibilidade;
- alterar contratos;
- alterar arquitetura;
- remover funcionalidades;
- assumir comportamentos não documentados.

---

# Quando houver dúvida

Não adivinhe.

Explique a dúvida.

Proponha alternativas.

Aguarde confirmação.

---

# Prioridade

Sempre seguir esta ordem:

1. Arquitetura
2. Estabilidade
3. Compatibilidade
4. Desempenho
5. Legibilidade
6. Facilidade de manutenção

Nunca sacrifique a arquitetura apenas para reduzir linhas de código.

# TV Monitoring Engine

## Visão Geral

O TV Monitoring Engine é um sistema responsável por coletar dados de múltiplas plataformas de Contact Center, processar essas informações, consolidá-las e disponibilizá-las para painéis de TV em tempo real. O sistema opera continuamente (24x7), executando diversas rotinas paralelas de extração de dados. Cada rotina possui seu próprio intervalo de execução, mas todas convergem para um único ponto de consolidação responsável por gerar o arquivo `data_json`, utilizado pelos painéis. A arquitetura deve ser modular, desacoplada e preparada para expansão, permitindo adicionar novas APIs, clientes, filas ou relatórios sem alterar o núcleo do sistema.

# Fluxo Geral

```
Inicialização
↓

Carrega Configurações

↓

Valida Credenciais

↓

Inicializa Workers

↓

Executa Loops Independentes

↓

Processa Dados

↓

Consolida Informações

↓

Gera data_json

↓

Painéis de TV consomem data_json
```

O backend encerra sua responsabilidade após gerar o `data_json`. Nenhum processamento adicional deve ocorrer após essa etapa.

---

# Estrutura Geral

O sistema é dividido em cinco grandes responsabilidades.

## 1. Configuração

Responsável por carregar todas as configurações do sistema.

Inclui:

- Credenciais
- URLs
- Endpoints
- Intervalos
- Queues
- Clientes
- Caminhos de arquivos
- Configurações de logs
- Configurações de cache

Toda configuração deve estar centralizada em arquivos de configuração ou banco de dados, nunca diretamente no código.

---

## 2. Workers

Cada extração funciona como um Worker independente.

Os Workers não dependem entre si.

Caso um Worker apresente erro, os demais continuam executando normalmente.

Cada Worker possui seu próprio tempo de execução.

### Worker Talkdesk

Executa a cada 5 minutos.

Fluxo:

Valida Token

↓

Consulta APIs Talkdesk

↓

Processa dados

↓

Atualiza JSON intermediário

↓

Aguarda próximo ciclo

---

### Worker Endoview

Executa a cada 10 minutos.

Fluxo:

Valida Token

↓

Solicita relatório

↓

Processa relatório

↓

Separa informações

↓

Atualiza JSON intermediário

↓

Aguarda próximo ciclo

---

### Worker Genesys

Executa a cada 20 segundos.

Fluxo:

Valida Token

↓

Consulta API Genesys

↓

Processa dados

↓

Atualiza JSON intermediário

↓

Aguarda próximo ciclo

---

# Token Manager

Todas as autenticações devem ser centralizadas.

Nenhum Worker deve implementar autenticação própria.

O Token Manager é responsável por:

- solicitar novos tokens
- reutilizar tokens válidos
- renovar tokens expirados
- controlar tempo de expiração
- evitar múltiplas autenticações simultâneas
- tratar falhas de autenticação

Cada API pode possuir um método diferente de autenticação.

O restante do sistema não precisa conhecer esses detalhes.

---

# Processamento

Cada Worker possui sua própria lógica de tratamento.

Independentemente da origem dos dados, todos devem seguir o mesmo fluxo.

```
API

↓

Validação

↓

Tratamento

↓

Normalização

↓

JSON intermediário
```

O objetivo é padronizar os dados antes da consolidação.

---

# Consolidador

Após todos os Workers atualizarem seus respectivos arquivos intermediários, o sistema executa a consolidação.

A consolidação é responsável por:

- ler todos os JSONs intermediários
- unir as informações
- aplicar regras de negócio
- remover inconsistências
- gerar o arquivo único `data_json`

O `data_json` representa o contrato oficial entre backend e frontend.

---

# data_json

Este arquivo contém todas as informações consumidas pelos painéis.

Nenhum painel deve acessar diretamente APIs externas.

Nenhum painel deve acessar JSONs intermediários.

Toda leitura deve ocorrer exclusivamente através do `data_json`.

---

# Interface Administrativa

O sistema deve possuir uma interface WEB para administração.

A interface deve permitir:

- iniciar ou parar Workers
- visualizar status dos Workers
- visualizar logs
- visualizar tempo da última execução
- visualizar tempo de resposta
- editar configurações
- editar endpoints
- editar credenciais
- editar intervalos
- visualizar payload das APIs
- monitorar consumo de recursos

---

# Sandbox

O sistema deve possuir um ambiente de testes completamente isolado.

Neste ambiente será possível:

- testar novas APIs
- testar novos endpoints
- testar novas queues
- testar novos tratamentos
- visualizar payloads
- gerar JSONs locais
- validar novas funcionalidades

Nenhum teste realizado no Sandbox poderá afetar o ambiente de produção.

---

# Logs

Todos os módulos devem gerar logs estruturados.

Os logs devem registrar:

- início da execução
- término da execução
- erros
- autenticação
- tempo de resposta
- quantidade de registros processados
- falhas

Os logs devem possuir rotação automática para evitar crescimento infinito.

---

# Escalabilidade

O sistema deve permitir adicionar:

- novos clientes
- novas filas
- novas APIs
- novos relatórios
- novos Workers

sem necessidade de alterar o núcleo da aplicação.

Toda expansão deve ocorrer através da criação de novos módulos.

---

# Arquitetura Recomendada

```
Frontend

↓

FastAPI

↓

Scheduler

↓

Worker Manager

↓

Workers

↓

API Connectors

↓

Processamento

↓

Consolidador

↓

data_json
```

Cada camada possui responsabilidade única.

Nenhum módulo deve executar responsabilidades pertencentes a outro módulo.

---

# Objetivos

A nova arquitetura deve priorizar:

- baixo consumo de memória
- baixo consumo de CPU
- operação contínua
- fácil manutenção
- fácil expansão
- fácil monitoramento
- baixo consumo de tokens em futuras manutenções
- separação clara de responsabilidades

Toda implementação futura deverá seguir esta especificação como referência arquitetural.

# Integrações com APIs

## Visão Geral

O sistema integra-se com diferentes plataformas de Contact Center para coletar informações operacionais utilizadas pelos painéis de TV.

Cada plataforma deve ser tratada como um módulo independente, responsável exclusivamente pela comunicação com sua respectiva API.

O restante do sistema nunca deve conhecer detalhes da implementação dessas APIs.

Toda comunicação deve ocorrer através de conectores (Connectors), responsáveis por encapsular completamente a lógica de autenticação, requisições e tratamento inicial dos dados.

---

# APIs Integradas

Atualmente o sistema possui integração com as seguintes plataformas:

- Talkdesk
- Genesys

A arquitetura deve permitir adicionar novas plataformas futuramente sem alterar o restante do sistema.

Cada nova integração deve apenas implementar um novo Connector.

---

# Estrutura de um Connector

Todo Connector deve possuir a mesma responsabilidade.

```
Receber solicitação

↓

Validar autenticação

↓

Executar requisição

↓

Validar resposta

↓

Tratar erros

↓

Retornar dados normalizados
```

Nenhum Connector deve realizar regras de negócio.

Seu único objetivo é obter dados da API e devolvê-los em um formato consistente para o Worker responsável.

---

# Autenticação

Cada API pode utilizar um mecanismo diferente de autenticação.

Exemplos:

- OAuth2
- Bearer Token
- API Key
- Basic Authentication
- JWT
- Outros

A implementação da autenticação deve permanecer isolada dentro do Connector ou de um Token Manager compartilhado.

Os Workers nunca devem conhecer como a autenticação funciona.

Eles apenas solicitam dados ao Connector.

---

# Gerenciamento de Tokens

Sempre que uma API utilizar autenticação baseada em tokens, deve existir um mecanismo responsável por seu gerenciamento.

Esse mecanismo deve:

- solicitar novos tokens quando necessário;
- reutilizar tokens ainda válidos;
- renovar tokens expirados;
- controlar tempo de expiração;
- evitar autenticações desnecessárias;
- impedir múltiplas renovações simultâneas;
- tratar falhas de autenticação.

O objetivo é minimizar chamadas de autenticação e reduzir o risco de bloqueios ou limites impostos pelas APIs.

---

# Requisições

Toda comunicação com APIs deve seguir um fluxo único.

```
Preparar requisição

↓

Autenticar

↓

Executar chamada

↓

Validar resposta

↓

Converter dados

↓

Retornar resultado
```

Nenhuma requisição deve ser executada diretamente pelos Workers.

Todas devem passar obrigatoriamente pelo Connector correspondente.

---

# Tratamento de Respostas

Cada API pode retornar estruturas diferentes.

Antes que qualquer informação seja utilizada pelo sistema, ela deve ser normalizada.

O objetivo é que o restante da aplicação trabalhe sempre com um formato consistente, independentemente da origem dos dados.

A normalização deve ocorrer dentro do Connector ou em uma camada específica de transformação.

---

# Tratamento de Erros

Toda integração deve tratar adequadamente situações como:

- falha de autenticação;
- indisponibilidade da API;
- timeout;
- respostas inválidas;
- erros HTTP;
- limitação de requisições (Rate Limit);
- dados incompletos.

Falhas em uma integração nunca devem interromper os demais Workers.

Cada módulo deve ser resiliente e operar de forma independente.

---

# Timeout e Retry

As integrações devem definir tempos máximos de espera para requisições.

Caso uma chamada falhe, podem ser realizadas novas tentativas conforme política definida pelo sistema.

As tentativas devem possuir limite para evitar loops infinitos.

---

# Configuração

Nenhuma informação específica da API deve ficar fixa no código.

Todas as configurações devem ser externas.

Exemplos:

- URLs
- Endpoints
- Credenciais
- Client ID
- Client Secret
- API Keys
- Timeout
- Intervalos
- Quantidade máxima de tentativas
- Headers adicionais

Essas configurações poderão ser alteradas pela interface administrativa sem necessidade de recompilar o sistema.

---

# Payloads

Cada API possui seu próprio formato de resposta.

Os Connectors devem conhecer esse formato e convertê-lo para o modelo interno utilizado pelo sistema.

O restante da aplicação nunca deve depender diretamente do payload original da API.

Caso um fornecedor altere sua estrutura de resposta, apenas o Connector correspondente deverá ser atualizado.

---

# Evolução

A arquitetura deve permitir adicionar novas APIs seguindo sempre o mesmo padrão.

Para integrar uma nova plataforma será necessário apenas:

1. Criar um novo Connector.
2. Configurar autenticação.
3. Configurar endpoints.
4. Implementar a normalização dos dados.
5. Registrar o novo Worker, caso necessário.

Nenhum outro módulo do sistema deverá ser modificado.

---

# Princípios

Todas as integrações devem seguir os seguintes princípios:

- Isolamento.
- Baixo acoplamento.
- Alta coesão.
- Configuração externa.
- Tratamento centralizado de erros.
- Autenticação encapsulada.
- Reutilização de código.
- Facilidade de manutenção.
- Facilidade de expansão.

Essas diretrizes garantem que mudanças em uma API afetem apenas seu próprio módulo, preservando a estabilidade do restante do sistema.

# Contexto do Projeto

O TV Monitoring Engine foi concebido para centralizar toda a coleta e processamento de informações operacionais utilizadas pelos painéis de monitoramento da empresa.

Atualmente existem diversos scripts independentes responsáveis por consultar APIs distintas, processar dados específicos e gerar arquivos JSON utilizados pelos painéis de TV.

Essa arquitetura tornou-se difícil de manter devido ao alto acoplamento entre componentes, duplicação de código, dificuldade para adicionar novas integrações, ausência de um ambiente de testes e pouca visibilidade sobre o estado da aplicação.

O objetivo da nova arquitetura é transformar esse conjunto de scripts em uma única plataforma modular, capaz de executar continuamente, permitindo expansão sem necessidade de reescrever o núcleo do sistema.

O sistema deve operar de forma totalmente autônoma, iniciando automaticamente seus processos, monitorando sua própria execução e mantendo os dados sempre atualizados para consumo dos painéis.

O foco principal não é apenas executar requisições às APIs, mas criar uma plataforma preparada para suportar novos clientes, novas operações, novas filas e novas integrações ao longo do tempo.

---

# Ciclo de Vida da Aplicação

Durante sua execução, o sistema sempre seguirá o mesmo ciclo operacional.

```
Inicialização

↓

Carrega configurações

↓

Inicializa serviços

↓

Inicializa Token Manager

↓

Inicializa Scheduler

↓

Inicializa Workers

↓

Executa continuamente

↓

Monitora estado dos Workers

↓

Atualiza dados

↓

Consolida informações

↓

Disponibiliza data_json
```

Esse fluxo nunca muda.

Os Workers apenas executam indefinidamente respeitando seus respectivos intervalos.

---

# Responsabilidades

A arquitetura foi dividida em camadas para separar claramente as responsabilidades.

## Scheduler

Responsável apenas por controlar quando cada Worker será executado.

Não conhece APIs.

Não conhece regras de negócio.

Não processa dados.

Sua única responsabilidade é controlar o tempo de execução.

---

## Worker Manager

Responsável por iniciar, parar e monitorar os Workers.

Também controla o estado de cada Worker.

Exemplos:

- Executando
- Aguardando
- Erro
- Reiniciando
- Pausado

---

## Workers

Os Workers representam processos independentes responsáveis pela execução periódica das integrações.

Cada Worker conhece apenas sua própria operação.

Exemplos:

Worker Talkdesk

Worker Genesys

Worker Endoview

Um Worker nunca acessa informações de outro Worker.

---

## Connectors

Os Connectors encapsulam completamente a comunicação com APIs externas.

Eles conhecem:

- autenticação
- endpoints
- headers
- parâmetros
- paginação
- timeout
- retry
- payload

Nenhum outro módulo deve acessar APIs diretamente.

---

## Processamento

Após receber os dados da API, cada Worker executa o processamento necessário.

O processamento pode incluir:

- limpeza
- validação
- transformação
- agrupamentos
- cálculos
- normalização

O objetivo é produzir um formato interno padronizado.

---

## Consolidador

O Consolidador representa o último estágio do backend.

Ele reúne todos os dados produzidos pelos Workers.

Executa as regras finais.

Gera o arquivo `data_json`.

Nenhuma alteração deverá ocorrer após essa etapa.

---

## Interface Administrativa

A interface administrativa não participa do processamento.

Ela apenas consulta informações disponibilizadas pelo backend.

Também permite alterar configurações e acompanhar a saúde do sistema.

---

# Fluxo Completo dos Dados

Todo dado percorre exatamente o mesmo caminho.

```
API Externa

↓

Connector

↓

Autenticação

↓

Requisição

↓

Resposta

↓

Validação

↓

Normalização

↓

Worker

↓

JSON intermediário

↓

Consolidador

↓

data_json

↓

Painéis de TV
```

Essa ordem deve ser preservada independentemente da origem da informação.

---

# Comunicação Entre Componentes

Cada componente deve conhecer apenas a camada imediatamente abaixo.

Exemplo:

```
Worker

↓

Connector

↓

API
```

O Worker nunca conhece:

- OAuth
- Endpoint
- URL
- Header
- Token
- Payload

Essas informações pertencem exclusivamente ao Connector.

Da mesma forma, o Consolidador nunca conhece APIs.

Ele apenas recebe informações já processadas.

Essa separação reduz o acoplamento e facilita futuras mudanças.

---

# Persistência

O sistema utiliza arquivos JSON apenas como mecanismo de integração entre o backend e os painéis.

Esses arquivos não representam banco de dados.

Eles são apenas uma representação temporária do estado atual da operação.

O único arquivo considerado oficial é o `data_json`, utilizado pelos painéis.

Os demais arquivos são intermediários e podem ser regenerados a qualquer momento.

---

# Estratégia de Atualização

Cada Worker possui seu próprio intervalo de execução.

Os ciclos são independentes.

Não existe sincronização obrigatória entre eles.

O Consolidador sempre utiliza a versão mais recente disponível de cada conjunto de dados.

Isso garante que uma falha temporária em uma API não interrompa a atualização das demais informações.

---

# Estado do Sistema

O backend deve sempre conhecer o estado atual de cada componente.

Exemplos:

- Inicializando
- Executando
- Aguardando
- Erro
- Reiniciando
- Finalizado

Essas informações serão utilizadas tanto para monitoramento quanto pela interface administrativa.

---

# Escalabilidade

Toda nova funcionalidade deve seguir exatamente a mesma arquitetura existente.

Ao adicionar uma nova API, o fluxo esperado será:

```
Novo Connector

↓

Novo Worker

↓

Novo processamento

↓

Novo JSON intermediário

↓

Consolidador

↓

data_json
```

Nenhum outro componente deverá sofrer alterações estruturais.

Esse princípio garante que o crescimento do sistema ocorra por extensão e não por modificação do núcleo.

# Princípios de Implementação

Toda implementação deverá seguir os seguintes princípios:

- O sistema deve operar continuamente (24x7).
- Nenhum Worker deve bloquear outro Worker.
- Toda integração externa deve ser isolada.
- Nenhuma regra de negócio deve existir dentro dos Connectors.
- Toda configuração deve ser externa ao código.
- Toda autenticação deve ser centralizada.
- Toda comunicação entre módulos deve ocorrer através de interfaces bem definidas.
- Toda exceção deve ser tratada e registrada.
- O sistema deve continuar operando mesmo com falha parcial de uma integração.
- O consumo de memória deve permanecer estável durante execuções prolongadas.
- Novos módulos devem ser adicionados sem modificar a arquitetura existente.
- A documentação é a referência oficial para o comportamento esperado do sistema.
