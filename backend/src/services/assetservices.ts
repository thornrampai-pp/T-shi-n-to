import YahooFinance from "yahoo-finance2";
import axios from 'axios';
import { ENV } from '../config/env';
import prisma from '../lib/prisma';
import { Asset } from '@prisma/client';
import {
  YahooQuoteResponse,
  TwelveDataPriceResponse,
  AppSearchResult
} from '../interface/assets/assets.types';

export class AssetPriceService {
  private yahooFinance = new YahooFinance();
  private priceCache = new Map<string, { price: number; timestamp: number }>();
  private pending = new Map<string, Promise<number>>();
  private CACHE_DURATION = 60 * 1000; // 1 นาที

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase().trim();
  }

  // --- Price Fetching ---
  async getPrice(symbol: string): Promise<number> {
    const normalized = this.normalizeSymbol(symbol);
    const now = Date.now();
    const cached = this.priceCache.get(normalized);

    if (cached && now - cached.timestamp < this.CACHE_DURATION) return cached.price;
    if (this.pending.has(normalized)) return this.pending.get(normalized)!;

    const promise = this.fetchPrice(normalized);
    this.pending.set(normalized, promise);

    try {
      const price = await promise;
      this.priceCache.set(normalized, { price, timestamp: now });
      return price;
    } finally {
      this.pending.delete(normalized);
    }
  }

  async getPrices(symbols: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};

    // ยิง parallel (เร็วกว่า loop ธรรมดา)
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const price = await this.getPrice(symbol); // reuse ของเดิม
          result[symbol] = price;
        } catch (err) {
          console.error(`❌ Failed to fetch price for ${symbol}`);
          result[symbol] = 0; // fallback
        }
      })
    );

    return result;
  }

  private async fetchPrice(symbol: string): Promise<number> {
    let price: number | null = null;
    if (symbol.endsWith('.BK')) {
      price = await this.fetchFromYahoo(symbol);
    } else {
      // Fallback TwelveData -> Yahoo
      if (ENV.TWELVE_DATA_API_KEY) {
        try {
          const res = await axios.get<TwelveDataPriceResponse>(
            `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${ENV.TWELVE_DATA_API_KEY}`,
            { timeout: 3000 }
          );
          price = res.data.price ? parseFloat(res.data.price) : null;
        } catch { price = null; }
      }
      if (price === null) price = await this.fetchFromYahoo(symbol);
    }
    if (price === null) throw new Error(`Price not found for ${symbol}`);
    return price;
  }

  private async fetchFromYahoo(symbol: string): Promise<number | null> {
    try {
      const result = (await this.yahooFinance.quote(symbol)) as unknown as YahooQuoteResponse;
      const price = result?.regularMarketPrice ?? result?.price?.regularMarketPrice;
      return typeof price === 'number' ? price : null;
    } catch (error) {
      console.error(`[Yahoo] Error ${symbol}:`, error);
      return null;
    }
  }

  // --- Asset Management ---
  async getOrCreateAsset(symbol: string): Promise<Asset> {
    const normalized = this.normalizeSymbol(symbol);
    const existing = await prisma.asset.findUnique({ where: { symbol: normalized } });
    if (existing) return existing;

    const detail = (await this.yahooFinance.quote(normalized)) as unknown as YahooQuoteResponse;
    return await prisma.asset.upsert({
      where: { symbol: normalized },
      update: {},
      create: {
        symbol: detail.symbol || normalized,
        name: detail.shortName || detail.longName || normalized,
        type: this.mapType(detail.quoteType || ''),
        currency: detail.currency || 'USD',
      },
    });
  }

  // 🟢 Batch Mode แบบถนอม IP (Sequential + Jitter)
  async getOrCreateAssets(symbols: string[]): Promise<Asset[]> {
    const uniqueSymbols = [...new Set(symbols.map(s => this.normalizeSymbol(s)))];
    const results: Asset[] = [];

    for (const symbol of uniqueSymbols) {
      try {
        const asset = await this.getOrCreateAsset(symbol);
        results.push(asset);
        // พักเครื่อง 1.5 - 3 วินาทีต่อ Request
        await this.sleep(Math.floor(Math.random() * 1500) + 1500);
      } catch (e) { continue; }
    }
    return results;
  }

  async getAllAssets() {
    return prisma.asset.findMany({ orderBy: { symbol: 'asc' } });
  }

  async search(query: string): Promise<AppSearchResult[]> {
    const result = await this.yahooFinance.search(query, { newsCount: 0, quotesCount: 10 });
    return result.quotes.map((item: any) => ({
      symbol: item.symbol,
      name: item.shortname || item.longname || item.symbol,
      exchange: item.exchDisp || 'Unknown',
      type: this.mapType(item.quoteType || ''),
      isExist: false
    }));
  }

  // AssetPriceService.ts
  async getHistory(symbol: string, period: string = '1mo', interval: string = '1d') {
    try {
      // ป้องกันกรณีส่งค่าว่างมาใน Body (เช่น { "period": "" })
      const fetchPeriod = period || '1mo';
      const fetchInterval = interval || '1d';

      const result = await this.yahooFinance.chart(this.normalizeSymbol(symbol), {
        period1: fetchPeriod,
        interval: fetchInterval as any,
      });

      return {
        symbol: this.normalizeSymbol(symbol),
        quotes: result.quotes.filter(q => q.close !== null)
      };
    } catch (error) {
      throw new Error(`Failed to fetch history for ${symbol}`);
    }
  }

  async getDividends(symbol: string) {
    const result = await this.yahooFinance.quoteSummary(this.normalizeSymbol(symbol), {
      modules: ["summaryDetail", "assetProfile"]
    });
    return {
      symbol: symbol.toUpperCase(),
      dividendYield: result.summaryDetail?.dividendYield || 0,
      dividendRate: result.summaryDetail?.dividendRate || 0,
      exDividendDate: result.summaryDetail?.exDividendDate || null
    };
  }

  private mapType(type: string): 'STOCK' | 'CRYPTO' | 'ETF' {
    if (type === 'CRYPTOCURRENCY') return 'CRYPTO';
    if (type === 'ETF') return 'ETF';
    return 'STOCK';
  }

  
}