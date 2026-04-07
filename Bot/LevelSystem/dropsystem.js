const { EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');
const { couponSystem } = require('./couponsystem');

class DropSystem {
    constructor(client) {
        this.client = client;

        // Drop Configurations
        this.dropConfig = {
            common: {
                emoji: '📦',
                color: 0x00FF00,
                minInterval: 100,
                maxInterval: 150,
                deleteAfter: 20000
            },
            rare: {
                emoji: '✨',
                color: 0x0099FF,
                minInterval: 250,
                maxInterval: 300,
                deleteAfter: 20000
            },
            epic: {
                emoji: '💎',
                color: 0xAA00FF,
                minInterval: 350,
                maxInterval: 500,
                deleteAfter: 20000
            },
            legendary: {
                emoji: '🔥',
                color: 0xFF9900,
                minInterval: 550,
                maxInterval: 800,
                deleteAfter: 20000
            }
        };

        // Cache system
        this.userProgressCache = new Map();
        this.cacheTTL = 5 * 60 * 1000;

        // تنظيف الـ cache دورياً
        setInterval(() => this.cleanCache(), this.cacheTTL);
    }

    async setup() {
        console.log('🎮 Drop System initializing...');
        await this.cleanupOnStartup();
        console.log('✅ Drop System ready!');
        return this;
    }

    // ========== DROP PROCESSING WITH COUPONS ==========

    async processMessage(userId, username, channel = null) {
        try {
            // 1. جلب تقدم المستخدم
            const userProgress = await this.getUserProgress(userId, username);
            if (!userProgress) return null;

            // 2. زيادة الرسائل بمقدار 1
            const newCount = userProgress.total_messages + 1;
            userProgress.total_messages = newCount;

            // 3. تحديث عدد الرسائل في الداتابيز
            await this.updateMessageCount(userId, newCount);

            // 4. التحقق من الـ Drops المتاحة
            const availableDrops = await this.checkAvailableDrops(userProgress);

            console.log(`🔍 ${username}: ${newCount} messages | Available drops: ${availableDrops.length}`);

            if (availableDrops.length === 0) {
                return { 
                    success: true, 
                    hasDrops: false, 
                    messageCount: newCount 
                };
            }

            // 5. إنشاء الـ Drops
            const createdDrops = [];

            for (const drop of availableDrops) {
                console.log(`🎁 ${username} reached ${drop.type} drop at ${newCount} messages!`);

                // ⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️
                // نجيب config النوع من الداتابيز
                const dropConfig = await dbManager.getDropConfig(drop.type);
                let couponChance = 0;
                let couponMinDiscount = 15;
                let couponMaxDiscount = 40;

                if (dropConfig && dropConfig.rewards_config) {
                    try {
                        const rewards = Array.isArray(dropConfig.rewards_config) 
                            ? dropConfig.rewards_config 
                            : JSON.parse(dropConfig.rewards_config);

                        const couponReward = rewards.find(r => r.reward_type === 'coupon');
                        if (couponReward) {
                            couponChance = couponReward.chance || 0;
                            couponMinDiscount = couponReward.min_discount || 15;
                            couponMaxDiscount = couponReward.max_discount || 40;
                            console.log(`🎫 ${drop.type} coupon config: ${couponChance * 100}% chance`);
                        }
                    } catch (error) {
                        console.error('❌ Error parsing rewards config:', error);
                    }
                }
                // ⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️

                const crateResult = await this.createDropCrate(userId, username, drop.type);

                if (crateResult.success) {
                    // ⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️
                    // هنا نضيف الكوبون إذا كان legendary وطابقت النسبة
                    let couponResult = null;
                    

                    if (drop.type === 'legendary' && couponChance > 0 && Math.random() < couponChance) {
                        // توليد نسبة خصم من المدى في config
                        const discount = this.getRandomBetween(couponMinDiscount, couponMaxDiscount);

                        couponResult = await couponSystem.createCouponFromDrop(
                            userId,
                            username,
                            discount,
                            crateResult.crateId
                        );

                        // تسجيل النتيجة
                        console.log(`🎫 LEGENDARY DROP COUPON ATTEMPT:`);
                        console.log(`   User: ${username}`);
                        console.log(`   Discount: ${discount}%`);
                        console.log(`   Crate ID: ${crateResult.crateId}`);
                        console.log(`   Result: ${couponResult ? 'SUCCESS' : 'FAILED'}`);

                        if (couponResult && couponResult.success) {
                            console.log(`🎫 ${username} got coupon from legendary crate: ${couponResult.couponCode} (${discount}% off)`);

                            // إشعار خاص للمستخدم
                            try {
                                const user = await this.client.users.fetch(userId).catch(() => null);
                                if (user) {
                                    await user.send({
                                        embeds: [
                                            new EmbedBuilder()
                                                .setColor(0xFF9900)
                                                .setTitle('🎫 LEGENDARY DROP COUPON!')
                                                .setDescription(`Congratulations! You found a coupon in your **Legendary Crate**!`)
                                                .addFields(
                                                    { name: 'Coupon Code', value: `\`${couponResult.couponCode}\``, inline: false },
                                                    { name: 'Discount', value: `${discount}% OFF`, inline: true },
                                                    { name: 'Valid For', value: `${couponResult.validForDays} days`, inline: true }
                                                )
                                                .setFooter({ text: 'Use it in the shop before it expires!' })
                                                .setTimestamp()
                                        ]
                                    }).catch(() => {});
                                }
                            } catch (dmError) {
                                console.log(`⚠️ Could not DM coupon to ${username}`);
                            }
                        }
                    }
                    // ⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️

                    // تحديث الـ drop
                    await this.updateDropTarget(userId, drop.type, newCount);

                    createdDrops.push({
                        type: drop.type,
                        crateId: crateResult.crateId,
                        reward: crateResult.crateData?.reward || {},
                        coupon: couponResult
                    });
                }
            }

            // 6. تحديث المهام المرتبطة بالـ Drops
            if (createdDrops.length > 0) {
                await this.updateDropMissions(userId, createdDrops);
            }

            // 7. إرسال الإشعارات
            if (createdDrops.length > 0 && channel && channel.isTextBased()) {
                await this.sendDropNotifications(userId, username, createdDrops, channel);
            }

            return {
                success: true,
                hasDrops: createdDrops.length > 0,
                drops: createdDrops,
                messageCount: newCount
            };

        } catch (error) {
            console.error(`❌ Error processing drop for ${userId}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    // ========== MISSIONS INTEGRATION ==========

    async updateDropMissions(userId, drops) {
        try {
            let totalDropCount = 0;
            let totalDropCoins = 0;

            for (const drop of drops) {
                totalDropCount++;

                // حساب عملات الـ Drops للمهام
                if (drop.reward && drop.reward.coins) {
                    totalDropCoins += drop.reward.coins;
                }
            }

            // تحديث مهمة عدد الـ Drops (Drop Hunter - يومي)
            await dbManager.updateGoalProgress(userId, 'drops', totalDropCount);

            // تحديث مهمة عملات الـ Drops (Lucky Day - يومي)
            if (totalDropCoins > 0) {
                await dbManager.updateGoalProgress(userId, 'drop_coins', totalDropCoins);
            }

            console.log(`✅ Updated drop missions for ${userId}: ${totalDropCount} drops, ${totalDropCoins} coins`);

            return true;

        } catch (error) {
            console.error(`❌ Failed to update drop missions for ${userId}:`, error.message);
            return false;
        }
    }

    async getUserDropStats(userId) {
        try {
            const user = await dbManager.getUserDropProgress(userId);
            if (!user) return null;

            const dropTypes = ['common', 'rare', 'epic', 'legendary'];
            const stats = {
                total_messages: user.total_messages,
                total_drops_received: 0,
                drops_by_type: {},
                next_targets: {},
                drop_coupons: 0,
                event_coupons: 0
            };

            for (const dropType of dropTypes) {
                const targetField = `${dropType}_target`;
                const countField = `total_${dropType}_received`;
                const lastField = `last_${dropType}_at`;

                const dropsReceived = user[countField] || 0;
                const nextTarget = user[targetField] || 0;
                const lastTaken = user[lastField] || 0;

                stats.total_drops_received += dropsReceived;
                stats.drops_by_type[dropType] = dropsReceived;

                // حساب الرسائل المتبقية للـ drop التالي
                let remaining = 0;
                let progress = 0;
                let isAvailable = false;

                if (user.total_messages >= nextTarget) {
                    if (lastTaken >= nextTarget) {
                        remaining = 0;
                        progress = 100;
                        isAvailable = false;
                    } else {
                        remaining = 0;
                        progress = 100;
                        isAvailable = true;
                    }
                } else {
                    remaining = nextTarget - user.total_messages;
                    progress = Math.floor((user.total_messages / nextTarget) * 100);
                    isAvailable = false;
                }

                stats.next_targets[dropType] = {
                    next_at: nextTarget,
                    remaining: remaining,
                    progress: progress,
                    last_taken: lastTaken,
                    is_available: isAvailable
                };
            }

            // حساب عدد كوبونات الـ drop
            const dropCoupons = await dbManager.all(
                `SELECT COUNT(*) as count FROM shop_coupons 
                 WHERE user_id = ? 
                 AND source_type = 'drop'
                 AND is_used = false
                 AND expires_at > CURRENT_TIMESTAMP`,
                [userId]
            );

            stats.drop_coupons = dropCoupons[0]?.count || 0;

            // حساب عدد كوبونات الـ event
            const eventCoupons = await dbManager.all(
                `SELECT COUNT(*) as count FROM shop_coupons 
                 WHERE user_id = ? 
                 AND source_type = 'event'
                 AND is_used = false
                 AND expires_at > CURRENT_TIMESTAMP`,
                [userId]
            );

            stats.event_coupons = eventCoupons[0]?.count || 0;

            return stats;

        } catch (error) {
            console.error('❌ Failed to get user drop stats:', error.message);
            return null;
        }
    }

    // ========== CACHE SYSTEM ==========

    async getUserProgress(userId, username) {
        const cached = this.userProgressCache.get(userId);
        if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
            return cached.data;
        }

        const progress = await dbManager.getUserDropProgress(userId, username);
        if (!progress) {
            return await dbManager.createUserDropProgress(userId, username);
        }

        this.userProgressCache.set(userId, {
            data: progress,
            timestamp: Date.now()
        });

        return progress;
    }

    cleanCache() {
        const now = Date.now();
        for (const [userId, cache] of this.userProgressCache.entries()) {
            if (now - cache.timestamp > this.cacheTTL) {
                this.userProgressCache.delete(userId);
            }
        }
    }

    // ========== DROP PROCESSING ==========

    async checkAvailableDrops(userProgress) {
        const drops = [];
        const dropTypes = ['common', 'rare', 'epic', 'legendary'];

        for (const dropType of dropTypes) {
            const targetField = `${dropType}_target`;
            const lastField = `last_${dropType}_at`;

            if (userProgress.total_messages >= userProgress[targetField] && 
                userProgress[lastField] < userProgress[targetField]) {
                drops.push({
                    type: dropType,
                    currentMessages: userProgress.total_messages,
                    target: userProgress[targetField]
                });
            }
        }

        return drops;
    }

    async createDropCrate(userId, username, dropType) {
        try {
            return await dbManager.createCrate(userId, username, dropType);
        } catch (error) {
            console.error(`❌ Failed to create ${dropType} crate:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async updateDropTarget(userId, dropType, currentMessages) {
        try {
            const config = this.dropConfig[dropType];

            const newInterval = Math.floor(Math.random() * (config.maxInterval - config.minInterval + 1)) + config.minInterval;
            const newTarget = currentMessages + newInterval;

            const updateField = `${dropType}_target`;
            const countField = `total_${dropType}_received`;
            const lastField = `last_${dropType}_at`;

            await dbManager.run(
                `UPDATE user_drop_progress 
                 SET ${updateField} = ?, 
                     ${countField} = ${countField} + 1,
                     ${lastField} = ?,
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = ?`,
                [newTarget, currentMessages, userId]
            );

            const cached = this.userProgressCache.get(userId);
            if (cached) {
                cached.data[updateField] = newTarget;
                cached.data[lastField] = currentMessages;
                cached.data[countField] += 1;
            }

            console.log(`🎯 Updated ${dropType} target for ${userId}: new target = ${newTarget}`);

            return true;

        } catch (error) {
            console.error(`❌ Failed to update ${dropType} target:`, error.message);
            return false;
        }
    }

    async updateMessageCount(userId, totalMessages) {
        try {
            await dbManager.run(
                `UPDATE user_drop_progress 
                 SET total_messages = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = ?`,
                [totalMessages, userId]
            );

            const cached = this.userProgressCache.get(userId);
            if (cached) {
                cached.data.total_messages = totalMessages;
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to update message count:', error.message);
            return false;
        }
    }

    // ========== NOTIFICATION SYSTEM ==========

    async sendDropNotifications(userId, username, drops, channel = null) {
        if (!drops || drops.length === 0 || !channel || !channel.isTextBased()) return;

        try {
            const user = await this.client.users.fetch(userId).catch(() => null);
            const groupedDrops = this.groupDropsByType(drops);

            for (const [dropType, typeDrops] of Object.entries(groupedDrops)) {
                // إذا كان legendary مع كوبون، نعرض إشعار خاص
                const dropWithCoupon = typeDrops.find(d => d.coupon);

                if (dropType === 'legendary' && dropWithCoupon) {
                    await this.sendLegendaryWithCouponNotification(user, dropWithCoupon, channel);
                } else {
                    await this.sendAutoDeleteNotification(user, typeDrops, channel, dropType);
                }
            }

        } catch (error) {
            console.error('❌ Failed to send drop notifications:', error.message);
        }
    }

    async sendLegendaryWithCouponNotification(user, drop, channel) {
        try {
            const config = this.dropConfig.legendary;

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle(`🔥 LEGENDARY DROP + BONUS COUPON!`)
                .setDescription(`${user?.username || 'A user'} achieved something epic!`)
                .addFields(
                    { 
                        name: '🏆 Legendary Reward', 
                        value: `• ${drop.type.toUpperCase()} Crate\n• Contains special rewards`, 
                        inline: false 
                    },
                    { 
                        name: '🎫 Bonus Coupon', 
                        value: `**${drop.coupon.couponCode}**\n${drop.coupon.discountPercentage}% OFF!`, 
                        inline: true 
                    },
                    { 
                        name: '⏰ Coupon Valid For', 
                        value: `${drop.coupon.validForDays} days`, 
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: `Use /crates to open • Check your DMs for coupon details`,
                    iconURL: user?.displayAvatarURL() 
                })
                .setTimestamp();

            const message = await channel.send({
                content: user ? `🎊 ${user} **LEGENDARY DROP WITH BONUS COUPON!**` : '🎊 Legendary Drop!',
                embeds: [embed]
            });

            console.log(`📢 Sent legendary+ coupon notification for ${user?.username || 'unknown'}`);

            setTimeout(async () => {
                try {
                    await message.delete();
                } catch (error) {
                    // تجاهل إذا الرسالة اتشالت
                }
            }, config.deleteAfter);

        } catch (error) {
            console.error('❌ Failed to send legendary+ notification:', error.message);
        }
    }

    groupDropsByType(drops) {
        const grouped = {};

        for (const drop of drops) {
            if (!grouped[drop.type]) {
                grouped[drop.type] = [];
            }
            grouped[drop.type].push(drop);
        }

        return grouped;
    }

    async sendAutoDeleteNotification(user, drops, channel, dropType) {
        try {
            const config = this.dropConfig[dropType];
            const dropCount = drops.length;

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle(`${config.emoji} ${this.getNotificationTitle(dropType, dropCount)}`)
                .setDescription(this.getNotificationDescription(drops, dropType, dropCount, user?.username))
                .addFields(
                    { 
                        name: '🎯 Drop Type', 
                        value: `${dropType.charAt(0).toUpperCase() + dropType.slice(1)}`, 
                        inline: true 
                    },
                    { 
                        name: '📦 Crates Received', 
                        value: `**${dropCount}** crate${dropCount > 1 ? 's' : ''}`, 
                        inline: true 
                    },
                    { 
                        name: '📊 Total Drops', 
                        value: `Added to your drop missions`, 
                        inline: false 
                    }
                )
                .setTimestamp()
                .setFooter({ 
                    text: `Drop System • Use /crates to open • Auto-deletes in 20s`,
                    iconURL: user?.displayAvatarURL() 
                });

            const message = await channel.send({
                content: user ? `🎉 ${user} **${dropCount} ${dropType.toUpperCase()} DROP${dropCount > 1 ? 'S' : ''}!**` : '🎉 New Drops!',
                embeds: [embed]
            });

            console.log(`📢 Sent ${dropType} drop notification for ${user?.username || 'unknown'}`);

            setTimeout(async () => {
                try {
                    await message.delete();
                    console.log(`🗑️ Deleted drop notification after 20s`);
                } catch (error) {
                    if (error.code !== 10008) {
                        console.log(`⚠️ Could not delete message: ${error.message}`);
                    }
                }
            }, config.deleteAfter);

            return message;

        } catch (error) {
            console.error('❌ Failed to send auto-delete notification:', error.message);
            return null;
        }
    }

    // ========== HELPER FUNCTIONS ==========

    getNotificationTitle(dropType, count) {
        const titles = {
            common: count > 1 ? `COMMON DROPS x${count}!` : `COMMON DROP!`,
            rare: count > 1 ? `RARE DROPS x${count}!` : `RARE DROP!`,
            epic: count > 1 ? `EPIC DROPS x${count}!` : `EPIC DROP!`,
            legendary: `🔥 LEGENDARY DROP! 🔥`
        };

        return titles[dropType] || `DROP!`;
    }

    getNotificationDescription(drops, dropType, count, username = 'A user') {
        const descriptions = {
            common: `${username} earned **${count} Common Drop${count > 1 ? 's' : ''}**!\n✅ Added to drop missions`,
            rare: `**Great!** ${username} unlocked **${count} Rare Drop${count > 1 ? 's' : ''}**!\n✅ Added to drop missions`,
            epic: `**Epic!** ${username} received **${count} Epic Drop${count > 1 ? 's' : ''}**!\n✅ Added to drop missions`,
            legendary: `**LEGENDARY!** 🎊 ${username} achieved a **Legendary Drop**!\n✅ Added to drop missions`
        };

        return descriptions[dropType] || `${username} received ${count} drop${count > 1 ? 's' : ''}!`;
    }

    getRandomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // ========== PUBLIC API ==========

    async getUserDropStatus(userId) {
        try {
            const status = await dbManager.getCompleteDropStatus(userId);

            // إضافة معلومات المهام
            if (status) {
                status.missions = {
                    drop_hunter: { type: 'daily', target: 'drops', description: 'Collect drops' },
                    drop_master: { type: 'weekly', target: 'drops', description: 'Collect many drops' },
                    lucky_day: { type: 'daily', target: 'drop_coins', description: 'Earn coins from drops' }
                };
            }

            return status;
        } catch (error) {
            console.error('❌ Failed to get user drop status:', error.message);
            return null;
        }
    }

    async openCrate(userId, crateId) {
        try {
            const result = await dbManager.openCrate(crateId, userId);

            // إذا تم فتح crate بنجاح، تحديث مهام عملات الـ drops
            if (result.success && result.crate && result.crate.rewards) {
                const coins = result.crate.rewards.coins || 0;
                if (coins > 0) {
                    await dbManager.updateGoalProgress(userId, 'drop_coins', coins);
                }
            }

            return result;
        } catch (error) {
            console.error('❌ Failed to open crate:', error.message);
            return { success: false, error: error.message };
        }
    }

    async openAllCrates(userId, crateType) {
        try {
            const result = await dbManager.openAllCratesOfType(userId, crateType);

            // تحديث المهام بعد فتح جميع الصناديق
            if (result.success && result.total) {
                // تحديث مهام عملات الـ drops
                if (result.total.coins > 0) {
                    await dbManager.updateGoalProgress(userId, 'drop_coins', result.total.coins);
                }

                // تحديث مهام عدد الـ drops (كل crate = 1 drop)
                if (result.opened > 0) {
                    await dbManager.updateGoalProgress(userId, 'drops', result.opened);
                }
            }

            return result;
        } catch (error) {
            console.error('❌ Failed to open all crates:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getUserBuffs(userId) {
        try {
            return await dbManager.getUserActiveBuffs(userId);
        } catch (error) {
            console.error('❌ Failed to get user buffs:', error.message);
            return [];
        }
    }

    async cleanupOnStartup() {
        try {
            const result = await dbManager.cleanupExpiredBuffs();
            if (result.cleaned > 0) {
                console.log(`🧹 Cleaned ${result.cleaned} expired buffs on startup`);
            }

            this.userProgressCache.clear();

        } catch (error) {
            console.error('❌ Failed to cleanup on startup:', error.message);
        }
    }

    // ========== STATS & MONITORING ==========

    getSystemStats() {
        return {
            cachedUsers: this.userProgressCache.size,
            dropConfig: Object.keys(this.dropConfig).length,
            cacheTTL: `${this.cacheTTL / 60000} minutes`,
            missions: {
                drop_hunter: 'Daily - Collect drops',
                drop_master: 'Weekly - Collect many drops',
                lucky_day: 'Daily - Earn coins from drops'
            }
        };
    }
}

module.exports = { DropSystem };