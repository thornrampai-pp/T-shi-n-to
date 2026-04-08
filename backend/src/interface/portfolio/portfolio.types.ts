import { StrategyType, PortfolioType, Prisma } from '@prisma/client';

export interface CreatePortfolioDTO {
  name: string;
  baseCurrency: string;
  strategy?: StrategyType;
  type?: PortfolioType;
}

export interface UpdatePortfolioDTO {
  name?: string;
  strategy?: StrategyType;
}

export interface RecordDividendDTO {
  symbol: string;
  amount: number;
  taxWithheld?: number;
  executedAt?: Date;
}

export interface CreateSnapshotDTO {
  equity: number;
  cash: number;
  costBasis: number;
}
/**
 * รายละเอียดหุ้นแต่ละตัวในพอร์ต (Holdings)
 */
export interface HoldingItem {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currency: string;
  marketValueLocal: number;  // มูลค่าตามสกุลเงินสินทรัพย์
  marketValueBase: number;   // มูลค่าตามสกุลเงินพอร์ต (เช่น แปลงเป็น THB แล้ว)
  unrealizedPL: number;
  unrealizedPLPercentage: number;
  totalDividend: number;
  totalReturnLocal: number;
  weight: number;            // สัดส่วน % ในพอร์ต (เช่น 15.5)
  unrealizedPLBase: number;    // เพิ่ม: กำไร/ขาดทุนหน่วย THB (รวม FX Impact)
  realizedPLBase: number;      // เพิ่ม: กำไรที่ขายไปแล้วหน่วย THB
  totalDividendBase: number;   // เพิ่ม: ปันผลรวมหน่วย THB
  realizedPL: number;          // เพิ่ม: เพื่อให้คำนวณ Total Return ได้ครบถ้วน
  totalReturnBase: number;     // เพิ่ม: (Unrealized + Realized + Dividend) ในหน่วยพอร์ต
}

/**
 * สรุปภาพรวมของพอร์ต (Summary)
 */
export interface PortfolioSummary {
  nav: number;               // มูลค่าสินทรัพย์รวม + เงินสด
  totalMarketValue: number;
  totalCash: number;
  totalCostBasis: number;
  totalUnrealizedPL: number;
  totalRealizedPL: number;      // เพิ่ม: กำไรที่รับรู้แล้วรวมทั้งพอร์ต
  totalDividend: number;        // เพิ่ม: ปันผลรวมทั้งพอร์ต
  allTimeReturnPercentage: number;
  cashWeight: number;        // สัดส่วนเงินสด %
}

/**
 * โครงสร้างหลักที่ API จะส่งออก
 */
export interface PortfolioDetailResponse {
  id: string;
  name: string;
  baseCurrency: string;
  summary: PortfolioSummary;
  holdings: HoldingItem[];
}

export // สร้าง Type สำหรับ Portfolio ที่รวมเอาข้อมูลที่เกี่ยวข้องมาด้วย
  type PortfolioWithDetails = Prisma.PortfolioGetPayload<{
    include: {
      cashAccounts: true,
      positions: { include: { asset: true } }
    }
  }>;