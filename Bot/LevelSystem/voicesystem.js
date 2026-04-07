const { Events } = require('discord.js');
const dbManager = require('../Data/database');
const buffSystem = require('../LevelSystem/globalbuffs');
const levelSystem = require('../LevelSystem/levelsystem');

// متغيرات النظام
const voiceUsers = new Map();
let globalInterval = null;
let clientReference = null;
let cleanupInterval = null;

// ========== CONFIGURATION ==========
const CONFIG = {
    REWARD_INTERVAL: 840000,   // 14 دقيقة
    CHECK_INTERVAL: 900000,    // 15 دقيقة
    CLEANUP_INTERVAL: 7260000, // 121 دقيقة

    VIP_CHANNEL_IDS: ['1423430294563721306', '1423430261043101777'],

    REWARDS: {
        ACTIVE: { MIN_XP: 1, MAX_XP: 2, MIN_COINS: 1, MAX_COINS: 2, CRYSTAL_CHANCE: 0.01 },
        MUTED:  { MIN_XP: 1, MAX_XP: 1, MIN_COINS: 1, MAX_COINS: 1, CRYSTAL_CHANCE: 0 },
        STREAM: { MIN_XP: 1, MAX_XP: 3, MIN_COINS: 1, MAX_COINS: 3, CRYSTAL_CHANCE: 0.02 },
        VIP_BONUSES: {
            XP_MULTIPLIER: 1.1,
            COINS_MULTIPLIER: 1.5,
            CRYSTAL_CHANCE: 0.1,
            STREAM_BONUS_MULTIPLIER: 1.2
        }
    },

    MIN_USERS_FOR_REWARDS: 3
};

const UserType = {
    ACTIVE: 'active',
    MUTED: 'muted',
    STREAM: 'stream'
};

const dailyLimitUsers = new Set();

// ========== CHANNEL USER COUNT ==========
// ✅ بيستخدم cache فقط — مفيش API calls
function getRealUsersInChannel(channelId, guildId) {
    if (!clientReference) return 0;
    try {
        const guild = clientReference.guilds.cache.get(guildId);
        if (!guild) return 0;
        const channel = guild.channels.cache.get(channelId);
        if (!channel || !channel.isVoiceBased()) return 0;

        let realUsers = 0;
        for (const member of channel.members.values()) {
            if (!member.user.bot) realUsers++;
        }
        return realUsers;
    } catch (error) {
        console.error('Error counting users in channel:', error.message);
        return 0;
    }
}

// ========== VOICE REWARDS CALCULATION ==========
function calculateVoiceReward(userType, isVIP = false) {
    const rewardsRange = CONFIG.REWARDS[userType.toUpperCase()] || CONFIG.REWARDS.ACTIVE;

    let baseXP    = Math.floor(Math.random() * (rewardsRange.MAX_XP    - rewardsRange.MIN_XP    + 1)) + rewardsRange.MIN_XP;
    let baseCoins = Math.floor(Math.random() * (rewardsRange.MAX_COINS - rewardsRange.MIN_COINS + 1)) + rewardsRange.MIN_COINS;
    let crystalChance = rewardsRange.CRYSTAL_CHANCE;

    if (isVIP) {
        baseXP    = Math.floor(baseXP    * CONFIG.REWARDS.VIP_BONUSES.XP_MULTIPLIER);
        baseCoins = Math.floor(baseCoins * CONFIG.REWARDS.VIP_BONUSES.COINS_MULTIPLIER);
        if (userType === UserType.STREAM) {
            baseXP    = Math.floor(baseXP    * CONFIG.REWARDS.VIP_BONUSES.STREAM_BONUS_MULTIPLIER);
            baseCoins = Math.floor(baseCoins * CONFIG.REWARDS.VIP_BONUSES.STREAM_BONUS_MULTIPLIER);
        }
        crystalChance = CONFIG.REWARDS.VIP_BONUSES.CRYSTAL_CHANCE;
    }

    const crystals = Math.random() * 100 < crystalChance ? 1 : 0;
    return { xp: baseXP, coins: baseCoins, crystals };
}

// ========== USER TRACKING ==========
function determineUserType(voiceState) {
    if (voiceState.streaming) return UserType.STREAM;
    if (voiceState.mute || voiceState.selfMute || voiceState.deaf || voiceState.selfDeaf) return UserType.MUTED;
    return UserType.ACTIVE;
}

function isVIPChannel(channelId) {
    return CONFIG.VIP_CHANNEL_IDS.includes(channelId);
}

