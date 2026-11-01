import { getAddress, parseEther, ZeroAddress } from 'ethers';
export function address(value){const result=getAddress(String(value).trim());if(result===ZeroAddress)throw Error('地址不能为零地址');return result;}
export function integer(value,{min=0n,max=(1n<<64n)-1n}={}){if(!/^\d+$/.test(String(value).trim()))throw Error('请输入非负整数');const n=BigInt(value);if(n<min||n>max)throw Error('整数超出允许范围');return n;}
// ERC-721 IDs are uint256, including zero; business record IDs still start at one.
export function tokenId(value){return integer(value,{min:0n,max:(1n<<256n)-1n});}
export function amount(value){if(!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(String(value).trim()))throw Error('ETH 金额最多 18 位小数，不支持科学计数法');const n=parseEther(String(value).trim());if(n<=0n||n>10n**30n)throw Error('金额必须大于零且不超过合约上限');return n;}
export function csvCell(value){const s=String(value??'');return '"'+(/^[=+\-@\t\r]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';}
export function uniqueLogs(logs){const map=new Map();for(const l of logs)map.set(`${l.address}:${l.transactionHash}:${l.index}`,l);return [...map.values()].sort((a,b)=>a.blockNumber-b.blockNumber||a.transactionIndex-b.transactionIndex||a.index-b.index);}
export function createGate(){let busy=false;return {get busy(){return busy;},async run(fn){if(busy)throw Error('已有操作处理中');busy=true;try{return await fn();}finally{busy=false;}}};}
export function createRefresh(read,apply,error){let running=false,dirty=false,stopped=false;return {stop(){stopped=true;},async request(){if(stopped)return;dirty=true;if(running)return;running=true;try{while(dirty&&!stopped){dirty=false;try{const v=await read();if(!stopped)apply(v);}catch(e){if(!stopped)error(e);}}}finally{running=false;}}};}
export {friendly} from './errors.mjs';
export function journalKey(s){return `ledger-pending-v2:${s.chainId}:${s.config?.deploymentIdentity||s.config?.admin||'unknown'}:${s.account.toLowerCase()}`;}
export function recoverReceipt(receipt){return !receipt?'pending':Number(receipt.status)===1?'success':'reverted';}
