import React from 'react';
import {THEMES} from './lib/layout.mjs';

export default function LayoutPreview({layout='horizontal',theme='sage',kind='flowchart'}){
 const t=THEMES[theme]||THEMES.sage;
 let cards=[],links=[];
 const chain=count=>Array.from({length:Math.max(0,count-1)},(_,i)=>[i,i+1]);
 if(layout==='vertical'){cards=[[56,5,38,16],[56,32,38,16],[18,63,38,16],[94,63,38,16]];links=[[0,1],[1,2],[1,3]];}
 else if(layout==='timeline'){cards=[8,43,78,113].map(x=>[x,34,27,17]);links=chain(4);}
 else if(layout==='stack'){cards=[5,25,45,65].map(y=>[49,y,52,14]);links=chain(4);}
 else if(layout==='outline'){cards=[[9,4,73,12],[28,21,73,12],[46,38,73,12],[28,55,73,12],[46,72,73,10]];links=[[0,1],[1,2],[0,3],[3,4]];}
 else if(layout==='grid'){cards=[12,50].flatMap(y=>[12,58,104].map(x=>[x,y,34,22]));links=[[0,1],[1,2],[3,4],[4,5]];}
 else if(layout==='radial'){cards=[[57,32,36,20],[61,3,28,14],[115,34,28,16],[61,67,28,14],[7,34,28,16]];links=[[0,1],[0,2],[0,3],[0,4]];}
 else if(layout==='circle'){cards=Array.from({length:5},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/5;return [61+Math.cos(a)*49,35+Math.sin(a)*29,28,14];});links=chain(5);}
 else if(layout==='pyramid'||layout==='funnel'){cards=Array.from({length:4},(_,i)=>{const w=24+(layout==='pyramid'?i:3-i)*20;return [75-w/2,7+i*19,w,13];});links=chain(4);}
 else{cards=[[5,32,34,20],[57,32,34,20],[110,8,34,20],[110,56,34,20]];links=[[0,1],[1,2],[1,3]];}
 return <svg viewBox="0 0 150 88" role="img" aria-label={`${layout} ${kind} layout`}>
  <g stroke={t.edge} strokeWidth="1.3" fill="none">{links.map(([a,b],i)=><path key={i} d={`M${cards[a][0]+cards[a][2]/2},${cards[a][1]+cards[a][3]/2} L${cards[b][0]+cards[b][2]/2},${cards[b][1]+cards[b][3]/2}`}/>)}</g>
  {cards.map(([x,y,w,h],i)=><g key={i}><rect x={x} y={y} width={w} height={h} rx="3" fill={i===1&&['horizontal','vertical'].includes(layout)?t.decisionFill:t.fill} stroke={i===1&&['horizontal','vertical'].includes(layout)?t.decisionStroke:t.stroke}/><path d={`M${x+w*.25},${y+h/2} h${w*.5}`} stroke={t.stroke} strokeWidth="1.3" opacity=".45" strokeLinecap="round"/></g>)}
 </svg>;
}
