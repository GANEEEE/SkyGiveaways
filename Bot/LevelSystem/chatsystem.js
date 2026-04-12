const { Events } = require('discord.js');
const dbManager = require('../Data/database');
const { ActivityRewardsManager } = require('../LevelSystem/activitysystem');
const activityManager = new ActivityRewardsManager(dbManager);

// ========== ACTIVITY SYSTEM ONLY (Message Counting for Sky Tokens) ==========
class MessageProcessor {
    constructor(client) {
        this.client = client;

        // Activity system: 2-3 messages + 1s cooldown
        this.userLastActivityTime = new Map();   // cooldown tracker
        this.userActivityCounter = new Map();    // progress towards target (2 or 3)

        this.ACTIVITY_COOLDOWN = 1; // seconds

        // Cleanup old data every hour
        setInterval(() => this.cleanupActivityCounters(), 60 * 60 * 1000);

        console.log('🚀 Starting Activity System (Sky Tokens tracking)...');
    }

    // Check cooldown
    isOnActivityCooldown(userId) {
        const lastTime = this.userLastActivityTime.get(userId);
        if (!lastTime) return false;
        const now = Date.now();
        return (now - lastTime) < this.ACTIVITY_COOLDOWN * 1000;
    }

    updateActivityCooldown(userId) {
        this.userLastActivityTime.set(userId, Date.now());
    }

    // Returns true when target reached (2 or 3 messages)
    updateActivityCounter(userId) {
        let userData = this.userActivityCounter.get(userId);
        if (!userData) {
            const target = Math.floor(Math.random() * 2) + 2; // 2 or 3
            userData = { count: 1, target, lastReset: new Date() };
            this.userActivityCounter.set(userId, userData);
            return false;
        }
        userData.count++;
        if (userData.count >= userData.target) {
            return true;
        }
        return false;
    }

    resetActivityCounter(userId) {
        const userData = this.userActivityCounter.get(userId);
        if (userData) {
            const newTarget = Math.floor(Math.random() * 2) + 2;
            userData.count = 0;
            userData.target = newTarget;
            userData.lastReset = new Date();
        }
    }

    cleanupActivityCounters() {
        const oneHour = 60 * 60 * 1000;
        const now = Date.now();
        let cleaned = 0;

        for (const [userId, data] of this.userActivityCounter.entries()) {
            if (data.lastReset && (now - data.lastReset.getTime()) > oneHour) {
                this.userActivityCounter.delete(userId);
                cleaned++;
            }
        }

        for (const [userId, timestamp] of this.userLastActivityTime.entries()) {
            if (now - timestamp > this.ACTIVITY_COOLDOWN * 1000) {
                this.userLastActivityTime.delete(userId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} old activity entries`);
        }
    }

    async processMessage(message) {
        try {
            if (!message || message.author.bot || message.system || !message.guild) {
                return { success: false, reason: 'invalid_message' };
            }

            const userId = message.author.id;
            const username = message.author.username;
            const guildId = message.guild.id;
            const channelId = message.channel.id;

            // Check if channel is counted (optional, but keep for flexibility)
            const isCounted = await dbManager.isChannelCounted(guildId, channelId);
            if (!isCounted) {
                return { success: false, reason: 'channel_not_counted' };
            }

            // Activity system: cooldown + 2-3 messages
            const onCooldown = this.isOnActivityCooldown(userId);

            if (!onCooldown) {
                this.updateActivityCooldown(userId);
                const shouldRewardActivity = this.updateActivityCounter(userId);

                if (shouldRewardActivity) {
                    this.resetActivityCounter(userId);
                    await activityManager.incrementMessages(userId, username);
                    console.log(`🎯 ${username}: +1 activity count (Sky Tokens)!`);
                } else {
                    const currentData = this.userActivityCounter.get(userId);
                    console.log(`📊 ${username}: activity progress ${currentData?.count}/${currentData?.target}`);
                }
            } else {
                console.log(`⏰ ${username}: activity cooldown (${this.ACTIVITY_COOLDOWN}s)`);
            }

            return { success: true, rewarded: true };
        } catch (error) {
            console.error('❌ Error processing message:', error);
            return { success: false, reason: 'error', error: error.message };
        }
    }
}

// ========== MAIN SETUP ==========
let messageProcessor = null;

function setupChatXPTracking(client) {
    console.log('🚀 Setting up Activity System (Sky Tokens)...');
    console.log('='.repeat(40));

    messageProcessor = new MessageProcessor(client);
    console.log('✅ Message Processor initialized');

    // Start scheduled resets for activity rewards (daily/weekly/etc.)
    const LOG_CHANNEL_ID = '1385973464095133708'; // optional, can be null
    activityManager.startScheduledResets(client, LOG_CHANNEL_ID);

    // Message event
    client.on(Events.MessageCreate, async (message) => {
        if (!message || message.author.bot || message.system || !message.guild) return;
        if (!messageProcessor) return;

        messageProcessor.processMessage(message).catch(error => {
            if (error.message?.includes('channel_not_counted')) return;
            console.error('❌ Message processing error:', error.message);
        });
    });

    console.log('✅ Activity System is running!');
    console.log('='.repeat(40));
}

// ========== EXPORTS ==========
module.exports = {
    setupChatXPTracking,
    getMessageProcessor: () => messageProcessor,
    activityManager,
};