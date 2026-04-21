const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');
const dbManager = require('../Data/database');
const parseDuration = require('../System/durationParser');

// ========== CONSTANTS ==========
const GIVEAWAY_LOG_CHANNEL_ID = '1385531928446373970';
const WINNER_ROLE_ID = '1377112815600406618';
const TIER_3_ROLE_ID = '1465705698989179030';
const DEFAULT_HOST_ID = '1363733513081454774';

const GAMER_1_ID = '1363754810645417994';
const GAMER_2_ID = '1363754894888013846';
const BOOSTER_ROLE_ID = '1374313963428253847';
const GAMER_3_ID = '1363754940710916187';
const GAMER_4_ID = '1363754996793085972';
const GAMER_5_ID = '1491491999147229447';
const TIER_5_ID = '1465785463984886045';

const SKYWELL_LVL1_ID = '1465705164139794443';
const SKYWELL_LVL2_ID = '1465705207760556186';
const SKYWELL_LVL3_ID = '1465705232280453283';
const SKYWELL_LVL4_ID = '1465705263209123975';
const SKYWELL_LVL5_ID = '1465705294234652736';

const VIP_ROLES_HIERARCHY = [GAMER_1_ID, GAMER_2_ID, GAMER_3_ID, GAMER_4_ID];

// جميع رولات الـ VIP gamers في array
const VIP_GAMER_ROLE_IDS = [GAMER_1_ID, GAMER_2_ID, GAMER_3_ID, GAMER_4_ID];

// جميع رولات الـ Skywell في array مرتبة من الأقل للأعلى
const SKYWELL_ROLE_IDS = [SKYWELL_LVL1_ID, SKYWELL_LVL2_ID, SKYWELL_LVL3_ID, SKYWELL_LVL4_ID, SKYWELL_LVL5_ID];

/**
 * DEFAULT_BLACKLIST_ROLES:
 * يتم تطبيقها دايمًا إلا لو المستخدم دخل blacklist مخصصة → تحل محلها
 */
const DEFAULT_BLACKLIST_ROLES = ['1380141514293776466'];
const LRM = '\u200E';

const previewSessions = new Map();
const scheduledTimeouts = new Map();

// ========== HELPERS ==========

/**
 * تحويل نص يحتوي على منشنات رول مثل "<@&123>, <@&456>" إلى مصفوفة IDs
 * يدعم أيضًا الـ mode في الآخر: "@Role1, @Role2 y" أو "@Role1, @Role2 n"
 * يرجع { ids: string[], mode: 'y'|'n' }
 * mode 'y' = لازم الشخص يكون معاه كل الرولات
 * mode 'n' = واحدة على الأقل (الافتراضي)
 */
function parseRoleIdsFromString(input) {
    if (!input) return { ids: [], mode: 'n' };

    let text = input.trim();
    let mode = 'n';

    // نشوف لو آخر كلمة هي y أو n
    const modeMatch = text.match(/\s+([yn])$/i);
    if (modeMatch) {
        mode = modeMatch[1].toLowerCase();
        text = text.slice(0, -modeMatch[0].length).trim();
    }

    const matches = text.match(/<@&(\d+)>/g) || [];
    const ids = matches.map(m => m.replace(/[<@&>]/g, ''));

    return { ids, mode };
}

/**
 * فحص إذا كان المستخدم يملك الرولات المطلوبة بناءً على الـ mode
 * mode 'y' = لازم كل الرولات
 * mode 'n' = واحدة على الأقل (افتراضي)
 */
function checkRoles(memberRoles, roleIds, mode = 'n') {
    if (!roleIds.length) return true;
    if (mode === 'y') {
        return roleIds.every(id => memberRoles.has(id));
    }
    return roleIds.some(id => memberRoles.has(id));
}

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

    const cost = needed * 55;
    if (profile.sky_coins < cost) {
        return { success: false, reason: 'insufficient_coins', needed: cost, have: profile.sky_coins };
    }

    await dbManager.run(`UPDATE levels SET sky_coins = sky_coins - $1 WHERE user_id = $2`, [cost, userId]);

    const column = period === 'daily'
        ? 'daily_sent'
        : period === 'weekly'
            ? 'weekly_sent'
            : 'monthly_sent';

    await dbManager.run(
        `UPDATE message_stats SET ${column} = ${column} - $1 WHERE user_id = $2`,
        [needed, userId]
    );

    return { success: true, cost };
}

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseColor(colorInput) {
    if (!colorInput) return 0x0073ff;

    if (colorInput.startsWith('#')) {
        const hex = colorInput.slice(1);
        if (/^[0-9A-Fa-f]{6}$/.test(hex)) return parseInt(hex, 16);
    }

    const colorNames = {
        RED: 0xed4245,
        GREEN: 0x57f287,
        BLUE: 0x3498db,
        YELLOW: 0xfee75c,
        PURPLE: 0x9b59b6,
        ORANGE: 0xe67e22,
        PINK: 0xeb459e,
        GOLD: 0xf1c40f
    };

    if (colorNames[colorInput.toUpperCase()]) return colorNames[colorInput.toUpperCase()];

    const num = parseInt(colorInput, 10);
    if (!isNaN(num)) return num;

    return 0x0073ff;
}

function parseMultiplierInput(input) {
    if (!input) return null;

    const map = {};
    const parts = input.split(',').map(p => p.trim()).filter(Boolean);

    for (const part of parts) {
        const [rawRole, rawWeight] = part.split(':').map(v => v.trim());
        if (!rawRole || !rawWeight) continue;

        const roleId = rawRole.replace(/[<@&>]/g, '');
        const weight = parseInt(rawWeight, 10);

        if (!roleId || isNaN(weight) || weight < 1) continue;
        map[roleId] = weight;
    }

    return Object.keys(map).length ? map : null;
}

const PRIZE_NAMES = {
    RN: 'Random Key',
    GCS: 'Special Gift Card',
    GCD: 'Discord Gift Card',
    SINGLE: 'Prize'
};

function getPrizeDisplayName(type) {
    if (!type) return 'Prize';
    if (type.startsWith('CUSTOM_')) return 'Custom Prize';
    if (type.startsWith('role_')) return 'Role Entry';
    if (type === 'VIP_GAMERS') return 'Gamers';
    if (type === 'VIP_BOOSTERS') return 'Boosters';
    if (type === 'SKYWELL_JOIN') return 'SkyWell';
    return PRIZE_NAMES[type] || type;
}

function parseCustomId(customId) {
    const parts = customId.split('_');
    if (parts.length < 3) return { action: '', code: '', rest: '' };
    return {
        action: parts[1],
        code: parts[2],
        rest: parts.slice(3).join('_')
    };
}

function parseJsonField(field) {
    if (!field) return null;
    if (typeof field === 'string') {
        try {
            return JSON.parse(field);
        } catch {
            return null;
        }
    }
    return field;
}

function getPeriodLabel(period) {
    const map = {
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly'
    };
    return map[period] || 'Weekly';
}

function buildExtraEntriesLines(multiplier) {
    if (!multiplier || typeof multiplier !== 'object' || !Object.keys(multiplier).length) return [];

    const items = Object.entries(multiplier)
        .filter(([, weight]) => Number(weight) > 1)
        .map(([roleId, weight]) => `<@&${roleId}>: **${weight}** entries`);

    if (!items.length) return [];
    return ['**Extra Entries:**', ...items.map(item => `• ${item}`)];
}

function buildRequirementsLines(entryValues) {
    if (!entryValues?.buttons?.length) return [];

    const period = entryValues.period || 'weekly';
    const periodLabel = getPeriodLabel(period).toLowerCase();

    const map = new Map();
    for (const btn of entryValues.buttons) {
        const required = btn.required || 0;
        if (required <= 0) continue;

        const prizeName = btn.label || getPrizeDisplayName(btn.type);
        if (!map.has(required)) map.set(required, []);
        map.get(required).push(prizeName);
    }

    if (map.size === 0) return [];

    const lines = ['Messages Sent:'];
    const sorted = Array.from(map.keys()).sort((a, b) => a - b);

    for (const req of sorted) {
        const prizes = map.get(req);
        if (prizes.length === 1) {
            lines.push(`• ${req} ${periodLabel} messages ➠ ${prizes[0]}`);
        } else {
            lines.push(`• ${req} ${periodLabel} messages`);
        }
    }

    return lines;
}

/**
 * بناء الـ description مع دعم الـ mode لكل نوع رول
 * reqRoleMode: 'y' = كل الرولات مطلوبة، 'n' = واحدة كافية
 * bypassRoleMode: 'y' = كل الرولات مطلوبة للـ bypass، 'n' = واحدة كافية
 */
function buildDescriptionFromEntryValues(
    entryValues,
    title,
    extraDescription = '',
    reqRoleIds = [],
    bypassRoleIds = [],
    multiplier = null,
    banRoleIds = [],
    reqRoleMode = 'n',
    bypassRoleMode = 'n'
) {
    const lines = [`## ${title}`];

    if (extraDescription?.trim()) {
        lines.push('', extraDescription.trim());
    }

    const blacklistText = banRoleIds.length ? banRoleIds.map(id => `<@&${id}>`).join(', ') : 'None';

    lines.push(`Winner Will Get: <@&${WINNER_ROLE_ID}>`);
    lines.push(`Blacklisted: ${blacklistText}`);

    if (reqRoleIds.length) {
        const reqModeLabel = (reqRoleIds.length > 1)
            ? (reqRoleMode === 'y' ? ' `all`' : ' `any`')
            : '';
        lines.push('', `Required${reqModeLabel}: ${reqRoleIds.map(id => `<@&${id}>`).join(', ')}`);
    }

    if (bypassRoleIds.length) {
        const bypassModeLabel = (bypassRoleIds.length > 1)
            ? (bypassRoleMode === 'y' ? ' `all`' : ' `any`')
            : '';
        lines.push(`Bypass${bypassModeLabel}: ${bypassRoleIds.map(id => `<@&${id}>`).join(', ')}`);
    }

    const extraEntriesLines = buildExtraEntriesLines(multiplier);
    if (extraEntriesLines.length) {
        lines.push('', ...extraEntriesLines);
    }

    const requirementsLines = buildRequirementsLines(entryValues);
    if (requirementsLines.length) {
        lines.push('', ...requirementsLines);
    }

    return lines.join('\n');
}

