const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const dbManager = require('../Data/database');
const parseDuration = require('../System/durationParser');

// ========== CONSTANTS (مطابقة مع giveaway.js) ==========
const WINNER_ROLE_ID = '1377112815600406618';
const DEFAULT_BLACKLIST_ROLES = ['1380141514293776466'];
const DEFAULT_HOST_ID = '1363733513081454774';

const TIER_3_ROLE_ID = '1465705698989179030';
const GAMER_1_ID = '1363754810645417994';
const GAMER_2_ID = '1363754894888013846';
const BOOSTER_ROLE_ID = '1374313963428253847';
const GAMER_3_ID = '1363754940710916187';
const GAMER_4_ID = '1363754996793085972';
const GAMER_5_ID = '1491491999147229447';
const TIER_5_ID = '1465785463984886045';

// ========== SKYWELL ROLE IDs (مطابقة مع giveaway.js) ==========
const SKYWELL_LVL1_ID = '1465705164139794443';
const SKYWELL_LVL2_ID = '1465705207760556186';
const SKYWELL_LVL3_ID = '1465705232280453283';
const SKYWELL_LVL4_ID = '1465705263209123975';
const SKYWELL_LVL5_ID = '1465705294234652736';

const VIP_ROLES_HIERARCHY = [GAMER_1_ID, GAMER_2_ID, GAMER_3_ID, GAMER_4_ID];
const SKYWELL_ROLE_IDS = [SKYWELL_LVL1_ID, SKYWELL_LVL2_ID, SKYWELL_LVL3_ID, SKYWELL_LVL4_ID, SKYWELL_LVL5_ID];

const LRM = '\u200E';

// ========== HELPERS ==========

