// In the Streamable HTTP transport, the server operates as an independent process that can handle multiple client connections. This transport uses HTTP POST and GET requests. Server can optionally make use of Server-Sent Events (SSE) to stream multiple server messages. This permits basic MCP servers, as well as more feature-rich servers supporting streaming and server-to-client notifications and requests.

//  The server MUST provide a single HTTP endpoint path (hereafter referred to as the MCP endpoint) that supports both POST and GET methods. For example, this could be a URL like https://example.com/mcp.

import { randomUUID } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  isInitializeRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { Database } from "bun:sqlite";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";


interface Exercicio {
  id: number;
  nome: string;
  grupo_muscular: string;
  series: number;
  repeticoes: number;
  intervalo_segundos: number;
  observacoes: string;
}

const filename_database = process.env.DB_PATH || "./academia.sqlite3";
// Conexão com o Banco de Dados usando o SQLite nativo do Bun
const db = new Database(filename_database);

// Criar servidor MCP
const mcpServer = new McpServer({
  name: "academia-mcp-server",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
    resources: {},
  }
});

// ==================== SESSION MANAGEMENT ====================
// Storage de transports por sessionId para suportar múltiplas conexões
const transports: { [sessionId: string]: WebStandardStreamableHTTPServerTransport } = {};

// Função auxiliar para criar resposta de erro JSON-RPC
function createJsonRpcError(code: number, message: string, id: string | number | null = null) {
  return {
    jsonrpc: "2.0",
    error: {
      code,
      message,
    },
    id,
  };
}



// Handler para listar os recursos (exercícios)
mcpServer.server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const query = db.query<Exercicio, []>(
    `SELECT id, nome, grupo_muscular, series, repeticoes, intervalo_segundos, observacoes 
     FROM exercios_vw`
  );

  const exercicios = query.all();
  return {
    resources: exercicios.map((ex) => ({
      uri: `academia://exercicio/${ex.id}`,
      name: ex.nome,
      mimeType: "application/json",
      text: JSON.stringify(ex, null, 2),
    })),
  };
});


// Handler para listar todas as ferramentas disponíveis
mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "buscar_exercicios_por_grupo",
        description:
          "Busca exercícios filtrando por grupo muscular. Grupos disponíveis: 'Costas (dorsais, lombar)', 'Ombros (deltoides)', 'Pernas', 'Peito (peitoral)', 'Braços (Bíceps, Tríceps, Antebraço)'",
        inputSchema: {
          type: "object",
          properties: {
            grupo_muscular: {
              type: "string",
              description: "Nome do grupo muscular (ex: 'Pernas', 'Peito (peitoral)')",
            },
          },
          required: ["grupo_muscular"],
        },
      },
      {
        name: "listar_grupos_musculares",
        description: "Lista todos os grupos musculares disponíveis no banco de dados",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "buscar_exercicio_por_nome",
        description: "Busca exercícios específicos por nome (busca parcial, case-insensitive)",
        inputSchema: {
          type: "object",
          properties: {
            nome: {
              type: "string",
              description: "Nome ou parte do nome do exercício (ex: 'agachamento', 'supino')",
            },
          },
          required: ["nome"],
        },
      },
      {
        name: "listar_todos_exercicios",
        description: "Lista todos os exercícios cadastrados no banco de dados",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "obter_detalhes_exercicio",
        description: "Obtém detalhes completos de um exercício específico pelo ID",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "ID do exercício",
            },
          },
          required: ["id"],
        },
      },
    ],
  };
});

