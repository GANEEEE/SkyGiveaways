const { ActivityType } = require('discord.js');
const { Events } = require('discord.js');
const dbManager = require('../Data/database');
const deployCommands = require('../Utlis/DeployCommands');
const restoreActiveGiveaways = require('../System/GiveawaysBack');
const restoreCommunityGiveaways = require('../System/GiveawaysCommunityBack');
const { setupChatXPTracking } = require('../LevelSystem/chatsystem');

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

            // 3. استعادة الجيفاواي
            try {
                await restoreActiveGiveaways(client);
            } catch (error) {
                if (error.status === 429) {
                    console.error(`❌ Rate limited during giveaway restore — retry after ${error.retryAfter}s`);
                } else {
                    console.error('❌ Giveaway restore failed:', error.message);
                }
            }

            // 4. استعادة الجيفاواي الخاصة بالمجتمع
            try {
                await restoreCommunityGiveaways(client);
            } catch (error) {
                if (error.status === 429) {
                    console.error(`❌ Rate limited during community giveaway restore — retry after ${error.retryAfter}s`);
                } else {
                    console.error('❌ Community giveaway restore failed:', error.message);
                }
            }

            // 5. تشغيل نظام تتبع النشاط (Activity System)
            try {
                setupChatXPTracking(client);
            } catch (error) {
                console.error('❌ Failed to start chat tracking system:', error.message);
            }

            console.log('🎉 All systems started successfully!');

        } catch (error) {
            console.error(`❌ [Ready Error] ${error.message}`);
            console.error(error.stack);
        }
    }
};