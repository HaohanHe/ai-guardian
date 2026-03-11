/**
 * Skill Supply Chain Security Analyzer
 * 
 * Analyzes Skill code and manifest for security risks
 * Protects against supply chain attacks in AI Agent Skills
 */

import { promises as fs } from 'fs';
import { join, extname } from 'path';

export interface SkillManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  permissions?: string[];
  capabilities?: string[];
  dependencies?: Record<string, string>;
  main?: string;
  bin?: Record<string, string>;
}

export interface SkillCodeAnalysis {
  filePath: string;
  dangerousPatterns: DangerousPattern[];
  sensitiveAPICalls: SensitiveAPICall[];
  riskScore: number;
  recommendations: string[];
}

export interface DangerousPattern {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  code: string;
  description: string;
}

export interface SensitiveAPICall {
  api: string;
  line: number;
  context: string;
}

export interface SkillSupplyChainResult {
  skillPath: string;
  manifest?: SkillManifest;
  manifestRisks: ManifestRisk[];
  codeAnalysis: SkillCodeAnalysis[];
  overallRiskScore: number;
  isTrusted: boolean;
  recommendations: string[];
}

export interface ManifestRisk {
  type: 'excessive_permission' | 'missing_author' | 'suspicious_dependency' | 'unversioned_dependency';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  field?: string;
}

/**
 * Dangerous code patterns to detect
 */