// Handler para executar as ferramentas
mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request: unknown) => {
  const typedRequest = request as { params: { name: string; arguments: Record<string, unknown> } };
  const { name, arguments: args } = typedRequest.params;

  try {
    switch (name) {
      case "buscar_exercicios_por_grupo": {
        const { grupo_muscular } = args as { grupo_muscular: string };

        const query = db.query<Exercicio, [string]>(
          `SELECT id, nome, grupo_muscular, series, repeticoes, intervalo_segundos, observacoes 
           FROM exercios_vw 
           WHERE grupo_muscular LIKE ?`
        );

        const exercicios = query.all(`%${grupo_muscular}%`);

        if (exercicios.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `Nenhum exercício encontrado para o grupo muscular: ${grupo_muscular}`,
              },
            ],
          };
        }

        const resultado = exercicios.map(ex =>
          `**${ex.nome}**\n` +
          `- Séries: ${ex.series}\n` +
          `- Repetições: ${ex.repeticoes}\n` +
          `- Intervalo: ${ex.intervalo_segundos}s\n` +
          `- Observações: ${ex.observacoes}\n`
        ).join('\n');

        return {
          content: [
            {
              type: "text",
              text: `Encontrados ${exercicios.length} exercícios para ${grupo_muscular}:\n\n${resultado}`,
            },
          ],
        };
      }

      case "listar_grupos_musculares": {
        const query = db.query<{ grupo_muscular: string }, []>(
          `SELECT DISTINCT grupo_muscular FROM exercios_vw ORDER BY grupo_muscular`
        );

        const grupos = query.all();
        const lista = grupos.map(g => `- ${g.grupo_muscular}`).join('\n');

        return {
          content: [
            {
              type: "text",
              text: `Grupos musculares disponíveis:\n\n${lista}`,
            },
          ],
        };
      }

      case "buscar_exercicio_por_nome": {
        console.log('Executando ferramenta buscar_exercicio_por_nome');
        const { nome } = args as { nome: string };

        const query = db.query<Exercicio, [string]>(
          `SELECT id, nome, grupo_muscular, series, repeticoes, intervalo_segundos, observacoes 
           FROM exercios_vw 
           WHERE nome LIKE ?`
        );

        const exercicios = query.all(`%${nome}%`);

        if (exercicios.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `Nenhum exercício encontrado com o nome: ${nome}`,
              },
            ],
          };
        }

        const resultado = exercicios.map(ex =>
          `**ID ${ex.id}: ${ex.nome}**\n` +
          `- Grupo: ${ex.grupo_muscular}\n` +
          `- Séries: ${ex.series} x ${ex.repeticoes} repetições\n` +
          `- Intervalo: ${ex.intervalo_segundos}s\n` +
          `- Observações: ${ex.observacoes}\n`
        ).join('\n');

        return {
          content: [
            {
              type: "text",
              text: `Encontrados ${exercicios.length} exercício(s):\n\n${resultado}`,
            },
          ],
        };
      }

      case "listar_todos_exercicios": {
        const query = db.query<Exercicio, []>(
          `SELECT id, nome, grupo_muscular, series, repeticoes, intervalo_segundos, observacoes 
           FROM exercios_vw 
           ORDER BY grupo_muscular, nome`
        );

        const exercicios = query.all();

        // Agrupa por grupo muscular
        const porGrupo: Record<string, Exercicio[]> = {};
        exercicios.forEach(ex => {
          if (!porGrupo[ex.grupo_muscular]) {
            porGrupo[ex.grupo_muscular] = [];
          }
          const grupo = porGrupo[ex.grupo_muscular];
          if (grupo) {
            grupo.push(ex);
          }
        });

        const resultado = Object.entries(porGrupo).map(([grupo, exs]) =>
          `### ${grupo}\n` +
          exs.map(ex => `- ${ex.nome} (${ex.series}x${ex.repeticoes})`).join('\n')
        ).join('\n\n');

        return {
          content: [
            {
              type: "text",
              text: `Total de ${exercicios.length} exercícios cadastrados:\n\n${resultado}`,
            },
          ],
        };
      }

      case "obter_detalhes_exercicio": {
        const { id } = args as { id: number };

        const query = db.query<Exercicio, [number]>(
          `SELECT id, nome, grupo_muscular, series, repeticoes, intervalo_segundos, observacoes 
           FROM exercios_vw 
           WHERE id = ?`
        );

        const exercicio = query.get(id);

        if (!exercicio) {
          return {
            content: [
              {
                type: "text",
                text: `Exercício com ID ${id} não encontrado.`,
              },
            ],
          };
        }

        const detalhes =
          `# ${exercicio.nome}\n\n` +
          `**Grupo Muscular:** ${exercicio.grupo_muscular}\n` +
          `**Séries:** ${exercicio.series}\n` +
          `**Repetições:** ${exercicio.repeticoes}\n` +
          `**Intervalo:** ${exercicio.intervalo_segundos} segundos\n` +
          `**Observações:** ${exercicio.observacoes}`;

        return {
          content: [
            {
              type: "text",
              text: detalhes,
            },
          ],
        };
      }

      default:
        throw new Error(`Ferramenta desconhecida: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Erro ao executar ${name}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// ==================== HTTP HANDLERS ====================

/**
 * Handler para POST /mcp - Processa requisições MCP (Initialize, Calls, etc)
 * Gerencia sessões via mcp-session-id header
 */
async function handleMcpPost(req: Request): Promise<Response> {
  try {
    const sessionId = req.headers.get("mcp-session-id");
    let transport: WebStandardStreamableHTTPServerTransport;

    // Fazer clone do request para validação sem consumir o body
    const clonedReq = req.clone();
    let body: unknown;

    // Tentar fazer parse do body apenas para validação
    try {
      body = await clonedReq.json();
    } catch (e) {
      console.error("Failed to parse JSON request body:", e);
      return new Response(
        JSON.stringify(createJsonRpcError(-32700, "Parse error")),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validar estrutura JSON-RPC
    if (typeof body !== "object" || body === null) {
      return new Response(
        JSON.stringify(createJsonRpcError(-32700, "Invalid Request: body must be JSON object")),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const requestBody = body as Record<string, unknown>;
    const requestId = (requestBody.id as string | number | null) || null;

    // Se há sessionId existente, reutilizar transport
    if (sessionId && transports[sessionId]) {
      console.log(`[${sessionId}] Reusing existing transport`);
      transport = transports[sessionId];
    } 
    // Se é initialize request, criar nova sessão
    else if (!sessionId && isInitializeRequest(requestBody)) {
      console.log("[NEW] Initialize request received, creating new session");
      transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId: string) => {
          console.log(`[${newSessionId}] Session initialized`);
          transports[newSessionId] = transport;
        },
      });

      // Conectar transport ao servidor MCP
      await mcpServer.connect(transport);
    } 
    // Erro: nem sessionId válido nem initialize request
    else {
      console.error("Invalid request: no valid session ID or not an initialize request");
      return new Response(
        JSON.stringify(
          createJsonRpcError(
            -32000,
            "Invalid request: provide mcp-session-id header for existing sessions or send an initialize request",
            requestId
          )
        ),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Delegar ao transport para processar a requisição
    // Usar o request original (não clonado) para que o transport possa ler o body
    return transport.handleRequest(req);
  } catch (error) {
    console.error("Error handling MCP POST request:", error);
    return new Response(
      JSON.stringify(createJsonRpcError(-32603, "Internal server error")),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handler para GET /mcp - Estabelece stream SSE para notificações
 * Requer mcp-session-id header válido
 */
async function handleMcpGet(req: Request): Promise<Response> {
  try {
    const sessionId = req.headers.get("mcp-session-id");

    // Validar session ID
    if (!sessionId) {
      console.error("GET request without mcp-session-id header");
      return new Response("Invalid or missing mcp-session-id header", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (!transports[sessionId]) {
      console.error(`[${sessionId}] Session not found`);
      return new Response(`Session ${sessionId} not found`, {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    console.log(`[${sessionId}] Establishing SSE stream`);
    const transport = transports[sessionId];

    // Delegar ao transport para estabelecer SSE stream
    return transport.handleRequest(req);
  } catch (error) {
    console.error("Error handling MCP GET request:", error);
    return new Response("Internal server error", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// ==================== SERVER STARTUP ====================

/**
 * Inicia o servidor MCP com suporte a Streamable HTTP
 * Implementa:
 * - POST /mcp para requisições JSON-RPC e gerenciamento de sessão
 * - GET /mcp para streams SSE
 * - GET /health para health check
 * - Graceful shutdown ao receber SIGINT/SIGTERM
 */
async function main() {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  const server = Bun.serve({
    port,
    async fetch(req: Request) {
      const url = new URL(req.url);
      const pathname = url.pathname;
      const method = req.method;

      // Health check endpoint
      if (method === "GET" && pathname === "/health") {
        return new Response("OK", { status: 200 });
      }

      // MCP endpoint - conforme especificação Streamable HTTP
      if (pathname === "/mcp") {
        if (method === "POST") {
          return await handleMcpPost(req);
        } else if (method === "GET") {
          return await handleMcpGet(req);
        } else {
          return new Response("Method not allowed", { status: 405 });
        }
      }

      // 404 para rotas não encontradas
      return new Response(
        JSON.stringify({ error: "Not Found", path: pathname }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    },
  });

  console.log(`[SERVER] Servidor MCP de Academia iniciado`);
  console.log(`[SERVER] Endpoint HTTP/SSE disponível em http://localhost:${port}/mcp`);
  console.log(`[SERVER] Health check em http://localhost:${port}/health`);

  // ==================== GRACEFUL SHUTDOWN ====================
  const shutdown = async (signal: string) => {
    console.log(`\n[SHUTDOWN] Recebido sinal ${signal}, iniciando shutdown gracioso...`);

    // Fechar todas as sessões ativas
    const sessionIds = Object.keys(transports);
    console.log(`[SHUTDOWN] Fechando ${sessionIds.length} sessão(ões) ativa(s)...`);
    for (const sessionId of sessionIds) {
      try {
        const transport = transports[sessionId];
        if (transport) {
          console.log(`[SHUTDOWN] Fechando sessão ${sessionId}`);
          await transport.close?.();
          delete transports[sessionId];
        }
      } catch (error) {
        console.error(`[SHUTDOWN] Erro ao fechar sessão ${sessionId}:`, error);
      }
    }

    // Fechar servidor MCP
    try {
      console.log("[SHUTDOWN] Fechando servidor MCP...");
      await mcpServer.close?.();
    } catch (error) {
      console.error("[SHUTDOWN] Erro ao fechar servidor MCP:", error);
    }

    // Fechar servidor HTTP
    server.stop();

    console.log("[SHUTDOWN] Shutdown concluído. Servidor parado.");
    process.exit(0);
  };

  // Registrar handlers para SIGINT e SIGTERM
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return server;
}

// Iniciar servidor
main().catch((error) => {
  console.error("[FATAL] Erro ao iniciar servidor:", error);
  process.exit(1);
});
