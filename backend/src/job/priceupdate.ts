import cron from 'node-cron';
import { AssetPriceService } from '../serviece/assetservice';
import prisma from '../lib/prisma';

const assetService = new AssetPriceService();
let isPolling = false;

export const startPricePolling = () => {


  
  cron.schedule('*/15 * * * *', async () => {
    // 1. Lock ป้องกันการรันซ้อน
    if (isPolling) return;

    // 2. เช็ควันและเวลา (UTC+7 สำหรับ Render)
    const thTime = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
    const day = thTime.getUTCDay();
    const hour = thTime.getUTCHours();

    // หยุดรัน เสาร์-อาทิตย์ หรือช่วง 00:00 - 08:59 น.
    if (day === 0 || day === 6 || hour < 9) {
      console.log('🌙 [Job] Market closed or midnight, skipping...');
      return;
    }

    isPolling = true;
    console.log(`🔄 [Job] Starting update at ${thTime.toISOString()}`);

    try {
      // 3. ดึงเฉพาะที่มีการเคลื่อนไหวจริง
      const activeAssets = await prisma.asset.findMany({
        where: {
          transactions: {
            some: {
              type: {
                in: ['BUY', 'SELL']
              }
            }
          }
        },
        select: { symbol: true }
      });

      const symbols = activeAssets.map(a => a.symbol);
      if (symbols.length === 0) {
        console.log('ℹ️ [Job] No active assets to update.');
        return;
      }

      console.log(`🚀 Updating ${symbols.length} active assets...`);
      // ตัวนี้มี Jitter Delay อยู่ข้างในแล้ว (Safe สำหรับ Yahoo)
      await assetService.getOrCreateAssets(symbols);

      console.log('✅ [Job] Polling Completed.');
    } catch (error) {
      console.error('❌ [Job] Polling Error:', error);
    } finally {
      isPolling = false; // สำคัญมาก: ต้องปลดล็อกที่นี่
    }
  });
};