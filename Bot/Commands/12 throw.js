const { 
    SlashCommandBuilder, 
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags 
} = require('discord.js');
const dbManager = require('../Data/database');

const SKYWELL_LEVELS = [
    { level: 0, name: "Beginner", emoji: "🌱", roleId: null },
    { level: 1, name: "Novice Thrower", emoji: "🌿", roleId: "1465705164139794443" },
    { level: 2, name: "Advanced Thrower", emoji: "💧", roleId: "1465705207760556186" },
    { level: 3, name: "Master Thrower", emoji: "🌊", roleId: "1465705232280453283" },
    { level: 4, name: "Well Keeper", emoji: "🌀", roleId: "1465705263209123975" },
    { level: 5, name: "Skywell Legend", emoji: "🌟", roleId: "1465705294234652736" }
];

// ========== LEVEL REQUIREMENTS ==========
const LEVEL_REQUIREMENTS = [
    { level: 0, min: 0, next: 500 },        // من 0 إلى 499
    { level: 1, min: 500, next: 5000 },      // من 500 إلى 4,999
    { level: 2, min: 5000, next: 15000 },    // من 5,000 إلى 14,999
    { level: 3, min: 15000, next: 30000 },   // من 15,000 إلى 29,999
    { level: 4, min: 30000, next: 50000 },   // من 30,000 إلى 49,999
    { level: 5, min: 50000, next: null }     // 50,000+
];

