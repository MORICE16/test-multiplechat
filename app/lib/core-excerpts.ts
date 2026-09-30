export function coreExcerpts(text:string,query:string,limit=6000) {
  const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const words=[...new Set(normalize(query).match(/[a-z0-9]{4,}/g)||[])].slice(0,40);
  const paragraphs=text.replace(/\r\n/g,'\n').split(/\n\s*\n/).map((text,index)=>({text,index,score:words.reduce((n,w)=>n+(normalize(text).includes(w)?1:0),0)}));
  const chosen=paragraphs.sort((a,b)=>b.score-a.score || a.index-b.index);
  const result:string[]=[];let length=0;
  for(const p of chosen){if(!p.text.trim())continue;const part=p.text.slice(0,Math.min(1800,limit-length));if(part){result.push(part);length+=part.length+2;}if(length>=limit)break;}
  return result.join('\n\n').slice(0,limit);
}
