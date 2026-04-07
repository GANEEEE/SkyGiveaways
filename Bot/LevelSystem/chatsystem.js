const { Events } = require('discord.js');
const dbManager = require('../Data/database');
const levelSystem = require('../LevelSystem/levelsystem');
const buffSystem = require('../LevelSystem/globalbuffs');
const { ActivityRewardsManager } = require('../LevelSystem/activitysystem');
const activityManager = new ActivityRewardsManager(dbManager);

// ========== SIMPLIFIED CHAT XP SYSTEM ==========
class MessageProcessor {
    constructor(client) {
        this.client = client;

        this.userMessageCounts = new Map();
        this.staffMembers = [];
        this.userReplies = new Map();
        this.staffReactions = new Map();

        // ⭐ للـ Activity System
        this.userLastActivityTime = new Map();   // للتخزين الـ Cooldown
        this.userActivityCounter = new Map();    // للعداد 2-3 رسائل
        this.ACTIVITY_COOLDOWN = 1;              // 1 ثانية بين كل رسالة

        // تنظيف Old Data: كل 4 ساعات
        setInterval(() => this.cleanupOldData(), 4 * 60 * 60 * 1000);

        // تنظيف Old Counters: كل 12 ساعة
        setInterval(() => this.cleanupOldCounters(), 12 * 60 * 60 * 1000);

        // ⭐ تنظيف الـ Activity كل ساعة
        setInterval(() => this.cleanupActivityCounters(), 60 * 60 * 1000);

        console.log('🚀 Starting Chat XP System...');
    }

    // ========== ACTIVITY SYSTEM (2-3 رسائل + Cooldown 1 ثانية) ==========

    isOnActivityCooldown(userId) {
        const lastTime = this.userLastActivityTime.get(userId);
        if (!lastTime) return false;
        const now = Date.now();
        const cooldownMs = this.ACTIVITY_COOLDOWN * 1000;
        return (now - lastTime) < cooldownMs;
    }

    updateActivityCooldown(userId) {
        this.userLastActivityTime.set(userId, Date.now());
    }

