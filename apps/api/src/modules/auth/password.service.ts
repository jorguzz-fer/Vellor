import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** Parâmetros OWASP (2023) para Argon2id: 19 MiB de memória, 2 iterações, 1 thread. */
const ARGON2_OPTIONS = {
  algorithm: 2 /* Argon2id */,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService {
  private readonly dummyHash = hash('dummy-password-for-constant-time', ARGON2_OPTIONS);

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(hashed: string, password: string): Promise<boolean> {
    try {
      return await verify(hashed, password, ARGON2_OPTIONS);
    } catch {
      return false;
    }
  }

  /** Executa uma verificação fictícia para que "usuário inexistente" custe o mesmo tempo que "senha errada". */
  async dummyVerify(): Promise<void> {
    try {
      await verify(await this.dummyHash, 'not-the-password', ARGON2_OPTIONS);
    } catch {
      // ignorado: só interessa o tempo gasto
    }
  }
}
