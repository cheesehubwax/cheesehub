import { it } from 'vitest';
import { buildLedger } from '@/lib/folio/ledger';
import type { FolioEvent } from '@/lib/folio/types';
const C = { key: 'cheeseburger:CHEESE', contract: 'cheeseburger', symbol: 'CHEESE', precision: 4 };
const W = { key: 'eosio.token:WAX', contract: 'eosio.token', symbol: 'WAX', precision: 8 };
const ev = (id:string,seq:number,type:any,out:any[],inn:any[]):FolioEvent=>({id,trx:id,ts:seq*1000,seq,type,venue:'alcor',out,in:inn} as any);
it('p',()=>{
 const l=buildLedger([
  ev('b1',1,'trade',[{...W,amount:100}],[{...C,amount:200}]),
  ev('b2',2,'trade',[{...W,amount:300}],[{...C,amount:200}]),
  ev('g',3,'received',[],[{...C,amount:100}]),
  ev('lp',4,'liquidity-add',[{...C,amount:50}],[]),ev('lr',5,'liquidity-remove',[],[{...C,amount:50}]),ev('s',6,'trade',[{...C,amount:250}],[{...W,amount:500}]),
 ]);
 console.log(JSON.stringify([...l.positions.values()]), JSON.stringify([...l.realizedByEvent]));
});
