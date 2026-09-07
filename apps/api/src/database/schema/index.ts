import { relations } from 'drizzle-orm';
import {
  categories,
  collections,
  inventoryMovements,
  productImages,
  productVariants,
  products,
} from './catalog';
import { auditLogs, contactRequests, newsletterSubscribers, outboxEvents, settings } from './misc';
import {
  coupons,
  orderEvents,
  orderItems,
  orderNumberSeq,
  orders,
  paymentWebhookEvents,
} from './orders';
import { addresses, passwordResets, sessions, users } from './users';

export * from './enums';
export * from './users';
export * from './catalog';
export * from './orders';
export * from './misc';

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  addresses: many(addresses),
  orders: many(orders),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const passwordResetsRelations = relations(passwordResets, ({ one }) => ({
  user: one(users, { fields: [passwordResets.userId], references: [users.id] }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  collections: many(collections),
  products: many(products),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  category: one(categories, { fields: [collections.categoryId], references: [categories.id] }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  collection: one(collections, { fields: [products.collectionId], references: [collections.id] }),
  images: many(productImages),
  variants: many(productVariants),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
  variant: one(productVariants, {
    fields: [productImages.variantId],
    references: [productVariants.id],
  }),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  image: one(productImages, { fields: [productVariants.imageId], references: [productImages.id] }),
  movements: many(inventoryMovements),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  variant: one(productVariants, {
    fields: [inventoryMovements.variantId],
    references: [productVariants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
  items: many(orderItems),
  events: many(orderEvents),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
}));

export const contactRequestsRelations = relations(contactRequests, ({ one }) => ({
  product: one(products, { fields: [contactRequests.productId], references: [products.id] }),
}));

export const schema = {
  users,
  sessions,
  passwordResets,
  addresses,
  categories,
  collections,
  products,
  productImages,
  productVariants,
  inventoryMovements,
  coupons,
  orders,
  orderItems,
  orderEvents,
  paymentWebhookEvents,
  outboxEvents,
  contactRequests,
  newsletterSubscribers,
  settings,
  auditLogs,
  orderNumberSeq,
  usersRelations,
  sessionsRelations,
  passwordResetsRelations,
  addressesRelations,
  categoriesRelations,
  collectionsRelations,
  productsRelations,
  productImagesRelations,
  productVariantsRelations,
  inventoryMovementsRelations,
  ordersRelations,
  orderItemsRelations,
  orderEventsRelations,
  contactRequestsRelations,
};
