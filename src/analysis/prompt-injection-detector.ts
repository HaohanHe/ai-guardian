/**
 * Prompt Injection Detector
 *
 * Detects and prevents prompt injection attacks
 * Protects against malicious instructions hidden in user input
 */

export interface PromptInjectionResult {
  detected: boolean;
  type: PromptInjectionType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  evidence: string[];
  sanitizedInput: string;
  recommendations: string[];
}

export type PromptInjectionType =
  | 'ignore_previous'
  | 'role_playing'
  | 'delimiter_escape'
  | 'context_manipulation'
  | 'unicode_spoofing'
  | 'invisible_chars'
  | 'markdown_escape'
  | 'json_escape'
  | 'xml_escape'
  | 'system_prompt_leak'
  | 'jailbreak';

export interface URLPrefetchResult {
  safe: boolean;
  contentType?: string;
  size: number;
  threats: string[];
  sanitizedContent?: string;
}

/**
 * Known malicious prompt patterns
 */
const MALICIOUS_PATTERNS: Array<{
  pattern: RegExp;
  type: PromptInjectionType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}> = [
  // Ignore previous instructions
  { pattern: /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|commands?|prompts?)/i, type: 'ignore_previous', severity: 'critical', description: 'Attempt to ignore previous instructions' },
  { pattern: /disregard\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions?|commands?)/i, type: 'ignore_previous', severity: 'critical', description: 'Attempt to disregard previous instructions' },
  { pattern: /forget\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|commands?|context)/i, type: 'ignore_previous', severity: 'critical', description: 'Attempt to forget previous context' },
  { pattern: /start\s+(?:a\s+)?new\s+(?:conversation|session)/i, type: 'ignore_previous', severity: 'high', description: 'Attempt to start fresh session' },

  // Role playing / DAN attacks
  { pattern: /DAN|Do\s+Anything\s+Now/i, type: 'jailbreak', severity: 'critical', description: 'DAN (Do Anything Now) jailbreak attempt' },
  { pattern: /(?:act|pretend|roleplay)\s+as\s+(?:if\s+)?you\s+(?:are|were)/i, type: 'role_playing', severity: 'high', description: 'Role playing attempt' },
  { pattern: /you\s+are\s+not\s+(?:an\s+)?AI/i, type: 'role_playing', severity: 'high', description: 'Attempt to override AI identity' },
  { pattern: /(?:developer|debug|admin)\s+mode/i, type: 'jailbreak', severity: 'high', description: 'Attempt to enable special modes' },

  // System prompt manipulation
  { pattern: /system\s*[:\-]\s*/i, type: 'context_manipulation', severity: 'critical', description: 'Attempt to inject system prompt' },
  { pattern: /user\s*[:\-]\s*/i, type: 'context_manipulation', severity: 'high', description: 'Attempt to manipulate user context' },
  { pattern: /assistant\s*[:\-]\s*/i, type: 'context_manipulation', severity: 'high', description: 'Attempt to manipulate assistant context' },

  // Delimiter escape attempts
  { pattern: /```[\s\S]*?```/g, type: 'delimiter_escape', severity: 'medium', description: 'Markdown code block escape' },
  { pattern: /"""[\s\S]*?"""/g, type: 'delimiter_escape', severity: 'medium', description: 'Triple quote escape' },
  { pattern: /<\|[\s\S]*?\|>/g, type: 'delimiter_escape', severity: 'medium', description: 'Special token escape' },

  // System prompt leak attempts
  { pattern: /(?:show|reveal|print|output)\s+(?:your|the)\s+(?:system|initial|original)\s+(?:prompt|instructions)/i, type: 'system_prompt_leak', severity: 'high', description: 'Attempt to leak system prompt' },
  { pattern: /what\s+(?:were\s+)?you\s+(?:told|instructed)\s+(?:to\s+)?do/i, type: 'system_prompt_leak', severity: 'medium', description: 'Attempt to extract instructions' },

  // Jailbreak patterns
  { pattern: /(?:bypass|ignore|disable)\s+(?:safety|security|restrictions?|limitations?)/i, type: 'jailbreak', severity: 'critical', description: 'Attempt to bypass safety measures' },
  { pattern: /(?:no\s+)?(?:ethical|moral|legal)\s+(?:constraints?|limitations?|restrictions?)/i, type: 'jailbreak', severity: 'critical', description: 'Attempt to remove ethical constraints' },
  { pattern: /hypothetically|for\s+educational\s+purposes?|in\s+a\s+fictional\s+scenario/i, type: 'jailbreak', severity: 'medium', description: 'Attempt to use hypothetical framing' },
];

