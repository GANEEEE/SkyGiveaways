const dbManager = require('../Data/database');

class SimpleLevelSystem {
    constructor() {
        this.DAILY_LIMITS = {
            MAX_XP: 500,
            MAX_COINS: 750
        };

        // ========== نظام المستويات القديم (معلق) ==========
        /*
        this.levels = [
            { level: 0,  xp: 0,      roleId: null },
            { level: 1,  xp: 250,    roleId: "1453692596785254480" },
            { level: 2,  xp: 750,    roleId: "1465705382658838724" },
            { level: 3,  xp: 1500,   roleId: "1465705413117739018" },
            { level: 4,  xp: 2500,   roleId: "1465705447666225383" },
            { level: 5,  xp: 5000,   roleId: "1465705479123636415" },
            { level: 6,  xp: 10000,  roleId: "1465705518210224168" },
            { level: 7,  xp: 20000,  roleId: "1465705556395163851" },
            { level: 8,  xp: 35000,  roleId: "1465705620689649841" },
            { level: 9,  xp: 55000,  roleId: "1465705698989179030" },
            { level: 10, xp: 80000,  roleId: "1465705733659164915" },
            { level: 11, xp: 110000, roleId: "1465705763069493423" },
            { level: 12, xp: 145000, roleId: "1465705800755445938" },
            { level: 13, xp: 185000, roleId: "1465705829272518894" },
            { level: 14, xp: 230000, roleId: "1465705879004381382" },
            { level: 15, xp: 280000, roleId: "1465785463984886045" }
        ];

        this.milestoneKeepRoles = {
            5:  [1],
            10: [1, 5],
            15: [1, 5, 10]
        };
        */

        // ========== نظام الـ Tiers الجديد (5 مستويات) ==========
        this.tiers = [
            { tier: 1, xpRequired: 1500,  roleId: null },   // Tier 1 = Level 3 XP
            { tier: 2, xpRequired: 10000, roleId: null },   // Tier 2 = Level 6 XP
            { tier: 3, xpRequired: 55000, roleId: null },   // Tier 3 = Level 9 XP
            { tier: 4, xpRequired: 145000, roleId: null },  // Tier 4 = Level 12 XP
            { tier: 5, xpRequired: 280000, roleId: null }   // Tier 5 = Level 15 XP
        ];

        this.notificationChannelId = '1385514822132830299';
    }

    // ========== Daily Reset ==========
    async checkAndResetDailyLimits(userId = null) {
        try {
            let query;
            let params = [];

            if (userId) {
                query = `
                    UPDATE levels 
                    SET xp_earned_today = 0,
                        coins_earned_today = 0,
                        last_daily_earned = CURRENT_TIMESTAMP
                    WHERE user_id = $1 
                    AND (
                        DATE(last_daily_earned) < DATE(CURRENT_TIMESTAMP)
                        OR last_daily_earned IS NULL
                    )
                `;
                params = [userId];
            } else {
                query = `
                    UPDATE levels 
                    SET xp_earned_today = 0,
                        coins_earned_today = 0,
                        last_daily_earned = CURRENT_TIMESTAMP
                    WHERE DATE(last_daily_earned) < DATE(CURRENT_TIMESTAMP)
                    OR last_daily_earned IS NULL
                `;
            }

            const result = await dbManager.run(query, params);
            return { success: true, resetCount: result.changes };

        } catch (error) {
            console.error('❌ Error in checkAndResetDailyLimits:', error);
            return { success: false, error: error.message, resetCount: 0 };
        }
    }

    async ensureDailyReset(userId) {
        try {
            const user = await this.getUserFromDB(userId);
            if (!user) return false;

            if (!user.last_daily_earned) {
                await dbManager.run(
                    'UPDATE levels SET last_daily_earned = CURRENT_TIMESTAMP WHERE user_id = ?',
                    [userId]
                );
                return true;
            }

            const lastReset = new Date(user.last_daily_earned);
            const now = new Date();
            const diffHours = (now - lastReset) / (1000 * 60 * 60);

            if (diffHours >= 24) {
                await dbManager.run(
                    `UPDATE levels 
                     SET xp_earned_today = 0,
                         coins_earned_today = 0,
                         last_daily_earned = CURRENT_TIMESTAMP
                     WHERE user_id = ?`,
                    [userId]
                );
                return true;
            }

            return false;
        } catch (error) {
            console.error('❌ Error in ensureDailyReset:', error);
            return false;
        }
    }