function parseRoleIdsFromString(input) {
    if (!input) return { ids: [], mode: 'n' };

    let text = input.trim();
    let mode = 'n';

    const modeMatch = text.match(/\s+([yn])$/i);
    if (modeMatch) {
        mode = modeMatch[1].toLowerCase();
        text = text.slice(0, -modeMatch[0].length).trim();
    }

    const matches = text.match(/<@&(\d+)>/g) || [];
    const ids = matches.map(m => m.replace(/[<@&>]/g, ''));

    return { ids, mode };
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

function numberToHex(colorNumber) {
    if (!colorNumber) return '#0073ff';
    return '#' + Number(colorNumber).toString(16).padStart(6, '0');
}

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

function getPrizeDisplayName(type) {
    if (!type) return 'Prize';
    if (type.startsWith('CUSTOM_')) return 'Custom Prize';
    if (type.startsWith('role_')) return 'Role Entry';
    if (type === 'SKYWELL_JOIN') return 'SkyWell';
    const PRIZE_NAMES = {
        RN: 'Random Key',
        GCS: 'Special Gift Card',
        GCD: 'Discord Gift Card',
        SINGLE: 'Prize'
    };
    return PRIZE_NAMES[type] || type;
}

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

function processEntryValues(entryValues) {
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
}

// ===== getTemplateData مطابقة تماماً مع giveaway.js =====
function getTemplateData(templateName) {
    const templates = {
        normal: {
            title: 'Discord Special Drop',
            color: 0x0073ff,
            winnersCount: 3,
            entryValues: {
                period: 'daily',
                buttons: [
                    { type: 'RN', label: 'Random Key', min: 10, max: 15 },
                    { type: 'GCS', label: 'Special Gift Card', min: 20, max: 25 },
                    { type: 'GCD', label: 'Discord Gift Card', min: 30, max: 35 }
                ]
            },
            multiplier: { [TIER_3_ROLE_ID]: 2 },
            imageUrl: 'https://cdn.discordapp.com/attachments/1391115389718761565/1483958140079833228/GIFT_CARD___2.png?ex=69d781f7&is=69d63077&hm=3fee94eaea5ec7f635415d55e6f21cd36a142afc25860c0f9c0a1675da56280e&'
        },
        // ===== VIP: زرار واحد (SINGLE) =====
        vip: {
            title: 'VIP 5$ Gift Card Giveaway',
            color: 0xFFD700,
            winnersCount: 2,
            entryValues: {
                period: 'daily',
                min: 15,
                max: 25,
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
            imageUrl: 'https://cdn.discordapp.com/attachments/1391115389718761565/1483958140079833228/GIFT_CARD___2.png?ex=69d781f7&is=69d63077&hm=3fee94eaea5ec7f635415d55e6f21cd36a142afc25860c0f9c0a1675da56280e&'
        },
        elite: {
            title: 'Sky Royale Giveaway',
            color: 0x9B59B6,
            winnersCount: 1,
            entryValues: {
                period: 'weekly',
                min: 25,
                max: 50,
                buttons: [
                    { type: 'ELITE_GIFT_CARD', label: 'Gift Card', requiredRole: null },
                    { type: 'ELITE_CHOSEN_KEY', label: 'Chosen Key', requiredRole: null }
                ]
            },
            multiplier: { [GAMER_5_ID]: 5, [TIER_5_ID]: 10 },
            imageUrl: 'https://cdn.discordapp.com/attachments/1391115389718761565/1483958140079833228/GIFT_CARD___2.png?ex=69d781f7&is=69d63077&hm=3fee94eaea5ec7f635415d55e6f21cd36a142afc25860c0f9c0a1675da56280e&'
        },
        // ===== SKYWELL: زرار واحد =====
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
            imageUrl: 'https://cdn.discordapp.com/attachments/1391115389718761565/1483958140079833228/GIFT_CARD___2.png?ex=69d781f7&is=69d63077&hm=3fee94eaea5ec7f635415d55e6f21cd36a142afc25860c0f9c0a1675da56280e&'
        }
    };

    return templates[templateName] || null;
}

function buildConfigFromGiveaway(giveaway) {
    const entryValues = parseJsonField(giveaway.entry_values);
    const multiplier = parseJsonField(giveaway.multiplier);

    let fallbackTitle = '🎁 Giveaway';
    if (giveaway.template === 'normal') fallbackTitle = 'Discord Special Drop';
    else if (giveaway.template === 'vip') fallbackTitle = 'VIP 5$ Gift Card Giveaway';
    else if (giveaway.template === 'elite') fallbackTitle = 'Sky Royale Giveaway';
    else if (giveaway.template === 'skywell') fallbackTitle = 'SkyWell Exclusive Giveaways';

    const title = giveaway.title || fallbackTitle;

    let reqRoleIds = giveaway.reqrole || [];
    if (typeof reqRoleIds === 'string') reqRoleIds = reqRoleIds ? [reqRoleIds] : [];
    const reqRoleMode = giveaway.req_role_mode || 'n';

    let bypassRoleIds = giveaway.bypass_role_id || [];
    if (typeof bypassRoleIds === 'string') bypassRoleIds = bypassRoleIds ? [bypassRoleIds] : [];
    const bypassRoleMode = giveaway.bypass_role_mode || 'n';

    let banRoleIds = giveaway.banrole || [];
    if (typeof banRoleIds === 'string') banRoleIds = banRoleIds ? [banRoleIds] : [];
    if (!banRoleIds.length) banRoleIds = DEFAULT_BLACKLIST_ROLES;

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
        bypassRoleIds,
        bypassRoleMode,
        banRoleIds,
        color: giveaway.color || 0x0073ff,
        description: giveaway.description || buildDescriptionFromEntryValues(
            entryValues, title, '',
            reqRoleIds, bypassRoleIds, multiplier, banRoleIds,
            reqRoleMode, bypassRoleMode
        )
    };
}

