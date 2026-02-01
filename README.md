# Servidor MCP: mcp-academia-server

Quando começei pesquisar sobre, a maioria dos tutorias explicavam com executar
o servidor mcp dentro de um script com outras componente, como o código que conecta
a uma llm, o arquivo `via-stdio.ts` é uma extração desse exemplo.

Por outro lado, como engenheiro de software fiquei imaginando como eu podeira fazer para
usar o mesmo servidor em mais de uma solução então o arquivo index.ts é um exeplo que utiliza o conceito:
Servidor MCP Centralizado via HTTP/SSE

## Desenvolvimento

### Executando via http

```http
curl -X POST http://localhost:3000 -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
```

### Executando via stdio

```sh
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | bun run via-stdio.ts
```

## Gerando publicação via docker

### criando a imagem

```sh
docker image build --pull -t mcp-server-academia .
```

### executando

```sh
docker container run --rm --name mcp-server-academia  -d -p 3000:3000 mcp-server-academia
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

```json
{
    "tools": [
        {
            "name": "buscar_exercicios_por_grupo",
            "description": "Busca exercícios filtrando por grupo muscular. Grupos disponíveis: 'Costas (dorsais, lombar)', 'Ombros (deltoides)', 'Pernas', 'Peito (peitoral)', 'Braços (Bíceps, Tríceps, Antebraço)'",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "grupo_muscular": {
                        "type": "string",
                        "description": "Nome do grupo muscular (ex: 'Pernas', 'Peito (peitoral)')"
                    }
                },
                "required": [
                    "grupo_muscular"
                ]
            }
        },
        {
            "name": "listar_grupos_musculares",
            "description": "Lista todos os grupos musculares disponíveis no banco de dados",
            "inputSchema": {
                "type": "object",
                "properties": {}
            }
        },
        {
            "name": "buscar_exercicio_por_nome",
            "description": "Busca exercícios específicos por nome (busca parcial, case-insensitive)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "nome": {
                        "type": "string",
                        "description": "Nome ou parte do nome do exercício (ex: 'agachamento', 'supino')"
                    }
                },
                "required": [
                    "nome"
                ]
            }
        },
        {
            "name": "listar_todos_exercicios",
            "description": "Lista todos os exercícios cadastrados no banco de dados",
            "inputSchema": {
                "type": "object",
                "properties": {}
            }
        },
        {
            "name": "obter_detalhes_exercicio",
            "description": "Obtém detalhes completos de um exercício específico pelo ID",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "number",
                        "description": "ID do exercício"
                    }
                },
                "required": [
                    "id"
                ]
            }
        }
    ]
}
```

### Exemplo de uma possivel chamada do clientes

```http
curl -X POST http://localhost:3000 -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "buscar_exercicios_por_grupo",
    "arguments": {"grupo_muscular": "Pernas"}
  }
}'
```

```json
{
    "content": [
        {
            "type": "text",
            "text": "Encontrados 8 exercícios para Pernas:\n\n**Agachamento livre - Exercício composto para quadríceps, glúteos e posterior**\n- Séries: 4\n- Repetições: 8\n- Intervalo: 90s\n- Observações: carga a definir\n\n**Extensora drop 10-10-10 - Exercício isolado para quadríceps com técnica drop set**\n- Séries: 4\n- Repetições: 8\n- Intervalo: 90s\n- Observações: carga a definir\n\n**Agachamento triângulo halteres - Agachamento com halteres em posição triângulo**\n- Séries: 4\n- Repetições: 8\n- Intervalo: 90s\n- Observações: carga a definir\n\n**Afundo - Exercício para quadríceps, glúteos e posterior**\n- Séries: 4\n- Repetições: 8\n- Intervalo: 90s\n- Observações: carga a definir\n\n**Mesa flexora - Exercício para posterior de coxa (isquiotibiais)**\n- Séries: 4\n- Repetições: 8\n- Intervalo: 90s\n- Observações: carga a definir\n\n**Abdutora - Exercício para glúteos médios e mínimo**\n- Séries: 4\n- Repetições: 8\n- Intervalo: 90s\n- Observações: carga a definir\n\n**Agachamento Sumô - Agachamento com postura sumô para glúteos e adutores**\n- Séries: 4\n- Repetições: 8\n- Intervalo: 90s\n- Observações: carga a definir\n\n**Stiffe barra - Exercício para posterior de coxa e glúteos**\n- Séries: 4\n- Repetições: 8\n- Intervalo: 90s\n- Observações: carga a definir\n"
        }
    ]
}
```
