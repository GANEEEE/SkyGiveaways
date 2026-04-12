const {
    SlashCommandBuilder,
    ContainerBuilder,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} = require('discord.js');

const dbManager = require('../Data/database');
const { ActivityRewardsManager } = require('../LevelSystem/activitysystem');

const manager = new ActivityRewardsManager(dbManager);

// ===== CONFIG =====
const FORUM_CHANNELS = {
    sky_vanguards: '1485738947941503178',
    aether_raiders: '1485358515999739904'
};

const GUILD_ROLES = {
    sky_vanguards: '1485739224589275137',
    aether_raiders: '1485739226292289729'
};

const PARTNER_ROLE_ID = '1485739181266178058';
const PARTNER_REQUESTS_CHANNEL_ID = '1486765947636158625';

const GUILD_TAG = {
    sky_vanguards: '[⚔️ SV]',
    aether_raiders: '[🌌 AR]'
};

// ===== Helper: Create Forum Post =====
async function createForumPost(interaction, userId, username, guildChoice) {
    try {
        const forumChannelId = FORUM_CHANNELS[guildChoice];
        const forumChannel = await interaction.guild.channels.fetch(forumChannelId);
        if (!forumChannel) return null;

        const guildLabel = guildChoice === 'sky_vanguards' ? '⚔️ Sky Vanguards' : '🌌 Aether Raiders';
        const color = guildChoice === 'sky_vanguards' ? 0x5865F2 : 0x9B59B6;

        const postContainer = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents(t => t.setContent(`## ${username} is now part of Project Horizon`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addSectionComponents(s =>
                s.addTextDisplayComponents(t => t.setContent(
                    `### 👤 Player: **<@${userId}>**\n` +
                    `### 🤝 Partner: **Solo Explorer**\n` +
                    `### 💠 Tokens: **0**`
                ))
                .setThumbnailAccessory(thumb =>
                    thumb.setDescription(username).setURL(interaction.user.displayAvatarURL({ extension: 'png', size: 256 }))
                )
            )
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(t => t.setContent(`-# Guild: **${guildLabel}** | Project Horizon`));

        const thread = await forumChannel.threads.create({
            name: `${GUILD_TAG[guildChoice]} ${username}`,
            message: {
                components: [postContainer],
                flags: MessageFlags.IsComponentsV2
            }
        });

        await manager.setForumPostId(userId, thread.id);
        return thread;
    } catch (err) {
        console.error('Could not create forum post:', err.message);
        return null;
    }
}

// ===== Helper: Check if user has pending partner request =====
async function hasPendingRequest(userId) {
    try {
        const result = await dbManager.get(
            `SELECT id FROM partner_requests WHERE (requester_id = $1 OR target_id = $1) AND status = 'pending'`,
            [userId]
        );
        return !!result;
    } catch (err) {
        console.error('Error checking pending request:', err);
        return false;
    }
}

// ===== Helper: Send Partner Request =====
async function sendPartnerRequest(interaction, requesterId, requesterName, targetUser, guild) {
    try {
        const requestId = await manager.createPartnerRequest(
            requesterId, requesterName, targetUser.id, targetUser.username, guild
        );
        if (!requestId) return false;

        const requestChannel = await interaction.guild.channels.fetch(PARTNER_REQUESTS_CHANNEL_ID);
        if (!requestChannel) return false;

        const guildLabel = guild === 'sky_vanguards' ? '⚔️ Sky Vanguards' : '🌌 Aether Raiders';
        const color = guild === 'sky_vanguards' ? 0x5865F2 : 0x9B59B6;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`partner_accept:${requestId}`)
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`partner_decline:${requestId}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        const container = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents(t => t.setContent(`## 🤝 Partner Request For <@${targetUser.id}>`))
            .addSeparatorComponents(s => s.setDivider(true))
            //.addTextDisplayComponents(t => t.setContent(`### Hey <@${targetUser.id}>`))
            .addTextDisplayComponents(t => t.setContent(
                `### <@${requesterId}> wants to be your partner in **${guildLabel}**!\n\n` +
                `Do you accept?`
            ))
            .addSeparatorComponents(s => s.setDivider(true))
            .addActionRowComponents(row);

        const sentMessage = await requestChannel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { users: [targetUser.id] } // only target gets pinged
        });

        await dbManager.run(
            `UPDATE partner_requests SET message_id = $1 WHERE id = $2`,
            [sentMessage.id, requestId]
        );

        return true;
    } catch (err) {
        console.error('Error sending partner request:', err);
        return false;
    }
}

// ===== Helper: Update Forum Post =====
async function updateUserForumPost(guild, userId) {
    return await manager.updateUserForumPost(guild, userId);
}

