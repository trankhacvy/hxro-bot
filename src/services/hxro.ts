import * as web3 from "@solana/web3.js";
import * as sdk from "@hxronetwork/parimutuelsdk";
import { getMarketByPubkey, getMarketPairByPubkey } from "../utils/market";

const config = sdk.DEV_CONFIG;
const rpc = process.env.SOLANA_RPC!;

export const USDC = "DXSVQJqJbNTTcGqCkfHnQYXwG5GhZsfg2Ka9tNkK3ohr";

export const connection = new web3.Connection(rpc, "confirmed");

export interface PariObj {
  duration: string;
  startIn: string;
  longPool: string;
  shortPool: string;
  longOdds: string;
  shortOdds: string;
  pubkey: string;
}

export const getContests = async (market: string, duration: number) => {
  const markets = sdk.getMarketPubkeys(config, market as any);
  const marketsByTime = markets.filter(
    (market) => market.duration === duration
  );

  const pariWeb3 = new sdk.ParimutuelWeb3(config, connection);
  const parimutuels = await pariWeb3.getParimutuels(marketsByTime);
  const now = Date.now();
  const pari_markets = parimutuels.filter(
    (account) =>
      account.info.parimutuel.timeWindowStart.toNumber() > now &&
      account.info.parimutuel.timeWindowStart.toNumber() < now + duration * 1000
  );

  let longPool: number =
    pari_markets[0].info.parimutuel.activeLongPositions.toNumber() /
    1_000_000_000;
  let shortPool: number =
    pari_markets[0].info.parimutuel.activeShortPositions.toNumber() /
    1_000_000_000;

  const longOdds = sdk.calculateNetOdd(longPool, longPool + shortPool, 0.03);
  const shortOdds = sdk.calculateNetOdd(shortPool, longPool + shortPool, 0.03);

  const pubkey = pari_markets[0].pubkey.toString();
  // startIn
  const locksTime = pari_markets[0].info.parimutuel.timeWindowStart.toNumber();
  var formattedTime = "00:00:00";
  if (locksTime) {
    const currentTime = new Date().getTime();
    const timeDiff = locksTime - currentTime;
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    formattedTime = `${hours < 10 ? "0" + hours : hours}:${
      minutes < 10 ? "0" + minutes : minutes
    }:${seconds < 10 ? "0" + seconds : seconds}`;
  }

  return {
    duration: "",
    startIn: formattedTime,
    longPool: longPool.toFixed(2),
    shortPool: shortPool.toFixed(2),
    longOdds,
    shortOdds,
    pubkey,
  } as PariObj;
};

export const placeOrder = (
  wallet: web3.Keypair,
  pariPubkey: string,
  amount: number,
  side: sdk.PositionSideEnum
) => {
  const pariWeb3 = new sdk.ParimutuelWeb3(config, connection);
  return pariWeb3.placePosition(
    wallet,
    new web3.PublicKey(pariPubkey),
    amount * (10 ** 9 / 1),
    side,
    Date.now()
  );
};

export const settlePosition = (wallet: web3.Keypair, pariPubkey: string) => {
  const pariWeb3 = new sdk.ParimutuelWeb3(config, connection);
  pariWeb3.settlePosition(
    wallet,
    wallet.publicKey,
    new web3.PublicKey(pariPubkey)
  );
};

export type PositionItem = {
  key: {
    parimutuelPubkey: string;
  };
  market: {
    marketPair: string;
    status: sdk.MarketStatusEnum;
    duration: number;
    isExpired: boolean;
  };
  time: { startTime: number };
  pool: { poolSize: number; long: number; short: number };
  position: { long: number; short: number };
  locked: { price: number };
  settled: { price: number };
};

export const parseMyPositions = (
  position: sdk.ParimutuelPosition,
  markets: sdk.ParimutuelMarket[],
  settlementTokenDecimals: number,
  settlementTokenContractSize: number
): PositionItem => {
  const { info } = position;
  const market = getMarketByPubkey(info.parimutuel.marketKey, markets);
  const duration = market?.info.market.duration.toNumber() ?? 0;

  const poolSize =
    (info.parimutuel.activeLongPositions.toNumber() +
      info.parimutuel.activeShortPositions.toNumber()) /
    10 ** settlementTokenDecimals /
    settlementTokenContractSize;
  const poolLong =
    info.parimutuel.activeLongPositions.toNumber() /
    (10 ** settlementTokenDecimals / settlementTokenContractSize);
  const poolShort =
    info.parimutuel.activeShortPositions.toNumber() /
    (10 ** settlementTokenDecimals / settlementTokenContractSize);

  const positionLong =
    info.position.longPosition.toNumber() /
    (10 ** settlementTokenDecimals / settlementTokenContractSize);
  const positionShort =
    info.position.shortPosition.toNumber() /
    (10 ** settlementTokenDecimals / settlementTokenContractSize);

  const lockedPrice = info.parimutuel.strike.toNumber() / 10 ** 8;
  const settledPrice = info.parimutuel.index.toNumber() / 10 ** 8;

  const marketStatus = sdk.getMarketStatus(
    info.parimutuel.marketClose.toString(),
    info.parimutuel.timeWindowStart.toString(),
    duration
  );

  return {
    key: {
      parimutuelPubkey: info.parimutuelPubkey.toBase58(),
    },
    market: {
      marketPair: getMarketPairByPubkey(info.parimutuel.marketKey),
      duration,
      status: marketStatus,
      isExpired: !!info.parimutuel.expired,
    },
    time: {
      startTime: info.parimutuel.marketClose.toNumber(),
    },
    pool: {
      poolSize,
      long: poolLong,
      short: poolShort,
    },
    position: {
      long: positionLong,
      short: positionShort,
    },
    locked: {
      price: lockedPrice,
    },
    settled: {
      price: settledPrice,
    },
  };
};

export const getUserPositions = async (userWallet: web3.PublicKey) => {
  const pariWeb3 = new sdk.ParimutuelWeb3(config, connection);
  const markets = await pariWeb3.getMarkets(sdk.MarketPairEnum.BTCUSD);
  const positions = await pariWeb3.getUserPositions(userWallet, markets);

  const parsedPositions = positions
    .map((position) =>
      parseMyPositions(
        position,
        markets,
        8,
        markets[0].info.market.contractSize
      )
    )
    .sort((a, b) => b.time.startTime - a.time.startTime);

  return parsedPositions;
};
