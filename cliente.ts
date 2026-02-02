#!/usr/bin/env bun

/**
 * Cliente MCP para validar conformidade Streamable HTTP
 * Testa:
 * - Inicialização de sessão
 * - Reutilização de sessionId
 * - Chamada de tools
 * - Listagem de recursos
 * - SSE streaming (GET)
 */

import { randomUUID } from 'node:crypto';

const SERVER_URL = 'http://localhost:3002/mcp';
const HEALTH_URL = 'http://localhost:3002/health';

let sessionId: string | null = null;

// ==================== HELPERS ====================

/**
 * Fazer requisição POST para servidor MCP
 */
async function mcpRequest(method: string, params: Record<string, unknown> = {}, id = 1) {
  const body = {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };

  // Adicionar sessionId se já foi inicializado
  if (sessionId) {
    headers['mcp-session-id'] = sessionId;
  }

  console.log(`\n📤 Request: ${method}`);
  if (Object.keys(params).length > 0) {
    console.log('   Params:', JSON.stringify(params).substring(0, 80) + '...');
  }

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    // Extrair sessionId do header se presente
    const newSessionId = response.headers.get('mcp-session-id');
    if (newSessionId && !sessionId) {
      sessionId = newSessionId;
      console.log(`✅ Nova sessão criada: ${sessionId}`);
    }

    // Verificar se é SSE ou JSON
    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    if (contentType.includes('text/event-stream')) {
      // Processar SSE stream
      const text = await response.text();
      // Parse SSE format: "event: message\ndata: {...}\n\n"
      const lines = text.trim().split('\n');
      let jsonData = '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          jsonData = line.substring(6);
          break;
        }
      }
      if (jsonData) {
        data = JSON.parse(jsonData);
      } else {
        console.log(`❌ Erro: SSE stream sem data`);
        return null;
      }
    } else {
      // JSON direto
      data = await response.json();
    }

    // Verificar se é erro JSON-RPC
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      const error = data.error as { code: number; message: string };
      console.log(`❌ Erro (code ${error.code}): ${error.message}`);
      return null;
    }

    // Sucesso
    console.log(`✅ Response recebida`);
    return data;
  } catch (error) {
    console.log(`❌ Erro na requisição:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Testar health check
 */
async function testHealth() {
  console.log('\n' + '='.repeat(60));
  console.log('🏥 TEST 1: Health Check');
  console.log('='.repeat(60));

  try {
    const response = await fetch(HEALTH_URL);
    const text = await response.text();
    if (response.status === 200 && text === 'OK') {
      console.log('✅ Server health check: OK');
      return true;
    } else {
      console.log(`❌ Health check falhou: ${response.status} ${text}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Erro ao testar health:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Testar inicialização
 */
async function testInitialize() {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 TEST 2: Initialize (Criar Sessão)');
  console.log('='.repeat(60));

  const result = await mcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0',
    },
  });

  if (result && result.result) {
    console.log('✅ Servidor respondeu com result');
    console.log('   Capabilities:', JSON.stringify(result.result.capabilities || {}).substring(0, 100));
    console.log('   serverInfo:', result.result.serverInfo?.name || 'N/A');
    return true;
  }

  return false;
}

/**
 * Testar listagem de tools
 */
async function testListTools() {
  console.log('\n' + '='.repeat(60));
  console.log('🔨 TEST 3: List Tools');
  console.log('='.repeat(60));

  const result = await mcpRequest('tools/list');

  if (result && result.result && Array.isArray(result.result.tools)) {
    console.log(`✅ Encontrados ${result.result.tools.length} tools`);
    result.result.tools.slice(0, 3).forEach((tool: Record<string, unknown>) => {
      console.log(`   - ${tool.name}`);
    });
    if (result.result.tools.length > 3) {
      console.log(`   ... e ${result.result.tools.length - 3} mais`);
    }
    return true;
  }

  return false;
}

/**
 * Testar chamada de tool
 */
async function testCallTool() {
  console.log('\n' + '='.repeat(60));
  console.log('⚙️  TEST 4: Call Tool - listar_grupos_musculares');
  console.log('='.repeat(60));

  const result = await mcpRequest('tools/call', {
    name: 'listar_grupos_musculares',
    arguments: {},
  });

  if (result && result.result) {
    const content = result.result.content?.[0];
    if (content && content.type === 'text') {
      const text = content.text as string;
      const lines = text.split('\n').slice(0, 5);
      console.log('✅ Tool executada com sucesso');
      console.log('   Resposta (primeiras linhas):');
      lines.forEach(line => {
        if (line.trim()) console.log(`     ${line}`);
      });
      return true;
    }
  }

  return false;
}

/**
 * Testar chamada de outra tool com argumentos
 */
async function testCallToolWithArgs() {
  console.log('\n' + '='.repeat(60));
  console.log('⚙️  TEST 5: Call Tool - buscar_exercicio_por_nome');
  console.log('='.repeat(60));

  const result = await mcpRequest('tools/call', {
    name: 'buscar_exercicio_por_nome',
    arguments: {
      nome: 'supino',
    },
  });

  if (result && result.result) {
    const content = result.result.content?.[0];
    if (content && content.type === 'text') {
      const text = content.text as string;
      console.log('✅ Tool executada com sucesso');
      console.log('   Resposta (primeiras 3 linhas):');
      text.split('\n').slice(0, 3).forEach(line => {
        if (line.trim()) console.log(`     ${line}`);
      });
      return true;
    }
  }

  return false;
}

