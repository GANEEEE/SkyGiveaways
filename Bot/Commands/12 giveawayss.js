const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../Data/database');
const parseDuration = require('../System/durationParser');

// ========== CONSTANTS ==========
const GIVEAWAY_LOG_CHANNEL_ID = '1385531928446373970';
const WINNER_ROLE_ID = '1395730680926965781';
const BONUS_ROLE_ID = '1400000000000000000';        // ⬅️ رول البونص لـ GCD
const DEFAULT_HOST_ID = '1395730680926965781';      // ⬅️ الهوست الافتراضي
const BOOSTER_ROLE_ID = 'BOOSTER_ROLE_ID_HERE';     // ⬅️ رول Booster لـ VIP (4 entries)

// ⭐ معرفات الرتب المستخدمة في القوالب (موحدة)
const GAMER_1_ID = 'GAMER_1_ID';
const GAMER_2_ID = 'GAMER_2_ID';
const GAMER_3_ID = 'GAMER_3_ID';
const GAMER_4_ID = 'GAMER_4_ID';
const GAMER_5_ID = 'GAMER_5_ID';
const TIER_5_ID = 'TIER_5_ID';

// ترتيب الرتب لقالب VIP (للتسلسل الهرمي)
const VIP_ROLES_HIERARCHY = [GAMER_1_ID, GAMER_2_ID, GAMER_3_ID, GAMER_4_ID];

// ========== BLACKLIST ROLES (موحدة) ==========
const BLACKLIST_ROLES = ['ROLE_ID_1', 'ROLE_ID_2', 'ROLE_ID_3'];

// ========== HELPERS ==========
async function getUserMessageCount(userId, period = 'weekly') {
    const stats = await dbManager.getUserMessageStats(userId);
    if (!stats) return 0;
    if (period === 'daily') return stats.daily_sent || 0;
    if (period === 'weekly') return stats.weekly_sent || 0;
    if (period === 'monthly') return stats.monthly_sent || 0;
    return stats.total || 0;
}

async function purchaseMissingMessages(userId, needed, period) {
    const profile = await dbManager.getUserProfile(userId);
    if (!profile) return { success: false, reason: 'no_profile' };
    const cost = needed * 35;
    if (profile.sky_coins < cost) {
        return { success: false, reason: 'insufficient_coins', needed: cost, have: profile.sky_coins };
    }
    await dbManager.run(`UPDATE levels SET sky_coins = sky_coins - ? WHERE user_id = ?`, [cost, userId]);
    const column = period === 'daily' ? 'daily_sent' : (period === 'weekly' ? 'weekly_sent' : 'monthly_sent');
    await dbManager.run(
        `UPDATE message_stats SET ${column} = ${column} + ?, total = total + ? WHERE user_id = ?`,
        [needed, needed, userId]
    );
    return { success: true, cost };
}

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ========== PRIZE NAME MAPPER ==========
const PRIZE_NAMES = {
    'RN': 'Random Key',
    'GCS': 'Gift Card S',
    'GCD': 'Gift Card D',
    'bonus': 'Bonus Entry'
};

function getPrizeDisplayName(type) {
    return PRIZE_NAMES[type] || type;
}

// ========== خريطة لتخزين الـ timeouts النشطة ==========
const scheduledTimeouts = new Map(); // giveawayCode -> timeoutId

// ========== دالة مساعدة لنشر الجيفاواي المجدول ==========
async function publishScheduledGiveaway(giveawayCode, client) {
    try {
        // حذف الـ timeout من الخريطة
        scheduledTimeouts.delete(giveawayCode);

        // جلب بيانات الجيفاواي من الداتابيز
        const giveaway = await dbManager.getGiveawayByCode(giveawayCode);
        if (!giveaway || giveaway.status !== 'scheduled') return;

        const guild = client.guilds.cache.get(giveaway.guild_id);
        if (!guild) return;

        const channel = guild.channels.cache.get(giveaway.channel_id);
        if (!channel) return;

        // الحصول على الأمر
        const giveawayCommand = client.commands.get('giveaway');
        if (!giveawayCommand) return;

        // إعادة بناء config
        const config = giveawayCommand.buildConfigFromGiveaway(giveaway);

        const endsAt = new Date(giveaway.end_time);
        const host = await client.users.fetch(giveaway.host_id).catch(() => ({ 
            id: giveaway.host_id, 
            username: giveaway.host_name || 'Host', 
            displayAvatarURL: () => null 
        }));

        // إنشاء رسالة الجيفاواي
        const messageData = giveawayCommand.createGiveawayMessage(config, endsAt, giveawayCode, host, giveaway.entries || {});
        const message = await channel.send(messageData);

        // تحديث الداتابيز
        await dbManager.activateScheduledGiveaway(giveawayCode, message.id, channel.id);

        // بدء الـ collectors
        giveawayCommand.setupJoinCollector(message, giveawayCode, endsAt, config, client);
        giveawayCommand.setupConfirmCollector(message, giveawayCode, client);

        // إرسال إشعار لقناة اللوج
        const logChannel = guild.channels.cache.get(GIVEAWAY_LOG_CHANNEL_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder().setColor(config.color).setTitle('🎉 Scheduled Giveaway Started')
                .addFields(
                    { name: 'ID', value: `\`${giveawayCode}\``, inline: true },
                    { name: 'Channel', value: `${channel}`, inline: true }
                );
            await logChannel.send({ embeds: [logEmbed] });
        }

        console.log(`✅ Published scheduled giveaway: ${giveawayCode}`);

    } catch (error) {
        console.error(`❌ Failed to publish scheduled giveaway ${giveawayCode}:`, error);
    }
}

