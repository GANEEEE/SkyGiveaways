const {
    SlashCommandBuilder,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType
} = require('discord.js');
const dbManager = require('../Data/database');

class LeaderboardSessionManager {
    constructor() {
        this.sessions = new Map();
        this.collectors = new Map();
        this.startCleanup();
    }

    getSession(userId) {
        return this.sessions.get(userId);
    }

    setSession(userId, sessionData) {
        this.sessions.set(userId, {
            ...sessionData,
            lastUpdated: Date.now()
        });
    }

    deleteSession(userId) {
        const session = this.sessions.get(userId);
        if (session && session.collector) {
            try {
                session.collector.stop();
            } catch (e) {
                console.log('Error stopping collector:', e.message);
            }
        }
        this.collectors.delete(userId);
        return this.sessions.delete(userId);
    }

    setCollector(userId, collector) {
        this.collectors.set(userId, collector);
    }

    getCollector(userId) {
        return this.collectors.get(userId);
    }

    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            let deletedCount = 0;

            for (const [userId, session] of this.sessions.entries()) {
                if (now - session.lastUpdated > 30 * 60 * 1000) {
                    this.deleteSession(userId);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                console.log(`🧹 Cleaned ${deletedCount} old leaderboard sessions`);
            }
        }, 30 * 60 * 1000);
    }
}

