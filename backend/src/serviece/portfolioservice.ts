// services/portfolio.service.ts
import prisma from '../lib/prisma';
import {
  TransactionType,
  AccountType,
  EntrySide,
  Prisma
} from '@prisma/client';

import {
  CreatePortfolioDTO,
  UpdatePortfolioDTO,
  RecordDividendDTO,
  CreateSnapshotDTO,
  PortfolioDetailResponse
} from '../interface/portfolio/portfolio.types';

export class PortfolioService {

  /**
   * สร้างพอร์ตการลงทุนใหม่ พร้อมสร้างสมุดบัญชีเงินสด (Cash Account) เริ่มต้น
   */
  async createPortfolio(userId: string, data: CreatePortfolioDTO) {
    // ใช้ Transaction เพื่อป้องกันกรณีสร้างพอร์ตสำเร็จแต่สร้างบัญชีเงินสดล้มเหลว
    return await prisma.$transaction(async (tx) => {
      // 1. สร้างพอร์ต
      const portfolio = await tx.portfolio.create({
        data: {
          userId,
          name: data.name,
          baseCurrency: data.baseCurrency || 'THB',
          strategy: data.strategy || 'VALUE',
          type: data.type || 'REAL',
        },
      });

      // 2. สร้างบัญชีเงินสดเริ่มต้นผูกกับพอร์ต (ใช้สกุลเงินหลักของพอร์ต)
      await tx.cashAccount.create({
        data: {
          portfolioId: portfolio.id,
          currency: portfolio.baseCurrency,
          isDomestic: portfolio.baseCurrency === 'THB',
          balance: 0,
        },
      });

      return portfolio;
    });
  }