    async getUserFromDB(userId) {
        try {
            return await dbManager.get('SELECT * FROM levels WHERE user_id = ?', [userId]);
        } catch (error) {
            console.error('❌ Error getting user from DB:', error);
            return null;
        }
    }

    // ========== حساب الـ Tier بناءً على XP ==========
    calculateTier(xp) {
        for (let i = this.tiers.length - 1; i >= 0; i--) {
            if (xp >= this.tiers[i].xpRequired) {
                return this.tiers[i].tier;
            }
        }
        return 0; // Tier 0 = مبتدئ
    }

    // ========== جلب معلومات الـ Tier التالي ==========
    getNextTierInfo(currentTier, currentXP) {
        if (currentTier >= 5) {
            return { tier: 5, xpNeeded: 0, xpProgress: 100 };
        }

        const nextTier = this.tiers.find(t => t.tier === currentTier + 1);
        if (!nextTier) {
            return { tier: currentTier, xpNeeded: 0, xpProgress: 100 };
        }

        const previousXP = currentTier > 0 ? this.tiers[currentTier - 1]?.xpRequired || 0 : 0;
        const xpNeeded = nextTier.xpRequired - currentXP;
        const totalNeeded = nextTier.xpRequired - previousXP;
        const xpProgress = ((currentXP - previousXP) / totalNeeded) * 100;

        return {
            tier: nextTier.tier,
            xpNeeded: Math.max(0, xpNeeded),
            xpProgress: Math.min(100, Math.max(0, xpProgress)),
            roleId: nextTier.roleId
        };
    }

    // ========== معالجة الـ Tier Up ==========
    async handleTierUp(userId, username, oldTier, newTier, client, guild) {
        try {
            const newTierData = this.tiers.find(t => t.tier === newTier);

            // 1. إضافة رول الـ Tier الجديد (ولو موجود)
            if (newTierData?.roleId) {
                await this.addRoleToUser(guild, userId, newTierData.roleId);
                console.log(`🎖️ Added Tier ${newTier} role to ${username}`);
            }

            // ⭐ ملاحظة: مش بنشيل الرولات القديمة عشان انت عايز يفضل معاه كل الـ Tiers

            // 2. إشعار Tier Up
            if (client) {
                await this.sendTierUpNotification(client, userId, username, oldTier, newTier);
            }

            return true;
        } catch (error) {
            console.error(`❌ Error in handleTierUp:`, error);
            return false;
        }
    }

