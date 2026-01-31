# Servidor MCP

Quando começei pesquisar sobre, a maioria dos tutorias explicavam com executar
o servidor mcp dentro de um script com outras componente, como o código que conecta
a uma llm, o arquivo `via-stdio.ts` é uma extração desse exemplo.

Por outro lado, como engenheiro de software fiquei imaginando como eu podeira fazer para
usar o mesmo servidor em mais de uma solução então o arquivo index.ts é um exeplo que utiliza o conceito:
Servidor MCP Centralizado via HTTP/SSE

## Executando via http

```http
curl -X POST http://localhost:3000 -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
```

## Executando via stdio

```sh
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | bun run via-stdio.ts
```
