export const updateOrderTags = async (session, orderId, tags) => {
  const shop = session.shop;
  const accessToken = session.accessToken;

  console.log("orderId", orderId);

  const query = `
    mutation UpdateOrderTags($input: OrderInput!) {
      orderUpdate(input: $input) {
        order {
          id
          tags
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      id: `gid://shopify/Order/${orderId}`, // Shopify's global ID format
      tags, // Pass the array of tags
    },
  };

  const response = await fetch(
    `https://${shop}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  const result = await response.json();

  console.log("result", result);

  // Check for errors
  if (result.errors || result.data.orderUpdate.userErrors.length > 0) {
    throw new Error(
      `Failed to update order tags: ${
        result.errors
          ? result.errors[0].message
          : result.data.orderUpdate.userErrors[0].message
      }`,
    );
  }

  return result.data.orderUpdate.order;
};
