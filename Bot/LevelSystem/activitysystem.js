// =============================================
// activitysystem.js (PostgreSQL Version) - COMPLETE
// =============================================

const { ContainerBuilder, MessageFlags } = require('discord.js');

const PARTNER_NOTIFICATION_CHANNEL = '1385514822132830299';

// ===== Guild Bonus Config =====
const GUILD_BONUS = {
    sky_vanguards: {
        pct: 5,
        activities: [
            'msg_50', 'msg_500',
            'goals_daily',
            'helper',
            'interaction',
            'bug_skybots',
        ]
    },
    aether_raiders: {
        pct: 8,
        activities: [
            'achievements',
            'wishlist',
            'finish_game',
            'steam_achievement',
            'review',
            'bug_publisher',
            'steamachievements_weekly', 
        ]
    }
};

// ===== Streak Milestones =====
const STREAK_MILESTONES = {
    7:  90,
    14: 160
};

const SV_STREAK_BONUS = {
    7:  50,
    14: 100
};

const ACTIVITIES = {
    // ===== Daily =====
    msg_50: { column: 'msg_50_claimed', reward: 15, max: 3, type: 'daily', label: '📨 50 Messages (Daily)' },
    goals_daily: { column: 'goals_daily_claimed', reward: 15, max: 1, type: 'daily', label: '✅ Daily Quest', hasStreak: true },
    interaction: { column: 'interaction_claimed', reward: 10, max: 1, type: 'daily', label: '❤️ Interaction (Like+RT)' },
    tweet_reddit_post: { column: 'tweet_reddit_post_claimed', reward: 15, max: 2, type: 'daily', label: '📢 Tweet / Reddit Post' },
    bug_publisher: { column: 'bug_publisher_claimed', reward: 15, max: 3, type: 'daily', label: '🐞 Bug Report (Publisher)' },
    bug_skybots: { column: 'bug_skybots_claimed', reward: 15, max: 3, type: 'daily', label: '🤖 Bug Report (Sky Bots)' },
    helper: { column: 'helper_claimed', reward: 25, max: 2, type: 'daily', label: '🛡️ Helper' }, // <-- تمت إزالة guildOnly
    steam_achievement: { column: 'steam_achievement_claimed', reward: 10, max: -1, type: 'daily', label: '🏆 Steam Achievement' }, // <-- تمت إزالة guildOnly

    // ===== Weekly =====
    msg_500: { column: 'msg_500_claimed', reward: 250, max: 3, type: 'weekly', label: '📨 500 Messages (Weekly)' },
    steamachievements_weekly: { column: 'steamachievements_weekly_claimed', reward: 50, max: 1, type: 'weekly', label: '🎮 20 Steam Achievements (Weekly)' },

    // ===== One-Time =====
    steam_linked: { column: 'steam_linked', reward: 250, max: 1, type: 'boolean', label: '🔗 Steam Linked' },
    follow_twitter: { column: 'follow_twitter', reward: 50, max: 1, type: 'boolean', label: '🐦 Follow Twitter' },
    follow_reddit: { column: 'follow_reddit', reward: 50, max: 1, type: 'boolean', label: '📱 Follow Reddit' },
    follow_steam: { column: 'follow_steam', reward: 50, max: 1, type: 'boolean', label: '🎮 Follow Steam' },
    invite: { column: 'invite_claimed', reward: 5, max: 40, type: 'integer', label: '🤝 Verified Invite' },
    achievements: { column: 'achievements_claimed', reward: 200, max: 5, type: 'integer', label: '🏅 100% Achievements' }, // <-- تمت إزالة guildOnly
    boosted_server: { column: 'boosted_server', reward: 450, max: 1, type: 'boolean', label: '🚀 Boosted The Server' },
    finish_game: { column: 'finish_game_claimed', reward: 250, max: 3, type: 'integer', label: '🎮 Finish Gamersky Achievements' }, // <-- تمت إزالة guildOnly
    wishlist: { column: 'wishlist_claimed', reward: 50, max: 1, type: 'boolean', label: '⭐ Wishlist a Game' },
    review: { column: 'review_claimed', reward: 70, max: 1, type: 'boolean', label: '📝 Game Review' },
    suggestion: { column: 'suggestion_claimed', reward: 35, max: 1, type: 'boolean', label: '💡 Suggestion' },
    community_giveaways: { column: 'community_giveaways_claimed', reward: 250, max: 3, type: 'integer', label: '🎁 Community Giveaways' },
    letter_hunt: { column: 'letter_hunt', reward: 500, max: -1, type: 'letter_hunt', label: '🔍 Letter Hunt' },
};

