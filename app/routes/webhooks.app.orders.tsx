import type { ActionFunction, ActionFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import {
  toCreateOrderDto,
  toUpdateOrderDto,
} from "app/transformers/toCreateOrderDto";
import { authenticate } from "app/shopify.server";

export const action: ActionFunction = async ({
  request,
}: ActionFunctionArgs) => {
  try {
    console.log("Start processing request", request);
    const { admin, session, payload } = await authenticate.webhook(request);
    console.log("admin", admin);
    console.log("session", session);
    const topic = request.headers.get("x-shopify-topic");
    const shop = request.headers.get("x-shopify-shop-domain");

    console.log(`Received ${topic} webhook for ${shop}`);
    console.log("payload", payload);
    let orderData;
    switch (topic) {
      case "orders/create":
        orderData = toCreateOrderDto(payload);
        break;
      case "orders/edited":
        orderData = toUpdateOrderDto(payload);
        break;
      case "orders/updated":
        orderData = toCreateOrderDto(payload);
        break;

      default:
        break;
    }
    if (!orderData) return;

    console.log("orderData", orderData);
    const order = await db.order.upsert({
      where: { shopifyOrderId: orderData.shopifyOrderId },
      update: orderData,
      create: orderData,
    });

    const tags: string[] = payload.tags
      ? payload.tags.split(",").map((tag: string) => tag.trim())
      : [];

    const tagRecords = await Promise.all(
      tags.map(async (tagName) => {
        return db.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        });
      }),
    );

    const existingTags = await db.orderTag.findMany({
      where: { orderId: order.id },
    });

    const existingTagIds = existingTags.map((tag) => tag.tagId);
    const newTagIds = tagRecords.map((tag) => tag.id);

    await db.orderTag.deleteMany({
      where: {
        orderId: order.id,
        tagId: { notIn: newTagIds },
      },
    });

    const newOrderTags = newTagIds
      .filter((tagId) => !existingTagIds.includes(tagId))
      .map((tagId) => ({
        orderId: order.id,
        tagId: tagId,
      }));

    await db.orderTag.createMany({
      data: newOrderTags,
    });

    return Response.json({ success: true, data: order }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return Response.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
  }
};
