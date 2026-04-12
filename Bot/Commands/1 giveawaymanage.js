const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../Data/database');
const giveawayCreateCommand = require('./1 giveawaycreate');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveawaymanage')
        .setDescription('Manage giveaways')
        .addStringOption(opt =>
            opt
                .setName('reroll')
                .setDescription('Reroll: "<code> [target] [y/n]"')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt
                .setName('end')
                .setDescription('End giveaway early (ID)')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt
                .setName('cancel')
                .setDescription('Cancel/delete giveaway by code or message ID')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt
                .setName('giveaways_list')
                .setDescription('List giveaways')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .addStringOption(opt =>
            opt
                .setName('remove_participants')
                .setDescription('Remove participants: "<code> @user1 @user2 ..."')
                .setRequired(false)
        ),

    buildEmbed(color, title, description) {
        return new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description);
    },

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'giveaways_list') return;

        const choices = [
            { name: 'Active Giveaways', value: 'active' },
            { name: 'Scheduled Giveaways', value: 'scheduled' }
        ];

        const query = (focused.value || '').toLowerCase();
        const filtered = choices.filter(choice =>
            choice.name.toLowerCase().includes(query) ||
            choice.value.toLowerCase().includes(query)
        );

        await interaction.respond(filtered.slice(0, 25));
    },

    parseRerollInput(input) {
        const trimmed = input.trim();
        const firstSpace = trimmed.indexOf(' ');

        if (firstSpace === -1) {
            return { code: trimmed, target: null, exclude: false };
        }

        const code = trimmed.slice(0, firstSpace).trim();
        let rest = trimmed.slice(firstSpace + 1).trim();
        let exclude = false;

        const parts = rest.split(/\s+/);
        const last = parts[parts.length - 1]?.toLowerCase();

        if (last === 'y' || last === 'n') {
            exclude = last === 'y';
            rest = rest.slice(0, rest.lastIndexOf(parts[parts.length - 1])).trim();
        }

        return { code, target: rest || null, exclude };
    },

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const moderateRoleData = await dbManager.getBotSetting('moderateRole');
            if (!moderateRoleData) {
                return interaction.editReply({
                    embeds: [this.buildEmbed(0xff0000, 'Missing Setup', '❌ Set `/setrole` first')]
                });
            }

            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);

            if (!member.roles.cache.has(roleInfo.id)) {
                return interaction.editReply({
                    embeds: [this.buildEmbed(0xff0000, 'Permission Denied', `⛔ Only <@&${roleInfo.id}> can use this`)]
                });
            }

            const rerollInput = interaction.options.getString('reroll');
            const endId = interaction.options.getString('end');
            const cancelId = interaction.options.getString('cancel');
            const listType = interaction.options.getString('giveaways_list');
            const removeInput = interaction.options.getString('remove_participants');

            const usedCount = [rerollInput, endId, cancelId, listType, removeInput].filter(Boolean).length;

            if (usedCount === 0) {
                return interaction.editReply({
                    embeds: [this.buildEmbed(0xffa500, 'No Action Chosen', '❌ Use one of: `reroll`, `end`, `cancel`, `giveaways_list`, `remove_participants`')]
                });
            }

            if (usedCount > 1) {
                return interaction.editReply({
                    embeds: [this.buildEmbed(0xffa500, 'Too Many Options', '❌ Use only one option at a time')]
                });
            }

            if (rerollInput) {
                const { code, target, exclude } = this.parseRerollInput(rerollInput);
                return await giveawayCreateCommand.handleReroll(interaction, code, null, exclude, target);
            }

            if (endId) {
                return await giveawayCreateCommand.handleEnd(interaction, endId);
            }

            if (cancelId) {
                return await this.handleCancel(interaction, cancelId);
            }

            if (listType) {
                return await this.handleList(interaction, listType);
            }

            if (removeInput) {
                const parts = removeInput.trim().split(/\s+/);
                if (parts.length < 2) {
                    return interaction.editReply({
                        embeds: [this.buildEmbed(0xff0000, 'Invalid Format', '❌ Usage: `giveawayCode @user1 @user2 ...`')]
                    });
                }
                const code = parts[0];
                const mentions = parts.slice(1).join(' ');
                // استخراج معرفات المستخدمين من المنشنات
                const mentionRegex = /<@!?(\d+)>/g;
                const userIds = [];
                let match;
                while ((match = mentionRegex.exec(mentions)) !== null) {
                    userIds.push(match[1]);
                }
                if (userIds.length === 0) {
                    return interaction.editReply({
                        embeds: [this.buildEmbed(0xff0000, 'Invalid Input', '❌ Please mention at least one user (e.g. @user1 @user2)')]
                    });
                }
                return await this.handleRemoveParticipants(interaction, code, userIds);
            }
        } catch (error) {
            console.error('❌ giveawaymanage command error:', error);
            return interaction.editReply({
                embeds: [this.buildEmbed(0xff0000, 'Error', '❌ Error processing giveaway command')]
            }).catch(() => {});
        }
    },

    async findGiveaway(identifier) {
        let giveaway = await dbManager.getGiveawayByCode(identifier);
        if (!giveaway) {
            giveaway = await dbManager.getGiveawayByMessageId(identifier);
        }
        return giveaway;
    },

    async handleCancel(interaction, identifier) {
        const giveaway = await this.findGiveaway(identifier);
        if (!giveaway) {
            return interaction.editReply({
                embeds: [this.buildEmbed(0xff0000, 'Not Found', '❌ Giveaway not found')]
            });
        }

        if (giveaway.message_id && giveaway.channel_id) {
            try {
                const channel = interaction.client.channels.cache.get(giveaway.channel_id)
                    || await interaction.client.channels.fetch(giveaway.channel_id).catch(() => null);
                if (channel) {
                    const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
                    if (message) await message.delete().catch(() => {});
                }
            } catch (error) {
                console.warn('⚠️ Could not delete giveaway message:', error.message);
            }
        }

        const result = await dbManager.deleteGiveaway(giveaway.giveaway_code);
        if (!result.success) {
            return interaction.editReply({
                embeds: [this.buildEmbed(0xff0000, 'Cancel Failed', '❌ Failed to cancel giveaway')]
            });
        }

        return interaction.editReply({
            embeds: [this.buildEmbed(0x00ff00, 'Giveaway Cancelled', `✅ Giveaway cancelled and deleted.\n\n**Code:** \`${giveaway.giveaway_code}\`\n**Previous Status:** \`${giveaway.status}\``)]
        });
    },

    async handleList(interaction, listType) {
        const allGiveaways = await dbManager.getAllGiveaways(200, 0);
        const filtered = allGiveaways.filter(gw => gw.status === listType);

        if (!filtered.length) {
            return interaction.editReply({
                embeds: [this.buildEmbed(0xffa500, 'No Giveaways Found', listType === 'active' ? '❌ No active giveaways found.' : '❌ No scheduled giveaways found.')]
            });
        }

        const lines = filtered.slice(0, 20).map(gw => {
            const endTs = gw.end_time ? Math.floor(new Date(gw.end_time).getTime() / 1000) : null;
            const startTs = gw.schedule ? Math.floor(new Date(gw.schedule).getTime() / 1000) : null;
            const title = gw.title || gw.template || 'Giveaway';
            const host = gw.host_name || 'Unknown Host';

            if (listType === 'scheduled') {
                return `• \`${gw.giveaway_code}\` | **${title}**\nHost: **${host}**\nStarts: <t:${startTs}:R>\nWinners: **${gw.winners_count}**`;
            }
            return `• \`${gw.giveaway_code}\` | **${title}**\nHost: **${host}**\nEnds: <t:${endTs}:R>\nWinners: **${gw.winners_count}**`;
        });

        const title = listType === 'active' ? 'Active Giveaways' : 'Scheduled Giveaways';
        return interaction.editReply({
            embeds: [this.buildEmbed(0x0073ff, title, lines.join('\n\n'))]
        });
    },

    // ========== NEW: إزالة المشاركين ==========
    async handleRemoveParticipants(interaction, giveawayCode, userIds) {
        const giveaway = await dbManager.getGiveawayByCode(giveawayCode);
        if (!giveaway) {
            return interaction.editReply({
                embeds: [this.buildEmbed(0xff0000, 'Not Found', '❌ Giveaway not found')]
            });
        }

        if (giveaway.status !== 'active') {
            return interaction.editReply({
                embeds: [this.buildEmbed(0xffa500, 'Invalid Status', `❌ Giveaway is ${giveaway.status}, not active.`)]
            });
        }

        const results = [];
        for (const userId of userIds) {
            const result = await dbManager.removeParticipant(giveaway.giveaway_code, userId);
            if (result.success) {
                results.push(`✅ <@${userId}> removed`);
            } else {
                results.push(`❌ <@${userId}> not a participant or error: ${result.error || 'unknown'}`);
            }
        }

        // تحديث رسالة الجيفاواي لتعكس الأعداد الجديدة
        try {
            const config = giveawayCreateCommand.buildConfigFromGiveaway(giveaway);
            const endsAt = new Date(giveaway.end_time);
            const host = await giveawayCreateCommand.resolveHostUser(interaction.client, giveaway.host_id, giveaway.host_name);
            const updatedEntries = (await dbManager.getGiveawayByCode(giveaway.giveaway_code)).entries || {};
            const updatedMessage = giveawayCreateCommand.updateGiveawayMessage(config, endsAt, giveaway.giveaway_code, host, updatedEntries);

            const channel = interaction.client.channels.cache.get(giveaway.channel_id) || await interaction.client.channels.fetch(giveaway.channel_id);
            if (channel && giveaway.message_id) {
                const msg = await channel.messages.fetch(giveaway.message_id).catch(() => null);
                if (msg) await msg.edit(updatedMessage);
            }
        } catch (err) {
            console.warn('⚠️ Could not update giveaway message after removal:', err.message);
        }

        return interaction.editReply({
            embeds: [this.buildEmbed(0x00ff00, 'Participants Removed', `**Giveaway:** \`${giveaway.giveaway_code}\`\n\n${results.join('\n')}`)]
        });
    }
};