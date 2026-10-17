import type { ExchangeId } from './types'

export type CoinCategory = 'major' | 'large' | 'mid' | 'meme' | 'defi'

export interface CoinDef {
  symbol: string
  name: string
  basePrice: number
  volBase: number // базовый 24ч объём, USD
  volatility: number // сигма за тик (1с)
  category: CoinCategory
}

const ALL: ExchangeId[] = ['BINANCE', 'BYBIT', 'OKX', 'GATE', 'BITGET', 'KUKOIN', 'HL', 'ASTER']

export const COINS: CoinDef[] = [
  // ── majors: все биржи, F+S
  { symbol: 'BTC', name: 'Bitcoin', basePrice: 96400, volBase: 28e9, volatility: 0.00028, category: 'major' },
  { symbol: 'ETH', name: 'Ethereum', basePrice: 3420, volBase: 14e9, volatility: 0.00034, category: 'major' },
  { symbol: 'SOL', name: 'Solana', basePrice: 206, volBase: 4.2e9, volatility: 0.00048, category: 'major' },
  { symbol: 'BNB', name: 'BNB', basePrice: 688, volBase: 1.6e9, volatility: 0.0003, category: 'major' },
  { symbol: 'XRP', name: 'XRP', basePrice: 2.31, volBase: 3.8e9, volatility: 0.00052, category: 'major' },
  { symbol: 'DOGE', name: 'Dogecoin', basePrice: 0.318, volBase: 2.1e9, volatility: 0.00068, category: 'major' },
  { symbol: 'ADA', name: 'Cardano', basePrice: 0.94, volBase: 940e6, volatility: 0.00055, category: 'major' },
  { symbol: 'AVAX', name: 'Avalanche', basePrice: 37.4, volBase: 780e6, volatility: 0.00058, category: 'major' },
  { symbol: 'LINK', name: 'Chainlink', basePrice: 21.8, volBase: 720e6, volatility: 0.00056, category: 'major' },
  { symbol: 'TRX', name: 'TRON', basePrice: 0.243, volBase: 650e6, volatility: 0.00038, category: 'major' },

  // ── large: все биржи F, спот на крупнейших
  { symbol: 'DOT', name: 'Polkadot', basePrice: 6.9, volBase: 420e6, volatility: 0.0006, category: 'large' },
  { symbol: 'LTC', name: 'Litecoin', basePrice: 104.5, volBase: 480e6, volatility: 0.0005, category: 'large' },
  { symbol: 'BCH', name: 'Bitcoin Cash', basePrice: 448, volBase: 380e6, volatility: 0.00055, category: 'large' },
  { symbol: 'UNI', name: 'Uniswap', basePrice: 12.9, volBase: 340e6, volatility: 0.00062, category: 'large' },
  { symbol: 'ATOM', name: 'Cosmos', basePrice: 6.4, volBase: 220e6, volatility: 0.0006, category: 'large' },
  { symbol: 'XLM', name: 'Stellar', basePrice: 0.415, volBase: 610e6, volatility: 0.00058, category: 'large' },
  { symbol: 'NEAR', name: 'NEAR', basePrice: 5.15, volBase: 310e6, volatility: 0.00066, category: 'large' },
  { symbol: 'APT', name: 'Aptos', basePrice: 9.3, volBase: 260e6, volatility: 0.00068, category: 'large' },
  { symbol: 'ARB', name: 'Arbitrum', basePrice: 0.84, volBase: 240e6, volatility: 0.0007, category: 'large' },
  { symbol: 'OP', name: 'Optimism', basePrice: 1.78, volBase: 210e6, volatility: 0.0007, category: 'large' },
  { symbol: 'SUI', name: 'Sui', basePrice: 4.28, volBase: 690e6, volatility: 0.00078, category: 'large' },
  { symbol: 'TON', name: 'Toncoin', basePrice: 5.35, volBase: 320e6, volatility: 0.00062, category: 'large' },
  { symbol: 'HBAR', name: 'Hedera', basePrice: 0.276, volBase: 580e6, volatility: 0.00064, category: 'large' },
  { symbol: 'TAO', name: 'Bittensor', basePrice: 478, volBase: 190e6, volatility: 0.00082, category: 'large' },
  { symbol: 'ICP', name: 'Internet Computer', basePrice: 9.7, volBase: 120e6, volatility: 0.00066, category: 'large' },

  // ── mid: деривативы на большинстве, спот на тройке
  { symbol: 'INJ', name: 'Injective', basePrice: 20.9, volBase: 160e6, volatility: 0.00085, category: 'mid' },
  { symbol: 'SEI', name: 'Sei', basePrice: 0.447, volBase: 190e6, volatility: 0.00088, category: 'mid' },
  { symbol: 'TIA', name: 'Celestia', basePrice: 4.75, volBase: 140e6, volatility: 0.00086, category: 'mid' },
  { symbol: 'RUNE', name: 'THORChain', basePrice: 4.1, volBase: 130e6, volatility: 0.00084, category: 'mid' },
  { symbol: 'FIL', name: 'Filecoin', basePrice: 5.35, volBase: 150e6, volatility: 0.00072, category: 'mid' },
  { symbol: 'ETC', name: 'Ethereum Classic', basePrice: 26.2, volBase: 140e6, volatility: 0.00066, category: 'mid' },
  { symbol: 'ENA', name: 'Ethena', basePrice: 0.91, volBase: 280e6, volatility: 0.00092, category: 'mid' },
  { symbol: 'W', name: 'Wormhole', basePrice: 0.346, volBase: 95e6, volatility: 0.00094, category: 'mid' },
  { symbol: 'ONDO', name: 'Ondo', basePrice: 1.28, volBase: 180e6, volatility: 0.0009, category: 'mid' },
  { symbol: 'WLD', name: 'Worldcoin', basePrice: 2.36, volBase: 260e6, volatility: 0.00096, category: 'mid' },
  { symbol: 'ARKM', name: 'Arkham', basePrice: 1.88, volBase: 120e6, volatility: 0.0009, category: 'mid' },
  { symbol: 'ZRO', name: 'ZKsync', basePrice: 4.35, volBase: 140e6, volatility: 0.00092, category: 'mid' },
  { symbol: 'STRK', name: 'Starknet', basePrice: 0.418, volBase: 110e6, volatility: 0.00094, category: 'mid' },
  { symbol: 'ZK', name: 'zkSync Era', basePrice: 0.158, volBase: 85e6, volatility: 0.00092, category: 'mid' },
  { symbol: 'JUP', name: 'Jupiter', basePrice: 1.04, volBase: 110e6, volatility: 0.00088, category: 'mid' },
  { symbol: 'PYTH', name: 'Pyth Network', basePrice: 0.358, volBase: 90e6, volatility: 0.0009, category: 'mid' },
  { symbol: 'RNDR', name: 'Render', basePrice: 7.15, volBase: 160e6, volatility: 0.00082, category: 'mid' },
  { symbol: 'KAS', name: 'Kaspa', basePrice: 0.128, volBase: 95e6, volatility: 0.00084, category: 'mid' },
  { symbol: 'NOT', name: 'Notcoin', basePrice: 0.0082, volBase: 75e6, volatility: 0.00105, category: 'mid' },
  { symbol: 'ICNT', name: 'Icnet', basePrice: 0.1687, volBase: 105e6, volatility: 0.00108, category: 'mid' },

  // ── meme: деривативы почти везде, спот ограничен
  { symbol: 'SHIB', name: 'Shiba Inu', basePrice: 0.0000212, volBase: 820e6, volatility: 0.00105, category: 'meme' },
  { symbol: 'PEPE', name: 'Pepe', basePrice: 0.0000181, volBase: 1.4e9, volatility: 0.00115, category: 'meme' },
  { symbol: 'WIF', name: 'dogwifhat', basePrice: 2.87, volBase: 560e6, volatility: 0.00118, category: 'meme' },
  { symbol: 'BONK', name: 'Bonk', basePrice: 0.0000308, volBase: 320e6, volatility: 0.00112, category: 'meme' },
  { symbol: 'FLOKI', name: 'Floki', basePrice: 0.000192, volBase: 210e6, volatility: 0.0011, category: 'meme' },
  { symbol: 'TURBO', name: 'Turbo', basePrice: 0.0092, volBase: 95e6, volatility: 0.00125, category: 'meme' },
  { symbol: 'MOG', name: 'Mog Coin', basePrice: 0.00168, volBase: 68e6, volatility: 0.00128, category: 'meme' },
  { symbol: 'POPCAT', name: 'Popcat', basePrice: 0.915, volBase: 130e6, volatility: 0.00122, category: 'meme' },
  { symbol: 'MEW', name: 'cat in a dogs world', basePrice: 0.0073, volBase: 88e6, volatility: 0.00124, category: 'meme' },
  { symbol: 'BRETT', name: 'Brett', basePrice: 0.158, volBase: 62e6, volatility: 0.00126, category: 'meme' },
  { symbol: 'ZEREBRO', name: 'Zerebro', basePrice: 0.041, volBase: 55e6, volatility: 0.00132, category: 'meme' },
  { symbol: 'BTW', name: 'BitWhite', basePrice: 0.062, volBase: 48e6, volatility: 0.0013, category: 'meme' },
  { symbol: 'SIREN', name: 'Siren', basePrice: 0.115, volBase: 58e6, volatility: 0.00134, category: 'meme' },

  // ── defi: середина
  { symbol: 'AAVE', name: 'Aave', basePrice: 318, volBase: 340e6, volatility: 0.00074, category: 'defi' },
  { symbol: 'LDO', name: 'Lido DAO', basePrice: 1.72, volBase: 130e6, volatility: 0.0008, category: 'defi' },
  { symbol: 'CRV', name: 'Curve DAO', basePrice: 0.905, volBase: 150e6, volatility: 0.00082, category: 'defi' },
  { symbol: 'MKR', name: 'Maker', basePrice: 1490, volBase: 90e6, volatility: 0.00072, category: 'defi' },
  { symbol: 'DYDX', name: 'dYdX', basePrice: 1.42, volBase: 80e6, volatility: 0.00086, category: 'defi' },
  { symbol: 'GMX', name: 'GMX', basePrice: 25.8, volBase: 70e6, volatility: 0.00084, category: 'defi' },
  { symbol: 'PENDLE', name: 'Pendle', basePrice: 5.05, volBase: 140e6, volatility: 0.00088, category: 'defi' },
  { symbol: 'COMP', name: 'Compound', basePrice: 84.5, volBase: 55e6, volatility: 0.0008, category: 'defi' },
  { symbol: 'BLUR', name: 'Blur', basePrice: 0.318, volBase: 60e6, volatility: 0.00088, category: 'defi' },
  { symbol: 'ETHFI', name: 'Ether.fi', basePrice: 3.42, volBase: 85e6, volatility: 0.0009, category: 'defi' },
  { symbol: 'JTO', name: 'Jito', basePrice: 3.85, volBase: 65e6, volatility: 0.00088, category: 'defi' },
  { symbol: 'ALT', name: 'AltLayer', basePrice: 0.092, volBase: 45e6, volatility: 0.00094, category: 'defi' },
]

