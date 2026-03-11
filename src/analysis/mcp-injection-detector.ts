/**
 * MCP Injection Detector
 *
 * Detects and prevents MCP (Model Context Protocol) injection attacks
 * Validates MCP server configurations and monitors behavior
 */

import { z } from 'zod';

export interface MCPConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface MCPValidationResult {
  isValid: boolean;
  errors: MCPValidationError[];
  warnings: MCPValidationWarning[];
}

export interface MCPValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface MCPValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface MCPInjectionCheck {
  detected: boolean;
  type: 'command_injection' | 'env_injection' | 'config_tampering' | 'unauthorized_server';
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;
  recommendation: string;
}

export interface EnvAuditResult {
  suspiciousVars: string[];
  sensitiveAccess: string[];
  pathPollution: boolean;
  recommendations: string[];
}

/**
 * Zod schema for MCP configuration validation
 */
const MCPConfigSchema = z.object({
  name: z.string().min(1).max(100),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().url().optional()
}).strict();

/**
 * Whitelist of allowed MCP server commands
 */
const ALLOWED_MCP_COMMANDS = [
  'npx',
  'node',
  'python',
  'python3',
  'ruby',
  'deno',
  'bun',
  // Add more trusted commands as needed
];

/**
 * Sensitive environment variable patterns
 */
const SENSITIVE_ENV_PATTERNS = [
  /API[_-]?KEY/i,
  /SECRET/i,
  /TOKEN/i,
  /PASSWORD/i,
  /CREDENTIAL/i,
  /PRIVATE[_-]?KEY/i,
  /ACCESS[_-]?KEY/i,
  /AUTH/i,
  /SESSION/i,
  /COOKIE/i,
];

/**
 * Dangerous command patterns
 */
