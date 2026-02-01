#!/usr/bin/env bun
// Servidor MCP para gerenciamento de exercícios de academia

import { Database } from "bun:sqlite";
import { Exercicio } from "./types";


// Conexão com o Banco de Dados usando o SQLite nativo do Bun
const db = new Database("./academia.sqlite3");

// Handler para listar todas as ferramentas disponíveis
async function handleListTools() {
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
}

// Handler para executar as ferramentas
async function handleCallTool(request: any) {
  const { name, arguments: args } = request.params;

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
          porGrupo[ex.grupo_muscular].push(ex);
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
}


// Iniciar servidor MCP de academia via HTTP/SSE
async function main() {
  const port = 3000;

  const httpServer = Bun.serve({
    port,
    async fetch(req) {
      if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
        try {
          const body = await req.json();
          const { jsonrpc, id, method, params } = body;

          if (jsonrpc !== '2.0') {
            return new Response(JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32600, message: 'Invalid Request' },
              id
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }

          let result;
          if (method === 'tools/list') {
            result = await handleListTools();
          } else if (method === 'tools/call') {
            result = await handleCallTool(body);
          } else {
            return new Response(JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32601, message: 'Method not found' },
              id
            }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }

          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32700, message: 'Parse error' },
            id: null
          }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Para SSE (simplificado, apenas health check)
      if (req.method === 'GET' && req.url.endsWith('/health')) {
        return new Response("OK", { status: 200 });
      }

      return new Response("MCP Server Running", { status: 200 });
    }
  });

  console.error(`Servidor MCP de Academia iniciado via HTTP na porta ${port}`);
}

// Remover a chamada main(server), pois agora é main()
main().catch((error) => {
  console.error("Erro fatal:", error);
  process.exit(1);
});

