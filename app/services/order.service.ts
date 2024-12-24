import type { Order } from "@prisma/client";
import db from "../db.server";
import {
  toCreateOrderDto,
  toUpdateOrderDto,
} from "app/transformers/toCreateOrderDto";

export function createOrder(raw: Record<string, any>): Promise<Order> {
  const data = toCreateOrderDto(raw);
  return db.order.create({
    data,
  });
}

export function updateOrder(raw: Record<string, any>): Promise<Order> {
  const data = toUpdateOrderDto(raw);
  return db.order.update({
    where: { shopifyOrderId: data.shopifyOrderId },
    data,
  });
}
