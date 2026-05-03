const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const dbManager = require('../Data/database');
const parseDuration = require('../System/durationParser');
const giveawayCommand = require('./1 giveawaycreate');

const {
    parseRoleIdsFromString,
    parseColor,
    parseMultiplierInput,
    parseJsonField,
    randomBetween,
    getPrizeDisplayName,
    getPeriodLabel,
    buildExtraEntriesLines,
    buildRequirementsLines,
    buildDescriptionFromEntryValues,
    getTemplateData,
    processEntryValues,
    buildConfigFromGiveaway
} = giveawayCommand;

// ========== CONSTANTS ==========
const DEFAULT_BLACKLIST_ROLES = ['1380141514293776466'];
const DEFAULT_HOST_ID = '1363733513081454774';

const BOOSTER_ROLE_ID = '1374313963428253847';
const GAMER_1_ID = '1363754810645417994';
const GAMER_2_ID = '1363754894888013846';
const GAMER_3_ID = '1363754940710916187';
const GAMER_4_ID = '1363754996793085972';

const SKYWELL_LVL1_ID = '1465705164139794443';
const SKYWELL_LVL2_ID = '1465705207760556186';
const SKYWELL_LVL3_ID = '1465705232280453283';
const SKYWELL_LVL4_ID = '1465705263209123975';
const SKYWELL_LVL5_ID = '1465705294234652736';

// ========== LOCAL HELPERS ==========

function numberToHex(colorNumber) {
    if (!colorNumber) return '#0073ff';
    return '#' + Number(colorNumber).toString(16).padStart(6, '0');
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

    // أضف زرار Participants لو عدد الأزرار 3 أو أقل
    const buttonsCount = buttons.length;
    if (buttonsCount > 0 && buttonsCount <= 3) {
        const firstRow = rows[0];
        if (firstRow) {
            firstRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`giveaway_participants_${giveawayCode}_view_1`)
                    .setLabel('Participants')
                    .setEmoji('👥')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled)
            );
        }
    }

    return rows;
}

// ========== RECALCULATE WEIGHTS ==========

async function recalculateExistingParticipantsWeights(giveawayCode, newMultiplier, client) {
    const giveaway = await dbManager.getGiveawayByCode(giveawayCode);
    if (!giveaway) return false;

    const entries = giveaway.entries || {};
    if (!Object.keys(entries).length) return false;

    const guild = await client.guilds.fetch(giveaway.guild_id);

    let updated = false;
    const newEntries = { ...entries };

    for (const [key, entry] of Object.entries(entries)) {
        try {
            const member = await guild.members.fetch(entry.userId).catch(() => null);
            if (!member) continue;

            let newWeight = 1;
            const hasBooster = member.roles.cache.has(BOOSTER_ROLE_ID);

            for (const [roleId, weight] of Object.entries(newMultiplier || {})) {
                if (member.roles.cache.has(roleId)) {
                    let finalWeight = Number(weight) || 1;
                    if (hasBooster) finalWeight = Math.round(finalWeight * 1.5);
                    if (finalWeight > newWeight) newWeight = finalWeight;
                }
            }

            if (newWeight !== entry.weight) {
                newEntries[key] = { ...entry, weight: newWeight };
                updated = true;
            }
        } catch (err) {
            console.warn(`⚠️ Could not recalc weight for ${entry.userId}:`, err.message);
        }
    }

    if (updated) {
        await dbManager.run(
            `UPDATE giveaways SET entries = $1::jsonb, updated_at = NOW() WHERE giveaway_code = $2`,
            [JSON.stringify(newEntries), giveawayCode]
        );
        console.log(`✅ Recalculated weights for ${giveawayCode}`);
    }

    return updated;
}

// ========== EXTRACT EXTRA DESCRIPTION ==========

