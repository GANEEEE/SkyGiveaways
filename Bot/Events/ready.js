const { ActivityType } = require('discord.js');
const { Events } = require('discord.js');
const dbManager = require('../Data/database');
const deployCommands = require('../Utlis/DeployCommands');
const chatXPSystem = require('../LevelSystem/chatsystem');
const voiceXPSystem = require('../LevelSystem/voicesystem');
const bumpHandler = require('../LevelSystem/bumpsystem');
const voteHandler = require('../LevelSystem/votesystem');
const restoreActiveGiveaways = require('../System/GiveawaysBack');
const { couponSystem } = require('../LevelSystem/couponsystem');

// ============================================================
// 1. RATE LIMIT MANAGER
// ============================================================
class RateLimitManager {
    constructor() {
        this.requestsThisSecond = 0;
        this.windowStart = Date.now();
        this.maxPerSecond = 40;

        this.requestsPer100ms = 0;
        this.window100ms = Date.now();
        this.maxPer100ms = 8;

        this.requestsThisMinute = 0;
        this.windowMinute = Date.now();
        this.maxPerMinute = 1800;
    }

    async throttle() {
        const now = Date.now();

        if (now - this.windowMinute >= 60000) {
            this.requestsThisMinute = 0;
            this.windowMinute = now;
        }
        if (this.requestsThisMinute >= this.maxPerMinute) {
            const wait = 60000 - (now - this.windowMinute);
            if (wait > 0) {
                console.warn(`🛑 [RateLimit/Minute] Limit reached, waiting ${wait}ms`);
                await new Promise(r => setTimeout(r, wait));
            }
            this.requestsThisMinute = 0;
            this.windowMinute = Date.now();
        }

        if (Date.now() - this.window100ms >= 100) {
            this.requestsPer100ms = 0;
            this.window100ms = Date.now();
        }
        if (this.requestsPer100ms >= this.maxPer100ms) {
            const wait = 100 - (Date.now() - this.window100ms);
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
            this.requestsPer100ms = 0;
            this.window100ms = Date.now();
        }

        if (Date.now() - this.windowStart >= 1000) {
            this.requestsThisSecond = 0;
            this.windowStart = Date.now();
        }
        if (this.requestsThisSecond >= this.maxPerSecond) {
            const wait = 1000 - (Date.now() - this.windowStart);
            if (wait > 0) {
                console.warn(`⚠️ [RateLimit/Second] Reached ${this.requestsThisSecond}/${this.maxPerSecond}, waiting ${wait}ms`);
                await new Promise(r => setTimeout(r, wait));
            }
            this.requestsThisSecond = 0;
            this.windowStart = Date.now();
        }

        this.requestsThisSecond++;
        this.requestsPer100ms++;
        this.requestsThisMinute++;
    }

    async run(task) {
        await this.throttle();
        return await task();
    }
}

// ============================================================
// 2. RETRY QUEUE - Exponential Backoff
// ============================================================
class RetryQueue {
    constructor(rateLimiter) {
        this.rateLimiter = rateLimiter;
    }

