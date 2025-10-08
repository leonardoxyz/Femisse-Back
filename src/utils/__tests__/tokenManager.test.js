import { describe, it, expect } from '@jest/globals';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../tokenManager.js';

describe('Token Manager', () => {
  const mockPayload = {
    id: '123',
    email: 'test@example.com',
    nome: 'Test User',
  };

  describe('generateAccessToken', () => {
    it('deve gerar access token válido', () => {
      const token = generateAccessToken(mockPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT tem 3 partes
    });
  });

  describe('generateRefreshToken', () => {
    it('deve gerar refresh token válido', () => {
      const token = generateRefreshToken(mockPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyAccessToken', () => {
    it('deve verificar token válido', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = verifyAccessToken(token);
      
      expect(decoded.id).toBe(mockPayload.id);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.nome).toBe(mockPayload.nome);
    });

    it('deve rejeitar token inválido', () => {
      expect(() => verifyAccessToken('invalid_token')).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('deve verificar refresh token válido', () => {
      const token = generateRefreshToken(mockPayload);
      const decoded = verifyRefreshToken(token);
      
      expect(decoded.id).toBe(mockPayload.id);
      expect(decoded.email).toBe(mockPayload.email);
    });
  });
});
