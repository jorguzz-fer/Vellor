import { Injectable } from '@nestjs/common';
import type { Address, SaveAddressInput } from '@vellor/shared';
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { NotFoundError } from '../../common/errors';
import { type Database, InjectDb } from '../../database/database.module';
import { addresses } from '../../database/schema';

type AddressRow = typeof addresses.$inferSelect;

export function toAddress(row: AddressRow): Address {
  return {
    id: row.id,
    label: row.label,
    isDefault: row.isDefault,
    recipientName: row.recipientName ?? undefined,
    cep: row.cep,
    street: row.street,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state as Address['state'],
    reference: row.reference,
  };
}

@Injectable()
export class AccountService {
  constructor(@InjectDb() private readonly db: Database) {}

  async listAddresses(userId: string): Promise<Address[]> {
    const rows = await this.db.query.addresses.findMany({
      where: eq(addresses.userId, userId),
      orderBy: [desc(addresses.isDefault), asc(addresses.createdAt)],
    });
    return rows.map(toAddress);
  }

  private columns(input: SaveAddressInput) {
    return {
      label: input.label ?? null,
      recipientName: input.recipientName ?? null,
      cep: input.cep,
      street: input.street,
      number: input.number,
      complement: input.complement ?? null,
      district: input.district,
      city: input.city,
      state: input.state,
      reference: input.reference ?? null,
      updatedAt: new Date(),
    };
  }

  async createAddress(userId: string, input: SaveAddressInput): Promise<Address> {
    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.userId, userId));
      const isDefault = input.isDefault ?? existing.length === 0;
      if (isDefault)
        await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
      const [row] = await tx
        .insert(addresses)
        .values({ userId, ...this.columns(input), isDefault })
        .returning();
      return toAddress(row!);
    });
  }

  async updateAddress(userId: string, id: string, input: SaveAddressInput): Promise<Address> {
    return this.db.transaction(async (tx) => {
      if (input.isDefault) {
        await tx
          .update(addresses)
          .set({ isDefault: false })
          .where(and(eq(addresses.userId, userId), ne(addresses.id, id)));
      }
      const [row] = await tx
        .update(addresses)
        .set({
          ...this.columns(input),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        })
        .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
        .returning();
      if (!row) throw new NotFoundError('Endereço não encontrado', 'address_not_found');
      return toAddress(row);
    });
  }

  async deleteAddress(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
      .returning();
    if (!row) throw new NotFoundError('Endereço não encontrado', 'address_not_found');
    if (row.isDefault) {
      const next = await this.db.query.addresses.findFirst({
        where: eq(addresses.userId, userId),
        orderBy: [asc(addresses.createdAt)],
      });
      if (next)
        await this.db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
    }
  }
}
