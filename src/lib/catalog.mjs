import {parseEther} from 'ethers';

export const emptyFilters = Object.freeze({
  name:'', token:'', record:'', seller:'', minPrice:'', maxPrice:'', sort:'newest'
});

export const assetKey = row => `${row.collection.toLowerCase()}:${row.tokenId}`;
export const catalogPrice = (row, kind) => kind === 'auction'
  ? (row.highestBid > 0n ? row.highestBid : row.reservePrice)
  : row.price;

function priceBound(value) {
  const text = value.trim();
  if (!text) return null;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(text)) {
    throw Error('价格须为非负 ETH 金额，最多 18 位小数。');
  }
  return parseEther(text);
}

export function filterCatalog(rows, filters, {kind='market', names={}, time=0}={}) {
  const min = priceBound(filters.minPrice), max = priceBound(filters.maxPrice);
  if (min !== null && max !== null && min > max) throw Error('最低价格不能高于最高价格。');
  const token = filters.token.trim(), record = filters.record.trim();
  if ([token, record].some(value => value && !/^\d+$/.test(value))) {
    throw Error('Token ID 和订单 / 拍卖 ID 须为非负整数。');
  }
  const name = filters.name.trim().toLocaleLowerCase();
  const seller = filters.seller.trim().toLowerCase();
  const filtered = rows.filter(row => {
    const price = catalogPrice(row, kind);
    return (!name || (names[assetKey(row)] || '').toLocaleLowerCase().includes(name))
      && (!token || BigInt(token) === BigInt(row.tokenId))
      && (!record || BigInt(record) === BigInt(row.id))
      && (!seller || row.seller.toLowerCase().includes(seller))
      && (min === null || price >= min) && (max === null || price <= max);
  });
  const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
  return filtered.sort((a,b) => {
    let order = 0;
    if (filters.sort === 'priceAsc' || filters.sort === 'priceDesc') {
      order = compare(catalogPrice(a,kind),catalogPrice(b,kind));
      if (filters.sort === 'priceDesc') order *= -1;
    } else if (kind === 'auction' && ['endingSoon','endingLast'].includes(filters.sort)) {
      const aLive = Number(a.status) === 1 && Number(a.endTime) > time;
      const bLive = Number(b.status) === 1 && Number(b.endTime) > time;
      if (aLive !== bLive) return aLive ? -1 : 1;
      if (aLive) order = compare(a.endTime,b.endTime) * (filters.sort === 'endingLast' ? -1 : 1);
    } else {
      order = compare(BigInt(a.id),BigInt(b.id)) * (filters.sort === 'oldest' ? 1 : -1);
    }
    return order || compare(BigInt(b.id),BigInt(a.id));
  });
}
