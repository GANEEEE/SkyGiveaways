const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    SectionBuilder, 
    SeparatorBuilder, 
    TextDisplayBuilder,
    MessageFlags 
} = require('discord.js');
const dbManager = require('../Data/database');
const levelSystem = require('../LevelSystem/levelsystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly')
        .setDescription('Claim your weekly rewards!')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('View another user\'s weekly status (optional)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            // تحديد المستخدم المستهدف
            let targetUser = interaction.options.getUser('user');
            const isSelf = !targetUser || targetUser.id === interaction.user.id;

            if (!targetUser) {
                targetUser = interaction.user; // إذا لم يتم تحديد مستخدم، استخدم المستخدم الحالي
            }

            const userId = targetUser.id;
            const username = targetUser.username;
            const userAvatar = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
            const now = new Date();

            await interaction.deferReply();

            // الحصول على بيانات المستخدم المستهدف
            const userData = await dbManager.get(`SELECT * FROM levels WHERE user_id = ?`, [userId]);

            // إذا كان المستخدم يبحث عن مستخدم آخر
            if (!isSelf) {
                if (!userData) {
                    // إذا لم يجد بيانات المستخدم
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF9900)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents(
                                    (textDisplay) =>
                                        textDisplay.setContent(`# 📭 ${username}'s Weekly Status`)
                                )
                                .setThumbnailAccessory((thumbnail) =>
                                    thumbnail
                                        .setDescription(`${username}'s profile`)
                                        .setURL(userAvatar)
                                )
                        )
                        .addSeparatorComponents((separator) => separator)
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(`*${username} doesn't have a profile yet.*\n*They need to use \`/weekly\` to get started.*`)
                        );

                    return await interaction.editReply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2
                    });
                }

                // عرض حالة الأسبوع للمستخدم الآخر
                const lastWeekly = userData.last_weekly ? new Date(userData.last_weekly) : null;
                const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                const formattedCoins = formatNumber(userData.sky_coins || 0);
                const currentStreak = userData.weekly_streak || 0;

                let container;

                if (!lastWeekly) {
                    // لم يحصل على مكافأة أسبوعية من قبل
                    container = new ContainerBuilder()
                        .setAccentColor(0x00AAFF)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents(
                                    (textDisplay) =>
                                        textDisplay.setContent(`## 🎯 ${username}'s Weekly Status`)
                                )
                                .setThumbnailAccessory((thumbnail) =>
                                    thumbnail
                                        .setDescription(`${username}'s weekly status`)
                                        .setURL(userAvatar)
                                )
                        )
                        .addSeparatorComponents((separator) => separator)
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(`<:Coins:1468446651965374534> **Coins:** \`${formattedCoins}\``)
                        )
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(`🔥 **Weekly Streak:** \`${currentStreak} weeks\``)
                        )
                        .addSeparatorComponents((separator) => separator)
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(`*${username} hasn't claimed their first weekly reward yet.*`)
                        );
                } else {
                    // حساب الوقت المتبقي
                    const nextClaimTime = new Date(lastWeekly.getTime() + (7 * 24 * 60 * 60 * 1000));
                    const timeDiff = nextClaimTime - now;

                    if (timeDiff > 0) {
                        // لا يزال في فترة التبريد
                        const timeLeft = Math.floor(timeDiff / 1000);
                        const totalCooldown = 7 * 24 * 60 * 60;
                        const elapsedTime = totalCooldown - timeLeft;
                        const progressPercentage = Math.round((elapsedTime / totalCooldown) * 100);

                        // إنشاء شريط التقدم (15 مربع كما طلبت)
                        const progressBarLength = 15;
                        const filledBlocks = Math.floor((progressPercentage / 100) * progressBarLength);
                        const emptyBlocks = progressBarLength - filledBlocks;

                        let progressBar = '';
                        for (let i = 0; i < filledBlocks; i++) progressBar += ' 🟦';
                        for (let i = 0; i < emptyBlocks; i++) progressBar += ' ⬛';

                        // حساب الوقت المتبقي
                        const days = Math.floor(timeLeft / (24 * 3600));
                        const hours = Math.floor((timeLeft % (24 * 3600)) / 3600);
                        const minutes = Math.floor((timeLeft % 3600) / 60);

                        let timeString = '';
                        if (days > 0) timeString += `${days} day${days !== 1 ? 's' : ''} `;
                        if (hours > 0) timeString += `${hours} hour${hours !== 1 ? 's' : ''} `;
                        if (minutes > 0 && days === 0) timeString += `${minutes} minute${minutes !== 1 ? 's' : ''}`;

                        container = new ContainerBuilder()
                            .setAccentColor(0xFF9900)
                            .addSectionComponents((section) =>
                                section
                                    .addTextDisplayComponents(
                                        (textDisplay) =>
                                            textDisplay.setContent(`## ⏳ ${username}'s Weekly Status`)
                                    )
                                    .setThumbnailAccessory((thumbnail) =>
                                        thumbnail
                                            .setDescription(`${username}'s cooldown`)
                                            .setURL(userAvatar)
                                    )
                            )
                            .addSeparatorComponents((separator) => separator)
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`<:Coins:1468446651965374534> **Coins:** \`${formattedCoins}\` | 🔥 **Streak:** \`${currentStreak} weeks\``)
                            )
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`⏰ **Next Weekly In:** \`${timeString.trim() || 'Ready!'}\``)
                            )
                            .addSeparatorComponents((separator) => separator)
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`### ⌛ ${progressPercentage}% Complete`)
                            )
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`${progressBar}`)
                            )
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`*Last claimed: <t:${Math.floor(lastWeekly.getTime() / 1000)}:R>*`)
                            );
                    } else {
                        // جاهز للمطالبة
                        container = new ContainerBuilder()
                            .setAccentColor(0x00AAFF)
                            .addSectionComponents((section) =>
                                section
                                    .addTextDisplayComponents(
                                        (textDisplay) =>
                                            textDisplay.setContent(`## ✅ ${username}'s Weekly Status`)
                                    )
                                    .setThumbnailAccessory((thumbnail) =>
                                        thumbnail
                                            .setDescription(`${username}'s weekly`)
                                            .setURL(userAvatar)
                                    )
                            )
                            .addSeparatorComponents((separator) => separator)
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`<:Coins:1468446651965374534> **Coins:** \`${formattedCoins}\` | 🔥 **Streak:** \`${currentStreak} weeks\``)
                            )
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`🎯 **Ready to claim weekly reward!**`)
                            )
                            .addSeparatorComponents((separator) => separator)
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`*${username} can claim their weekly reward now!*`)
                            );
                    }
                }

                return await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            // إذا كان المستخدم نفسه
            if (!userData) {
                // أول مرة للمستخدم - إنشاء ملف شخصي
                const initialCoins = 100;
                const initialXP = 50;

                // 1. التأكد من وجود المستخدم
                await dbManager.ensureUserExists(userId, username);

                // 2. تحديث weekly_streak و last_weekly فقط
                await dbManager.run(
                    `UPDATE levels 
                     SET last_weekly = ?,
                         weekly_streak = 1,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = ?`,
                    [now.toISOString(), userId]
                );

                // 3. استخدام levelSystem للمكافآت
                await levelSystem.processUserRewards(
                    userId,
                    username,
                    initialXP,        // XP
                    initialCoins,     // Coins
                    0,               // Crystals
                    interaction.client,
                    interaction.guild,
                    'other',         // نوع المكافأة
                    true             // بدون daily limits
                );

                const newTotalCoins = initialCoins;
                const newTotalXP = initialXP;

                const container = new ContainerBuilder()
                    .setAccentColor(0x00AAFF)
                    .addSectionComponents((section) =>
                        section
                            .addTextDisplayComponents(
                                (textDisplay) =>
                                    textDisplay.setContent(`## First Weekly Reward!`)
                            )
                            .setThumbnailAccessory((thumbnail) =>
                                thumbnail
                                    .setDescription(`${username}'s first weekly`)
                                    .setURL(userAvatar)
                            )
                    )
                    .addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`**+${initialCoins} <:Coins:1468446651965374534> | +${initialXP} <:XP:1468446751282302976> | 🔥 Weekly Streak: 1**`)
                    )
                    .addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`*Balance: ${newTotalCoins} <:Coins:1468446651965374534>*`)
                    );

                return await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            // التحقق من آخر مرة تم فيها المطالبة
            const lastWeekly = userData.last_weekly ? new Date(userData.last_weekly) : null;
            let canClaim = true;
            let timeLeft = 0;

            if (lastWeekly) {
                const timeDiff = now - lastWeekly;
                const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

                if (daysDiff < 7) {
                    canClaim = false;
                    timeLeft = Math.floor((lastWeekly.getTime() + (7 * 24 * 60 * 60 * 1000) - now) / 1000);
                }
            }

            if (!canClaim) {
                const nextClaimTime = new Date(lastWeekly.getTime() + (7 * 24 * 60 * 60 * 1000));

                // حساب التقدم بالنسبة المئوية
                const totalCooldown = 7 * 24 * 60 * 60;
                const elapsedTime = totalCooldown - timeLeft;
                const progressPercentage = Math.round((elapsedTime / totalCooldown) * 100);

                // إنشاء شريط التقدم (15 مربع كما طلبت)
                const progressBarLength = 15;
                const filledBlocks = Math.floor((progressPercentage / 100) * progressBarLength);
                const emptyBlocks = progressBarLength - filledBlocks;

                let progressBar = '';
                for (let i = 0; i < filledBlocks; i++) progressBar += ' 🟦';
                for (let i = 0; i < emptyBlocks; i++) progressBar += ' ⬛';

                // حساب الوقت المتبقي
                const days = Math.floor(timeLeft / (24 * 3600));
                const hours = Math.floor((timeLeft % (24 * 3600)) / 3600);
                const minutes = Math.floor((timeLeft % 3600) / 60);

                let timeString = '';
                if (days > 0) timeString += `${days} day${days !== 1 ? 's' : ''} `;
                if (hours > 0) timeString += `${hours} hour${hours !== 1 ? 's' : ''} `;
                if (minutes > 0 && days === 0) timeString += `${minutes} minute${minutes !== 1 ? 's' : ''}`;

                // تنسيق الأرقام بفواصل
                const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                const formattedCoins = formatNumber(userData.sky_coins || 0);
                const currentStreak = userData.weekly_streak || 0;

                // إنشاء الـ Container للـ Cooldown
                const container = new ContainerBuilder()
                    .setAccentColor(0xFF9900)
                    .addSectionComponents((section) =>
                        section
                            .addTextDisplayComponents(
                                (textDisplay) =>
                                    textDisplay.setContent(`## ⏳ Weekly Reward Locked`),
                                (textDisplay) =>
                                    textDisplay.setContent(`<:Coins:1468446651965374534> Coins: \`${formattedCoins}\` | 🔥 Streak: \`${currentStreak} weeks\``),
                                (textDisplay) =>
                                    textDisplay.setContent(`⏰ **Next Weekly In:** \`${timeString.trim() || 'Ready!'}\``)
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

                // إضافة نص بناءً على النسبة المئوية (تم إزالة الجزء المطلوب إزالته)
                let progressText = '';
                if (progressPercentage >= 90) {
                    progressText = '-# Almost ready! Your weekly reward is coming soon';
                }
                // تم إزالة: '⏳ Just started — keep going for your weekly bonus'

                if (progressText) {
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`*${progressText}*`)
                    );
                }

                return await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            // حساب الـ Streak الأسبوعي الجديد
            let newWeeklyStreak = userData.weekly_streak || 0;
            let streakStatus = '';

            if (lastWeekly) {
                const timeDiff = now - lastWeekly;
                const weeksDiff = timeDiff / (1000 * 60 * 60 * 24 * 7);

                if (weeksDiff >= 2) {
                    // تم كسر الـ Streak
                    newWeeklyStreak = 1;
                    streakStatus = '⚠️ Weekly Streak Reset, Claim weekly to build bonuses';
                } else if (weeksDiff >= 1) {
                    // استمرارية الـ Streak
                    const oldStreak = newWeeklyStreak;
                    newWeeklyStreak += 1;
                    if (newWeeklyStreak > oldStreak) {
                        streakStatus = `🔥 Weekly Streak Increased & Bonus boosted`;
                    }
                }
            } else {
                // أول مرة
                newWeeklyStreak = 1;
            }

            // توليد المكافآت الأسبوعية
            const baseCoins = Math.floor(Math.random() * 61) + 80; // 80-140
            const baseXP = Math.floor(Math.random() * 31) + 40; // 40-70

            // تطبيق مكافأة الـ Streak (5% لكل أسبوع، أقصى 15%)
            const streakBonus = Math.min(newWeeklyStreak, 3);
            const coinBonusMultiplier = 1 + (streakBonus * 0.05);
            const totalCoins = Math.round(baseCoins * coinBonusMultiplier);

            // فرصة الحصول على Crystals
            const crystalChance = 20 + (streakBonus * 2);
            let crystals = 0;

            if (Math.random() * 100 < crystalChance) {
                crystals = Math.random() < 0.3 ? 2 : 1;
            }

            // تحديث بيانات المستخدم
            // 1. تحديث last_weekly و weekly_streak فقط
            await dbManager.run(
                `UPDATE levels 
                 SET last_weekly = ?,
                     weekly_streak = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,
                [now.toISOString(), newWeeklyStreak, userId]
            );

            // 2. استخدام levelSystem للمكافآت
            await levelSystem.processUserRewards(
                userId,
                username,
                baseXP,          // XP
                totalCoins,      // Coins
                crystals,        // Crystals
                interaction.client,
                interaction.guild,
                'weekly',         // نوع المكافأة
                true             // بدون daily limits
            );

            // حساب الإجمالي الجديد
            const newTotalCoins = (userData.sky_coins || 0) + totalCoins;
            const newTotalCrystals = (userData.sky_crystals || 0) + crystals;

            // تنسيق الأرقام بفواصل
            const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formattedNewTotalCoins = formatNumber(newTotalCoins);

            // إنشاء الـ Container للمكافأة
            const container = new ContainerBuilder()
                .setAccentColor(0x00AAFF)
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents(
                            (textDisplay) =>
                                textDisplay.setContent(`## ✅ Weekly Reward Claimed`),
                            (textDisplay) =>
                                textDisplay.setContent(`**Rewards**`),
                            (textDisplay) =>
                                textDisplay.setContent(`<:Coins:1468446651965374534> Coins: +${totalCoins} | <:XP:1468446751282302976>: +${baseXP}\n🔥 Streak: ${newWeeklyStreak} weeks`)
                        )
                        .setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription(`${username}'s weekly reward`)
                                .setURL(userAvatar)
                        )
                );

                container.addSeparatorComponents((separator) => separator)
                    .addTextDisplayComponents(
                        (textDisplay) =>
                            textDisplay.setContent(`**Crystals**`),
                        (textDisplay) =>
                            textDisplay.setContent(`+${crystals} <:Crystal:1468446688338251793> Crystal${crystals > 1 ? 's' : ''} | ${crystalChance}% Luck`)
                    );

                container.addSeparatorComponents((separator) => separator)
                    .addTextDisplayComponents(
                        (textDisplay) =>
                            textDisplay.setContent(`**Bonuses**`),
                        (textDisplay) =>
                            textDisplay.setContent(`🔥 Streak Bonus: +${streakBonus * 5}% Coins\n<:Crystal:1468446688338251793> Crystal Chance: +${streakBonus * 2}%`)
                    );

                // Progress section with conditions
            if (streakStatus || newWeeklyStreak >= 4) {
                container.addSeparatorComponents((separator) => separator);

                const textComponents = [(textDisplay) => textDisplay.setContent(`**Progress**`)];

                if (streakStatus) {
                    textComponents.push((textDisplay) => textDisplay.setContent(`-# ${streakStatus}`));
                }

                if (newWeeklyStreak >= 4) {
                    textComponents.push((textDisplay) => textDisplay.setContent(`-# 🌟 ${newWeeklyStreak} CONSECUTIVE WEEKS! Amazing dedication!`));
                }

                container.addTextDisplayComponents(...textComponents);
            }

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error('Error in weekly command:', error);

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
    }
};