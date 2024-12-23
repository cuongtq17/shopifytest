import type { ActionFunction, ActionFunctionArgs } from "@remix-run/node";
import db from "../db.server";

export const action: ActionFunction = async ({
  request,
}: ActionFunctionArgs) => {
  console.log("in webhook.app.orders_create");
  try {
    const shopId = request.headers.get("x-shopify-shop-domain") || "";
    const topic = request.headers.get("x-shopify-topic");
    const shop = request.headers.get("x-shopify-shop-domain");

    const payload = await request.json();
    console.log("payload", payload);
    console.log(`Received ${topic} webhook for ${shop}`);
    const orderData = {
      shopifyOrderId: payload.id?.toString(),
      orderNumber: payload.order_number,
      totalPrice: isFinite(parseFloat(payload.total_price))
        ? parseFloat(payload.total_price)
        : 0,
      paymentGateway: payload.payment_gateway_names?.[0] || null,
      customerEmail: payload.customer?.email || null,
      customerFullName:
        `${payload.customer?.first_name || ""} ${payload.customer?.last_name || ""}`.trim() ||
        null,
      customerAddress: payload.shipping_address?.address1 || null,
      shopId: shopId,
    };

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
