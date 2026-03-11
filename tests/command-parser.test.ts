import { describe, it, expect } from 'vitest';
import { commandParser } from '../src/simulation/command-parser.js';

describe('CommandParser', () => {
  describe('parse', () => {
    it('should parse simple command', () => {
      const result = commandParser.parse('ls -la');
      expect(result.command).toBe('ls');
      expect(result.args).toEqual(['-la']);
    });

    it('should parse command with quotes', () => {
      const result = commandParser.parse('echo "hello world"');
      expect(result.command).toBe('echo');
      expect(result.args).toEqual(['hello world']);
    });

    it('should parse pipeline', () => {
      const result = commandParser.parse('cat file.txt | grep "error" | wc -l');
      expect(result.command).toBe('pipeline');
      expect(result.pipes).toHaveLength(3);
      expect(result.pipes![0].command).toBe('cat');
      expect(result.pipes![1].command).toBe('grep');
      expect(result.pipes![2].command).toBe('wc');
    });

    it('should parse redirects', () => {
      const result = commandParser.parse('echo "test" > output.txt');
      expect(result.command).toBe('echo');
      expect(result.args).toEqual(['test']);
      expect(result.redirects).toHaveLength(1);
      expect(result.redirects![0].type).toBe('>');
      expect(result.redirects![0].target).toBe('output.txt');
    });
  });

  describe('extractFilePaths', () => {
    it('should extract file paths from cat command', () => {
      const parsed = commandParser.parse('cat /etc/passwd');
      const paths = commandParser.extractFilePaths(parsed);
      expect(paths).toContain('/etc/passwd');
    });

    it('should extract file paths from redirects', () => {
      const parsed = commandParser.parse('echo test > /tmp/output.txt');
      const paths = commandParser.extractFilePaths(parsed);
      expect(paths).toContain('/tmp/output.txt');
    });
  });

  describe('extractNetworkTargets', () => {
    it('should extract URL from curl command', () => {
      const parsed = commandParser.parse('curl https://example.com');
      const targets = commandParser.extractNetworkTargets(parsed);
      expect(targets).toContain('https://example.com');
    });

    it('should extract host from ssh command', () => {
      const parsed = commandParser.parse('ssh user@server.com');
      const targets = commandParser.extractNetworkTargets(parsed);
      expect(targets).toContain('server.com');
    });
  });

  describe('isDangerousCommand', () => {
    it('should detect rm as dangerous', () => {
      const parsed = commandParser.parse('rm -rf /');
      expect(commandParser.isDangerousCommand(parsed)).toBe(true);
    });

    it('should detect sudo as dangerous', () => {
      const parsed = commandParser.parse('sudo ls');
      expect(commandParser.isDangerousCommand(parsed)).toBe(true);
    });

    it('should not detect ls as dangerous', () => {
      const parsed = commandParser.parse('ls -la');
      expect(commandParser.isDangerousCommand(parsed)).toBe(false);
    });
  });

  describe('hasRecursiveOrForceFlag', () => {
    it('should detect -rf flag', () => {
      const parsed = commandParser.parse('rm -rf directory');
      expect(commandParser.hasRecursiveOrForceFlag(parsed)).toBe(true);
    });

    it('should detect --recursive flag', () => {
      const parsed = commandParser.parse('rm --recursive directory');
      expect(commandParser.hasRecursiveOrForceFlag(parsed)).toBe(true);
    });
  });
});