// ========== تصدير دالة استعادة الجدولة (للاستخدام في GiveawaysBack) ==========
async function restoreScheduledGiveaways(client) {
    try {
        // 1. الجيفاواي التي حان وقتها أثناء إيقاف البوت
        const readyGiveaways = await dbManager.getScheduledGiveawaysReadyToStart();
        for (const gw of readyGiveaways) {
            await publishScheduledGiveaway(gw.giveaway_code, client);
        }

        // 2. الجيفاواي التي لم يحن وقتها بعد - إعادة ضبط الـ setTimeout
        const pendingGiveaways = await dbManager.getPendingScheduledGiveaways();
        for (const gw of pendingGiveaways) {
            const scheduleTime = new Date(gw.schedule).getTime();
            const now = Date.now();
            const delay = Math.max(0, scheduleTime - now);

            const timeoutId = setTimeout(() => {
                publishScheduledGiveaway(gw.giveaway_code, client);
            }, delay);

            scheduledTimeouts.set(gw.giveaway_code, timeoutId);
            console.log(`⏰ Restored timeout for giveaway ${gw.giveaway_code} (in ${Math.round(delay/1000)}s)`);
        }

        console.log(`✅ Scheduled giveaways restored: ${readyGiveaways.length} published, ${pendingGiveaways.length} pending`);
    } catch (error) {
        console.error('❌ Error restoring scheduled giveaways:', error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Create a new giveaway (Admins only)')
        .addStringOption(opt => opt.setName('template').setDescription('Pre-configured template').setRequired(false)
            .addChoices(
                { name: '🎮 Triple Game', value: 'normal' },
                { name: '👑 VIP Specials', value: 'vip' },
                { name: '💜 Elite Royale', value: 'elite' }
            ))
        .addStringOption(opt => opt.setName('title').setDescription('Giveaway title (overrides template)').setRequired(false))
        .addStringOption(opt => opt.setName('description').setDescription('Giveaway description (overrides template)').setRequired(false))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g., 2d, 1h 30m)').setRequired(false))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners (1-25)').setMinValue(1).setMaxValue(25).setRequired(false))
        .addUserOption(opt => opt.setName('host').setDescription(`Host (default: <@${DEFAULT_HOST_ID}>)`).setRequired(false))
        .addStringOption(opt => opt.setName('image').setDescription('Image URL').setRequired(false))
        .addStringOption(opt => opt.setName('scheduled')
            .setDescription('Delay before giveaway starts (e.g., 7d 10h 11m 12s)')
            .setRequired(false))
        .addChannelOption(opt => opt.setName('schedule_channel')
            .setDescription('Channel to post the scheduled giveaway (default: current channel)')
            .setRequired(false))
        .addRoleOption(opt => opt.setName('bypass_role').setDescription('Role that bypasses requirements and blacklist').setRequired(false))
        .addRoleOption(opt => opt.setName('reqrole').setDescription('Required role to join').setRequired(false))
        .addRoleOption(opt => opt.setName('banrole').setDescription('Banned role').setRequired(false))
        .addStringOption(opt => opt.setName('reroll').setDescription('Reroll a giveaway (ID)').setRequired(false))
        .addStringOption(opt => opt.setName('end').setDescription('End a giveaway early (ID)').setRequired(false)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // صلاحيات
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');
            if (!moderateRoleData) {
                return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('❌ Moderate Role Not Set').setDescription('Use `/setrole` first.')] });
            }
            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!member.roles.cache.has(roleInfo.id)) {
                return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('⛔ Permission Denied').setDescription(`Only <@&${roleInfo.id}> can use this.`)] });
            }

            // Reroll / End
            const rerollId = interaction.options.getString('reroll');
            const endId = interaction.options.getString('end');
            if (rerollId) return await this.handleReroll(interaction, rerollId);
            if (endId) return await this.handleEnd(interaction, endId);

            // خيارات
            const template = interaction.options.getString('template') || 'normal';
            const titleInput = interaction.options.getString('title');
            const descriptionInput = interaction.options.getString('description');
            const durationInput = interaction.options.getString('duration') || '7d';
            const winnersCount = interaction.options.getInteger('winners');
            const hostUser = interaction.options.getUser('host');
            let host;
            if (hostUser) {
                host = hostUser;
            } else {
                try { host = await interaction.client.users.fetch(DEFAULT_HOST_ID); }
                catch { host = interaction.user; }
            }
            const imageUrl = interaction.options.getString('image');
            const scheduledInput = interaction.options.getString('scheduled');
            const scheduleChannel = interaction.options.getChannel('schedule_channel') || interaction.channel;
            const bypassRole = interaction.options.getRole('bypass_role');
            const reqRole = interaction.options.getRole('reqrole');
            const banRole = interaction.options.getRole('banrole');

            const templateData = this.getTemplateData(template);
            if (!templateData) return interaction.editReply({ content: `❌ Template "${template}" not found!` });

            const processedEntryValues = this.processEntryValues(templateData.entryValues);

            const config = this.mergeConfig({
                templateData,
                title: titleInput,
                description: descriptionInput,
                duration: durationInput,
                winnersCount,
                host,
                imageUrl,
                bypassRole,
                reqRole,
                banRole,
                processedEntryValues
            });

            if (!config.duration) return interaction.editReply({ content: '❌ Duration is required!' });
            const durationMs = parseDuration(config.duration);
            if (!durationMs) return interaction.editReply({ content: '❌ Invalid duration format!' });

            // حساب وقت الجدولة إن وجد
            let scheduledTime = null;
            if (scheduledInput) {
                const delayMs = parseDuration(scheduledInput);
                if (!delayMs) {
                    return interaction.editReply({ content: '❌ Invalid scheduled duration format! Use like: 7d 10h 11m 12s' });
                }
                scheduledTime = new Date(Date.now() + delayMs);
            }

            const actualStartTime = scheduledTime || new Date();
            const endsAt = new Date(actualStartTime.getTime() + durationMs);
            const giveawayCode = this.generateGiveawayCode();

            // إذا كان فورياً، أنشئ الرسالة
            let message = null;
            if (!scheduledTime) {
                const messageData = this.createGiveawayMessage(config, endsAt, giveawayCode, host, {});
                message = await scheduleChannel.send(messageData);
            }

            const result = await dbManager.createGiveaway({
                giveawayCode, template, duration: config.duration,
                endsAt: endsAt.toISOString(),
                winnersCount: config.winnersCount,
                entryType: 'messages',
                entryValues: config.entryValues ? JSON.stringify(config.entryValues) : null,
                multiplier: config.multiplier ? JSON.stringify(config.multiplier) : null,
                reqRoleId: config.reqRole?.id || null,
                banRoleId: config.banRole?.id || null,
                hostId: host.id,
                hostName: host.username,
                imageUrl: config.imageUrl || null,
                schedule: scheduledTime ? scheduledTime.toISOString() : null,
                guildId: interaction.guildId,
                messageId: message?.id || null,
                channelId: scheduleChannel.id,
                status: scheduledTime ? 'scheduled' : 'active'
            });

            if (!result.success) {
                if (message) await message.delete().catch(() => {});
                return interaction.editReply({ content: '❌ Failed to create giveaway.' });
            }

            if (scheduledTime) {
                // جدولة النشر
                const delay = scheduledTime.getTime() - Date.now();
                const timeoutId = setTimeout(() => {
                    publishScheduledGiveaway(giveawayCode, interaction.client);
                }, delay);
                scheduledTimeouts.set(giveawayCode, timeoutId);

                await interaction.editReply({
                    content: `✅ Giveaway scheduled!\nCode: \`${giveawayCode}\`\nStarts: <t:${Math.floor(scheduledTime.getTime()/1000)}:R>\nChannel: ${scheduleChannel}`
                });
            } else {
                // جيفاواي فوري
                await this.sendToLogChannel(interaction, config, giveawayCode, endsAt, host, message.channel);
                this.setupJoinCollector(message, giveawayCode, endsAt, config, interaction.client);
                this.setupConfirmCollector(message, giveawayCode, interaction.client);
                await interaction.editReply({ content: `✅ Giveaway created!\nCode: \`${giveawayCode}\`\nWinners: ${config.winnersCount}` });
            }

        } catch (error) {
            console.error('Error in giveaway command:', error);
            await interaction.editReply({ content: '❌ Error creating giveaway.' }).catch(() => {});
        }
    },

    // ========== دالة مساعدة لبناء config من سجل قاعدة البيانات ==========
    buildConfigFromGiveaway(giveaway) {
        const entryValues = giveaway.entry_values
            ? (typeof giveaway.entry_values === 'string' ? JSON.parse(giveaway.entry_values) : giveaway.entry_values)
            : null;
        const multiplier = giveaway.multiplier
            ? (typeof giveaway.multiplier === 'string' ? JSON.parse(giveaway.multiplier) : giveaway.multiplier)
            : null;

        let description = '';
        let title = '🎁 Giveaway';
        if (giveaway.template === 'normal') title = '🎮 Triple Game';
        else if (giveaway.template === 'vip') title = '👑 VIP Specials';
        else if (giveaway.template === 'elite') title = '💜 Elite Royale';

        if (entryValues && entryValues.buttons) {
            const periodMap = { daily: 'today', weekly: 'this week', monthly: 'this month' };
            const periodText = periodMap[entryValues.period] || 'this week';
            const lines = entryValues.buttons.map(btn => {
                if (btn.type === 'RN') return `🔑 Special Random Key: ${btn.required} messages`;
                if (btn.type === 'GCS') return `🎁 Special Gift Card: ${btn.required} messages`;
                if (btn.type === 'GCD') return `💎 Hyper Gift Card: ${btn.required} messages`;
                return `${btn.label}: ${btn.required} msgs`;
            });
            const dynamicDesc = `**Messages have sent ${periodText}:**\n${lines.join('\n')}`;
            description = `# ${title}\n\n${dynamicDesc}`;
        } else {
            description = `# ${title}`;
        }

        return {
            winnersCount: giveaway.winners_count,
            host: { id: giveaway.host_id, username: giveaway.host_name || 'Host', displayAvatarURL: () => null },
            imageUrl: giveaway.image_url,
            entryType: giveaway.entry_type,
            entryValues: entryValues,
            multiplier: multiplier,
            reqRole: giveaway.reqrole ? { id: giveaway.reqrole } : null,
            banRole: giveaway.banrole ? { id: giveaway.banrole } : null,
            bypassRole: null,
            color: 0x0073ff,
            description: description,
            title: title
        };
    },

    // ========== TEMPLATE DATA ==========
    getTemplateData(templateName) {
        const templates = {
            normal: {
                title: '🎮 Triple Game',
                color: 0x0073ff,
                winnersCount: 3,
                entryValues: {
                    period: 'weekly',
                    buttons: [
                        { type: 'RN', label: '🔑 Random Key', min: 20, max: 50 },
                        { type: 'GCS', label: '🎁 Gift Card S', min: 51, max: 100 },
                        { type: 'GCD', label: '💎 Gift Card D', min: 101, max: 200 }
                    ]
                },
                multiplier: null,
                imageUrl: 'https://i.imgur.com/7KpRk9D.png'
            },
            vip: {
                title: '👑 VIP Specials',
                color: 0xFFD700,
                winnersCount: 2,
                entryValues: {
                    period: 'weekly',
                    buttons: [
                        { roleId: GAMER_1_ID, label: 'Gamer 1', min: 10, max: 30 },
                        { roleId: GAMER_2_ID, label: 'Gamer 2', min: 31, max: 60 },
                        { roleId: BOOSTER_ROLE_ID, label: 'Booster', min: 10, max: 30 },
                        { roleId: GAMER_3_ID, label: 'Gamer 3', min: 61, max: 100 },
                        { roleId: GAMER_4_ID, label: 'Gamer 4', min: 101, max: 150 }
                    ]
                },
                multiplier: {
                    [GAMER_1_ID]: 1,
                    [GAMER_2_ID]: 2,
                    [BOOSTER_ROLE_ID]: 4,
                    [GAMER_3_ID]: 6,
                    [GAMER_4_ID]: 8
                },
                imageUrl: 'https://i.imgur.com/VIP_IMAGE.png'
            },
            elite: {
                title: '💜 Elite Royale',
                color: 0x9B59B6,
                winnersCount: 1,
                entryValues: {
                    period: 'weekly',
                    buttons: [
                        { roleId: GAMER_5_ID, label: 'Gamer 5', min: 500, max: 1000 },
                        { roleId: TIER_5_ID, label: 'Tier 5', min: 1001, max: 2000 }
                    ]
                },
                multiplier: { [GAMER_5_ID]: 5, [TIER_5_ID]: 10 },
                imageUrl: 'https://i.imgur.com/ELITE_IMAGE.png'
            }
        };
        return templates[templateName] || null;
    },

    processEntryValues(entryValues) {
        if (!entryValues) return null;
        return {
            period: entryValues.period || 'weekly',
            buttons: entryValues.buttons.map(btn => ({
                ...btn,
                required: randomBetween(btn.min, btn.max)
            }))
        };
    },

    mergeConfig({ templateData, title, description, duration, winnersCount, host, imageUrl, bypassRole, reqRole, banRole, processedEntryValues }) {
        const periodMap = { daily: 'today', weekly: 'this week', monthly: 'this month' };
        const periodText = periodMap[processedEntryValues.period] || 'this week';
        let dynamicDesc = '';
        if (processedEntryValues.buttons) {
            const lines = processedEntryValues.buttons.map(btn => {
                if (btn.type === 'RN') return `🔑 Special Random Key: ${btn.required} messages`;
                if (btn.type === 'GCS') return `🎁 Special Gift Card: ${btn.required} messages`;
                if (btn.type === 'GCD') return `💎 Hyper Gift Card: ${btn.required} messages`;
                return `${btn.label}: ${btn.required} msgs`;
            });
            dynamicDesc = `**Messages have sent ${periodText}:**\n${lines.join('\n')}`;
        }

        const finalTitle = title || templateData.title;
        const finalDescription = description
            ? `# ${finalTitle}\n\n${description}\n\n${dynamicDesc}`
            : `# ${finalTitle}\n\n${dynamicDesc}`;

        let finalWinnersCount = winnersCount || templateData.winnersCount;
        if (templateData === this.getTemplateData('normal')) {
            finalWinnersCount = 3;
        }

        return {
            title: finalTitle,
            description: finalDescription,
            color: templateData.color,
            duration: duration || '7d',
            winnersCount: finalWinnersCount,
            entryValues: processedEntryValues,
            multiplier: templateData.multiplier,
            bypassRole: bypassRole || null,
            reqRole: reqRole || null,
            banRole: banRole || null,
            host,
            imageUrl: imageUrl || templateData.imageUrl,
        };
    },

    generateGiveawayCode() {
        return 'GIV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    },

    createGiveawayEmbed(config, endsAt, giveawayCode, host, entries) {
        const timestamp = Math.floor(endsAt.getTime() / 1000);
        const uniqueParticipants = new Set(Object.values(entries).map(e => e.userId)).size;

        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setDescription(config.description)
            .addFields(
                { name: '⏳ Ends', value: `<t:${timestamp}:R>`, inline: true },
                { name: '👥 Participants', value: `${uniqueParticipants}`, inline: true },
                { name: '🏆 Winners', value: `${config.winnersCount}`, inline: true }
            );

        if (config.reqRole) embed.addFields({ name: '✅ Required Role', value: `<@&${config.reqRole.id}>`, inline: true });
        if (config.banRole) embed.addFields({ name: '⛔ Banned Role', value: `<@&${config.banRole.id}>`, inline: true });
        if (config.bypassRole) embed.addFields({ name: '⚡ Bypass Role', value: `<@&${config.bypassRole.id}>`, inline: true });

        embed.addFields({ name: '🎁 Winner will get', value: `<@&${WINNER_ROLE_ID}>`, inline: false });
        const blacklistMentions = BLACKLIST_ROLES.map(id => `<@&${id}>`).join(', ') || 'None';
        embed.addFields({ name: '🚫 Blacklist', value: blacklistMentions, inline: false });

        if (config.imageUrl) embed.setImage(config.imageUrl);

        const avatarURL = host.displayAvatarURL({ dynamic: true });
        embed.setFooter({ text: `${host.username} | ID: ${giveawayCode}`, iconURL: avatarURL });

        return embed;
    },

    buildButtonRow(config, giveawayCode, entries) {
        const row = new ActionRowBuilder();
        const buttons = config.entryValues?.buttons || [];
        const counts = this.calculateButtonCounts(entries, buttons);

        buttons.forEach((btn, index) => {
            let label = btn.label || 'Join';
            let customId = `giveaway_join_${giveawayCode}_${index}`;
            if (btn.type) customId += `_${btn.type}`;
            else if (btn.roleId) customId += `_role_${btn.roleId}`;

            const count = counts[index] || 0;
            label = `${label} (${count})`;

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(customId)
                    .setLabel(label)
                    .setStyle(ButtonStyle.Primary)
            );
        });
        return row;
    },

    calculateButtonCounts(entries, buttons) {
        const counts = new Array(buttons.length).fill(0);
        if (!entries) return counts;

        Object.values(entries).forEach(entry => {
            buttons.forEach((btn, idx) => {
                if (btn.type && btn.type === entry.type) counts[idx]++;
                else if (btn.roleId && entry.roleId === btn.roleId) counts[idx]++;
            });
        });
        return counts;
    },

    createGiveawayMessage(config, endsAt, giveawayCode, host, entries) {
        const embed = this.createGiveawayEmbed(config, endsAt, giveawayCode, host, entries);
        const row = this.buildButtonRow(config, giveawayCode, entries);
        return { embeds: [embed], components: [row] };
    },

    updateGiveawayMessage(config, endsAt, giveawayCode, hostId, entries) {
        const host = { id: hostId, username: 'Host', displayAvatarURL: () => null };
        return this.createGiveawayMessage(config, endsAt, giveawayCode, host, entries);
    },

    async sendToLogChannel(interaction, config, giveawayCode, endsAt, host, channel) {
        try {
            const logChannel = await interaction.guild.channels.fetch(GIVEAWAY_LOG_CHANNEL_ID);
            if (!logChannel) return;
            const embed = new EmbedBuilder().setColor(config.color).setTitle('🎉 Giveaway Created')
                .addFields(
                    { name: 'ID', value: `\`${giveawayCode}\``, inline: true },
                    { name: 'Ends', value: `<t:${Math.floor(endsAt.getTime()/1000)}:R>`, inline: true },
                    { name: 'Winners', value: `${config.winnersCount}`, inline: true },
                    { name: 'Channel', value: `${channel}`, inline: true },
                    { name: 'Host', value: `${host}`, inline: true }
                );
            await logChannel.send({ embeds: [embed] });
        } catch (e) {}
    },

    setupJoinCollector(message, giveawayCode, endsAt, config, client) {
        const filter = i => i.customId.startsWith(`giveaway_join_${giveawayCode}`) || 
                           i.customId.startsWith(`giveaway_purchase_${giveawayCode}`) ||
                           i.customId.startsWith(`giveaway_leave_${giveawayCode}`);
        const collector = message.createMessageComponentCollector({ filter, time: endsAt.getTime() - Date.now() });

        collector.on('collect', async i => {});

        collector.on('end', () => this.handleGiveawayEnd(message, giveawayCode, client, config));
    },

    // ========== معالج الأزرار الموحد ==========
    async buttonHandler(interaction) {
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const giveawayCode = parts[2];
        const giveaway = await dbManager.getActiveGiveawayByCode(giveawayCode);
        if (!giveaway) {
            return interaction.reply({ content: '❌ This giveaway is no longer active.', flags: 64 });
        }

        const isLeaveAction = action === 'leave';
        const isMainMessage = interaction.message.id === giveaway.message_id;

        if (!isMainMessage && !isLeaveAction) {
            const channel = interaction.client.channels.cache.get(giveaway.channel_id);
            const messageUrl = channel
                ? `https://discord.com/channels/${interaction.guildId}/${giveaway.channel_id}/${giveaway.message_id}`
                : null;

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#FFA500')
                    .setDescription('⚠️ You are using an **old giveaway message**.\nPlease use the current giveaway below.')],
                components: messageUrl ? [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('Go to Current Giveaway').setURL(messageUrl).setStyle(ButtonStyle.Link)
                )] : [],
                flags: 64
            });
        }

        const entryValues = giveaway.entry_values
            ? (typeof giveaway.entry_values === 'string' ? JSON.parse(giveaway.entry_values) : giveaway.entry_values)
            : null;
        const multiplier = giveaway.multiplier
            ? (typeof giveaway.multiplier === 'string' ? JSON.parse(giveaway.multiplier) : giveaway.multiplier)
            : null;

        let description = '';
        let title = '🎁 Giveaway';
        if (giveaway.template === 'normal') title = '🎮 Triple Game';
        else if (giveaway.template === 'vip') title = '👑 VIP Specials';
        else if (giveaway.template === 'elite') title = '💜 Elite Royale';

        if (entryValues && entryValues.buttons) {
            const periodMap = { daily: 'today', weekly: 'this week', monthly: 'this month' };
            const periodText = periodMap[entryValues.period] || 'this week';
            const lines = entryValues.buttons.map(btn => {
                if (btn.type === 'RN') return `🔑 Special Random Key: ${btn.required} messages`;
                if (btn.type === 'GCS') return `🎁 Special Gift Card: ${btn.required} messages`;
                if (btn.type === 'GCD') return `💎 Hyper Gift Card: ${btn.required} messages`;
                return `${btn.label}: ${btn.required} msgs`;
            });
            const dynamicDesc = `**Messages have sent ${periodText}:**\n${lines.join('\n')}`;
            description = `# ${title}\n\n${dynamicDesc}`;
        } else {
            description = `# ${title}`;
        }

        const config = {
            winnersCount: giveaway.winners_count,
            host: { id: giveaway.host_id, username: 'Host', displayAvatarURL: () => null },
            imageUrl: giveaway.image_url,
            entryType: giveaway.entry_type,
            entryValues: entryValues,
            multiplier: multiplier,
            reqRole: giveaway.reqrole ? { id: giveaway.reqrole } : null,
            banRole: giveaway.banrole ? { id: giveaway.banrole } : null,
            bypassRole: null,
            color: 0x0073ff,
            description: description,
            title: title
        };

        const endsAt = new Date(giveaway.end_time);
        const member = interaction.member;

        const editMainMessage = async (updatedContent) => {
            try {
                const channel = interaction.client.channels.cache.get(giveaway.channel_id);
                if (!channel) return false;
                const mainMsg = await channel.messages.fetch(giveaway.message_id);
                await mainMsg.edit(updatedContent);
                return true;
            } catch (error) {
                console.warn(`⚠️ Failed to edit main message ${giveaway.message_id}:`, error.message);
                return false;
            }
        };

        try {
            // ========== مغادرة ==========
            if (interaction.customId.startsWith(`giveaway_leave_`)) {
                const leaveParts = interaction.customId.split('_');
                const targetId = leaveParts[3];
                const leaveType = leaveParts[4];
                if (interaction.user.id !== targetId) {
                    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ Not for you.')], flags: 64 });
                }

                let result;
                if (leaveType === 'ALL') {
                    result = await dbManager.removeParticipant(giveawayCode, interaction.user.id);
                } else {
                    result = await dbManager.removeParticipant(giveawayCode, interaction.user.id, leaveType);
                }

                if (result.success) {
                    const updated = this.updateGiveawayMessage(config, endsAt, giveawayCode, config.host.id, result.entries);
                    const edited = await editMainMessage(updated);
                    const leaveName = leaveType === 'ALL' ? 'all entries' : getPrizeDisplayName(leaveType);
                    const replyEmbed = new EmbedBuilder().setColor('#00FF00')
                        .setDescription(`✅ You left **${leaveName}**.${edited ? '' : ' (main message update skipped)'}`);

                    if (interaction.message.flags?.has('Ephemeral')) {
                        await interaction.update({ embeds: [replyEmbed], components: [] });
                    } else {
                        await interaction.reply({ embeds: [replyEmbed], flags: 64 });
                    }
                } else {
                    const errorEmbed = new EmbedBuilder().setColor('#FF0000').setDescription('❌ Could not leave.');
                    if (interaction.message.flags?.has('Ephemeral')) {
                        await interaction.update({ embeds: [errorEmbed], components: [] });
                    } else {
                        await interaction.reply({ embeds: [errorEmbed], flags: 64 });
                    }
                }
                return;
            }

            // ========== شراء رسائل ==========
            if (interaction.customId.startsWith(`giveaway_purchase_`)) {
                const purchaseParts = interaction.customId.split('_');
                const userId = purchaseParts[3];
                const needed = parseInt(purchaseParts[4]);
                const period = purchaseParts[5];
                if (interaction.user.id !== userId) {
                    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ Not for you.')], flags: 64 });
                }

                await interaction.deferReply({ flags: 64 });
                const purchase = await purchaseMissingMessages(userId, needed, period);
                if (!purchase.success) {
                    const embed = new EmbedBuilder().setColor('#FF0000')
                        .setDescription(purchase.reason === 'insufficient_coins'
                            ? `❌ Need ${purchase.needed} coins, you have ${purchase.have}.`
                            : '❌ Purchase failed.');
                    return interaction.editReply({ embeds: [embed] });
                }

                const joinRes = await dbManager.addParticipant(giveawayCode, userId, interaction.user.username, 'purchased');
                if (joinRes.success) {
                    const updated = this.updateGiveawayMessage(config, endsAt, giveawayCode, config.host.id, joinRes.entries);
                    const edited = await editMainMessage(updated);
                    const embed = new EmbedBuilder().setColor('#00FF00')
                        .setDescription(`✅ Purchased! You joined.${edited ? '' : ' (main message update skipped)'}`);
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ Purchase succeeded but failed to join.')] });
                }
                return;
            }

            // ========== انضمام ==========
            if (interaction.customId.startsWith(`giveaway_join_`)) {
                let entryType = 'default';
                let roleIdForEntry = null;
                const joinParts = interaction.customId.split('_');
                const btnIndex = parseInt(joinParts[3]);
                const buttonConfig = config.entryValues?.buttons?.[btnIndex] || {};

                if (joinParts[4]) {
                    if (joinParts[4] === 'RN' || joinParts[4] === 'GCS' || joinParts[4] === 'GCD') entryType = joinParts[4];
                    else if (joinParts[4] === 'role') roleIdForEntry = joinParts[5];
                }

                const hasBypass = config.bypassRole && member.roles.cache.has(config.bypassRole.id);

                if (!hasBypass && buttonConfig.roleId && giveaway.template === 'vip') {
                    if (buttonConfig.roleId === BOOSTER_ROLE_ID) {
                        const hasAnyGamer = VIP_ROLES_HIERARCHY.some(rid => member.roles.cache.has(rid));
                        if (hasAnyGamer) {
                            return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ You cannot use the Booster button if you already have a Gamer role.')], flags: 64 });
                        }
                    } else {
                        const requiredRoleIndex = VIP_ROLES_HIERARCHY.indexOf(buttonConfig.roleId);
                        if (requiredRoleIndex !== -1) {
                            for (let i = requiredRoleIndex + 1; i < VIP_ROLES_HIERARCHY.length; i++) {
                                if (member.roles.cache.has(VIP_ROLES_HIERARCHY[i])) {
                                    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription(`❌ You already have a higher Gamer role (<@&${VIP_ROLES_HIERARCHY[i]}>). You cannot join with a lower tier.`)], flags: 64 });
                                }
                            }
                        }
                        if (!member.roles.cache.has(buttonConfig.roleId)) {
                            return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription(`❌ You need the <@&${buttonConfig.roleId}> role for this button.`)], flags: 64 });
                        }
                    }
                } else if (!hasBypass && buttonConfig.roleId) {
                    if (!member.roles.cache.has(buttonConfig.roleId)) {
                        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription(`❌ You need the <@&${buttonConfig.roleId}> role for this button.`)], flags: 64 });
                    }
                }

                if (!hasBypass) {
                    if (config.banRole && member.roles.cache.has(config.banRole.id)) {
                        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ You are banned.')], flags: 64 });
                    }
                    if (config.reqRole && !member.roles.cache.has(config.reqRole.id)) {
                        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription(`❌ Need <@&${config.reqRole.id}>.`)], flags: 64 });
                    }
                    if (BLACKLIST_ROLES.some(roleId => member.roles.cache.has(roleId))) {
                        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ You are blacklisted.')], flags: 64 });
                    }
                }

                const entries = giveaway.entries || {};
                const compositeKey = `${interaction.user.id}:${entryType}`;

                if (entries[compositeKey]) {
                    const row = new ActionRowBuilder();
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`giveaway_leave_${giveawayCode}_${interaction.user.id}_${entryType}`)
                            .setLabel(`Leave ${getPrizeDisplayName(entryType)}`)
                            .setStyle(ButtonStyle.Danger)
                    );

                    const userEntryKeys = Object.keys(entries).filter(key => key.startsWith(`${interaction.user.id}:`));
                    if (userEntryKeys.length > 1) {
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`giveaway_leave_${giveawayCode}_${interaction.user.id}_ALL`)
                                .setLabel('Leave All')
                                .setStyle(ButtonStyle.Danger)
                        );
                    }

                    const reply = await interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#FFFF00')
                            .setDescription(`⚠️ You are already joined in **${getPrizeDisplayName(entryType)}**.\nChoose an option below (expires in 15 seconds).`)],
                        components: [row],
                        flags: 64
                    });

                    setTimeout(() => {
                        reply.delete().catch(() => {});
                    }, 15000);

                    return;
                }

                if (!hasBypass && buttonConfig.required) {
                    const period = config.entryValues?.period || 'weekly';
                    const userMsgs = await getUserMessageCount(interaction.user.id, period);
                    if (userMsgs < buttonConfig.required) {
                        const needed = buttonConfig.required - userMsgs;
                        const cost = needed * 35;
                        const purchaseBtn = new ButtonBuilder()
                            .setCustomId(`giveaway_purchase_${giveawayCode}_${interaction.user.id}_${needed}_${period}`)
                            .setLabel(`Buy ${needed} msgs (${cost} 🪙)`)
                            .setStyle(ButtonStyle.Success);
                        const embed = new EmbedBuilder().setColor('#FFA500')
                            .setDescription(`❌ Need ${buttonConfig.required} msgs (${period}). You have ${userMsgs}. Need ${needed} more.`);
                        return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(purchaseBtn)], flags: 64 });
                    }
                }

                let entryWeight = 1;
                const hasBonusRole = member.roles.cache.has(BONUS_ROLE_ID);

                if (config.multiplier) {
                    if (roleIdForEntry) {
                        entryWeight = config.multiplier[roleIdForEntry] || 1;
                    } else if (buttonConfig.roleId) {
                        entryWeight = config.multiplier[buttonConfig.roleId] || 1;
                    }
                }

                if (giveaway.template === 'vip' && member.roles.cache.has(BOOSTER_ROLE_ID) && buttonConfig.roleId && buttonConfig.roleId !== BOOSTER_ROLE_ID) {
                    entryWeight = Math.round(entryWeight * 1.5);
                }

                if (giveaway.template === 'normal' && hasBonusRole) {
                    entryWeight = entryWeight * 2;
                }

                const addResult = await dbManager.addParticipant(
                    giveawayCode, interaction.user.id, interaction.user.username, entryType, roleIdForEntry || buttonConfig.roleId, entryWeight
                );
                if (!addResult.success) {
                    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription(`❌ ${addResult.error}`)], flags: 64 });
                }

                const updated = this.updateGiveawayMessage(config, endsAt, giveawayCode, config.host.id, addResult.entries);
                const edited = await editMainMessage(updated);
                const embed = new EmbedBuilder().setColor('#00FF00')
                    .setDescription(`✅ Joined **${getPrizeDisplayName(entryType)}**!${edited ? '' : ' (main message update skipped)'}`);
                await interaction.reply({ embeds: [embed], flags: 64 });
                return;
            }

            if (interaction.customId.startsWith(`giveaway_confirm_`) || interaction.customId.startsWith(`giveaway_decline_`)) {
                await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00FF00').setDescription('✅ Response recorded.')], flags: 64 });
                return;
            }

            await interaction.reply({ content: '❓ Unknown button action.', flags: 64 });
        } catch (error) {
            console.error('Button handler error:', error);
            await interaction.reply({ content: '❌ An error occurred.', flags: 64 }).catch(() => {});
        }
    },

    async handleGiveawayEnd(message, giveawayCode, client, config) {
        try {
            const giveaway = await dbManager.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) return;

            const result = await this.endGiveawayWithPrizeTypes(giveawayCode);
            if (!result.success) return;

            const winnersByType = result.winnersByType || {};
            const participantsCount = result.participantsCount || 0;

            const allWinners = Object.values(winnersByType).flat();
            for (const winner of allWinners) {
                try { 
                    await message.guild.members.fetch(winner.userId).then(m => m.roles.add(WINNER_ROLE_ID)); 
                } catch (e) {}
            }

            const endedMessage = this.createEndedGiveawayMessage(config, winnersByType, giveawayCode, participantsCount);
            await message.edit(endedMessage);
        } catch (e) { console.error(e); }
    },

    async endGiveawayWithPrizeTypes(giveawayCode) {
        try {
            const giveaway = await dbManager.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) return { success: false, error: 'Giveaway not found' };

            const entries = giveaway.entries || {};
            const entryList = Object.values(entries);

            if (entryList.length === 0) {
                await dbManager.run(`UPDATE giveaways SET status = 'ended' WHERE giveaway_code = $1`, [giveawayCode]);
                return { success: true, noParticipants: true, participantsCount: 0, winnersByType: {} };
            }

            const entriesByType = {};
            for (const entry of entryList) {
                const type = entry.type;
                if (!entriesByType[type]) entriesByType[type] = [];
                entriesByType[type].push(entry);
            }

            const winnersByType = {};

            for (const [type, typeEntries] of Object.entries(entriesByType)) {
                if (typeEntries.length === 0) continue;

                let weightedList = [];
                for (const entry of typeEntries) {
                    const weight = entry.weight || 1;
                    for (let i = 0; i < weight; i++) {
                        weightedList.push({ userId: entry.userId, type: entry.type });
                    }
                }

                const randomIndex = Math.floor(Math.random() * weightedList.length);
                const winner = weightedList[randomIndex];
                winnersByType[type] = [winner];
            }

            const allWinners = Object.values(winnersByType).flat();

            await dbManager.run(
                `UPDATE giveaways SET status = 'ended', winners = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE giveaway_code = $2`,
                [JSON.stringify(allWinners), giveawayCode]
            );

            const uniqueParticipants = new Set(entryList.map(e => e.userId)).size;
            return { success: true, winnersByType, participantsCount: uniqueParticipants };
        } catch (error) {
            console.error('❌ endGiveawayWithPrizeTypes:', error.message);
            return { success: false, error: error.message };
        }
    },

    createEndedGiveawayMessage(config, winnersByType, giveawayCode, participantsCount) {
        const mainEmbed = new EmbedBuilder()
            .setColor(config.color)
            .setDescription(config.description)
            .addFields(
                { name: 'Ended', value: `This giveaway has ended.`, inline: true },
                { name: '👥 Participants', value: `${participantsCount}`, inline: true },
                { name: '🏆 Winners', value: `${config.winnersCount}`, inline: true }
            );

        if (config.reqRole) mainEmbed.addFields({ name: '✅ Required Role', value: `<@&${config.reqRole.id}>`, inline: true });
        if (config.banRole) mainEmbed.addFields({ name: '⛔ Banned Role', value: `<@&${config.banRole.id}>`, inline: true });
        if (config.bypassRole) mainEmbed.addFields({ name: '⚡ Bypass Role', value: `<@&${config.bypassRole.id}>`, inline: true });
        mainEmbed.addFields({ name: '🎁 Winner will get', value: `<@&${WINNER_ROLE_ID}>`, inline: false });
        const blacklistMentions = BLACKLIST_ROLES.map(id => `<@&${id}>`).join(', ') || 'None';
        mainEmbed.addFields({ name: '🚫 Blacklist', value: blacklistMentions, inline: false });

        if (config.imageUrl) mainEmbed.setImage(config.imageUrl);
        mainEmbed.setFooter({ text: `${config.host.username} | ID: ${giveawayCode}`, iconURL: config.host.displayAvatarURL({ dynamic: true }) });

        let winnerList = '';
        for (const [type, winners] of Object.entries(winnersByType)) {
            const prizeName = getPrizeDisplayName(type);
            for (const winner of winners) {
                winnerList += `• <@${winner.userId}> won **${prizeName}**\n`;
            }
        }
        if (!winnerList) winnerList = '❌ No winners.';

        const winnerEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🎉 Congrats To The Winners')
            .setDescription(winnerList)
            .setFooter({ text: 'Low Effort & Failed Steam Verification ➠ Reroll' });

        return { embeds: [mainEmbed, winnerEmbed], components: [] };
    },

    setupConfirmCollector(message, giveawayCode, client) {
        const filter = i => i.customId.startsWith(`giveaway_confirm_${giveawayCode}`) || i.customId.startsWith(`giveaway_decline_${giveawayCode}`);
        const collector = message.createMessageComponentCollector({ filter });
        collector.on('collect', async i => {
            await i.reply({ embeds: [new EmbedBuilder().setColor('#00FF00').setDescription('✅ Response recorded.')], flags: 64 });
        });
    },

    async handleReroll(interaction, code) {
        const g = await dbManager.getGiveawayByCode(code);
        if (!g) return interaction.editReply('❌ Not found.');

        const result = await this.endGiveawayWithPrizeTypes(code);
        if (!result.success) return interaction.editReply('❌ Reroll failed.');

        const winnersByType = result.winnersByType || {};
        const winnerMentions = [];
        for (const [type, winners] of Object.entries(winnersByType)) {
            for (const winner of winners) {
                winnerMentions.push(`<@${winner.userId}> (${getPrizeDisplayName(type)})`);
            }
        }

        return interaction.editReply(`✅ Rerolled! New winners: ${winnerMentions.join(', ')}`);
    },

    async handleEnd(interaction, code) {
        const g = await dbManager.getActiveGiveawayByCode(code);
        if (!g) return interaction.editReply('❌ Not active.');

        const result = await this.endGiveawayWithPrizeTypes(code);
        if (!result.success) return interaction.editReply('❌ Failed to end giveaway.');

        return interaction.editReply(`✅ Ended \`${code}\`.`);
    },

    // تصدير دوال الجدولة لاستخدامها في GiveawaysBack
    restoreScheduledGiveaways,
    publishScheduledGiveaway
};