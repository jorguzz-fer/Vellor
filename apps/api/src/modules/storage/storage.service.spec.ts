import { describe, expect, it } from 'vitest';
import { detectImageType } from './storage.service';

describe('detectImageType', () => {
  it('reconhece JPEG, PNG, WEBP e rejeita outros', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0]);
    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WEBP'),
      Buffer.alloc(4),
    ]);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(detectImageType(jpeg)?.mimeType).toBe('image/jpeg');
    expect(detectImageType(png)?.extension).toBe('png');
    expect(detectImageType(webp)?.mimeType).toBe('image/webp');
    expect(detectImageType(svg)).toBeNull();
    expect(detectImageType(Buffer.alloc(3))).toBeNull();
  });
});