    async execute(task, options = {}) {
        const {
            taskName = 'unknown',
            maxRetries = 3,
            baseDelay = 1000,
            maxDelay = 15000,
            timeout = 30000
        } = options;

        let lastError;

        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
            try {
                const result = await Promise.race([
                    this.rateLimiter.run(task),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
                    )
                ]);
                if (attempt > 1) console.log(`✅ [Retry] ${taskName} succeeded on attempt ${attempt}`);
                return result;

            } catch (error) {
                lastError = error;

                const isRateLimit = error.code === 429 || error.status === 429;
                const retryAfter = isRateLimit ? (error.retryAfter || 5000) : null;

                if (attempt <= maxRetries) {
                    const expDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
                    const jitter = Math.random() * 500;
                    const delay = retryAfter ? retryAfter + jitter : expDelay + jitter;

                    console.warn(`🔄 [Retry] ${taskName} attempt ${attempt}/${maxRetries + 1} failed: ${error.message}. Retrying in ${Math.round(delay)}ms`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        console.error(`❌ [Retry] ${taskName} failed after ${maxRetries + 1} attempts: ${lastError.message}`);
        throw lastError;
    }
}

// ============================================================
const rateLimiter = new RateLimitManager();
const retryQueue  = new RetryQueue(rateLimiter);

// ============================================================
module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        try {
            console.log('🤖 Bot is starting... Please wait for systems to initialize');

            // 1. Presence
            client.user.setPresence({
                activities: [{ name: '💬 | Connecting the Community', type: ActivityType.Listening }],
                status: 'online'
            });
            console.log(`✅ Bot logged in as ${client.user.tag}`);

            // 2. DB + Deploy Commands
            try {
                await retryQueue.execute(
                    () => dbManager.get('SELECT 1 as test'),
                    { taskName: 'db_check', timeout: 10000 }
                );
                console.log('✅ Database: OK');
                await deployCommands();
            } catch (error) {
                console.error('❌ Database check failed:', error.message);
            }

            // 3. استعادة الجيفاواي — عنده rate limiter خاص بيه في GiveawaysBack.js
            try {
                await restoreActiveGiveaways(client);
            } catch (error) {
                if (error.status === 429) {
                    console.error(`❌ Rate limited during giveaway restore — retry after ${error.retryAfter}s`);
                } else {
                    console.error('❌ Giveaway restore failed:', error.message);
                }
            }

            // 4. XP Systems
            if (chatXPSystem && typeof chatXPSystem.setupChatXPTracking === 'function') {
                chatXPSystem.setupChatXPTracking(client);
                console.log('✅ Chat XP System started');
            }
            if (voiceXPSystem && typeof voiceXPSystem.setupVoiceXPTracking === 'function') {
                voiceXPSystem.setupVoiceXPTracking(client);
                console.log('✅ Voice XP System started');
            }

            // 5. نظام الـ Bump
            client.on(Events.MessageCreate, async (message) => {
                if (message.author.id === '813077581749288990') {
                    if (bumpHandler && typeof bumpHandler.execute === 'function') {
                        await bumpHandler.execute(message, client);
                    }
                }
            });

            // 6. نظام التصويت
            client.on(Events.MessageCreate, async (message) => {
                try {
                    if (message.author.id === '1180555656969863228') {
                        console.log('🗳️ === VOTE BOT DETECTED ===');
                        if (voteHandler && typeof voteHandler.execute === 'function') {
                            await voteHandler.execute(message, client);
                        }
                    }
                } catch (error) {
                    console.error('❌ Error in vote handler:', error);
                }
            });

            // 7. Shop Discount Lottery
            try {
                console.log('🎰 Starting shop discount lottery...');
                const lotteryResult = await retryQueue.execute(
                    () => dbManager.runDailyDiscountLottery(),
                    { taskName: 'initial_lottery', timeout: 15000 }
                );
                console.log('✅ First lottery result:', lotteryResult.success ? 'SUCCESS' : 'FAILED');
                if (lotteryResult.success) {
                    console.log(`🛍️ SALE APPLIED! ${lotteryResult.discount}% off on ${lotteryResult.item.name}`);
                } else {
                    console.log(`ℹ️ No sale: ${lotteryResult.message || lotteryResult.code}`);
                }
            } catch (lotteryError) {
                console.error('❌ Shop lottery error:', lotteryError.message);
            }

            // كل 12 ساعة
            setInterval(async () => {
                try {
                    console.log('🔄 Running scheduled shop lottery...');
                    const result = await retryQueue.execute(
                        () => dbManager.runDailyDiscountLottery(),
                        { taskName: 'scheduled_lottery', timeout: 15000 }
                    );
                    if (result.success) {
                        console.log(`🎉 NEW sale applied: ${result.discount}% off on ${result.item.name}`);
                    } else {
                        if (result.currentDiscount) {
                            console.log(`📝 Lottery failed → Keeping OLD discount: ${result.currentDiscount.description || result.currentDiscount.role_id} (${result.currentDiscount.current_discount}% off)`);
                        } else {
                            console.log(`📝 No sale this time: ${result.code || 'No eligible items'}`);
                        }
                    }
                } catch (intervalError) {
                    console.error('❌ Interval lottery error:', intervalError.message);
                }
            }, 12 * 60 * 60 * 1000);

            // 8. تنظيف التخفيضات القديمة
            try {
                const cleaned = await retryQueue.execute(
                    () => dbManager.cleanupOldDiscounts(),
                    { taskName: 'cleanup_discounts', timeout: 15000 }
                );
                if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} old discounts`);
            } catch (cleanupError) {
                console.error('❌ Cleanup error:', cleanupError.message);
            }

            // 9. تنظيف الكوبونات
            try {
                await retryQueue.execute(
                    () => couponSystem.cleanupExpiredCoupons(),
                    { taskName: 'cleanup_coupons', timeout: 15000 }
                );
                console.log('✅ Initial coupon cleanup done');
            } catch (error) {
                console.error('❌ Coupon cleanup error:', error.message);
            }

            // 10. تنظيف الـ Buffs — بياخد client يعني Discord API calls
            try {
                console.log('🧹 Starting expired buffs cleanup job...');
                const GUILD_ID = process.env.GUILD_ID;

                const initialResult = await retryQueue.execute(
                    () => dbManager.cleanupExpiredBuffs(client, GUILD_ID),
                    { taskName: 'initial_buff_cleanup', timeout: 30000 }
                );
                if (initialResult.cleaned > 0) {
                    console.log(`✅ Initial cleanup: ${initialResult.cleaned} expired buffs removed`);
                }

                setInterval(async () => {
                    try {
                        const result = await retryQueue.execute(
                            () => dbManager.cleanupExpiredBuffs(client, GUILD_ID),
                            { taskName: 'scheduled_buff_cleanup', timeout: 30000 }
                        );
                        if (result.cleaned > 0) {
                            console.log(`🔄 Auto-cleaned ${result.cleaned} expired buffs`);
                        }
                    } catch (error) {
                        console.error('❌ Error in buff cleanup job:', error.message);
                    }
                }, 30 * 60 * 1000);

                console.log('✅ Buff cleanup job started (every 30 minutes)');
            } catch (error) {
                console.error('❌ Failed to start buff cleanup job:', error);
            }

            // 11. Daily XP Reset — بعد 5 ثواني
            console.log('🔄 Setting up daily XP limits reset...');

            setTimeout(async () => {
                try {
                    if (chatXPSystem && typeof chatXPSystem.resetDailyLimits === 'function') {
                        await chatXPSystem.resetDailyLimits();
                        console.log('✅ Daily XP limits reset successfully');
                    }
                    if (voiceXPSystem && typeof voiceXPSystem.resetDailyLimits === 'function') {
                        await voiceXPSystem.resetDailyLimits();
                        console.log('✅ Daily Voice XP limits reset successfully');
                    }
                } catch (error) {
                    console.error('❌ Failed to reset daily XP limits:', error.message);
                }
            }, 5000);

            // كل 24 ساعة
            setInterval(async () => {
                try {
                    console.log('🔄 Running scheduled daily XP limits reset...');
                    if (chatXPSystem && typeof chatXPSystem.resetDailyLimits === 'function') {
                        await chatXPSystem.resetDailyLimits();
                    }
                    if (voiceXPSystem && typeof voiceXPSystem.resetDailyLimits === 'function') {
                        await voiceXPSystem.resetDailyLimits();
                    }
                    console.log('✅ Daily XP limits reset completed');
                } catch (error) {
                    console.error('❌ Error in scheduled XP limits reset:', error.message);
                }
            }, 24 * 60 * 60 * 1000);

            console.log('✅ Daily XP limits reset system started (every 24 hours)');
            console.log('🎉 All systems started successfully!');

        } catch (error) {
            console.error(`❌ [Ready Error] ${error.message}`);
            console.error(error.stack);
        }
    }
};