/**
 * Unicode homoglyphs and confusable characters
 */
const UNICODE_SPOOFING_CHARS = [
  { char: 'а', replacement: 'a', name: 'Cyrillic а' }, // Cyrillic а looks like Latin a
  { char: 'е', replacement: 'e', name: 'Cyrillic е' }, // Cyrillic е looks like Latin e
  { char: 'о', replacement: 'o', name: 'Cyrillic о' }, // Cyrillic о looks like Latin o
  { char: 'р', replacement: 'p', name: 'Cyrillic р' }, // Cyrillic р looks like Latin p
  { char: 'с', replacement: 'c', name: 'Cyrillic с' }, // Cyrillic с looks like Latin c
  { char: 'х', replacement: 'x', name: 'Cyrillic х' }, // Cyrillic х looks like Latin x
];

/**
 * Invisible / zero-width characters
 */
const INVISIBLE_CHARS = [
  '\u200B', // Zero Width Space
  '\u200C', // Zero Width Non-Joiner
  '\u200D', // Zero Width Joiner
  '\u2060', // Word Joiner
  '\uFEFF', // Zero Width No-Break Space (BOM)
];

/**
 * Prompt Injection Detector
 */
export class PromptInjectionDetector {
  private maxInputLength = 10000;
  private maxURLSize = 1024 * 1024; // 1MB

  /**
   * Detect prompt injection in input
   */
  detect(input: string): PromptInjectionResult {
    const result: PromptInjectionResult = {
      detected: false,
      type: 'ignore_previous',
      severity: 'low',
      confidence: 0,
      evidence: [],
      sanitizedInput: input,
      recommendations: []
    };

    // Check input length
    if (input.length > this.maxInputLength) {
      result.detected = true;
      result.type = 'context_manipulation';
      result.severity = 'medium';
      result.confidence = 0.8;
      result.evidence.push(`Input exceeds maximum length (${input.length} > ${this.maxInputLength})`);
      result.recommendations.push('Truncate or reject oversized inputs');
    }

    // Check for malicious patterns
    const patternMatches = this.checkMaliciousPatterns(input);
    if (patternMatches.length > 0) {
      result.detected = true;
      result.evidence.push(...patternMatches.map(m => m.description));

      // Determine highest severity
      const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
      let highestSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      for (const m of patternMatches) {
        if (severityOrder[m.severity] > severityOrder[highestSeverity]) {
          highestSeverity = m.severity;
        }
      }

      result.severity = highestSeverity;
      result.type = patternMatches[0].type;
      result.confidence = Math.min(1, 0.5 + patternMatches.length * 0.1);
    }

    // Check for Unicode spoofing
    const unicodeCheck = this.detectUnicodeSpoofing(input);
    if (unicodeCheck.hasSpoofing) {
      result.detected = true;
      result.type = 'unicode_spoofing';
      result.evidence.push(...unicodeCheck.spoofedChars.map(c => `Unicode spoofing: ${c.name}`));
      result.recommendations.push('Normalize Unicode characters');
    }

    // Check for invisible characters
    const invisibleCheck = this.detectInvisibleChars(input);
    if (invisibleCheck.hasInvisible) {
      result.detected = true;
      result.evidence.push(`Invisible characters detected: ${invisibleCheck.count} instances`);
      result.recommendations.push('Remove invisible characters from input');
    }

    // Sanitize input
    result.sanitizedInput = this.sanitizeInput(input);

    // Generate recommendations
    if (result.recommendations.length === 0) {
      result.recommendations.push('Input appears safe');
    }

    return result;
  }

  /**
   * Check for malicious patterns
   */
  private checkMaliciousPatterns(input: string): Array<{
    type: PromptInjectionType;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }> {
    const matches: Array<{
      type: PromptInjectionType;
      severity: 'critical' | 'high' | 'medium' | 'low';
      description: string;
    }> = [];

    for (const { pattern, type, severity, description } of MALICIOUS_PATTERNS) {
      if (pattern.test(input)) {
        matches.push({ type, severity, description });
      }
    }

    return matches;
  }

  /**
   * Detect Unicode spoofing (homoglyphs)
   */
  private detectUnicodeSpoofing(input: string): { hasSpoofing: boolean; spoofedChars: typeof UNICODE_SPOOFING_CHARS } {
    const spoofedChars: typeof UNICODE_SPOOFING_CHARS = [];

    for (const spoof of UNICODE_SPOOFING_CHARS) {
      if (input.includes(spoof.char)) {
        spoofedChars.push(spoof);
      }
    }

    return {
      hasSpoofing: spoofedChars.length > 0,
      spoofedChars
    };
  }

