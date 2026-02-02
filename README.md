# Servidor MCP: mcp-academia-server

- [repo rag: git/ti2](https://git.c.net.br/gogs_supper_admin/rag-academia-server) | [github](https://github.com/TiagoTi/rag-academia-server)
- [repo: git/ti2](https://git.ti2.net.br/gogs_supper_admin/mcp-academia-server) | [github](https://github.com/TiagoTi/mcp-academia-server)

Quando começei pesquisar sobre, a maioria dos tutoriais explicavam com executar
o servidor mcp dentro de um script com outros componente, como o código que conecta
a uma llm, o arquivo `via-stdio.ts` é uma extração desse exemplo.

Por outro lado, como engenheiro de software fiquei imaginando como eu podeira fazer para
usar o mesmo servidor em mais de uma solução então o arquivo index.ts é um exeplo que utiliza o conceito:
Servidor MCP Centralizado via HTTP/SSE

## Desenvolvimento

### Executando teste 

```sh
bun run cliente.ts
```


## Gerando publicação via docker

### criando a imagem

```sh
docker image build \
    --pull -t mcp-server-academia .
```

### executando

```sh
docker run --restart=always --name mcp-server-academia  -d -p 3401:3000 mcp-server-academia
```

## O que ess MCP Especificamente Faz?

Baseado no código e na resposta do tools/list, o servidor MCP é especializado em gerenciamento e consulta de exercícios de academia. Ele oferece as seguintes ferramentas (copiadas da resposta do curl para clareza):

buscar_exercicios_por_grupo:

Descrição: Busca exercícios filtrando por grupo muscular.
Grupos disponíveis: Costas (dorsais, lombar), Ombros (deltoides), Pernas, Peito (peitoral), Braços (Bíceps, Tríceps, Antebraço).
Entrada: {"grupo_muscular": "string"} (ex: "Pernas").
Saída: Lista de exercícios com séries, repetições, intervalo e observações.
listar_grupos_musculares:

Descrição: Lista todos os grupos musculares disponíveis no banco de dados.
Entrada: Nenhuma (objeto vazio).
Saída: Lista de grupos (ex: "- Pernas\n- Peito (peitoral)\n...").
buscar_exercicio_por_nome:

Descrição: Busca exercícios por nome (busca parcial, case-insensitive).
Entrada: {"nome": "string"} (ex: "agachamento").
Saída: Detalhes dos exercícios encontrados, incluindo ID, grupo, séries, etc.
listar_todos_exercicios:

Descrição: Lista todos os exercícios cadastrados, agrupados por grupo muscular.
Entrada: Nenhuma.
Saída: Lista completa, organizada por grupos.
obter_detalhes_exercicio:

Descrição: Obtém detalhes completos de um exercício específico pelo ID.
Entrada: {"id": number} (ex: 1).
Saída: Informações detalhadas (nome, grupo, séries, repetições, intervalo, observações).

