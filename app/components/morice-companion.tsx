'use client';
import type {CSSProperties} from 'react';

const states={idle:[0,6],working:[7,6],waiting:[6,6],failed:[5,8],review:[8,6]} as const;
export function MoriceCompanion({state='idle',label='Morice, votre compagnon',className=''}:{state?:keyof typeof states;label?:string;className?:string}){
 const [row,frames]=states[state];
 const style={'--companion-row':`${row*10}%`,'--companion-end':`${frames/7*100}%`,'--companion-frames':frames} as CSSProperties;
 return <span role="img" aria-label={label} className={`morice-companion companion-${state} ${className}`} style={style}><img className="companion-seated" src="/morice-seated.png" alt=""/><span className="companion-motion" aria-hidden="true"/></span>;
}