    // ========== إشعار الـ Tier Up ==========
    async sendTierUpNotification(client, userId, username, oldTier, newTier) {
        try {
            const channel = await client.channels.fetch(this.notificationChannelId).catch(() => null);
            if (!channel) {
                console.log(`⚠️ Notification channel not found: ${this.notificationChannelId}`);
                return false;
            }

            const isFirstTierUp = oldTier === 0 && newTier === 1;

            let description;
            if (isFirstTierUp) {
                description =
                    `## <:Stars:1416171237390028951> Congratulations ${username}!\n` +
                    `### You reached **Tier ${newTier}** 🎉\n` +
                    `-# Welcome To The Journey`;
            } else {
                description =
                    `## <:Stars:1416171237390028951> Congratulations ${username}!\n` +
                    `### You advanced to **Tier ${newTier}** ⭐\n` +
                    `-# You're doing great, keep going!`;
            }

            await channel.send({
                content: `<@${userId}>`,
                embeds: [{
                    color: 0x0073ff,
                    description: description
                }]
            });

            console.log(`📢 Sent Tier up notification for ${username} (Tier${oldTier}→Tier${newTier})`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send tier up notification:', error.message);
            return false;
        }
    }

    // ========== المعالجة الرئيسية للمكافآت ==========
    async processUserRewards(userId, username, xpToAdd = 0, coinsToAdd = 0, crystalsToAdd = 0, client = null, guild = null, pointType = null, skipDailyLimits = false) {
        try {
            await this.ensureDailyReset(userId);
            await this.ensureUserExists(userId, username);

            const user = await this.getUserFromDB(userId);

            let actualXP    = xpToAdd;
            let actualCoins = coinsToAdd;
            let xpMultiplier    = 1.0;
            let coinsMultiplier = 1.0;

            if (!skipDailyLimits) {
                const xpEarnedToday    = user?.xp_earned_today    || 0;
                const coinsEarnedToday = user?.coins_earned_today || 0;

                const activeBuffs = await dbManager.getUserActiveBuffs(userId);

                for (const buff of activeBuffs) {
                    if (buff.buff_type === 'daily_limit_boost') {
                        xpMultiplier = Math.max(xpMultiplier, buff.multiplier || 1.0);

                        if (buff.source_crate_type && buff.source_crate_type.includes('coins_')) {
                            try {
                                const coinsPart = buff.source_crate_type.split('coins_')[1];
                                if (coinsPart) {
                                    const coinsMult = parseFloat(coinsPart);
                                    if (!isNaN(coinsMult)) {
                                        coinsMultiplier = Math.max(coinsMultiplier, coinsMult);
                                    }
                                }
                            } catch (error) {
                                console.log(`⚠️ Could not parse coins multiplier`);
                            }
                        }
                    }
                }

                const effectiveMaxXP    = Math.floor(this.DAILY_LIMITS.MAX_XP    * xpMultiplier);
                const effectiveMaxCoins = Math.floor(this.DAILY_LIMITS.MAX_COINS * coinsMultiplier);

                actualXP    = Math.min(xpToAdd,    Math.max(0, effectiveMaxXP    - xpEarnedToday));
                actualCoins = Math.min(coinsToAdd, Math.max(0, effectiveMaxCoins - coinsEarnedToday));

                if (actualXP <= 0 && actualCoins <= 0) {
                    return {
                        success: false,
                        reason: 'Daily limit reached',
                        limits: {
                            xpEarnedToday,
                            coinsEarnedToday,
                            maxXP: effectiveMaxXP,
                            maxCoins: effectiveMaxCoins,
                            multipliers: { xp: xpMultiplier, coins: coinsMultiplier }
                        }
                    };
                }
            }

            let chatPointsToAdd     = 0;
            let voicePointsToAdd    = 0;
            let reactionPointsToAdd = 0;

            if (pointType === 'chat')     chatPointsToAdd     = actualXP;
            if (pointType === 'voice')    voicePointsToAdd    = actualXP;
            if (pointType === 'reaction') reactionPointsToAdd = actualXP;

            // حساب الـ Tier القديم والجديد
            const oldXP = user?.xp || 0;
            const newXP = oldXP + actualXP;
            const oldTier = this.calculateTier(oldXP);
            const newTier = this.calculateTier(newXP);
            const tierUp = newTier > oldTier;

            if (!skipDailyLimits) {
                await dbManager.run(
                    `UPDATE levels 
                     SET xp = xp + ?,
                         sky_coins = sky_coins + ?,
                         sky_crystals = sky_crystals + ?,
                         xp_earned_today = xp_earned_today + ?,
                         coins_earned_today = coins_earned_today + ?,
                         chat_points = COALESCE(chat_points, 0) + ?,
                         voice_points = COALESCE(voice_points, 0) + ?,
                         reaction_points = COALESCE(reaction_points, 0) + ?,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = ?`,
                    [actualXP, actualCoins, crystalsToAdd, actualXP, actualCoins,
                     chatPointsToAdd, voicePointsToAdd, reactionPointsToAdd, userId]
                );
            } else {
                await dbManager.run(
                    `UPDATE levels 
                     SET xp = xp + ?,
                         sky_coins = sky_coins + ?,
                         sky_crystals = sky_crystals + ?,
                         chat_points = COALESCE(chat_points, 0) + ?,
                         voice_points = COALESCE(voice_points, 0) + ?,
                         reaction_points = COALESCE(reaction_points, 0) + ?,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = ?`,
                    [actualXP, actualCoins, crystalsToAdd,
                     chatPointsToAdd, voicePointsToAdd, reactionPointsToAdd, userId]
                );
            }

            // معالجة الـ Tier Up
            if (tierUp && guild) {
                for (let t = oldTier + 1; t <= newTier; t++) {
                    await this.handleTierUp(userId, username, t - 1, t, client, guild);
                }
            }

            return {
                success: true,
                xp: actualXP,
                coins: actualCoins,
                crystals: crystalsToAdd,
                tierUp,
                oldTier,
                newTier,
                pointsAdded: { chat: chatPointsToAdd, voice: voicePointsToAdd, reaction: reactionPointsToAdd },
                multipliers: { xp: xpMultiplier, coins: coinsMultiplier },
                dailyLimitsInfo: skipDailyLimits ? null : {
                    xpEarnedToday:    (user?.xp_earned_today    || 0) + actualXP,
                    coinsEarnedToday: (user?.coins_earned_today || 0) + actualCoins,
                    maxXP:    this.DAILY_LIMITS.MAX_XP    * xpMultiplier,
                    maxCoins: this.DAILY_LIMITS.MAX_COINS * coinsMultiplier
                }
            };

        } catch (error) {
            console.error(`❌ Level system error for ${username}:`, error);
            return { success: false, error: error.message };
        }
    }

    // ========== باقي الدوال المساعدة ==========
    async ensureUserExists(userId, username) {
        try {
            const user = await this.getUserFromDB(userId);

            if (!user) {
                await dbManager.run(
                    `INSERT INTO levels (user_id, username, level, xp, sky_coins, sky_crystals) 
                     VALUES (?, ?, 0, 0, 0, 0)`,
                    [userId, username]
                );
                console.log(`👤 Created new user: ${username} (${userId})`);
                return { created: true };
            }

            if (user.username !== username) {
                await dbManager.run(
                    'UPDATE levels SET username = ? WHERE user_id = ?',
                    [username, userId]
                );
            }

            return { created: false, user };
        } catch (error) {
            console.error('❌ Failed to ensure user exists:', error);
            return { created: false, error: error.message };
        }
    }

    async addRoleToUser(guild, userId, roleId) {
        try {
            if (!roleId) return true;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return false;

            const role = await guild.roles.fetch(roleId).catch(() => null);
            if (!role) return false;

            await member.roles.add(role);
            console.log(`✅ Added role ${role.name} to ${member.user.tag}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to add role to ${userId}:`, error.message);
            return false;
        }
    }

    async getUserInfo(userId, guild = null) {
        const user = await this.getUserFromDB(userId);
        if (!user) return null;

        const currentXP = user.xp || 0;
        const currentTier = this.calculateTier(currentXP);
        const nextTier = this.getNextTierInfo(currentTier, currentXP);

        let currentRole = null;
        if (guild && currentTier > 0) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                const tierData = this.tiers.find(t => t.tier === currentTier);
                if (tierData?.roleId && member.roles.cache.has(tierData.roleId)) {
                    const role = await guild.roles.fetch(tierData.roleId);
                    currentRole = role ? { id: role.id, name: role.name } : null;
                }
            }
        }

