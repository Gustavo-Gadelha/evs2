import { InvalidTableError, listColumns } from "@/lib/sankhya/dictionary";
import { localOnly } from "@/lib/sankhya/route";

export const GET = localOnly(async (req) => {
  const table = new URL(req.url).searchParams.get("table") ?? "";
  try {
    return Response.json(await listColumns(table));
  } catch (err) {
    if (err instanceof InvalidTableError) {
      return Response.json({ error: { type: "InvalidTable", message: err.message } }, { status: 400 });
    }
    throw err;
  }
});
