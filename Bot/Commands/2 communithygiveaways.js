const {
    SlashCommandBuilder,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const dbManager = require('../Data/database');
const parseDuration = require('../System/durationParser');

// Constants
const WINNER_ROLE_ID = '1395730680926965781';
const REQUIRED_LEVEL = 1;
const REQUIRED_ROLE_IDS = ['1386710923594436639', '1394820196375593122'];
const BLOCKED_ROLE_ID = '1475754299735670815';
const MAX_ACTIVE_GIVEAWAYS = 2;
const GIVEAWAY_LOG_CHANNEL_ID = '1385531928446373970';
const GIVEAWAY_CHANNEL_ID = '1386682733920653454'; // ← Change this to your channel ID
const DEFAULT_COLOR = 0x4bff4b; // اللون الافتراضي أخضر

// تعريف خيارات المنصات والألوان
const PLATFORM_CHOICES = [
    { name: 'Steam', value: 'Steam' },
    { name: 'GOG', value: 'GOG' },
    { name: 'Epic Games', value: 'Epic Games' },
    { name: 'Legacy', value: 'Legacy' }
];

const COLOR_CHOICES = [
    { name: 'Green', value: '#00ff00' },
    { name: 'Red', value: '#ff0000' },
    { name: 'Blue', value: '#3498db' },
    { name: 'Yellow', value: '#ffff00' },
    { name: 'Purple', value: '#9b59b6' },
    { name: 'Orange', value: '#e67e22' },
    { name: 'Pink', value: '#ff69b4' },
    { name: 'Gold', value: '#f1c40f' },
    { name: 'Cyan', value: '#00ffff' },
    { name: 'Gray', value: '#95a5a6' }
];

// Store preview sessions
const previewSessions = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('communitygiveaway')
        .setDescription('Create a new giveaway')
        .addStringOption(option =>
            option.setName('game_name')
                .setDescription('Name of the game')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('game_link')
                .setDescription('Link to the game store page')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (e.g., 2d, 1h 30m, 3d 12h)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('Platform (e.g., Steam, Epic, etc.)')
                .setRequired(true)
                .addChoices(...PLATFORM_CHOICES))
        .addStringOption(option =>
            option.setName('image')
                .setDescription('Image URL')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('Number of winners (1-25)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(25))
        .addStringOption(option =>
            option.setName('note')
                .setDescription('Additional note (optional)')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('reqrole')
                .setDescription('Required role to join (optional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('message_requirement_type')
                .setDescription('Message requirement type')
                .setRequired(false)
                .addChoices(
                    { name: 'Total Messages', value: 'total' },
                    { name: 'Monthly Messages', value: 'monthly' },
                    { name: 'Weekly Messages', value: 'weekly' },
                    { name: 'Daily Messages', value: 'daily' }
                ))
        .addIntegerOption(option =>
            option.setName('message_requirement_amount')
                .setDescription('Number of messages required to join')
                .setRequired(false)
                .setMinValue(1))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Embed color (optional)')
                .setRequired(false)
                .addChoices(...COLOR_CHOICES)),

    buildReplyEmbed(color, text) {
        return new EmbedBuilder().setColor(color).setDescription(text);
    },

    parseColor(colorInput) {
        if (!colorInput) return DEFAULT_COLOR;

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
            GOLD: 0xf1c40f,
            CYAN: 0x00ffff,
            GRAY: 0x95a5a6
        };

        if (colorNames[colorInput.toUpperCase()]) return colorNames[colorInput.toUpperCase()];

        const num = parseInt(colorInput, 10);
        if (!isNaN(num)) return num;

        return DEFAULT_COLOR;
    },

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Fetch the target channel (Giveaways_Channel)
            const targetChannel = await interaction.guild.channels.fetch(GIVEAWAY_CHANNEL_ID);
            if (!targetChannel) {
                return await interaction.editReply({
                    content: `❌ Giveaways channel not found. Please set a valid channel ID in the code.`,
                    allowedMentions: { parse: [] }
                });
            }

            // Permission checks
            if (interaction.member.roles.cache.has(BLOCKED_ROLE_ID)) {
                return await interaction.editReply({
                    content: '❌ You are blocked from creating giveaways',
                    allowedMentions: { parse: [] }
                });
            }

            const hasRequiredRole = REQUIRED_ROLE_IDS.every(roleId =>
                interaction.member.roles.cache.has(roleId)
            );

            if (!hasRequiredRole) {
                const rolesMention = REQUIRED_ROLE_IDS.map(id => `<@&${id}>`).join(' and ');
                return await interaction.editReply({
                    content: `❌ You need **both** of these roles: ${rolesMention} to use this command`,
                    allowedMentions: { parse: [] }
                });
            }

            const userData = await dbManager.getUserProfile(interaction.user.id);
            if (!userData) {
                return await interaction.editReply({
                    content: '❌ No account found\nSend a message in chat to create your account',
                    allowedMentions: { parse: [] }
                });
            }

            if (userData.level < REQUIRED_LEVEL) {
                return await interaction.editReply({
                    content: `❌ You need level ${REQUIRED_LEVEL}+ to create giveaways\nYour level: ${userData.level}`,
                    allowedMentions: { parse: [] }
                });
            }

            const activeCount = await dbManager.checkUserActiveCommunityGiveaways(interaction.user.id);
            if (activeCount >= MAX_ACTIVE_GIVEAWAYS) {
                return await interaction.editReply({
                    content: `❌ You already have ${activeCount} active giveaways!\nMaximum is ${MAX_ACTIVE_GIVEAWAYS}, please wait for them to end`,
                    allowedMentions: { parse: [] }
                });
            }

            const gameName = interaction.options.getString('game_name');
            const gameLink = interaction.options.getString('game_link');
            const durationInput = interaction.options.getString('duration');
            const platform = interaction.options.getString('platform');
            const imageUrl = interaction.options.getString('image');
            const winnersCount = interaction.options.getInteger('winners');
            const note = interaction.options.getString('note');
            const reqRole = interaction.options.getRole('reqrole');
            const messageReqType = interaction.options.getString('message_requirement_type');
            const messageReqAmount = interaction.options.getInteger('message_requirement_amount');
            const colorInput = interaction.options.getString('color');
            const embedColor = this.parseColor(colorInput);

            if ((messageReqType && !messageReqAmount) || (!messageReqType && messageReqAmount)) {
                return await interaction.editReply({
                    content: '❌ You must provide both requirement type and amount, or leave both empty',
                    allowedMentions: { parse: [] }
                });
            }

            const durationMs = parseDuration(durationInput);
            if (!durationMs) {
                return await interaction.editReply({
                    content: '❌ Invalid duration! Use formats like: `2d`, `1h 30m`, `3d 12h`, etc',
                    allowedMentions: { parse: [] }
                });
            }

            const endsAt = new Date(Date.now() + durationMs);
            const giveawayCode = this.generateGiveawayCode();

            // Store data for preview
            const previewId = Math.random().toString(36).slice(2, 10).toUpperCase();
            previewSessions.set(previewId, {
                targetChannel,
                gameName,
                gameLink,
                platform,
                imageUrl,
                winnersCount,
                note,
                reqRole,
                messageReqType,
                messageReqAmount,
                durationInput,
                endsAt,
                giveawayCode,
                host: interaction.user,
                interaction,
                embedColor
            });

            // Create preview embed
            const previewEmbed = this.createPreviewEmbed(
                gameName,
                gameLink,
                platform,
                endsAt,
                winnersCount,
                note,
                reqRole,
                messageReqType,
                messageReqAmount,
                imageUrl,
                interaction.user,
                giveawayCode,
                embedColor
            );

            const previewRows = [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`commgiveaway_preview_${previewId}_yes`)
                        .setLabel('Yes, Create Giveaway')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`commgiveaway_preview_${previewId}_no`)
                        .setLabel('No, Cancel')
                        .setStyle(ButtonStyle.Danger)
                )
            ];

            await interaction.editReply({
                content: '**Preview your giveaway below.**\nIf everything looks good, press `Yes` to create it. Otherwise, press `No` and adjust your options.',
                embeds: [previewEmbed],
                components: previewRows
            });

        } catch (error) {
            console.error('Error in giveaway command:', error);
            await interaction.editReply({
                content: '❌ Error creating giveaway, please try again',
                allowedMentions: { parse: [] }
            });
        }
    },

    createPreviewEmbed(gameName, gameLink, platform, endsAt, winnersCount, note, reqRole, messageReqType, messageReqAmount, imageUrl, host, giveawayCode, color) {
        const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(
                this.buildMainDescription(
                    gameName,
                    gameLink,
                    platform,
                    endsAt,
                    winnersCount,
                    note,
                    reqRole,
                    0,
                    messageReqType,
                    messageReqAmount
                )
            )
            .setFooter(this.buildFooter(host, giveawayCode))
            .setTitle('🔍 Preview Mode');

        if (imageUrl) embed.setImage(imageUrl);
        return embed;
    },

    buildMainDescription(gameName, gameLink, platform, endsAt, winnersCount, note, reqRole, participantsCount, messageReqType, messageReqAmount, ended = false, winnersList = null) {
        const safeGameLink = gameLink || 'https://store.steampowered.com';
        const lines = [];

        // Game name as clickable link
        if (gameLink) {
            lines.push(`## **[${gameName}](${safeGameLink})** | **${platform}**`);
        } else {
            lines.push(`## **${gameName}** | **${platform}**`);
        }
        lines.push('');

        if (!ended && endsAt) {
            lines.push(`Ends in: <t:${Math.floor(endsAt.getTime() / 1000)}:R>`);
        }

        lines.push(`Participants: **${participantsCount}**`);

        // Show winners list if ended and winnersList provided, otherwise show count
        if (ended && winnersList && winnersList.length > 0) {
            const winnersMentions = winnersList.map(id => `<@${id}>`).join(', ');
            lines.push(`Winners: ${winnersMentions}`);
        } else {
            lines.push(`Winners: **${winnersCount}**`);
        }

        lines.push('');

        if (reqRole) {
            lines.push(`Required Role: <@&${reqRole.id || reqRole}>`);
        }

        if (messageReqType && messageReqAmount) {
            const typeNames = {
                total: 'Total',
                monthly: 'Monthly',
                weekly: 'Weekly',
                daily: 'Daily'
            };
            lines.push(`• ${messageReqAmount} ${typeNames[messageReqType]} messages to qualify`);
        }

        lines.push('');

        if (note) lines.push(`Note: \`${note}\``);

        return lines.join('\n');
    },

    buildFooter(user, giveawayCode) {
        return {
            text: `${user.username || 'Host'} | ID: ${giveawayCode}`,
            iconURL: user.displayAvatarURL ? user.displayAvatarURL({ dynamic: true }) : user.hostAvatar || undefined
        };
    },

    async finalizeGiveawayCreation(sessionData) {
        const {
            targetChannel,
            gameName,
            gameLink,
            platform,
            imageUrl,
            winnersCount,
            note,
            reqRole,
            messageReqType,
            messageReqAmount,
            endsAt,
            giveawayCode,
            host,
            interaction,
            embedColor
        } = sessionData;

        const messageData = this.createGiveawayMessage(
            gameName,
            gameLink,
            platform,
            endsAt,
            winnersCount,
            note,
            reqRole,
            imageUrl,
            giveawayCode,
            host,
            0,
            messageReqType,
            messageReqAmount,
            embedColor
        );

        const message = await targetChannel.send(messageData);

        const result = await dbManager.createCommunityGiveaway({
            giveawayCode,
            gameName,
            gameLink,
            platform,
            imageUrl,
            winnersCount,
            note,
            reqRoleId: reqRole?.id,
            messageReqType,
            messageReqAmount,
            endsAt: endsAt.toISOString(),
            hostId: host.id,
            hostName: host.username,
            guildId: interaction.guildId,
            messageId: message.id,
            channelId: targetChannel.id,
            embedColor: embedColor.toString()
        });

        if (!result.success) {
            await message.delete().catch(() => {});
            return {
                success: false,
                embed: this.buildReplyEmbed(0xff0000, '❌ Failed to create giveaway, please try again')
            };
        }

        await this.sendToLogChannel(interaction, {
            gameName,
            gameLink,
            platform,
            winnersCount,
            note,
            reqRole,
            messageReqType,
            messageReqAmount,
            duration: sessionData.durationInput,
            giveawayCode,
            channel: targetChannel,
            imageUrl,
            endsAt,
            host,
            embedColor
        });

        this.setupJoinCollector(message, giveawayCode, endsAt, winnersCount, interaction.client, {
            gameName,
            gameLink,
            platform,
            note,
            reqRoleId: reqRole?.id,
            imageUrl,
            hostId: host.id,
            hostUsername: host.username,
            hostAvatar: host.displayAvatarURL({ dynamic: true }),
            messageReqType,
            messageReqAmount,
            embedColor
        });

        this.setupConfirmCollector(message, giveawayCode, interaction.client, this);

        const successEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Giveaway Created Successfully!')
            .setDescription(
                `**Code:** \`${giveawayCode}\`\n` +
                `**Channel:** ${targetChannel}\n` +
                `**Winners:** ${winnersCount}\n` +
                `**Game:** ${gameName}`
            );

        return { success: true, embed: successEmbed };
    },

    async handlePreview(interaction, previewId, decision) {
        const session = previewSessions.get(previewId);
        if (!session) {
            return interaction.update({
                content: '',
                embeds: [this.buildReplyEmbed(0xff0000, '❌ Preview expired. Please run the command again.')],
                components: []
            });
        }

        previewSessions.delete(previewId);

        if (decision === 'no') {
            return interaction.update({
                content: '',
                embeds: [this.buildReplyEmbed(0xffaa00, '❌ Giveaway creation cancelled.')],
                components: []
            });
        }

        // User confirmed, create the giveaway
        const result = await this.finalizeGiveawayCreation(session);
        return interaction.update({
            content: '',
            embeds: [result.embed],
            components: []
        });
    },

    async sendToLogChannel(interaction, giveawayData) {
        try {
            const logChannel = await interaction.guild.channels.fetch(GIVEAWAY_LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return;

            const {
                gameName, gameLink, platform, winnersCount, note, reqRole,
                messageReqType, messageReqAmount, giveawayCode, channel,
                imageUrl, endsAt, host, embedColor
            } = giveawayData;

            const embed = new EmbedBuilder()
                .setColor(embedColor || DEFAULT_COLOR)
                .setDescription(
                    this.buildMainDescription(
                        gameName,
                        gameLink,
                        platform,
                        endsAt,
                        winnersCount,
                        note,
                        reqRole,
                        0,
                        messageReqType,
                        messageReqAmount
                    ) + `\n\n**Channel:** ${channel}\n**Host:** ${host}`
                )
                .setFooter(this.buildFooter(host, giveawayCode));

            if (imageUrl) embed.setImage(imageUrl);

            await logChannel.send({
                embeds: [embed],
                allowedMentions: { parse: [] }
            });

        } catch (error) {
            console.error('Error sending to log channel:', error);
        }
    },

    createGiveawayMessage(gameName, gameLink, platform, endsAt, winnersCount, note, reqRole, imageUrl, giveawayCode, user, participantsCount, messageReqType, messageReqAmount, color = DEFAULT_COLOR) {
        const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(
                this.buildMainDescription(
                    gameName,
                    gameLink,
                    platform,
                    endsAt,
                    winnersCount,
                    note,
                    reqRole,
                    participantsCount,
                    messageReqType,
                    messageReqAmount
                )
            )
            .setFooter(this.buildFooter(user, giveawayCode));

        if (imageUrl) embed.setImage(imageUrl);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`commgiveaway_join_${giveawayCode}`)
                .setLabel(`Join (${participantsCount})`)
                .setStyle(ButtonStyle.Success)
                .setEmoji('🕊️')
        );

        return {
            embeds: [embed],
            components: [row],
            allowedMentions: { parse: [] }
        };
    },

    updateGiveawayMessage(gameName, gameLink, platform, endsAt, winnersCount, note, reqRoleId, imageUrl, giveawayCode, hostId, hostUsername, hostAvatar, participantsCount, messageReqType, messageReqAmount, color = DEFAULT_COLOR) {
        const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(
                this.buildMainDescription(
                    gameName,
                    gameLink,
                    platform,
                    endsAt,
                    winnersCount,
                    note,
                    reqRoleId ? { id: reqRoleId } : null,
                    participantsCount,
                    messageReqType,
                    messageReqAmount
                )
            )
            .setFooter({
                text: `${hostUsername || 'Host'} | ID: ${giveawayCode}`,
                iconURL: hostAvatar || undefined
            });

        if (imageUrl) embed.setImage(imageUrl);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`commgiveaway_join_${giveawayCode}`)
                .setLabel(`Join (${participantsCount})`)
                .setStyle(ButtonStyle.Success)
                .setEmoji('🕊️')
        );

        return {
            embeds: [embed],
            components: [row],
            allowedMentions: { parse: [] }
        };
    },

    createEndedGiveawayMessage(gameName, gameLink, platform, imageUrl, note, hostId, participantsCount, winnersCount, giveawayCode, messageReqType, messageReqAmount, confirmCount = 0, declineCount = 0, winners = [], coDeMembers = [], hostUsername = 'Host', hostAvatar = null, reqRoleId = null, color = DEFAULT_COLOR) {
        // استخدام buildMainDescription لإنشاء الإمبيد الرئيسي
        const mainEmbed = new EmbedBuilder()
            .setColor(color)
            .setDescription(
                this.buildMainDescription(
                    gameName, gameLink, platform, null, winnersCount, note,
                    reqRoleId ? { id: reqRoleId } : null,
                    participantsCount, messageReqType, messageReqAmount,
                    true, // ended
                    winners
                )
            )
            .setFooter({
                text: `${hostUsername} | ID: ${giveawayCode}`,
                iconURL: hostAvatar || undefined
            });

        if (imageUrl) mainEmbed.setImage(imageUrl);

        // إمبيد الفائزين للتأكيد
        const winnerStatusMap = new Map();
        for (const winner of winners) winnerStatusMap.set(winner, '⌛');
        for (const member of coDeMembers) {
            if (member && member.user_id && winners.includes(member.user_id)) {
                winnerStatusMap.set(member.user_id, member.status === 'confirm' ? '✅' : '❌');
            }
        }

        let winnersText = '';
        if (participantsCount === 0) {
            winnersText = `## 😕 No Participants\nUnfortunately, no one joined this giveaway`;
        } else if (winnersCount === 1) {
            const winner = winners[0] || 'Unknown';
            const status = winnerStatusMap.get(winner) || '⌛';
            winnersText = `## ${status} Congratulations To <@${winner}>\nYou won **${gameName}**, please contact with <@${hostId}>\n\n-# Press Confirm if the key worked, otherwise press Decline`;
        } else {
            const winnersWithStatus = winners.map(id => {
                const status = winnerStatusMap.get(id) || '⌛';
                return `<@${id}> ${status}`;
            }).join(' - ');
            winnersText = `## 🎉 Congratulations To Winners!\n${winnersWithStatus}\nYou won **${gameName}**, please contact with <@${hostId}>\n\n-# Press Confirm if the key worked, otherwise press Decline`;
        }

        const winnersEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setDescription(winnersText);

        const rows = [];
        if (participantsCount > 0) {
            rows.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`commgiveaway_confirm_${giveawayCode}`)
                        .setLabel(`Confirm (${confirmCount}/${winnersCount})`)
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`commgiveaway_decline_${giveawayCode}`)
                        .setLabel(`Decline (${declineCount}/${winnersCount})`)
                        .setStyle(ButtonStyle.Danger)
                )
            );
        }

        return {
            embeds: [mainEmbed, winnersEmbed],
            components: rows,
            allowedMentions: { parse: ['users'] }
        };
    },

    async buttonHandler(interaction) {
        const customId = interaction.customId;

        // Handle preview buttons
        if (customId.startsWith('commgiveaway_preview_')) {
            const parts = customId.split('_');
            const previewId = parts[2];
            const decision = parts[3];
            return this.handlePreview(interaction, previewId, decision);
        }

        // Handle leave buttons
        if (customId.startsWith('commgiveaway_leave_')) {
            const parts = customId.split('_');
            const giveawayCode = parts[2];
            const userId = parts[3];

            if (interaction.user.id !== userId) {
                return interaction.reply({
                    embeds: [this.buildReplyEmbed(0xff0000, '❌ This button is not for you.')],
                    ephemeral: true
                });
            }

            const giveaway = await dbManager.getActiveCommunityGiveawayByCode(giveawayCode);
            if (!giveaway) {
                return interaction.update({
                    embeds: [this.buildReplyEmbed(0xff0000, '❌ This giveaway no longer exists')],
                    components: []
                });
            }

            const result = await dbManager.removeCommunityGiveawayParticipant(giveawayCode, interaction.user.id);
            if (!result.success) {
                return interaction.update({
                    embeds: [this.buildReplyEmbed(0xff0000, '❌ You are not in this giveaway')],
                    components: []
                });
            }

            const endsAt = new Date(giveaway.ends_at);
            const guildMember = await interaction.guild.members.fetch(giveaway.host_id).catch(() => null);
            const embedColor = giveaway.embed_color ? parseInt(giveaway.embed_color) : DEFAULT_COLOR;

            const updatedMessage = this.updateGiveawayMessage(
                giveaway.game_name,
                giveaway.game_link,
                giveaway.platform,
                endsAt,
                giveaway.winners_count,
                giveaway.note,
                giveaway.req_role_id,
                giveaway.image_url,
                giveaway.giveaway_code,
                giveaway.host_id,
                guildMember?.user?.username || giveaway.host_name || 'Host',
                guildMember?.user?.displayAvatarURL({ dynamic: true }) || null,
                result.participantsCount,
                giveaway.message_req_type,
                giveaway.message_req_amount,
                embedColor
            );

            const channel = await interaction.client.channels.fetch(giveaway.channel_id).catch(() => null);
            const message = channel ? await channel.messages.fetch(giveaway.message_id).catch(() => null) : null;
            if (message) await message.edit(updatedMessage).catch(() => {});

            return interaction.update({
                embeds: [this.buildReplyEmbed(0x00ff00, '✅ You left the giveaway successfully!')],
                components: []
            });
        }
    },

    setupJoinCollector(message, giveawayCode, endsAt, winnersCount, client, giveawayData) {
        const filter = (i) => i.customId === `commgiveaway_join_${giveawayCode}`;
        const timeRemaining = endsAt.getTime() - Date.now();

        const collector = message.createMessageComponentCollector({
            filter,
            time: timeRemaining
        });

        collector.on('collect', async (i) => {
            try {
                if (!i.deferred && !i.replied) {
                    await i.deferReply({ ephemeral: true });
                }

                const giveaway = await dbManager.getActiveCommunityGiveawayByCode(giveawayCode);
                if (!giveaway) {
                    return await i.editReply({
                        embeds: [this.buildReplyEmbed(0xff0000, '❌ This giveaway no longer exists')],
                        components: []
                    });
                }

                const participants = giveaway.participants || [];
                const isParticipant = participants.includes(i.user.id);

                if (isParticipant) {
                    return await i.editReply({
                        embeds: [this.buildReplyEmbed(0xffa500, '⚠️ You are already in this giveaway. If you want to leave, use the button below.')],
                        components: [
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`commgiveaway_leave_${giveawayCode}_${i.user.id}`)
                                    .setLabel('Leave')
                                    .setStyle(ButtonStyle.Danger)
                            )
                        ],
                        allowedMentions: { parse: [] }
                    });
                }

                if (giveawayData.messageReqType && giveawayData.messageReqAmount) {
                    const userStats = await dbManager.getUserMessageStats(i.user.id, giveawayData.messageReqType);
                    const userValue =
                        giveawayData.messageReqType === 'daily' ? (userStats?.daily_sent || 0) :
                        giveawayData.messageReqType === 'weekly' ? (userStats?.weekly_sent || 0) :
                        giveawayData.messageReqType === 'monthly' ? (userStats?.monthly_sent || 0) :
                        (userStats?.total || 0);

                    if (userValue < giveawayData.messageReqAmount) {
                        const typeNames = {
                            total: 'Total',
                            monthly: 'Monthly',
                            weekly: 'Weekly',
                            daily: 'Daily'
                        };
                        return await i.editReply({
                            embeds: [
                                this.buildReplyEmbed(
                                    0xff0000,
                                    `❌ You need **${giveawayData.messageReqAmount}+ ${typeNames[giveawayData.messageReqType]} Messages** to join!\nYour ${typeNames[giveawayData.messageReqType]}: **${userValue}**`
                                )
                            ],
                            allowedMentions: { parse: [] }
                        });
                    }
                }

                if (giveaway.req_role_id && !i.member.roles.cache.has(giveaway.req_role_id)) {
                    return await i.editReply({
                        embeds: [this.buildReplyEmbed(0xff0000, `❌ You need <@&${giveaway.req_role_id}> to join this giveaway`)],
                        allowedMentions: { parse: [] }
                    });
                }

                const result = await dbManager.addCommunityGiveawayParticipant(giveawayCode, i.user.id, i.user.username);
                if (result.success) {
                    const embedColor = giveaway.embed_color ? parseInt(giveaway.embed_color) : DEFAULT_COLOR;
                    const updatedMessage = this.updateGiveawayMessage(
                        giveawayData.gameName,
                        giveawayData.gameLink,
                        giveawayData.platform,
                        endsAt,
                        winnersCount,
                        giveawayData.note,
                        giveawayData.reqRoleId,
                        giveawayData.imageUrl,
                        giveawayCode,
                        giveawayData.hostId,
                        giveawayData.hostUsername,
                        giveawayData.hostAvatar,
                        result.participantsCount,
                        giveawayData.messageReqType,
                        giveawayData.messageReqAmount,
                        embedColor
                    );
                    await message.edit(updatedMessage);
                    await i.editReply({
                        embeds: [this.buildReplyEmbed(0x00ff00, '✅ You joined the giveaway, good luck!')],
                        allowedMentions: { parse: [] },
                        components: [
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`commgiveaway_leave_${giveawayCode}_${i.user.id}`)
                                    .setLabel('Leave')
                                    .setStyle(ButtonStyle.Danger)
                            )
                        ]
                    });
                }
            } catch (error) {
                console.error('Error in join collector:', error);
            }
        });

        collector.on('end', async () => {
            await this.handleGiveawayEnd(message, giveawayCode, client, giveawayData);
        });
    },

    async handleGiveawayEnd(message, giveawayCode, client, giveawayData) {
        try {
            const giveaway = await dbManager.getActiveCommunityGiveawayByCode(giveawayCode);
            if (!giveaway) return;

            const confirmationStatus = await dbManager.getCommunityGiveawayConfirmationStatus(giveawayCode);
            const coDeMembers = confirmationStatus?.coDeMembers || [];
            const embedColor = giveaway.embed_color ? parseInt(giveaway.embed_color) : DEFAULT_COLOR;

            const result = await dbManager.endCommunityGiveaway(giveawayCode);
            if (!result.success) return;

            if (result.noParticipants) {
                const endedMessage = this.createEndedGiveawayMessage(
                    giveawayData.gameName,
                    giveawayData.gameLink,
                    giveawayData.platform,
                    giveawayData.imageUrl,
                    giveawayData.note,
                    giveawayData.hostId,
                    0,
                    giveaway.winners_count,
                    giveawayCode,
                    giveawayData.messageReqType,
                    giveawayData.messageReqAmount,
                    0,
                    0,
                    [],
                    coDeMembers,
                    giveawayData.hostUsername,
                    giveawayData.hostAvatar,
                    giveaway.req_role_id,
                    embedColor
                );
                await message.edit(endedMessage);
                return;
            }

            const actualWinnersCount = result.winners ? result.winners.length : 0;
            const winners = result.winners || [];

            for (const winnerId of winners) {
                try {
                    const member = await message.guild.members.fetch(winnerId);
                    await member.roles.add(WINNER_ROLE_ID);
                } catch (roleError) {
                    console.error(`Error giving winner role to ${winnerId}:`, roleError);
                }
            }

            const endedMessage = this.createEndedGiveawayMessage(
                giveawayData.gameName,
                giveawayData.gameLink,
                giveawayData.platform,
                giveawayData.imageUrl,
                giveawayData.note,
                giveawayData.hostId,
                result.participantsCount || 0,
                actualWinnersCount,
                giveawayCode,
                giveawayData.messageReqType,
                giveawayData.messageReqAmount,
                0,
                0,
                winners,
                coDeMembers,
                giveawayData.hostUsername,
                giveawayData.hostAvatar,
                giveaway.req_role_id,
                embedColor
            );
            await message.edit(endedMessage);

        } catch (error) {
            console.error('Error handling giveaway end:', error);
        }
    },

    setupConfirmCollector(message, giveawayCode, client, commandContext) {
        const filter = (i) => {
            return i.customId === `commgiveaway_confirm_${giveawayCode}` ||
                   i.customId === `commgiveaway_decline_${giveawayCode}`;
        };

        const collector = message.createMessageComponentCollector({
            filter,
            time: null
        });

        collector.on('collect', async (i) => {
            try {
                await i.deferReply({ ephemeral: true });

                const action = i.customId.includes('confirm') ? 'confirm' : 'decline';
                const result = await dbManager.updateCommunityGiveawayWinnerStatus(giveawayCode, i.user.id, action);

                if (!result.success) {
                    if (result.code === 'NOT_WINNER') {
                        await i.editReply({
                            embeds: [this.buildReplyEmbed(0xff0000, '❌ This button is for winners only!')]
                        });
                    } else if (result.code === 'ALREADY_VOTED') {
                        await i.editReply({
                            embeds: [this.buildReplyEmbed(0xff0000, '❌ You have already voted!')]
                        });
                    } else {
                        await i.editReply({
                            embeds: [this.buildReplyEmbed(0xff0000, `❌ ${result.error}`)]
                        });
                    }
                    return;
                }

                const updatedConfirmation = await dbManager.getCommunityGiveawayConfirmationStatus(giveawayCode);
                const updatedCoDeMembers = updatedConfirmation?.coDeMembers || [];
                const updatedGiveaway = await dbManager.getCommunityGiveawayByCode(giveawayCode);
                const updatedWinners = updatedGiveaway?.winners || [];
                const embedColor = updatedGiveaway.embed_color ? parseInt(updatedGiveaway.embed_color) : DEFAULT_COLOR;

                const guildMember = await message.guild.members.fetch(updatedGiveaway.host_id).catch(() => null);
                const hostUsername = guildMember?.user?.username || updatedGiveaway.host_name || 'Host';
                const hostAvatar = guildMember?.user?.displayAvatarURL({ dynamic: true }) || null;

                const updatedMessage = commandContext.createEndedGiveawayMessage(
                    updatedGiveaway.game_name,
                    updatedGiveaway.game_link,
                    updatedGiveaway.platform,
                    updatedGiveaway.image_url,
                    updatedGiveaway.note,
                    updatedGiveaway.host_id,
                    updatedGiveaway.participants?.length || 0,
                    updatedWinners.length,
                    giveawayCode,
                    updatedGiveaway.message_req_type,
                    updatedGiveaway.message_req_amount,
                    updatedConfirmation.confirmCount || 0,
                    updatedConfirmation.declineCount || 0,
                    updatedWinners,
                    updatedCoDeMembers,
                    hostUsername,
                    hostAvatar,
                    updatedGiveaway.req_role_id,
                    embedColor
                );

                if (result.data.allResponded) {
                    updatedMessage.components = [];
                }

                await message.edit(updatedMessage);

                await i.editReply({
                    embeds: [this.buildReplyEmbed(0x00ff00, `✅ You have ${action === 'confirm' ? 'confirmed' : 'declined'} your prize!`)]
                });

                if (result.data.allResponded) {
                    await this.handleAllResponded(message, giveawayCode, result.data, updatedWinners.length);
                }

            } catch (error) {
                console.error('Error in confirm collector:', error);
                await i.editReply({
                    embeds: [this.buildReplyEmbed(0xff0000, '❌ An error occurred')]
                }).catch(() => {});
            }
        });
    },

    async handleAllResponded(message, giveawayCode, data, actualWinnersCount) {
        try {
            const giveaway = await dbManager.getCommunityGiveawayByCode(giveawayCode);
            if (!giveaway) return;

            const guildMember = await message.guild.members.fetch(giveaway.host_id).catch(() => null);
            const hostUsername = guildMember?.user?.username || giveaway.host_name || 'Host';
            const hostAvatar = guildMember?.user?.displayAvatarURL({ dynamic: true }) || null;
            const embedColor = giveaway.embed_color ? parseInt(giveaway.embed_color) : DEFAULT_COLOR;

            const updatedConfirmation = await dbManager.getCommunityGiveawayConfirmationStatus(giveawayCode);
            const updatedCoDeMembers = updatedConfirmation?.coDeMembers || [];
            const updatedWinners = giveaway.winners || [];

            const statusMap = new Map();
            for (const winnerId of updatedWinners) {
                statusMap.set(winnerId, '⌛');
            }

            for (const entry of updatedCoDeMembers) {
                if (!entry?.user_id) continue;
                statusMap.set(entry.user_id, entry.status === 'confirm' ? '✅' : '❌');
            }

            const winnersLines = updatedWinners.map(winnerId => {
                const status = statusMap.get(winnerId) || '⌛';
                return `${status} <@${winnerId}>`;
            }).join('\n');

            let resultText = '';
            if (data.allConfirmed) {
                await dbManager.rewardCommunityHost(giveawayCode, giveaway.host_id);
                resultText =
                    `## ✅ All ${actualWinnersCount} Winners Confirmed!\n` +
                    `${winnersLines}\n\n` +
                    `<@${giveaway.host_id}> received 250 XP and 150 Coins!`;
            } else {
                resultText =
                    `## ❌ Not All Winners Confirmed!\n` +
                    `${winnersLines}\n\n` +
                    `One or more winners declined the prize.`;
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(data.allConfirmed ? 0x00ff00 : 0xff0000)
                .setDescription(resultText);

            const mainEndedMessage = this.createEndedGiveawayMessage(
                giveaway.game_name,
                giveaway.game_link,
                giveaway.platform,
                giveaway.image_url,
                giveaway.note,
                giveaway.host_id,
                giveaway.participants?.length || 0,
                updatedWinners.length,
                giveaway.giveaway_code,
                giveaway.message_req_type,
                giveaway.message_req_amount,
                updatedConfirmation?.confirmCount || 0,
                updatedConfirmation?.declineCount || 0,
                updatedWinners,
                updatedCoDeMembers,
                hostUsername,
                hostAvatar,
                giveaway.req_role_id,
                embedColor
            );

            await message.edit({
                embeds: [mainEndedMessage.embeds[0], resultEmbed],
                components: [],
                allowedMentions: { parse: ['users'] }
            });

        } catch (error) {
            console.error('Error handling all responded:', error);
        }
    },

    generateGiveawayCode() {
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += Math.floor(Math.random() * 10);
        }
        return `CGS-${code}`;
    }
};