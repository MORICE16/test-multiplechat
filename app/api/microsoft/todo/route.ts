import { userId } from '@/app/lib/runtime';
import { readMicrosoftTodo } from '@/app/lib/microsoft';
export async function GET(request:Request) {
  const uid=userId(request);
  try { return Response.json(await readMicrosoftTodo(uid,new URL(request.url).searchParams.get('list')||''),{headers:{'Cache-Control':'no-store'}}); }
  catch { return Response.json({error:'Microsoft To Do ne répond pas. Vérifiez votre connexion Microsoft.'},{status:502}); }
}