// ========== AUTO-SYNC ON RESTART ==========
// ✅ بيستخدم guild.channels.cache و channel.members — مفيش API calls
async function autoSyncVoiceUsersOnRestart(client) {
    try {
        console.log('🔄 Auto-syncing voice users after restart...');

        let syncedCount = 0, vipSynced = 0, streamSynced = 0;
        const now = Date.now();

        for (const guild of client.guilds.cache.values()) {
            for (const channel of guild.channels.cache.values()) {
                if (!channel.isVoiceBased() || !channel.members?.size) continue;

                for (const member of channel.members.values()) {
                    if (member.user.bot || !member.voice.channel) continue;
                    if (voiceUsers.has(member.id)) continue;

                    const userType = determineUserType(member.voice);
                    const isVIP    = isVIPChannel(channel.id);

                    voiceUsers.set(member.id, {
                        userId:           member.id,
                        username:         member.user.username,
                        guildId:          guild.id,
                        channelId:        channel.id,
                        userType,
                        isVIP,
                        joinTime:         now,
                        nextRewardTime:   now + CONFIG.REWARD_INTERVAL,
                        rewardsGiven:     0,
                        totalXP:          0,
                        totalCoins:       0,
                        totalCrystals:    0,
                        dailyLimitReached: false,
                        isStreaming:      userType === UserType.STREAM
                    });

                    syncedCount++;
                    if (isVIP) vipSynced++;
                    if (userType === UserType.STREAM) streamSynced++;
                }
            }
        }

        console.log(`✅ Restart sync: ${syncedCount} users added (${vipSynced} VIP, ${streamSynced} streaming)`);
        return { success: true, totalUsers: voiceUsers.size, newlySynced: syncedCount, vipSynced, streamSynced };

    } catch (error) {
        console.error('❌ Restart sync failed:', error.message);
        return { success: false, error: error.message };
    }
}

// ✅ quickVoiceCheck بيستخدم cache فقط — مفيش API calls
async function quickVoiceCheck(client) {
    let found = 0, streaming = 0;
    for (const guild of client.guilds.cache.values()) {
        for (const channel of guild.channels.cache.values()) {
            if (!channel.isVoiceBased()) continue;
            for (const member of channel.members.values()) {
                if (!member.user.bot) {
                    found++;
                    if (member.voice.streaming) streaming++;
                }
            }
        }
    }
    console.log(`🔍 Quick check: ${found} users in voice (${streaming} streaming)`);
    return { found, streaming };
}

// ========== VOICE EVENT HANDLERS ==========
async function handleVoiceJoin(userId, username, guildId, channelId, voiceState) {
    try {
        const userType  = determineUserType(voiceState);
        const isVIP     = isVIPChannel(channelId);
        const isStreaming = userType === UserType.STREAM;

        let emoji = isStreaming ? '📡' : isVIP ? '🎖️' : '🎤';
        console.log(`${emoji} ${username} joined voice (${userType})`);

        voiceUsers.set(userId, {
            userId, username, guildId, channelId,
            userType, isVIP, isStreaming,
            joinTime:         Date.now(),
            nextRewardTime:   Date.now() + CONFIG.REWARD_INTERVAL,
            rewardsGiven:     0,
            totalXP:          0,
            totalCoins:       0,
            totalCrystals:    0,
            dailyLimitReached: false
        });

        if (dailyLimitUsers.has(userId)) {
            dailyLimitUsers.delete(userId);
            console.log(`🔄 ${username} removed from daily limit list`);
        }
    } catch (error) {
        console.error('Error in handleVoiceJoin:', error.message);
    }
}

async function handleVoiceLeave(userId) {
    const userData = voiceUsers.get(userId);
    if (userData) {
        const minutes = Math.floor((Date.now() - userData.joinTime) / 60000);
        const emoji   = userData.isStreaming ? '📡' : '🎤';
        console.log(`${emoji} ${userData.username} left after ${minutes} minutes`);
        voiceUsers.delete(userId);
        dailyLimitUsers.delete(userId);
    }
}

async function handleVoiceUpdate(userId, newVoiceState) {
    const userData = voiceUsers.get(userId);
    if (!userData) return;

    const newUserType    = determineUserType(newVoiceState);
    const wasStreaming   = userData.isStreaming;
    const isNowStreaming = newUserType === UserType.STREAM;

    userData.userType    = newUserType;
    userData.isStreaming = isNowStreaming;
    voiceUsers.set(userId, userData);

    if (wasStreaming !== isNowStreaming) {
        console.log(`📡 ${userData.username} ${isNowStreaming ? 'started' : 'stopped'} streaming`);
    }
}