    updateActivityCounter(userId) {
        let userData = this.userActivityCounter.get(userId);
        if (!userData) {
            const target = Math.floor(Math.random() * 2) + 2;  // 2 أو 3
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
            const newTarget = Math.floor(Math.random() * 2) + 2;  // 2 أو 3
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

    updateMessageCounter(userId) {
        let userData = this.userMessageCounts.get(userId);

        if (!userData) {
            const target = Math.floor(Math.random() * 6) + 3;
            userData = { count: 1, target };
            this.userMessageCounts.set(userId, userData);
            return false;
        }

        userData.count++;
        return userData.count >= userData.target;
    }

    resetMessageCounter(userId) {
        const userData = this.userMessageCounts.get(userId);
        if (userData) {
            const newTarget = Math.floor(Math.random() * 7) + 4;
            userData.count = 0;
            userData.target = newTarget;
            userData.lastReset = new Date();
            console.log(`🔄 ${userId}: Counter reset. New target: ${newTarget}`);
        }
    }

    cleanupOldCounters() {
        const oneDay = 24 * 60 * 60 * 1000;
        const now = Date.now();
        let cleanedCount = 0;

        console.log('🧹 Cleaning old message counters...');

        for (const [userId, data] of this.userMessageCounts.entries()) {
            if (data.lastReset && (now - data.lastReset.getTime()) > oneDay) {
                this.userMessageCounts.delete(userId);
                cleanedCount++;
            }
        }

        console.log(`✅ Cleaned ${cleanedCount} old counters`);
    }

    cleanupMessageCounters() {
        try {
            const MAX_COUNTERS = 1000;
            const TWO_HOURS = 2 * 60 * 60 * 1000;
            const now = Date.now();
            let cleaned = 0;
            let totalCleaned = 0;

            for (const [userId, data] of this.userMessageCounts.entries()) {
                if (data.lastReset && (now - data.lastReset.getTime()) > TWO_HOURS) {
                    this.userMessageCounts.delete(userId);
                    cleaned++;
                }
            }

            if (this.userMessageCounts.size > MAX_COUNTERS) {
                const toRemove = Math.floor(this.userMessageCounts.size * 0.3);
                const entries = Array.from(this.userMessageCounts.entries());
                for (let i = 0; i < toRemove; i++) {
                    this.userMessageCounts.delete(entries[i][0]);
                    totalCleaned++;
                }
            }

            const ONE_HOUR = 60 * 60 * 1000;
            for (const [userId, timestamp] of this.staffReactions.entries()) {
                if (now - timestamp > ONE_HOUR) {
                    this.staffReactions.delete(userId);
                }
            }

            if (cleaned > 0 || totalCleaned > 0) {
                console.log(`🧹 Message counters: ${cleaned} old + ${totalCleaned} excess`);
            }

            return { cleaned, totalCleaned, remaining: this.userMessageCounts.size };

        } catch (error) {
            console.error('❌ Error in cleanupMessageCounters:', error.message);
            return { cleaned: 0, totalCleaned: 0, remaining: 0 };
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

            const isCounted = await dbManager.isChannelCounted(guildId, channelId);
            if (!isCounted) {
                return { success: false, reason: 'channel_not_counted' };
            }

            // ===== تسجيل الرسائل في activity_rewards (2-3 رسائل + Cooldown 1 ثانية) =====

            const onCooldown = this.isOnActivityCooldown(userId);

            if (!onCooldown) {
                this.updateActivityCooldown(userId);
                const shouldRewardActivity = this.updateActivityCounter(userId);

                if (shouldRewardActivity) {
                    this.resetActivityCounter(userId);
                    await activityManager.incrementMessages(userId, username);
                    console.log(`🎯 ${username}: +1 activity count!`);
                } else {
                    const currentData = this.userActivityCounter.get(userId);
                    console.log(`📊 ${username}: activity progress ${currentData?.count}/${currentData?.target}`);
                }
            } else {
                console.log(`⏰ ${username}: activity cooldown (${this.ACTIVITY_COOLDOWN}s)`);
            }

            const shouldReward = this.updateMessageCounter(userId);

            if (shouldReward) {
                await dbManager.ensureUserExists(userId, username);

                const baseReward = this.calculateReward();
                let userBuff = 0;
                let finalReward = { xp: baseReward.xp, coins: baseReward.coins, crystals: 0 };

                if (message.guild && buffSystem) {
                    try {
                        userBuff = await buffSystem.getBuff(userId, message.guild);
                        if (userBuff > 0) {
                            console.log(`📈 Applying ${userBuff}% buff to ${username}'s chat reward`);
                            finalReward = buffSystem.applyBuff(finalReward, userBuff);
                        }
                    } catch (buffError) {
                        console.error(`⚠️ Buff system error:`, buffError.message);
                    }
                }

                const levelResult = await levelSystem.processUserRewards(
                    userId, username,
                    finalReward.xp, finalReward.coins, 0,
                    this.client, message.guild, 'chat'
                );

                this.resetMessageCounter(userId);

                const dropResult = await dbManager.processMessageForDrops(userId, username);

                await this.updateMissions(message, userId, dropResult);

                if (global.challengeManager) {
                    await global.challengeManager.processMessageForChallenge(
                        guildId, userId, username, message
                    ).catch(() => {});
                }

                // ✅ FIX: استخدام mentions.repliedUser بدل message.channel.messages.fetch
                if (message.reference) {
                    await this.processReply(message);
                }

                if (finalReward.coins > 0) {
                    await dbManager.updateGoalProgress(userId, 'total_coins', finalReward.coins);
                    await dbManager.updateGoalProgress(userId, 'drop_coins', finalReward.coins);
                }

                console.log(`💬 ${username}: +${finalReward.xp} XP (+${userBuff}%), +${finalReward.coins} coins (+${userBuff}%)`);
                if (levelResult.levelUp) {
                    console.log(`🎉 ${username} leveled up to ${levelResult.newLevel}!`);
                }

                const userData = this.userMessageCounts.get(userId);

                return {
                    success: true,
                    rewarded: true,
                    reward: {
                        xp: finalReward.xp,
                        coins: finalReward.coins,
                        buffApplied: userBuff,
                        levelUp: levelResult.levelUp,
                        newLevel: levelResult.newLevel
                    },
                    messageCount: userData ? userData.target : 0,
                    dropResult,
                    dailyStats: {
                        xpEarnedToday: levelResult.earned?.xp || 0,
                        coinsEarnedToday: levelResult.earned?.coins || 0,
                        totalXP: levelResult.totalXP || 0,
                        totalCoins: levelResult.totalCoins || 0,
                        levelInfo: levelResult
                    }
                };

            } else {
                const currentData = this.userMessageCounts.get(userId);

                await this.updateMissions(message, userId, { success: false, hasDrops: false });

                // ✅ FIX: نفس الإصلاح هنا كمان
                if (message.reference) {
                    await this.processReply(message);
                }

                return {
                    success: true,
                    rewarded: false,
                    progress: {
                        current: currentData?.count || 0,
                        target: currentData?.target || 0,
                        remaining: (currentData?.target || 0) - (currentData?.count || 0)
                    },
                    message: `📊 Progress: ${currentData?.count || 0}/${currentData?.target || 0} messages until reward`
                };
            }

        } catch (error) {
            console.error('❌ Error processing message:', error);
            return { success: false, reason: 'error', error: error.message };
        }
    }

    // ========== REPLIES SYSTEM ==========
    // ✅ FIX: مفيش API call — بنستخدم mentions.repliedUser اللي موجود على الـ message مباشرة
    async processReply(message) {
        try {
            // استخدام mentions.repliedUser بدل message.channel.messages.fetch
            // ده موجود على الـ message object بدون أي HTTP request
            const repliedUser = message.mentions.repliedUser;

            if (!repliedUser) {
                return;
            }

            const userId = message.author.id;
            const username = message.author.username;
            const repliedUserId = repliedUser.id;
            const repliedUsername = repliedUser.username;

            console.log(`\n💬 REPLY DETECTED: ${username} -> ${repliedUsername}`);

            if (userId === repliedUserId) {
                console.log(`   ⚠️ Replying to self - Skipping`);
                return;
            }

            if (repliedUser.bot) {
                console.log(`   ⚠️ Replying to bot - Skipping`);
                return;
            }

            console.log(`   ✅ Valid unique reply detected!`);

            const isNewReply = await this.trackUniqueReply(userId, repliedUserId);

            if (isNewReply) {
                console.log(`   🎯 NEW UNIQUE REPLY COUNTED!`);
                await dbManager.updateGoalProgress(userId, 'unique_replies', 1);
                console.log(`   📊 Updated unique_replies goal for ${username}`);
            } else {
                console.log(`   📝 Already replied to ${repliedUsername} today`);
            }

        } catch (error) {
            console.error('❌ Error processing reply:', error.message);
        }
    }

    async trackUniqueReply(userId, repliedUserId) {
        try {
            const today = new Date().toDateString();
            let userData = this.userReplies.get(userId);

            if (!userData) {
                userData = { lastReplies: new Set(), lastReset: today };
                this.userReplies.set(userId, userData);
            }

            if (userData.lastReset !== today) {
                userData.lastReplies.clear();
                userData.lastReset = today;
            }

            if (!userData.lastReplies.has(repliedUserId)) {
                userData.lastReplies.add(repliedUserId);
                console.log(`   ✅ New unique reply. Total today: ${userData.lastReplies.size}`);
                return true;
            }

            console.log(`   ⚠️ Already replied to this user today`);
            return false;

        } catch (error) {
            console.error('❌ Error tracking unique reply:', error.message);
            return false;
        }
    }

    // ========== STAFF REACTIONS SYSTEM ==========
    // ✅ FIX: بنستخدم guild.roles.cache بدل guild.roles.fetch — مفيش API call
    async setupStaffMembers(guild) {
        try {
            console.log(`🔍 Setting up staff for: ${guild.name}`);

            this.staffMembers.length = 0;
            const staffRoleIds = ['1465705479123636415'];
            let addedCount = 0;

            for (const roleId of staffRoleIds) {
                // استخدام cache بدل fetch — لو الـ role مش في الـ cache هنعمل fetch مرة واحدة بس
                let role = guild.roles.cache.get(roleId);
                if (!role) {
                    try {
                        role = await guild.roles.fetch(roleId);
                    } catch (error) {
                        console.error(`❌ Error fetching role ${roleId}:`, error.message);
                        continue;
                    }
                }
                if (!role) continue;

                role.members.forEach(member => {
                    if (!member.user.bot) {
                        this.staffMembers.push(member.user.id);
                        addedCount++;
                    }
                });
            }

            console.log(`✅ Added ${addedCount} staff members (${this.staffMembers.length} total)`);

        } catch (error) {
            console.error('❌ Error in setupStaffMembers:', error.message);
        }
    }

    async processStaffReaction(reaction, user) {
        try {
            if (!this.staffMembers.includes(user.id)) return;

            const message = reaction.message;
            if (message.author.bot) return;

            const memberId = message.author.id;
            const username = message.author.username;

            if (memberId === user.id) {
                console.log(`⚠️ ${user.username} reacted to their own message - No reward`);
                return;
            }

            console.log(`⭐ Staff ${user.username} reacted to ${username}'s message!`);

            const baseReward = this.calculateReward();
            let userBuff = 0;
            let finalReward = { xp: baseReward.xp, coins: baseReward.coins, crystals: 0 };

            if (reaction.message.guild && buffSystem) {
                try {
                    userBuff = await buffSystem.getBuff(memberId, reaction.message.guild);
                    if (userBuff > 0) {
                        finalReward = buffSystem.applyBuff(finalReward, userBuff);
                    }
                } catch (buffError) {
                    console.error(`⚠️ Buff system error:`, buffError.message);
                }
            }

            await levelSystem.processUserRewards(
                memberId, username,
                finalReward.xp, finalReward.coins, 0,
                this.client, reaction.message.guild, 'reaction'
            );

            this.staffReactions.set(memberId, Date.now());
            await dbManager.updateGoalProgress(memberId, 'staff_reacts', 1);

            console.log(`⭐ Staff ${user.username} → ${username}: +${finalReward.xp} XP (+${userBuff}%), +${finalReward.coins} coins (+${userBuff}%)`);

        } catch (error) {
            console.error('❌ Error processing staff reaction:', error.message);
        }
    }

    cleanupOldData() {
        const now = Date.now();
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
        let cleaned = 0;

        for (const [userId, timestamp] of this.staffReactions.entries()) {
            if (now - timestamp > THREE_DAYS) {
                this.staffReactions.delete(userId);
                cleaned++;
            }
        }

        const threeDaysAgo = new Date(now - THREE_DAYS).toDateString();
        for (const [userId, data] of this.userReplies.entries()) {
            if (data.lastReset && data.lastReset < threeDaysAgo) {
                this.userReplies.delete(userId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Chat System: Cleaned ${cleaned} old entries (3+ days)`);
        }
    }

    // ========== MISSIONS SYSTEM ==========
    async updateMissions(message, userId, dropResult) {
        try {
            await dbManager.updateGoalProgress(userId, 'messages', 1);

            if (dropResult && dropResult.success && dropResult.hasDrops) {
                await dbManager.updateGoalProgress(userId, 'drops', dropResult.drops.length);
                if (dropResult.rewards && dropResult.rewards.coins > 0) {
                    await dbManager.updateGoalProgress(userId, 'drop_coins', dropResult.rewards.coins);
                }
            }
        } catch (error) {
            console.error(`❌ Failed to update missions for ${userId}:`, error.message);
        }
    }

    // ========== HELPER METHODS ==========
    calculateReward() {
        const random = Math.random() * 100;
        let xp;
        if (random < 30) xp = 3;
        else if (random < 55) xp = 4;
        else if (random < 75) xp = 5;
        else if (random < 90) xp = 6;
        else if (random < 98) xp = 7;
        else xp = 8;

        const coins = Math.floor(Math.random() * 4) + 2;
        return { xp, coins };
    }

    getUserProgress(userId) {
        const data = this.userMessageCounts.get(userId);
        if (!data) {
            const target = Math.floor(Math.random() * 7) + 4;
            return { current: 0, target, remaining: target };
        }
        return {
            current: data.count,
            target: data.target,
            remaining: data.target - data.count
        };
    }

    getSystemInfo() {
        return {
            name: 'Chat XP System',
            activeUsers: this.userMessageCounts.size,
            staffCount: this.staffMembers.length,
            batchSystem: '3-8 messages per reward',
            memory: {
                userCounters: this.userMessageCounts.size,
                staffMembers: this.staffMembers.length,
                userReplies: this.userReplies.size
            }
        };
    }
}

// ========== DROP SYSTEM INTEGRATION ==========
let dropSystemInstance = null;

function initializeDropSystem(client) {
    const { DropSystem } = require('./dropsystem');
    dropSystemInstance = new DropSystem(client);
    return dropSystemInstance.setup();
}

async function processMessageForDrops(userId, username, channel = null) {
    if (!dropSystemInstance) return null;

    try {
        const progress = await dbManager.getUserDropProgress(userId, username);
        if (!progress) return null;

        await dbManager.run(
            `UPDATE user_drop_progress 
             SET total_messages = total_messages + 1,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE user_id = ?`,
            [userId]
        );

        const availableDrops = await dbManager.checkAvailableDrops(userId);

        if (availableDrops && availableDrops.length > 0) {
            const drops = [];
            let totalCoins = 0, totalXP = 0, totalCrystals = 0;

            for (const drop of availableDrops) {
                const crateResult = await dbManager.createCrate(userId, username, drop.type);
                if (crateResult.success) {
                    await dbManager.updateDropTarget(userId, drop.type);

                    const crateInfo = await dbManager.get(
                        'SELECT coins_amount, xp_amount, crystals_amount FROM user_crates WHERE id = ?',
                        [crateResult.crateId]
                    );

                    if (crateInfo) {
                        totalCoins += crateInfo.coins_amount || 0;
                        totalXP += crateInfo.xp_amount || 0;
                        totalCrystals += crateInfo.crystals_amount || 0;
                    }

                    drops.push({ type: drop.type, crateId: crateResult.crateId });
                }
            }

            return {
                success: true,
                hasDrops: true,
                drops,
                rewards: { coins: totalCoins, xp: totalXP, crystals: totalCrystals }
            };
        }

        return { success: true, hasDrops: false };

    } catch (error) {
        console.error('❌ Drop System processing error:', error.message);
        return null;
    }
}

async function sendDropNotification(userId, username, drops, channel = null) {
    if (!drops || drops.length === 0 || !channel) return;

    try {
        const dropTypes = drops.reduce((acc, drop) => {
            acc[drop.type] = (acc[drop.type] || 0) + 1;
            return acc;
        }, {});

        const dropText = Object.entries(dropTypes)
            .map(([type, count]) => {
                const cap = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
                return `${count} ${cap}`;
            })
            .join(', ');

        await channel.send({
            content: `**Congratulations <@${userId}>!**\n-# Your journey rewards you with **${dropText}**, Enjoy`,
            allowedMentions: { users: [userId] }
        });

        console.log(`📢 Sent drop notification for ${username}: ${dropText}`);

    } catch (error) {
        console.error('❌ Failed to send drop notification:', error.message);
    }
}

// ========== MAIN SYSTEM ==========
let messageProcessor = null;

function setupChatXPTracking(client) {
    console.log('🚀 Setting up Chat XP System...');
    console.log('='.repeat(40));

    messageProcessor = new MessageProcessor(client);
    console.log('✅ Message Processor initialized');

    setTimeout(() => {
        const mainGuild = client.guilds.cache.first();
        if (mainGuild) {
            messageProcessor.setupStaffMembers(mainGuild)
                .then(() => console.log('✅ Staff members loaded'))
                .catch(err => console.log('⚠️ Staff setup:', err.message));
        }

        try {
            const { DropSystem } = require('./dropsystem');
            dropSystemInstance = new DropSystem(client);
            dropSystemInstance.setup()
                .then(() => console.log('✅ Drop System loaded'))
                .catch(err => console.log('⚠️ Drop system:', err.message));
        } catch (error) {
            console.log('⚠️ Drop system init error:', error.message);
        }

        try {
            const { GlobalChallengeManager } = require('./eventsystem');
            global.challengeManager = new GlobalChallengeManager(client);
            global.challengeManager.setup()
                .then(() => console.log('✅ Challenge System loaded'))
                .catch(err => console.log('⚠️ Challenge system:', err.message));
        } catch (error) {
            console.log('⚠️ Challenge system init error:', error.message);
        }

        console.log('✅ All subsystems initialized');
        console.log('📊 System Info:', messageProcessor.getSystemInfo());

        const LOG_CHANNEL_ID = '1385973464095133708'; // ضع ID القناة لو عايز logs
        activityManager.startScheduledResets(client, LOG_CHANNEL_ID);

    }, 1000);

    // Message Processing Event
    client.on(Events.MessageCreate, async (message) => {
        if (!message || message.author.bot || message.system || !message.guild) return;
        if (!messageProcessor) return;

        messageProcessor.processMessage(message)
            .then(result => {
                if (result.success && result.rewarded && result.reward) {
                    const logMsg = `💬 ${message.author.username}: +${result.reward.xp} XP, +${result.reward.coins} coins`;

                    if (result.dropResult?.hasDrops) {
                        console.log(`${logMsg} 🎉 +${result.dropResult.drops.length} drop(s)`);
                        if (result.dropResult.drops.length > 0 && message.channel) {
                            sendDropNotification(
                                message.author.id,
                                message.author.username,
                                result.dropResult.drops,
                                message.channel
                            ).catch(() => {});
                        }
                    } else {
                        console.log(logMsg);
                    }
                }
            })
            .catch(error => {
                if (error.message?.includes('channel_not_counted')) return;
                console.error('❌ Message processing error:', error.message);
            });
    });

    // Staff Reactions Event
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (user.bot || !messageProcessor) return;
        try {
            if (reaction.partial) {
                await reaction.fetch().catch(() => { return; });
            }
            await messageProcessor.processStaffReaction(reaction, user);
        } catch (error) {
            // تجاهل معظم الأخطاء
        }
    });

    // Guild Join Event
    client.on(Events.GuildCreate, async (guild) => {
        if (messageProcessor) {
            messageProcessor.setupStaffMembers(guild).catch(() => {});
        }
    });

    console.log('✅ Chat XP System is running!');
    console.log('='.repeat(40));
}

// ========== EXPORTS ==========
module.exports = {
    setupChatXPTracking,
    getMessageProcessor: () => messageProcessor,
    getUserProgress: (userId) => {
        if (messageProcessor) return messageProcessor.getUserProgress(userId);
        return null;
    },
    calculateRandomXP: () => {
        const random = Math.random() * 100;
        if (random < 30) return 3;
        if (random < 55) return 4;
        if (random < 75) return 5;
        if (random < 90) return 6;
        if (random < 98) return 7;
        return 8;
    },
    calculateRandomCoins: () => Math.random() < 0.7 ? 2 : 3,
    calculateLevel: (xp) => levelSystem.calculateLevel(xp),
    initializeDropSystem,
    processMessageForDrops,
    sendDropNotification
};