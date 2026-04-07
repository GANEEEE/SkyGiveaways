const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    SectionBuilder, 
    SeparatorBuilder, 
    TextDisplayBuilder,
    MessageFlags 
} = require('discord.js');
const dbManager = require('../Data/database');
const { couponSystem } = require('../LevelSystem/couponsystem');
const levelSystem = require('../LevelSystem/levelsystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily rewards!'),

    // ========== خطة الـ Streak Roles ==========
    STREAK_ROLES: [
        { days: 3, roleId: "1465799771498479780", name: "Bronze" },
        { days: 8, roleId: "1465799865916330217", name: "Silver" },
        { days: 15, roleId: "1465799906902937600", name: "Gold" },
        { days: 22, roleId: "1465799973852680355", name: "Platinum" },
        { days: 31, roleId: "1465800025689817098", name: "Diamond" },
        { days: 46, roleId: "1465800075237396746", name: "Ruby" },
        { days: 61, roleId: "1465800146338976029", name: "Sapphire" },
        { days: 76, roleId: "1465800202131865631", name: "Emerald" },
        { days: 100, roleId: "1465800603224510536", name: "Legendary" }
    ],

    // ========== خطة الـ Daily Boosts (مدة أسبوع) ==========
    DAILY_BOOSTS: [
        { day: 7, multiplier: { xp: 1.15, coins: 1.10 }, duration: 7, message: "🎯 First Week Boost!" },
        { day: 15, multiplier: { xp: 1.25, coins: 1.15 }, duration: 7, message: "🏅 Half Month Boost!" },
        { day: 46, multiplier: { xp: 1.40, coins: 1.25 }, duration: 30, message: "🔥 Ruby Tier Boost!" },
        { day: 100, multiplier: { xp: 2.00, coins: 1.50 }, duration: 0, message: "🌟 IMMORTAL PERMANENT BOOST!" }
    ],

    // ========== خطة الـ Streak Coupons ==========
    STREAK_COUPONS: [
        { day: 10, type: 'bronze', min: 3, max: 5, duration: 4 },      // 3-5%
        { day: 20, type: 'silver', min: 5, max: 7, duration: 7 },      // 5-7%
        { day: 30, type: 'gold', min: 7, max: 9, duration: 11 },       // 7-9%
        { day: 40, type: 'platinum', min: 9, max: 12, duration: 14 },  // 9-12%
        { day: 50, type: 'diamond', min: 12, max: 15, duration: 18 },  // 12-15%
        { day: 60, type: 'ruby', min: 15, max: 18, duration: 21 },     // 15-18%
        { day: 70, type: 'sapphire', min: 18, max: 21, duration: 26 }, // 18-21%
        { day: 80, type: 'emerald', min: 21, max: 23, duration: 35 },  // 21-23%
        { day: 90, type: 'legendary', min: 23, max: 24, duration: 45 }, // 23-24%
        { day: 100, type: 'immortal', min: 25, max: 25, duration: 60 }  // 25% ثابتة
    ],

    // ========== خطة الـ Daily Crates ==========
    STREAK_CRATES: [
        { day: 3, crates: [{ type: 'common', count: 1 }] },
        { day: 8, crates: [{ type: 'common', count: 2 }] },
        { day: 15, crates: [{ type: 'rare', count: 1 }] },
        { day: 22, crates: [{ type: 'rare', count: 1 }, { type: 'common', count: 1 }] },
        { day: 31, crates: [{ type: 'rare', count: 2 }] },
        { day: 46, crates: [{ type: 'rare', count: 3 }] },
        { day: 61, crates: [{ type: 'epic', count: 1 }] },
        { day: 76, crates: [{ type: 'epic', count: 3 }, { type: 'legendary', count: 1 }] },
        { day: 100, crates: [{ type: 'legendary', count: 5 }] }
    ],

    // ========== فرص الكريتات بعد اليوم 100 ==========
    POST_100_CRATE_CHANCES: {
        'rare': 40,    // 40% فرصة
        'epic': 35,    // 35% فرصة
        'legendary': 25 // 25% فرصة
    },

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            const username = interaction.user.username;
            const userAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
            const now = new Date();

            // الحصول على بيانات المستخدم
            const userData = await dbManager.getUserProfile(userId);

            if (!userData) {
                // أول مرة للمستخدم - إنشاء ملف شخصي
                const initialCoins = 15;
                const initialXP = 10;

                await dbManager.ensureUserExists(userId, username);

                // تحديث المكافأة الأولى
                await dbManager.run(
                    `UPDATE levels 
                     SET last_daily = ?,
                         daily_streak = 1,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = ?`,
                    [now.toISOString(), userId]
                );

                // استخدام levelSystem
                await levelSystem.processUserRewards(
                    userId,
                    username,
                    initialXP,
                    initialCoins,
                    0,
                    interaction.client,
                    interaction.guild,
                    'other',
                    true
                );

                const container = new ContainerBuilder()
                    .setAccentColor(0x00FF00)
                    .addSectionComponents((section) =>
                        section
                            .addTextDisplayComponents(
                                (textDisplay) =>
                                    textDisplay.setContent(`# 🎁 Daily Reward - First Time!`)
                            )
                            .setThumbnailAccessory((thumbnail) =>
                                thumbnail
                                    .setDescription(`${username}'s first reward`)
                                    .setURL(userAvatar)
                            )
                    )
                    .addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`**+${initialCoins} <:Coins:1468446651965374534> | +${initialXP} <:XP:1468446751282302976> | 🔥 Streak: 1**`)
                    )
                    .addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`*Balance: ${initialCoins} <:Coins:1468446651965374534>*`)
                    );

                return await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            // التحقق من آخر مرة تم فيها المطالبة
            const lastDaily = userData.last_daily ? new Date(userData.last_daily) : null;
            const oldStreak = userData.daily_streak || 0;

            if (lastDaily) {
                const timeDiff = now - lastDaily;
                const hoursDiff = timeDiff / (1000 * 60 * 60);

                // ========== نظام 48 ساعة بدلاً من 24 ساعة ==========

                // 1. إذا مر أقل من 24 ساعة → كولدوان
                if (hoursDiff < 24) {
                    const nextClaimTime = new Date(lastDaily.getTime() + (24 * 60 * 60 * 1000));
                    const timeLeft = Math.floor((nextClaimTime - now) / 1000);

                    // حساب التقدم
                    const totalCooldown = 24 * 60 * 60;
                    const elapsedTime = totalCooldown - timeLeft;
                    const progressPercentage = Math.round((elapsedTime / totalCooldown) * 100);

                    // إنشاء شريط التقدم
                    const progressBarLength = 15;
                    const filledBlocks = Math.floor((progressPercentage / 100) * progressBarLength);
                    const emptyBlocks = progressBarLength - filledBlocks;

                    let progressBar = '';
                    for (let i = 0; i < filledBlocks; i++) progressBar += ' 🟦';
                    for (let i = 0; i < emptyBlocks; i++) progressBar += ' ⬛';

                    // حساب الوقت المتبقي
                    const hours = Math.floor(timeLeft / 3600);
                    const minutes = Math.floor((timeLeft % 3600) / 60);
                    const seconds = timeLeft % 60;

                    let timeString = '';
                    if (hours > 0) timeString += `${hours} hour${hours !== 1 ? 's' : ''} `;
                    if (minutes > 0) timeString += `${minutes} minute${minutes !== 1 ? 's' : ''} `;
                    if (seconds > 0 && hours === 0) timeString += `${seconds} second${seconds !== 1 ? 's' : ''}`;

                    // تنسيق الأرقام
                    const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                    const formattedCoins = formatNumber(userData.sky_coins || 0);
                    const currentStreak = oldStreak;

                    // إنشاء الـ Container
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF9900)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents(
                                    (textDisplay) =>
                                        textDisplay.setContent(`## ⏳ Daily Reward Locked`)
                                )
                                .addTextDisplayComponents(
                                    (textDisplay) =>
                                        textDisplay.setContent(`<:Coins:1468446651965374534> Coins: \`${formattedCoins}\` | 🔥 Streak: \`${currentStreak}/100\``)
                                )
                                .addTextDisplayComponents(
                                    (textDisplay) =>
                                        textDisplay.setContent(`⏰ **Next Reward In:** \`${timeString.trim() || 'Ready!'}\``)
                                )
                                .setThumbnailAccessory((thumbnail) =>
                                    thumbnail
                                        .setDescription(`${username}'s cooldown`)
                                        .setURL(userAvatar)
                                )
                        )
                        .addSeparatorComponents((separator) => separator)
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(`### ⌛ ${progressPercentage}% Complete`)
                        )
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(`${progressBar}`)
                        )
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(`-# *Next reset: <t:${Math.floor(nextClaimTime.getTime() / 1000)}:F>*`)
                        );

                    return await interaction.editReply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2
                    });
                } 
                // 2. إذا مر بين 24-48 ساعة → يستمر الستريك بدون قطع
                else if (hoursDiff <= 48) {
                    // حساب الستريك الجديد (يستمر)
                    let newStreak = oldStreak + 1;

                    // تحديث فقط بدون قطع
                    await dbManager.run(
                        `UPDATE levels 
                         SET last_daily = ?,
                             daily_streak = ?,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE user_id = ?`,
                        [now.toISOString(), newStreak, userId]
                    );

                    // معالجة المكافأة (بدون قطع الستريك)
                    return await this.processDailyReward(
                        interaction, 
                        userId, 
                        username, 
                        userAvatar, 
                        newStreak, 
                        oldStreak, 
                        false
                    );
                }
                // 3. إذا مر أكثر من 48 ساعة → قطع الستريك
                else {
                    // إعادة الستريك إلى 1
                    const newStreak = 1;

                    // إزالة كل الرولز القديمة
                    await this.removeAllStreakRoles(interaction);

                    // تحديث الداتابيز
                    await dbManager.run(
                        `UPDATE levels 
                         SET last_daily = ?,
                             daily_streak = ?,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE user_id = ?`,
                        [now.toISOString(), newStreak, userId]
                    );

                    // معالجة المكافأة (مع قطع الستريك)
                    return await this.processDailyReward(
                        interaction, 
                        userId, 
                        username, 
                        userAvatar, 
                        newStreak, 
                        oldStreak, 
                        true
                    );
                }
            }

            // حساب الـ Streak الجديد (إذا مر 24 ساعة بالضبط)
            let newStreak = oldStreak + 1;

            // معالجة المكافأة اليومية
            return await this.processDailyReward(
                interaction, 
                userId, 
                username, 
                userAvatar, 
                newStreak, 
                oldStreak, 
                false
            );

        } catch (error) {
            console.error('Error in daily command:', error);

            const container = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('# ❌ Error\n*Please try again later*')
                );

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },

    // ========== دالة معالجة المكافأة اليومية ==========
    async processDailyReward(interaction, userId, username, userAvatar, newStreak, oldStreak, streakWasBroken) {
        try {
            const now = new Date();

            // ========== 1. حساب المكافآت الأساسية ==========
            const baseCoins = Math.floor(Math.random() * 11) + 15;
            const baseXP = Math.floor(Math.random() * 21) + 20;

            // تطبيق مضاعف الـ streak
            const streakBonus = this.calculateStreakBonus(newStreak);
            let totalCoins = Math.round(baseCoins * streakBonus.bonusMultiplier);
            let totalXP = Math.round(baseXP * streakBonus.bonusMultiplier);

            // فرصة البلورة
            let crystals = 0;
            if (Math.random() * 100 < streakBonus.crystalChance) {
                crystals = 1;
            }

            // ========== 2. إدارة الرولز (بإزالة القديم) ==========
            const roleResult = await this.manageStreakRoles(interaction, newStreak, oldStreak, streakWasBroken);

            // ========== 3. التحقق من الـ Daily Boosts ==========
            let activeBoost = null;
            for (const boost of this.DAILY_BOOSTS) {
                if (newStreak === boost.day) {
                    activeBoost = boost;
                    await this.applyDailyBoost(userId, boost, newStreak);
                    break;
                }
            }

            // ========== 4. تطبيق الـ Boost على المكافأة اليومية ==========
            let boostMultiplier = { xp: 1.0, coins: 1.0 };
            if (activeBoost) {
                boostMultiplier = activeBoost.multiplier;
            }

            const finalCoins = Math.round(
                baseCoins * streakBonus.bonusMultiplier * boostMultiplier.coins
            );

            const finalXP = Math.round(
                baseXP * streakBonus.bonusMultiplier * boostMultiplier.xp
            );

            console.log(`💰 ${username} Daily Calculation (Day ${newStreak}):`);
            console.log(`   Base: ${baseCoins} coins, ${baseXP} XP`);
            console.log(`   Streak Multiplier: ${streakBonus.bonusMultiplier}x`);
            console.log(`   Boost Multiplier: ${boostMultiplier.xp}x XP, ${boostMultiplier.coins}x Coins`);
            console.log(`   Final: ${finalCoins} coins, ${finalXP} XP`);

            // ========== 5. منح الكوبونات ==========
            let streakCoupon = null;
            const couponResult = await this.awardStreakCoupon(userId, username, newStreak, interaction);
            if (couponResult) {
                streakCoupon = couponResult;
            }

            // ========== 6. منح الكريتات ==========
            const crateRewards = await this.awardDailyCrates(userId, username, newStreak);

            // ========== 7. تحديث الداتابيز ==========
            await dbManager.run(
                `UPDATE levels 
                 SET last_daily = ?,
                     daily_streak = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,
                [now.toISOString(), newStreak, userId]
            );

            // استخدام levelSystem للمكافآت النقدية
            await levelSystem.processUserRewards(
                userId,
                username,
                finalXP,
                finalCoins,
                crystals,
                interaction.client,
                interaction.guild,
                'daily',
                true
            );

            // ========== 8. إنشاء الرد ==========
            const currentTier = this.getStreakTier(newStreak);
            const tierName = this.getTierName(currentTier);
            const tierEmoji = this.getTierEmoji(currentTier);
            const tierColor = this.getTierColor(currentTier);

            // الحصول على الرصيد الجديد
            const userData = await dbManager.getUserProfile(userId);
            const newTotalCoins = (userData?.sky_coins || 0) + finalCoins;
            const newTotalCrystals = (userData?.sky_crystals || 0) + crystals;

            // تنسيق الأرقام
            const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formattedNewTotalCoins = formatNumber(newTotalCoins);
            const progressPercentage = Math.min(100, (newStreak / 100) * 100).toFixed(1);

            // إنشاء الـ Container الرئيسي - Section واحد فقط مع الصورة
            const container = new ContainerBuilder()
                .setAccentColor(tierColor)
                .addSectionComponents((section) => {
                    // ========== العنوان ==========
                    let title = `## **Daily Reward | Day ${newStreak}**`;
                    if (streakWasBroken) {
                        title = `## 🔄 **Streak Reset | Day ${newStreak}**`;
                    }
                    section.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(title)
                    );

                    // ========== رسالة التأخير ==========
                    const lastDailyData = userData;
                    const lastClaim = lastDailyData?.last_daily;
                    if (lastClaim && !streakWasBroken) {
                        const hoursSinceLast = (now - new Date(lastClaim)) / (1000 * 60 * 60);
                        if (hoursSinceLast > 24 && hoursSinceLast <= 48) {
                            const lateHours = Math.floor(hoursSinceLast - 24);
                            const lateMinutes = Math.floor((hoursSinceLast - 24 - lateHours) * 60);
                            section.addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`-# ⚠️ Claimed ${lateHours}h ${lateMinutes}m late (48h grace period)`)
                            );
                        }
                    }

                    // ========== المحتوى الرئيسي (كله في Component واحد) ==========
                    let mainContent = '';

                    // ---- المكافآت الأساسية ----
                    mainContent += `<:Coins:1468446651965374534> **+${finalCoins}** | <:XP:1468446751282302976> **+${finalXP}**`;
                    if (crystals > 0) {
                        mainContent += ` | <:Crystal:1468446688338251793> **+${crystals} Crystal${crystals > 1 ? 's' : ''}**`;
                    }
                    mainContent += `\n`;

                    // ---- حالة الـ Streak ----
                    if (streakWasBroken) {
                        mainContent += `⚠️ **Streak broken!** Starting over from day 1\n`;
                    } else if (oldStreak > 0) {
                        mainContent += `-# 🔥 **Streak:** ${newStreak}/100 | `;
                    } else {
                        mainContent += `-# 🔥 **Streak:** ${newStreak}/100 | `;
                    }

                    // ---- Tier ----
                    if (currentTier !== 'none') {
                        mainContent += `🏆 **Tier:** ${tierName}\n`;
                    }

                    // ---- Boost ----
                    if (activeBoost) {
                        mainContent += `### **${activeBoost.message}** (${activeBoost.duration === 0 ? 'Permanent' : `${activeBoost.duration} days`})\n`;
                        mainContent += `**Boosts:**\n`;
                        if (boostMultiplier.xp > 1) {
                            mainContent += `• ⚡ XP Boost: +${Math.round((boostMultiplier.xp - 1) * 100)}%\n`;
                        }
                        if (boostMultiplier.coins > 1) {
                            mainContent += `• 💰 Coin Boost: +${Math.round((boostMultiplier.coins - 1) * 100)}%\n`;
                        }
                        if (streakBonus.bonusMultiplier > 1.0) {
                            mainContent += `• 🔥 Streak Bonus: +${Math.round((streakBonus.bonusMultiplier - 1) * 100)}%\n`;
                        }
                        mainContent += `➠ **Total:** ${(boostMultiplier.xp * streakBonus.bonusMultiplier).toFixed(2)}x <:XP:1468446751282302976> | ${(boostMultiplier.coins * streakBonus.bonusMultiplier).toFixed(2)}x <:Coins:1468446651965374534>\n`;
                    }

                    // ---- الرول ----
                    if (roleResult.roleAdded) {
                        mainContent += `\n🎖️ **${roleResult.roleName} Role Added!**\n`;
                    }

                    // ---- الكوبون ----
                    if (streakCoupon) {
                        mainContent += `\n🎟️ **STREAK COUPON AWARDED!**\n`;
                        mainContent += `${streakCoupon.type.toUpperCase()} Coupon: **${streakCoupon.discountPercentage}**% off\n`;
                        mainContent += `\`${streakCoupon.couponCode}\` | Expires in ${streakCoupon.expiresInDays} days\n`;
                    }

                    // ---- الكريتات ----
                    if (crateRewards.length > 0) {
                        mainContent += `\n**DAILY DROPS AWARDED!**\n`;
                        for (const crate of crateRewards) {
                            const crateEmoji = this.getCrateEmoji(crate.type);
                            // تغيير هنا: capitalize أول حرف فقط
                            const crateType = crate.type.charAt(0).toUpperCase() + crate.type.slice(1).toLowerCase();
                            mainContent += `${crateEmoji} **${crateType} ${crate.count}x**\n`;
                        }
                        mainContent += `-# *Use \`/drops\` to open your crates!*\n`;
                    }

                    // ---- التقدم والرصيد ----
                    mainContent += `\n**Progress:**\n`;
                    mainContent += `-# • **Balance:** ${formattedNewTotalCoins} <:Coins:1468446651965374534> | ${newTotalCrystals} <:Crystal:1468446688338251793>\n`;
                    mainContent += `-# • **Streak Progress:** ${newStreak}/100 days (${progressPercentage}%)`;

                    // إضافة المحتوى الرئيسي في Component واحد
                    section.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(mainContent)
                    );

                    // ========== إضافة الصورة (Thumbnail) ==========
                    return section.setThumbnailAccessory((thumbnail) =>
                        thumbnail
                            .setDescription(`${username}'s daily reward`)
                            .setURL(userAvatar)
                    );
                });

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

            return true;

        } catch (error) {
            console.error('Error processing daily reward:', error);
            return false;
        }
    },

    // ========== HELPER FUNCTIONS ==========

    /**
     * حساب مكافآت الـ streak
     */
    calculateStreakBonus(streak) {
        if (streak <= 2) return { bonusMultiplier: 1.00, crystalChance: 0 };
        if (streak <= 7) return { bonusMultiplier: 1.10, crystalChance: 0.5 };
        if (streak <= 14) return { bonusMultiplier: 1.15, crystalChance: 1.0 };
        if (streak <= 21) return { bonusMultiplier: 1.20, crystalChance: 1.5 };
        if (streak <= 30) return { bonusMultiplier: 1.25, crystalChance: 2.0 };
        if (streak <= 45) return { bonusMultiplier: 1.30, crystalChance: 2.5 };
        if (streak <= 60) return { bonusMultiplier: 1.35, crystalChance: 3.0 };
        if (streak <= 75) return { bonusMultiplier: 1.40, crystalChance: 3.5 };
        if (streak <= 90) return { bonusMultiplier: 1.45, crystalChance: 4.0 };
        return { bonusMultiplier: 1.50, crystalChance: 5.0 };
    },

    /**
     * تحديد الـ Tier بناءً على الـ streak
     */
    getStreakTier(streak) {
        if (streak >= 100) return 'legendary';
        if (streak >= 76) return 'emerald';
        if (streak >= 61) return 'sapphire';
        if (streak >= 46) return 'ruby';
        if (streak >= 31) return 'diamond';
        if (streak >= 22) return 'platinum';
        if (streak >= 15) return 'gold';
        if (streak >= 8) return 'silver';
        if (streak >= 3) return 'bronze';
        return 'none';
    },

    /**
     * الحصول على اسم الـ Tier
     */
    getTierName(tier) {
        const names = {
            'bronze': 'Bronze',
            'silver': 'Silver',
            'gold': 'Gold',
            'platinum': 'Platinum',
            'diamond': 'Diamond',
            'ruby': 'Ruby',
            'sapphire': 'Sapphire',
            'emerald': 'Emerald',
            'legendary': 'Legendary',
            'none': 'None'
        };
        return names[tier] || 'None';
    },

    /**
     * الحصول على أيقونة الـ Tier
     */
    getTierEmoji(tier) {
        const emojis = {
            'bronze': '🎖️',
            'silver': '🥈',
            'gold': '🥇',
            'platinum': '💎',
            'diamond': '💠',
            'ruby': '🔴',
            'sapphire': '🔵',
            'emerald': '🟢',
            'legendary': '🌟',
            'none': '🎁'
        };
        return emojis[tier] || '🎁';
    },

    /**
     * الحصول على أيقونة الكريت
     */
    getCrateEmoji(crateType) {
        const emojis = {
            'common': '📦',
            'rare': '✨',
            'epic': '💎',
            'legendary': '🔥'
        };
        return emojis[crateType] || '🎁';
    },

    /**
     * الحصول على لون الـ Tier
     */
    getTierColor(tier) {
        const colors = {
            'bronze': 0xCD7F32,
            'silver': 0xC0C0C0,
            'gold': 0xFFD700,
            'platinum': 0xE5E4E2,
            'diamond': 0x00FFFF,
            'ruby': 0xFF0000,
            'sapphire': 0x0000FF,
            'emerald': 0x00FF00,
            'legendary': 0xFFD700,
            'none': 0x00FF00
        };
        return colors[tier] || 0x00FF00;
    },

    /**
     * إدارة رولز الـ streak مع إزالة القديم
     */
    async manageStreakRoles(interaction, newStreak, oldStreak, streakWasBroken = false) {
        try {
            const result = {
                roleAdded: false,
                oldRoleRemoved: false,
                roleName: '',
                message: ''
            };

            // إذا كان الستريك اتقطع، نشيل كل الرولز
            if (streakWasBroken) {
                await this.removeAllStreakRoles(interaction);
                result.oldRoleRemoved = true;
                result.message = 'All streak roles removed due to broken streak';
                return result;
            }

            // تحديد الـ Tiers
            const currentTier = this.getStreakTier(newStreak);
            const oldTier = this.getStreakTier(oldStreak);

            // إذا نفس الـ Tier، لا تغيير
            if (currentTier === oldTier) {
                return result;
            }

            // إزالة الرول القديم إذا كان موجوداً
            if (oldTier !== 'none') {
                const oldRole = this.STREAK_ROLES.find(r => r.name.toLowerCase() === oldTier);
                if (oldRole && oldRole.roleId) {
                    await this.removeRole(interaction, oldRole.roleId);
                    result.oldRoleRemoved = true;
                }
            }

            // إضافة الرول الجديد
            if (currentTier !== 'none') {
                const newRole = this.STREAK_ROLES.find(r => r.name.toLowerCase() === currentTier);
                if (newRole && newRole.roleId) {
                    await this.addRole(interaction, newRole.roleId);
                    result.roleAdded = true;
                    result.roleName = newRole.name;

                    // رسالة الترقية
                    if (oldTier === 'none') {
                        result.message = `Promoted to ${newRole.name} Tier`;
                    } else {
                        result.message = `Upgraded to ${newRole.name} Tier`;
                    }
                }
            }

            return result;

        } catch (error) {
            console.error('Error managing streak roles:', error);
            return { error: error.message };
        }
    },

    /**
     * إزالة كل رولز الـ streak
     */
    async removeAllStreakRoles(interaction) {
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) return false;

            let removedCount = 0;
            for (const role of this.STREAK_ROLES) {
                if (role.roleId && member.roles.cache.has(role.roleId)) {
                    const guildRole = await interaction.guild.roles.fetch(role.roleId).catch(() => null);
                    if (guildRole) {
                        await member.roles.remove(guildRole);
                        removedCount++;
                    }
                }
            }

            if (removedCount > 0) {
                console.log(`🗑️ Removed ${removedCount} streak roles from ${member.user.tag}`);
            }

            return removedCount > 0;
        } catch (error) {
            console.error('Error removing all streak roles:', error);
            return false;
        }
    },

    /**
     * إضافة رول للمستخدم
     */
    async addRole(interaction, roleId) {
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) return false;

            const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
            if (!role) return false;

            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(role);
                console.log(`✅ Added role ${role.name} to ${member.user.tag}`);
                return true;
            }

            return true;
        } catch (error) {
            console.error(`Error adding role ${roleId}:`, error.message);
            return false;
        }
    },

    /**
     * إزالة رول من المستخدم
     */
    async removeRole(interaction, roleId) {
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) return false;

            const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
            if (!role) return false;

            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(role);
                console.log(`🗑️ Removed role ${role.name} from ${member.user.tag}`);
                return true;
            }

            return false;
        } catch (error) {
            console.error(`Error removing role ${roleId}:`, error.message);
            return false;
        }
    },

    /**
     * تطبيق الـ Daily Boost
     */
    async applyDailyBoost(userId, boostConfig, streakDay) {
        try {
            let durationMinutes = 0;
            let expiresAt = null;

            if (boostConfig.duration > 0) {
                durationMinutes = boostConfig.duration * 24 * 60;
                expiresAt = new Date(Date.now() + boostConfig.duration * 24 * 60 * 60 * 1000).toISOString();
            } else {
                durationMinutes = 365 * 24 * 60;
                expiresAt = null;
            }

            // ⭐⭐ **مش نستخدم extra_data** ⭐⭐
            // ⭐⭐ **نعمل حيلة:** نستخدم multiplier للXP، وsource_crate_type للcoins ⭐⭐

            // أولاً: نحذف البفز القديمة لو موجودة
            await dbManager.run(
                `DELETE FROM active_buffs 
                 WHERE user_id = ? 
                 AND buff_type IN ('daily_limit_boost', 'coins_limit_boost')`,
                [userId]
            );

            // ثانياً: نضيف daily_limit_boost مع XP multiplier
            await dbManager.run(
                `INSERT INTO active_buffs 
                 (user_id, buff_type, multiplier, duration_minutes, expires_at, source_crate_type)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    'daily_limit_boost',
                    boostConfig.multiplier.xp,  // ⭐⭐ نحفظ XP هنا ⭐⭐
                    durationMinutes,
                    expiresAt,
                    `streak_${streakDay}_coins_${boostConfig.multiplier.coins}`  // ⭐⭐ نحفظ Coins multiplier في source_crate_type ⭐⭐
                ]
            );

            console.log(`✅ Daily Boost for ${userId}: Day ${streakDay}`);
            console.log(`   - XP Multiplier: ${boostConfig.multiplier.xp}x`);
            console.log(`   - Coins Multiplier: ${boostConfig.multiplier.coins}x`);

            return true;
        } catch (error) {
            console.error('Error applying daily boost:', error);
            return false;
        }
    },

    /**
     * منح كوبون streak
     */
    async awardStreakCoupon(userId, username, streakDay, interaction = null) {
        try {
            // التحقق إذا كان اليوم من مضاعفات 10 أو يوم 100
            if (streakDay % 10 !== 0 && streakDay !== 100) return null;

            // إيجاد نوع الكوبون المناسب
            const couponConfig = this.STREAK_COUPONS.find(c => c.day === streakDay);
            if (!couponConfig) return null;

            // ⭐⭐⭐ توليد نسبة تخفيض عشوائية بين min و max ⭐⭐⭐
            let discountPercentage = Math.floor(
                Math.random() * (couponConfig.max - couponConfig.min + 1)
            ) + couponConfig.min;

            discountPercentage = Math.max(5, Math.min(40, discountPercentage));
            
            let couponCode;
            let expiresAt = new Date();
            let validForDays = couponConfig.duration;

            // حساب تاريخ الانتهاء
            if (validForDays > 0) {
                expiresAt.setDate(expiresAt.getDate() + validForDays);
            } else {
                expiresAt.setFullYear(expiresAt.getFullYear() + 100);
                validForDays = 0;
            }

            // توليد كود الكوبون
            couponCode = this.generateCouponCode();

            // محاولة استخدام couponSystem إذا موجود
            let usedCouponSystem = false;

            try {
                if (global.couponSystem && typeof global.couponSystem.createCoupon === 'function') {
                    const result = await global.couponSystem.createCoupon(
                        userId,
                        username,
                        discountPercentage,
                        'streak_reward',
                        {
                            streak_day: streakDay,
                            coupon_type: couponConfig.type,
                            duration_days: validForDays
                        }
                    );

                    if (result && result.success) {
                        couponCode = result.couponCode || couponCode;
                        usedCouponSystem = true;
                        console.log(`✅ Used CouponSystem for ${username}`);
                    }
                }
            } catch (sysError) {
                console.log(`⚠️ CouponSystem error: ${sysError.message}`);
            }

            // حفظ الكوبون في الداتابيز
            await dbManager.run(
                `INSERT INTO shop_coupons 
                 (coupon_code, user_id, username, discount_percentage, 
                  expires_at, source_drop_type, is_used, applicable_item_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    couponCode,
                    userId,
                    username,
                    discountPercentage,
                    expiresAt.toISOString(),
                    `streak_${couponConfig.type}_day${streakDay}`,
                    false,
                    null
                ]
            );

            console.log(`🎫 Streak coupon awarded to ${username} (Day ${streakDay}):`);
            console.log(`   Code: ${couponCode}`);
            console.log(`   Type: ${couponConfig.type}`);
            console.log(`   Discount: ${discountPercentage}%`);
            console.log(`   Duration: ${validForDays > 0 ? `${validForDays} days` : 'Permanent'}`);
            console.log(`   Source: ${usedCouponSystem ? 'CouponSystem' : 'Direct DB'}`);

            return {
                success: true,
                type: couponConfig.type,
                couponCode: couponCode,
                discountPercentage: discountPercentage,
                expiresInDays: validForDays,
                awardedFor: `Day ${streakDay} Streak`,
                isPermanent: validForDays === 0,
                source: usedCouponSystem ? 'coupon_system' : 'daily_streak'
            };

        } catch (error) {
            console.error('❌ Error awarding streak coupon:', error);
            console.error('Error details:', error.stack);
            return null;
        }
    },

    /**
     * توليد كود كوبون عشوائي
     */
    generateCouponCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `STREAK-${code}`;
    },

    /**
     * منح الكريتات اليومية
     */
    async awardDailyCrates(userId, username, streakDay) {
        try {
            const crateRewards = [];

            // حالة خاصة: بعد اليوم 100
            if (streakDay > 100) {
                const randomCrate = this.getRandomPost100Crate();
                if (randomCrate) {
                    for (let i = 0; i < randomCrate.count; i++) {
                        const crateResult = await dbManager.createCrate(userId, username, randomCrate.type);
                        if (crateResult.success) {
                            crateRewards.push({
                                type: randomCrate.type,
                                count: 1,
                                crateId: crateResult.crateId
                            });
                        }
                    }
                }
            } 
            // الأيام العادية
            else {
                const dayCrates = this.STREAK_CRATES.find(c => c.day === streakDay);

                if (dayCrates && dayCrates.crates.length > 0) {
                    for (const crateConfig of dayCrates.crates) {
                        for (let i = 0; i < crateConfig.count; i++) {
                            const crateResult = await dbManager.createCrate(userId, username, crateConfig.type);
                            if (crateResult.success) {
                                const existing = crateRewards.find(r => r.type === crateConfig.type);
                                if (existing) {
                                    existing.count++;
                                } else {
                                    crateRewards.push({
                                        type: crateConfig.type,
                                        count: 1,
                                        crateId: crateResult.crateId
                                    });
                                }
                            }
                        }
                    }
                }
            }

            if (crateRewards.length > 0) {
                console.log(`📦 Awarded ${crateRewards.length} crate types to ${username} (Day ${streakDay})`);
            }

            return crateRewards;

        } catch (error) {
            console.error('Error awarding daily crates:', error);
            return [];
        }
    },

    /**
     * الحصول على كريت عشوائي بعد اليوم 100
     */
    getRandomPost100Crate() {
        const random = Math.random() * 100;
        let cumulative = 0;

        for (const [crateType, chance] of Object.entries(this.POST_100_CRATE_CHANCES)) {
            cumulative += chance;
            if (random <= cumulative) {
                return {
                    type: crateType,
                    count: 1
                };
            }
        }

        return {
            type: 'rare',
            count: 1
        };
    },

    /**
     * توليد كود كوبون عشوائي
     */
    generateCouponCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `STREAK-${code}`;
    }
};