const DANGEROUS_COMMAND_PATTERNS = [
  { pattern: /curl.*\|.*(bash|sh|zsh)/i, type: 'pipe_to_shell', description: 'Piping curl output to shell' },
  { pattern: /wget.*-O-.*\|.*(bash|sh|zsh)/i, type: 'pipe_to_shell', description: 'Piping wget output to shell' },
  { pattern: /eval\s*\(/i, type: 'eval_usage', description: 'Use of eval' },
  { pattern: /exec\s*\(/i, type: 'exec_usage', description: 'Use of exec' },
  { pattern: /child_process/i, type: 'child_process', description: 'Child process module' },
  { pattern: /fs\.unlink/i, type: 'file_deletion', description: 'File deletion' },
  { pattern: /fs\.rmdir/i, type: 'directory_deletion', description: 'Directory deletion' },
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/i, type: 'child_process_require', description: 'Requiring child_process' },
];

/**
 * MCP Injection Detector
 */
export class MCPInjectionDetector {
  private allowedCommands: Set<string> = new Set(ALLOWED_MCP_COMMANDS);
  private blockedServers: Set<string> = new Set();

  /**
   * Validate MCP configuration
   */
  validateConfig(config: unknown): MCPValidationResult {
    const result: MCPValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Schema validation
    const parseResult = MCPConfigSchema.safeParse(config);
    if (!parseResult.success) {
      result.isValid = false;
      for (const issue of parseResult.error.issues) {
        result.errors.push({
          field: issue.path.join('.'),
          message: issue.message,
          severity: 'error'
        });
      }
      return result;
    }

    const validConfig = parseResult.data;

    // Validate command is in whitelist
    const baseCommand = validConfig.command.split(' ')[0];
    if (!this.allowedCommands.has(baseCommand)) {
      result.warnings.push({
        field: 'command',
        message: `Command '${baseCommand}' is not in the allowed list`,
        suggestion: 'Add to whitelist if trusted, or use a wrapper script'
      });
    }

    // Check for dangerous patterns in command
    const commandCheck = this.checkCommandInjection(validConfig.command);
    if (commandCheck.detected) {
      result.isValid = false;
      result.errors.push({
        field: 'command',
        message: `Dangerous pattern detected: ${commandCheck.evidence}`,
        severity: 'error'
      });
    }

    // Validate environment variables
    if (validConfig.env) {
      const envAudit = this.auditEnvironmentVariables(validConfig.env);

      if (envAudit.suspiciousVars.length > 0) {
        result.warnings.push({
          field: 'env',
          message: `Suspicious environment variables: ${envAudit.suspiciousVars.join(', ')}`,
          suggestion: 'Review these variables for potential data exfiltration'
        });
      }

      if (envAudit.pathPollution) {
        result.errors.push({
          field: 'env.PATH',
          message: 'PATH pollution detected',
          severity: 'error'
        });
      }
    }

    // Validate URL if present
    if (validConfig.url) {
      const urlCheck = this.validateMCPUrl(validConfig.url);
      if (!urlCheck.valid) {
        result.warnings.push({
          field: 'url',
          message: urlCheck.reason || 'Invalid URL',
          suggestion: 'Use HTTPS URLs from trusted sources'
        });
      }
    }

    return result;
  }

  /**
   * Check for command injection in MCP command
   */
  checkCommandInjection(command: string): MCPInjectionCheck {
    for (const { pattern, description } of DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(command)) {
        return {
          detected: true,
          type: 'command_injection',
          severity: 'critical',
          evidence: description,
          recommendation: 'Remove dangerous patterns from MCP server command'
        };
      }
    }

    // Check for shell metacharacters
    const shellMetacharacters = /[;|&$`\\]/;
    if (shellMetacharacters.test(command)) {
      return {
        detected: true,
        type: 'command_injection',
        severity: 'high',
        evidence: 'Shell metacharacters detected in command',
        recommendation: 'Avoid shell metacharacters in MCP commands'
      };
    }

    return {
      detected: false,
      type: 'command_injection',
      severity: 'low',
      evidence: '',
      recommendation: ''
    };
  }

  /**
   * Audit environment variables for security issues
   */
  auditEnvironmentVariables(env: Record<string, string>): EnvAuditResult {
    const result: EnvAuditResult = {
      suspiciousVars: [],
      sensitiveAccess: [],
      pathPollution: false,
      recommendations: []
    };

    for (const [key, value] of Object.entries(env)) {
      // Check for suspicious variable names
      if (this.isSuspiciousEnvVar(key)) {
        result.suspiciousVars.push(key);
      }

      // Check for sensitive data patterns in values
      if (this.containsSensitiveData(value)) {
        result.sensitiveAccess.push(key);
      }

      // Check for PATH pollution
      if (key === 'PATH') {
        const pathEntries = value.split(':');
        const suspiciousPaths = pathEntries.filter(p =>
          p.includes('/tmp') ||
          p.includes('/var/tmp') ||
          p.startsWith('.') ||
          p.includes('node_modules/.bin')
        );
        if (suspiciousPaths.length > 0) {
          result.pathPollution = true;
        }
      }
    }

    // Generate recommendations
    if (result.suspiciousVars.length > 0) {
      result.recommendations.push(`Review suspicious environment variables: ${result.suspiciousVars.join(', ')}`);
    }

    if (result.sensitiveAccess.length > 0) {
      result.recommendations.push('Avoid passing sensitive data in environment variables');
    }

    if (result.pathPollution) {
      result.recommendations.push('PATH contains potentially unsafe directories');
    }

    return result;
  }

  /**
   * Validate MCP server URL
   */
  private validateMCPUrl(url: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(url);

      // Require HTTPS for production
      if (parsed.protocol !== 'https:') {
        return { valid: false, reason: 'URL must use HTTPS protocol' };
      }

      // Block localhost and private IPs in production
      const hostname = parsed.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return { valid: false, reason: 'Localhost URLs not allowed in production' };
      }

      // Check for private IP ranges
      if (this.isPrivateIP(hostname)) {
        return { valid: false, reason: 'Private IP addresses not allowed' };
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }

  /**
   * Check if hostname is a private IP
   */
  private isPrivateIP(hostname: string): boolean {
    // Check for private IPv4 ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^0\./,
    ];

    return privateRanges.some(range => range.test(hostname));
  }

  /**
   * Check if environment variable name is suspicious
   */
  private isSuspiciousEnvVar(name: string): boolean {
    return SENSITIVE_ENV_PATTERNS.some(pattern => pattern.test(name));
  }

  /**
   * Check if value contains sensitive data patterns
   */
  private containsSensitiveData(value: string): boolean {
    // Check for common sensitive data patterns
    const sensitivePatterns = [
      /sk-[a-zA-Z0-9]{20,}/, // OpenAI API key pattern
      /ghp_[a-zA-Z0-9]{36}/, // GitHub personal access token
      /[a-zA-Z0-9]{32,}/, // Generic long token
    ];

    return sensitivePatterns.some(pattern => pattern.test(value));
  }

  /**
   * Add command to whitelist
   */
  addAllowedCommand(command: string): void {
    this.allowedCommands.add(command);
  }

  /**
   * Remove command from whitelist
   */
  removeAllowedCommand(command: string): void {
    this.allowedCommands.delete(command);
  }

  /**
   * Block a specific MCP server
   */
  blockServer(serverName: string): void {
    this.blockedServers.add(serverName.toLowerCase());
  }

  /**
   * Check if server is blocked
   */
  isServerBlocked(serverName: string): boolean {
    return this.blockedServers.has(serverName.toLowerCase());
  }

  /**
   * Parse and validate MCP configuration from JSON string
   */
  parseAndValidate(configJson: string): MCPValidationResult {
    try {
      const config = JSON.parse(configJson);
      return this.validateConfig(config);
    } catch {
      return {
        isValid: false,
        errors: [{
          field: 'root',
          message: 'Invalid JSON format',
          severity: 'error'
        }],
        warnings: []
      };
    }
  }

  /**
   * Sanitize MCP configuration
   */
  sanitizeConfig(config: MCPConfig): MCPConfig {
    const sanitized: MCPConfig = {
      name: config.name,
      command: config.command
    };

    // Only include args if present and valid
    if (config.args && Array.isArray(config.args)) {
      sanitized.args = config.args.filter(arg =>
        typeof arg === 'string' &&
        !arg.includes(';') &&
        !arg.includes('|') &&
        !arg.includes('&')
      );
    }

    // Sanitize environment variables
    if (config.env) {
      sanitized.env = {};
      for (const [key, value] of Object.entries(config.env)) {
        // Skip suspicious variables
        if (!this.isSuspiciousEnvVar(key)) {
          sanitized.env[key] = value;
        }
      }
    }

    // Only include URL if valid
    if (config.url) {
      const urlCheck = this.validateMCPUrl(config.url);
      if (urlCheck.valid) {
        sanitized.url = config.url;
      }
    }

    return sanitized;
  }
}

// Export singleton
export const mcpInjectionDetector = new MCPInjectionDetector();