const FIRST_THROW_ROLE_ID = "1465788817196847298";
const MIN_COINS_FOR_THROW = 100;
const MIN_CRYSTALS_FOR_THROW = 1;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('makeawish')
        .setDescription('Throw coins or crystals into the Skywell')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('What to throw?')
                .setRequired(true)
                .addChoices(
                    { name: '🪙 Coins', value: 'coins' },
                    { name: '💎 Crystals', value: 'crystals' }
                ))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to throw')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10000)),

    // دالة مساعدة لحساب معلومات المستوى
    calculateLevelInfo(totalCoins) {
        // تحديد المستوى الحالي
        let currentLevel = 0;
        let nextLevelCoins = 500; // افتراضي للمستوى 0

        for (let i = LEVEL_REQUIREMENTS.length - 1; i >= 0; i--) {
            if (totalCoins >= LEVEL_REQUIREMENTS[i].min) {
                currentLevel = LEVEL_REQUIREMENTS[i].level;
                nextLevelCoins = LEVEL_REQUIREMENTS[i].next;
                break;
            }
        }

        // حساب التقدم إلى المستوى التالي
        let progress = 0;
        let coinsNeeded = 0;
        let coinsProgress = 0;

        if (currentLevel === 5) {
            // ماكس ليفل
            progress = 100;
            coinsNeeded = 0;
            coinsProgress = totalCoins;
        } else {
            const currentRequirement = LEVEL_REQUIREMENTS.find(r => r.level === currentLevel);
            const nextRequirement = LEVEL_REQUIREMENTS.find(r => r.level === currentLevel + 1);

            if (currentRequirement && nextRequirement) {
                const range = nextRequirement.min - currentRequirement.min;
                const current = totalCoins - currentRequirement.min;

                progress = Math.min(100, Math.floor((current / range) * 100));
                coinsNeeded = nextRequirement.min - totalCoins;
                coinsProgress = current;
            }
        }

        return {
            currentLevel,
            nextLevelCoins,
            progress,
            coinsNeeded,
            coinsProgress
        };
    },

    // دالة مساعدة لإنشاء شريط التقدم
    createProgressBar(percentage, length = 15) {
        const filled = Math.floor((percentage / 100) * length);
        const empty = length - filled;
        return ' 🟦'.repeat(filled) + ' ⬛'.repeat(empty);
    },

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            const username = interaction.user.username;
            const userAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
            const type = interaction.options.getString('type');
            const amount = interaction.options.getInteger('amount');

            // التحقق من الحد الأدنى
            if (type === 'coins' && amount < MIN_COINS_FOR_THROW) {
                return await interaction.editReply({
                    content: `❌ Minimum coins to throw is ${MIN_COINS_FOR_THROW.toLocaleString()} <:Coins:1468446651965374534>`,
                    flags: MessageFlags.Ephemeral
                });
            }

            if (type === 'crystals' && amount < MIN_CRYSTALS_FOR_THROW) {
                return await interaction.editReply({
                    content: `❌ Minimum crystals to throw is ${MIN_CRYSTALS_FOR_THROW.toLocaleString()} <:Crystal:1468446688338251793>`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // 1. التحقق من الرصيد
            const userBalance = await dbManager.get(
                'SELECT sky_coins, sky_crystals FROM levels WHERE user_id = $1',
                [userId]
            );

            if (!userBalance) {
                return await interaction.editReply({
                    content: '❌ You need to create an account first!',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (type === 'coins' && userBalance.sky_coins < amount) {
                return await interaction.editReply({
                    content: `❌ Not enough coins! You have ${userBalance.sky_coins} <:Coins:1468446651965374534>`,
                    flags: MessageFlags.Ephemeral
                });
            }

            if (type === 'crystals' && userBalance.sky_crystals < amount) {
                return await interaction.editReply({
                    content: `❌ Not enough crystals! You have ${userBalance.sky_crystals} <:Crystal:1468446688338251793>`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // 2. خصم المبلغ
            if (type === 'coins') {
                await dbManager.run(
                    'UPDATE levels SET sky_coins = sky_coins - $1 WHERE user_id = $2',
                    [amount, userId]
                );
            } else {
                await dbManager.run(
                    'UPDATE levels SET sky_crystals = sky_crystals - $1 WHERE user_id = $2',
                    [amount, userId]
                );
            }

            // 3. تحديث Skywell
            let updateResult;
            let convertedCoins = 0;

            if (type === 'coins') {
                updateResult = await dbManager.updateCoinThrow(userId, amount, username);
            } else {
                updateResult = await dbManager.updateCrystalThrow(userId, amount, username);
                convertedCoins = updateResult.convertedCoins || 0;
            }

            if (!updateResult.success) {
                // استرجاع المبلغ في حالة الخطأ
                if (type === 'coins') {
                    await dbManager.run(
                        'UPDATE levels SET sky_coins = sky_coins + $1 WHERE user_id = $2',
                        [amount, userId]
                    );
                } else {
                    await dbManager.run(
                        'UPDATE levels SET sky_crystals = sky_crystals + $1 WHERE user_id = $2',
                        [amount, userId]
                    );
                }

                return await interaction.editReply({
                    content: '❌ Error updating Skywell.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // 4. جلب البيانات الجديدة من Skywell
            const stats = await dbManager.getSkywellStats(userId);
            if (!stats) {
                return await interaction.editReply({
                    content: '❌ Error getting stats.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const totalEffective = stats.totalEffectiveCoins || 0;

            // 5. حساب معلومات المستوى باستخدام الدالة الجديدة
            const levelInfo = this.calculateLevelInfo(totalEffective);
            const newLevel = levelInfo.currentLevel;
            const oldLevel = stats.current_level || 0;

            console.log(`📊 Level check: Old=${oldLevel}, New=${newLevel}, Total=${totalEffective}`);

            // 6. تحديث المستوى لو ارتفع
            let levelUp = false;
            let levelInfoData = null;

            if (newLevel > oldLevel) {
                levelUp = true;
                levelInfoData = SKYWELL_LEVELS.find(l => l.level === newLevel);

                console.log(`🎯 Level UP! Updating to ${newLevel} with role ${levelInfoData?.roleId}`);

                await dbManager.updateSkywellLevel(
                    userId, 
                    newLevel, 
                    levelInfoData?.roleId || null
                );

                const freshStats = await dbManager.getSkywellStats(userId);
                console.log(`✅ Verified - New level in DB: ${freshStats?.current_level}`);
            }

            // 7. تطبيق الرول الصحيح
            try {
                const member = await interaction.guild.members.fetch(userId);
                const currentLevelInfo = SKYWELL_LEVELS.find(l => l.level === newLevel);

                if (currentLevelInfo?.roleId) {
                    // إزالة كل رولات Skywell القديمة
                    for (const level of SKYWELL_LEVELS) {
                        if (level.roleId && level.roleId !== currentLevelInfo.roleId && member.roles.cache.has(level.roleId)) {
                            await member.roles.remove(level.roleId).catch(e => console.error(`Error removing role ${level.roleId}:`, e));
                        }
                    }

                    // إضافة الرول الجديد إذا مش موجود
                    if (!member.roles.cache.has(currentLevelInfo.roleId)) {
                        await member.roles.add(currentLevelInfo.roleId).catch(e => console.error(`Error adding role ${currentLevelInfo.roleId}:`, e));
                    }
                }
            } catch (error) {
                console.error('Error updating roles:', error);
            }

            // 8. بيانات العرض
            const throwCount = stats.throw_count || 0;
            const progressBar = this.createProgressBar(levelInfo.progress);
            const currentLevelInfo = SKYWELL_LEVELS.find(l => l.level === newLevel);

            // 9. إنشاء الرد
            const container = new ContainerBuilder()
                .setAccentColor(type === 'coins' ? 0xF1C40F : 0x9B59B6);

            // المحتوى الرئيسي
            let sectionContent = `### **${username}** → ${amount.toLocaleString()} ${type === 'coins' ? '<:Coins:1468446651965374534> into the well' : '<:Crystal:1468446688338251793> into Skywell'}`;

            if (type === 'crystals' && convertedCoins > 0) {
                sectionContent += `\n\n<:Crystal:1468446688338251793> Bonus from Crystals: +${convertedCoins.toLocaleString()} <:Coins:1468446651965374534>`;
            }

            sectionContent += `\n\nTotal Tossed: ${totalEffective.toLocaleString()} <:Coins:1468446651965374534>`;

            container.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(sectionContent)
            );

            container.addSeparatorComponents((separator) => separator);

            // معلومات المستوى التالي (إذا كان أقل من 5)
            if (newLevel < 5) {
                const nextLevelInfo = SKYWELL_LEVELS.find(l => l.level === newLevel + 1);

                // عرض المطلوب للوصول للمستوى التالي
                const neededForNext = levelInfo.coinsNeeded;

                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`⏳ Next Level: ${nextLevelInfo?.name || `Level ${newLevel + 1}`} (${neededForNext.toLocaleString()} <:Coins:1468446651965374534> needed)`)
                );

                // نسبة التقدم
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`-# ${levelInfo.progress}% Complete (${levelInfo.coinsProgress.toLocaleString()}/${(LEVEL_REQUIREMENTS.find(r => r.level === newLevel + 1)?.min || 0).toLocaleString()})`)
                );

                // شريط التقدم
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(progressBar)
                );

                container.addSeparatorComponents((separator) => separator);
            } else {
                // للمستوى 5 (ماكس)
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`✨ **MAX LEVEL REACHED!** ✨`)
                );
                container.addSeparatorComponents((separator) => separator);
            }

            // معلومات المستوى والرمية
            container.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(`-# ${currentLevelInfo?.emoji || '🌱'} Level ${newLevel} | Throw #${throwCount} | Highest ${stats.highest_single_throw?.toLocaleString() || 0} <:Coins:1468446651965374534>`)
            );

            if (levelUp) {
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`-# **LEVEL UP!** ➠ ${currentLevelInfo?.name || 'New Level'}`)
                );
            }

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error('Error in throw command:', error);

            const errorContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('# ❌ Error\n*An error occurred while processing your throw*')
                );

            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};