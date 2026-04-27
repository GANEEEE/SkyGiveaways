const { SlashCommandBuilder } = require('discord.js');
const dbManager = require('../Data/database');

const WINNER_ROLE_ID = '1395730680926965781';
const DEFAULT_COLOR = 0x4bff4b;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('communitygiveawaysmanage')
        .setDescription('Manage community giveaways')
        .addStringOption(option =>
            option.setName('end')
                .setDescription('End giveaway by code or message ID')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reroll')
                .setDescription('Reroll: "<code/messageId> [count] [include_old yes/no]"')
                .setRequired(false)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const moderateRoleData = await dbManager.getBotSetting('moderateRole');
            if (!moderateRoleData) {
                return interaction.editReply({
                    content: '❌ Moderate Role Not Set\nModeration role not assigned, Please configure the role to enable moderation features by `/setrole`',
                    allowedMentions: { parse: [] }
                });
            }

            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);

            if (!member.roles.cache.has(roleInfo.id)) {
                return interaction.editReply({
                    content: `⛔ Permission Denied\nThis command is available only for <@&${roleInfo.id}>`,
                    allowedMentions: { parse: [] }
                });
            }

            const endInput = interaction.options.getString('end');
            const rerollInput = interaction.options.getString('reroll');

            if (!endInput && !rerollInput) {
                return interaction.editReply({
                    content: '❌ Use either `end` or `reroll`',
                    allowedMentions: { parse: [] }
                });
            }

            if (endInput && rerollInput) {
                return interaction.editReply({
                    content: '❌ Use only one option: `end` or `reroll`',
                    allowedMentions: { parse: [] }
                });
            }

            if (endInput) {
                return await this.handleEnd(interaction, endInput);
            }

            if (rerollInput) {
                const parts = rerollInput.trim().split(/\s+/);
                const giveawayId = parts[0];
                const count = parts[1] ? parseInt(parts[1], 10) : 1;
                const includeOld = parts[2] ? ['yes', 'y', 'true'].includes(parts[2].toLowerCase()) : false;

                if (!giveawayId || isNaN(count) || count < 1 || count > 25) {
                    return interaction.editReply({
                        content: '❌ Invalid reroll format.\nUse: `<code/messageId> [count] [yes/no]`',
                        allowedMentions: { parse: [] }
                    });
                }

                return await this.handleReroll(interaction, giveawayId, count, includeOld);
            }

        } catch (error) {
            console.error('Error in communitygiveawaysmanage command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while executing the command',
                allowedMentions: { parse: [] }
            }).catch(() => {});
        }
    },

    async findGiveaway(giveawayId) {
        let giveaway = await dbManager.getCommunityGiveawayByCode(giveawayId);
        if (!giveaway) {
            giveaway = await dbManager.getCommunityGiveawayByMessage(giveawayId);
        }
        return giveaway;
    },

    async fetchGiveawayMessage(interaction, giveaway) {
        const channel = await interaction.client.channels.fetch(giveaway.channel_id);
        return await channel.messages.fetch(giveaway.message_id);
    },

    async getHostDisplayData(guild, giveaway) {
        const guildMember = await guild.members.fetch(giveaway.host_id).catch(() => null);

        return {
            hostUsername: guildMember?.user?.username || giveaway.host_name || 'Host',
            hostAvatar: guildMember?.user?.displayAvatarURL({ dynamic: true }) || null
        };
    },

    async handleEnd(interaction, giveawayId) {
        const giveaway = await this.findGiveaway(giveawayId);

        if (!giveaway) {
            return interaction.editReply({
                content: '❌ Giveaway not found!\nPlease provide a valid giveaway code or message ID',
                allowedMentions: { parse: [] }
            });
        }

        if (giveaway.is_ended) {
            return interaction.editReply({
                content: '❌ This giveaway has already ended!',
                allowedMentions: { parse: [] }
            });
        }

        let message;
        try {
            message = await this.fetchGiveawayMessage(interaction, giveaway);
        } catch (error) {
            console.error('Error fetching giveaway message:', error);
            return interaction.editReply({
                content: '❌ Could not find the giveaway message!\nIt may have been deleted',
                allowedMentions: { parse: [] }
            });
        }

        const giveawayCommand = interaction.client.commands.get('communitygiveaway');
        const { hostUsername, hostAvatar } = await this.getHostDisplayData(interaction.guild, giveaway);

        const giveawayData = {
            gameName: giveaway.game_name,
            gameLink: giveaway.game_link,
            platform: giveaway.platform,
            imageUrl: giveaway.image_url,
            note: giveaway.note,
            hostId: giveaway.host_id,
            hostUsername,
            hostAvatar,
            reqRoleId: giveaway.req_role_id,
            messageReqType: giveaway.message_req_type,
            messageReqAmount: giveaway.message_req_amount
        };

        await giveawayCommand.handleGiveawayEnd(message, giveaway.giveaway_code, interaction.client, giveawayData);

        return interaction.editReply({
            content: `✅ Giveaway ended successfully!\nCode: \`${giveaway.giveaway_code}\``,
            allowedMentions: { parse: [] }
        });
    },

    async handleReroll(interaction, giveawayId, count, includeOld) {
        const giveaway = await this.findGiveaway(giveawayId);

        if (!giveaway) {
            return interaction.editReply({
                content: '❌ Giveaway not found!\nPlease provide a valid giveaway code or message ID',
                allowedMentions: { parse: [] }
            });
        }

        if (!giveaway.is_ended) {
            return interaction.editReply({
                content: '❌ Giveaway is still active!\nYou can only reroll ended giveaways',
                allowedMentions: { parse: [] }
            });
        }

        const participants = giveaway.participants || [];
        if (!participants.length) {
            return interaction.editReply({
                content: '❌ No participants!\nThis giveaway has no participants to reroll',
                allowedMentions: { parse: [] }
            });
        }

        let message;
        try {
            message = await this.fetchGiveawayMessage(interaction, giveaway);
        } catch (error) {
            console.error('Error fetching giveaway message:', error);
            return interaction.editReply({
                content: '❌ Could not find the giveaway message!\nIt may have been deleted',
                allowedMentions: { parse: [] }
            });
        }

        return await this.executeReroll(interaction, giveaway, participants, count, includeOld, message);
    },

    async executeReroll(interaction, giveaway, participants, count, includeOld, message) {
        try {
            const confirmationStatus = await dbManager.getCommunityGiveawayConfirmationStatus(giveaway.giveaway_code);
            const confirmedMembers = confirmationStatus?.coDeMembers || [];
            const currentWinners = giveaway.winners || [];

            const protectedMembers = confirmedMembers.map(m => m.user_id);
            const protectedWinners = currentWinners.filter(id => protectedMembers.includes(id));
            const changeableWinners = currentWinners.filter(id => !protectedMembers.includes(id));

            let eligibleParticipants = participants.filter(id => !protectedMembers.includes(id));

            if (!includeOld) {
                eligibleParticipants = eligibleParticipants.filter(id => !changeableWinners.includes(id));
            }

            if (!eligibleParticipants.length) {
                return interaction.editReply({
                    content: '⚠️ No eligible participants!\nAll participants have already confirmed or declined their prizes',
                    allowedMentions: { parse: [] }
                });
            }

            const rerollCount = Math.min(changeableWinners.length, count);

            if (rerollCount === 0) {
                return interaction.editReply({
                    content: '⚠️ No winners to reroll!\nAll winners have already confirmed or declined',
                    allowedMentions: { parse: [] }
                });
            }

            const shuffled = [...eligibleParticipants].sort(() => 0.5 - Math.random());
            const newWinners = shuffled.slice(0, rerollCount);

            const finalWinners = [...protectedWinners];
            for (let i = 0; i < rerollCount; i++) {
                finalWinners.push(newWinners[i]);
            }

            if (includeOld) {
                const unchangedOldWinners = changeableWinners.filter(w => !newWinners.includes(w));
                for (const winner of unchangedOldWinners) {
                    finalWinners.push(winner);
                }
            }

            await dbManager.updateCommunityGiveawayMultipleWinners(giveaway.giveaway_code, finalWinners);
            await this.resetConfirmationForNewWinners(giveaway.giveaway_code, newWinners);

            for (const winnerId of newWinners) {
                try {
                    const member = await message.guild.members.fetch(winnerId);
                    await member.roles.add(WINNER_ROLE_ID);
                } catch (roleError) {
                    console.error(`Error giving winner role to ${winnerId}:`, roleError);
                }
            }

            const removedWinners = changeableWinners.filter(w => !newWinners.includes(w) && !includeOld);
            for (const winnerId of removedWinners) {
                try {
                    const member = await message.guild.members.fetch(winnerId);
                    await member.roles.remove(WINNER_ROLE_ID);
                } catch (roleError) {
                    console.error(`Error removing winner role from ${winnerId}:`, roleError);
                }
            }

            await this.updateOriginalMessage(message, giveaway, finalWinners);

            const guildMember = await message.guild.members.fetch(giveaway.host_id).catch(() => null);
            const hostUsername = guildMember?.user?.username || giveaway.host_name || 'Host';
            const hostAvatar = guildMember?.user?.displayAvatarURL({ dynamic: true }) || null;
            const embedColor = giveaway.embed_color ? parseInt(giveaway.embed_color, 10) : DEFAULT_COLOR;

            const giveawayCommand = message.client.commands.get('communitygiveaway');
            const announcementMessage = giveawayCommand.buildWinnersAnnouncementEmbed(
                giveaway.game_name,
                giveaway.host_id,
                giveaway.participants?.length || 0,
                newWinners,
                hostUsername,
                hostAvatar,
                giveaway.giveaway_code,
                embedColor
            );

            await message.channel.send(announcementMessage);

            return interaction.editReply({
                content: `✅ Reroll Successful!\nReplaced ${rerollCount} winner(s) with new winners\nProtected ${protectedWinners.length} winner(s) who already confirmed`,
                allowedMentions: { parse: [] }
            });

        } catch (error) {
            console.error('Error executing reroll:', error);
            throw error;
        }
    },

    async resetConfirmationForNewWinners(giveawayCode, newWinners) {
        try {
            const confirmationStatus = await dbManager.getCommunityGiveawayConfirmationStatus(giveawayCode);
            let coDeMembers = confirmationStatus?.coDeMembers || [];

            coDeMembers = coDeMembers.filter(m => !newWinners.includes(m.user_id));

            const confirmCount = coDeMembers.filter(m => m.status === 'confirm').length;
            const declineCount = coDeMembers.filter(m => m.status === 'decline').length;

            const client = await dbManager.pool.connect();
            try {
                await client.query(
                    `UPDATE community_giveaways 
                     SET co_de_members = $1::jsonb,
                         confirm_count = $2,
                         decline_count = $3,
                         all_responded = $4,
                         all_confirmed = $5,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE giveaway_code = $6`,
                    [JSON.stringify(coDeMembers), confirmCount, declineCount, false, false, giveawayCode]
                );
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error resetting confirmation for new winners:', error);
        }
    },

    async updateOriginalMessage(message, giveaway, finalWinners) {
        try {
            const giveawayCommand = message.client.commands.get('communitygiveaway');
            const guildMember = await message.guild.members.fetch(giveaway.host_id).catch(() => null);
            const hostUsername = guildMember?.user?.username || giveaway.host_name || 'Host';
            const hostAvatar = guildMember?.user?.displayAvatarURL({ dynamic: true }) || null;
            const embedColor = giveaway.embed_color ? parseInt(giveaway.embed_color, 10) : DEFAULT_COLOR;

            const endedMessage = giveawayCommand.createEndedGiveawayMessage(
                giveaway.game_name,
                giveaway.game_link,
                giveaway.platform,
                giveaway.image_url,
                giveaway.note,
                giveaway.host_id,
                giveaway.participants?.length || 0,
                finalWinners.length,
                giveaway.giveaway_code,
                giveaway.message_req_type,
                giveaway.message_req_amount,
                finalWinners,
                hostUsername,
                hostAvatar,
                giveaway.req_role_id,
                embedColor
            );

            await message.edit(endedMessage);
        } catch (error) {
            console.error('Error updating original message:', error);
        }
    }
};
