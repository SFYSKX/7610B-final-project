/** Read a bounded, newest-first list at the caller's pinned block. */
export async function recent(count, read, limit=40, decode=value=>value.toObject()) {
  const n=Number(count), start=Math.max(1,n-limit+1);
  const rows=await Promise.all(Array.from({length:n-start+1},(_,i)=>{
    const id=start+i;
    return read(id).then(value=>({id,...decode(value)}));
  }));
  return rows.reverse();
}
