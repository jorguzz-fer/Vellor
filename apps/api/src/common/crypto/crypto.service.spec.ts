import { describe, expect, it } from 'vitest';
import { CryptoService } from './crypto.service';

const service = new CryptoService({
  env: { APP_ENCRYPTION_KEY: 'chave-de-teste-com-mais-de-32-caracteres-ok' },
} as never);

describe('CryptoService', () => {
  it('cifra e decifra com AES-256-GCM (IV aleatório)', () => {
    const a = service.encrypt('529.982.247-25');
    const b = service.encrypt('529.982.247-25');
    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe('529.982.247-25');
    expect(service.decrypt(b)).toBe('529.982.247-25');
  });

  it('rejeita payload adulterado', () => {
    const payload = service.encrypt('segredo');
    const tampered = payload.slice(0, -2) + 'AA';
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('gera tokens aleatórios e compara em tempo constante', () => {
    const t1 = service.randomToken();
    const t2 = service.randomToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThanOrEqual(43);
    expect(service.safeEqual(service.sha256(t1), service.sha256(t1))).toBe(true);
    expect(service.safeEqual(service.sha256(t1), service.sha256(t2))).toBe(false);
  });
});
