import * as sdk from "@hxronetwork/parimutuelsdk";

export const getMarketByPubkey = (
  marketPubkey: string,
  markets: sdk.ParimutuelMarket[]
): sdk.ParimutuelMarket | undefined => {
  return markets.find((market) => market.pubkey.toBase58() === marketPubkey);
};

export const getMarketPairByPubkey = (marketKey: string): string => {
  const solMarkets = sdk.getMarketPubkeys(
    sdk.DEV_CONFIG,
    sdk.MarketPairEnum.SOLUSD
  );
  const solMarket = solMarkets.find(
    (market) => market.pubkey.toBase58() === marketKey
  );
  if (solMarket) return sdk.MarketPairEnum.SOLUSD;

  const btcMarkets = sdk.getMarketPubkeys(
    sdk.DEV_CONFIG,
    sdk.MarketPairEnum.BTCUSD
  );
  const btcMarket = btcMarkets.find(
    (market) => market.pubkey.toBase58() === marketKey
  );
  if (btcMarket) return sdk.MarketPairEnum.BTCUSD;

  return sdk.MarketPairEnum.ETHUSD;
};
