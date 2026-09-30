import { env } from 'cloudflare:workers';
import { userId, now } from '../../lib/runtime';
import { detectFile, safeFilename, MAX_FILE_BYTES, sameOrigin } from '../../lib/attachment-validation';

export async function POST(request: Request) {
  const uid = userId(request);
  if (!sameOrigin(request)) return Response.json({error:'Origine refusée.'},{status:403});
  if (Number(request.headers.get('content-length')) > MAX_FILE_BYTES + 65536) return Response.json({error:'Fichier supérieur à 4 Mo.'},{status:413});
  if (!env.FILES) return Response.json({error:'Stockage privé non disponible.'},{status:503});
  try {
    // Bound the body even when Content-Length is omitted (chunked requests).
    if (!request.body) return Response.json({error:'Fichier requis.'},{status:400});
    const reader=request.body.getReader(); const chunks:Uint8Array[]=[];let total=0;
    try { for (;;) { const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>MAX_FILE_BYTES+65536){await reader.cancel();return Response.json({error:'Fichier supérieur à 4 Mo.'},{status:413});}chunks.push(part.value); } } finally {reader.releaseLock();}
    const bytesBody=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytesBody.set(chunk,offset);offset+=chunk.length;}
    const form = await new Response(bytesBody,{headers:{'Content-Type':request.headers.get('Content-Type') || ''}}).formData(); const file = form.get('file');
    if (!(file instanceof File) || file.size > MAX_FILE_BYTES) return Response.json({error:'Fichier requis, 4 Mo maximum.'},{status:400});
    const bytes = new Uint8Array(await file.arrayBuffer()); const mime = detectFile(bytes);
    const id = crypto.randomUUID(); const name = safeFilename(file.name);
    const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n => n.toString(16).padStart(2,'0')).join('');
    const key = `private/${id}`;
    await env.FILES.put(key, bytes, {httpMetadata:{contentType:mime}});
    try { await env.DB.prepare('INSERT INTO morice_files(id,user_id,name,mime,size,sha256,object_key,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,uid,name,mime,bytes.length,sha256,key,now()).run(); }
    catch { await env.FILES.delete(key); throw new Error('Enregistrement impossible.'); }
    return Response.json({id,name,mime,size:bytes.length,sha256},{status:201,headers:{'Cache-Control':'no-store'}});
  } catch (error) { return Response.json({error:error instanceof Error && /Formats|Fichier/.test(error.message) ? error.message : 'Le fichier n’a pas été enregistré.'},{status:400}); }
}
