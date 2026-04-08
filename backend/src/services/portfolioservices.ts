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
  PortfolioDetailResponse,
  PortfolioWithDetails
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
  // services/portfolio.service.ts

  calculatePortfolioDetails(
    portfolio: PortfolioWithDetails,
    currentPrices: Record<string, number>,
    fxRates: Record<string, number>
  ): PortfolioDetailResponse {

    let totalMarketValueBase = 0;
    let totalCostBasisBase = 0;
    let totalRealizedPLBase = 0; // เพิ่มตัวแปรสะสม
    let totalDividendBase = 0;   // เพิ่มตัวแปรสะสม

    const holdings = portfolio.positions.map(pos => {
      const symbol = pos.asset.symbol;
      const currentPrice = currentPrices[symbol] || 0;
      const fxRate = fxRates[pos.asset.currency];
      if (!fxRate) {
        throw new Error(`Missing FX rate for ${pos.asset.currency}`);
      }

      const quantity = Number(pos.quantity);
      const avgPrice = Number(pos.avgPrice);
      const realizedPL = Number(pos.realizedPL || 0);
      const totalDiv = Number(pos.totalDiv || 0);

      const marketValueLocal = quantity * currentPrice;
      const costBasisLocal = quantity * avgPrice;

      // แปลงค่าต่างๆ เป็น Base Currency
      const marketValueBase = marketValueLocal * fxRate;
      const costBasisBase = costBasisLocal * fxRate;
      const unrealizedPLBase = (marketValueLocal - costBasisLocal) * fxRate;
      const realizedPLBase = realizedPL * fxRate;
      const totalDivBase = totalDiv * fxRate;

      // สะสมยอดรวมพอร์ต (Base Currency)
      totalMarketValueBase += marketValueBase;
      totalCostBasisBase += costBasisBase;
      totalRealizedPLBase += realizedPLBase;
      totalDividendBase += totalDivBase;

      const unrealizedPL = marketValueLocal - costBasisLocal;

      // ส่งค่ากลับให้ตรงกับ HoldingItem interface
      return {
        symbol,
        name: pos.asset.name,
        quantity,
        avgPrice,
        currentPrice,
        currency: pos.asset.currency,
        marketValueLocal,
        marketValueBase,
        unrealizedPL,
        unrealizedPLPercentage: costBasisLocal > 0 ? (unrealizedPL / costBasisLocal) * 100 : 0,
        totalDividend: totalDiv,
        totalReturnLocal: unrealizedPL + totalDiv + realizedPL,

        // ฟิลด์ที่เพิ่มเข้ามาใหม่ตาม Interface
        unrealizedPLBase,
        realizedPLBase,
        totalDividendBase: totalDivBase,
        realizedPL,
        totalReturnBase: unrealizedPLBase + realizedPLBase + totalDivBase,
        weight: 0 // คำนวณทีหลัง
      };
    });

    const totalCashBase = portfolio.cashAccounts.reduce((sum, acc) => {
      const rate = fxRates[acc.currency] || 1;
      return sum + (Number(acc.balance) * rate);
    }, 0);

    const nav = totalMarketValueBase + totalCashBase;

    // --- ส่วน Return ที่แก้ Error ts(2739) ---
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

        // ✅ เพิ่มฟิลด์ที่ขาดไปตาม Error
        totalRealizedPL: totalRealizedPLBase,
        totalDividend: totalDividendBase,

        allTimeReturnPercentage: totalCostBasisBase > 0
          ? ((totalMarketValueBase + totalRealizedPLBase + totalDividendBase - totalCostBasisBase) / totalCostBasisBase) * 100
          : 0,
        cashWeight: nav > 0 ? (totalCashBase / nav) * 100 : 0
      },
      holdings: holdings.map(h => ({
        ...h,
        weight: nav > 0 ? (h.marketValueBase / nav) * 100 : 0
      }))
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

      // ✅ Step 4.1: CREDIT (รายได้)
      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          portfolioId,
          accountType: AccountType.INCOME,
          side: EntrySide.CREDIT,
          amount: new Prisma.Decimal(data.amount),
          assetSymbol: asset.symbol
        }
      });

      // 5. อัปเดตยอดเงินสดในบัญชีจริง
      await tx.cashAccount.update({
        where: { id: cashAccount.id },
        data: { balance: { increment: new Prisma.Decimal(data.amount) } }
      });

      // 6. บันทึกยอดปันผลสะสมรายตัวหุ้น (เพื่อให้คำนวณ Yield รายตัวได้)
      const position = await tx.position.findUnique({
        where: {
          portfolioId_assetId: {
            portfolioId,
            assetId: asset.id
          }
        }
      });

      if (position) {
        await tx.position.update({
          where: { id: position.id },
          data: {
            totalDiv: {
              increment: new Prisma.Decimal(data.amount)
            }
          }
        });
      }

      return transaction;
    });
  }

  /**
   * บันทึก Snapshot มูลค่าพอร์ตรายวัน (ใช้สำหรับวาดกราฟ History)
   */
  // services/portfolio.service.ts

  async createSnapshot(
    portfolio: PortfolioWithDetails, // แก้จาก portfolioId: string เป็น Object Type
    currentPrices: Record<string, number>,
    fxRates: Record<string, number>
  ) {
    // 1. ใช้ Logic กลางที่เราเพิ่งแก้ (calculatePortfolioDetails) มาช่วยคำนวณตัวเลข
    // วิธีนี้ทำให้เราไม่ต้องวนลูป (for/reduce) ซ้ำซ้อนในฟังก์ชันนี้อีก
    const details = this.calculatePortfolioDetails(portfolio, currentPrices, fxRates);

    const today = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate()
      )
    );

    // 2. บันทึกลง Database (Snapshot)
    // หมายเหตุ: ไม่ต้องใช้ $transaction หรือดึงข้อมูลใหม่แล้ว เพราะเรามีข้อมูลครบใน details
    return await prisma.portfolioSnapshot.upsert({
      where: {
        portfolioId_date: {
          portfolioId: portfolio.id,
          date: today
        }
      },
      update: {
        equity: new Prisma.Decimal(details.summary.nav),
        cash: new Prisma.Decimal(details.summary.totalCash),
        unrealizedPL: new Prisma.Decimal(details.summary.totalUnrealizedPL),
        costBasis: new Prisma.Decimal(details.summary.totalCostBasis)
      },
      create: {
        portfolioId: portfolio.id,
        date: today,
        equity: new Prisma.Decimal(details.summary.nav),
        cash: new Prisma.Decimal(details.summary.totalCash),
        unrealizedPL: new Prisma.Decimal(details.summary.totalUnrealizedPL),
        costBasis: new Prisma.Decimal(details.summary.totalCostBasis)
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