const SPOT_CORE: ExchangeId[] = ['BINANCE', 'BYBIT', 'OKX']
const SPOT_WIDE: ExchangeId[] = ['BINANCE', 'BYBIT', 'OKX', 'GATE', 'KUKOIN']
const MEME_F: ExchangeId[] = ['BINANCE', 'BYBIT', 'OKX', 'GATE', 'BITGET', 'HL', 'ASTER']
const MEME_S: ExchangeId[] = ['BINANCE', 'BYBIT']

export function futuresExchanges(c: CoinDef): ExchangeId[] {
  switch (c.category) {
    case 'major':
    case 'large':
      return ALL
    case 'mid':
      return c.symbol === 'NOT' || c.symbol === 'ZK' ? ['BINANCE', 'BYBIT', 'OKX', 'GATE', 'BITGET', 'HL'] : ALL
    case 'meme':
      return MEME_F
    case 'defi':
      return c.symbol === 'ALT' || c.symbol === 'BLUR' ? ['BINANCE', 'BYBIT', 'OKX', 'GATE', 'BITGET', 'HL', 'ASTER'] : ['BINANCE', 'BYBIT', 'OKX', 'GATE', 'BITGET', 'KUKOIN', 'HL']
  }
}

export function spotExchanges(c: CoinDef): ExchangeId[] {
  switch (c.category) {
    case 'major':
      return ALL
    case 'large':
      return SPOT_WIDE
    case 'mid':
    case 'defi':
      return SPOT_CORE
    case 'meme':
      return MEME_S
  }
}

export const COIN_MAP: Record<string, CoinDef> = Object.fromEntries(COINS.map((c) => [c.symbol, c]))

// Детерминированный выбор из массива по seed
export function pickSeeded<T>(arr: T[], seed: number): T {
  return arr[Math.abs(Math.floor(seed)) % arr.length]
}
