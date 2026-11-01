import {formatEther} from 'ethers';
export const eth=v=>formatEther(v??0n);
export const short=v=>v?`${v.slice(0,6)}…${v.slice(-4)}`:'—';
export const same=(a,b)=>Boolean(a&&b)&&a.toLowerCase()===b.toLowerCase();