        const remainingXP    = Math.max(0, this.DAILY_LIMITS.MAX_XP    - (user.xp_earned_today    || 0));
        const remainingCoins = Math.max(0, this.DAILY_LIMITS.MAX_COINS - (user.coins_earned_today || 0));

        return {
            tier: currentTier,
            xp: currentXP,
            coins: user.sky_coins || 0,
            crystals: user.sky_crystals || 0,
            currentRole,
            nextTier,
            dailyLimits: {
                earnedToday: {
                    xp:    user.xp_earned_today    || 0,
                    coins: user.coins_earned_today || 0
                },
                remaining: { xp: remainingXP, coins: remainingCoins },
                max: { xp: this.DAILY_LIMITS.MAX_XP, coins: this.DAILY_LIMITS.MAX_COINS },
                lastReset: user.last_daily_earned || null
            }
        };
    }

    getAllTiersInfo() {
        return this.tiers.map(tier => ({
            tier: tier.tier,
            xpRequired: tier.xpRequired,
            roleId: tier.roleId
        }));
    }

    async getEffectiveDailyLimits(userId) {
        try {
            const baseLimits  = this.DAILY_LIMITS;
            const activeBuffs = await dbManager.getUserActiveBuffs(userId);

            let xpMultiplier    = 1.0;
            let coinsMultiplier = 1.0;

            for (const buff of activeBuffs) {
                if (buff.buff_type === 'daily_limit_boost' && buff.multiplier) {
                    xpMultiplier = Math.max(xpMultiplier, buff.multiplier);
                }
                if (buff.buff_type === 'coins_limit_boost' && buff.multiplier) {
                    coinsMultiplier = Math.max(coinsMultiplier, buff.multiplier);
                }
            }

            return {
                MAX_XP:    Math.floor(baseLimits.MAX_XP    * xpMultiplier),
                MAX_COINS: Math.floor(baseLimits.MAX_COINS * coinsMultiplier),
                multipliers: { xp: xpMultiplier, coins: coinsMultiplier },
                baseLimits,
                hasBoosts: xpMultiplier > 1.0 || coinsMultiplier > 1.0
            };
        } catch (error) {
            console.error('❌ Error getting effective limits:', error);
            return this.DAILY_LIMITS;
        }
    }

    getCurrentDailyLimits() {
        return { ...this.DAILY_LIMITS };
    }

    // ========== دالة لتحديد رول لكل Tier ==========
    setTierRole(tier, roleId) {
        const tierData = this.tiers.find(t => t.tier === tier);
        if (tierData) {
            tierData.roleId = roleId;
            return true;
        }
        return false;
    }
}

const levelSystem = new SimpleLevelSystem();
module.exports = levelSystem;