  /**
   * Detect invisible/zero-width characters
   */
  private detectInvisibleChars(input: string): { hasInvisible: boolean; count: number } {
    let count = 0;

    for (const char of INVISIBLE_CHARS) {
      const matches = input.split(char).length - 1;
      count += matches;
    }

    return {
      hasInvisible: count > 0,
      count
    };
  }

  /**
   * Sanitize input by removing dangerous elements
   */
  sanitizeInput(input: string): string {
    let sanitized = input;

    // Remove invisible characters
    for (const char of INVISIBLE_CHARS) {
      sanitized = sanitized.split(char).join('');
    }

    // Normalize Unicode homoglyphs
    for (const { char, replacement } of UNICODE_SPOOFING_CHARS) {
      sanitized = sanitized.split(char).join(replacement);
    }

    // Escape markdown delimiters
    sanitized = this.escapeMarkdown(sanitized);

    // Limit length
    if (sanitized.length > this.maxInputLength) {
      sanitized = sanitized.substring(0, this.maxInputLength) + '...[truncated]';
    }

    return sanitized;
  }

  /**
   * Escape markdown special characters
   */
  private escapeMarkdown(input: string): string {
    return input
      .replace(/```/g, '` ` `')
      .replace(/\*\*/g, '*')
      .replace(/__/g, '_')
      .replace(/\|\|/g, '|');
  }

  /**
   * Scan file content for hidden instructions
   */
  scanFileContent(content: string): PromptInjectionResult {
    // First apply regular detection
    const result = this.detect(content);

    // Additional file-specific checks
    const lines = content.split('\n');

    // Check for instructions hidden in comments
    const suspiciousComments = lines.filter((line) => {
      const trimmed = line.trim();
      return (
        (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) &&
        /(?:ignore|disregard|forget)\s+(?:previous|above)/i.test(trimmed)
      );
    });

    if (suspiciousComments.length > 0) {
      result.detected = true;
      result.evidence.push(`Suspicious comments found: ${suspiciousComments.length}`);
      result.recommendations.push('Review file comments for hidden instructions');
    }

    return result;
  }

  /**
   * Prefetch and validate URL content
   */
  async prefetchURL(url: string): Promise<URLPrefetchResult> {
    const result: URLPrefetchResult = {
      safe: false,
      size: 0,
      threats: []
    };

    try {
      // Validate URL first
      const parsed = new URL(url);

      // Block private IPs
      if (this.isPrivateIP(parsed.hostname)) {
        result.threats.push('Private IP address not allowed');
        return result;
      }

      // Block localhost
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        result.threats.push('Localhost not allowed');
        return result;
      }

      // Fetch with limits
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AI-Guardian-Security-Scanner/1.0'
        }
      });

      clearTimeout(timeout);

      // Check content type
      const contentType = response.headers.get('content-type') || 'unknown';
      result.contentType = contentType;

      // Block dangerous content types
      const dangerousTypes = ['application/x-sh', 'application/x-executable', 'text/x-perl'];
      if (dangerousTypes.some(t => contentType.includes(t))) {
        result.threats.push(`Dangerous content type: ${contentType}`);
        return result;
      }

      // Check content size
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > this.maxURLSize) {
        result.threats.push('Content too large');
        return result;
      }

      // Read content
      const content = await response.text();
      result.size = content.length;

      // Scan content for injection
      const injectionCheck = this.detect(content);
      if (injectionCheck.detected) {
        result.threats.push(...injectionCheck.evidence);
      }

      // Check for executable content
      if (this.isExecutableContent(content)) {
        result.threats.push('Executable content detected');
      }

      // If no threats found, mark as safe
      if (result.threats.length === 0) {
        result.safe = true;
        result.sanitizedContent = injectionCheck.sanitizedInput;
      }

    } catch (error) {
      result.threats.push(`Fetch error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return result;
  }

  /**
   * Check if content appears to be executable
   */
  private isExecutableContent(content: string): boolean {
    const executablePatterns = [
      /^#!/m, // Shebang
      /<script/i, // Script tags
      /eval\s*\(/i, // Eval
      /document\.write/i, // Document write
      /innerHTML/i, // InnerHTML
    ];

    return executablePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if hostname is a private IP
   */
  private isPrivateIP(hostname: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
    ];

    return privateRanges.some(range => range.test(hostname));
  }

  /**
   * Set maximum input length
   */
  setMaxInputLength(length: number): void {
    this.maxInputLength = length;
  }

  /**
   * Set maximum URL content size
   */
  setMaxURLSize(size: number): void {
    this.maxURLSize = size;
  }
}

// Export singleton
export const promptInjectionDetector = new PromptInjectionDetector();