// ===== Button Handlers =====
async function handlePartnerAccept(interaction, requestId) {
    await interaction.deferUpdate();

    try {
        const request = await manager.getPartnerRequestById(requestId);
        if (!request || request.status !== 'pending') {
            await interaction.followUp({ content: '❌ This request is no longer valid.', ephemeral: true });
            return;
        }

        if (interaction.user.id !== request.target_id) {
            await interaction.followUp({ content: '❌ Only the targeted user can accept this request.', ephemeral: true });
            return;
        }

        const target = await manager.getUser(request.target_id);
        const requester = await manager.getUser(request.requester_id);
        if (!target || !requester) {
            await interaction.followUp({ content: '❌ One of the users is not registered.', ephemeral: true });
            return;
        }
        if (target.partner_id || requester.partner_id) {
            await interaction.followUp({ content: '❌ One of the users already has a partner.', ephemeral: true });
            return;
        }

        await manager.linkPartners(request.requester_id, request.requester_name, request.target_id, request.target_name);
        await manager.updatePartnerRequestStatus(requestId, 'accepted');

        const guild = interaction.guild;
        const member1 = await guild.members.fetch(request.requester_id);
        const member2 = await guild.members.fetch(request.target_id);
        if (PARTNER_ROLE_ID) {
            await member1.roles.add(PARTNER_ROLE_ID);
            await member2.roles.add(PARTNER_ROLE_ID);
        }

        if (request.message_id) {
            try {
                const channel = await guild.channels.fetch(PARTNER_REQUESTS_CHANNEL_ID);
                const msg = await channel.messages.fetch(request.message_id);
                const acceptContainer = new ContainerBuilder()
                    .setAccentColor(0x00CC66)
                    .addTextDisplayComponents(t => t.setContent(`## ✅ Partner Accepted`))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(t => t.setContent(
                        `${requester.username} and ${target.username} are now partners!`
                    ))
                    .addSeparatorComponents(s => s.setDivider(false))
                    .addTextDisplayComponents(t => t.setContent(`-# Good luck team`));
                await msg.edit({
                    components: [acceptContainer],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] }
                });
            } catch (e) { console.error('Could not edit request message:', e); }
        }

        await updateUserForumPost(guild, request.requester_id);
        await updateUserForumPost(guild, request.target_id);

        await interaction.followUp({ content: '✅ Partnership accepted!', ephemeral: true });

    } catch (err) {
        console.error('Error in handlePartnerAccept:', err);
        await interaction.followUp({ content: '❌ An error occurred', ephemeral: true });
    }
}

async function handlePartnerDecline(interaction, requestId) {
    await interaction.deferUpdate();

    try {
        const request = await manager.getPartnerRequestById(requestId);
        if (!request || request.status !== 'pending') {
            await interaction.followUp({ content: '❌ This request is no longer valid', ephemeral: true });
            return;
        }

        if (interaction.user.id !== request.target_id) {
            await interaction.followUp({ content: '❌ Only the targeted user can decline this request', ephemeral: true });
            return;
        }

        await manager.updatePartnerRequestStatus(requestId, 'declined');

        if (request.message_id) {
            try {
                const channel = await interaction.guild.channels.fetch(PARTNER_REQUESTS_CHANNEL_ID);
                const msg = await channel.messages.fetch(request.message_id);
                const declineContainer = new ContainerBuilder()
                    .setAccentColor(0xFF4444)
                    .addTextDisplayComponents(t => t.setContent(`### ❌ Partner Request Declined`))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(t => t.setContent(
                        `${request.requester_name}’s request was declined.`
                    ));
                await msg.edit({
                    components: [declineContainer],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] }
                });
            } catch (e) { console.error('Could not edit request message:', e); }
        }

        await interaction.followUp({ content: '✅ Request declined.', ephemeral: true });

    } catch (err) {
        console.error('Error in handlePartnerDecline:', err);
        await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true });
    }
}