function extractExtraDescription(currentDesc) {
    if (!currentDesc) return '';

    const lines = currentDesc.split('\n');
    const withoutTitle = lines.slice(1).join('\n').trim();

    const systemPrefixes = [
        'Winner Will Get:',
        'Blacklisted:',
        'Required',
        'Bypass',
        'Extra Entries:',
        '• ',
        'Messages Sent:',
        '**Extra Entries',
        '#'
    ];

    const descLines = withoutTitle.split('\n').filter(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return false;
        return !systemPrefixes.some(prefix => trimmed.startsWith(prefix));
    });

    return descLines.join('\n').trim();
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
        .addStringOption(opt => opt.setName('multiple_chance').setDescription('Role weights like @role:2,@role:4').setRequired(false))
        .addStringOption(opt => opt.setName('prizes').setDescription('New prizes separated by commas').setRequired(false))
        .addStringOption(opt => opt.setName('messages_duration').setDescription('New period (daily/weekly/monthly)').setRequired(false).addChoices(
            { name: 'Daily', value: 'daily' },
            { name: 'Weekly', value: 'weekly' },
            { name: 'Monthly', value: 'monthly' }
        ))
        .addStringOption(opt => opt.setName('number_of_messages').setDescription('New message requirements for each prize').setRequired(false))
        .addStringOption(opt => opt.setName('color').setDescription('New embed color').setRequired(false)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // ===== Permission Check =====
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');
            if (!moderateRoleData) return interaction.editReply('❌ Set `/setrole` first.');

            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!member.roles.cache.has(roleInfo.id)) {
                return interaction.editReply(`⛔ Only <@&${roleInfo.id}> can use this`);
            }

            // ===== Fetch Giveaway =====
            const code = interaction.options.getString('code');
            const giveaway = await dbManager.getGiveawayByCode(code);

            if (!giveaway) return interaction.editReply(`❌ Giveaway \`${code}\` not found`);
            if (!['active', 'scheduled'].includes(giveaway.status)) {
                return interaction.editReply(`❌ Giveaway \`${code}\` is \`${giveaway.status}\`, only active or scheduled giveaways can be edited`);
            }

            // ===== Read Options =====
            const newTemplate        = interaction.options.getString('template');
            const newTitle           = interaction.options.getString('title');
            const newDescription     = interaction.options.getString('description');
            const newDuration        = interaction.options.getString('duration');
            const newWinners         = interaction.options.getInteger('winners');
            const newHost            = interaction.options.getUser('host');
            const newImage           = interaction.options.getString('image');
            const newScheduled       = interaction.options.getString('scheduled');
            const bypassRolesInput   = interaction.options.getString('bypass_role');
            const reqRolesInput      = interaction.options.getString('required_role');
            const banRolesInput      = interaction.options.getString('blacklist');
            const newPrizes          = interaction.options.getString('prizes');
            const newMessagesDuration = interaction.options.getString('messages_duration');
            const newMessagesAmount  = interaction.options.getString('number_of_messages');
            const newColor           = interaction.options.getString('color');
            const newMultipleChance  = interaction.options.getString('multiple_chance');

            // ===== Parse Roles =====
            const { ids: bypassRoleIds, mode: bypassRoleMode } = parseRoleIdsFromString(bypassRolesInput);
            const { ids: reqRoleIds,    mode: reqRoleMode    } = parseRoleIdsFromString(reqRolesInput);
            const { ids: customBanRoleIds }                    = parseRoleIdsFromString(banRolesInput);
            const banRoleIds = customBanRoleIds.length > 0 ? customBanRoleIds : DEFAULT_BLACKLIST_ROLES;

            // ===== Validate Template =====
            const templateData = newTemplate ? getTemplateData(newTemplate) : null;
            if (newTemplate && !templateData) return interaction.editReply(`❌ Template "${newTemplate}" not found`);

            const currentConfig      = buildConfigFromGiveaway(giveaway);
            const currentEntryValues = parseJsonField(giveaway.entry_values);
            const currentMultiplier  = parseJsonField(giveaway.multiplier);

            // ===== Build Working Values =====
            const updates   = {};
            const oldValues = {};

            let workingTitle        = newTitle || (templateData?.title ?? currentConfig.title);
            let workingColor        = newColor ? parseColor(newColor) : (templateData?.color ?? currentConfig.color);
            let workingImage        = newImage !== null && newImage !== undefined
                ? newImage
                : (templateData ? (templateData.imageUrl ?? null) : (currentConfig.imageUrl ?? null));
            let workingWinners      = newWinners || currentConfig.winnersCount;
            let workingReqRoleIds   = reqRoleIds.length   ? reqRoleIds   : currentConfig.reqRoleIds;
            let workingReqRoleMode  = reqRoleMode          || currentConfig.reqRoleMode;
            let workingBypassRoleIds = bypassRoleIds.length ? bypassRoleIds : currentConfig.bypassRoleIds;
            let workingBypassRoleMode = bypassRoleMode      || currentConfig.bypassRoleMode;
            let workingBanRoleIds   = banRoleIds;
            let workingMultiplier   = currentMultiplier;
            let workingEntryValues  = currentEntryValues;

            // ===== Template Switch =====
            if (templateData) {
                oldValues.template = giveaway.template || 'custom';
                updates.template   = newTemplate;

                workingTitle    = newTitle || templateData.title;
                workingColor    = newColor ? parseColor(newColor) : templateData.color;
                workingImage    = newImage !== null && newImage !== undefined ? newImage : (templateData.imageUrl ?? null);
                workingMultiplier = templateData.multiplier || null;
                if (!newWinners) workingWinners = templateData.winnersCount;
                if (!newPrizes && !newMessagesAmount && !newMessagesDuration) {
                    workingEntryValues = processEntryValues(templateData.entryValues);
                }
            }

            // ===== Title =====
            if (newTitle || (templateData && workingTitle !== giveaway.title)) {
                oldValues.title = giveaway.title || 'Not set';
                updates.title   = workingTitle;
            }

            // ===== Winners =====
            if (newWinners || (templateData && workingWinners !== giveaway.winners_count)) {
                oldValues.winners_count = giveaway.winners_count;
                updates.winners_count   = workingWinners;
            }

            // ===== Host =====
            if (newHost) {
                oldValues.host_id = `<@${giveaway.host_id}>`;
                updates.host_id   = newHost.id;
                updates.host_name = newHost.username;
            }

            // ===== Color =====
            if (newColor || (templateData && workingColor !== giveaway.color)) {
                oldValues.color = numberToHex(giveaway.color);
                updates.color   = workingColor;
            }

            // ===== Image =====
            if (newImage !== null && newImage !== undefined) {
                oldValues.image_url = giveaway.image_url || 'No image';
                updates.image_url   = newImage;
            } else if (templateData && workingImage !== giveaway.image_url) {
                oldValues.image_url = giveaway.image_url || 'No image';
                updates.image_url   = workingImage;
            }

            // ===== Roles =====
            if (bypassRolesInput) {
                oldValues.bypass_role_id = currentConfig.bypassRoleIds.length
                    ? currentConfig.bypassRoleIds.map(id => `<@&${id}>`).join(', ') : 'Not set';
                updates.bypass_role_id   = workingBypassRoleIds.length ? `{${workingBypassRoleIds.join(',')}}` : null;
                updates.bypass_role_mode = workingBypassRoleMode;
            } else if (templateData && JSON.stringify(workingBypassRoleIds) !== JSON.stringify(currentConfig.bypassRoleIds)) {
                oldValues.bypass_role_id = currentConfig.bypassRoleIds.length
                    ? currentConfig.bypassRoleIds.map(id => `<@&${id}>`).join(', ') : 'Not set';
                updates.bypass_role_id   = workingBypassRoleIds.length ? `{${workingBypassRoleIds.join(',')}}` : null;
                updates.bypass_role_mode = workingBypassRoleMode;
            }

            if (reqRolesInput) {
                oldValues.reqrole       = currentConfig.reqRoleIds.length
                    ? currentConfig.reqRoleIds.map(id => `<@&${id}>`).join(', ') : 'Not set';
                updates.reqrole         = workingReqRoleIds.length ? `{${workingReqRoleIds.join(',')}}` : null;
                updates.req_role_mode   = workingReqRoleMode;
            } else if (templateData && JSON.stringify(workingReqRoleIds) !== JSON.stringify(currentConfig.reqRoleIds)) {
                oldValues.reqrole       = currentConfig.reqRoleIds.length
                    ? currentConfig.reqRoleIds.map(id => `<@&${id}>`).join(', ') : 'Not set';
                updates.reqrole         = workingReqRoleIds.length ? `{${workingReqRoleIds.join(',')}}` : null;
                updates.req_role_mode   = workingReqRoleMode;
            }

            if (banRolesInput) {
                oldValues.banrole = currentConfig.banRoleIds.length
                    ? currentConfig.banRoleIds.map(id => `<@&${id}>`).join(', ') : 'Default';
                updates.banrole   = workingBanRoleIds.length ? `{${workingBanRoleIds.join(',')}}` : null;
            }

            // ===== Multiplier =====
            let parsedMultiplierForRecalc = null;
            if (newMultipleChance) {
                const parsedMultiplier = parseMultiplierInput(newMultipleChance);
                if (!parsedMultiplier) return interaction.editReply('❌ Invalid `multiple_chance` format, use something like `@role:2,@role:4`');
                oldValues.multiplier        = currentMultiplier ? JSON.stringify(currentMultiplier) : 'Not set';
                updates.multiplier          = JSON.stringify(parsedMultiplier);
                workingMultiplier           = parsedMultiplier;
                parsedMultiplierForRecalc   = parsedMultiplier;
            } else if (templateData && JSON.stringify(workingMultiplier || null) !== JSON.stringify(currentMultiplier || null)) {
                oldValues.multiplier        = currentMultiplier ? JSON.stringify(currentMultiplier) : 'Not set';
                updates.multiplier          = JSON.stringify(workingMultiplier);
                parsedMultiplierForRecalc   = workingMultiplier;
            }

            // ===== Prizes / Entry Values =====
            if (newPrizes) {
                const prizesList = newPrizes.split(',').map(p => p.trim()).filter(Boolean);
                if (!prizesList.length) return interaction.editReply('❌ You must provide at least one prize.');
                if (prizesList.length > 25) return interaction.editReply('❌ Max 25 prizes.');

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
                updates.entry_values   = JSON.stringify(workingEntryValues);

                if (!newWinners) {
                    workingWinners        = prizesList.length;
                    oldValues.winners_count = giveaway.winners_count;
                    updates.winners_count   = prizesList.length;
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
                    updates.entry_values   = JSON.stringify(workingEntryValues);
                }
            }

            // ===== Duration =====
            let newEndTime      = null;
            let newScheduleTime = null;

            if (newDuration) {
                const durationMs = parseDuration(newDuration);
                if (!durationMs) return interaction.editReply('❌ Invalid duration format');

                oldValues.duration = giveaway.duration || 'Unknown';
                updates.duration   = newDuration;

                const currentStart = giveaway.schedule
                    ? new Date(giveaway.schedule)
                    : new Date(giveaway.created_at || Date.now());

                newEndTime       = new Date(currentStart.getTime() + durationMs);
                updates.end_time = newEndTime.toISOString();
            }

            // ===== Schedule =====
            if (newScheduled) {
                if (giveaway.status !== 'scheduled') return interaction.editReply('❌ `scheduled` can only be changed for scheduled giveaways');

                const delayMs = parseDuration(newScheduled);
                if (!delayMs) return interaction.editReply('❌ Invalid scheduled format');

                newScheduleTime  = new Date(Date.now() + delayMs);
                oldValues.schedule = giveaway.schedule ? new Date(giveaway.schedule).toLocaleString() : 'Not scheduled';
                updates.schedule   = newScheduleTime.toISOString();

                const durationMs = parseDuration(newDuration || giveaway.duration);
                if (durationMs) {
                    newEndTime       = new Date(newScheduleTime.getTime() + durationMs);
                    updates.end_time = newEndTime.toISOString();
                }
            }

            // ===== Rebuild Description =====
            const descriptionChanged =
                newDescription !== null && newDescription !== undefined ||
                newTitle || reqRolesInput || banRolesInput || bypassRolesInput ||
                newPrizes || newMessagesDuration || newMessagesAmount ||
                newTemplate || newMultipleChance;

            if (descriptionChanged) {
                const extraDescription = newDescription !== null && newDescription !== undefined
                    ? newDescription
                    : extractExtraDescription(giveaway.description);

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
                updates.description   = rebuiltDescription;
            }

            // ===== No Changes Guard =====
            if (Object.keys(updates).length === 0) return interaction.editReply('❌ No changes specified');

            // ===== Build & Run Query =====
            const setClauses = [];
            const values     = [];
            let paramIndex   = 1;

            for (const [key, value] of Object.entries(updates)) {
                setClauses.push(`${key} = $${paramIndex++}`);
                values.push(value);
            }
            values.push(code);

            await dbManager.run(
                `UPDATE giveaways SET ${setClauses.join(', ')}, updated_at = NOW() WHERE giveaway_code = $${paramIndex}`,
                values
            );

            // ===== Recalculate Weights if Multiplier Changed =====
            if (parsedMultiplierForRecalc) {
                await recalculateExistingParticipantsWeights(code, parsedMultiplierForRecalc, interaction.client);
            }

            // ===== Update Live Message =====
            const updatedGiveaway = await dbManager.getGiveawayByCode(code);
            let messageUpdated    = false;

            if (updatedGiveaway.message_id && updatedGiveaway.channel_id && updatedGiveaway.status === 'active') {
                try {
                    const channel = interaction.client.channels.cache.get(updatedGiveaway.channel_id)
                        || await interaction.client.channels.fetch(updatedGiveaway.channel_id).catch(() => null);

                    if (channel) {
                        const msg = await channel.messages.fetch(updatedGiveaway.message_id).catch(() => null);
                        if (msg) {
                            const config  = buildConfigFromGiveaway(updatedGiveaway);
                            const endsAt  = new Date(updatedGiveaway.end_time);
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

            // ===== Build Success Embed =====
            const successEmbed = new EmbedBuilder()
                .setColor(0x57f287)
                .setTitle('✅ Giveaway Updated Successfully!')
                .setDescription(`**Giveaway:** \`${code}\``)
                .setTimestamp();

            const fieldNames = {
                template:          '📋 Template',
                title:             '📝 Title',
                description:       '📄 Description',
                duration:          '⏱️ Duration',
                winners_count:     '👑 Winners Count',
                host_id:           '👤 Host',
                image_url:         '🖼️ Image',
                schedule:          '📅 Schedule',
                bypass_role_id:    '⚡ Bypass Roles',
                reqrole:           '✅ Required Roles',
                banrole:           '⛔ Banned Roles',
                entry_values:      '🎁 Prizes / Requirements',
                color:             '🎨 Color',
                multiplier:        '🔄 Extra Entries',
                number_of_messages:'💬 Message Requirements',
                messages_duration: '📅 Messages Period',
                req_role_mode:     '📌 Required Mode',
                bypass_role_mode:  '⚡ Bypass Mode'
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
                    if (value && typeof value === 'string' && value.startsWith('{')) {
                        const arr = value.slice(1, -1).split(',').filter(Boolean);
                        newVal = arr.length ? arr.map(id => `<@&${id}>`).join(', ') : 'Not set';
                    } else {
                        newVal = 'Not set';
                    }
                    if (oldVal === 'Not set' && newVal === 'Not set') continue;
                } else if (key === 'reqrole') {
                    if (value && typeof value === 'string' && value.startsWith('{')) {
                        const arr = value.slice(1, -1).split(',').filter(Boolean);
                        newVal = arr.length ? arr.map(id => `<@&${id}>`).join(', ') : 'Not set';
                    } else {
                        newVal = 'Not set';
                    }
                    if (oldVal === 'Not set' && newVal === 'Not set') continue;
                } else if (key === 'banrole') {
                    if (value && typeof value === 'string' && value.startsWith('{')) {
                        const arr = value.slice(1, -1).split(',').filter(Boolean);
                        newVal = arr.length ? arr.map(id => `<@&${id}>`).join(', ') : 'Default';
                    } else {
                        newVal = 'Default';
                    }
                    if (oldVal === 'Default' && newVal === 'Default') continue;
                } else if (key === 'req_role_mode') {
                    newVal = value === 'y' ? 'All Required' : 'Any Required';
                    oldVal = giveaway.req_role_mode === 'y' ? 'All Required' : 'Any Required';
                } else if (key === 'bypass_role_mode') {
                    newVal = value === 'y' ? 'All Bypass' : 'Any Bypass';
                    oldVal = giveaway.bypass_role_mode === 'y' ? 'All Bypass' : 'Any Bypass';
                } else if (key === 'entry_values') {
                    try {
                        const parsed = JSON.parse(value);
                        newVal = parsed.buttons?.map(btn => `${btn.label} (${btn.required || 0})`).join(', ') || 'Updated';
                    } catch { newVal = 'Updated'; }
                } else if (key === 'multiplier') {
                    try {
                        const parsed = JSON.parse(value);
                        newVal = Object.entries(parsed).map(([roleId, weight]) => `<@&${roleId}>: x${weight}`).join(', ');
                    } catch { newVal = 'Updated'; }
                }

                changesList += `**${fieldName}:** ${oldVal} → ${newVal}\n`;
            }

            successEmbed.addFields({
                name: '📋 Changes Made',
                value: (changesList || 'Updated successfully').slice(0, 1024),
                inline: false
            });

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

            return interaction.editReply({ embeds: [successEmbed], components });

        } catch (error) {
            console.error('❌ giveawayedit error:', error);
            await interaction.editReply('❌ Error editing giveaway').catch(() => {});
        }
    }
};