import { useCallback, useState } from "react";
import type { ActionFunctionArgs, LoaderFunction } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import db from "../db.server";

import {
  Page,
  Text,
  Card,
  Button,
  useIndexResourceState,
  TextField,
  IndexTable,
  ButtonGroup,
  Filters,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import exportToCSV from "app/utils";
import type { Order, Tag } from "@prisma/client";
import Multiselect from "app/components/MultiSelect";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const formData = await request.formData();
    const actionType = formData.get("actionType");
    const orderId = parseInt(formData.get("orderId") as string, 10);
    const tag = formData.get("tag")?.toString();

    if (!actionType || !orderId || !tag) {
      throw new Error("Missing required parameters");
    }

    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new Error("Order not found");
    }

    if (actionType === "addTag") {
      const createdTag = await db.tag.upsert({
        where: { name: tag },
        update: {},
        create: { name: tag },
      });

      await db.orderTag.upsert({
        where: { orderId_tagId: { orderId, tagId: createdTag.id } },
        update: {},
        create: { orderId, tagId: createdTag.id },
      });

      return new Response(JSON.stringify({ success: true, tag }), {
        status: 200,
      });
    }

    if (actionType === "removeTag") {
      const existingTag = await db.tag.findUnique({ where: { name: tag } });
      if (!existingTag) {
        throw new Error("Tag not found");
      }

      await db.orderTag.delete({
        where: { orderId_tagId: { orderId, tagId: existingTag.id } },
      });

      return new Response(JSON.stringify({ success: true, tag }), {
        status: 200,
      });
    }

    throw new Error("Invalid action type");
  } catch (error) {
    console.error("Error handling tag action:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500 },
    );
  }
};

export const loader: LoaderFunction = async ({
  request,
}): Promise<Response> => {
  await authenticate.admin(request);

  const orders = await db.order.findMany({
    include: {
      tags: {
        include: { tag: true },
      },
    },
  });
  const tags: Tag[] = await db.tag.findMany();

  const data = {
    orders: orders.map((order) => ({
      ...order,
      tags: order.tags.map((tag) => tag.tag.name),
    })),
    tags,
  };
  console.log("data", JSON.stringify(data));
  return Response.json(data);
};
export default function Index() {
  const { orders, tags } = useLoaderData<{
    orders: (Order & { tags: string[] })[];
    tags: Tag[];
  }>();
  const [taggedWith, setTaggedWith] = useState<string>("");
  const [queryValue, setQueryValue] = useState<string>("");
  const fetcher = useFetcher();

  const resourceName = {
    singular: "order",
    plural: "orders",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(orders);

  const handleTagUpdate = (
    orderId: number,
    tag: string,
    actionType: "addTag" | "removeTag",
  ) => {
    console.log("hello in handleTagUpdate");
    fetcher.submit(
      { orderId: orderId.toString(), tag, actionType },
      { method: "post" },
    );
  };
  const rowMarkup = orders.map((order, index) => (
    <IndexTable.Row
      id={order.shopifyOrderId.toString()}
      key={order.shopifyOrderId}
      selected={selectedResources.includes(order.shopifyOrderId.toString())}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          #{order.shopifyOrderId}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text fontWeight="bold" as="span">
          #{order.orderNumber}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>${Number(order.totalPrice).toFixed(2)}</IndexTable.Cell>
      <IndexTable.Cell>{order.paymentGateway || "-"}</IndexTable.Cell>
      <IndexTable.Cell>{order.customerEmail || "-"}</IndexTable.Cell>
      <IndexTable.Cell>{order.customerFullName || "-"}</IndexTable.Cell>
      <IndexTable.Cell>{order.customerAddress || "-"}</IndexTable.Cell>

      <IndexTable.Cell>
        <ButtonGroup>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}></div>

          <Multiselect
            availableTags={tags.map((tag) => tag.name)}
            selectedTags={order.tags}
            onTagSelect={(updatedTags) => {
              const newTags = updatedTags.filter(
                (t) => !order.tags.includes(t),
              );
              const removedTags = order.tags.filter(
                (t) => !updatedTags.includes(t),
              );

              newTags.forEach((tag) =>
                handleTagUpdate(order.id, tag, "addTag"),
              );
              removedTags.forEach((tag) =>
                handleTagUpdate(order.id, tag, "removeTag"),
              );
            }}
            onTagCreate={(newTag) =>
              handleTagUpdate(order.id, newTag, "addTag")
            }
          />
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
      fullWidth
      title="Orders"
      primaryAction={
        <Button
          onClick={() => {
            exportToCSV(orders, "orders.csv");
          }}
          variant="primary"
        >
          Export
        </Button>
      }
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
            { title: "Order Id" },
            { title: "Order Number" },
            { title: "Total Price" },
            { title: "Payment Gateway" },
            { title: "Customer Email" },
            { title: "Customer Full Name" },
            { title: "Customer Address" },
            { title: "Tags" },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
