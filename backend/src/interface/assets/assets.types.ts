import axios from 'axios';
import { Asset } from '@prisma/client'; // Import type จาก Prisma Schema ของคุณ

// 1. สำหรับการ Search
export interface AppSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  isExist: boolean;
}


// 2. สำหรับ Twelve Data API Response
export interface TwelveDataPriceResponse {
  price?: string;
  code?: number;
  message?: string;
  status?: string;
}

// 3. สำหรับ Yahoo Finance (ใช้ Partial เพื่อความปลอดภัยเพราะข้อมูล Yahoo ไม่แน่นอน)
export interface YahooQuoteResponse {
  symbol: string;
  regularMarketPrice?: number;
  currency?: string;
  shortName?: string;
  longName?: string;
  quoteType?: string;
  // เพิ่มตัวเลือกที่ Yahoo ชอบส่งสลับไปมา
  exchange?: string;
  marketState?: string;
  price?: {
    regularMarketPrice?: number;
    currency?: string;
  };
}