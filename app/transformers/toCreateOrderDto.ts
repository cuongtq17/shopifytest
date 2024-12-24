export interface CreateOrderDto {
  shopifyOrderId: string;
  orderNumber: number | null;
  totalPrice: number | null;
  paymentGateway: string | null;
  customerEmail: string | null;
  customerFullName: string | null;
  customerAddress: string | null;
  shopId: string | null;
}

export interface UpdateOrderDto extends CreateOrderDto {}

export function toCreateOrderDto(rawData: Record<string, any>): CreateOrderDto {
  return {
    shopifyOrderId: String(rawData.id),
    orderNumber: rawData.order_number || null,
    totalPrice: isFinite(parseFloat(rawData.total_price))
      ? parseFloat(rawData.total_price)
      : null,
    paymentGateway: rawData.payment_gateway_names?.[0] || null,
    customerEmail: rawData.customer?.email || null,
    customerFullName:
      `${rawData.customer?.first_name || ""} ${rawData.customer?.last_name || ""}`.trim() ||
      null,
    customerAddress: rawData.shipping_address?.address || null,
    shopId: rawData.shopId || null,
  };
}

export function toUpdateOrderDto(rawData: Record<string, any>): UpdateOrderDto {
  return {
    shopifyOrderId: String(rawData.order_id),
    orderNumber: rawData.order_number || null,
    totalPrice: isFinite(parseFloat(rawData.total_price))
      ? parseFloat(rawData.total_price)
      : null,
    paymentGateway: rawData.payment_gateway_names?.[0] || null,
    customerEmail: rawData.customer?.email || null,
    customerFullName:
      `${rawData.customer?.first_name || ""} ${rawData.customer?.last_name || ""}`.trim() ||
      null,
    customerAddress: rawData.shipping_address?.address || null,
    shopId: rawData.shopId || null,
  };
}
