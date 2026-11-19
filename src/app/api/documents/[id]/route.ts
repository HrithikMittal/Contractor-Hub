import { getDb, one } from "@/lib/db";
import { getProfile } from "@/lib/session";
import { getFile } from "@/lib/storage";

// Inline-viewable types; everything else is forced to download.
const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"]);

export async function GET(req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const me = await getProfile();
  if (!me) return new Response("Please sign in", { status: 401 });
  const { id } = await ctx.params;
  const doc = one(
    await (await getDb()).query<{ file_name: string; storage_path: string; mime_type: string }>(
      "select file_name, storage_path, mime_type from eor.documents where id = $1 and user_id = $2",
      [Number(id) || 0, me.id],
    ),
  );
  if (!doc) return new Response("Not found", { status: 404 });

  const data = await getFile(doc.storage_path);
  if (!data) return new Response("This document has no file attached (or it was removed from storage).", { status: 410 });

  const download = new URL(req.url).searchParams.has("download") || !INLINE.has(doc.mime_type);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": INLINE.has(doc.mime_type) ? doc.mime_type : "application/octet-stream",
      "Content-Length": String(data.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
