/**
 * Web API 服务器 - Web API Server
 *
 * 提供 HTTP API 供多平台远程控制
 * 类似 OpenClaw 的 Gateway，支持手机远程批准
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { EventEmitter } from 'events';
import { URL } from 'url';

export interface PendingRequest {
  id: string;
  command: string;
  riskScore: number;
  reason: string;
  alternatives: string[];
  timestamp: number;
  status: 'pending' | 'approved' | 'denied';
  clientInfo: {
    ip: string;
    userAgent: string;
  };
}

export interface APIResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class WebAPIServer extends EventEmitter {
  private server = createServer();
  private port: number;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestId = 0;
  private authToken: string;

  constructor(port = 3456, authToken?: string) {
    super();
    this.port = port;
    this.authToken = authToken || this.generateAuthToken();
    this.setupRoutes();
  }

  /**
   * 生成随机认证令牌
   */
  private generateAuthToken(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    this.server.on('request', (req, res) => {
      this.handleRequest(req, res);
    });
  }

  /**
   * 处理请求
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    // 验证认证
    if (!this.verifyAuth(req)) {
      this.sendResponse(res, 401, { success: false, error: '未授权访问' });
      return;
    }

    try {
      switch (path) {
        case '/api/status':
          await this.handleStatus(req, res);
          break;
        case '/api/pending':
          await this.handlePending(req, res);
          break;
        case '/api/approve':
          await this.handleApprove(req, res);
          break;
        case '/api/deny':
          await this.handleDeny(req, res);
          break;
        case '/api/emergency-stop':
          await this.handleEmergencyStop(req, res);
          break;
        case '/api/history':
          await this.handleHistory(req, res);
          break;
        case '/api/config':
          await this.handleConfig(req, res);
          break;
        default:
          this.sendResponse(res, 404, { success: false, error: '接口不存在' });
      }
    } catch (error) {
      this.sendResponse(res, 500, {
        success: false,
        error: error instanceof Error ? error.message : '服务器内部错误'
      });
    }
  }

  /**
   * 验证认证
   */
  private verifyAuth(req: IncomingMessage): boolean {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;

    const token = authHeader.replace('Bearer ', '');
    return token === this.authToken;
  }

  /**
   * 发送响应
   */
  private sendResponse(res: ServerResponse, statusCode: number, data: APIResponse): void {
    res.writeHead(statusCode);
    res.end(JSON.stringify(data));
  }

  /**
   * 获取请求体
   */
  private async getRequestBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({});
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * 状态接口
   */
  private async handleStatus(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    const status = {
      status: 'running',
      pendingCount: this.pendingRequests.size,
      uptime: process.uptime(),
      version: '0.1.0',
      timestamp: Date.now()
    };

    this.sendResponse(res, 200, { success: true, data: status });
  }

  /**
   * 待处理请求列表
   */
  private async handlePending(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    const pending = Array.from(this.pendingRequests.values())
      .filter(r => r.status === 'pending')
      .sort((a, b) => b.timestamp - a.timestamp);

    this.sendResponse(res, 200, { success: true, data: pending });
  }

  /**
   * 批准请求
   */
  private async handleApprove(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      this.sendResponse(res, 405, { success: false, error: '方法不允许' });
      return;
    }

    const body = await this.getRequestBody(req) as { requestId: string };
    const request = this.pendingRequests.get(body.requestId);

    if (!request) {
      this.sendResponse(res, 404, { success: false, error: '请求不存在' });
      return;
    }

    request.status = 'approved';
    this.emit('approve', request);
    this.pendingRequests.delete(body.requestId);

    this.sendResponse(res, 200, { success: true, data: { message: '已批准' } });
  }

  /**
   * 拒绝请求
   */
  private async handleDeny(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      this.sendResponse(res, 405, { success: false, error: '方法不允许' });
      return;
    }

    const body = await this.getRequestBody(req) as { requestId: string; reason?: string };
    const request = this.pendingRequests.get(body.requestId);

    if (!request) {
      this.sendResponse(res, 404, { success: false, error: '请求不存在' });
      return;
    }

    request.status = 'denied';
    this.emit('deny', request, body.reason);
    this.pendingRequests.delete(body.requestId);

    this.sendResponse(res, 200, { success: true, data: { message: '已拒绝' } });
  }

  /**
   * 急停
   */
  private async handleEmergencyStop(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      this.sendResponse(res, 405, { success: false, error: '方法不允许' });
      return;
    }

    const body = await this.getRequestBody(req) as { reason?: string };

    this.emit('emergency-stop', body.reason || '用户触发急停');

    this.sendResponse(res, 200, {
      success: true,
      data: { message: '急停已触发，所有操作已暂停' }
    });
  }

  /**
   * 历史记录
   */
  private async handleHistory(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://localhost`);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const history = Array.from(this.pendingRequests.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    this.sendResponse(res, 200, { success: true, data: history });
  }

  /**
   * 配置管理
   */
  private async handleConfig(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'GET') {
      this.sendResponse(res, 200, {
        success: true,
        data: {
          port: this.port,
          authEnabled: true
        }
      });
    } else if (req.method === 'POST') {
      // 更新配置
      this.sendResponse(res, 200, { success: true, data: { message: '配置已更新' } });
    } else {
      this.sendResponse(res, 405, { success: false, error: '方法不允许' });
    }
  }

  /**
   * 添加待处理请求
   */
  addPendingRequest(
    command: string,
    riskScore: number,
    reason: string,
    alternatives: string[],
    clientInfo: { ip: string; userAgent: string }
  ): string {
    const id = `req_${++this.requestId}_${Date.now()}`;
    const request: PendingRequest = {
      id,
      command,
      riskScore,
      reason,
      alternatives,
      timestamp: Date.now(),
      status: 'pending',
      clientInfo
    };

    this.pendingRequests.set(id, request);
    this.emit('new-request', request);

    return id;
  }

  /**
   * 启动服务器
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        console.log(`🌐 AI Guardian Web API 已启动`);
        console.log(`📍 地址: http://localhost:${this.port}`);
        console.log(`🔑 认证令牌: ${this.authToken}`);
        console.log(`📱 手机访问: http://<本机IP>:${this.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  /**
   * 停止服务器
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('🛑 Web API 服务器已停止');
        resolve();
      });
    });
  }

  /**
   * 获取认证令牌
   */
  getAuthToken(): string {
    return this.authToken;
  }

  /**
   * 获取端口
   */
  getPort(): number {
    return this.port;
  }
}

// 导出单例
export const webAPIServer = new WebAPIServer();
