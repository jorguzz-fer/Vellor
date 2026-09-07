import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

/** TOTP (RFC 6238) compatível com Google Authenticator, Authy, 1Password etc. */
@Injectable()
export class MfaService {
  constructor() {
    authenticator.options = { window: 1 };
  }

  generateSecret(): string {
    return authenticator.generateSecret(20);
  }

  keyUri(email: string, secret: string, issuer = 'Vellor'): string {
    return authenticator.keyuri(email, issuer, secret);
  }

  qrDataUrl(uri: string): Promise<string> {
    return QRCode.toDataURL(uri, { margin: 1, width: 240 });
  }

  verify(code: string, secret: string): boolean {
    try {
      return authenticator.check(code, secret);
    } catch {
      return false;
    }
  }
}
