import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import db from "../../db.server";

export const loader: LoaderFunction = async () => {
  try {
    const tags = await db.tag.findMany({
      orderBy: { name: "asc" },
    });

    return Response.json({ tags });
  } catch (error) {
    console.error("Error fetching tags:", error);
    return Response.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
};

export const action: ActionFunction = async ({ request }) => {
  try {
    const formData = await request.formData();
    const name = formData.get("name")?.toString();

    if (!name) {
      return Response.json({ error: "Tag name is required" }, { status: 400 });
    }

    const tag = await db.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    return Response.json({ tag });
  } catch (error) {
    console.error("Error creating/updating tag:", error);
    return Response.json(
      { error: "Failed to create or update tag" },
      { status: 500 },
    );
  }
};
