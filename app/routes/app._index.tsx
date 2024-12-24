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
import { updateOrderTags } from "app/services/tag.service";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);

    const formData = await request.formData();
    const actionType = formData.get("actionType");
    const orderId = parseInt(formData.get("orderId") as string, 10);
    const tag = formData.get("tag")?.toString() || "";

    if (!actionType || !orderId) {
      throw new Error("Missing required parameters");
    }

    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new Error("Order not found");
    }

    switch (actionType) {
      case "addTag":
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

        const orderTags = await db.orderTag.findMany({
          include: { tag: true },
        });
        const tags = orderTags.map((orderTag) => orderTag.tag.name);

        updateOrderTags(session, order.shopifyOrderId, tags);

        return new Response(JSON.stringify({ success: true, tag }), {
          status: 200,
        });
      case "removeTag":
        const existingTag = await db.tag.findUnique({ where: { name: tag } });
        if (!existingTag) {
          throw new Error("Tag not found");
        }

        await db.orderTag.delete({
          where: { orderId_tagId: { orderId, tagId: existingTag.id } },
        });

        const remaining = await db.orderTag.findMany({
          include: { tag: true },
        });
        const latestTags = remaining.map((orderTag) => orderTag.tag.name);

        updateOrderTags(session, order.shopifyOrderId, latestTags);

        return new Response(JSON.stringify({ success: true, tag }), {
          status: 200,
        });
      case "updateOrder":
        if (!orderId) {
          throw new Error("Missing order ID for updateOrder");
        }

        const updates: Partial<Order> = {};
        if (formData.has("orderNumber")) {
          updates.orderNumber = parseInt(
            formData.get("orderNumber") as string,
            10,
          );
        }
        if (formData.has("totalPrice")) {
          updates.totalPrice = parseFloat(formData.get("totalPrice") as string);
        }
        if (formData.has("paymentGateway")) {
          updates.paymentGateway = formData.get("paymentGateway")?.toString();
        }
        if (formData.has("customerEmail")) {
          updates.customerEmail = formData.get("customerEmail")?.toString();
        }
        if (formData.has("customerFullName")) {
          updates.customerFullName = formData
            .get("customerFullName")
            ?.toString();
        }
        if (formData.has("customerAddress")) {
          updates.customerAddress = formData.get("customerAddress")?.toString();
        }
        await db.order.update({
          where: { id: orderId },
          data: updates,
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
      default:
        throw new Error("Invalid action type");
    }
  } catch (error: any) {
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
  return Response.json(data);
};
export default function Index() {
  const { orders, tags } = useLoaderData<{
    orders: (Order & { tags: string[] })[];
    tags: Tag[];
  }>();
  const [taggedWith, setTaggedWith] = useState<string>("");
  const [queryValue, setQueryValue] = useState<string>("");
  const [editingRows, setEditingRows] = useState<Record<number, boolean>>({});
  const [updatedOrders, setUpdatedOrders] = useState<
    Record<number, Partial<Order>>
  >({});

  const fetcher = useFetcher();

  const resourceName = {
    singular: "order",
    plural: "orders",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(orders);

  const handleFieldChange = useCallback(
    (orderId: number, field: keyof Order, value: string | number) => {
      setUpdatedOrders((prev) => ({
        ...prev,
        [orderId]: {
          ...prev[orderId],
          [field]: value,
        },
      }));
    },
    [],
  );

  const toggleEditing = useCallback((orderId: number) => {
    setEditingRows((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  }, []);

  const saveOrder = useCallback(
    (orderId: number) => {
      const updatedOrder = updatedOrders[orderId];
      if (updatedOrder) {
        fetcher.submit(
          {
            ...updatedOrder,
            orderId: orderId.toString(),
            actionType: "updateOrder",
          },
          { method: "post" },
        );
      }
      toggleEditing(orderId);
    },
    [fetcher, updatedOrders, toggleEditing],
  );

  const handleTagUpdate = (
    orderId: number,
    tag: string,
    actionType: "addTag" | "removeTag",
  ) => {
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
      <IndexTable.Cell>
        {editingRows[order.id] ? (
          <TextField
            label
            autoComplete="off"
            value={
              updatedOrders[order.id]?.totalPrice?.toString() ||
              order.totalPrice.toString()
            }
            onChange={(value) =>
              handleFieldChange(
                order.id,
                "totalPrice",
                isFinite(parseFloat(value)) ? parseFloat(value) : 0,
              )
            }
          />
        ) : (
          <Text as="dd">${Number(order.totalPrice).toFixed(2)}</Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {editingRows[order.id] ? (
          <TextField
            label=""
            autoComplete="off"
            value={
              updatedOrders[order.id]?.paymentGateway ||
              order.paymentGateway ||
              ""
            }
            onChange={(value) =>
              handleFieldChange(order.id, "paymentGateway", value)
            }
          />
        ) : (
          <Text as="dd">{order.paymentGateway || "-"}</Text>
        )}
      </IndexTable.Cell>{" "}
      <IndexTable.Cell>
        {editingRows[order.id] ? (
          <TextField
            label=""
            autoComplete="off"
            value={
              updatedOrders[order.id]?.customerEmail ||
              order.customerEmail ||
              ""
            }
            onChange={(value) =>
              handleFieldChange(order.id, "customerEmail", value)
            }
          />
        ) : (
          <Text as="dd">{order.customerEmail || "-"}</Text>
        )}
      </IndexTable.Cell>{" "}
      <IndexTable.Cell>
        {editingRows[order.id] ? (
          <TextField
            label=""
            autoComplete="off"
            value={
              updatedOrders[order.id]?.customerFullName ||
              order.customerFullName ||
              ""
            }
            onChange={(value) =>
              handleFieldChange(order.id, "customerFullName", value)
            }
          />
        ) : (
          <Text as="dd">{order.customerFullName || "-"}</Text>
        )}
      </IndexTable.Cell>{" "}
      <IndexTable.Cell>
        {editingRows[order.id] ? (
          <TextField
            label=""
            autoComplete="off"
            value={
              updatedOrders[order.id]?.customerAddress ||
              order.customerAddress ||
              ""
            }
            onChange={(value) =>
              handleFieldChange(order.id, "customerAddress", value)
            }
          />
        ) : (
          <Text as="dd">{order.customerAddress || "-"}</Text>
        )}
      </IndexTable.Cell>{" "}
      <IndexTable.Cell>
        <ButtonGroup>
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
      <IndexTable.Cell>
        <div onClick={(e) => e.stopPropagation()}>
          {editingRows[order.id] ? (
            <>
              <Button onClick={() => saveOrder(order.id)}>Save</Button>
              <Button onClick={() => toggleEditing(order.id)}>Cancel</Button>
            </>
          ) : (
            <Button onClick={() => toggleEditing(order.id)}>Edit</Button>
          )}
        </div>
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
            { title: "Actions" },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