const DUO_BONUS_ACTIVITIES = [
    'goals_daily', 'msg_50', 'msg_500', 'letter_hunt', 'steamachievements_weekly',
    'community_giveaways', 'finish_game', 'achievements', 'invite',
    'tweet_reddit_post', 'bug_publisher', 'bug_skybots', 'steam_achievement'
];

// ===== Egypt Timezone Helpers =====
function getEgyptMidnightDelay() {
    const now      = new Date();
    const egyptNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const next     = new Date(egyptNow);
    next.setHours(24, 0, 0, 0);
    return next.getTime() - egyptNow.getTime();
}

function getEgyptNextMondayDelay() {
    const now      = new Date();
    const egyptNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const day      = egyptNow.getDay();
    const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7;
    const next     = new Date(egyptNow);
    next.setDate(egyptNow.getDate() + daysUntilMonday);
    next.setHours(0, 0, 0, 0);
    return next.getTime() - egyptNow.getTime();
}

// =============================================
class ActivityRewardsManager {
    constructor(dbManager) {
        this.db = dbManager;
    }

    getActivities()          { return ACTIVITIES; }
    getDuoBonusActivities()  { return DUO_BONUS_ACTIVITIES; }
    getGuildBonus()          { return GUILD_BONUS; }
    getStreakMilestones()    { return STREAK_MILESTONES; }
    getSVStreakBonus()       { return SV_STREAK_BONUS; }
    getNotificationChannel() { return PARTNER_NOTIFICATION_CHANNEL; }

    // ===== User Management =====
    async getUser(userId) {
        try {
            return await this.db.get('SELECT * FROM activity_rewards WHERE user_id = $1', [userId]);
        } catch (err) {
            console.error('❌ getUser:', err.message);
            return null;
        }
    }

    async createUser(userId, username, guild) {
        try {
            await this.db.run(
                `INSERT INTO activity_rewards (user_id, username, guild, total_sky_tokens)
                 VALUES ($1, $2, $3, 0) ON CONFLICT (user_id) DO NOTHING`,
                [userId, username, guild]
            );
            return await this.getUser(userId);
        } catch (err) {
            console.error('❌ createUser:', err.message);
            return null;
        }
    }

    // ===== Forum Post ID =====
    async setForumPostId(userId, forumPostId) {
        try {
            await this.db.run(
                `UPDATE activity_rewards SET forum_post_id = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
                [forumPostId, userId]
            );
            return true;
        } catch (err) {
            console.error('❌ setForumPostId:', err.message);
            return false;
        }
    }

    async getForumPostId(userId) {
        try {
            const user = await this.getUser(userId);
            return user?.forum_post_id || null;
        } catch (err) {
            console.error('❌ getForumPostId:', err.message);
            return null;
        }
    }

    // ===== Partner Requests =====
    async createPartnerRequest(requesterId, requesterName, targetId, targetName, guild) {
        try {
            const result = await this.db.run(
                `INSERT INTO partner_requests (requester_id, requester_name, target_id, target_name, guild)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [requesterId, requesterName, targetId, targetName, guild]
            );
            return result.id;
        } catch (err) {
            console.error('❌ createPartnerRequest:', err.message);
            return null;
        }
    }

    async updatePartnerRequestStatus(requestId, status) {
        try {
            await this.db.run(
                `UPDATE partner_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [status, requestId]
            );
            return true;
        } catch (err) {
            console.error('❌ updatePartnerRequestStatus:', err.message);
            return false;
        }
    }

    async getPendingPartnerRequest(targetId) {
        try {
            return await this.db.get(
                `SELECT * FROM partner_requests WHERE target_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
                [targetId]
            );
        } catch (err) {
            console.error('❌ getPendingPartnerRequest:', err.message);
            return null;
        }
    }

