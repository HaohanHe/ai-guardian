/**
 * AI Guardian MCP Server
 * 
 * 独立的 MCP 服务器，可以直接配置到 OpenClaw/Claude 等支持 MCP 的 AI Agent 中
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// 从环境变量读取配置
const config = {
  guardianUrl: process.env.AI_GUARDIAN_URL || 'http://localhost:3456',
  guardianToken: process.env.AI_GUARDIAN_TOKEN || '',
  alertThreshold: parseInt(process.env.AI_GUARDIAN_THRESHOLD || '70'),
  autoBlock: process.env.AI_GUARDIAN_AUTO_BLOCK === 'true'
};

// 创建 MCP 服务器
const server = new Server(
  {
    name: 'ai-guardian',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 列出可用工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'evaluate',
        description: '评估命令安全风险（0-100分）',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: '要评估的命令',
            },
          },
          required: ['command'],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'evaluate') {
    const command = (args as any)?.command as string;
    
    if (!command) {
      return {
        content: [{ type: 'text', text: 'Error: command is required' }],
        isError: true
      };
    }

    try {
      const response = await fetch(`${config.guardianUrl}/api/evaluate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.guardianToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command })
      });

      if (!response.ok) {
        return {
          content: [{ type: 'text', text: `Guardian API error: ${response.status}` }],
          isError: true
        };
      }

      const result = await response.json() as any;
      
      const riskScore = result.riskScore || 0;
      const level = riskScore >= 90 ? 'CRITICAL' : riskScore >= 71 ? 'HIGH' : riskScore >= 31 ? 'MEDIUM' : 'LOW';
      
      const output = `命令: ${command}\n` +
        `风险分: ${riskScore}/100\n` +
        `等级: ${level}\n` +
        `决策: ${result.action}\n` +
        `原因: ${result.reason || 'Unknown'}\n` +
        `建议: ${(result.alternatives || []).join('; ') || '无'}`;

      return {
        content: [{ type: 'text', text: output }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error}` }],
        isError: true
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[AI Guardian MCP Server] Running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
