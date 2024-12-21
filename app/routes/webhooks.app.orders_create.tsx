import type { ActionFunction } from "@remix-run/node";
import db from "../db.server";
import { authenticate } from "app/shopify.server";

export const action: ActionFunction = async ({ request }) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  const shopId = request.headers.get("x-shopify-shop-domain");
  console.log(`Received ${topic} webhook for ${shop}`);

  console.log("Payload", payload);

  try {
    const orderData = {
      shopifyOrderId: payload.id.toString(),
      orderNumber: payload.order_number,
      totalPrice: payload.total_price,
      paymentGateway: payload.payment_gateway_names[0] || null,
      customerEmail: payload.customer?.email,
      customerFullName:
        `${payload.customer?.first_name} ${payload.customer?.last_name}`.trim(),
      customerAddress: payload.shipping_address.address1 || "",
      tags: payload.tags || [],
      shopId: shopId,
    };

    await db.order.create({
      data: orderData,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return Response.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
  }
};