function formatWinnerLine(userId, prizeName) {
    if (!prizeName || prizeName === 'Prize' || prizeName === 'prize' || prizeName === 'the giveaway') {
        return `### • ${LRM}<@${userId}> ${LRM}won **the giveaway**!`;
    }
    return `### • ${LRM}<@${userId}> ${LRM}won **${prizeName}**!`;
}

async function publishScheduledGiveaway(giveawayCode, client) {
    console.log(`🚀 [PUBLISH] ${giveawayCode}`);
    try {
        scheduledTimeouts.delete(giveawayCode);

        const giveaway = await dbManager.getGiveawayByCode(giveawayCode);
        if (!giveaway || giveaway.status !== 'scheduled') return;

        const channel = client.channels.cache.get(giveaway.channel_id) || await client.channels.fetch(giveaway.channel_id).catch(() => null);
        if (!channel) return;

        const giveawayCommand = client.commands.get('giveaway');
        if (!giveawayCommand) return;

        const config = giveawayCommand.buildConfigFromGiveaway(giveaway);
        const endsAt = new Date(giveaway.end_time);

        const host = await client.users.fetch(giveaway.host_id).catch(() => ({
            id: giveaway.host_id,
            username: giveaway.host_name || 'Host',
            displayAvatarURL: () => null
        }));

        const messageData = giveawayCommand.createGiveawayMessage(config, endsAt, giveawayCode, host, giveaway.entries || {});
        const message = await channel.send(messageData);

        await dbManager.activateScheduledGiveaway(giveawayCode, message.id, channel.id);

        giveawayCommand.setupJoinCollector(message, giveawayCode, endsAt, config, client);
        giveawayCommand.setupConfirmCollector(message, giveawayCode, client);

        console.log(`✅ Published: ${giveawayCode}`);
    } catch (error) {
        console.error(`❌ Publish failed ${giveawayCode}:`, error);
    }
}

async function restoreScheduledGiveaways(client) {
    try {
        const ready = await dbManager.getScheduledGiveawaysReadyToStart();
        for (const gw of ready) await publishScheduledGiveaway(gw.giveaway_code, client);

        const pending = await dbManager.getPendingScheduledGiveaways();
        for (const gw of pending) {
            const delay = Math.max(0, new Date(gw.schedule).getTime() - Date.now());
            const timeoutId = setTimeout(() => publishScheduledGiveaway(gw.giveaway_code, client), delay);
            scheduledTimeouts.set(gw.giveaway_code, timeoutId);
        }

        console.log(`✅ Restored: ${ready.length} published, ${pending.length} pending`);
    } catch (error) {
        console.error('❌ Restore error:', error);
    }
}

// ========== COMPONENTS V2 BUILDERS ==========

function buildWinnersV2Message(winnerListText, giveawayCode, color, winnerIds, giveawayTitle = 'Giveaway') {
    const container = new ContainerBuilder()
        .setAccentColor(color || 0x00ff00);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## 🎉 **${giveawayTitle} Winners!**`)
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(winnerListText)
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ID: \`${giveawayCode}\`\nLow Effort & Failed Steam Verification ➠ Reroll`)
    );

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
            users: [...new Set(winnerIds)]
        }
    };
}

function buildNoWinnersV2Message(giveawayCode, color) {
    const container = new ContainerBuilder()
        .setAccentColor(color || 0xED4245);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## ❌ **No winners found!**')
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('No eligible participants were found for this giveaway')
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ID: \`${giveawayCode}\``)
    );

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { users: [] }
    };
}

function buildRerollV2Message(winnerListText, giveawayCode, color, rerolledUsers, newWinnerIds, giveawayTitle = 'Giveaway') {
    const container = new ContainerBuilder()
        .setAccentColor(color || 0x00ff00);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## 🎉 **${giveawayTitle} | New Winners!**`)
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    if (rerolledUsers?.length) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Rerolled:** ${rerolledUsers.map(id => `<@${id}>`).join(', ')}`
            )
        );
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(winnerListText)
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ID: \`${giveawayCode}\`\nLow Effort & Failed Steam Verification ➠ Reroll`)
    );

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
            users: [...new Set(newWinnerIds)]
        }
    };
}