const leaderboardSessionManager = new LeaderboardSessionManager();
const avatarCache = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('🏆 Display server leaderboards')
        .setDMPermission(false),

    isLeaderboardButton(customId) {
        return [
            'lb_next_page', 
            'lb_prev_page', 
            'filter_xp', 
            'filter_coins', 
            'filter_crystals', 
            'filter_wishes', 
            'filter_tokens',
            'guild_top_sv',
            'guild_top_ar',
            'guild_top_champion'
        ].some(id => customId.startsWith(id));
    },

    async execute(interaction) {
        try {
            console.log(`🏆 /leaderboard command by ${interaction.user.tag}`);

            await interaction.deferReply({ ephemeral: false });

            const result = await this.getAllPlayers(interaction, 'xp');
            const players = result?.players ?? result;
            const guildTotals = result?.guildTotals ?? null;
            const topPlayers = result?.topPlayers ?? null;

            if (players.length === 0) {
                return await interaction.editReply({
                    content: '📭 No players found in the leaderboard yet!',
                    allowedMentions: { parse: [] }
                });
            }

            const message = await this.displayLeaderboardPage(
                interaction, 1, players, true, 'xp',
                interaction.user.id,
                interaction.user.username,
                guildTotals,
                topPlayers
            );

            const collector = this.createCollector(interaction, message, players);

            leaderboardSessionManager.setSession(interaction.user.id, {
                page: 1,
                players: players,
                guildTotals: guildTotals,
                topPlayers: topPlayers,
                messageId: message.id,
                channelId: message.channelId,
                totalPages: Math.ceil(players.length / 5),
                collector: collector,
                currentFilter: 'xp',
                requestingUserId: interaction.user.id,
                requestingUsername: interaction.user.username
            });

            leaderboardSessionManager.setCollector(interaction.user.id, collector);

        } catch (error) {
            console.error('Error in leaderboard command:', error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Error loading leaderboard. Please try again.',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: '❌ Error loading leaderboard. Please try again.',
                    allowedMentions: { parse: [] }
                });
            }
        }
    },

    createCollector(interaction, message, originalPlayers) {
        const filter = (i) =>
            i.user.id === interaction.user.id &&
            this.isLeaderboardButton(i.customId);

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter,
            time: 300000
        });

        collector.on('collect', async (buttonInteraction) => {
            try {
                console.log(`🏆 Button clicked: ${buttonInteraction.customId} by ${buttonInteraction.user.tag}`);

                await buttonInteraction.deferUpdate().catch(() => {});

                const userSession = leaderboardSessionManager.getSession(buttonInteraction.user.id);

                if (!userSession) {
                    console.log('❌ No session found');
                    return;
                }

                let newPage = userSession.page;
                let newFilter = userSession.currentFilter;

                // ⭐⭐ معالجة أزرار Top Players ⭐⭐
                if (buttonInteraction.customId.startsWith('guild_top_')) {
                    // مش محتاجين نعمل حاجة هنا - الزرار للعرض فقط
                    return;
                }

                if (buttonInteraction.customId.startsWith('filter_')) {
                    newPage = 1;
                    switch (buttonInteraction.customId) {
                        case 'filter_xp':       newFilter = 'xp';            break;
                        case 'filter_coins':    newFilter = 'sky_coins';     break;
                        case 'filter_crystals': newFilter = 'sky_crystals';  break;
                        case 'filter_wishes':   newFilter = 'skywell_total'; break;
                        case 'filter_tokens':   newFilter = 'tokens';        break;
                    }
                } else {
                    switch (buttonInteraction.customId) {
                        case 'lb_next_page':
                            if (userSession.page < userSession.totalPages) newPage = userSession.page + 1;
                            break;
                        case 'lb_prev_page':
                            if (userSession.page > 1) newPage = userSession.page - 1;
                            break;
                    }
                }

                const result = await this.getAllPlayers(buttonInteraction, newFilter);
                const updatedPlayers = result?.players ?? result;
                const guildTotals = result?.guildTotals ?? null;
                const topPlayers = result?.topPlayers ?? null;

                await this.updateLeaderboardPage(
                    buttonInteraction,
                    message,
                    newPage,
                    updatedPlayers,
                    newFilter,
                    userSession.requestingUserId,
                    userSession.requestingUsername,
                    guildTotals,
                    topPlayers
                );

                leaderboardSessionManager.setSession(buttonInteraction.user.id, {
                    ...userSession,
                    page: newPage,
                    players: updatedPlayers,
                    guildTotals: guildTotals,
                    topPlayers: topPlayers,
                    totalPages: Math.ceil(updatedPlayers.length / 5),
                    currentFilter: newFilter
                });

            } catch (error) {
                console.error('Error in collector:', error);
            }
        });

        collector.on('end', (collected, reason) => {
            console.log(`🏆 Collector ended for ${interaction.user.tag}: ${reason}`);
            if (reason === 'time') {
                leaderboardSessionManager.deleteSession(interaction.user.id);
            }
        });

        return collector;
    },

    async getAllPlayers(interaction, filterType = 'xp') {
        try {
            // ===== Tokens Leaderboard (activity_rewards) =====
            if (filterType === 'tokens') {
                return await this.getPlayersByTokens(interaction);
            }

            let orderByQuery;
            switch (filterType) {
                case 'xp':            orderByQuery = 'xp DESC';           break;
                case 'sky_coins':     orderByQuery = 'sky_coins DESC';    break;
                case 'sky_crystals':  orderByQuery = 'sky_crystals DESC'; break;
                case 'skywell_total':
                    return await this.getPlayersByWishes(interaction);
                default:
                    orderByQuery = 'xp DESC';
            }

            const allLevels = await dbManager.all(
                `SELECT user_id, username, xp, level, sky_coins, sky_crystals FROM levels ORDER BY ${orderByQuery}`
            );

            if (allLevels.length === 0) return [];

            const players = await Promise.all(
                allLevels.map(async (user) => {
                    const skywellData = await dbManager.get(
                        `SELECT total_coins_thrown, total_converted_coins FROM skywell_users WHERE user_id = $1`,
                        [user.user_id]
                    );

                    const skywellTotal = (skywellData?.total_coins_thrown || 0) +
                                         (skywellData?.total_converted_coins || 0);

                    let avatarURL = avatarCache.get(user.user_id);
                    let username = user.username;

                    if (!avatarURL) {
                        try {
                            const discordUser = await interaction.client.users.fetch(user.user_id).catch(() => null);
                            if (discordUser) {
                                avatarURL = discordUser.displayAvatarURL({ extension: 'png', size: 256, forceStatic: false });
                                username = discordUser.username;
                                avatarCache.set(user.user_id, avatarURL);
                                setTimeout(() => avatarCache.delete(user.user_id), 5 * 60 * 1000);
                            } else {
                                avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';
                            }
                        } catch (err) {
                            avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';
                        }
                    }

                    return {
                        userId: user.user_id,
                        username,
                        xp: user.xp || 0,
                        level: user.level || 0,
                        sky_coins: user.sky_coins || 0,
                        sky_crystals: user.sky_crystals || 0,
                        skywell_total: skywellTotal,
                        avatarURL,
                        sortValue: this.getSortValue(user, skywellTotal, filterType)
                    };
                })
            );

            if (filterType === 'xp') return players;
            return players.sort((a, b) => b.sortValue - a.sortValue);

        } catch (error) {
            console.error('Error getting all players:', error);
            return [];
        }
    },

    // ===== GET PLAYERS BY SKY-TOKENS (activity_rewards) =====
    async getPlayersByTokens(interaction) {
        try {
            const allData = await dbManager.all(
                `SELECT 
                    user_id,
                    username,
                    total_sky_tokens,
                    guild,
                    partner_id,
                    partner_name
                 FROM activity_rewards
                 ORDER BY total_sky_tokens DESC`
            );

            if (allData.length === 0) {
                return { 
                    players: [], 
                    guildTotals: { sv: 0, ar: 0 },
                    topPlayers: { sv: null, ar: null, champion: null }
                };
            }

            // ⭐⭐ حساب مجموع توكنز كل Guild ⭐⭐
            const guildTotals = { sv: 0, ar: 0 };
            let topSV = null;
            let topAR = null;

            for (const row of allData) {
                const tokens = row.total_sky_tokens || 0;

                if (row.guild === 'sky_vanguards') {
                    guildTotals.sv += tokens;
                    if (!topSV || tokens > topSV.tokens) {
                        topSV = { userId: row.user_id, username: row.username, tokens };
                    }
                }

                if (row.guild === 'aether_raiders') {
                    guildTotals.ar += tokens;
                    if (!topAR || tokens > topAR.tokens) {
                        topAR = { userId: row.user_id, username: row.username, tokens };
                    }
                }
            }

            // ⭐⭐ أعلى لاعب بشكل عام (Champion) ⭐⭐
            const champion = allData[0] ? {
                userId: allData[0].user_id,
                username: allData[0].username,
                tokens: allData[0].total_sky_tokens
            } : null;

            const players = await Promise.all(
                allData.map(async (row) => {
                    let avatarURL = avatarCache.get(row.user_id);
                    let username = row.username;

                    if (!avatarURL) {
                        try {
                            const discordUser = await interaction.client.users.fetch(row.user_id).catch(() => null);
                            if (discordUser) {
                                avatarURL = discordUser.displayAvatarURL({ extension: 'png', size: 256, forceStatic: false });
                                username = discordUser.username;
                                avatarCache.set(row.user_id, avatarURL);
                                setTimeout(() => avatarCache.delete(row.user_id), 5 * 60 * 1000);
                            } else {
                                avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';
                            }
                        } catch (err) {
                            avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';
                        }
                    }

                    const guildText =
                        row.guild === 'sky_vanguards'  ? '⚔️ SV' :
                        row.guild === 'aether_raiders' ? '🌌 AR' : null;

                    const partnerText = row.partner_id
                        ? `Partner: <@${row.partner_id}>`
                        : 'Solo';

                    return {
                        userId: row.user_id,
                        username,
                        avatarURL,
                        total_sky_tokens: row.total_sky_tokens || 0,
                        guildText,
                        partnerText,
                        partner_id: row.partner_id,
                        sortValue: row.total_sky_tokens || 0,
                        xp: 0, level: 0, sky_coins: 0, sky_crystals: 0, skywell_total: 0
                    };
                })
            );

            return { 
                players, 
                guildTotals,
                topPlayers: {
                    sv: topSV,
                    ar: topAR,
                    champion: champion
                }
            };

        } catch (error) {
            console.error('Error getting players by tokens:', error);
            return { 
                players: [], 
                guildTotals: { sv: 0, ar: 0 },
                topPlayers: { sv: null, ar: null, champion: null }
            };
        }
    },

    async getPlayersByWishes(interaction) {
        try {
            const allData = await dbManager.all(`
                SELECT
                    l.user_id, l.username, l.xp, l.level, l.sky_coins, l.sky_crystals,
                    COALESCE(s.total_coins_thrown, 0)    as total_coins_thrown,
                    COALESCE(s.total_converted_coins, 0) as total_converted_coins
                FROM levels l
                LEFT JOIN skywell_users s ON l.user_id = s.user_id
                ORDER BY (COALESCE(s.total_coins_thrown, 0) + COALESCE(s.total_converted_coins, 0)) DESC
            `);

            if (allData.length === 0) return [];

            return await Promise.all(
                allData.map(async (user) => {
                    const skywellTotal = (user.total_coins_thrown || 0) + (user.total_converted_coins || 0);

                    let avatarURL = avatarCache.get(user.user_id);
                    let username = user.username;

                    if (!avatarURL) {
                        try {
                            const discordUser = await interaction.client.users.fetch(user.user_id).catch(() => null);
                            if (discordUser) {
                                avatarURL = discordUser.displayAvatarURL({ extension: 'png', size: 256, forceStatic: false });
                                username = discordUser.username;
                                avatarCache.set(user.user_id, avatarURL);
                                setTimeout(() => avatarCache.delete(user.user_id), 5 * 60 * 1000);
                            } else {
                                avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';
                            }
                        } catch (err) {
                            avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';
                        }
                    }

                    return {
                        userId: user.user_id,
                        username,
                        xp: user.xp || 0,
                        level: user.level || 0,
                        sky_coins: user.sky_coins || 0,
                        sky_crystals: user.sky_crystals || 0,
                        skywell_total: skywellTotal,
                        avatarURL,
                        sortValue: skywellTotal
                    };
                })
            );

        } catch (error) {
            console.error('Error getting players by wishes:', error);
            return [];
        }
    },

    getSortValue(user, skywellTotal, filterType) {
        switch (filterType) {
            case 'xp':            return user.xp || 0;
            case 'sky_coins':     return user.sky_coins || 0;
            case 'sky_crystals':  return user.sky_crystals || 0;
            case 'skywell_total': return skywellTotal;
            default:              return user.xp || 0;
        }
    },

    async displayLeaderboardPage(interaction, pageNumber, allPlayers, isNewCommand = false, filterType = 'xp', requestingUserId = null, requestingUsername = null, guildTotals = null, topPlayers = null) {
        try {
            const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 }) ||
                               interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 });

            const playersPerPage = 5;
            const totalPages = Math.max(1, Math.ceil(allPlayers.length / playersPerPage));

            if (pageNumber > totalPages) pageNumber = totalPages;
            if (pageNumber < 1) pageNumber = 1;

            const startIndex = (pageNumber - 1) * playersPerPage;
            const pagePlayers = allPlayers.slice(startIndex, startIndex + playersPerPage);

            const userRank = requestingUserId
                ? allPlayers.findIndex(p => p.userId === requestingUserId) + 1
                : null;

            const container = await this.buildLeaderboardContainer(
                pageNumber, totalPages, pagePlayers,
                serverIcon, allPlayers.length,
                filterType, userRank, requestingUsername, guildTotals, topPlayers
            );

            if (isNewCommand) {
                const message = await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] }
                });
                return message;
            } else {
                await interaction.message.edit({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] }
                });
                return interaction.message;
            }

        } catch (error) {
            console.error('Error in displayLeaderboardPage:', error);
            throw error;
        }
    },

    async updateLeaderboardPage(interaction, message, pageNumber, allPlayers, filterType = 'xp', requestingUserId = null, requestingUsername = null, guildTotals = null, topPlayers = null) {
        try {
            const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 }) ||
                               interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 });

            const playersPerPage = 5;
            const totalPages = Math.max(1, Math.ceil(allPlayers.length / playersPerPage));

            if (pageNumber > totalPages) pageNumber = totalPages;
            if (pageNumber < 1) pageNumber = 1;

            const startIndex = (pageNumber - 1) * playersPerPage;
            const pagePlayers = allPlayers.slice(startIndex, startIndex + playersPerPage);

            const userRank = requestingUserId
                ? allPlayers.findIndex(p => p.userId === requestingUserId) + 1
                : null;

            const container = await this.buildLeaderboardContainer(
                pageNumber, totalPages, pagePlayers,
                serverIcon, allPlayers.length,
                filterType, userRank, requestingUsername, guildTotals, topPlayers
            );

            await message.edit({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] }
            });

        } catch (error) {
            console.error('Error updating leaderboard page:', error);
            throw error;
        }
    },

    async buildLeaderboardContainer(pageNumber, totalPages, pagePlayers, serverIcon, totalPlayers, filterType = 'xp', userRank = null, requestingUsername = null, guildTotals = null, topPlayers = null) {
        const container = new ContainerBuilder().setAccentColor(0x0073ff);

        const titleText = this.getTitleText(filterType);

        const rankLine = (userRank && userRank > 0 && requestingUsername)
            ? `${requestingUsername}'s rank #${userRank}`
            : titleText;

        // ⭐⭐ العنوان الرئيسي ⭐⭐
        const titleSection = new SectionBuilder()
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## 🏆 GAMERSKY LEADERBOARD\n` +
                    `### ${rankLine}\n` +
                    `-# **${titleText}**`
                )
            )
            .setThumbnailAccessory((thumbnail) =>
                thumbnail
                    .setDescription('Server Leaderboard')
                    .setURL(serverIcon)
            );

        container.addSectionComponents((section) => titleSection);
        container.addSeparatorComponents((separator) => new SeparatorBuilder().setDivider(true));

        // ⭐⭐ أزرار الفلاتر ⭐⭐
        const filterButtons = this.createFilterButtons(filterType);
        container.addActionRowComponents((actionRow) =>
            actionRow.setComponents(filterButtons)
        );

        container.addSeparatorComponents((separator) => new SeparatorBuilder().setDivider(true));

        // ⭐⭐⭐ سكشن Guild Totals (للـ Tokens فقط) مع زر معطل ⭐⭐⭐
        if (filterType === 'tokens' && guildTotals && topPlayers) {
            // تحديد أي Guild أعلى
            const winningGuild = guildTotals.sv > guildTotals.ar ? 'sv' : 'ar';

            // السكشن الأول: Guild Totals مع زر معطل
            const guildTotalsSection = new SectionBuilder()
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(
                        `⚔️ **SV:** ${guildTotals.sv.toLocaleString()} 💠` +
                        ` ||||| 🌌 **AR:** ${guildTotals.ar.toLocaleString()} 💠`
                    )
                )
                .setButtonAccessory((button) =>
                    button
                        .setCustomId(winningGuild === 'sv' ? 'guild_top_sv_display' : 'guild_top_ar_display')
                        .setLabel(winningGuild === 'sv' ? '⚔️ Sky Vanguards Leading' : '🌌 Aether Raiders Leading')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

            container.addSectionComponents((section) => guildTotalsSection);
            container.addSeparatorComponents((separator) => new SeparatorBuilder().setDivider(true));
        }

        // ⭐⭐ عرض اللاعبين ⭐⭐
        for (let i = 0; i < pagePlayers.length; i++) {
            const player = pagePlayers[i];
            const globalRank = ((pageNumber - 1) * 5) + i + 1;
            const rankEmoji = this.getRankEmoji(globalRank);

            let playerContent;

            if (filterType === 'tokens') {
                const thirdLineParts = [];
                if (player.guildText) thirdLineParts.push(`Guild: ${player.guildText}`);
                thirdLineParts.push(player.partnerText);

                playerContent =
                    `## **${rankEmoji} ${player.username}**\n` +
                    `### 💠 Sky-Tokens: **${(player.total_sky_tokens || 0).toLocaleString()}**\n` +
                    `-# ${thirdLineParts.join(' | ')}`;
            } else {
                playerContent =
                    `## **${rankEmoji} ${player.username}**\n` +
                    `### <:XP:1468446751282302976> **${player.xp.toLocaleString()}** ||||| Level **${player.level}**\n` +
                    `-# <:Coins:1468446651965374534> Coins: **${player.sky_coins.toLocaleString()}** ||||| <:Crystal:1468446688338251793> Crystals: **${player.sky_crystals.toLocaleString()}** ||||| 💧 Total Thrown: **${player.skywell_total.toLocaleString()}**`;
            }

            const playerSection = new SectionBuilder()
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(playerContent)
                )
                .setThumbnailAccessory((thumbnail) =>
                    thumbnail
                        .setDescription(`${player.username} - Rank #${globalRank}`)
                        .setURL(player.avatarURL)
                );

            container.addSectionComponents((section) => playerSection);

            if (i < pagePlayers.length - 1) {
                container.addSeparatorComponents((separator) => new SeparatorBuilder().setDivider(true));
            }
        }

        container.addSeparatorComponents((separator) => new SeparatorBuilder().setDivider(true));

        // ⭐⭐ Navigation ⭐⭐
        const navigationSection = new SectionBuilder()
            .setButtonAccessory((button) =>
                button
                    .setCustomId('lb_next_page')
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageNumber >= totalPages)
            )
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(`-# Page ${pageNumber} of ${totalPages}`)
            );

        container.addSectionComponents((section) => navigationSection);

        if (pageNumber > 1) {
            container.addActionRowComponents((actionRow) =>
                actionRow.setComponents(
                    new ButtonBuilder()
                        .setCustomId('lb_prev_page')
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Secondary)
                )
            );
        }

        return container;
    },

    createFilterButtons(currentFilter) {
        return [
            new ButtonBuilder()
                .setCustomId('filter_xp')
                .setLabel('XP')
                .setStyle(currentFilter === 'xp' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('⭐'),
            new ButtonBuilder()
                .setCustomId('filter_coins')
                .setLabel('Coins')
                .setStyle(currentFilter === 'sky_coins' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🪙'),
            new ButtonBuilder()
                .setCustomId('filter_crystals')
                .setLabel('Crystals')
                .setStyle(currentFilter === 'sky_crystals' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('💎'),
            new ButtonBuilder()
                .setCustomId('filter_wishes')
                .setLabel('Well')
                .setStyle(currentFilter === 'skywell_total' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('💧'),
            new ButtonBuilder()
                .setCustomId('filter_tokens')
                .setLabel('------')
                .setStyle(currentFilter === 'tokens' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('❓')
                //.setDisabled(currentFilter === 'tokens')
        ];
    },

    getTitleText(filterType) {
        switch (filterType) {
            case 'xp':            return 'Top Players by XP';
            case 'sky_coins':     return 'Top Players by Sky Coins';
            case 'sky_crystals':  return 'Top Players by Sky Crystals';
            case 'skywell_total': return 'Top Players by Wishes (Skywell)';
            case 'tokens':        return 'Top Players by Sky-Tokens';
            default:              return 'Top Players by XP';
        }
    },

    getRankEmoji(rank) {
        switch (rank) {
            case 1:  return '🥇';
            case 2:  return '🥈';
            case 3:  return '🥉';
            case 4:
            case 5:  return '🌟';
            case 6:
            case 7:
            case 8:  return '⭐';
            case 9:
            case 10: return '✨';
            default: return `#${rank}`;
        }
    }
};