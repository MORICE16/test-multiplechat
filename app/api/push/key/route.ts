import { vapidKeys } from "../crypto";
export async function GET() { const { publicKey } = await vapidKeys(); return Response.json({ publicKey }); }
