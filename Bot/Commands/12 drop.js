const {
    SlashCommandBuilder,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    TextDisplayBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const dbManager = require('../Data/database');
const levelSystem = require('../LevelSystem/levelsystem');

// ✅ Buff Role IDs
const BUFF_ROLES = {
    double_xp:    '1465704728779296940',
    double_coins: '1465704922656936021',
    double_luck:  '1465704959491444747'
};

// تخزين عمليات فتح الكريت الحالية
const pendingBuffDecisions = new Map();

// ✅ منع فتح نفس الكريت مرتين في نفس الوقت
const processingCrates = new Map();

function cleanupOldDecisions() {
    const now = Date.now();
    const ONE_MINUTE = 60 * 1000;

    for (const [userId, decision] of pendingBuffDecisions.entries()) {
        if (decision.timestamp && (now - decision.timestamp > ONE_MINUTE)) {
            console.log(`🧹 Cleaning up old buff decision for user ${userId}`);
            pendingBuffDecisions.delete(userId);
        }
    }

    for (const [lockKey, timestamp] of processingCrates.entries()) {
        if (now - timestamp > 30 * 1000) {
            console.log(`🧹 Cleaning up stale crate lock: ${lockKey}`);
            processingCrates.delete(lockKey);
        }
    }
}

setInterval(cleanupOldDecisions, 60000);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('drops')
        .setDescription('View and open your drop crates'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            await this.createOrUpdateDropsInterface(interaction, null, null, true);
        } catch (error) {
            console.error('Error in /drops command:', error);

            const errorContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('❌ An error occurred while displaying your drops.')
                );

            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },

    async createOrUpdateDropsInterface(interaction, resultMessage = null, buffData = null, isNew = false) {
        const userId = interaction.user.id;

        try {
            const userActiveBuffs = await dbManager.getUserActiveBuffs(userId);
            const cratesData = await dbManager.getUserCrates(userId, { unusedOnly: true });
            const dropStats = await dbManager.getDropStats(userId);

            const container = await this.buildDropsContainer(
                userActiveBuffs || [],
                cratesData || { crates: [] },
                dropStats || { drops: {} },
                interaction.user,
                interaction.guild,
                resultMessage,
                buffData
            );

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error('Error in createOrUpdateDropsInterface:', error);
            throw error;
        }
    },

    async buttonHandler(interaction) {
        const userId = interaction.user.id;

        try {
            await interaction.deferUpdate();

            // ✅ حالة قبول البف
            if (interaction.customId === 'buff_accept') {
                const buffDecision = pendingBuffDecisions.get(userId);
                if (!buffDecision) {
                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent('❌ Buff decision expired.')
                        );

                    await interaction.editReply({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                    return;
                }

                try {
                    const { buffType, durationMinutes, crateId, crateType, rewards } = buffDecision;

                    // ✅ جيب الـ roleId من BUFF_ROLES
                    const roleId = BUFF_ROLES[buffType] || null;

                    // ✅ استخدم addActiveBuff مع تمرير client و guildId و roleId
                    await dbManager.addActiveBuff(
                        userId,
                        buffType,
                        durationMinutes,
                        crateType,
                        crateId,
                        interaction.client,
                        process.env.GUILD_ID,
                        roleId
                    );

                    // ✅ دي الـ Role فوراً
                    if (roleId) {
                        try {
                            const member = await interaction.guild.members.fetch(userId).catch(() => null);
                            if (member && !member.roles.cache.has(roleId)) {
                                await member.roles.add(roleId);
                                console.log(`🟢 Gave ${buffType} role to ${userId}`);
                            }
                        } catch (err) {
                            console.error(`❌ Error giving role:`, err.message);
                        }
                    }

                    pendingBuffDecisions.delete(userId);

                    const userActiveBuffs = await dbManager.getUserActiveBuffs(userId);

                    const ALLOWED_BUFF = 'daily_limit_boost';
                    const hasBlockingBuff = userActiveBuffs &&
                        userActiveBuffs.some(buff => buff.buff_type !== ALLOWED_BUFF);

                    let buffsContent = '';
                    if (hasBlockingBuff) {
                        const blockingBuffs = userActiveBuffs.filter(buff => buff.buff_type !== ALLOWED_BUFF);
                        buffsContent += '**Blocking Buffs:**\n';
                        blockingBuffs.forEach((buff, index) => {
                            if (buff && buff.buff_type) {
                                const buffName = formatBuffName(buff.buff_type);
                                const expiresAt = buff.expires_at ? new Date(buff.expires_at) : null;
                                let expiresIn = 'Unknown';
                                if (expiresAt) {
                                    const secondsLeft = Math.max(0, Math.floor((expiresAt - new Date()) / 1000));
                                    expiresIn = formatTime(secondsLeft);
                                }
                                buffsContent += `**${buffName}** | **⏳ ${expiresIn}**`;
                                if (index < blockingBuffs.length - 1) buffsContent += '\n';
                            }
                        });
                    }

                    const acceptMessage = hasBlockingBuff ?
                        `## ✅ Buff Accepted!\n\n${buffsContent}` :
                        `## ✅ Buff Accepted!\n\n-# **You can still open crates with active boosts!**`;

                    await this.createOrUpdateDropsInterface(interaction, acceptMessage, null, false);

                } catch (dbError) {
                    console.error('Database error in accept_buff:', dbError);

                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent('❌ An error occurred while saving the buff.')
                        );

                    await interaction.editReply({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
            // ✅ حالة رفض البف
            else if (interaction.customId === 'buff_reject') {
                const buffDecision = pendingBuffDecisions.get(userId);

                console.log(`❌ Reject buff - User: ${userId}, Decision exists: ${!!buffDecision}`);

                if (!buffDecision) {
                    console.log(`❌ No buff decision found for user ${userId}, returning to main drops`);
                    try {
                        await this.createOrUpdateDropsInterface(interaction, null, null, false);
                        return;
                    } catch (error) {
                        console.error('Error returning to main drops:', error);

                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xFF0000)
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent('❌ Buff already processed. Returning to drops.')
                            );

                        await interaction.editReply({
                            components: [errorContainer],
                            flags: MessageFlags.IsComponentsV2
                        });
                    }
                    return;
                }

                try {
                    const { buffType, durationMinutes, crateType, rewards } = buffDecision;

                    console.log(`❌ Processing reject buff - Buff: ${buffType}`);

                    pendingBuffDecisions.delete(userId);

                    if (rewards?.coins > 0 || rewards?.xp > 0 || rewards?.crystals > 0) {
                        await levelSystem.processUserRewards(
                            userId, '', rewards.xp || 0, rewards.coins || 0, rewards.crystals || 0,
                            null, null, 'drop', true
                        );
                    }

                    if (rewards?.coins > 0) {
                        try {
                            await dbManager.updateGoalProgress(userId, 'drop_coins', rewards.coins);
                        } catch (missionError) {
                            console.error('Error updating mission:', missionError.message);
                        }
                    }

                    let rewardsContent = '';
                    if (rewards?.coins > 0) rewardsContent += `**${rewards.coins} <:Coins:1468446651965374534> Coins** added\n`;
                    if (rewards?.xp > 0) rewardsContent += `**${rewards.xp} <:XP:1468446751282302976>** added\n`;
                    if (rewards?.crystals > 0) rewardsContent += `**${rewards.crystals} <:Crystal:1468446688338251793> Crystals** added\n`;

                    const rejectMessage = `## ❌ Buff Rejected!\n\n${rewardsContent}\n*Buff has been rejected*`;

                    await this.createOrUpdateDropsInterface(interaction, rejectMessage, null, false);

                } catch (error) {
                    console.error('Error updating interface after reject:', error);
                    try {
                        await this.createOrUpdateDropsInterface(interaction, null, null, false);
                    } catch (retryError) {
                        console.error('Could not return to main drops:', retryError);
                    }
                }
            }
            // ✅ حالة فتح الكريت
            else if (interaction.customId.startsWith('open_crate_')) {
                const parts = interaction.customId.split('_');
                const crateId = parts[2];
                const crateType = parts[3];

                const lockKey = `${userId}_${crateId}`;
                if (processingCrates.has(lockKey)) {
                    console.log(`⚠️ Crate ${crateId} already being processed for user ${userId}`);
                    return;
                }
                processingCrates.set(lockKey, Date.now());

                try {
                    const crateExists = await dbManager.get(
                        `SELECT id FROM user_crates WHERE id = ? AND user_id = ? AND is_used = false`,
                        [crateId, userId]
                    );

                    if (!crateExists) {
                        console.log(`⚠️ Crate ${crateId} not found or already opened, refreshing UI silently`);
                        processingCrates.delete(lockKey);
                        await this.createOrUpdateDropsInterface(interaction, null, null, false);
                        return;
                    }

                    const userActiveBuffs = await dbManager.getUserActiveBuffs(userId);

                    const ALLOWED_BUFF = 'daily_limit_boost';
                    const hasBlockingBuff = userActiveBuffs &&
                        userActiveBuffs.some(buff => buff.buff_type !== ALLOWED_BUFF);

                    if (hasBlockingBuff) {
                        const blockingBuffs = userActiveBuffs.filter(buff => buff.buff_type !== ALLOWED_BUFF);

                        let buffsContent = '**Blocking Buffs:**\n';
                        blockingBuffs.forEach((buff, index) => {
                            if (buff && buff.buff_type) {
                                const buffName = formatBuffName(buff.buff_type);
                                const expiresAt = buff.expires_at ? new Date(buff.expires_at) : null;
                                let expiresIn = 'Unknown';
                                if (expiresAt) {
                                    const secondsLeft = Math.max(0, Math.floor((expiresAt - new Date()) / 1000));
                                    expiresIn = formatTime(secondsLeft);
                                }
                                buffsContent += `**${buffName}** | **⏳ ${expiresIn}**`;
                                if (index < blockingBuffs.length - 1) buffsContent += '\n';
                            }
                        });

                        processingCrates.delete(lockKey);

                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xFFA500)
                            .addSectionComponents((section) =>
                                section
                                    .addTextDisplayComponents((textDisplay) =>
                                        textDisplay.setContent(
                                            `## ⚠️ Cannot Open Crates\n\n${buffsContent}\n\n❌ **You cannot open crates with these blocking buffs!**`
                                        )
                                    )
                                    .setThumbnailAccessory((thumbnail) =>
                                        thumbnail
                                            .setDescription('Blocking Buffs Warning')
                                            .setURL('https://i.imgur.com/w3duR07.png')
                                    )
                            );

                        await interaction.editReply({
                            components: [errorContainer],
                            flags: MessageFlags.IsComponentsV2
                        });
                        return;
                    }

                    const openResult = await this.openUserCrate(crateId, userId, crateType);
                    processingCrates.delete(lockKey);

                    if (!openResult.success) {
                        if (openResult.code === 'CRATE_NOT_FOUND' || openResult.code === 'CRATE_ALREADY_USED') {
                            console.log(`⚠️ Crate issue (${openResult.code}), refreshing UI silently`);
                            await this.createOrUpdateDropsInterface(interaction, null, null, false);
                            return;
                        }

                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xFF0000)
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`❌ Failed to open crate: ${openResult.error}`)
                            );

                        await interaction.editReply({
                            components: [errorContainer],
                            flags: MessageFlags.IsComponentsV2
                        });
                        return;
                    }

                    const rewards = openResult.crate.rewards;
                    let rewardsContent = '';

                    if (rewards.coins > 0) {
                        await dbManager.updateGoalProgress(userId, 'total_coins', rewards.coins);
                        console.log(`📊 Updated Reward Collector: +${rewards.coins} coins`);
                    }

                    if (rewards.coins > 0) rewardsContent += `**${rewards.coins} <:Coins:1468446651965374534> Coins** Claimed\n`;
                    if (rewards.xp > 0) rewardsContent += `**${rewards.xp} <:XP:1468446751282302976>** Claimed\n`;
                    if (rewards.crystals > 0) rewardsContent += `**${rewards.crystals} <:Crystal:1468446688338251793> Crystals** Claimed\n`;

                    if (openResult.coupon) {
                        const coupon = openResult.coupon;
                        const now = new Date();
                        const expiresAt = new Date(coupon.expires_at);
                        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

                        rewardsContent += `\n🎟️ **Bonus Coupon:** \`${coupon.code}\`\n`;
                        rewardsContent += `   • **Discount:** ${coupon.discount}% OFF\n`;
                        rewardsContent += `   • **Valid for:** ${daysLeft} days\n`;
                        rewardsContent += `   • **Use with:** /shop command`;
                    }

                    if (openResult.buff) {
                        pendingBuffDecisions.set(userId, {
                            buffType: openResult.buff.type,
                            durationMinutes: openResult.buff.duration,
                            crateId: crateId,
                            crateType: crateType,
                            rewards: rewards,
                            coupon: openResult.coupon,
                            timestamp: Date.now()
                        });

                        console.log(`💾 Saved buff decision for user ${userId}`);

                        const buffDecisionContainer = this.buildBuffDecisionContainer(
                            `## You opened a ${crateType} drop!\n\n${rewardsContent}\n\n✨ **Buff Found:** ${formatBuffName(openResult.buff.type)} (${openResult.buff.duration} minutes)\n\n**Would you like to accept this buff?**`,
                            interaction.user
                        );

                        await interaction.editReply({
                            components: [buffDecisionContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                    } else {
                        let successMessage = `## You opened a ${crateType} drop!\n\n${rewardsContent}\n`;

                        if (openResult.coupon) {
                            successMessage += `\n💡 **Tip:** Use your coupon in the shop with \`/shop\` command!`;
                        }

                        await this.createOrUpdateDropsInterface(interaction, successMessage, null, false);
                    }

                } catch (error) {
                    processingCrates.delete(lockKey);
                    console.error('Error opening crate:', error);

                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent('❌ An error occurred while opening the crate.')
                        );

                    await interaction.editReply({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }

        } catch (error) {
            console.error('Error in drops buttonHandler:', error);

            const errorContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('❌ Error processing button click.')
                );

            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },

    buildBuffDecisionContainer(resultMessage, user) {
        const userAvatar = user.displayAvatarURL({ extension: 'png', size: 256 });
        const container = new ContainerBuilder().setAccentColor(0x5865F2);

        console.log(`📝 Building buff container with message:`, resultMessage);

        container.addSectionComponents((section) =>
            section
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(resultMessage || '**Buff Decision**')
                )
                .setThumbnailAccessory((thumbnail) =>
                    thumbnail
                        .setDescription(`${user.username}'s Buff Decision`)
                        .setURL(userAvatar)
                )
        );

        container.addSeparatorComponents((separator) => separator);

        container.addActionRowComponents((row) =>
            row.setComponents([
                new ButtonBuilder()
                    .setCustomId('buff_accept')
                    .setLabel('✅ Accept Buff')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('buff_reject')
                    .setLabel('❌ Reject Buff')
                    .setStyle(ButtonStyle.Danger)
            ])
        );

        return container;
    },

    async buildDropsContainer(activeBuffs, cratesData, dropStats, user, guild, resultMessage = null, buffData = null) {
        const userAvatar = user.displayAvatarURL({ extension: 'png', size: 256 });
        const container = new ContainerBuilder().setAccentColor(0x5865F2);

        const ALLOWED_BUFF = 'daily_limit_boost';
        const hasBlockingBuff = Array.isArray(activeBuffs) &&
            activeBuffs.some(buff => buff.buff_type !== ALLOWED_BUFF);

        let sectionContent = `# Drops Menu\n\n`;

        if (hasBlockingBuff) {
            const blockingBuffs = activeBuffs.filter(buff => buff.buff_type !== ALLOWED_BUFF);

            sectionContent += '**Blocking Buffs:**\n';
            blockingBuffs.forEach((buff, index) => {
                if (buff && buff.buff_type) {
                    const buffName = formatBuffName(buff.buff_type);
                    const expiresAt = buff.expires_at ? new Date(buff.expires_at) : null;

                    let expiresIn = 'Unknown';
                    if (expiresAt) {
                        const secondsLeft = Math.max(0, Math.floor((expiresAt - new Date()) / 1000));
                        expiresIn = formatTime(secondsLeft);
                    }

                    sectionContent += `**${buffName}** | **⏳ ${expiresIn}**`;
                    if (index < blockingBuffs.length - 1) sectionContent += '\n';
                }
            });

            sectionContent += '\n\n-# 🔒 **You cannot open crates with these buffs!**';
        } else {
            if (Array.isArray(activeBuffs) && activeBuffs.length > 0) {
                sectionContent += '**Active Boosts:**\n';
                activeBuffs.forEach((buff, index) => {
                    if (buff && buff.buff_type) {
                        const buffName = formatBuffName(buff.buff_type);
                        const expiresAt = buff.expires_at ? new Date(buff.expires_at) : null;

                        let expiresIn = 'Unknown';
                        if (expiresAt) {
                            const secondsLeft = Math.max(0, Math.floor((expiresAt - new Date()) / 1000));
                            expiresIn = formatTime(secondsLeft);
                        }

                        sectionContent += `**${buffName}** | **⏳ ${expiresIn}**`;
                        if (index < activeBuffs.length - 1) sectionContent += '\n';
                    }
                });
                sectionContent += '\n\n🎉 **You can open drops!**';
            } else {
                sectionContent += `**You can open crates freely!**\n`;
                sectionContent += `-# No active buffs`;
            }
        }

        container.addSectionComponents((section) =>
            section
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(sectionContent)
                )
                .setThumbnailAccessory((thumbnail) =>
                    thumbnail
                        .setDescription(`${user.username}'s Drops`)
                        .setURL(userAvatar)
                )
        );

        container.addSeparatorComponents((separator) => separator);

        const crateTypes = [
            { type: 'common', label: 'Common Drop', emoji: '🟢' },
            { type: 'rare', label: 'Rare Drop', emoji: '🔵' },
            { type: 'epic', label: 'Epic Drop', emoji: '🟣' },
            { type: 'legendary', label: 'Legendary Drop', emoji: '🟡' }
        ];

        for (const crateType of crateTypes) {
            const crates = (cratesData && cratesData.crates) ?
                cratesData.crates.filter(c => c && c.crate_type === crateType.type) || [] : [];
            const count = crates.length;
            const firstId = crates[0]?.id || '0';

            const hasCrates = count > 0 && firstId !== '0';
            const canOpen = hasCrates && !hasBlockingBuff;

            container.addSectionComponents((section) =>
                section
                    .addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`### **${crateType.emoji} ${crateType.label}**`)
                    )
                    .setButtonAccessory((button) =>
                        button
                            .setCustomId(`open_crate_${firstId}_${crateType.type}`)
                            .setLabel('Open')
                            .setStyle(canOpen ? ButtonStyle.Success : ButtonStyle.Secondary)
                            .setDisabled(!canOpen)
                    )
            );

            const receivedCount = (dropStats && dropStats.drops && dropStats.drops[crateType.type]) ?
                dropStats.drops[crateType.type].received || 0 : 0;

            let details = `**Drops available:** ${count}\n`;
            details += `-# **Total received:** ${receivedCount}`;

            container.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(details)
            );

            container.addSeparatorComponents((separator) => separator);
        }

        if (resultMessage && resultMessage.trim() !== '') {
            container.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(resultMessage)
            );
        }

        const totalCrates = (cratesData && cratesData.crates) ? cratesData.crates.length : 0;
        container.addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(`-# Total crates available: ${totalCrates}`)
        );

        return container;
    },

    async openUserCrate(crateId, userId, crateType) {
        try {
            console.log(`🎁 ======= OPENING CRATE =======`);
            console.log(`📝 Crate ID: ${crateId}`);
            console.log(`👤 User ID: ${userId}`);
            console.log(`📦 Crate Type: ${crateType}`);

            const crate = await dbManager.get(
                `SELECT * FROM user_crates WHERE id = ? AND user_id = ?`,
                [crateId, userId]
            );

            if (!crate) {
                console.log(`❌ Crate not found: ID ${crateId}, User ${userId}`);
                return { success: false, error: 'Crate not found or already opened', code: 'CRATE_NOT_FOUND' };
            }

            if (crate.is_used) {
                console.log(`⚠️ Crate already opened at: ${crate.used_at}`);
                return { success: false, error: 'Crate already opened', code: 'CRATE_ALREADY_USED', openedAt: crate.used_at };
            }

            console.log(`📦 Crate details:`, {
                id: crate.id,
                type: crate.crate_type,
                reward_type: crate.reward_type,
                coins: crate.coins_amount || 0,
                xp: crate.xp_amount || 0,
                crystals: crate.crystals_amount || 0,
                coupon_discount: crate.coupon_discount,
                has_buff: !!(crate.buff_type && crate.buff_duration_minutes)
            });

            let couponData = null;
            let couponCreationResult = null;

            if (crate.reward_type === 'coupon' && crate.coupon_discount) {
                console.log(`🎫 ======= CREATING COUPON =======`);
                console.log(`📊 Coupon discount from crate: ${crate.coupon_discount}%`);

                try {
                    const { couponSystem } = require('../LevelSystem/couponsystem');

                    if (crate.coupon_info) {
                        try {
                            const couponInfo = typeof crate.coupon_info === 'string'
                                ? JSON.parse(crate.coupon_info)
                                : crate.coupon_info;
                            console.log(`📋 Coupon info:`, couponInfo);
                        } catch (parseError) {
                            console.error(`❌ Error parsing coupon_info:`, parseError.message);
                        }
                    }

                    couponCreationResult = await couponSystem.createCouponFromDrop(
                        userId,
                        crate.username || 'Unknown',
                        crate.coupon_discount,
                        crateId
                    );

                    if (couponCreationResult && couponCreationResult.success) {
                        console.log(`✅ Coupon created: ${couponCreationResult.couponCode} (${couponCreationResult.discountPercentage}%)`);

                        couponData = await dbManager.get(
                            `SELECT * FROM shop_coupons WHERE coupon_code = ? AND user_id = ?`,
                            [couponCreationResult.couponCode, userId]
                        );
                    } else {
                        console.log(`❌ Coupon creation failed:`, couponCreationResult);
                    }

                } catch (couponError) {
                    console.error(`❌ Error creating coupon:`, couponError.message);
                }
            }

            let totalCoins = crate.coins_amount || 0;
            let totalXP = crate.xp_amount || 0;
            let totalCrystals = crate.crystals_amount || 0;

            if (couponData || couponCreationResult?.success) {
                const bonusCoins = Math.floor(Math.random() * 50) + 25;
                const bonusXP = Math.floor(Math.random() * 30) + 15;
                totalCoins += bonusCoins;
                totalXP += bonusXP;
                console.log(`🎁 Added bonus rewards for coupon: +${bonusCoins} coins, +${bonusXP} XP`);
            }

            await dbManager.run(`UPDATE shop_coupons SET source_crate_id = NULL WHERE source_crate_id = ?`, [crateId]);

            const deleteResult = await dbManager.run(
                `DELETE FROM user_crates WHERE id = ?`,
                [crateId]
            );

            console.log(`🗑️ Crate ${crateId} deleted (${deleteResult.changes} row(s) affected)`);

            if (totalCoins > 0 || totalXP > 0 || totalCrystals > 0) {
                try {
                    await levelSystem.processUserRewards(
                        userId, '', totalXP, totalCoins, totalCrystals,
                        null, null, 'drop', true
                    );
                    console.log(`✅ Rewards processed: coins=${totalCoins}, xp=${totalXP}, crystals=${totalCrystals}`);
                } catch (rewardError) {
                    console.error(`❌ Error processing rewards:`, rewardError.message);
                }
            }

            if (totalCoins > 0) {
                try {
                    await dbManager.updateGoalProgress(userId, 'drop_coins', totalCoins);
                } catch (missionError) {
                    console.error(`❌ Error updating Lucky Day mission:`, missionError.message);
                }
            }

            let buffData = null;
            if (crate.buff_type && crate.buff_duration_minutes) {
                buffData = {
                    type: crate.buff_type,
                    duration: crate.buff_duration_minutes,
                    expires_in: `${crate.buff_duration_minutes} minutes`,
                    description: this.formatBuffDescription(crate.buff_type)
                };
                console.log(`🎯 Buff found: ${crate.buff_type} (${crate.buff_duration_minutes} minutes)`);
            }

            const result = {
                success: true,
                crate: {
                    id: crateId,
                    type: crateType,
                    original_type: crate.crate_type,
                    rewards: {
                        coins: totalCoins,
                        xp: totalXP,
                        crystals: totalCrystals,
                        original_coins: crate.coins_amount || 0,
                        original_xp: crate.xp_amount || 0,
                        original_crystals: crate.crystals_amount || 0,
                        bonus_coins: totalCoins - (crate.coins_amount || 0),
                        bonus_xp: totalXP - (crate.xp_amount || 0)
                    }
                },
                buff: buffData,
                was_deleted: deleteResult.changes > 0
            };

            if (couponData || couponCreationResult?.success) {
                const coupon = couponData || couponCreationResult;
                const couponCode = coupon.coupon_code || coupon.couponCode;
                const discount = coupon.discount_percentage || coupon.discountPercentage;
                const expiresAt = coupon.expires_at || coupon.expiresAt;
                const daysLeft = Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)));

                result.coupon = {
                    success: true,
                    code: couponCode,
                    discount: discount,
                    expires_at: expiresAt,
                    valid_for_days: daysLeft,
                    source: 'legendary_drop',
                    message: `🎫 **Bonus Coupon:** \`${couponCode}\` (${discount}% off)`,
                    formatted_message: `🎫 **Coupon Unlocked!**\n` +
                                      `   • **Code:** \`${couponCode}\`\n` +
                                      `   • **Discount:** ${discount}% OFF\n` +
                                      `   • **Valid for:** ${daysLeft} days\n` +
                                      `   • **Use with:** \`/shop\` command`
                };
            }

            console.log(`✅ ======= CRATE OPENING COMPLETE =======`);
            return result;

        } catch (error) {
            console.error('❌ Error in openUserCrate:', error.message);
            return {
                success: false,
                error: error.message,
                code: 'CRATE_OPENING_ERROR',
                details: { crateId, userId, crateType, timestamp: new Date().toISOString() }
            };
        }
    },

    formatBuffDescription(buffType) {
        const descriptions = {
            'double_xp': 'Gain double XP from all sources',
            'double_coins': 'Earn double coins from all activities',
            'double_luck': 'Double chance for rare drops',
            'xp_boost': 'Increased XP gain',
            'coin_boost': 'Increased coin earnings',
            'luck_boost': 'Increased luck for drops'
        };

        return descriptions[buffType] || `Unknown buff: ${buffType}`;
    },

    async checkAndDisplayCoupons(userId) {
        try {
            const coupons = await dbManager.all(
                `SELECT * FROM shop_coupons 
                 WHERE user_id = ? 
                 AND is_used = false
                 AND expires_at > CURRENT_TIMESTAMP
                 ORDER BY expires_at ASC`,
                [userId]
            );

            if (coupons.length === 0) return 'No active coupons available.';

            let message = `🎫 **Your Active Coupons:**\n\n`;

            coupons.forEach((coupon, index) => {
                const daysLeft = Math.ceil((new Date(coupon.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
                message += `**${index + 1}.** \`${coupon.coupon_code}\`\n`;
                message += `   • **Discount:** ${coupon.discount_percentage}%\n`;
                message += `   • **Expires in:** ${daysLeft} days\n`;
                message += `   • **Source:** ${coupon.source_drop_type || 'Unknown'}\n\n`;
            });

            return message;
        } catch (error) {
            console.error('Error checking coupons:', error);
            return 'Error loading coupons.';
        }
    }
};

// ========== HELPER FUNCTIONS ==========

function formatBuffName(buffType) {
    const buffNames = {
        'daily_limit_boost': '☄️ Daily Limit Boost',
        'double_xp': '⚡ Double XP',
        'double_coins': '💰 Double Coins',
        'double_luck': '🍀 Double Luck',
        'no_new_crates': '❌ No New Crates',
        'crate_cooldown': '⏳ Crate Cooldown',
        'opening_lock': '🔒 Opening Lock',
        'xp_boost': '⭐ XP Boost',
        'coin_boost': '🪙 Coin Boost',
        'luck_boost': '🎲 Luck Boost'
    };

    return buffNames[buffType] || buffType;
}

// ✅ التعديل: الدالة دلوقتي بتاخد ثواني وبتعرض الثواني صح
function formatTime(seconds) {
    if (seconds >= 86400) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        return `${days}d ${hours}h`;
    } else if (seconds >= 3600) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    } else if (seconds >= 60) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    } else {
        return `${seconds}s`;
    }
}