const DANGEROUS_PATTERNS = [
  // Code execution
  { pattern: /eval\s*\(/, type: 'eval_execution', severity: 'critical' as const, description: 'Dynamic code execution via eval' },
  { pattern: /new\s+Function\s*\(/, type: 'function_constructor', severity: 'critical' as const, description: 'Dynamic code execution via Function constructor' },
  { pattern: /setTimeout\s*\(\s*["']/, type: 'setTimeout_string', severity: 'high' as const, description: 'setTimeout with string argument' },
  { pattern: /setInterval\s*\(\s*["']/, type: 'setInterval_string', severity: 'high' as const, description: 'setInterval with string argument' },
  
  // Child process
  { pattern: /child_process/, type: 'child_process_import', severity: 'critical' as const, description: 'Child process module usage' },
  { pattern: /exec\s*\(/, type: 'exec_call', severity: 'critical' as const, description: 'Command execution via exec' },
  { pattern: /spawn\s*\(/, type: 'spawn_call', severity: 'high' as const, description: 'Process spawning' },
  { pattern: /execSync\s*\(/, type: 'execSync_call', severity: 'critical' as const, description: 'Synchronous command execution' },
  
  // File system
  { pattern: /fs\.unlink\s*\(/, type: 'file_delete', severity: 'high' as const, description: 'File deletion' },
  { pattern: /fs\.rmdir\s*\(/, type: 'directory_delete', severity: 'high' as const, description: 'Directory deletion' },
  { pattern: /fs\.writeFile\s*\(/, type: 'file_write', severity: 'medium' as const, description: 'File write operation' },
  { pattern: /fs\.chmod\s*\(/, type: 'permission_change', severity: 'high' as const, description: 'Permission modification' },
  
  // Network
  { pattern: /http\.request\s*\(/, type: 'http_request', severity: 'medium' as const, description: 'HTTP request' },
  { pattern: /https\.request\s*\(/, type: 'https_request', severity: 'medium' as const, description: 'HTTPS request' },
  { pattern: /net\.connect\s*\(/, type: 'socket_connect', severity: 'high' as const, description: 'Socket connection' },
  { pattern: /fetch\s*\(/, type: 'fetch_call', severity: 'medium' as const, description: 'Fetch API call' },
  
  // Obfuscation
  { pattern: /\\x[0-9a-fA-F]{2}/, type: 'hex_escape', severity: 'high' as const, description: 'Hexadecimal escape sequences' },
  { pattern: /String\.fromCharCode/, type: 'char_code_obfuscation', severity: 'medium' as const, description: 'String obfuscation via fromCharCode' },
  { pattern: /atob\s*\(/, type: 'base64_decode', severity: 'medium' as const, description: 'Base64 decoding' },
  
  // Data exfiltration patterns
  { pattern: /process\.env\.[A-Z_]*(?:KEY|TOKEN|SECRET|PASSWORD)/, type: 'env_access', severity: 'high' as const, description: 'Access to sensitive environment variables' },
  { pattern: /localStorage\.getItem|sessionStorage\.getItem/, type: 'storage_access', severity: 'medium' as const, description: 'Browser storage access' },
];

/**
 * Sensitive permissions that require extra scrutiny
 */
const SENSITIVE_PERMISSIONS = [
  'filesystem-write',
  'filesystem-delete',
  'network-all',
  'process-exec',
  'shell-access',
  'system-modify',
  'browser-control',
  'clipboard-access',
];

/**
 * Skill Supply Chain Analyzer
 */
export class SkillSupplyChainAnalyzer {
  /**
   * Analyze a Skill directory or file
   */
  async analyze(skillPath: string): Promise<SkillSupplyChainResult> {
    const result: SkillSupplyChainResult = {
      skillPath,
      manifestRisks: [],
      codeAnalysis: [],
      overallRiskScore: 0,
      isTrusted: false,
      recommendations: []
    };

    // 1. Analyze manifest
    const manifestResult = await this.analyzeManifest(skillPath);
    result.manifest = manifestResult.manifest;
    result.manifestRisks = manifestResult.risks;

    // 2. Analyze code files
    const codeFiles = await this.findCodeFiles(skillPath);
    for (const file of codeFiles) {
      const analysis = await this.analyzeCodeFile(file);
      result.codeAnalysis.push(analysis);
    }

    // 3. Calculate overall risk
    result.overallRiskScore = this.calculateOverallRisk(result);
    result.isTrusted = result.overallRiskScore < 30 && result.manifestRisks.length === 0;

    // 4. Generate recommendations
    result.recommendations = this.generateRecommendations(result);

    return result;
  }

  /**
   * Analyze Skill manifest file
   */
  private async analyzeManifest(skillPath: string): Promise<{ manifest?: SkillManifest; risks: ManifestRisk[] }> {
    const risks: ManifestRisk[] = [];
    let manifest: SkillManifest | undefined;

    // Try to find and parse manifest files
    const manifestFiles = ['package.json', 'claude.json', 'mcp.json', 'skill.json', 'manifest.json'];
    
    for (const manifestFile of manifestFiles) {
      const manifestPath = join(skillPath, manifestFile);
      try {
        const content = await fs.readFile(manifestPath, 'utf-8');
        manifest = JSON.parse(content) as SkillManifest;
        break;
      } catch {
        continue;
      }
    }

    if (!manifest) {
      risks.push({
        type: 'missing_author',
        severity: 'medium',
        message: 'No manifest file found (package.json, claude.json, etc.)'
      });
      return { risks };
    }

    // Check for missing author
    if (!manifest.author) {
      risks.push({
        type: 'missing_author',
        severity: 'medium',
        message: 'Author field is missing in manifest',
        field: 'author'
      });
    }

    // Check for excessive permissions
    if (manifest.permissions) {
      const excessivePermissions = manifest.permissions.filter(p => 
        SENSITIVE_PERMISSIONS.includes(p.toLowerCase())
      );
      
      if (excessivePermissions.length > 0) {
        risks.push({
          type: 'excessive_permission',
          severity: 'high',
          message: `Excessive permissions declared: ${excessivePermissions.join(', ')}`,
          field: 'permissions'
        });
      }
    }

    // Check dependencies
    if (manifest.dependencies) {
      for (const [name, version] of Object.entries(manifest.dependencies)) {
        if (version === '*' || version === 'latest') {
          risks.push({
            type: 'unversioned_dependency',
            severity: 'medium',
            message: `Unversioned dependency: ${name}@${version}`,
            field: 'dependencies'
          });
        }
        
        // Check for known suspicious packages
        if (this.isSuspiciousPackage(name)) {
          risks.push({
            type: 'suspicious_dependency',
            severity: 'high',
            message: `Suspicious dependency detected: ${name}`,
            field: 'dependencies'
          });
        }
      }
    }

    return { manifest, risks };
  }

  /**
   * Find all code files in Skill directory
   */
  private async findCodeFiles(skillPath: string): Promise<string[]> {
    const codeFiles: string[] = [];
    const extensions = ['.js', '.ts', '.mjs', '.cjs', '.py', '.rb', '.sh'];
    
    try {
      const entries = await fs.readdir(skillPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && extensions.includes(extname(entry.name))) {
          codeFiles.push(join(skillPath, entry.name));
        } else if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          // Recursively search subdirectories
          const subFiles = await this.findCodeFiles(join(skillPath, entry.name));
          codeFiles.push(...subFiles);
        }
      }
    } catch {
      // If skillPath is a file, return it if it's a code file
      if (extensions.includes(extname(skillPath))) {
        return [skillPath];
      }
    }
    
    return codeFiles;
  }

  /**
   * Analyze a single code file
   */
  private async analyzeCodeFile(filePath: string): Promise<SkillCodeAnalysis> {
    const analysis: SkillCodeAnalysis = {
      filePath,
      dangerousPatterns: [],
      sensitiveAPICalls: [],
      riskScore: 0,
      recommendations: []
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Check for dangerous patterns
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        for (const { pattern, type, severity, description } of DANGEROUS_PATTERNS) {
          if (pattern.test(line)) {
            analysis.dangerousPatterns.push({
              type,
              severity,
              line: lineNumber,
              code: line.trim().substring(0, 100),
              description
            });
          }
        }
      }

      // Check for sensitive API calls
      this.detectSensitiveAPICalls(content, analysis);

      // Calculate risk score
      analysis.riskScore = this.calculateCodeRiskScore(analysis);

      // Generate recommendations
      analysis.recommendations = this.generateCodeRecommendations(analysis);

    } catch (error) {
      analysis.recommendations.push(`Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return analysis;
  }

  /**
   * Detect sensitive API calls in code
   */
  private detectSensitiveAPICalls(content: string, analysis: SkillCodeAnalysis): void {
    const apiPatterns = [
      { api: 'fs.readFile', pattern: /fs\.readFile\s*\(/g },
      { api: 'fs.writeFile', pattern: /fs\.writeFile\s*\(/g },
      { api: 'fs.unlink', pattern: /fs\.unlink\s*\(/g },
      { api: 'child_process.exec', pattern: /child_process.*exec\s*\(/g },
      { api: 'child_process.spawn', pattern: /child_process.*spawn\s*\(/g },
      { api: 'http.request', pattern: /http\.request\s*\(/g },
      { api: 'https.request', pattern: /https\.request\s*\(/g },
      { api: 'fetch', pattern: /fetch\s*\(/g },
      { api: 'XMLHttpRequest', pattern: /XMLHttpRequest/g },
      { api: 'WebSocket', pattern: /new\s+WebSocket\s*\(/g },
    ];

    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const { api, pattern } of apiPatterns) {
        if (pattern.test(line)) {
          analysis.sensitiveAPICalls.push({
            api,
            line: i + 1,
            context: line.trim().substring(0, 80)
          });
        }
      }
    }
  }

  /**
   * Calculate risk score for code analysis
   */
  private calculateCodeRiskScore(analysis: SkillCodeAnalysis): number {
    let score = 0;
    
    for (const pattern of analysis.dangerousPatterns) {
      switch (pattern.severity) {
        case 'critical': score += 25; break;
        case 'high': score += 15; break;
        case 'medium': score += 8; break;
        case 'low': score += 3; break;
      }
    }
    
    // Cap at 100
    return Math.min(100, score);
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallRisk(result: SkillSupplyChainResult): number {
    let score = 0;
    
    // Manifest risks
    for (const risk of result.manifestRisks) {
      switch (risk.severity) {
        case 'critical': score += 20; break;
        case 'high': score += 12; break;
        case 'medium': score += 6; break;
        case 'low': score += 2; break;
      }
    }
    
    // Code analysis
    for (const analysis of result.codeAnalysis) {
      score += analysis.riskScore * 0.3;
    }
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(result: SkillSupplyChainResult): string[] {
    const recommendations: string[] = [];
    
    if (result.manifestRisks.some(r => r.type === 'missing_author')) {
      recommendations.push('Add author information to manifest for accountability');
    }
    
    if (result.manifestRisks.some(r => r.type === 'excessive_permission')) {
      recommendations.push('Review and minimize declared permissions');
    }
    
    if (result.manifestRisks.some(r => r.type === 'unversioned_dependency')) {
      recommendations.push('Pin dependency versions to prevent supply chain attacks');
    }
    
    if (result.codeAnalysis.some(a => a.dangerousPatterns.some(p => p.severity === 'critical'))) {
      recommendations.push('CRITICAL: Remove or sandbox dangerous code patterns (eval, exec, etc.)');
    }
    
    if (result.codeAnalysis.some(a => a.sensitiveAPICalls.length > 5)) {
      recommendations.push('High number of sensitive API calls - review necessity of each');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('No major issues detected - continue monitoring');
    }
    
    return recommendations;
  }

  /**
   * Generate recommendations for code file
   */
  private generateCodeRecommendations(analysis: SkillCodeAnalysis): string[] {
    const recommendations: string[] = [];
    
    const criticalPatterns = analysis.dangerousPatterns.filter(p => p.severity === 'critical');
    if (criticalPatterns.length > 0) {
      recommendations.push(`Remove ${criticalPatterns.length} critical dangerous patterns`);
    }
    
    if (analysis.sensitiveAPICalls.length > 3) {
      recommendations.push('Consider reducing number of sensitive API calls');
    }
    
    return recommendations;
  }

  /**
   * Check if package name is suspicious
   */
  private isSuspiciousPackage(name: string): boolean {
    const suspiciousPatterns = [
      /malware/i,
      /backdoor/i,
      /trojan/i,
      /virus/i,
      /hack/i,
      /exploit/i,
      /payload/i,
      /reverse[-_]?shell/i,
      /keylogger/i,
      /stealer/i,
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Quick scan for dangerous patterns in code string
   */
  quickScan(code: string): { hasDangerousPatterns: boolean; patterns: string[] } {
    const patterns: string[] = [];
    
    for (const { pattern, type } of DANGEROUS_PATTERNS) {
      if (pattern.test(code)) {
        patterns.push(type);
      }
    }
    
    return {
      hasDangerousPatterns: patterns.length > 0,
      patterns: [...new Set(patterns)]
    };
  }
}

// Export singleton
export const skillSupplyChainAnalyzer = new SkillSupplyChainAnalyzer();