// ========== MODULE ==========

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Create a giveaway (Admins only)')
        .addStringOption(opt => opt.setName('template').setDescription('Template').setRequired(false).addChoices(
            { name: 'Discord Special Drop', value: 'normal' },
            { name: 'VIP 5$ Gift Card Giveaway', value: 'vip' },
            { name: 'Sky Royale Giveaway', value: 'elite' },
            { name: 'SkyWell Exclusive Giveaways', value: 'skywell' }
        ))
        .addStringOption(opt => opt.setName('title').setDescription('Title').setRequired(false))
        .addStringOption(opt => opt.setName('description').setDescription('Description').setRequired(false))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g., 2d, 1h 30m)').setRequired(false))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners (1-25)').setMinValue(1).setMaxValue(25).setRequired(false))
        .addUserOption(opt => opt.setName('host').setDescription(`Host (default: <@${DEFAULT_HOST_ID}>)`).setRequired(false))
        .addStringOption(opt => opt.setName('image').setDescription('Image URL (optional)').setRequired(false))
        .addStringOption(opt => opt.setName('scheduled').setDescription('Scheduled the giveaway (e.g., 7d 10h)').setRequired(false))
        .addChannelOption(opt => opt.setName('schedule_channel').setDescription('Channel for scheduled').setRequired(false))
        .addStringOption(opt => opt
            .setName('bypass_role')
            .setDescription('Bypass roles (e.g. @R1, @R2 y = ALL bypass, without y = ANY)')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('required_role')
            .setDescription('Required roles (e.g. @R1, @R2 y = ALL required, without y = ANY)')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('blacklist')
            .setDescription('Banned roles (e.g. @R1, @R2 replaces default blacklist)')
            .setRequired(false))
        .addStringOption(opt => opt.setName('multiple_chance').setDescription('Role weights like @role:2,@role:4').setRequired(false))
        .addStringOption(opt => opt.setName('prizes').setDescription('Custom prizes (e.g. Prize1, Prize2, Prize3)').setRequired(false))
        .addStringOption(opt => opt.setName('messages_duration').setDescription('Period (daily/weekly/monthly)').setRequired(false).addChoices(
            { name: 'Daily', value: 'daily' },
            { name: 'Weekly', value: 'weekly' },
            { name: 'Monthly', value: 'monthly' }
        ))
        .addStringOption(opt => opt.setName('number_of_messages').setDescription('Comma-separated message requirements').setRequired(false))
        .addStringOption(opt => opt.setName('color').setDescription('Embed color').setRequired(false)),

    buildResultEmbed(color, title, description) {
        return new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description);
    },

    async safeReply(interaction, payload) {
        try {
            if (interaction.deferred || interaction.replied) {
                return await interaction.followUp({ ...payload, flags: payload.flags ?? 64 });
            }
            return await interaction.reply(payload);
        } catch (error) {
            if (error.code === 40060 || error.code === 10062) return null;
            throw error;
        }
    },

    async safeUpdate(interaction, payload) {
        try {
            if (interaction.deferred || interaction.replied) {
                if (interaction.editReply) return await interaction.editReply(payload);
                return null;
            }
            return await interaction.update(payload);
        } catch (error) {
            if (error.code === 40060 || error.code === 10062) return null;
            throw error;
        }
    },

    buildLeaveButton(giveawayCode, userId, entryType, label = 'Leave Entry') {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`giveaway_leave_${giveawayCode}_${userId}_${entryType}`)
                .setLabel(label)
                .setStyle(ButtonStyle.Danger)
        );
    },

    buildPreviewRows(previewId) {
        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`giveaway_preview_${previewId}_yes`)
                    .setLabel('Yes')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`giveaway_preview_${previewId}_no`)
                    .setLabel('No')
                    .setStyle(ButtonStyle.Danger)
            )
        ];
    },

    getPrizeLabelFromConfig(entryType, config, entries = null, userId = null) {
        if (entries && userId) {
            const stored = entries[`${userId}:${entryType}`];
            if (stored?.prizeLabel) return stored.prizeLabel;
        }

        if (entryType.startsWith('CUSTOM_') && config.entryValues?.buttons) {
            const btn = config.entryValues.buttons.find(b => b.type === entryType);
            if (btn?.label) return btn.label;
        }

        if (entryType === 'SINGLE' && config.entryValues?.buttons?.[0]?.label) {
            return config.entryValues.buttons[0].label;
        }

        if (entryType.startsWith('role_') && config.entryValues?.buttons) {
            const btn = config.entryValues.buttons.find(b => `role_${b.roleId}` === entryType);
            if (btn?.label) return btn.label;
        }

        if (entryType === 'VIP_GAMERS') return 'Gamers';
        if (entryType === 'VIP_BOOSTERS') return 'Boosters';
        if (entryType === 'SKYWELL_JOIN') return 'SkyWell';

        return getPrizeDisplayName(entryType);
    },

    async resolveHostUser(client, hostId, hostName = 'Host') {
        return await client.users.fetch(hostId).catch(() => ({
            id: hostId,
            username: hostName || 'Host',
            displayAvatarURL: () => null
        }));
    },

    buildCreatePayload(interaction, host, scheduleChannel, template, config, endsAt, scheduledTime) {
        return { interaction, host, scheduleChannel, template, config, endsAt, scheduledTime };
    },

    async finalizeGiveawayCreation(payload) {
        const { interaction, host, scheduleChannel, template, config, endsAt, scheduledTime } = payload;

        const giveawayCode = this.generateGiveawayCode();

        let message = null;
        if (!scheduledTime) {
            message = await scheduleChannel.send(this.createGiveawayMessage(config, endsAt, giveawayCode, host, {}));
        }

        const result = await dbManager.createGiveaway({
            giveawayCode,
            template,
            title: config.title,
            description: config.description,
            color: config.color,
            duration: config.duration,
            endsAt: endsAt.toISOString(),
            winnersCount: config.winnersCount,
            entryType: 'messages',
            entryValues: config.entryValues ? JSON.stringify(config.entryValues) : null,
            multiplier: config.multiplier ? JSON.stringify(config.multiplier) : null,
            reqRoleIds: config.reqRoleIds || [],
            reqRoleMode: config.reqRoleMode || 'n',
            banRoleIds: config.banRoleIds || [],
            bypassRoleIds: config.bypassRoleIds || [],
            bypassRoleMode: config.bypassRoleMode || 'n',
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
            if (message) await message.delete().catch(() => { });
            return {
                success: false,
                embed: this.buildResultEmbed(0xED4245, 'Creation Failed', '❌ Failed to create giveaway')
            };
        }

        if (scheduledTime) {
            const delay = scheduledTime.getTime() - Date.now();
            const tid = setTimeout(() => publishScheduledGiveaway(giveawayCode, interaction.client), delay);
            scheduledTimeouts.set(giveawayCode, tid);

            return {
                success: true,
                embed: this.buildResultEmbed(
                    0x57F287,
                    '✅ Scheduled!',
                    `**Code:** \`${giveawayCode}\`\n**Starts:** <t:${Math.floor(scheduledTime.getTime() / 1000)}:R>\n**Channel:** ${scheduleChannel}`
                )
            };
        }

        await this.sendToLogChannel(interaction, config, giveawayCode, endsAt, host, message.channel, message.id);
        this.setupJoinCollector(message, giveawayCode, endsAt, config, interaction.client);
        this.setupConfirmCollector(message, giveawayCode, interaction.client);

        return {
            success: true,
            embed: this.buildResultEmbed(
                0x57F287,
                '✅ Giveaway Created',
                `**Code:** \`${giveawayCode}\`\n**Channel:** ${scheduleChannel}\n**Winners:** ${config.winnersCount}`
            )
        };
    },

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const moderateRoleData = await dbManager.getBotSetting('moderateRole');
            if (!moderateRoleData) return interaction.editReply('❌ Set `/setrole` first');

            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);

            if (!member.roles.cache.has(roleInfo.id)) {
                return interaction.editReply(`⛔ Only <@&${roleInfo.id}> can use this`);
            }

            const template = interaction.options.getString('template') || 'normal';
            const titleInput = interaction.options.getString('title');
            const descriptionInput = interaction.options.getString('description');
            const durationInput = interaction.options.getString('duration') || '7d';
            let winnersInput = interaction.options.getInteger('winners');
            const hostUser = interaction.options.getUser('host');
            const host = hostUser || await interaction.client.users.fetch(DEFAULT_HOST_ID).catch(() => interaction.user);
            const imageUrl = interaction.options.getString('image');
            const scheduledInput = interaction.options.getString('scheduled');
            const scheduleChannel = interaction.options.getChannel('schedule_channel') || interaction.channel;
            const prizesInput = interaction.options.getString('prizes');
            const reqMessagesType = interaction.options.getString('messages_duration');
            const reqMessagesAmountRaw = interaction.options.getString('number_of_messages');
            const colorInput = interaction.options.getString('color');
            const multipleChanceInput = interaction.options.getString('multiple_chance');

            const bypassRolesInput = interaction.options.getString('bypass_role');
            const reqRolesInput = interaction.options.getString('required_role');
            const banRolesInput = interaction.options.getString('blacklist');

            const { ids: bypassRoleIds, mode: bypassRoleMode } = parseRoleIdsFromString(bypassRolesInput);
            const { ids: reqRoleIds, mode: reqRoleMode } = parseRoleIdsFromString(reqRolesInput);

            const { ids: customBanRoleIds } = parseRoleIdsFromString(banRolesInput);
            const banRoleIds = customBanRoleIds.length > 0 ? customBanRoleIds : DEFAULT_BLACKLIST_ROLES;

            const templateData = this.getTemplateData(template);
            if (!templateData) return interaction.editReply(`❌ Template "${template}" not found`);

            const customMultiplier = parseMultiplierInput(multipleChanceInput);

            let customEntryValues = null;
            let isSingleButton = false;

            if (prizesInput) {
                const prizesList = prizesInput.split(',').map(p => p.trim()).filter(Boolean);
                if (prizesList.length > 25) return interaction.editReply('❌ Max 25 prizes');

                let reqsArray = [];
                if (reqMessagesAmountRaw) {
                    reqsArray = reqMessagesAmountRaw.split(',').map(v => {
                        const n = parseInt(v.trim(), 10);
                        return isNaN(n) ? 0 : n;
                    });
                }

                const period = reqMessagesType || 'weekly';
                customEntryValues = {
                    period,
                    buttons: prizesList.map((prize, idx) => ({
                        type: `CUSTOM_${idx}`,
                        label: prize,
                        required: idx < reqsArray.length ? reqsArray[idx] : 0
                    }))
                };

                if (winnersInput !== null && winnersInput !== prizesList.length) {
                    return interaction.editReply(`❌ Winners must equal number of prizes (${prizesList.length})`);
                }

                winnersInput = prizesList.length;
            } else if (titleInput || descriptionInput || winnersInput) {
                isSingleButton = true;
                let singleReq = 0;

                if (reqMessagesAmountRaw) {
                    const firstVal = parseInt(reqMessagesAmountRaw.split(',')[0].trim(), 10);
                    if (!isNaN(firstVal)) singleReq = firstVal;
                }

                const period = reqMessagesType || 'weekly';
                customEntryValues = {
                    period,
                    buttons: [{
                        type: 'SINGLE',
                        label: 'Join',
                        required: singleReq
                    }]
                };

                if (!winnersInput || winnersInput < 1) winnersInput = 1;
            }

            const processedEntryValues = this.processEntryValues(templateData.entryValues);
            const embedColor = parseColor(colorInput) || templateData.color;

            const config = this.mergeConfig({
                templateData,
                title: titleInput,
                description: descriptionInput,
                duration: durationInput,
                winnersCount: winnersInput,
                host,
                imageUrl,
                bypassRoleIds,
                bypassRoleMode,
                reqRoleIds,
                reqRoleMode,
                banRoleIds,
                processedEntryValues,
                customEntryValues,
                embedColor,
                isSingleButton,
                customMultiplier
            });

            const durationMs = parseDuration(config.duration);
            if (!durationMs) return interaction.editReply('❌ Invalid duration');

            let scheduledTime = null;
            if (scheduledInput) {
                const delayMs = parseDuration(scheduledInput);
                if (!delayMs) return interaction.editReply('❌ Invalid scheduled format');
                scheduledTime = new Date(Date.now() + delayMs);
            }

            const endsAt = new Date((scheduledTime || new Date()).getTime() + durationMs);

            const previewId = Math.random().toString(36).slice(2, 10).toUpperCase();
            previewSessions.set(previewId, this.buildCreatePayload(interaction, host, scheduleChannel, template, config, endsAt, scheduledTime));

            return interaction.editReply({
                content: '**Preview this giveaway**\nIf it looks good, press `Yes`, and if not, press `No`',
                embeds: [this.createGiveawayEmbed(config, endsAt, 'PREVIEW', host, {}, false)],
                components: this.buildPreviewRows(previewId)
            });
        } catch (error) {
            console.error('❌ giveaway execute error:', error);
            await interaction.editReply('❌ Error creating giveaway').catch(() => { });
        }
    },

    buildConfigFromGiveaway(giveaway) {
        const entryValues = parseJsonField(giveaway.entry_values);
        const multiplier = parseJsonField(giveaway.multiplier);

        let fallbackTitle = '🎁 Giveaway';
        if (giveaway.template === 'normal') fallbackTitle = 'Discord Special Drop';
        else if (giveaway.template === 'vip') fallbackTitle = 'VIP 5$ Gift Card Giveaway';
        else if (giveaway.template === 'elite') fallbackTitle = 'Sky Royale Giveaway';
        else if (giveaway.template === 'skywell') fallbackTitle = 'SkyWell Exclusive Giveaways';

        const title = giveaway.title || fallbackTitle;
        const reqRoleIds = giveaway.reqrole || [];
        const reqRoleMode = giveaway.req_role_mode || 'n';
        const bypassRoleIds = giveaway.bypass_role_id || [];
        const bypassRoleMode = giveaway.bypass_role_mode || 'n';
        const rawBanRoles = giveaway.banrole || [];
        const banRoleIds = rawBanRoles.length > 0 ? rawBanRoles : DEFAULT_BLACKLIST_ROLES;

        return {
            title,
            winnersCount: giveaway.winners_count,
            host: {
                id: giveaway.host_id,
                username: giveaway.host_name || 'Host',
                displayAvatarURL: () => null
            },
            imageUrl: giveaway.image_url || null,
            entryValues,
            multiplier,
            reqRoleIds,
            reqRoleMode,
            banRoleIds,
            bypassRoleIds,
            bypassRoleMode,
            color: giveaway.color || 0x0073ff,
            description: giveaway.description || buildDescriptionFromEntryValues(
                entryValues, title, '',
                reqRoleIds, bypassRoleIds, multiplier, banRoleIds,
                reqRoleMode, bypassRoleMode
            )
        };
    },

    getTemplateData(templateName) {
        const templates = {
            normal: {
                title: 'Discord Special Drop',
                color: 0x0073ff,
                winnersCount: 3,
                entryValues: {
                    period: 'daily',
                    buttons: [
                        { type: 'RN', label: 'Random Key', min: 5, max: 10 },
                        { type: 'GCS', label: 'Special Gift Card', min: 10, max: 15 },
                        { type: 'GCD', label: 'Discord Gift Card', min: 15, max: 25 }
                    ]
                },
                multiplier: { [TIER_3_ROLE_ID]: 2 },
                imageUrl: 'https://cdn.discordapp.com/attachments/1391115389718761565/1483958140725624852/GIFT_CARD_5_2.png?ex=69e7fcb7&is=69e6ab37&hm=ecbef5f5e40447b16d9b5ce491c43c911ba28e6de7bdba3237539e41dca2a9c9&'
            },
            // ===== VIP: زرار واحد (SINGLE) =====
            vip: {
                title: 'VIP 5$ Gift Card Giveaway',
                color: 0xFFD700,
                winnersCount: 2,
                entryValues: {
                    period: 'daily',
                    min: 10,
                    max: 20,
                    buttons: [
                        { type: 'SINGLE', label: 'Join' }
                    ]
                },
                multiplier: {
                    [GAMER_1_ID]: 2,
                    [GAMER_2_ID]: 4,
                    [BOOSTER_ROLE_ID]: 6,
                    [GAMER_3_ID]: 8,
                    [GAMER_4_ID]: 10
                },
                imageUrl: 'https://cdn.discordapp.com/attachments/1391115389718761565/1483958140725624852/GIFT_CARD_5_2.png?ex=69e7fcb7&is=69e6ab37&hm=ecbef5f5e40447b16d9b5ce491c43c911ba28e6de7bdba3237539e41dca2a9c9&'
            },
            elite: {
                title: 'Sky Royale Giveaway',
                color: 0x9B59B6,
                winnersCount: 1,
                entryValues: {
                    period: 'weekly',
                    min: 10,
                    max: 25,
                    buttons: [
                        { type: 'ELITE_GIFT_CARD', label: 'Gift Card', requiredRole: null },
                        { type: 'ELITE_CHOSEN_KEY', label: 'Chosen Key', requiredRole: null }
                    ]
                },
                multiplier: { [GAMER_5_ID]: 5, [TIER_5_ID]: 10 },
                imageUrl: 'https://cdn.discordapp.com/attachments/1391115389718761565/1483958140725624852/GIFT_CARD_5_2.png?ex=69e7fcb7&is=69e6ab37&hm=ecbef5f5e40447b16d9b5ce491c43c911ba28e6de7bdba3237539e41dca2a9c9&'
            },
            // ===== SKYWELL: زرار واحد بدل 5 =====
            skywell: {
                title: 'SkyWell Exclusive Giveaways',
                color: 0x00BFFF,
                winnersCount: 1,
                entryValues: {
                    period: 'weekly',
                    buttons: [
                        { type: 'SKYWELL_JOIN', label: 'Join', required: 0 }
                    ]
                },
                multiplier: {
                    [SKYWELL_LVL1_ID]: 2,
                    [SKYWELL_LVL2_ID]: 4,
                    [SKYWELL_LVL3_ID]: 6,
                    [SKYWELL_LVL4_ID]: 8,
                    [SKYWELL_LVL5_ID]: 10
                },
                imageUrl: 'https://cdn.discordapp.com/attachments/1391115389718761565/1483958140725624852/GIFT_CARD_5_2.png?ex=69e7fcb7&is=69e6ab37&hm=ecbef5f5e40447b16d9b5ce491c43c911ba28e6de7bdba3237539e41dca2a9c9&'
            }
        };

        return templates[templateName] || null;
    },

    processEntryValues(entryValues) {
        if (!entryValues) return null;

        const hasMinMax = entryValues.min !== undefined && entryValues.max !== undefined;
        const buttonsHaveMinMax = entryValues.buttons?.some(btn => btn.min !== undefined || btn.max !== undefined);

        if (!hasMinMax && !buttonsHaveMinMax) {
            return {
                period: entryValues.period || 'weekly',
                buttons: entryValues.buttons.map(btn => ({ ...btn }))
            };
        }

        if (hasMinMax) {
            const required = randomBetween(entryValues.min, entryValues.max);
            return {
                period: entryValues.period || 'weekly',
                buttons: entryValues.buttons.map(btn => ({ ...btn, required }))
            };
        }

        return {
            period: entryValues.period || 'weekly',
            buttons: entryValues.buttons.map(btn => ({
                ...btn,
                required: randomBetween(btn.min || 0, btn.max || 0)
            }))
        };
    },

    mergeConfig({
        templateData, title, description, duration, winnersCount, host,
        imageUrl, bypassRoleIds, bypassRoleMode, reqRoleIds, reqRoleMode,
        banRoleIds, processedEntryValues, customEntryValues, embedColor,
        isSingleButton, customMultiplier
    }) {
        const finalEntryValues = customEntryValues || processedEntryValues;
        const finalTitle = title || templateData.title;
        let finalWinners = winnersCount || templateData.winnersCount;

        if (isSingleButton && !finalWinners) finalWinners = 1;

        const finalMultiplier = customMultiplier || templateData.multiplier || null;
        const finalReqMode = reqRoleMode || 'n';
        const finalBypassMode = bypassRoleMode || 'n';

        return {
            title: finalTitle,
            description: buildDescriptionFromEntryValues(
                finalEntryValues,
                finalTitle,
                description || '',
                reqRoleIds || [],
                bypassRoleIds || [],
                finalMultiplier,
                banRoleIds || [],
                finalReqMode,
                finalBypassMode
            ),
            color: embedColor ?? templateData.color,
            duration: duration || '7d',
            winnersCount: finalWinners,
            entryValues: finalEntryValues,
            multiplier: finalMultiplier,
            bypassRoleIds: bypassRoleIds || [],
            bypassRoleMode: finalBypassMode,
            reqRoleIds: reqRoleIds || [],
            reqRoleMode: finalReqMode,
            banRoleIds: banRoleIds || [],
            host,
            imageUrl: imageUrl || templateData.imageUrl || null
        };
    },

    generateGiveawayCode() {
        return 'GS-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    },

    createGiveawayEmbed(config, endsAt, giveawayCode, host, entries, ended = false) {
        const uniqueParticipants = new Set(Object.values(entries || {}).map(e => e.userId)).size;

        const embed = new EmbedBuilder()
            .setColor(config.color || 0x0073ff)
            .setDescription(config.description)
            .addFields(
                { name: 'Status', value: ended ? 'Ended' : `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
                { name: 'Participants', value: `${uniqueParticipants}`, inline: true },
                { name: 'Winners', value: `${config.winnersCount}`, inline: true }
            );

        if (config.imageUrl && /^https?:\/\//i.test(config.imageUrl.trim())) {
            embed.setImage(config.imageUrl);
        }

        const avatarURL = host?.displayAvatarURL ? host.displayAvatarURL({ dynamic: true }) : null;
        embed.setFooter({
            text: `${host?.username || 'Host'} | ID: ${giveawayCode}`,
            iconURL: avatarURL || undefined
        });

        return embed;
    },

    createEndedGiveawayEmbed(config, giveawayCode, participantsCount, entries, winnersByType) {
        const allWinners = Object.values(winnersByType || {}).flat();
        const uniqueParticipants = participantsCount || new Set(Object.values(entries || {}).map(e => e.userId)).size;

        let winnersFieldValue = '';

        if (!allWinners.length) {
            winnersFieldValue = '❌ No Winners';
        } else {
            const isGenericSingle =
                config.entryValues?.buttons?.length === 1 &&
                config.entryValues.buttons[0]?.type === 'SINGLE';

            if (isGenericSingle) {
                winnersFieldValue = allWinners.map(w => `<@${w.userId}>`).join(', ');
            } else {
                winnersFieldValue = allWinners.map(w => `<@${w.userId}>`).join(', ');
            }
        }

        const embed = new EmbedBuilder()
            .setColor(config.color || 0x0073ff)
            .setDescription(config.description)
            .addFields(
                { name: 'Status', value: 'Ended', inline: true },
                { name: 'Participants', value: `${uniqueParticipants}`, inline: true },
                { name: 'Winners', value: winnersFieldValue, inline: false }
            );

        if (config.imageUrl && /^https?:\/\//i.test(config.imageUrl.trim())) {
            embed.setImage(config.imageUrl);
        }

        const host = config.host;
        const avatarURL = host?.displayAvatarURL ? host.displayAvatarURL({ dynamic: true }) : null;
        embed.setFooter({
            text: `${host?.username || 'Host'} | ID: ${giveawayCode}`,
            iconURL: avatarURL || undefined
        });

        return embed;
    },

    buildButtonRow(config, giveawayCode, entries, disabled = false) {
        const buttons = config.entryValues?.buttons || [];
        if (!buttons.length) {
            return [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`giveaway_join_${giveawayCode}_0_SINGLE`)
                        .setLabel('Join (0)')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(disabled)
                )
            ];
        }

        const counts = this.calculateButtonCounts(entries, buttons);
        const rows = [];

        for (let i = 0; i < buttons.length; i += 5) {
            const row = new ActionRowBuilder();
            const chunk = buttons.slice(i, i + 5);

            chunk.forEach((btn, chunkIdx) => {
                const globalIdx = i + chunkIdx;
                const count = counts[globalIdx] || 0;

                let suffix = 'default';
                if (btn.type) suffix = btn.type;
                else if (btn.roleId) suffix = `role_${btn.roleId}`;

                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`giveaway_join_${giveawayCode}_${globalIdx}_${suffix}`)
                        .setLabel(`${btn.label || 'Join'} (${count})`)
                        .setEmoji(`🎉`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(disabled)
                );
            });

            rows.push(row);
        }

        return rows;
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
        return {
            embeds: [this.createGiveawayEmbed(config, endsAt, giveawayCode, host, entries, false)],
            components: this.buildButtonRow(config, giveawayCode, entries)
        };
    },

    updateGiveawayMessage(config, endsAt, giveawayCode, host, entries) {
        return this.createGiveawayMessage(config, endsAt, giveawayCode, host, entries);
    },

    resolvePrizeName(type, prizeLabel, config) {
        if (prizeLabel) return prizeLabel;

        const isGenericSingleGiveaway =
            config.entryValues?.buttons?.length === 1 &&
            config.entryValues.buttons[0]?.type === 'SINGLE';

        if (isGenericSingleGiveaway && type === 'SINGLE') return 'the giveaway';

        if (type?.startsWith('CUSTOM_') && config.entryValues?.buttons) {
            const idx = parseInt(type.split('_')[1], 10);
            if (!isNaN(idx) && config.entryValues.buttons[idx]) {
                return config.entryValues.buttons[idx].label;
            }
        }

        if (type === 'SINGLE' && config.entryValues?.buttons?.[0]?.label === 'Join') return 'the giveaway';
        if (type === 'SINGLE' && config.entryValues?.buttons?.[0]?.label) return config.entryValues.buttons[0].label;

        if (type === 'VIP_GAMERS') return 'Gamers';
        if (type === 'VIP_BOOSTERS') return 'Boosters';
        if (type === 'SKYWELL_JOIN') return 'SkyWell';

        return getPrizeDisplayName(type);
    },

    pickWeightedWinners(entries, count = 1, excludedUserIds = []) {
        const excluded = new Set(excludedUserIds);
        const pool = [];

        for (const e of entries) {
            if (excluded.has(e.userId)) continue;
            const weight = e.weight || 1;
            for (let i = 0; i < weight; i++) pool.push(e);
        }

        const picked = [];
        const pickedIds = new Set();

        while (pool.length && picked.length < count) {
            const idx = Math.floor(Math.random() * pool.length);
            const chosen = pool[idx];

            if (!pickedIds.has(chosen.userId)) {
                picked.push(chosen);
                pickedIds.add(chosen.userId);
            }

            for (let i = pool.length - 1; i >= 0; i--) {
                if (pool[i].userId === chosen.userId) pool.splice(i, 1);
            }
        }

        return picked;
    },

    normalizeRerollInput(customWinnerCount, target) {
        if (typeof target === 'string' && target.trim()) return target.trim();
        if (typeof customWinnerCount === 'string' && customWinnerCount.trim()) return customWinnerCount.trim();
        if (Number.isInteger(customWinnerCount) && customWinnerCount > 0) return String(customWinnerCount);
        return '';
    },

    parseRerollSelector(rawInput) {
        if (!rawInput) return { mode: 'all' };

        const parts = rawInput.split(',').map(p => p.trim()).filter(Boolean);
        if (!parts.length) return { mode: 'all' };

        const mentionRegex = /^<@!?(\d+)>$/;
        const allMentions = parts.every(part => mentionRegex.test(part));
        if (allMentions) {
            return {
                mode: 'users',
                userIds: [...new Set(parts.map(part => part.match(mentionRegex)[1]))]
            };
        }

        const allIndexed = parts.every(part => /^#\d+$/.test(part));
        if (allIndexed) {
            const indexes = [...new Set(parts.map(part => parseInt(part.slice(1), 10)).filter(n => !isNaN(n) && n > 0))];
            return { mode: 'indexes', indexes };
        }

        if (parts.length === 1 && /^\d+$/.test(parts[0])) {
            const count = parseInt(parts[0], 10);
            return { mode: 'count', count: isNaN(count) || count < 1 ? 1 : count };
        }

        return {
            mode: 'prizes',
            prizes: [...new Set(parts.map(p => p.toLowerCase()))]
        };
    },

    buildWinnerList(config, winnersByType) {
        const allWinners = Object.values(winnersByType || {}).flat();

        if (!allWinners.length) return '❌ No winners found!';

        const isGenericSingleGiveaway =
            config.entryValues?.buttons?.length === 1 &&
            config.entryValues.buttons[0]?.type === 'SINGLE';

        if (isGenericSingleGiveaway) {
            const mentions = allWinners.map(w => `<@${w.userId}>`).join(', ');
            return `### • ${mentions} won **the giveaway**!`;
        }

        let winnerList = '';

        for (const [type, winners] of Object.entries(winnersByType)) {
            const prizeName = winners[0]?.prizeLabel || this.resolvePrizeName(type, winners[0]?.prizeLabel, config);
            for (const w of winners) {
                winnerList += `${formatWinnerLine(w.userId, w.prizeLabel || prizeName)}\n`;
            }
        }

        return winnerList.trim() || '❌ No winners found!';
    },

    async sendWinnersAnnouncement(channel, config, winnersByType, giveawayCode) {
        if (!channel) return;

        const allWinners = Object.values(winnersByType || {}).flat();

        if (!allWinners.length) {
            await channel.send(
                buildNoWinnersV2Message(giveawayCode, config.color)
            ).catch(err => {
                console.warn('⚠️ Could not send no-winners message:', err.message);
            });
            return;
        }

        const winnerIds = [...new Set(allWinners.map(w => w.userId))];
        const winnerListText = this.buildWinnerList(config, winnersByType);
        const giveawayTitle = config.title || 'Giveaway';

        await channel.send(
            buildWinnersV2Message(winnerListText, giveawayCode, config.color, winnerIds, giveawayTitle)
        ).catch(err => {
            console.warn('⚠️ Could not send winners message:', err.message);
        });
    },

    createRerollMessage(config, winnersByType, giveawayCode, host, rerolledUsers = []) {
        const newWinnerIds = [...new Set(
            Object.values(winnersByType || {}).flat().map(w => w.userId)
        )];
        const winnerListText = this.buildWinnerList(config, winnersByType);
        const giveawayTitle = config.title || 'Giveaway';

        return buildRerollV2Message(
            winnerListText,
            giveawayCode,
            config.color,
            rerolledUsers,
            newWinnerIds,
            giveawayTitle
        );
    },

    async sendToLogChannel(interaction, config, giveawayCode, endsAt, host, channel, messageId = null) {
        try {
            const logChannel = await interaction.guild.channels.fetch(GIVEAWAY_LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return;

            const giveawayLink = messageId
                ? `https://discord.com/channels/${interaction.guildId}/${channel.id}/${messageId}`
                : `https://discord.com/channels/${interaction.guildId}/${channel.id}`;

            const embed = new EmbedBuilder()
                .setColor(config.color || 0x0073ff)
                .setDescription(
                    `### [${config.title}](${giveawayLink}) | ${config.winnersCount} Winners\n\n` +
                    `**ID:** \`${giveawayCode}\` - ` +
                    ` **Channel:** ${channel}` +
                    ` - **End:** <t:${Math.floor(endsAt.getTime() / 1000)}:F>`
                )
                .setFooter({
                    text: `${host.username || 'Host'}`,
                    iconURL: host.displayAvatarURL ? host.displayAvatarURL({ dynamic: true }) : null
                });

            await logChannel.send({ embeds: [embed] });
        } catch (e) {
            console.warn('⚠️ Log channel error:', e.message);
        }
    },

    setupJoinCollector(message, giveawayCode, endsAt, config, client) {
        const remaining = endsAt.getTime() - Date.now();
        if (remaining <= 0) {
            this.handleGiveawayEnd(message, giveawayCode, client, config).catch(console.error);
            return;
        }

        const collector = message.createMessageComponentCollector({ time: remaining });

        collector.on('end', async () => {
            try {
                await message.fetch().catch(() => null);
                await this.handleGiveawayEnd(message, giveawayCode, client, config);
            } catch (err) {
                if (err.code === 10008) {
                    console.warn(`⚠️ Giveaway ${giveawayCode} ended but message was deleted`);
                    await this.endGiveawayWithPrizeTypes(giveawayCode).catch(console.error);
                } else {
                    console.error('❌ collector end error:', err);
                }
            }
        });
    },

    async handlePreview(interaction, previewId, decision) {
        const session = previewSessions.get(previewId);
        if (!session) {
            return this.safeUpdate(interaction, {
                content: '',
                embeds: [this.buildResultEmbed(0xED4245, 'Preview Expired', '❌ This preview is no longer active')],
                components: []
            });
        }

        previewSessions.delete(previewId);

        if (decision === 'no') {
            return this.safeUpdate(interaction, {
                content: '',
                embeds: [this.buildResultEmbed(0xED4245, 'Preview Cancelled', '❌ Preview cancelled, Run `/giveaway` again or hit \`ctrl+z\` and adjust what you want')],
                components: []
            });
        }

        const result = await this.finalizeGiveawayCreation(session);

        return this.safeUpdate(interaction, {
            content: '',
            embeds: [result.embed],
            components: []
        });
    },

    async buttonHandler(interaction) {
        if (interaction.replied || interaction.deferred) return;

        const { action, code: giveawayCode, rest } = parseCustomId(interaction.customId);

        if (action === 'preview') {
            return this.handlePreview(interaction, giveawayCode, rest);
        }

        if (action === 'leave') {
            const parts = rest.split('_');
            const targetId = parts[0];
            const leaveType = parts.slice(1).join('_') || 'ALL';

            if (interaction.user.id !== targetId) {
                return this.safeReply(interaction, {
                    embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ This button is not for you')],
                    flags: 64
                });
            }

            const giveaway = await dbManager.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) {
                return this.safeReply(interaction, { content: '❌ Giveaway no longer active', flags: 64 });
            }

            const existingEntry = leaveType === 'ALL'
                ? null
                : await dbManager.getParticipantByType(giveawayCode, interaction.user.id, leaveType);

            const result = leaveType === 'ALL'
                ? await dbManager.removeParticipant(giveawayCode, interaction.user.id)
                : await dbManager.removeParticipant(giveawayCode, interaction.user.id, leaveType);

            if (!result.success) {
                return this.safeUpdate(interaction, {
                    embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ Could not leave')],
                    components: []
                });
            }

            const config = this.buildConfigFromGiveaway(giveaway);
            const endsAt = new Date(giveaway.end_time);
            const host = await this.resolveHostUser(interaction.client, giveaway.host_id, giveaway.host_name);
            const updated = this.updateGiveawayMessage(config, endsAt, giveawayCode, host, result.entries);
            await this._editMainMessage(interaction.client, giveaway.channel_id, giveaway.message_id, updated);

            const leaveName = leaveType === 'ALL'
                ? 'all entries'
                : existingEntry?.prizeLabel || this.getPrizeLabelFromConfig(leaveType, config, giveaway.entries, interaction.user.id);

            return this.safeUpdate(interaction, {
                embeds: [new EmbedBuilder().setColor('#00FF00').setDescription(`✅ You left **${leaveName}**`)],
                components: []
            });
        }

        if (action === 'purchase') {
            const restParts = rest.split('_');
            const userId = restParts[0];
            const needed = parseInt(restParts[1], 10);
            const period = restParts[2] || 'weekly';
            const btnIndex = parseInt(restParts[3], 10);
            const originalSuffix = restParts.slice(4).join('_');

            if (interaction.user.id !== userId) {
                return this.safeReply(interaction, {
                    embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ This button is not for you')],
                    flags: 64
                });
            }

            const giveaway = await dbManager.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) {
                return this.safeUpdate(interaction, { content: '❌ Giveaway no longer active', embeds: [], components: [] });
            }

            const existingEntry = await dbManager.getParticipantByType(giveawayCode, userId, originalSuffix);
            if (existingEntry) {
                return this.safeUpdate(interaction, {
                    embeds: [new EmbedBuilder().setColor('#FFA500').setDescription('⚠️ You already joined this prize type')],
                    components: [this.buildLeaveButton(giveawayCode, userId, originalSuffix)]
                });
            }

            const purchase = await purchaseMissingMessages(userId, needed, period);
            if (!purchase.success) {
                const msg = purchase.reason === 'insufficient_coins'
                    ? `❌ Need **${purchase.needed}** coins, you have **${purchase.have}**`
                    : '❌ Purchase failed';

                return this.safeUpdate(interaction, {
                    embeds: [new EmbedBuilder().setColor('#FF0000').setDescription(msg)],
                    components: []
                });
            }

            const config = this.buildConfigFromGiveaway(giveaway);
            const buttons = config.entryValues?.buttons || [];
            const originalButton = buttons[btnIndex] || {};

            let entryType = originalSuffix;
            let roleIdForEntry = null;

            if (originalSuffix.startsWith('role_')) {
                roleIdForEntry = originalSuffix.slice(5);
                entryType = `role_${roleIdForEntry}`;
            }

            const prizeLabel = originalButton.label || this.getPrizeLabelFromConfig(entryType, config);

            const joinRes = await dbManager.addParticipant(
                giveawayCode,
                userId,
                interaction.user.username,
                entryType,
                roleIdForEntry || originalButton.roleId || null,
                1,
                prizeLabel
            );

            if (!joinRes.success) {
                await dbManager.run(`UPDATE levels SET sky_coins = sky_coins + $1 WHERE user_id = $2`, [purchase.cost, userId]);

                const col = period === 'daily' ? 'daily_sent' : period === 'weekly' ? 'weekly_sent' : 'monthly_sent';
                await dbManager.run(
                    `UPDATE message_stats SET ${col} = ${col} - $1 WHERE user_id = $2`,
                    [needed, userId]
                );

                return this.safeUpdate(interaction, {
                    embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ Purchase succeeded but joining failed. Your coins were refunded')],
                    components: []
                });
            }

            const endsAt = new Date(giveaway.end_time);
            const host = await this.resolveHostUser(interaction.client, giveaway.host_id, giveaway.host_name);
            const updated = this.updateGiveawayMessage(config, endsAt, giveawayCode, host, joinRes.entries);
            await this._editMainMessage(interaction.client, giveaway.channel_id, giveaway.message_id, updated);

            return this.safeUpdate(interaction, {
                embeds: [new EmbedBuilder().setColor('#00FF00').setDescription(`✅ Purchased **${needed}** messages (cost: **${purchase.cost}** 🪙)\nYou joined **${prizeLabel}**!`)],
                components: [this.buildLeaveButton(giveawayCode, userId, entryType)]
            });
        }

        if (action === 'confirm' || action === 'decline') {
            return this.safeReply(interaction, {
                embeds: [new EmbedBuilder().setColor('#00FF00').setDescription('✅ Response recorded')],
                flags: 64
            });
        }

        if (action === 'join') {
            const giveaway = await dbManager.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) {
                return this.safeReply(interaction, { content: '❌ Giveaway no longer active', flags: 64 });
            }

            if (interaction.message.id !== giveaway.message_id) {
                const channel = interaction.client.channels.cache.get(giveaway.channel_id);
                const url = channel ? `https://discord.com/channels/${interaction.guildId}/${giveaway.channel_id}/${giveaway.message_id}` : null;

                return this.safeReply(interaction, {
                    embeds: [new EmbedBuilder().setColor('#FFA500').setDescription('⚠️ You are using an **old giveaway message**\nPlease use the current giveaway below')],
                    components: url
                        ? [new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setLabel('Go to Current Giveaway').setURL(url).setStyle(ButtonStyle.Link)
                        )]
                        : [],
                    flags: 64
                });
            }

            const config = this.buildConfigFromGiveaway(giveaway);
            const endsAt = new Date(giveaway.end_time);
            const member = interaction.member;
            const buttons = config.entryValues?.buttons || [];

            const restParts = rest.split('_');
            const btnIndex = parseInt(restParts[0], 10);
            const buttonConfig = buttons[btnIndex] || {};

            let entryType = 'default';
            let roleIdForEntry = null;
            const suffixStr = restParts.slice(1).join('_');

            if (suffixStr === 'RN' || suffixStr === 'GCS' || suffixStr === 'GCD' || suffixStr === 'SINGLE') {
                entryType = suffixStr;
            } else if (suffixStr.startsWith('CUSTOM_')) {
                entryType = suffixStr;
            } else if (suffixStr === 'VIP_GAMERS' || suffixStr === 'VIP_BOOSTERS' || suffixStr === 'SKYWELL_JOIN') {
                entryType = suffixStr;
            } else if (suffixStr.startsWith('role_')) {
                roleIdForEntry = suffixStr.slice(5);
                entryType = `role_${roleIdForEntry}`;
            } else if (suffixStr) {
                entryType = suffixStr;
            }

            // ===== أولاً: فحص هل هو مشترك بالفعل؟ =====
            const existingEntry = await dbManager.getParticipantByType(giveawayCode, interaction.user.id, entryType);
            if (existingEntry) {
                return this.safeReply(interaction, {
                    embeds: [new EmbedBuilder().setColor('#FFA500').setDescription(`⚠️ You are already in **${existingEntry.prizeLabel || entryType}**`)],
                    components: [this.buildLeaveButton(giveawayCode, interaction.user.id, entryType)],
                    flags: 64
                });
            }

            // ===== فحص الـ blacklist =====
            const isBlacklisted = config.banRoleIds.some(roleId => member.roles.cache.has(roleId));
            if (isBlacklisted) {
                return this.safeReply(interaction, {
                    embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ You are banned from this giveaway')],
                    flags: 64
                });
            }

            // ===== فحص الـ bypass (مع mode) =====
            const hasBypass = config.bypassRoleIds.length > 0
                && checkRoles(member.roles.cache, config.bypassRoleIds, config.bypassRoleMode);

            if (!hasBypass) {
                // ===== فحص الـ required roles (مع mode) =====
                if (config.reqRoleIds.length > 0) {
                    const hasRequired = checkRoles(member.roles.cache, config.reqRoleIds, config.reqRoleMode);
                    if (!hasRequired) {
                        const modeLabel = config.reqRoleMode === 'y'
                            ? 'You need **all** of these roles'
                            : 'You need **at least one** of these roles';
                        const rolesMention = config.reqRoleIds.map(id => `<@&${id}>`).join(', ');
                        return this.safeReply(interaction, {
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription(`❌ ${modeLabel}: ${rolesMention}`)],
                            flags: 64
                        });
                    }
                }

                // ===== SKYWELL_JOIN: فحص إن المستخدم عنده أي Skywell role =====
                if (entryType === 'SKYWELL_JOIN') {
                    const hasSkywell = SKYWELL_ROLE_IDS.some(rid => member.roles.cache.has(rid));
                    if (!hasSkywell) {
                        return this.safeReply(interaction, {
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ You need a SkyWell role to join this giveaway')],
                            flags: 64
                        });
                    }
                }

                // ===== ELITE: لازم عنده Gamer 5 أو Tier 5 =====
                if (entryType === 'ELITE_GIFT_CARD' || entryType === 'ELITE_CHOSEN_KEY') {
                    const hasRequiredRole = member.roles.cache.has(GAMER_5_ID) || member.roles.cache.has(TIER_5_ID);
                    if (!hasRequiredRole) {
                        return this.safeReply(interaction, {
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription(`❌ You need <@&${GAMER_5_ID}> or <@&${TIER_5_ID}> to join`)],
                            flags: 64
                        });
                    }
                }

                // ===== الـ role-based buttons العادية =====
                if (buttonConfig.roleId && entryType !== 'SKYWELL_JOIN') {
                    if (!member.roles.cache.has(buttonConfig.roleId)) {
                        return this.safeReply(interaction, {
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription(`❌ You need <@&${buttonConfig.roleId}>`)],
                            flags: 64
                        });
                    }
                }

                // ===== فحص الـ required messages =====
                if (buttonConfig.required > 0) {
                    const period = config.entryValues?.period || 'weekly';
                    const userMsgs = await getUserMessageCount(interaction.user.id, period);
                    const required = buttonConfig.required;
                    const threshold = Math.floor(required * 0.5);

                    if (userMsgs < required) {
                        if (userMsgs >= threshold) {
                            const needed = required - userMsgs;
                            const cost = needed * 55;

                            const purchaseBtn = new ButtonBuilder()
                                .setCustomId(`giveaway_purchase_${giveawayCode}_${interaction.user.id}_${needed}_${period}_${btnIndex}_${entryType}`)
                                .setLabel(`Buy ${needed} msgs (${cost} 🪙)`)
                                .setStyle(ButtonStyle.Success);

                            return this.safeReply(interaction, {
                                embeds: [new EmbedBuilder().setColor('#FFA500').setDescription(
                                    `❌ You need **${required} ${period}** messages\n` +
                                    `You have **${userMsgs}**, need **${needed}** more\n` +
                                    `Do you want to purchase it now?`
                                )],
                                components: [new ActionRowBuilder().addComponents(purchaseBtn)],
                                flags: 64
                            });
                        } else {
                            return this.safeReply(interaction, {
                                embeds: [new EmbedBuilder().setColor('#FF0000').setDescription(
                                    `❌ You need **${required} ${period}** messages` +
                                    `, You have **${userMsgs}**\n`
                                )],
                                flags: 64
                            });
                        }
                    }
                }
            }

            // ===== حساب الـ weight (الأفضلية للجيمر) =====
            let entryWeight = 1;

            if (config.multiplier) {
                const hasBooster = member.roles.cache.has(BOOSTER_ROLE_ID);

                // نحدد أعلى Gamer role يملكها المستخدم (حسب الترتيب من الأقل للأعلى)
                const highestGamerRoleId = VIP_ROLES_HIERARCHY
                    .slice()
                    .reverse() // من الأعلى للأقل حتى نأخذ الأعلى أولاً
                    .find(rid => member.roles.cache.has(rid));

                if (highestGamerRoleId) {
                    // عنده Gamer role → نأخذ وزنه من الـ multiplier
                    const gamerWeight = Number(config.multiplier[highestGamerRoleId]) || 1;
                    entryWeight = hasBooster
                        ? Math.round(gamerWeight * 1.5) // Gamer + Booster → × 1.5
                        : gamerWeight;                  // Gamer فقط → الوزن مباشرة
                } else if (hasBooster && config.multiplier[BOOSTER_ROLE_ID]) {
                    // Booster فقط (بدون أي Gamer role)
                    entryWeight = Number(config.multiplier[BOOSTER_ROLE_ID]) || 1;
                } else {
                    // لا Gamer ولا Booster → نأخذ أعلى وزن من الـ multiplier إن وُجد
                    for (const [roleId, weight] of Object.entries(config.multiplier)) {
                        if (member.roles.cache.has(roleId)) {
                            entryWeight = Math.max(entryWeight, Number(weight) || 1);
                        }
                    }
                }
            }

            const prizeLabel = buttonConfig.label || this.getPrizeLabelFromConfig(entryType, config);

            const addResult = await dbManager.addParticipant(
                giveawayCode,
                interaction.user.id,
                interaction.user.username,
                entryType,
                roleIdForEntry || buttonConfig.roleId || null,
                entryWeight,
                prizeLabel
            );

            if (!addResult.success) {
                const already = addResult.code === 'ALREADY_JOINED_TYPE' || addResult.error?.includes('Already joined');
                return this.safeReply(interaction, {
                    embeds: [new EmbedBuilder().setColor(already ? '#FFA500' : '#FF0000').setDescription(
                        already ? '⚠️ You already joined this prize type' : `❌ ${addResult.error || 'Failed to join'}`
                    )],
                    components: already ? [this.buildLeaveButton(giveawayCode, interaction.user.id, entryType)] : [],
                    flags: 64
                });
            }

            const host = await this.resolveHostUser(interaction.client, giveaway.host_id, giveaway.host_name);
            const updated = this.updateGiveawayMessage(config, endsAt, giveawayCode, host, addResult.entries);
            await this._editMainMessage(interaction.client, giveaway.channel_id, giveaway.message_id, updated);

            return this.safeReply(interaction, {
                embeds: [new EmbedBuilder().setColor('#00FF00').setDescription(`✅ You joined **${prizeLabel}**!\n-# Good luck`)],
                components: [this.buildLeaveButton(giveawayCode, interaction.user.id, entryType)],
                flags: 64
            });
        }

        return this.safeReply(interaction, { content: '❓ Unknown action.', flags: 64 });
    },

    async _editMainMessage(client, channelId, messageId, content) {
        try {
            const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
            if (!channel) return false;

            const msg = await channel.messages.fetch(messageId).catch(() => null);
            if (!msg) return false;

            await msg.edit(content);
            return true;
        } catch (error) {
            if (error.code === 10008) {
                console.warn(`⚠️ Message ${messageId} was deleted`);
            } else {
                console.warn('⚠️ Edit main message failed:', error.message);
            }
            return false;
        }
    },

    async handleGiveawayEnd(message, giveawayCode, client, config) {
        try {
            const giveaway = await dbManager.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) return;

            const result = await this.endGiveawayWithPrizeTypes(giveawayCode);
            if (!result.success) return;

            const { winnersByType, participantsCount } = result;
            const allWinners = Object.values(winnersByType).flat();

            for (const w of allWinners) {
                try {
                    const guild = message?.guild || await client.guilds.fetch(giveaway.guild_id).catch(() => null);
                    if (guild) {
                        const guildMember = await guild.members.fetch(w.userId).catch(() => null);
                        if (guildMember) await guildMember.roles.add(WINNER_ROLE_ID).catch(() => { });
                    }
                } catch (e) {
                    console.warn(`⚠️ Could not add role to ${w.userId}:`, e.message);
                }
            }

            const host = await this.resolveHostUser(client, giveaway.host_id, giveaway.host_name);
            const endedConfig = { ...config, host };

            const channel = client.channels.cache.get(giveaway.channel_id)
                || await client.channels.fetch(giveaway.channel_id).catch(() => null);

            if (channel) {
                const mainMsg = await channel.messages.fetch(giveaway.message_id).catch(() => null);
                if (mainMsg) {
                    await mainMsg.edit(
                        this.createEndedGiveawayMessage(endedConfig, giveawayCode, participantsCount, giveaway.entries || {}, winnersByType)
                    ).catch(err => console.warn('⚠️ Could not edit main message:', err.message));
                }

                await this.sendWinnersAnnouncement(channel, endedConfig, winnersByType, giveawayCode);
            }
        } catch (err) {
            console.error('❌ handleGiveawayEnd error:', err);
        }
    },

    async endGiveawayWithPrizeTypes(giveawayCode) {
        try {
            const giveaway = await dbManager.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) return { success: false, error: 'not_found' };

            const entries = giveaway.entries || {};
            const entryList = Object.values(entries);
            const config = this.buildConfigFromGiveaway(giveaway);

            if (!entryList.length) {
                await dbManager.run(`UPDATE giveaways SET status = 'ended', winners = '[]'::jsonb, updated_at = NOW() WHERE giveaway_code = $1`, [giveawayCode]);
                return { success: true, noParticipants: true, participantsCount: 0, winnersByType: {} };
            }

            const uniqueCount = new Set(entryList.map(e => e.userId)).size;
            const winnersNeeded = Math.max(1, Math.min(giveaway.winners_count || 1, uniqueCount));

            const isGenericSingleGiveaway =
                config.entryValues?.buttons?.length === 1 &&
                config.entryValues.buttons[0]?.type === 'SINGLE';

            // SKYWELL_JOIN زي SINGLE → winner واحد من كل المشتركين
            const isSkywellSingle =
                config.entryValues?.buttons?.length === 1 &&
                config.entryValues.buttons[0]?.type === 'SKYWELL_JOIN';

            let winnersByType = {};

            if (isGenericSingleGiveaway || isSkywellSingle) {
                const weightedPool = [];

                for (const e of entryList) {
                    const weight = e.weight || 1;
                    for (let i = 0; i < weight; i++) {
                        weightedPool.push({
                            userId: e.userId,
                            type: e.type || (isSkywellSingle ? 'SKYWELL_JOIN' : 'SINGLE'),
                            prizeLabel: null
                        });
                    }
                }

                const pickedUsers = new Set();
                const genericWinners = [];

                while (weightedPool.length && genericWinners.length < winnersNeeded) {
                    const idx = Math.floor(Math.random() * weightedPool.length);
                    const picked = weightedPool[idx];

                    if (!pickedUsers.has(picked.userId)) {
                        pickedUsers.add(picked.userId);
                        genericWinners.push(picked);
                    }

                    for (let i = weightedPool.length - 1; i >= 0; i--) {
                        if (weightedPool[i].userId === picked.userId) weightedPool.splice(i, 1);
                    }
                }

                const winnerKey = isSkywellSingle ? 'SKYWELL_JOIN' : 'SINGLE';
                winnersByType = { [winnerKey]: genericWinners };
            } else {
                const entriesByType = {};
                for (const e of entryList) {
                    const t = e.type || 'default';
                    if (!entriesByType[t]) entriesByType[t] = [];
                    entriesByType[t].push(e);
                }

                const alreadyWonUserIds = new Set();

                for (const [type, arr] of Object.entries(entriesByType)) {
                    const weighted = [];
                    for (const e of arr) {
                        if (alreadyWonUserIds.has(e.userId)) continue;
                        const w = e.weight || 1;
                        for (let i = 0; i < w; i++) {
                            weighted.push({ userId: e.userId, type: e.type, prizeLabel: e.prizeLabel || null });
                        }
                    }

                    if (weighted.length) {
                        const rand = Math.floor(Math.random() * weighted.length);
                        const winner = weighted[rand];
                        winnersByType[type] = [winner];
                        alreadyWonUserIds.add(winner.userId);
                    }
                }
            }

            const allWinners = Object.values(winnersByType).flat();

            await dbManager.run(
                `UPDATE giveaways SET status = 'ended', winners = $1::jsonb, updated_at = NOW() WHERE giveaway_code = $2`,
                [JSON.stringify(allWinners), giveawayCode]
            );

            return { success: true, winnersByType, participantsCount: uniqueCount };
        } catch (err) {
            console.error('❌ endGiveawayWithPrizeTypes error:', err);
            return { success: false, error: err.message };
        }
    },

    createEndedGiveawayMessage(config, giveawayCode, participantsCount, entries = {}, winnersByType = {}) {
        const mainEmbed = this.createEndedGiveawayEmbed(
            config,
            giveawayCode,
            participantsCount,
            entries,
            winnersByType
        );

        return { embeds: [mainEmbed], components: this.buildButtonRow(config, giveawayCode, entries, true) };
    },

    setupConfirmCollector(message, giveawayCode) {
        const filter = i =>
            i.customId.startsWith(`giveaway_confirm_${giveawayCode}`) ||
            i.customId.startsWith(`giveaway_decline_${giveawayCode}`);

        const collector = message.createMessageComponentCollector({ filter });

        collector.on('collect', async i => {
            try {
                if (i.replied || i.deferred) return;
                await i.reply({
                    embeds: [new EmbedBuilder().setColor('#00FF00').setDescription('✅ Response recorded')],
                    flags: 64
                });
            } catch (error) {
                if (error.code !== 40060 && error.code !== 10062) {
                    console.error('❌ confirm collector error:', error);
                }
            }
        });
    },

    async handleReroll(interaction, code, customWinnerCount, excludeOld, target = null) {
        const g = await dbManager.getGiveawayByCode(code);
        if (!g) {
            return interaction.editReply({
                embeds: [this.buildResultEmbed(0xED4245, 'Reroll Failed', '❌ Giveaway not found')]
            });
        }

        const config = this.buildConfigFromGiveaway(g);
        const host = await this.resolveHostUser(interaction.client, g.host_id, g.host_name);
        const entries = Object.values(g.entries || {});
        const oldWinners = parseJsonField(g.winners) || [];

        if (!entries.length) {
            return interaction.editReply({
                embeds: [this.buildResultEmbed(0xED4245, 'Reroll Failed', '❌ No participants')]
            });
        }

        if (!oldWinners.length) {
            return interaction.editReply({
                embeds: [this.buildResultEmbed(0xED4245, 'Reroll Failed', '❌ No previous winners found')]
            });
        }

        const rawInput = this.normalizeRerollInput(customWinnerCount, target);
        const selector = this.parseRerollSelector(rawInput);

        let winnersToReplace = [];
        let preservedWinners = [];

        if (selector.mode === 'all') {
            winnersToReplace = [...oldWinners];
            preservedWinners = [];
        } else if (selector.mode === 'count') {
            const count = Math.min(selector.count, oldWinners.length);
            winnersToReplace = oldWinners.slice(0, count);
            preservedWinners = oldWinners.slice(count);
        } else if (selector.mode === 'indexes') {
            const indexes = selector.indexes
                .map(n => n - 1)
                .filter(idx => idx >= 0 && idx < oldWinners.length);

            if (!indexes.length) {
                return interaction.editReply({
                    embeds: [this.buildResultEmbed(0xED4245, 'Reroll Failed', '❌ Winner number not found')]
                });
            }

            const indexSet = new Set(indexes);
            winnersToReplace = oldWinners.filter((_, idx) => indexSet.has(idx));
            preservedWinners = oldWinners.filter((_, idx) => !indexSet.has(idx));
        } else if (selector.mode === 'users') {
            const idSet = new Set(selector.userIds);
            winnersToReplace = oldWinners.filter(w => idSet.has(w.userId));
            preservedWinners = oldWinners.filter(w => !idSet.has(w.userId));

            if (!winnersToReplace.length) {
                return interaction.editReply({
                    embeds: [this.buildResultEmbed(0xED4245, 'Reroll Failed', '❌ Mentioned users are not current winners')]
                });
            }
        } else if (selector.mode === 'prizes') {
            winnersToReplace = oldWinners.filter(w => {
                const resolvedName = this.resolvePrizeName(w.type, w.prizeLabel, config);
                return selector.prizes.includes(resolvedName.toLowerCase());
            });

            if (!winnersToReplace.length) {
                return interaction.editReply({
                    embeds: [this.buildResultEmbed(0xED4245, 'Reroll Failed', '❌ Prize name not found among winners')]
                });
            }

            const rerollKeys = new Set(winnersToReplace.map(w => `${w.userId}:${w.type}:${w.prizeLabel || ''}`));
            preservedWinners = oldWinners.filter(w => !rerollKeys.has(`${w.userId}:${w.type}:${w.prizeLabel || ''}`));
        }

        const excludedIds = [...new Set(oldWinners.map(w => w.userId))];
        const pickedEntries = this.pickWeightedWinners(entries, winnersToReplace.length, excludedIds);

        if (!pickedEntries.length || pickedEntries.length < winnersToReplace.length) {
            return interaction.editReply({
                embeds: [this.buildResultEmbed(0xED4245, 'Reroll Failed', '❌ No enough participants available for reroll')]
            });
        }

        const newWinners = winnersToReplace.map((oldWinner, idx) => ({
            userId: pickedEntries[idx].userId,
            type: oldWinner.type,
            prizeLabel: oldWinner.prizeLabel || null
        }));

        const finalWinners = [...preservedWinners, ...newWinners];

        await dbManager.run(
            `UPDATE giveaways SET winners = $1::jsonb, updated_at = NOW() WHERE giveaway_code = $2`,
            [JSON.stringify(finalWinners), code]
        );

        const newWinnersByType = {};
        for (const winner of newWinners) {
            if (!newWinnersByType[winner.type]) newWinnersByType[winner.type] = [];
            newWinnersByType[winner.type].push(winner);
        }

        const channel = interaction.client.channels.cache.get(g.channel_id)
            || await interaction.client.channels.fetch(g.channel_id).catch(() => null);

        if (channel) {
            await channel.send(
                this.createRerollMessage(
                    { ...config, host },
                    newWinnersByType,
                    code,
                    host,
                    winnersToReplace.map(w => w.userId)
                )
            ).catch(() => { });
        }

        const mentions = newWinners.length
            ? newWinners.map(w => {
                const resolved = this.resolvePrizeName(w.type, w.prizeLabel, config);
                return `• <@${w.userId}> (${resolved})`;
            }).join('\n')
            : '❌ No winners found!';

        return interaction.editReply({
            embeds: [
                this.buildResultEmbed(
                    0x57F287,
                    '✅ Reroll Complete',
                    `**Code:** \`${code}\`\n**New Winners:** ${newWinners.length}\n\n${mentions}`
                )
            ]
        });
    },

    async handleEnd(interaction, code) {
        const g = await dbManager.getActiveGiveawayByCode(code);
        if (!g) {
            return interaction.editReply({
                embeds: [this.buildResultEmbed(0xED4245, 'End Failed', '❌ Giveaway not found or not active')]
            });
        }

        const result = await this.endGiveawayWithPrizeTypes(code);
        if (!result.success) {
            return interaction.editReply({
                embeds: [this.buildResultEmbed(0xED4245, 'End Failed', '❌ Failed to end giveaway')]
            });
        }

        const { winnersByType, participantsCount } = result;
        const allWinners = Object.values(winnersByType).flat();

        for (const w of allWinners) {
            try {
                const guildMember = await interaction.guild.members.fetch(w.userId).catch(() => null);
                if (guildMember) await guildMember.roles.add(WINNER_ROLE_ID).catch(() => { });
            } catch (e) {
                console.warn(`⚠️ Could not add role to ${w.userId}:`, e.message);
            }
        }

        if (g.channel_id && g.message_id) {
            try {
                const channel = interaction.client.channels.cache.get(g.channel_id)
                    || await interaction.client.channels.fetch(g.channel_id).catch(() => null);

                if (channel) {
                    const mainMsg = await channel.messages.fetch(g.message_id).catch(() => null);
                    if (mainMsg) {
                        const config = this.buildConfigFromGiveaway(g);
                        const host = await this.resolveHostUser(interaction.client, g.host_id, g.host_name);
                        const endedConfig = { ...config, host };

                        await mainMsg.edit(
                            this.createEndedGiveawayMessage(endedConfig, code, participantsCount, g.entries || {}, winnersByType)
                        ).catch(err => console.warn('⚠️ Could not edit giveaway message:', err.message));

                        await this.sendWinnersAnnouncement(channel, endedConfig, winnersByType, code);
                    }
                }
            } catch (e) {
                console.warn('⚠️ handleEnd - edit message error:', e.message);
            }
        }

        let winnerMentions = '';
        const endConfig = this.buildConfigFromGiveaway(g);

        for (const w of allWinners) {
            const prizeName = this.resolvePrizeName(w.type, w.prizeLabel, endConfig);
            winnerMentions += `• <@${w.userId}> — **${prizeName}**\n`;
        }

        return interaction.editReply({
            embeds: [
                this.buildResultEmbed(
                    0x57F287,
                    '✅ Giveaway Ended',
                    `**Code:** \`${code}\`\n**Participants:** ${participantsCount || 0}\n**Winners:** ${allWinners.length}\n\n${winnerMentions || '❌ No winners found!'}`
                )
            ]
        });
    },

    restoreScheduledGiveaways,
    publishScheduledGiveaway
};