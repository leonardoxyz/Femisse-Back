import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { logger, logError, logSecurity, logPerformance } from '../logger.js';

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logger', () => {
    it('deve ter métodos básicos', () => {
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });
  });

  describe('logError', () => {
    it('deve logar erro com contexto', () => {
      const error = new Error('Teste');
      const context = { userId: '123' };
      
      expect(() => logError(error, context)).not.toThrow();
    });
  });

  describe('logSecurity', () => {
    it('deve logar evento de segurança', () => {
      expect(() => logSecurity('test_event', { ip: '127.0.0.1' })).not.toThrow();
    });
  });

  describe('logPerformance', () => {
    it('deve logar performance', () => {
      expect(() => logPerformance('test_operation', 100)).not.toThrow();
    });
  });
});
