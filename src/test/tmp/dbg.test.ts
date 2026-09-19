import { it } from 'vitest';
import { planCompound, balanceKey } from '@/lib/alcorCompound';
const CHEESE={contract:'cheeseburger',symbol:'CHEESE'},USDC={contract:'eth.token',symbol:'WAXUSDC'};
const c=(id:number,usd:number)=>({positionId:id,poolId:10,tickLower:-100,tickUpper:100,tokenA:{...CHEESE,amount:1000},tokenB:{...USDC,amount:100},usdValue:usd,rewardTokenKeys:[balanceKey(CHEESE.contract,CHEESE.symbol),balanceKey(USDC.contract,USDC.symbol)]});
it('dbg',()=>{const p=planCompound([c(1,900),c(2,100)],new Map([[balanceKey(CHEESE.contract,CHEESE.symbol),{balance:1000,precision:8,known:true}],[balanceKey(USDC.contract,USDC.symbol),{balance:1,precision:2,known:true}]]));console.log(JSON.stringify(p,null,1));});