// ========== REWARDS DISTRIBUTION ==========
async function distributeVoiceRewards() {
    if (voiceUsers.size === 0 || !clientReference) return;

    const now = Date.now();
    let rewardsGiven = 0, dailyLimitReachedCount = 0;
    let streamRewards = 0, vipStreamRewards = 0, channelsSkipped = 0;

    // تجميع المستخدمين حسب القناة
    const usersByChannel = new Map();
    for (const [userId, userData] of voiceUsers.entries()) {
        if (!usersByChannel.has(userData.channelId)) usersByChannel.set(userData.channelId, []);
        usersByChannel.get(userData.channelId).push({ userId, userData });
    }

    for (const [channelId, usersInChannel] of usersByChannel.entries()) {
        if (!usersInChannel.length) continue;

        const realUsers = getRealUsersInChannel(channelId, usersInChannel[0].userData.guildId);
        if (realUsers < CONFIG.MIN_USERS_FOR_REWARDS) {
            channelsSkipped++;
            continue;
        }

        for (const { userId, userData } of usersInChannel) {
            if (dailyLimitUsers.has(userId) || userData.dailyLimitReached) continue;
            if (now < userData.nextRewardTime) continue;

            try {
                const guild = clientReference.guilds.cache.get(userData.guildId);
                if (!guild) continue;

                const baseReward  = calculateVoiceReward(userData.userType, userData.isVIP);
                let userBuff      = 0;
                let finalReward   = { ...baseReward };

                if (buffSystem) {
                    try {
                        userBuff = await buffSystem.getBuff(userId, guild);
                        if (userBuff > 0) finalReward = buffSystem.applyBuff(finalReward, userBuff);
                    } catch (buffError) {
                        console.error('❌ Buff system error:', buffError.message);
                    }
                }

                const levelResult = await levelSystem.processUserRewards(
                    userId, userData.username,
                    finalReward.xp, finalReward.coins, finalReward.crystals,
                    clientReference, guild, 'voice', false
                );

                if (levelResult.success) {
                    userData.nextRewardTime  = now + CONFIG.REWARD_INTERVAL;
                    userData.rewardsGiven++;
                    userData.totalXP        += finalReward.xp;
                    userData.totalCoins     += finalReward.coins;
                    userData.totalCrystals  += finalReward.crystals;
                    voiceUsers.set(userId, userData);

                    await dbManager.updateGoalProgress(userId, 'voice_minutes', 15);

                    const emoji    = userData.isStreaming ? '📡' : userData.isVIP ? '🎖️' : '🎤';
                    const buffText = userBuff > 0 ? `(+${userBuff}%)` : '';
                    console.log(`${emoji} ${userData.username}: +${finalReward.xp} XP ${buffText}, +${finalReward.coins} coins`);

                    rewardsGiven++;
                    if (userData.isStreaming) {
                        streamRewards++;
                        if (userData.isVIP) vipStreamRewards++;
                    }

                } else if (levelResult.reason === 'Daily limit reached') {
                    userData.dailyLimitReached = true;
                    dailyLimitUsers.add(userId);
                    voiceUsers.set(userId, userData);
                    console.log(`⚠️ ${userData.username} reached daily limit`);
                    dailyLimitReachedCount++;
                }

            } catch (error) {
                console.error(`❌ Error giving voice rewards to ${userData.username}:`, error.message);
            }
        }
    }

    if (rewardsGiven > 0) {
        let summary = `✅ Distributed ${rewardsGiven} voice rewards`;
        if (streamRewards > 0) summary += ` (${streamRewards} streaming${vipStreamRewards > 0 ? `, ${vipStreamRewards} VIP` : ''})`;
        console.log(summary);
    }
    if (channelsSkipped > 0)        console.log(`⏸️ Skipped ${channelsSkipped} channel(s) - less than ${CONFIG.MIN_USERS_FOR_REWARDS} users`);
    if (dailyLimitReachedCount > 0) console.log(`⏸️ ${dailyLimitReachedCount} user(s) reached daily limit`);
}

// ========== DAILY LIMIT HELPERS ==========
async function resetUserDailyLimit(userId) {
    const userData = voiceUsers.get(userId);
    if (userData) {
        userData.dailyLimitReached = false;
        voiceUsers.set(userId, userData);
    }
    if (dailyLimitUsers.has(userId)) {
        dailyLimitUsers.delete(userId);
        console.log(`🔄 ${userData?.username || userId} daily limit reset`);
    }
}