// ===== MAIN COMMAND =====
module.exports = {
    data: new SlashCommandBuilder()
        .setName('signup')
        .setDescription('Sign up for the Gamer Sky Anniversary event')
        .addStringOption(opt =>
            opt.setName('guild')
                .setDescription('Choose your guild')
                .setRequired(false)
                .addChoices(
                    { name: '⚔️ Sky Vanguards | +5%', value: 'sky_vanguards' },
                    { name: '🌌 Aether Raiders | +8%', value: 'aether_raiders' }
                ))
        .addUserOption(opt =>
            opt.setName('partner')
                .setDescription('Choose a partner (must be in the same guild and registered)')
                .setRequired(false)),

    async buttonHandler(interaction) {
        if (interaction.customId.startsWith('partner_accept:')) {
            const requestId = parseInt(interaction.customId.split(':')[1]);
            await handlePartnerAccept(interaction, requestId);
        } else if (interaction.customId.startsWith('partner_decline:')) {
            const requestId = parseInt(interaction.customId.split(':')[1]);
            await handlePartnerDecline(interaction, requestId);
        }
    },

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const userId = interaction.user.id;
            const username = interaction.user.username;

            const steamRecord = await dbManager.get(
                `SELECT * FROM discord_verify_steam WHERE discord_id = $1 AND status = 'verified'`,
                [userId]
            );
            if (!steamRecord) {
                const container = new ContainerBuilder()
                    .setAccentColor(0xFF4444)
                    .addTextDisplayComponents(t => t.setContent(
                        `## ❌ Steam Verification Required!\n` +
                        `You must verify your **Steam account** before signing up.\n\n` +
                        `Please use the verification panel to link your Steam account first.`
                    ));
                return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }

            const existing = await manager.getUser(userId);
            const partnerUser = interaction.options.getUser('partner');

            if (existing && partnerUser && !existing.partner_id) {
                if (await hasPendingRequest(userId)) {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(
                            `## ❌ You Have a Pending Request\n` +
                            `You already have a pending partner request, please wait for it to be resolved before sending another`
                        ));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }

                if (await hasPendingRequest(partnerUser.id)) {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(
                            `## ❌ Target Has a Pending Request\n` +
                            `**${partnerUser.username}** already has a pending partner request. They cannot receive another until it's resolved.`
                        ));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }

                if (partnerUser.id === userId) {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(`## ❌ Invalid Partner\nYou cannot choose yourself as a partner`));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }
                if (partnerUser.bot) {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(`## ❌ Invalid Partner\nYou cannot choose a bot as a partner`));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }
                const partnerRecord = await manager.getUser(partnerUser.id);
                if (!partnerRecord) {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(
                            `## ❌ Partner Not Registered\n**${partnerUser.username}** hasn't signed up yet\n` +
                            `They need to use \`/signup\` first to join the event`
                        ));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }
                if (partnerRecord.guild !== existing.guild) {
                    const partnerGuildLabel = partnerRecord.guild === 'sky_vanguards' ? '⚔️ Sky Vanguards' : '🌌 Aether Raiders';
                    const userGuildLabel = existing.guild === 'sky_vanguards' ? '⚔️ Sky Vanguards' : '🌌 Aether Raiders';
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(
                            `## ❌ Guild Mismatch\n` +
                            `You and your partner must be in the **same guild**\n\n` +
                            `Your guild: **${userGuildLabel}**\n` +
                            `${partnerUser.username}'s guild: **${partnerGuildLabel}**`
                        ));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }
                if (partnerRecord.partner_id) {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(
                            `## ❌ Partner Unavailable\n` +
                            `**${partnerUser.username}** already has a partner (**${partnerRecord.partner_name}**)`
                        ));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }

                const sent = await sendPartnerRequest(
                    interaction, userId, username,
                    { id: partnerUser.id, username: partnerUser.username },
                    existing.guild
                );

                if (sent) {
                    const waitingContainer = new ContainerBuilder()
                        .setAccentColor(0x00CC66)
                        .addTextDisplayComponents(t => t.setContent(
                            `## 📨 Partner Request Sent\n` +
                            `**${username}**, you are already registered in **${existing.guild === 'sky_vanguards' ? '⚔️ Sky Vanguards' : '🌌 Aether Raiders'}**\n` +
                            `-# A partner request has been sent to **${partnerUser.username}** | ` +
                            `You'll be linked once they accept`
                        ));
                    return interaction.editReply({ components: [waitingContainer], flags: MessageFlags.IsComponentsV2 });
                } else {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(`## ❌ Failed to Send Request\nSomething went wrong.`));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }
            }

            if (existing) {
                const guildLabel = existing.guild === 'sky_vanguards' ? '⚔️ Sky Vanguards' : '🌌 Aether Raiders';
                const container = new ContainerBuilder()
                    .setAccentColor(0xFF8800)
                    .addTextDisplayComponents(t => t.setContent(
                        `## ⚠️ Already Registered!\n` +
                        `🏰 Guild: **${guildLabel}**\n` +
                        `🤝 Partner: **${existing.partner_name ? existing.partner_name : 'Solo Explorer'}**\n` +
                        `💠 Tokens: **${existing.total_sky_tokens}**`
                    ));
                return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }

            let guildChoice = interaction.options.getString('guild');
            if (!guildChoice) {
                const container = new ContainerBuilder()
                    .setAccentColor(0xFF4444)
                    .addTextDisplayComponents(t => t.setContent(
                        `## ❌ Guild Required\n` +
                        `You must choose a guild using the \`guild\` option\n\n` +
                        `Example: \`/signup guild:sky_vanguards\``
                    ));
                return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }

            let partnerRecord = null;
            if (partnerUser) {
                if (await hasPendingRequest(userId)) {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(
                            `## ❌ You Have a Pending Request\n` +
                            `You already have a pending partner request, please wait for it to be resolved before sending another`
                        ));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }

                if (await hasPendingRequest(partnerUser.id)) {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(
                            `## ❌ Target Has a Pending Request\n` +
                            `**${partnerUser.username}** already has a pending partner request. They cannot receive another until it's resolved.`
                        ));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }

                if (partnerUser.id === userId) {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(`## ❌ Invalid Partner\nYou cannot choose yourself as a partner`));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }
                if (partnerUser.bot) {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(`## ❌ Invalid Partner\nYou cannot choose a bot as a partner`));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }
                partnerRecord = await manager.getUser(partnerUser.id);
                if (!partnerRecord) {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(
                            `## ❌ Partner Not Registered\n**${partnerUser.username}** hasn't signed up yet\n` +
                            `They need to use \`/signup\` first to join the event`
                        ));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }
                if (partnerRecord.guild !== guildChoice) {
                    const partnerGuildLabel = partnerRecord.guild === 'sky_vanguards' ? '⚔️ Sky Vanguards' : '🌌 Aether Raiders';
                    const userGuildLabel = guildChoice === 'sky_vanguards' ? '⚔️ Sky Vanguards' : '🌌 Aether Raiders';
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(
                            `## ❌ Guild Mismatch\n` +
                            `You and your partner must be in the **same guild**\n\n` +
                            `Your guild: **${userGuildLabel}**\n` +
                            `${partnerUser.username}'s guild: **${partnerGuildLabel}**`
                        ));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }
                if (partnerRecord.partner_id) {
                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(t => t.setContent(
                            `## ❌ Partner Unavailable\n` +
                            `**${partnerUser.username}** already has a partner (**${partnerRecord.partner_name}**)`
                        ));
                    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                }
            }

            const newUser = await manager.createUser(userId, username, guildChoice);
            if (!newUser) {
                const container = new ContainerBuilder()
                    .setAccentColor(0xFF4444)
                    .addTextDisplayComponents(t => t.setContent(`## ❌ Registration Failed\nSomething went wrong`));
                return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }

            try {
                const member = await interaction.guild.members.fetch(userId);
                const roleId = GUILD_ROLES[guildChoice];
                if (roleId) await member.roles.add(roleId);
            } catch (err) {
                console.error('⚠️ Could not assign guild role:', err.message);
            }

            const forumPost = await createForumPost(interaction, userId, username, guildChoice);
            const guildLabel = guildChoice === 'sky_vanguards' ? '⚔️ Sky Vanguards' : '🌌 Aether Raiders';

            if (partnerUser && partnerRecord) {
                const sent = await sendPartnerRequest(
                    interaction, userId, username,
                    { id: partnerUser.id, username: partnerUser.username },
                    guildChoice
                );
                if (sent) {
                    const waitingContainer = new ContainerBuilder()
                        .setAccentColor(0x00CC66)
                        .addTextDisplayComponents(t => t.setContent(
                            `## ✅ Registration Complete!\n` +
                            `**${username}**, you're now registered in **${guildLabel}**\n\n` +
                            `📨 A partner request has been sent to **${partnerUser.username}**\n` +
                            `You'll be linked once they accept.\n\n` +
                            `💠 Tokens: **0**`
                        ));
                    return interaction.editReply({ components: [waitingContainer], flags: MessageFlags.IsComponentsV2 });
                }
            }

            const successContainer = new ContainerBuilder()
                .setAccentColor(0x00FF88)
                .addTextDisplayComponents(t => t.setContent(`## ✅ Successfully Registered!`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addSectionComponents(s =>
                    s.addTextDisplayComponents(t => t.setContent(
                        `Welcome to **Project Horizon**, **${username}**!\n\n` +
                        `🏰 Guild: **${guildLabel}**\n` +
                        `🤝 Partner: **Solo Explorer**\n` +
                        `💠 Starting Tokens: **0**`
                    ))
                    .setThumbnailAccessory(thumb =>
                        thumb.setDescription(username).setURL(interaction.user.displayAvatarURL({ extension: 'png', size: 256 }))
                    )
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(t => t.setContent(`-# ${forumPost ? `Your post: ${forumPost.name}` : 'Good luck!'}`));

            await interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
            console.log(`✅ [SIGNUP] ${username} (${userId}) → ${guildChoice} | No partner`);

        } catch (err) {
            console.error('❌ /signup error:', err);
            const errContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(t => t.setContent(`## ❌ Unexpected Error\n\`${err.message.substring(0, 500)}\``));
            await interaction.editReply({ components: [errContainer], flags: MessageFlags.IsComponentsV2 });
        }
    }
};

module.exports.updateUserForumPost = updateUserForumPost;