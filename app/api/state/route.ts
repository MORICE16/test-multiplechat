import { env } from "cloudflare:workers";
import { now, userId } from "@/app/lib/runtime";

export async function GET(request: Request) {
  const uid = userId(request);
  await env.DB.prepare("UPDATE morice_items SET title = ?, updated_at = ? WHERE id IN ('chat', ?) AND user_id = ? AND title = ?").bind("Agir avec Morice",now(),`${uid}:chat`,uid,"Parler à Morice").run();
  let itemRows = await env.DB.prepare("SELECT id, kind, title, content, status, priority, position FROM morice_items WHERE user_id = ? ORDER BY position, created_at DESC").bind(uid).all();
  if (!itemRows.results.some((row: Record<string, unknown>) => row.kind === "module")) {
    const modules = [["chat","Agir avec Morice","✦"],["mail","Mail & Brouillons","✉"],["hubspot","HubSpot","◎"],["tasks","Tâches","✓"],["calendar","Agenda","□"],["approvals","Validations","◆"],["documents","Documents","▤"],["memory","Mémoire","◉"],["connections","Connexions","⌁"]];
    await env.DB.batch(modules.map(([id,title,icon],position) => env.DB.prepare("INSERT OR IGNORE INTO morice_items(id,user_id,kind,title,content,status,priority,position,created_at,updated_at) VALUES(?,?,'module',?,?,'active','normal',?,?,?)").bind(`${uid}:${id}`,uid,title,icon,position,now(),now())));
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO morice_settings(user_id,key,value) VALUES(?,?,?)").bind(uid,"digest_times",JSON.stringify(["08:00","13:00","18:30"])),
      env.DB.prepare("INSERT OR IGNORE INTO morice_settings(user_id,key,value) VALUES(?,?,?)").bind(uid,"urgent_notifications","true"),
    ]);
    itemRows = await env.DB.prepare("SELECT id, kind, title, content, status, priority, position FROM morice_items WHERE user_id = ? ORDER BY position, created_at DESC").bind(uid).all();
  }
  const settingRows = await env.DB.prepare("SELECT key, value FROM morice_settings WHERE user_id = ?").bind(uid).all();
  const settings: Record<string, unknown> = {};
  for (const row of settingRows.results as Array<{key:string,value:string}>) { try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; } }
  return Response.json({ items: itemRows.results, settings });
}

export async function POST(request: Request) {
  const uid = userId(request);
  const body = await request.json() as Record<string, string>;
  if (body.action === "add") {
    const allowedKinds = new Set(["module", "task", "memory", "approval"]);
    const title = body.title?.trim() || "";
    if (!allowedKinds.has(body.kind) || !title || title.length > 200 || (body.content || "").length > 4_000) {
      return Response.json({ error: "Élément Morice invalide." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const position = Number((await env.DB.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS value FROM morice_items WHERE user_id = ? AND kind = ?").bind(uid, body.kind).first<{value:number}>())?.value || 0);
    await env.DB.prepare("INSERT INTO morice_items (id,user_id,kind,title,content,status,priority,position,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id,uid,body.kind,title,body.content || "",body.kind === "module" ? "active" : body.kind === "approval" ? "pending" : "open","normal",position,now(),now()).run();
    return Response.json({ ok: true, id });
  }
  if (body.action === "status") {
    let result;
    if (body.status === "rejected") {
      result = await env.DB.prepare("UPDATE morice_items SET status='rejected', updated_at=? WHERE id=? AND user_id=? AND kind='approval' AND status='pending'").bind(now(), body.id, uid).run();
    } else if (body.status === "open" || body.status === "done") {
      result = await env.DB.prepare("UPDATE morice_items SET status=?, updated_at=? WHERE id=? AND user_id=? AND kind IN ('task','memory') AND status IN ('open','done')").bind(body.status, now(), body.id, uid).run();
    } else {
      return Response.json({ error: "État Morice invalide." }, { status: 400 });
    }
    if ((result.meta.changes || 0) !== 1) return Response.json({ error: "Cet élément ne peut plus être modifié." }, { status: 409 });
    return Response.json({ ok: true });
  }
  if (body.action === "setting") {
    await env.DB.prepare("INSERT INTO morice_settings(user_id,key,value) VALUES(?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value").bind(uid,body.key,body.value).run();
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Action inconnue" }, { status: 400 });
}
