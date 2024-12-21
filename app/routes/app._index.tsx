import { useCallback, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import db from "../db.server";

import {
  Page,
  Text,
  Card,
  Button,
  useIndexResourceState,
  TextField,
  IndexTable,
  Badge,
  ButtonGroup,
  Tag,
  Filters,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Fetch orders from SQLite
  await authenticate.admin(request);

  const orders = await db.order.findMany();

  return Response.json({ orders });
};

export default function Index() {
  const { orders } = useLoaderData<typeof loader>();
  const [taggedWith, setTaggedWith] = useState<string>("");
  const [queryValue, setQueryValue] = useState<string>("");
  console.log("orders", orders);
  const resourceName = {
    singular: "order",
    plural: "orders",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(orders);

  const rowMarkup = orders.map((order, index) => (
    <IndexTable.Row
      id={order.id.toString()}
      key={order.id}
      selected={selectedResources.includes(order.id.toString())}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          #{order.orderNumber}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{order.customerEmail || "No customer"}</IndexTable.Cell>
      <IndexTable.Cell>{order.channel || "-"}</IndexTable.Cell>
      <IndexTable.Cell>${Number(order.totalPrice).toFixed(2)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge progress="complete" tone="success">
          {order.paymentStatus || "Paid"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge progress="incomplete" tone="attention">
          {order.fulfillmentStatus || "Unfulfilled"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{order.items || "1 item"}</IndexTable.Cell>
      <IndexTable.Cell>
        {order.deliveryStatus || "Shipping not required"}
      </IndexTable.Cell>
      <IndexTable.Cell>{order.deliveryMethod || "-"}</IndexTable.Cell>
      <IndexTable.Cell>
        <ButtonGroup>
          {order.tags
            ?.split(",")
            .map((tag: string) => <Tag key={tag.trim()}>{tag.trim()}</Tag>)}
          <Button size="micro" variant="tertiary">
            Add tag
          </Button>
        </ButtonGroup>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const filters = [
    {
      key: "taggedWith",
      label: "Tagged with",
      filter: (
        <TextField
          label="Tagged with"
          value={taggedWith}
          onChange={setTaggedWith}
          autoComplete="off"
          labelHidden
        />
      ),
      shortcut: true,
    },
  ];

  const handleFiltersQueryChange = useCallback(
    (value: string) => setQueryValue(value),
    [],
  );

  const handleTaggedWithRemove = useCallback(() => setTaggedWith(""), []);

  const handleQueryValueRemove = useCallback(() => setQueryValue(""), []);

  const handleFiltersClearAll = useCallback(() => {
    handleTaggedWithRemove();
    handleQueryValueRemove();
  }, [handleQueryValueRemove, handleTaggedWithRemove]);

  return (
    <Page
      title="Orders"
      primaryAction={<Button variant="primary">Export</Button>}
    >
      <Card>
        <div style={{ padding: "16px", display: "flex" }}>
          <div style={{ flex: 1 }}>
            <Filters
              queryValue={queryValue}
              filters={filters}
              onQueryChange={handleFiltersQueryChange}
              onQueryClear={handleQueryValueRemove}
              onClearAll={handleFiltersClearAll}
            />
          </div>
        </div>
        <IndexTable
          resourceName={resourceName}
          itemCount={orders.length}
          selectedItemsCount={
            allResourcesSelected ? "All" : selectedResources.length
          }
          onSelectionChange={handleSelectionChange}
          headings={[
            { title: "Order" },
            { title: "Customer" },
            { title: "Channel" },
            { title: "Total" },
            { title: "Payment status" },
            { title: "Fulfillment status" },
            { title: "Items" },
            { title: "Delivery status" },
            { title: "Delivery method" },
            { title: "Tags" },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
