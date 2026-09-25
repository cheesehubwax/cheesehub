import { it } from "vitest";
import { computeAlcorTrade } from "@/lib/alcorRouter";
const WAX={contract:"eosio.token",ticker:"WAX",precision:8};
const CHEESE={contract:"cheeseburger",ticker:"CHEESE",precision:4};
const USDC={contract:"eth.token",ticker:"WAXUSDC",precision:6};
it("live", async()=>{
 for (let round=0; round<2; round++)
 for (const [a,b,amt] of [[WAX,CHEESE,"100"],[WAX,CHEESE,"5000"],[CHEESE,WAX,"20000"],[WAX,USDC,"20000"]] as any) {
  const t=performance.now();
  const r=await computeAlcorTrade({tokenIn:a,tokenOut:b,amount:amt,slippage:1,receiver:"someacct1111",tradeType:"EXACT_INPUT"});
  console.log("R"+round,a.ticker,"->",b.ticker,amt,"out",r?.output,"ms",Math.round(performance.now()-t),JSON.stringify(r?.quoteDiagnostics), r?.swaps.filter(s=>s.venue!=="alcor").map(s=>s.venue+s.percent).join(","));
 }
},300000);