    async getPartnerRequestById(requestId) {
        try {
            return await this.db.get(
                `SELECT * FROM partner_requests WHERE id = $1`,
                [requestId]
            );
        } catch (err) {
            console.error('❌ getPartnerRequestById:', err.message);
            return null;
        }
    }

    // ===== Update Forum Post (requires guild) =====
    async updateUserForumPost(guild, userId) {
        try {
            const user = await this.getUser(userId);
            if (!user || !user.forum_post_id) return false;

            const forumChannelId = this.getForumChannelId(user.guild);
            const forumChannel = await guild.channels.fetch(forumChannelId);
            if (!forumChannel) return false;

            const thread = await forumChannel.threads.fetch(user.forum_post_id);
            if (!thread) return false;

            // ✅ جلب الرسالة الافتتاحية للموضوع
            const starterMessage = await thread.fetchStarterMessage();
            if (!starterMessage) {
                console.error(`❌ No starter message found for thread ${thread.id}`);
                return false;
            }

            const guildLabel = user.guild === 'sky_vanguards' ? '⚔️ Sky Vanguards' : '🌌 Aether Raiders';
            const color = user.guild === 'sky_vanguards' ? 0x5865F2 : 0x9B59B6;

            let avatarUrl = '';
            try {
                const member = await guild.members.fetch(userId);
                avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            } catch (e) {}

            const updatedContainer = new ContainerBuilder()
                .setAccentColor(color)
                .addTextDisplayComponents(t => t.setContent(`## ${user.username} is now part of Project Horizon`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addSectionComponents(s =>
                    s.addTextDisplayComponents(t => t.setContent(
                        `### 👤 Player: <@${userId}>\n` +
                        `### 🤝 Partner: ${user.partner_id ? `<@${user.partner_id}>` : 'Solo Explorer'}\n` +
                        `### 💠 Tokens: ${user.total_sky_tokens}`
                    ))
                    .setThumbnailAccessory(thumb =>
                        thumb.setDescription(user.username).setURL(avatarUrl)
                    )
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(t => t.setContent(`-# Guild: **${guildLabel}** | Project Horizon`));

            // ✅ تعديل الرسالة الافتتاحية فقط
            await starterMessage.edit({
                content: null,                      // إزالة المحتوى القديم (مطلوب مع V2)
                components: [updatedContainer],
                flags: MessageFlags.IsComponentsV2
            });

            return true;
        } catch (err) {
            console.error('❌ updateUserForumPost:', err.message);
            return false;
        }
    }

    // Helper: get forum channel ID based on guild
    getForumChannelId(guild) {
        const FORUM_CHANNELS = {
            sky_vanguards: '1485738947941503178',
            aether_raiders: '1485358515999739904'
        };
        return FORUM_CHANNELS[guild];
    }

    // ===== Message Tracking =====
    async incrementMessages(userId, username) {
        try {
            const user = await this.getUser(userId);
            if (!user) return { success: false, reason: 'USER_NOT_FOUND' };

            await this.db.run(
                `UPDATE activity_rewards
                 SET daily_messages  = daily_messages  + 1,
                     weekly_messages = weekly_messages + 1,
                     updated_at      = CURRENT_TIMESTAMP
                 WHERE user_id = $1`,
                [userId]
            );

            const updated = await this.getUser(userId);
            return { success: true, daily: updated.daily_messages, weekly: updated.weekly_messages };
        } catch (err) {
            console.error('❌ incrementMessages:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ===== Daily Quest Streak =====
    async incrementQuestStreak(userId) {
        try {
            const user = await this.getUser(userId);
            if (!user) return { success: false };

            const newStreak = (user.quest_streak ?? 0) + 1;

            const milestoneBonus = STREAK_MILESTONES[newStreak] ?? 0;
            const svBonus = (user.guild === 'sky_vanguards') ? (SV_STREAK_BONUS[newStreak] ?? 0) : 0;
            const totalBonus = milestoneBonus + svBonus;

            await this.db.run(
                `UPDATE activity_rewards
                 SET quest_streak     = $1,
                     total_sky_tokens = total_sky_tokens + $2,
                     updated_at       = CURRENT_TIMESTAMP
                 WHERE user_id = $3`,
                [newStreak, totalBonus, userId]
            );

            if (totalBonus > 0) {
                console.log(`🎯 ${userId} streak ${newStreak} → +${milestoneBonus} base${svBonus > 0 ? ` +${svBonus} SV` : ''} = +${totalBonus} total`);
            }

            return {
                success: true, newStreak, milestoneBonus, svBonus, totalBonus,
                hitMilestone: milestoneBonus > 0
            };
        } catch (err) {
            console.error('❌ incrementQuestStreak:', err.message);
            return { success: false };
        }
    }

    // ===== Reward Calculation =====
    calculateReward(activityKey, userRecord, applyDuoBonus = false) {
        const activityData = ACTIVITIES[activityKey];
        if (!activityData) return null;

        const base = activityData.reward;
        const userGuild = userRecord?.guild;

        let guildBonus = 0, guildLabel = '';
        if (userGuild && GUILD_BONUS[userGuild]?.activities.includes(activityKey)) {
            const pct = GUILD_BONUS[userGuild].pct;
            guildBonus = Math.ceil(base * (pct / 100));
            guildLabel = userGuild === 'sky_vanguards' ? `⚔️ Sky Vanguards +${pct}%` : `🌌 Aether Raiders +${pct}%`;
        }

        let duoBonus = 0, duoLabel = '';
        const hasDuo = DUO_BONUS_ACTIVITIES.includes(activityKey);
        if (applyDuoBonus && hasDuo && userRecord?.partner_id) {
            duoBonus = Math.ceil(base * 0.20);
            duoLabel = '🤝 Duo Bonus +20%';
        }

        return {
            base, guildBonus, guildLabel, duoBonus, duoLabel,
            total: base + guildBonus + duoBonus,
            hasDuoEligible: hasDuo,
            hasPartner: !!userRecord?.partner_id
        };
    }

    // ===== Apply Reward =====
    async applyReward(userId, activityKey, totalReward) {
        const activityData = ACTIVITIES[activityKey];
        if (!activityData) return { success: false, error: 'INVALID_ACTIVITY' };

        try {
            // Letter Hunt
            if (activityKey === 'letter_hunt') {
                await this.db.run(
                    `UPDATE activity_rewards
                     SET letter_hunt_wins    = letter_hunt_wins + 1,
                         letter_hunt_rewards = letter_hunt_rewards + $1,
                         total_sky_tokens    = total_sky_tokens + $1,
                         updated_at          = CURRENT_TIMESTAMP
                     WHERE user_id = $2`,
                    [totalReward, userId]
                );
                return { success: true, rewardAdded: totalReward };
            }

            // Steam Achievement (unlimited)
            if (activityKey === 'steam_achievement') {
                await this.db.run(
                    `UPDATE activity_rewards
                     SET steam_achievement_claimed = steam_achievement_claimed + 1,
                         total_sky_tokens          = total_sky_tokens + $1,
                         updated_at                = CURRENT_TIMESTAMP
                     WHERE user_id = $2`,
                    [totalReward, userId]
                );
                return { success: true, rewardAdded: totalReward };
            }

            // Invite (unlimited)
            if (activityKey === 'invite') {
                await this.db.run(
                    `UPDATE activity_rewards
                     SET invite_claimed    = invite_claimed + 1,
                         total_sky_tokens  = total_sky_tokens + $1,
                         updated_at        = CURRENT_TIMESTAMP
                     WHERE user_id = $2`,
                    [totalReward, userId]
                );
                return { success: true, rewardAdded: totalReward };
            }

            // Boolean (one-time)
            if (activityData.type === 'boolean') {
                const user = await this.getUser(userId);
                if (user?.[activityData.column] === true) {
                    return { success: false, error: 'ALREADY_CLAIMED' };
                }
                await this.db.run(
                    `UPDATE activity_rewards
                     SET ${activityData.column} = true,
                         total_sky_tokens       = total_sky_tokens + $1,
                         updated_at             = CURRENT_TIMESTAMP
                     WHERE user_id = $2`,
                    [totalReward, userId]
                );
                return { success: true, rewardAdded: totalReward };
            }

            // Integer counter
            const user = await this.getUser(userId);
            const current = user?.[activityData.column] ?? 0;

            if (activityData.max !== -1 && current >= activityData.max) {
                return { success: false, error: 'MAX_LIMIT_REACHED', current, max: activityData.max };
            }

            await this.db.run(
                `UPDATE activity_rewards
                 SET ${activityData.column} = ${activityData.column} + 1,
                     total_sky_tokens       = total_sky_tokens + $1,
                     updated_at             = CURRENT_TIMESTAMP
                 WHERE user_id = $2`,
                [totalReward, userId]
            );

            let streakResult = null;
            if (activityKey === 'goals_daily') {
                streakResult = await this.incrementQuestStreak(userId);
            }

            return {
                success: true, rewardAdded: totalReward,
                newValue: current + 1,
                remaining: activityData.max === -1 ? -1 : activityData.max - (current + 1),
                streakResult
            };

        } catch (err) {
            console.error('❌ applyReward:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ===== Apply Reward Multiple Times =====
    async applyRewardMultiple(userId, activityKey, count, applyDuoBonus = false) {
        if (count < 1) return { success: false, error: 'INVALID_COUNT' };

        const activityData = ACTIVITIES[activityKey];
        if (!activityData) return { success: false, error: 'INVALID_ACTIVITY' };

        const user = await this.getUser(userId);
        if (!user) return { success: false, error: 'USER_NOT_FOUND' };

        if (activityData.guildOnly && user.guild !== activityData.guildOnly) {
            return { success: false, error: 'GUILD_RESTRICTED' };
        }

        const rewardPerTime = this.calculateReward(activityKey, user, applyDuoBonus);
        const totalReward   = rewardPerTime.total * count;

        const isUnlimited = activityData.max === -1 ||
                            activityKey === 'letter_hunt' ||
                            activityKey === 'steam_achievement' ||
                            activityKey === 'invite';

        const hasLimit = activityData.type !== 'boolean' && !isUnlimited;

        if (hasLimit) {
            const current = user[activityData.column] ?? 0;
            if (current + count > activityData.max) {
                return { success: false, error: 'MAX_LIMIT_REACHED', current, max: activityData.max, requested: count };
            }
        }

        if (activityData.type === 'boolean' && count > 1) {
            return { success: false, error: 'BOOLEAN_ACTIVITY_NO_MULTIPLE' };
        }
        if (activityData.type === 'boolean') {
            return await this.applyReward(userId, activityKey, rewardPerTime.total);
        }

        try {
            if (activityKey === 'letter_hunt') {
                await this.db.run(
                    `UPDATE activity_rewards
                     SET letter_hunt_wins    = letter_hunt_wins    + $1,
                         letter_hunt_rewards = letter_hunt_rewards + $2,
                         total_sky_tokens    = total_sky_tokens    + $2,
                         updated_at          = CURRENT_TIMESTAMP
                     WHERE user_id = $3`,
                    [count, totalReward, userId]
                );
                return { success: true, rewardAdded: totalReward, count, details: rewardPerTime };
            }

            if (activityKey === 'steam_achievement') {
                await this.db.run(
                    `UPDATE activity_rewards
                     SET steam_achievement_claimed = steam_achievement_claimed + $1,
                         total_sky_tokens          = total_sky_tokens + $2,
                         updated_at                = CURRENT_TIMESTAMP
                     WHERE user_id = $3`,
                    [count, totalReward, userId]
                );
                return { success: true, rewardAdded: totalReward, count, details: rewardPerTime };
            }

            if (activityKey === 'invite') {
                await this.db.run(
                    `UPDATE activity_rewards
                     SET invite_claimed   = invite_claimed + $1,
                         total_sky_tokens = total_sky_tokens + $2,
                         updated_at       = CURRENT_TIMESTAMP
                     WHERE user_id = $3`,
                    [count, totalReward, userId]
                );
                return { success: true, rewardAdded: totalReward, count, details: rewardPerTime };
            }

            // Integer counter
            await this.db.run(
                `UPDATE activity_rewards
                 SET ${activityData.column} = ${activityData.column} + $1,
                     total_sky_tokens       = total_sky_tokens + $2,
                     updated_at             = CURRENT_TIMESTAMP
                 WHERE user_id = $3`,
                [count, totalReward, userId]
            );

            let streakResult = null;
            if (activityKey === 'goals_daily') {
                streakResult = await this.incrementQuestStreak(userId);
            }

            const newValue = (user[activityData.column] ?? 0) + count;
            return {
                success: true, rewardAdded: totalReward, count, newValue,
                remaining: activityData.max === -1 ? -1 : activityData.max - newValue,
                details: rewardPerTime, streakResult
            };

        } catch (err) {
            console.error('❌ applyRewardMultiple:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ===== Apply Reward to Both (user + partner) =====
    async applyRewardToBoth(userId, activityKey, count, applyDuoBonus = false) {
        if (count < 1) return { success: false, error: 'INVALID_COUNT' };

        const user = await this.getUser(userId);
        if (!user) return { success: false, error: 'USER_NOT_FOUND' };

        if (!applyDuoBonus || !user.partner_id) {
            const res = await this.applyRewardMultiple(userId, activityKey, count, applyDuoBonus);
            return {
                success: res.success,
                primary: { userId, reward: res.success ? res.rewardAdded : 0, error: res.error },
                partner: null,
                details: res.details ? { userCalc: res.details } : null
            };
        }

        const partner = await this.getUser(user.partner_id);
        if (!partner) {
            const res = await this.applyRewardMultiple(userId, activityKey, count, applyDuoBonus);
            return {
                success: res.success,
                primary: { userId, reward: res.success ? res.rewardAdded : 0, error: res.error },
                partner: null,
                details: res.details ? { userCalc: res.details } : null
            };
        }

        const calcUser    = this.calculateReward(activityKey, user,    applyDuoBonus);
        const calcPartner = this.calculateReward(activityKey, partner, applyDuoBonus);

        const resUser = await this.applyRewardMultiple(userId, activityKey, count, applyDuoBonus);
        if (!resUser.success) {
            return { success: false, primary: { userId, reward: 0, error: resUser.error }, partner: null, details: { userCalc: calcUser } };
        }

        const resPartner = await this.applyRewardMultiple(partner.user_id, activityKey, count, applyDuoBonus);
        if (!resPartner.success) console.warn(`⚠️ Partner reward failed: ${resPartner.error}`);

        return {
            success: true,
            primary: { userId, reward: calcUser.total * count },
            partner: { userId: partner.user_id, reward: resPartner.success ? calcPartner.total * count : 0, error: resPartner.error },
            details: { userCalc: calcUser, partnerCalc: calcPartner },
            count
        };
    }

    // ===== Partner System =====
    async setPendingPartner(userId, partnerId, partnerName, dmMessageId) {
        try {
            await this.db.run(
                `UPDATE activity_rewards
                 SET pending_partner_id = $1, pending_partner_name = $2,
                     pending_dm_message_id = $3, pending_expires_at = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $4`,
                [partnerId, partnerName, dmMessageId, userId]
            );
            return true;
        } catch (err) { console.error('❌ setPendingPartner:', err.message); return false; }
    }

    async clearPendingPartner(userId) {
        try {
            await this.db.run(
                `UPDATE activity_rewards
                 SET pending_partner_id = NULL, pending_partner_name = NULL,
                     pending_dm_message_id = NULL, pending_expires_at = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1`,
                [userId]
            );
            return true;
        } catch (err) { console.error('❌ clearPendingPartner:', err.message); return false; }
    }

    async linkPartners(userAId, userAName, userBId, userBName) {
        const client = await this.db.pool.connect();
        try {
            await client.query('BEGIN');
            for (const [uid, uname, pid, pname] of [
                [userAId, userAName, userBId, userBName],
                [userBId, userBName, userAId, userAName]
            ]) {
                await client.query(
                    `UPDATE activity_rewards
                     SET partner_id = $1, partner_name = $2,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = $3`,
                    [pid, pname, uid]
                );
            }
            await client.query('COMMIT');
            return true;
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('❌ linkPartners:', err.message);
            return false;
        } finally { client.release(); }
    }

    // ===== Scheduled Resets =====
    // داخل ActivityRewardsManager

    async getLastReset(resetType) {
        try {
            const row = await this.db.get(
                `SELECT last_reset FROM reset_tracker WHERE reset_type = $1`,
                [resetType]
            );
            return row ? new Date(row.last_reset) : null;
        } catch (err) {
            console.error('❌ getLastReset:', err.message);
            return null;
        }
    }

    async updateLastReset(resetType, date) {
        try {
            await this.db.run(
                `INSERT INTO reset_tracker (reset_type, last_reset) VALUES ($1, $2)
                 ON CONFLICT (reset_type) DO UPDATE SET last_reset = $2`,
                [resetType, date.toISOString()]
            );
        } catch (err) {
            console.error('❌ updateLastReset:', err.message);
        }
    }

    async checkAndApplyMissedResets(client, logChannelId = null) {
        const now = new Date();

        // Daily
        const lastDaily = await this.getLastReset('daily');
        if (!lastDaily) {
            await this.updateLastReset('daily', now);
        } else {
            const hoursSince = (now - lastDaily) / (1000 * 60 * 60);
            if (hoursSince >= 24) {
                console.log(`🕒 Daily reset missed by ${hoursSince.toFixed(1)} hours, applying now...`);
                await this.executeDailyReset(client, logChannelId);
                await this.updateLastReset('daily', now);
            }
        }

        // Weekly (based on Cairo Monday)
        const lastWeekly = await this.getLastReset('weekly');
        if (!lastWeekly) {
            await this.updateLastReset('weekly', now);
        } else {
            const daysSince = (now - lastWeekly) / (1000 * 60 * 60 * 24);
            if (daysSince >= 7) {
                console.log(`🕒 Weekly reset missed by ${daysSince.toFixed(1)} days, applying now...`);
                await this.executeWeeklyReset(client, logChannelId);
                await this.updateLastReset('weekly', now);
            }
        }
    }

    async executeDailyReset(client = null, logChannelId = null) {
        try {
            await this.db.run(
                `UPDATE activity_rewards
                 SET daily_messages              = 0,
                     msg_50_claimed              = 0,
                     goals_daily_claimed         = 0,
                     interaction_claimed         = 0,
                     tweet_reddit_post_claimed   = 0,
                     bug_publisher_claimed       = 0,
                     bug_skybots_claimed         = 0,
                     helper_claimed              = 0,
                     updated_at                  = CURRENT_TIMESTAMP`
            );
            const timeStr = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
            console.log(`✅ Daily reset done — ${timeStr}`);
            if (client && logChannelId) {
                const ch = await client.channels.fetch(logChannelId).catch(() => null);
                if (ch) await ch.send({ content: `🔄 **Daily Reset Done** — \`${timeStr}\`` }).catch(() => {});
            }
            // تحديث آخر وقت ريست
            await this.updateLastReset('daily', new Date());
            return { success: true };
        } catch (err) {
            console.error('❌ executeDailyReset:', err.message);
            return { success: false };
        }
    }

    async executeWeeklyReset(client = null, logChannelId = null) {
        try {
            await this.db.run(
                `UPDATE activity_rewards
                 SET weekly_messages = 0,
                     msg_500_claimed = 0,
                     steamachievements_weekly_claimed = 0,
                     updated_at      = CURRENT_TIMESTAMP`
            );
            const timeStr = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
            console.log(`✅ Weekly reset done — ${timeStr}`);
            if (client && logChannelId) {
                const ch = await client.channels.fetch(logChannelId).catch(() => null);
                if (ch) await ch.send({ content: `📅 **Weekly Reset Done** — \`${timeStr}\`` }).catch(() => {});
            }
            // تحديث آخر وقت ريست
            await this.updateLastReset('weekly', new Date());
            return { success: true };
        } catch (err) {
            console.error('❌ executeWeeklyReset:', err.message);
            return { success: false };
        }
    }

    async startScheduledResets(client, logChannelId = null) {
        // 1. تحقق من الفائت
        await this.checkAndApplyMissedResets(client, logChannelId);

        // 2. احسب التأخير التالي
        const dailyDelay  = getEgyptMidnightDelay();
        const weeklyDelay = getEgyptNextMondayDelay();

        console.log(`⏰ Daily reset in  ${Math.round(dailyDelay  / 1000 / 60)} minutes`);
        console.log(`⏰ Weekly reset in ${Math.round(weeklyDelay / 1000 / 60 / 60)} hours`);

        setTimeout(() => {
            this.executeDailyReset(client, logChannelId);
            setInterval(() => this.executeDailyReset(client, logChannelId), 24 * 60 * 60 * 1000);
        }, dailyDelay);

        setTimeout(() => {
            this.executeWeeklyReset(client, logChannelId);
            setInterval(() => this.executeWeeklyReset(client, logChannelId), 7 * 24 * 60 * 60 * 1000);
        }, weeklyDelay);

        console.log('✅ Scheduled resets started (Africa/Cairo timezone)');
    }

    // ===== Leaderboard =====
    async getLeaderboard(limit = 10) {
        try {
            return await this.db.all(
                `SELECT user_id, username, guild, partner_name, total_sky_tokens
                 FROM activity_rewards ORDER BY total_sky_tokens DESC LIMIT $1`,
                [limit]
            );
        } catch (err) { console.error('❌ getLeaderboard:', err.message); return []; }
    }

    // ===== getUserStats =====
    async getUserStats(userId) {
        try {
            const u = await this.getUser(userId);
            if (!u) return null;
            return {
                user_id: u.user_id, username: u.username, guild: u.guild,
                partner_id: u.partner_id, partner_name: u.partner_name,
                total_sky_tokens: u.total_sky_tokens, quest_streak: u.quest_streak ?? 0,
                messages: { daily: u.daily_messages ?? 0, weekly: u.weekly_messages ?? 0 },
                daily: {
                    msg_50:              { value: u.msg_50_claimed,              max: 3  },
                    goals_daily:         { value: u.goals_daily_claimed,         max: 1  },
                    invite:              { value: u.invite_claimed,              max: -1 },
                    interaction:         { value: u.interaction_claimed,         max: 1  },
                    tweet_reddit_post:   { value: u.tweet_reddit_post_claimed,   max: 1  },
                    bug_publisher:       { value: u.bug_publisher_claimed,       max: 3  },
                    bug_skybots:         { value: u.bug_skybots_claimed,         max: 3  },
                    helper:              { value: u.helper_claimed,              max: 2  },
                    steam_achievement:   { value: u.steam_achievement_claimed,   max: -1 },
                },
                weekly: {
                    msg_500: { value: u.msg_500_claimed, max: 3 },
                    steamachievements_weekly: { value: u.steamachievements_weekly_claimed, max: 1 },
                },
                one_time: {
                    steam_linked:        u.steam_linked,
                    follow_twitter:      u.follow_twitter,
                    follow_reddit:       u.follow_reddit,
                    follow_steam:        u.follow_steam,
                    achievements:        { value: u.achievements_claimed, max: 3 },
                    boosted_server:      u.boosted_server,
                    finish_game:         { value: u.finish_game_claimed,  max: 5 },
                    wishlist:            u.wishlist_claimed,
                    review:              u.review_claimed,
                    suggestion:          u.suggestion_claimed,
                },
                community_giveaways: { value: u.community_giveaways_claimed, max: 3 },
                letter_hunt: { wins: u.letter_hunt_wins ?? 0, rewards: u.letter_hunt_rewards ?? 0 }
            };
        } catch (err) { console.error('❌ getUserStats:', err.message); return null; }
    }
}

module.exports = {
    ActivityRewardsManager, ACTIVITIES, GUILD_BONUS,
    DUO_BONUS_ACTIVITIES, STREAK_MILESTONES, SV_STREAK_BONUS,
    PARTNER_NOTIFICATION_CHANNEL
};