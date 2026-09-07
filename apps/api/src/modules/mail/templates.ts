import { formatBRL, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, type Order } from '@vellor/shared';

interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

function layout(storeName: string, title: string, bodyHtml: string, footer: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#101f20;font-family:Georgia,serif;color:#f4efe6">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px">
    <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #1c3836">
      <div style="font-size:28px;letter-spacing:0.3em;color:#c8a25c">${escapeHtml(storeName.toUpperCase())}</div>
    </div>
    <h1 style="font-size:22px;font-weight:normal;letter-spacing:0.05em;margin:28px 0 12px">${escapeHtml(title)}</h1>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#ede7dc">${bodyHtml}</div>
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #1c3836;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8fa19f">${footer}</div>
  </div></body></html>`;
}

function orderItemsTable(order: Order): string {
  const rows = order.items
    .map(
      (item) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #1c3836">${escapeHtml(item.name)}<br><span style="color:#8fa19f">${escapeHtml(item.variantName)} · ${item.quantity}x</span></td><td style="padding:6px 0;border-bottom:1px solid #1c3836;text-align:right;white-space:nowrap">${formatBRL(item.totalCents)}</td></tr>`,
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}
    <tr><td style="padding:6px 0;color:#8fa19f">Subtotal</td><td style="text-align:right">${formatBRL(order.subtotalCents)}</td></tr>
    ${order.discountCents > 0 ? `<tr><td style="padding:6px 0;color:#8fa19f">Desconto${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ''}</td><td style="text-align:right">-${formatBRL(order.discountCents)}</td></tr>` : ''}
    <tr><td style="padding:6px 0;color:#8fa19f">Frete com seguro (${escapeHtml(order.shippingService)})</td><td style="text-align:right">${formatBRL(order.shippingCents + order.insuranceCents)}</td></tr>
    <tr><td style="padding:10px 0;font-weight:bold;color:#c8a25c">Total</td><td style="text-align:right;font-weight:bold;color:#c8a25c">${formatBRL(order.totalCents)}</td></tr>
  </table>`;
}

function orderItemsText(order: Order): string {
  return [
    ...order.items.map(
      (i) => `- ${i.name} (${i.variantName}) x${i.quantity}: ${formatBRL(i.totalCents)}`,
    ),
    `Subtotal: ${formatBRL(order.subtotalCents)}`,
    order.discountCents > 0 ? `Desconto: -${formatBRL(order.discountCents)}` : '',
    `Frete com seguro: ${formatBRL(order.shippingCents + order.insuranceCents)}`,
    `Total: ${formatBRL(order.totalCents)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export interface TemplateContext {
  storeName: string;
  appUrl: string;
  supportEmail: string;
  whatsapp: string;
}

export function orderCreatedTemplate(
  ctx: TemplateContext,
  order: Order,
  orderUrl: string,
): Rendered {
  const method = PAYMENT_METHOD_LABELS[order.payment.method];
  let paymentHtml = '';
  let paymentText = '';
  if (order.payment.method === 'pix' && order.payment.pix) {
    paymentHtml = `<p>Pague com <strong>Pix</strong> copiando o código abaixo no app do seu banco. O código expira em breve.</p>
      <p style="word-break:break-all;background:#0e1b1a;padding:12px;border:1px solid #1c3836;font-family:monospace;font-size:12px">${escapeHtml(order.payment.pix.payload)}</p>`;
    paymentText = `Pague com Pix usando o código copia e cola:\n${order.payment.pix.payload}`;
  } else if (order.payment.method === 'boleto' && order.payment.boleto) {
    paymentHtml = `<p>Seu <strong>boleto</strong> vence em ${escapeHtml(order.payment.boleto.dueDate)}. <a href="${escapeHtml(order.payment.boleto.url)}" style="color:#c8a25c">Abrir boleto</a></p>`;
    paymentText = `Boleto (vencimento ${order.payment.boleto.dueDate}): ${order.payment.boleto.url}`;
  } else if (order.payment.method === 'credit_card' && order.payment.creditCard) {
    paymentHtml = `<p>Conclua o pagamento no <strong>cartão de crédito</strong> em ${order.payment.installments}x de ${formatBRL(order.payment.installmentCents)} pelo link seguro: <a href="${escapeHtml(order.payment.creditCard.checkoutUrl)}" style="color:#c8a25c">Pagar agora</a></p>`;
    paymentText = `Pague com cartão (${order.payment.installments}x de ${formatBRL(order.payment.installmentCents)}): ${order.payment.creditCard.checkoutUrl}`;
  }
  const body = `<p>Olá, ${escapeHtml(order.customer.name)}. Recebemos seu pedido <strong>${escapeHtml(order.number)}</strong>.</p>
    ${orderItemsTable(order)}
    <p><strong>Forma de pagamento:</strong> ${escapeHtml(method)}</p>
    ${paymentHtml}
    <p>Acompanhe o pedido em <a href="${escapeHtml(orderUrl)}" style="color:#c8a25c">${escapeHtml(orderUrl)}</a>.</p>`;
  return {
    subject: `Pedido ${order.number} recebido · ${ctx.storeName}`,
    html: layout(ctx.storeName, 'Recebemos seu pedido', body, footer(ctx)),
    text: `Olá, ${order.customer.name}. Recebemos seu pedido ${order.number}.\n\n${orderItemsText(order)}\n\nForma de pagamento: ${method}\n${paymentText}\n\nAcompanhe em: ${orderUrl}`,
  };
}

export function paymentConfirmedTemplate(
  ctx: TemplateContext,
  order: Order,
  orderUrl: string,
): Rendered {
  const body = `<p>Olá, ${escapeHtml(order.customer.name)}. O pagamento do pedido <strong>${escapeHtml(order.number)}</strong> foi confirmado.</p>
    <p>Agora vamos preparar sua peça com todo o cuidado. Você receberá o código de rastreio assim que o envio segurado for postado nos Correios.</p>
    ${orderItemsTable(order)}
    <p><a href="${escapeHtml(orderUrl)}" style="color:#c8a25c">Ver pedido</a></p>`;
  return {
    subject: `Pagamento confirmado · Pedido ${order.number}`,
    html: layout(ctx.storeName, 'Pagamento confirmado', body, footer(ctx)),
    text: `Olá, ${order.customer.name}. O pagamento do pedido ${order.number} foi confirmado.\n\n${orderItemsText(order)}\n\nVer pedido: ${orderUrl}`,
  };
}

export function orderShippedTemplate(
  ctx: TemplateContext,
  order: Order,
  orderUrl: string,
): Rendered {
  const tracking = order.trackingCode ?? '';
  const trackingUrl = order.trackingUrl ?? '';
  const body = `<p>Olá, ${escapeHtml(order.customer.name)}. Seu pedido <strong>${escapeHtml(order.number)}</strong> foi postado nos Correios com seguro.</p>
    <p><strong>Código de rastreio:</strong> ${escapeHtml(tracking)}<br>
    ${trackingUrl ? `<a href="${escapeHtml(trackingUrl)}" style="color:#c8a25c">Rastrear encomenda</a>` : ''}</p>
    <p>Prazo estimado: ${order.shippingDeadlineDays} dia(s) útil(eis) após a postagem.</p>
    <p><a href="${escapeHtml(orderUrl)}" style="color:#c8a25c">Ver pedido</a></p>`;
  return {
    subject: `Pedido ${order.number} enviado · rastreio ${tracking}`,
    html: layout(ctx.storeName, 'Seu pedido foi enviado', body, footer(ctx)),
    text: `Olá, ${order.customer.name}. Seu pedido ${order.number} foi postado.\nRastreio: ${tracking}\n${trackingUrl}\n\nVer pedido: ${orderUrl}`,
  };
}

export function orderStatusTemplate(
  ctx: TemplateContext,
  order: Order,
  orderUrl: string,
): Rendered {
  const label = ORDER_STATUS_LABELS[order.status];
  const body = `<p>Olá, ${escapeHtml(order.customer.name)}. O pedido <strong>${escapeHtml(order.number)}</strong> agora está com o status <strong>${escapeHtml(label)}</strong>.</p>
    <p><a href="${escapeHtml(orderUrl)}" style="color:#c8a25c">Ver pedido</a></p>`;
  return {
    subject: `Pedido ${order.number}: ${label}`,
    html: layout(ctx.storeName, label, body, footer(ctx)),
    text: `Olá, ${order.customer.name}. O pedido ${order.number} agora está: ${label}.\nVer pedido: ${orderUrl}`,
  };
}

export function passwordResetTemplate(ctx: TemplateContext, name: string, link: string): Rendered {
  const body = `<p>Olá, ${escapeHtml(name)}. Recebemos um pedido para redefinir sua senha.</p>
    <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#c8a25c;color:#0e1b1a;text-decoration:none;letter-spacing:0.1em">REDEFINIR SENHA</a></p>
    <p>O link vale por 1 hora. Se você não pediu isso, ignore este e-mail.</p>`;
  return {
    subject: `Redefinição de senha · ${ctx.storeName}`,
    html: layout(ctx.storeName, 'Redefinir senha', body, footer(ctx)),
    text: `Olá, ${name}. Para redefinir sua senha acesse (válido por 1 hora): ${link}\nSe você não pediu isso, ignore este e-mail.`,
  };
}

export function welcomeTemplate(ctx: TemplateContext, name: string): Rendered {
  const body = `<p>Olá, ${escapeHtml(name)}. Sua conta na ${escapeHtml(ctx.storeName)} foi criada.</p>
    <p>Aqui você acompanha pedidos, salva endereços e recebe em primeira mão as novidades em relógios e perfumes de nicho.</p>
    <p><a href="${escapeHtml(ctx.appUrl)}" style="color:#c8a25c">Visitar a loja</a></p>`;
  return {
    subject: `Bem-vindo à ${ctx.storeName}`,
    html: layout(ctx.storeName, 'Bem-vindo', body, footer(ctx)),
    text: `Olá, ${name}. Sua conta na ${ctx.storeName} foi criada. Visite: ${ctx.appUrl}`,
  };
}

export function contactReceivedTemplate(ctx: TemplateContext, name: string): Rendered {
  const body = `<p>Olá, ${escapeHtml(name)}. Recebemos sua mensagem e nosso atendimento responderá em breve.</p>
    <p>Se preferir, fale conosco pelo WhatsApp: <a href="https://wa.me/${escapeHtml(ctx.whatsapp)}" style="color:#c8a25c">${escapeHtml(ctx.whatsapp)}</a>.</p>`;
  return {
    subject: `Recebemos sua mensagem · ${ctx.storeName}`,
    html: layout(ctx.storeName, 'Mensagem recebida', body, footer(ctx)),
    text: `Olá, ${name}. Recebemos sua mensagem e responderemos em breve. WhatsApp: ${ctx.whatsapp}`,
  };
}

export function adminNotificationTemplate(
  ctx: TemplateContext,
  title: string,
  lines: string[],
  link?: string,
): Rendered {
  const body = `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>${link ? `<p><a href="${escapeHtml(link)}" style="color:#c8a25c">Abrir no painel</a></p>` : ''}`;
  return {
    subject: `[Admin] ${title}`,
    html: layout(ctx.storeName, title, body, footer(ctx)),
    text: `${title}\n${lines.join('\n')}${link ? `\n${link}` : ''}`,
  };
}

function footer(ctx: TemplateContext): string {
  return `${escapeHtml(ctx.storeName)} · Atendimento: ${escapeHtml(ctx.supportEmail)} · WhatsApp ${escapeHtml(ctx.whatsapp)}<br>Este é um e-mail automático; para falar conosco use os canais acima.`;
}