function createGiveawayEmbed(config, endsAt, giveawayCode, host, entries, ended = false) {
    const uniqueParticipants = new Set(Object.values(entries || {}).map(e => e.userId)).size;

    const embed = new EmbedBuilder()
        .setColor(config.color || 0x0073ff)
        .setDescription(config.description)
        .addFields(
            { name: 'Status', value: ended ? 'Ended' : `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
            { name: 'Participants', value: `${uniqueParticipants}`, inline: true },
            { name: 'Winners', value: `${config.winnersCount}`, inline: true }
        );

    if (config.imageUrl && /^https?:\/\//i.test(String(config.imageUrl).trim())) {
        embed.setImage(config.imageUrl);
    }

    const avatarURL = host?.displayAvatarURL ? host.displayAvatarURL({ dynamic: true }) : null;
    embed.setFooter({
        text: `${host?.username || 'Host'} | ID: ${giveawayCode}`,
        iconURL: avatarURL || undefined
    });

    return embed;
}

function calculateButtonCounts(entries, buttons) {
    const counts = new Array(buttons.length).fill(0);
    if (!entries) return counts;

    Object.values(entries).forEach(entry => {
        buttons.forEach((btn, idx) => {
            if (btn.type && btn.type === entry.type) counts[idx]++;
            else if (btn.roleId && entry.roleId === btn.roleId) counts[idx]++;
        });
    });

    return counts;
}

function buildButtonRow(config, giveawayCode, entries, disabled = false) {
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

    const counts = calculateButtonCounts(entries, buttons);
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
}

// ========== MAIN MODULE ==========

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveawayedit')
        .setDescription('Edit an existing giveaway')
        .addStringOption(opt => opt.setName('code').setDescription('Giveaway code to edit').setRequired(true))
        .addStringOption(opt => opt.setName('template').setDescription('New template').setRequired(false).addChoices(
            { name: 'Discord Special Drop', value: 'normal' },
            { name: 'VIP 5$ Gift Card Giveaway', value: 'vip' },
            { name: 'Sky Royale Giveaway', value: 'elite' },
            { name: 'SkyWell Exclusive Giveaways', value: 'skywell' }
        ))
        .addStringOption(opt => opt.setName('title').setDescription('New title').setRequired(false))
        .addStringOption(opt => opt.setName('description').setDescription('New description').setRequired(false))
        .addStringOption(opt => opt.setName('duration').setDescription('New duration (e.g., 2d, 1h 30m)').setRequired(false))
        .addIntegerOption(opt => opt.setName('winners').setDescription('New number of winners (1-25)').setMinValue(1).setMaxValue(25).setRequired(false))
        .addUserOption(opt => opt.setName('host').setDescription('New host').setRequired(false))
        .addStringOption(opt => opt.setName('image').setDescription('New image URL').setRequired(false))
        .addStringOption(opt => opt.setName('scheduled').setDescription('New delay before start (scheduled giveaways only)').setRequired(false))
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
        .addStringOption(opt => opt.setName('prizes').setDescription('New prizes separated by commas').setRequired(false))
        .addStringOption(opt => opt.setName('messages_duration').setDescription('New period (daily/weekly/monthly)').setRequired(false).addChoices(
            { name: 'Daily', value: 'daily' },
            { name: 'Weekly', value: 'weekly' },
            { name: 'Monthly', value: 'monthly' }
        ))
        .addStringOption(opt => opt.setName('number_of_messages').setDescription('New message requirements for each prize').setRequired(false))
        .addStringOption(opt => opt.setName('color').setDescription('New embed color').setRequired(false))
        .addStringOption(opt => opt.setName('multiple_chance').setDescription('Role weights like @role:2,@role:4').setRequired(false)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Permission Check
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');
            if (!moderateRoleData) {
                return interaction.editReply('❌ Set `/setrole` first.');
            }

            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);

            if (!member.roles.cache.has(roleInfo.id)) {
                return interaction.editReply(`⛔ Only <@&${roleInfo.id}> can use this`);
            }

            // Fetch Giveaway
            const code = interaction.options.getString('code');
            const giveaway = await dbManager.getGiveawayByCode(code);

            if (!giveaway) {
                return interaction.editReply(`❌ Giveaway \`${code}\` not found`);
            }

            if (!['active', 'scheduled'].includes(giveaway.status)) {
                return interaction.editReply(`❌ Giveaway \`${code}\` is \`${giveaway.status}\`, only active or scheduled giveaways can be edited`);
            }

            // Read Options
            const newTemplate = interaction.options.getString('template');
            const newTitle = interaction.options.getString('title');
            const newDescription = interaction.options.getString('description');
            const newDuration = interaction.options.getString('duration');
            const newWinners = interaction.options.getInteger('winners');
            const newHost = interaction.options.getUser('host');
            const newImage = interaction.options.getString('image');
            const newScheduled = interaction.options.getString('scheduled');

            const bypassRolesInput = interaction.options.getString('bypass_role');
            const reqRolesInput = interaction.options.getString('required_role');
            const banRolesInput = interaction.options.getString('blacklist');

            const newPrizes = interaction.options.getString('prizes');
            const newMessagesDuration = interaction.options.getString('messages_duration');
            const newMessagesAmount = interaction.options.getString('number_of_messages');
            const newColor = interaction.options.getString('color');
            const newMultipleChance = interaction.options.getString('multiple_chance');

            // Parse Roles with Mode
            const { ids: bypassRoleIds, mode: bypassRoleMode } = parseRoleIdsFromString(bypassRolesInput);
            const { ids: reqRoleIds, mode: reqRoleMode } = parseRoleIdsFromString(reqRolesInput);
            const { ids: customBanRoleIds } = parseRoleIdsFromString(banRolesInput);
            const banRoleIds = customBanRoleIds.length > 0 ? customBanRoleIds : DEFAULT_BLACKLIST_ROLES;

            // Validate Template
            const templateData = newTemplate ? getTemplateData(newTemplate) : null;
            if (newTemplate && !templateData) {
                return interaction.editReply(`❌ Template "${newTemplate}" not found`);
            }

            const currentConfig = buildConfigFromGiveaway(giveaway);
            const currentEntryValues = parseJsonField(giveaway.entry_values);
            const currentMultiplier = parseJsonField(giveaway.multiplier);

            // Build Working Values
            const updates = {};
            const oldValues = {};

            let workingTitle = newTitle || (templateData?.title ?? currentConfig.title);
            let workingColor = newColor ? parseColor(newColor) : (templateData?.color ?? currentConfig.color);
            let workingImage = newImage !== null && newImage !== undefined
                ? newImage
                : (templateData ? (templateData.imageUrl ?? null) : (currentConfig.imageUrl ?? null));
            let workingWinners = newWinners || currentConfig.winnersCount;
            let workingHost = newHost
                ? { id: newHost.id, username: newHost.username }
                : { id: giveaway.host_id, username: giveaway.host_name || 'Host' };

            let workingReqRoleIds = reqRoleIds.length ? reqRoleIds : currentConfig.reqRoleIds;
            let workingReqRoleMode = reqRoleMode || currentConfig.reqRoleMode;
            let workingBypassRoleIds = bypassRoleIds.length ? bypassRoleIds : currentConfig.bypassRoleIds;
            let workingBypassRoleMode = bypassRoleMode || currentConfig.bypassRoleMode;
            let workingBanRoleIds = banRoleIds;

            let workingMultiplier = currentMultiplier;
            let workingEntryValues = currentEntryValues;

            // Template Switch
            if (templateData) {
                oldValues.template = giveaway.template || 'custom';
                updates.template = newTemplate;

                workingTitle = newTitle || templateData.title;
                workingColor = newColor ? parseColor(newColor) : templateData.color;
                workingImage = newImage !== null && newImage !== undefined ? newImage : (templateData.imageUrl ?? null);
                workingMultiplier = templateData.multiplier || null;

                if (!newWinners) {
                    workingWinners = templateData.winnersCount;
                }

                if (!newPrizes && !newMessagesAmount && !newMessagesDuration) {
                    workingEntryValues = processEntryValues(templateData.entryValues);
                }
            }

            // Title
            if (newTitle || (templateData && workingTitle !== giveaway.title)) {
                oldValues.title = giveaway.title || 'Not set';
                updates.title = workingTitle;
            }

            // Winners
            if (newWinners || (templateData && workingWinners !== giveaway.winners_count)) {
                oldValues.winners_count = giveaway.winners_count;
                updates.winners_count = workingWinners;
            }

            // Host
            if (newHost) {
                oldValues.host_id = `<@${giveaway.host_id}>`;
                updates.host_id = newHost.id;
                updates.host_name = newHost.username;
            }

            // Color
            if (newColor || (templateData && workingColor !== giveaway.color)) {
                oldValues.color = numberToHex(giveaway.color);
                updates.color = workingColor;
            }

            // Image
            if (newImage !== null && newImage !== undefined) {
                oldValues.image_url = giveaway.image_url || 'No image';
                updates.image_url = newImage;
            } else if (templateData && workingImage !== giveaway.image_url) {
                oldValues.image_url = giveaway.image_url || 'No image';
                updates.image_url = workingImage;
            }

            // Roles (Arrays with Mode)
            if (bypassRolesInput) {
                const oldBypass = currentConfig.bypassRoleIds.length ? currentConfig.bypassRoleIds.map(id => `<@&${id}>`).join(', ') : 'Not set';
                oldValues.bypass_role_id = oldBypass;
                updates.bypass_role_id = JSON.stringify(workingBypassRoleIds);
                updates.bypass_role_mode = workingBypassRoleMode;
            } else if (templateData && JSON.stringify(workingBypassRoleIds) !== JSON.stringify(currentConfig.bypassRoleIds)) {
                oldValues.bypass_role_id = currentConfig.bypassRoleIds.length ? currentConfig.bypassRoleIds.map(id => `<@&${id}>`).join(', ') : 'Not set';
                updates.bypass_role_id = JSON.stringify(workingBypassRoleIds);
                updates.bypass_role_mode = workingBypassRoleMode;
            }

            if (reqRolesInput) {
                const oldReq = currentConfig.reqRoleIds.length ? currentConfig.reqRoleIds.map(id => `<@&${id}>`).join(', ') : 'Not set';
                oldValues.reqrole = oldReq;
                updates.reqrole = JSON.stringify(workingReqRoleIds);
                updates.req_role_mode = workingReqRoleMode;
            } else if (templateData && JSON.stringify(workingReqRoleIds) !== JSON.stringify(currentConfig.reqRoleIds)) {
                oldValues.reqrole = currentConfig.reqRoleIds.length ? currentConfig.reqRoleIds.map(id => `<@&${id}>`).join(', ') : 'Not set';
                updates.reqrole = JSON.stringify(workingReqRoleIds);
                updates.req_role_mode = workingReqRoleMode;
            }

            if (banRolesInput) {
                const oldBan = currentConfig.banRoleIds.length ? currentConfig.banRoleIds.map(id => `<@&${id}>`).join(', ') : 'Default';
                oldValues.banrole = oldBan;
                updates.banrole = JSON.stringify(workingBanRoleIds);
            }

            // Multiplier
            if (newMultipleChance) {
                const parsedMultiplier = parseMultiplierInput(newMultipleChance);
                if (!parsedMultiplier) {
                    return interaction.editReply('❌ Invalid `multiple_chance` format, use something like `@role:2,@role:4`');
                }
                oldValues.multiplier = currentMultiplier ? JSON.stringify(currentMultiplier) : 'Not set';
                updates.multiplier = JSON.stringify(parsedMultiplier);
                workingMultiplier = parsedMultiplier;
            } else if (templateData && JSON.stringify(workingMultiplier || null) !== JSON.stringify(currentMultiplier || null)) {
                oldValues.multiplier = currentMultiplier ? JSON.stringify(currentMultiplier) : 'Not set';
                updates.multiplier = JSON.stringify(workingMultiplier);
            }

            // Prizes / Entry Values
            if (newPrizes) {
                const prizesList = newPrizes.split(',').map(p => p.trim()).filter(Boolean);
                if (!prizesList.length) {
                    return interaction.editReply('❌ You must provide at least one prize.');
                }
                if (prizesList.length > 25) {
                    return interaction.editReply('❌ Max 25 prizes.');
                }

                let requirements = [];
                if (newMessagesAmount) {
                    requirements = newMessagesAmount.split(',').map(v => {
                        const parsed = parseInt(v.trim(), 10);
                        return isNaN(parsed) ? 0 : parsed;
                    });
                } else if (workingEntryValues?.buttons) {
                    requirements = workingEntryValues.buttons.map(b => b.required || 0);
                }

                const period = newMessagesDuration || workingEntryValues?.period || 'weekly';

                workingEntryValues = {
                    period,
                    buttons: prizesList.map((prize, idx) => ({
                        type: `CUSTOM_${idx}`,
                        label: prize,
                        required: idx < requirements.length ? requirements[idx] : 0
                    }))
                };

                oldValues.entry_values = 'Previous prizes';
                updates.entry_values = JSON.stringify(workingEntryValues);

                if (!newWinners) {
                    workingWinners = prizesList.length;
                    oldValues.winners_count = giveaway.winners_count;
                    updates.winners_count = prizesList.length;
                }
            } else {
                if (newMessagesDuration && workingEntryValues?.buttons) {
                    oldValues.messages_duration = workingEntryValues.period || 'weekly';
                    workingEntryValues = { ...workingEntryValues, period: newMessagesDuration };
                    updates.entry_values = JSON.stringify(workingEntryValues);
                }

                if (newMessagesAmount && workingEntryValues?.buttons) {
                    const amounts = newMessagesAmount.split(',').map(v => {
                        const parsed = parseInt(v.trim(), 10);
                        return isNaN(parsed) ? 0 : parsed;
                    });

                    oldValues.number_of_messages = workingEntryValues.buttons.map(b => b.required || 0).join(',');
                    workingEntryValues = {
                        ...workingEntryValues,
                        buttons: workingEntryValues.buttons.map((btn, idx) => ({
                            ...btn,
                            required: idx < amounts.length ? amounts[idx] : (btn.required || 0)
                        }))
                    };
                    updates.entry_values = JSON.stringify(workingEntryValues);
                }

                if (templateData && !newMessagesAmount && !newMessagesDuration && !newPrizes) {
                    oldValues.entry_values = 'Previous entry values';
                    updates.entry_values = JSON.stringify(workingEntryValues);
                }
            }

            // Duration
            let newEndTime = null;
            let newScheduleTime = null;

            if (newDuration) {
                const durationMs = parseDuration(newDuration);
                if (!durationMs) {
                    return interaction.editReply('❌ Invalid duration format');
                }

                oldValues.duration = giveaway.duration || 'Unknown';
                updates.duration = newDuration;

                const currentStart = giveaway.schedule
                    ? new Date(giveaway.schedule)
                    : new Date(giveaway.created_at || Date.now());

                newEndTime = new Date(currentStart.getTime() + durationMs);
                updates.end_time = newEndTime.toISOString();
            }

            // Schedule
            if (newScheduled) {
                if (giveaway.status !== 'scheduled') {
                    return interaction.editReply('❌ `scheduled` can only be changed for scheduled giveaways');
                }

                const delayMs = parseDuration(newScheduled);
                if (!delayMs) {
                    return interaction.editReply('❌ Invalid scheduled format');
                }

                newScheduleTime = new Date(Date.now() + delayMs);
                oldValues.schedule = giveaway.schedule ? new Date(giveaway.schedule).toLocaleString() : 'Not scheduled';
                updates.schedule = newScheduleTime.toISOString();

                const durationMs = parseDuration(newDuration || giveaway.duration);
                if (durationMs) {
                    newEndTime = new Date(newScheduleTime.getTime() + durationMs);
                    updates.end_time = newEndTime.toISOString();
                }
            }

            // Rebuild Description
            const descriptionChanged =
                newDescription !== null && newDescription !== undefined ||
                newTitle ||
                reqRolesInput ||
                banRolesInput ||
                bypassRolesInput ||
                newPrizes ||
                newMessagesDuration ||
                newMessagesAmount ||
                newTemplate ||
                newMultipleChance;

            if (descriptionChanged) {
                let extraDescription = '';
                if (newDescription !== null && newDescription !== undefined) {
                    extraDescription = newDescription;
                } else {
                    const currentDesc = giveaway.description || '';
                    const lines = currentDesc.split('\n');
                    const withoutTitle = lines.slice(1).join('\n').trim();
                    const systemPrefixes = [
                        'Winner Will Get:',
                        'Blacklisted:',
                        'Required',
                        'Bypass',
                        'Extra Entries:',
                        '• <@&',
                        'Messages Sent:',
                        '•'
                    ];
                    const descLines = withoutTitle.split('\n').filter(line => {
                        const trimmed = line.trim();
                        if (!trimmed) return false;
                        return !systemPrefixes.some(prefix => trimmed.startsWith(prefix));
                    });
                    extraDescription = descLines.join('\n').trim();
                }

                const rebuiltDescription = buildDescriptionFromEntryValues(
                    workingEntryValues,
                    workingTitle,
                    extraDescription,
                    workingReqRoleIds,
                    workingBypassRoleIds,
                    workingMultiplier,
                    workingBanRoleIds,
                    workingReqRoleMode,
                    workingBypassRoleMode
                );

                oldValues.description = 'Previous description';
                updates.description = rebuiltDescription;
            }

            // No Changes Guard
            if (Object.keys(updates).length === 0) {
                return interaction.editReply('❌ No changes specified');
            }

            // Build & Run Query
            const setClauses = [];
            const values = [];
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updates)) {
                setClauses.push(`${key} = $${paramIndex++}`);
                values.push(value);
            }

            values.push(code);

            const query = `UPDATE giveaways SET ${setClauses.join(', ')}, updated_at = NOW() WHERE giveaway_code = $${paramIndex}`;
            await dbManager.run(query, values);

            // Update Live Message
            const updatedGiveaway = await dbManager.getGiveawayByCode(code);
            let messageUpdated = false;

            if (updatedGiveaway.message_id && updatedGiveaway.channel_id && updatedGiveaway.status === 'active') {
                try {
                    const channel = interaction.client.channels.cache.get(updatedGiveaway.channel_id)
                        || await interaction.client.channels.fetch(updatedGiveaway.channel_id).catch(() => null);

                    if (channel) {
                        const msg = await channel.messages.fetch(updatedGiveaway.message_id).catch(() => null);
                        if (msg) {
                            const config = buildConfigFromGiveaway(updatedGiveaway);
                            const endsAt = new Date(updatedGiveaway.end_time);
                            const hostUser = {
                                id: updatedGiveaway.host_id || DEFAULT_HOST_ID,
                                username: updatedGiveaway.host_name || 'Host',
                                displayAvatarURL: () => null
                            };
                            const entries = updatedGiveaway.entries || {};

                            await msg.edit({
                                embeds: [createGiveawayEmbed(config, endsAt, code, hostUser, entries)],
                                components: buildButtonRow(config, code, entries)
                            });

                            messageUpdated = true;
                        }
                    }
                } catch (err) {
                    console.error('❌ Failed to update giveaway message:', err);
                }
            }

            // Build Success Embed
            const successEmbed = new EmbedBuilder()
                .setColor(0x57f287)
                .setTitle('✅ Giveaway Updated Successfully!')
                .setDescription(`**Giveaway:** \`${code}\``)
                .setTimestamp();

            const fieldNames = {
                template: '📋 Template',
                title: '📝 Title',
                description: '📄 Description',
                duration: '⏱️ Duration',
                winners_count: '👑 Winners Count',
                host_id: '👤 Host',
                image_url: '🖼️ Image',
                schedule: '📅 Schedule',
                bypass_role_id: '⚡ Bypass Roles',
                reqrole: '✅ Required Roles',
                banrole: '⛔ Banned Roles',
                entry_values: '🎁 Prizes / Requirements',
                color: '🎨 Color',
                multiplier: '🔄 Extra Entries',
                number_of_messages: '💬 Message Requirements',
                messages_duration: '📅 Messages Period',
                req_role_mode: '📌 Required Mode',
                bypass_role_mode: '⚡ Bypass Mode'
            };

            let changesList = '';

            for (const [key, value] of Object.entries(updates)) {
                if (key === 'host_name' || key === 'end_time' || key === 'description') continue;

                const fieldName = fieldNames[key] || key;
                let oldVal = oldValues[key] || 'Updated';
                let newVal = value;

                if (key === 'color') {
                    newVal = numberToHex(value);
                } else if (key === 'host_id') {
                    newVal = `<@${value}>`;
                } else if (key === 'bypass_role_id') {
                    try {
                        const arr = JSON.parse(value);
                        newVal = arr.length ? arr.map(id => `<@&${id}>`).join(', ') : 'Not set';
                    } catch { newVal = 'Not set'; }
                    if (oldVal === 'Not set' && newVal === 'Not set') continue;
                } else if (key === 'reqrole') {
                    try {
                        const arr = JSON.parse(value);
                        newVal = arr.length ? arr.map(id => `<@&${id}>`).join(', ') : 'Not set';
                    } catch { newVal = 'Not set'; }
                    if (oldVal === 'Not set' && newVal === 'Not set') continue;
                } else if (key === 'banrole') {
                    try {
                        const arr = JSON.parse(value);
                        newVal = arr.length ? arr.map(id => `<@&${id}>`).join(', ') : 'Default';
                    } catch { newVal = 'Default'; }
                    if (oldVal === 'Default' && newVal === 'Default') continue;
                } else if (key === 'req_role_mode') {
                    newVal = value === 'y' ? 'All Required' : 'Any Required';
                    oldVal = oldValues.req_role_mode || (giveaway.req_role_mode === 'y' ? 'All Required' : 'Any Required');
                } else if (key === 'bypass_role_mode') {
                    newVal = value === 'y' ? 'All Bypass' : 'Any Bypass';
                    oldVal = oldValues.bypass_role_mode || (giveaway.bypass_role_mode === 'y' ? 'All Bypass' : 'Any Bypass');
                } else if (key === 'entry_values') {
                    try {
                        const parsed = JSON.parse(value);
                        newVal = parsed.buttons?.map(btn => `${btn.label} (${btn.required || 0})`).join(', ') || 'Updated';
                    } catch {
                        newVal = 'Updated';
                    }
                } else if (key === 'multiplier') {
                    try {
                        const parsed = JSON.parse(value);
                        newVal = Object.entries(parsed).map(([roleId, weight]) => `<@&${roleId}>: x${weight}`).join(', ');
                    } catch {
                        newVal = 'Updated';
                    }
                }

                changesList += `**${fieldName}:** ${oldVal} → ${newVal}\n`;
            }

            if (changesList) {
                successEmbed.addFields({
                    name: '📋 Changes Made',
                    value: changesList.slice(0, 1024),
                    inline: false
                });
            } else {
                successEmbed.addFields({
                    name: '📋 Changes Made',
                    value: 'Updated successfully',
                    inline: false
                });
            }

            if (newEndTime) {
                successEmbed.addFields({
                    name: '⏰ New End Time',
                    value: `<t:${Math.floor(newEndTime.getTime() / 1000)}:R>`,
                    inline: true
                });
            }

            if (newScheduleTime) {
                successEmbed.addFields({
                    name: '📅 New Schedule',
                    value: `<t:${Math.floor(newScheduleTime.getTime() / 1000)}:R>`,
                    inline: true
                });
            }

            if (!messageUpdated && updatedGiveaway.message_id) {
                successEmbed.addFields({
                    name: '⚠️ Note',
                    value: 'Changes were saved, but the live giveaway message was not updated automatically',
                    inline: false
                });
            }

            const components = [];
            if (updatedGiveaway.channel_id && updatedGiveaway.message_id) {
                const url = `https://discord.com/channels/${interaction.guildId}/${updatedGiveaway.channel_id}/${updatedGiveaway.message_id}`;
                components.push(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('Go to Giveaway')
                            .setURL(url)
                            .setStyle(ButtonStyle.Link)
                    )
                );
            }

            return interaction.editReply({
                embeds: [successEmbed],
                components
            });

        } catch (error) {
            console.error('❌ giveawayedit error:', error);
            await interaction.editReply('❌ Error editing giveaway').catch(() => {});
        }
    }
};