  /**
   * ดึงรายการพอร์ตทั้งหมดของผู้ใช้งาน (เฉพาะพอร์ตที่ยังไม่ถูกลบ)
   */
  async getAllPortfolios(userId: string) {
    return await prisma.portfolio.findMany({
      where: { userId, deletedAt: null },
      include: {
        cashAccounts: {
          select: { currency: true, balance: true, isDomestic: true }
        },
        _count: { select: { positions: true } } // นับจำนวนหุ้นที่ถืออยู่
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * อัปเดตข้อมูลทั่วไปของพอร์ต (ชื่อ, กลยุทธ์)
   */
  async updatePortfolio(userId: string, id: string, data: UpdatePortfolioDTO) {
    return await prisma.portfolio.update({
      where: { id, userId },
      data: {
        // อัปเดตเฉพาะฟิลด์ที่มีการส่งค่ามา
        ...(data.name !== undefined && { name: data.name }),
        ...(data.strategy !== undefined && { strategy: data.strategy }),
      },
    });
  }

  /**
   * ดึงข้อมูลพอร์ตเบื้องต้นจาก Database (รวมถึงรายการหุ้นและบัญชีเงินสด)
   */
  async getPortfolioById(userId: string, id: string) {
    return await prisma.portfolio.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        cashAccounts: true,
        positions: { include: { asset: true } },
        _count: { select: { transactions: true } }
      }
    });
  }

  /**
   * [ฟังก์ชันหลัก] คำนวณสรุปภาพรวมพอร์ตแบบ Real-time
   * คำนวณกำไร/ขาดทุน, สัดส่วนการลงทุน (Weight) และแปลงสกุลเงิน (FX)
   */
  async getPortfolioDetails(
    userId: string,
    portfolioId: string,
    currentPrices: Record<string, number>, // ราคาหุ้นปัจจุบัน { "AAPL": 170 }
    fxRates: Record<string, number>        // อัตราแลกเปลี่ยน { "USD": 36.5 }
  ): Promise<PortfolioDetailResponse | null> {

    const portfolio = await this.getPortfolioById(userId, portfolioId);
    if (!portfolio) return null;

    let totalMarketValueBase = 0; // มูลค่าตลาดรวมในสกุลเงินหลักของพอร์ต
    let totalCostBasisBase = 0;   // ต้นทุนรวมในสกุลเงินหลักของพอร์ต

    // --- ส่วนที่ 1: คำนวณข้อมูลรายตำแหน่งหุ้น (Holdings) ---
    const holdings = portfolio.positions.map(pos => {
      const symbol = pos.asset.symbol;
      const assetCurrency = pos.asset.currency;
      const currentPrice = currentPrices[symbol] || 0;
      const fxRate = fxRates[assetCurrency] || 1; // เรทแปลงสกุลเงินหุ้น -> สกุลเงินพอร์ต

      const quantity = Number(pos.quantity);
      const avgPrice = Number(pos.avgPrice);

      // คำนวณมูลค่าตามสกุลเงินท้องถิ่น (Local Currency)
      const marketValueLocal = quantity * currentPrice;
      const costBasisLocal = quantity * avgPrice;

      // แปลงมูลค่ากลับมาเป็นสกุลเงินหลักของพอร์ต (Base Currency)
      const marketValueBase = marketValueLocal * fxRate;
      const costBasisBase = costBasisLocal * fxRate;

      totalMarketValueBase += marketValueBase;
      totalCostBasisBase += costBasisBase;

      // คำนวณกำไร/ขาดทุนที่ยังไม่เกิดขึ้น (Unrealized P/L)
      const unrealizedPL = marketValueLocal - costBasisLocal;
      const unrealizedPLPercentage = costBasisLocal > 0 ? (unrealizedPL / costBasisLocal) * 100 : 0;

      return {
        symbol,
        name: pos.asset.name,
        quantity,
        avgPrice,
        currentPrice,
        currency: assetCurrency,
        marketValueLocal,
        marketValueBase,
        unrealizedPL,
        unrealizedPLPercentage,
        totalDividend: Number(pos.totalDiv),
        // กำไรรวม = กำไรราคาหุ้น + ปันผลสะสม + กำไรที่ขายไปแล้วจริง
        totalReturnLocal: unrealizedPL + Number(pos.totalDiv) + Number(pos.realizedPL),
        weight: 0 // จะคำนวณสัดส่วน % ในขั้นตอนถัดไป
      };
    });

    // --- ส่วนที่ 2: คำนวณยอดเงินสดรวม (Cash) แปลงเป็น Base Currency ---
    const totalCashBase = portfolio.cashAccounts.reduce((sum, acc) => {
      const rate = fxRates[acc.currency] || 1;
      return sum + (Number(acc.balance) * rate);
    }, 0);

    // NAV = มูลค่าหุ้นทั้งหมด + เงินสดคงเหลือ
    const nav = totalMarketValueBase + totalCashBase;

    // --- ส่วนที่ 3: คำนวณสัดส่วนการลงทุน (%) และสรุปข้อมูลส่งกลับ ---
    const finalHoldings = holdings.map(h => ({
      ...h,
      weight: nav > 0 ? (h.marketValueBase / nav) * 100 : 0
    }));

    return {
      id: portfolio.id,
      name: portfolio.name,
      baseCurrency: portfolio.baseCurrency,
      summary: {
        nav,
        totalMarketValue: totalMarketValueBase,
        totalCash: totalCashBase,
        totalCostBasis: totalCostBasisBase,
        totalUnrealizedPL: totalMarketValueBase - totalCostBasisBase,
        allTimeReturnPercentage: totalCostBasisBase > 0 ? ((totalMarketValueBase - totalCostBasisBase) / totalCostBasisBase) * 100 : 0,
        cashWeight: nav > 0 ? (totalCashBase / nav) * 100 : 0
      },
      holdings: finalHoldings
    };
  }

  /**
   * บันทึกรายการเงินปันผลเข้าระบบ (Update Ledger, Cash, และ Position)
   */
  async recordDividend(userId: string, portfolioId: string, data: RecordDividendDTO) {
    return await prisma.$transaction(async (tx) => {
      // 1. ตรวจสอบว่ามีสินทรัพย์นี้ในระบบหรือไม่
      const asset = await tx.asset.findUnique({ where: { symbol: data.symbol } });
      if (!asset) throw new Error("Asset not found");

      // 2. หาบัญชีเงินสดที่ตรงกับสกุลเงินของปันผล
      const cashAccount = await tx.cashAccount.findFirst({
        where: { portfolioId, currency: asset.currency }
      });
      if (!cashAccount) throw new Error(`No cash account for ${asset.currency}`);

      // 3. บันทึก Transaction หลัก
      const transaction = await tx.transaction.create({
        data: {
          portfolioId,
          type: TransactionType.DIVIDEND,
          mainAssetId: asset.id,
          mainQuantity: new Prisma.Decimal(1),
          mainPrice: new Prisma.Decimal(data.amount),
          taxWithheld: new Prisma.Decimal(data.taxWithheld || 0),
          executedAt: data.executedAt || new Date(),
        }
      });

      // 4. ลงบัญชีแยกประเภท (Ledger Entry): เพิ่มเงินสด (Debit Cash)
      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          portfolioId,
          cashAccountId: cashAccount.id,
          accountType: AccountType.CASH,
          side: EntrySide.DEBIT,
          amount: new Prisma.Decimal(data.amount),
          assetSymbol: asset.currency
        }
      });

      // 5. อัปเดตยอดเงินสดในบัญชีจริง
      await tx.cashAccount.update({
        where: { id: cashAccount.id },
        data: { balance: { increment: data.amount } }
      });

      // 6. บันทึกยอดปันผลสะสมรายตัวหุ้น (เพื่อให้คำนวณ Yield รายตัวได้)
      await tx.position.updateMany({
        where: { portfolioId, assetId: asset.id },
        data: { totalDiv: { increment: data.amount } }
      });

      return transaction;
    });
  }

  /**
   * บันทึก Snapshot มูลค่าพอร์ตรายวัน (ใช้สำหรับวาดกราฟ History)
   */
  async createSnapshot(portfolioId: string, data: CreateSnapshotDTO) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // ตั้งเวลาเป็นเที่ยงคืนเพื่อจัดกลุ่มรายวัน

    return await prisma.portfolioSnapshot.upsert({
      where: {
        portfolioId_date: { portfolioId, date: today }
      },
      update: {
        equity: new Prisma.Decimal(data.equity),
        cash: new Prisma.Decimal(data.cash),
        unrealizedPL: new Prisma.Decimal(data.equity - data.costBasis),
        costBasis: new Prisma.Decimal(data.costBasis)
      },
      create: {
        portfolioId,
        date: today,
        equity: new Prisma.Decimal(data.equity),
        cash: new Prisma.Decimal(data.cash),
        unrealizedPL: new Prisma.Decimal(data.equity - data.costBasis),
        costBasis: new Prisma.Decimal(data.costBasis)
      }
    });
  }

  async softDelete(userId: string, id: string) {
    return await prisma.portfolio.update({
      where: { id, userId },
      data: { deletedAt: new Date() }
    });
  }
}