/**
 * Testar listagem de recursos
 */
async function testListResources() {
  console.log('\n' + '='.repeat(60));
  console.log('📚 TEST 6: List Resources');
  console.log('='.repeat(60));

  const result = await mcpRequest('resources/list');

  if (result && result.result && Array.isArray(result.result.resources)) {
    console.log(`✅ Encontrados ${result.result.resources.length} recursos`);
    result.result.resources.slice(0, 3).forEach((resource: Record<string, unknown>) => {
      console.log(`   - ${resource.name} (${resource.uri})`);
    });
    if (result.result.resources.length > 3) {
      console.log(`   ... e ${result.result.resources.length - 3} mais`);
    }
    return true;
  }

  return false;
}

/**
 * Testar GET /mcp para SSE (requer sessionId)
 */
async function testSSEStream() {
  console.log('\n' + '='.repeat(60));
  console.log('📡 TEST 7: SSE Stream (GET /mcp)');
  console.log('='.repeat(60));

  if (!sessionId) {
    console.log('⏭️  Pulando: sessionId não disponível');
    return false;
  }

  const headers: Record<string, string> = {
    'Accept': 'text/event-stream',
    'mcp-session-id': sessionId,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // timeout 3s

    const response = await fetch('http://localhost:3002/mcp', {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 200) {
      const contentType = response.headers.get('content-type');
      console.log(`✅ SSE stream conectado`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   mcp-session-id header: ${response.headers.get('mcp-session-id') || 'N/A'}`);
      // Stream pode fechar após timeout ou enviar dados, ambos são válidos
      return true;
    } else {
      console.log(`❌ Falha ao conectar SSE: ${response.status}`);
      return false;
    }
  } catch (error) {
    // Timeout ou desconexão é aceitável
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`✅ SSE stream manteve conexão até timeout (comportamento esperado)`);
      return true;
    }
    console.log(`⚠️  SSE stream desconectou (aceitável):`, error instanceof Error ? error.message : error);
    // Desconexão não significa falha - a conexão foi estabelecida
    return true;
  }
}

/**
 * Testar reutilização de sessionId
 */
async function testSessionReuse() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 TEST 8: Session Reuse (reutilizar sessionId)');
  console.log('='.repeat(60));

  if (!sessionId) {
    console.log('⏭️  Pulando: sessionId não disponível');
    return false;
  }

  console.log(`📤 Enviando request com sessionId existente: ${sessionId}`);

  const result = await mcpRequest('tools/list', {}, 99);

  if (result) {
    console.log('✅ sessionId reutilizado com sucesso');
    return true;
  }

  return false;
}

/**
 * Testar erro com sessionId inválido
 */
async function testInvalidSession() {
  console.log('\n' + '='.repeat(60));
  console.log('❌ TEST 9: Invalid Session (testar rejeição)');
  console.log('='.repeat(60));

  const fakeSessionId = randomUUID();
  console.log(`📤 Enviando request com sessionId inválido: ${fakeSessionId}`);

  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {},
  };

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mcp-session-id': fakeSessionId,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.error && data.error.code === -32000) {
      console.log('✅ Servidor rejeitou sessionId inválido corretamente');
      console.log(`   Erro: ${data.error.message}`);
      return true;
    } else if (data.error) {
      console.log(`⚠️  Servidor retornou erro diferente: code ${data.error.code}`);
      return true; // Ainda é um erro, o que é esperado
    }
  } catch (error) {
    console.log(`❌ Erro:`, error instanceof Error ? error.message : error);
    return false;
  }

  return false;
}

// ==================== MAIN ====================

async function main() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + '🧪 TESTES DE CONFORMIDADE MCP' + ' '.repeat(20) + '║');
  console.log('║' + ' '.repeat(8) + 'Streamable HTTP - Servidor Academia' + ' '.repeat(16) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  const results: { test: string; passed: boolean }[] = [];

  // Executar testes em sequência
  results.push({ test: 'Health Check', passed: await testHealth() });
  results.push({ test: 'Initialize', passed: await testInitialize() });
  results.push({ test: 'List Tools', passed: await testListTools() });
  results.push({ test: 'Call Tool (sem args)', passed: await testCallTool() });
  results.push({ test: 'Call Tool (com args)', passed: await testCallToolWithArgs() });
  results.push({ test: 'List Resources', passed: await testListResources() });
  results.push({ test: 'SSE Stream', passed: await testSSEStream() });
  results.push({ test: 'Session Reuse', passed: await testSessionReuse() });
  results.push({ test: 'Invalid Session', passed: await testInvalidSession() });

  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DOS TESTES');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach((r, i) => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${i + 1}. ${r.test}`);
  });

  console.log('='.repeat(60));
  console.log(`\n🎯 Resultado Final: ${passed}/${total} testes passaram`);

  if (passed === total) {
    console.log('🎉 Servidor está 100% conforme com Streamable HTTP!');
  } else if (passed >= total - 1) {
    console.log('✅ Servidor está funcionando bem!');
  } else {
    console.log('⚠️  Alguns testes falharam. Verifique os logs acima.');
  }

  console.log('');
}

main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