function getUserDailyLimitStatus(userId) {
    const userData = voiceUsers.get(userId);
    if (!userData) return null;
    return {
        username:         userData.username,
        dailyLimitReached: userData.dailyLimitReached || dailyLimitUsers.has(userId),
        userType:         userData.userType,
        isStreaming:      userData.isStreaming,
        isVIP:            userData.isVIP,
        rewardsGiven:     userData.rewardsGiven,
        totalXP:          userData.totalXP,
        totalCoins:       userData.totalCoins,
        totalCrystals:    userData.totalCrystals
    };
}

// ========== SYSTEM MAINTENANCE ==========
function setupVoiceCleanup(client) {
    if (cleanupInterval) clearInterval(cleanupInterval);
    cleanupInterval = setInterval(cleanupDisconnectedUsers, CONFIG.CLEANUP_INTERVAL);
    console.log('🧹 Voice cleanup system initialized');
}

// ✅ بيستخدم guild.members.cache فقط — مفيش API calls
function cleanupDisconnectedUsers() {
    if (!clientReference) return;
    let cleaned = 0, cleanedStreams = 0;

    for (const [userId, userData] of voiceUsers.entries()) {
        try {
            const guild  = clientReference.guilds.cache.get(userData.guildId);
            const member = guild?.members.cache.get(userId);

            if (!guild || !member || !member.voice.channel) {
                if (userData.isStreaming) cleanedStreams++;
                voiceUsers.delete(userId);
                dailyLimitUsers.delete(userId);
                cleaned++;
            }
        } catch {
            if (userData.isStreaming) cleanedStreams++;
            voiceUsers.delete(userId);
            dailyLimitUsers.delete(userId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} disconnected voice users${cleanedStreams > 0 ? ` (${cleanedStreams} streams)` : ''}`);
    }
}

function setupOptimizedIntervals(client) {
    if (globalInterval) clearInterval(globalInterval);
    globalInterval = setInterval(distributeVoiceRewards, CONFIG.CHECK_INTERVAL);
    console.log(`⏱️ Reward interval set (${CONFIG.CHECK_INTERVAL / 1000}s)`);
}

// ========== MAIN SETUP ==========
function setupVoiceSystem(client) {
    console.log('🚀 Starting Voice XP System...');
    console.log('='.repeat(40));

    clientReference = client;
    voiceUsers.clear();
    dailyLimitUsers.clear();

    setupVoiceCleanup(client);

    // ✅ FIX: sync واحد بس بعد 5 ثواني — بدل 3 syncs في 35 ثانية
    setTimeout(async () => {
        try {
            const result = await autoSyncVoiceUsersOnRestart(client);
            if (result.success && result.newlySynced > 0) {
                console.log(`🎉 Found ${result.newlySynced} users already in voice`);
            }
        } catch (error) {
            console.error('Sync error:', error.message);
        }

        setupOptimizedIntervals(client);
        console.log('✅ Voice system ready');
    }, 5000);

    // Voice State Events
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (newState.member?.user?.bot) return;

        const userId   = newState.id;
        const username = newState.member?.user?.username || 'Unknown';
        const guildId  = newState.guild.id;

        if (!oldState.channelId && newState.channelId) {
            // دخل قناة
            await handleVoiceJoin(userId, username, guildId, newState.channelId, newState);
        } else if (oldState.channelId && !newState.channelId) {
            // خرج من قناة
            await handleVoiceLeave(userId);
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            // انتقل لقناة تانية
            await handleVoiceLeave(userId);
            await handleVoiceJoin(userId, username, guildId, newState.channelId, newState);
        } else if (oldState.channelId === newState.channelId) {
            // تغيير حالة في نفس القناة (mute/stream/etc)
            await handleVoiceUpdate(userId, newState);
        }
    });

    console.log('✅ System initialization complete!');
    console.log('='.repeat(40));
}

// ========== STATS ==========
function getVoiceSystemStats() {
    const users = Array.from(voiceUsers.values());
    const totalXP     = users.reduce((s, u) => s + u.totalXP,     0);
    const totalCoins  = users.reduce((s, u) => s + u.totalCoins,  0);
    const totalCrystals = users.reduce((s, u) => s + u.totalCrystals, 0);

    return {
        totalUsers:       users.length,
        activeUsers:      users.filter(u => u.userType === UserType.ACTIVE).length,
        mutedUsers:       users.filter(u => u.userType === UserType.MUTED).length,
        streamingUsers:   users.filter(u => u.userType === UserType.STREAM).length,
        vipUsers:         users.filter(u => u.isVIP).length,
        dailyLimitReached: users.filter(u => u.dailyLimitReached).length,
        rewardsGiven:     users.reduce((s, u) => s + u.rewardsGiven, 0),
        totalXP, totalCoins, totalCrystals,
        rewardRanges:     { active: CONFIG.REWARDS.ACTIVE, muted: CONFIG.REWARDS.MUTED, stream: CONFIG.REWARDS.STREAM, vipBonuses: CONFIG.REWARDS.VIP_BONUSES },
        minUsersRequired: CONFIG.MIN_USERS_FOR_REWARDS
    };
}

function getUserVoiceStats(userId) {
    const userData = voiceUsers.get(userId);
    if (!userData) return null;

    const rewardRange = CONFIG.REWARDS[userData.userType.toUpperCase()] || CONFIG.REWARDS.ACTIVE;

    return {
        username:         userData.username,
        channelId:        userData.channelId,
        userType:         userData.userType,
        isVIP:            userData.isVIP,
        isStreaming:      userData.isStreaming,
        dailyLimitReached: userData.dailyLimitReached,
        minutesInVoice:   Math.floor((Date.now() - userData.joinTime) / 60000),
        rewardsGiven:     userData.rewardsGiven,
        totalXP:          userData.totalXP,
        totalCoins:       userData.totalCoins,
        totalCrystals:    userData.totalCrystals,
        nextRewardIn:     Math.max(0, userData.nextRewardTime - Date.now()),
        rewardRange,
        usersInChannel:   getRealUsersInChannel(userData.channelId, userData.guildId),
        minUsersRequired: CONFIG.MIN_USERS_FOR_REWARDS,
        eligibleForRewards: getRealUsersInChannel(userData.channelId, userData.guildId) >= CONFIG.MIN_USERS_FOR_REWARDS
    };
}

// ========== ADMIN FUNCTIONS ==========
function addVIPChannel(channelId, channelName = 'VIP Channel') {
    if (CONFIG.VIP_CHANNEL_IDS.includes(channelId)) return false;
    CONFIG.VIP_CHANNEL_IDS.push(channelId);
    for (const [userId, userData] of voiceUsers.entries()) {
        if (userData.channelId === channelId) { userData.isVIP = true; voiceUsers.set(userId, userData); }
    }
    console.log(`🎖️ Added VIP channel: ${channelName} (${channelId})`);
    return true;
}

function removeVIPChannel(channelId) {
    const index = CONFIG.VIP_CHANNEL_IDS.indexOf(channelId);
    if (index === -1) return false;
    CONFIG.VIP_CHANNEL_IDS.splice(index, 1);
    for (const [userId, userData] of voiceUsers.entries()) {
        if (userData.channelId === channelId) { userData.isVIP = false; voiceUsers.set(userId, userData); }
    }
    console.log(`🗑️ Removed VIP channel: ${channelId}`);
    return true;
}

function stopVoiceSystem() {
    if (globalInterval)  { clearInterval(globalInterval);  globalInterval  = null; }
    if (cleanupInterval) { clearInterval(cleanupInterval); cleanupInterval = null; }
    voiceUsers.clear();
    dailyLimitUsers.clear();
    clientReference = null;
    console.log('⏹️ Voice System stopped');
}

function setupVoiceXPTracking(client) {
    console.log('🎧 [Compatibility] Starting Voice XP System...');
    return setupVoiceSystem(client);
}

// ========== EXPORTS ==========
module.exports = {
    setupVoiceSystem,
    setupVoiceXPTracking,
    stopVoiceSystem,

    getVoiceSystemStats,
    getUserVoiceStats,
    voiceUsers,

    addVIPChannel,
    removeVIPChannel,
    getVIPChannels: () => CONFIG.VIP_CHANNEL_IDS,

    distributeVoiceRewards,
    cleanupDisconnectedUsers,
    autoSyncVoiceUsersOnRestart,

    handleVoiceJoin,
    handleVoiceLeave,
    handleVoiceUpdate,
    quickVoiceCheck,
    setupVoiceCleanup,
    setupOptimizedIntervals,

    resetUserDailyLimit,
    getUserDailyLimitStatus,
    getDailyLimitUsers: () => Array.from(dailyLimitUsers),

    CONFIG,
    UserType,
    getRewardRanges: () => CONFIG.REWARDS
};