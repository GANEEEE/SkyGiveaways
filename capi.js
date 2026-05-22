// ============================================
// CAPI.JS - Community API for Website
// ============================================
// Handles: Giveaways, Levels, Messages, Invites,
//          Steam Verification, Tickets, Drops,
//          Steam Publisher Games, Humble Choice
// ============================================

const express = require('express');
const router = express.Router();
const dbManager = require('./Bot/Data/database');

// Store bot client reference
let botClient = null;

// Constants
const DEFAULT_COLOR = 0x4bff4b;
const WINNER_ROLE_ID = '1395730680926965781';
const GIVEAWAY_CHANNEL_ID = '1386682733920653454';
const GIVEAWAY_LOG_CHANNEL_ID = '1385531928446373970';

// Platform choices
const PLATFORM_CHOICES = ['Steam', 'GOG', 'Epic Games', 'Legacy'];

// Color choices
const COLOR_CHOICES = {
    'RED': 0xed4245,
    'GREEN': 0x57f287,
    'BLUE': 0x3498db,
    'YELLOW': 0xfee75c,
    'PURPLE': 0x9b59b6,
    'ORANGE': 0xe67e22,
    'PINK': 0xeb459e,
    'GOLD': 0xf1c40f,
    'CYAN': 0x00ffff,
    'GRAY': 0x95a5a6
};

// ============================================================
// Initialize
// ============================================================

function initCAPI(client) {
    botClient = client;
    console.log('✅ CAPI: Community API initialized');
}

// ============================================================
// Helper Functions
// ============================================================

function parseColor(colorInput) {
    if (!colorInput) return DEFAULT_COLOR;
    if (COLOR_CHOICES[colorInput.toUpperCase()]) {
        return COLOR_CHOICES[colorInput.toUpperCase()];
    }
    if (colorInput.startsWith('#')) {
        const hex = colorInput.slice(1);
        if (/^[0-9A-Fa-f]{6}$/.test(hex)) return parseInt(hex, 16);
    }
    if (/^[0-9A-Fa-f]{6}$/.test(colorInput)) {
        return parseInt(colorInput, 16);
    }
    return DEFAULT_COLOR;
}

function generateGiveawayCode() {
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += Math.floor(Math.random() * 10);
    }
    return `CGS-${code}`;
}

function getGameTitle(gameName, gameLink) {
    if (gameLink && gameLink.trim()) {
        return `[${gameName}](${gameLink})`;
    }
    return gameName;
}

function buildDescription(gameName, gameLink, platform, note, reqRoleId, messageReqType, messageReqAmount) {
    const sections = [];
    const titleText = getGameTitle(gameName, gameLink);

    sections.push(`## ${titleText} | ${platform}`);

    if (reqRoleId) {
        sections.push(`Required Role: <@&${reqRoleId}>\nWinner Role: <@&${WINNER_ROLE_ID}>`);
    }

    if (messageReqType && messageReqAmount) {
        const typeNames = {
            total: 'Total',
            monthly: 'Monthly',
            weekly: 'Weekly',
            daily: 'Daily'
        };
        const periodLabel = typeNames[messageReqType]?.toLowerCase() || 'messages';
        sections.push(`Messages Sent:\n• ${messageReqAmount} ${periodLabel} messages`);
    }

    if (note && note.trim()) {
        sections.push(`*Note: ${note}*`);
    }

    return sections.join('\n\n');
}

function createGiveawayEmbed(gameName, gameLink, platform, endsAt, winnersCount, note, reqRoleId, messageReqType, messageReqAmount, imageUrl, hostId, hostName, hostAvatar, giveawayCode, color, participantsCount = 0) {
    const embed = {
        color: color,
        description: buildDescription(gameName, gameLink, platform, note, reqRoleId, messageReqType, messageReqAmount),
        fields: [
            { name: 'Status', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
            { name: 'Participants', value: `${participantsCount}`, inline: true },
            { name: 'Winners', value: `${winnersCount}`, inline: true }
        ],
        footer: {
            text: `${hostName || 'Host'} | ID: ${giveawayCode}`,
            icon_url: hostAvatar || undefined
        }
    };

    if (imageUrl && imageUrl.trim()) {
        embed.image = { url: imageUrl };
    }

    return embed;
}

function createGiveawayMessage(gameName, gameLink, platform, endsAt, winnersCount, note, reqRoleId, imageUrl, giveawayCode, hostId, hostName, hostAvatar, participantsCount, messageReqType, messageReqAmount, color) {
    const embed = createGiveawayEmbed(
        gameName, gameLink, platform, endsAt, winnersCount, note, reqRoleId,
        messageReqType, messageReqAmount, imageUrl, hostId, hostName, hostAvatar,
        giveawayCode, color, participantsCount
    );

    const row = {
        type: 1,
        components: [
            {
                type: 2,
                style: 3,
                label: `Join (${participantsCount})`,
                custom_id: `commgiveaway_join_${giveawayCode}`,
                emoji: { name: '🕊️' }
            },
            {
                type: 2,
                style: 2,
                label: 'Participants',
                custom_id: `commgiveaway_participants_${giveawayCode}_view_1`,
                emoji: { name: '👥' }
            }
        ]
    };

    return {
        embeds: [embed],
        components: [row]
    };
}

// ============================================================
// API Endpoints
// ============================================================

/**
 * GET /capi/health - Check API status
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        botReady: !!botClient,
        timestamp: Date.now()
    });
});

// ============================================================
// 1. GIVEAWAYS ENDPOINTS
// ============================================================

/**
 * GET /capi/giveaways/active - Get all active community giveaways
 */
router.get('/giveaways/active', async (req, res) => {
    try {
        // ما نستقبلش guildId من الـ query
        if (!botClient) {
            return res.status(503).json({ success: false, error: 'Bot is not ready' });
        }

        // جيب أول سيرفر في البوت
        const firstGuild = botClient.guilds.cache.first();
        if (!firstGuild) {
            return res.status(404).json({ success: false, error: 'No guilds found' });
        }

        const guildId = firstGuild.id;

        // 1. جلب الـ Community Giveaways
        const communityGiveaways = await dbManager.all(
            `SELECT 
                'community' as type,
                giveaway_code as code,
                game_name,
                game_link,
                platform,
                image_url,
                winners_count,
                note,
                ends_at,
                participants,
                host_name,
                host_id,
                embed_color,
                message_id,
                channel_id,
                guild_id
             FROM community_giveaways 
             WHERE guild_id = $1 
             AND is_active = true 
             AND is_ended = false 
             AND ends_at > NOW()
             ORDER BY ends_at ASC`,
            [guildId]
        );

        // 2. جلب الـ Sky Giveaways (من جدول giveaways العادي)
        const skyGiveaways = await dbManager.all(
            `SELECT 
                'sky' as type,
                giveaway_code as code,
                COALESCE(title, 'Sky Giveaway') as game_name,
                NULL as game_link,
                'Sky' as platform,
                image_url,
                winners_count,
                NULL as note,
                end_time as ends_at,
                NULL as participants,
                host_name,
                host_id,
                NULL as embed_color,
                message_id,
                channel_id,
                guild_id
             FROM giveaways 
             WHERE guild_id = $1 
             AND status = 'active' 
             AND end_time > NOW()
             ORDER BY end_time ASC`,
            [guildId]
        );

        // 3. دمج الاتنين
        const allGiveaways = [...communityGiveaways, ...skyGiveaways];
        allGiveaways.sort((a, b) => new Date(a.ends_at) - new Date(b.ends_at));

        const formattedGiveaways = allGiveaways.map(g => {
            let participantsCount = 0;
            if (g.type === 'community') {
                participantsCount = [...new Set(g.participants || [])].length;
            }

            let borderColor = '#57f287';
            if (g.type === 'sky') borderColor = '#f1c40f';
            else if (g.type === 'community') borderColor = '#5865f2';

            return {
                type: g.type,
                code: g.code,
                game_name: g.game_name,
                game_link: g.game_link,
                platform: g.platform,
                image_url: g.image_url,
                winners_count: g.winners_count,
                note: g.note,
                ends_at: g.ends_at,
                participants_count: participantsCount,
                host_name: g.host_name,
                host_id: g.host_id,
                embed_color: g.embed_color,
                message_id: g.message_id,
                channel_id: g.channel_id,
                guild_id: g.guild_id,
                border_color: borderColor
            };
        });

        res.json({
            success: true,
            giveaways: formattedGiveaways,
            count: formattedGiveaways.length
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching active giveaways:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /capi/giveaway/:code - Get single giveaway by code
 */
router.get('/giveaway/:code', async (req, res) => {
    try {
        const { code } = req.params;

        const giveaway = await dbManager.getCommunityGiveawayByCode(code);

        if (!giveaway) {
            return res.status(404).json({ success: false, error: 'Giveaway not found' });
        }

        res.json({
            success: true,
            giveaway: {
                code: giveaway.giveaway_code,
                game_name: giveaway.game_name,
                game_link: giveaway.game_link,
                platform: giveaway.platform,
                image_url: giveaway.image_url,
                winners_count: giveaway.winners_count,
                note: giveaway.note,
                req_role_id: giveaway.req_role_id,
                message_req_type: giveaway.message_req_type,
                message_req_amount: giveaway.message_req_amount,
                ends_at: giveaway.ends_at,
                participants: giveaway.participants || [],
                winners: giveaway.winners || [],
                participants_count: (giveaway.participants || []).length,
                is_active: giveaway.is_active,
                is_ended: giveaway.is_ended,
                host_name: giveaway.host_name,
                host_id: giveaway.host_id,
                embed_color: giveaway.embed_color,
                created_at: giveaway.created_at
            }
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching giveaway:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /capi/giveaway/create - Create a new community giveaway
 */
router.post('/giveaway/create', async (req, res) => {
    try {
        const {
            game_name,
            duration,
            platform,
            image,
            winners,
            game_link,
            note,
            reqrole,
            message_requirement_type,
            message_requirement_amount,
            color,
            host_id,
            host_name,
            guild_id
        } = req.body;

        // Validation
        if (!game_name) {
            return res.status(400).json({ success: false, error: 'game_name is required' });
        }
        if (!duration) {
            return res.status(400).json({ success: false, error: 'duration is required' });
        }
        if (!platform) {
            return res.status(400).json({ success: false, error: 'platform is required' });
        }
        if (!image) {
            return res.status(400).json({ success: false, error: 'image URL is required' });
        }
        if (!winners || winners < 1 || winners > 25) {
            return res.status(400).json({ success: false, error: 'winners must be between 1 and 25' });
        }

        if ((message_requirement_type && !message_requirement_amount) || 
            (!message_requirement_type && message_requirement_amount)) {
            return res.status(400).json({ 
                success: false, 
                error: 'You must provide both requirement type and amount, or leave both empty' 
            });
        }

        if (!botClient) {
            return res.status(503).json({ success: false, error: 'Bot is not ready' });
        }

        // Parse duration (simple version - can be enhanced)
        const durationMs = parseDuration(duration);
        if (!durationMs) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid duration! Use formats like: 2d, 1h 30m, 3d 12h' 
            });
        }

        const endsAt = new Date(Date.now() + durationMs);
        const giveawayCode = generateGiveawayCode();
        const embedColor = parseColor(color);

        // Get guild and channel
        const guild = await botClient.guilds.fetch(guild_id);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const channel = await guild.channels.fetch(GIVEAWAY_CHANNEL_ID);
        if (!channel) {
            return res.status(404).json({ success: false, error: 'Giveaway channel not found' });
        }

        // Get host info
        let finalHostId = host_id;
        let finalHostName = host_name;
        let hostAvatar = null;

        if (!finalHostId) {
            return res.status(400).json({ success: false, error: 'host_id is required' });
        }

        try {
            const user = await botClient.users.fetch(finalHostId);
            finalHostName = user.username;
            hostAvatar = user.displayAvatarURL({ dynamic: true });
        } catch (e) {
            if (!finalHostName) finalHostName = finalHostId;
        }

        // Create message
        const messageData = createGiveawayMessage(
            game_name, game_link, platform, endsAt, winners, note, reqrole,
            image, giveawayCode, finalHostId, finalHostName, hostAvatar, 0,
            message_requirement_type, message_requirement_amount, embedColor
        );

        const message = await channel.send(messageData);

        // Save to database
        const result = await dbManager.createCommunityGiveaway({
            giveawayCode,
            gameName: game_name,
            gameLink: game_link || null,
            platform,
            imageUrl: image,
            winnersCount: winners,
            note: note || null,
            reqRoleId: reqrole || null,
            messageReqType: message_requirement_type || null,
            messageReqAmount: message_requirement_amount || null,
            endsAt: endsAt.toISOString(),
            hostId: finalHostId,
            hostName: finalHostName,
            guildId: guild_id,
            messageId: message.id,
            channelId: channel.id,
            embedColor: embedColor.toString()
        });

        if (!result.success) {
            await message.delete().catch(() => {});
            return res.status(500).json({ success: false, error: result.error });
        }

        // Send to log channel
        try {
            const logChannel = await guild.channels.fetch(GIVEAWAY_LOG_CHANNEL_ID);
            if (logChannel) {
                const titleText = getGameTitle(game_name, game_link);
                const messageLink = `https://discord.com/channels/${guild_id}/${channel.id}/${message.id}`;

                const logEmbed = {
                    color: embedColor,
                    description: `### ${titleText} | ${platform}\n\n` +
                        `**[Jump to Giveaway](${messageLink})** | **Channel:** ${channel}\n` +
                        `${winners} Winners | **End:** <t:${Math.floor(endsAt.getTime() / 1000)}:F>\n`,
                    footer: {
                        text: `Created by: ${finalHostName} | ID: ${giveawayCode}`,
                        icon_url: hostAvatar
                    }
                };

                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (e) {
            console.warn('Could not send to log channel:', e.message);
        }

        console.log(`✅ CAPI: Created community giveaway ${giveawayCode} in ${guild.name}`);

        res.json({
            success: true,
            message: 'Giveaway created successfully!',
            code: giveawayCode,
            channel: `#${channel.name}`,
            messageId: message.id
        });

    } catch (error) {
        console.error('❌ CAPI Create Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /capi/giveaway/end - End a community giveaway
 */
router.post('/giveaway/end', async (req, res) => {
    try {
        const { code, guildId, userId } = req.body;

        if (!code || !guildId) {
            return res.status(400).json({ success: false, error: 'code and guildId are required' });
        }

        const giveaway = await dbManager.getActiveCommunityGiveawayByCode(code);
        if (!giveaway) {
            return res.status(404).json({ success: false, error: 'Giveaway not found' });
        }

        const result = await dbManager.endCommunityGiveaway(code);

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        // Update the message in Discord
        if (botClient && giveaway.channel_id && giveaway.message_id) {
            try {
                const guild = await botClient.guilds.fetch(guildId);
                const channel = await guild.channels.fetch(giveaway.channel_id);
                const message = await channel.messages.fetch(giveaway.message_id);

                if (message) {
                    let winnersFieldValue = '';
                    if (result.winners && result.winners.length > 0) {
                        winnersFieldValue = result.winners.map(id => `<@${id}>`).join(', ');
                    } else {
                        winnersFieldValue = 'No winners';
                    }

                    const endedEmbed = {
                        color: giveaway.embed_color ? parseInt(giveaway.embed_color) : DEFAULT_COLOR,
                        description: buildDescription(
                            giveaway.game_name, giveaway.game_link, giveaway.platform,
                            giveaway.note, giveaway.req_role_id,
                            giveaway.message_req_type, giveaway.message_req_amount
                        ),
                        fields: [
                            { name: 'Status', value: 'Ended', inline: true },
                            { name: 'Participants', value: `${result.participantsCount || 0}`, inline: true },
                            { name: 'Winners', value: winnersFieldValue, inline: false }
                        ],
                        footer: {
                            text: `${giveaway.host_name} | ID: ${code}`,
                            icon_url: null
                        }
                    };

                    if (giveaway.image_url) {
                        endedEmbed.image = { url: giveaway.image_url };
                    }

                    await message.edit({ embeds: [endedEmbed], components: [] });
                }
            } catch (e) {
                console.warn('Could not update ended message:', e.message);
            }
        }

        res.json({ success: true, message: 'Giveaway ended successfully', winners: result.winners });

    } catch (error) {
        console.error('❌ CAPI End Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 2. LEVELS & USER PROFILE ENDPOINTS
// ============================================================

/**
 * GET /capi/user/profile - Get user profile (XP, Coins, Crystals, Level)
 */
router.get('/user/profile', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const profile = await dbManager.getUserProfile(userId);

        if (!profile) {
            return res.json({
                success: true,
                profile: null,
                message: 'User not found in database'
            });
        }

        res.json({
            success: true,
            profile: {
                user_id: profile.user_id,
                username: profile.username,
                xp: profile.xp || 0,
                level: profile.level || 0,
                sky_coins: profile.sky_coins || 0,
                sky_crystals: profile.sky_crystals || 0,
                daily_streak: profile.daily_streak || 0,
                weekly_streak: profile.weekly_streak || 0,
                wallpaper_url: profile.wallpaper_url,
                created_at: profile.created_at,
                updated_at: profile.updated_at
            }
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching user profile:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /capi/leaderboard/levels - Get XP/Level leaderboard
 */
router.get('/leaderboard/levels', async (req, res) => {
    try {
        const { limit = 20, sortBy = 'xp' } = req.query;

        let orderBy = 'xp DESC';
        if (sortBy === 'level') orderBy = 'level DESC, xp DESC';
        if (sortBy === 'coins') orderBy = 'sky_coins DESC';

        const leaderboard = await dbManager.all(
            `SELECT user_id, username, xp, level, sky_coins, sky_crystals 
             FROM levels 
             ORDER BY ${orderBy} 
             LIMIT ?`,
            [parseInt(limit)]
        );

        res.json({
            success: true,
            leaderboard,
            sortBy,
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching level leaderboard:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 3. MESSAGE STATS ENDPOINTS
// ============================================================

/**
 * GET /capi/user/messages - Get user message stats
 */
router.get('/user/messages', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const stats = await dbManager.getUserMessageStats(userId);

        if (!stats) {
            return res.json({
                success: true,
                stats: null,
                message: 'User not found in message stats'
            });
        }

        res.json({
            success: true,
            stats: {
                total: stats.total || 0,
                sent: stats.sent || 0,
                deleted: stats.deleted || 0,
                daily: stats.daily_total || 0,
                weekly: stats.weekly_total || 0,
                monthly: stats.monthly_total || 0
            }
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching message stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /capi/leaderboard/messages - Get message leaderboard
 */
router.get('/leaderboard/messages', async (req, res) => {
    try {
        const { period = 'total', limit = 20 } = req.query;

        let orderBy = 'total DESC';
        let field = 'total';

        if (period === 'daily') {
            orderBy = 'daily_total DESC';
            field = 'daily_total';
        } else if (period === 'weekly') {
            orderBy = 'weekly_total DESC';
            field = 'weekly_total';
        } else if (period === 'monthly') {
            orderBy = 'monthly_total DESC';
            field = 'monthly_total';
        }

        const leaderboard = await dbManager.all(
            `SELECT user_id, username, 
                    ${field} as message_count,
                    sent, deleted
             FROM message_stats 
             ORDER BY ${orderBy} 
             LIMIT ?`,
            [parseInt(limit)]
        );

        res.json({
            success: true,
            leaderboard,
            period,
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching message leaderboard:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 4. INVITES ENDPOINTS
// ============================================================

/**
 * GET /capi/user/invites - Get user invite stats
 */
router.get('/user/invites', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const stats = await dbManager.getInviterStats(userId);

        res.json({
            success: true,
            stats: {
                total: stats.total || 0,
                verified: stats.verified || 0,
                unverified: stats.unverified || 0,
                left: stats.left || 0
            }
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching invite stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /capi/leaderboard/invites - Get invite leaderboard
 */
router.get('/leaderboard/invites', async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const leaderboard = await dbManager.getTopInviters(parseInt(limit));

        res.json({
            success: true,
            leaderboard: leaderboard.map(inviter => ({
                user_id: inviter.user_id,
                username: inviter.username,
                total: inviter.total || 0,
                verified: inviter.verified || 0,
                unverified: inviter.unverified || 0,
                left: inviter.left_count || 0
            })),
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching invite leaderboard:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 5. STEAM VERIFICATION ENDPOINTS
// ============================================================

/**
 * GET /capi/user/steam-verify - Check if user is Steam verified
 */
router.get('/user/steam-verify', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const verification = await dbManager.get(
            'SELECT * FROM discord_verify_steam WHERE discord_id = ?',
            [userId]
        );

        res.json({
            success: true,
            verified: verification && verification.status === 'verified',
            data: verification ? {
                steam_id: verification.steam_id,
                steam_name: verification.steam_name,
                steam_profile_url: verification.steam_profile_url,
                verified_at: verification.verified_at,
                status: verification.status
            } : null
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching steam verification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 6. SUPPORT TICKETS ENDPOINTS
// ============================================================

/**
 * GET /capi/user/tickets - Get user's support tickets
 */
router.get('/user/tickets', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const tickets = await dbManager.all(
            `SELECT * FROM support_tickets 
             WHERE user_id = ? 
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            tickets: tickets.map(t => ({
                id: t.id,
                ticket_type: t.ticket_type,
                thread_id: t.thread_id,
                status: t.status,
                close_reason: t.close_reason,
                created_at: t.created_at,
                closed_at: t.closed_at
            })),
            count: tickets.length
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching tickets:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /capi/tickets/open - Get all open tickets (admin)
 */
router.get('/tickets/open', async (req, res) => {
    try {
        const tickets = await dbManager.all(
            `SELECT * FROM support_tickets 
             WHERE status = 'open' 
             ORDER BY created_at ASC`
        );

        res.json({
            success: true,
            tickets: tickets.map(t => ({
                id: t.id,
                user_id: t.user_id,
                username: t.username,
                ticket_type: t.ticket_type,
                thread_id: t.thread_id,
                created_at: t.created_at
            })),
            count: tickets.length
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching open tickets:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 7. DROPS ENDPOINTS
// ============================================================

/**
 * GET /capi/user/drops - Get user drop progress
 */
router.get('/user/drops', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const progress = await dbManager.getUserDropProgress(userId);

        if (!progress) {
            return res.json({
                success: true,
                progress: null,
                message: 'User not found in drop system'
            });
        }

        res.json({
            success: true,
            progress: {
                total_messages: progress.total_messages || 0,
                common: {
                    target: progress.common_target || 0,
                    received: progress.total_common_received || 0,
                    last_at: progress.last_common_at || 0
                },
                rare: {
                    target: progress.rare_target || 0,
                    received: progress.total_rare_received || 0,
                    last_at: progress.last_rare_at || 0
                },
                epic: {
                    target: progress.epic_target || 0,
                    received: progress.total_epic_received || 0,
                    last_at: progress.last_epic_at || 0
                },
                legendary: {
                    target: progress.legendary_target || 0,
                    received: progress.total_legendary_received || 0,
                    last_at: progress.last_legendary_at || 0
                }
            }
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching drop progress:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /capi/user/crates - Get user's crates
 */
router.get('/user/crates', async (req, res) => {
    try {
        const { userId, unusedOnly = 'true' } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const result = await dbManager.getUserCrates(userId, {
            unusedOnly: unusedOnly === 'true',
            limit: 100
        });

        res.json({
            success: true,
            crates: result.crates.map(c => ({
                id: c.id,
                crate_type: c.crate_type,
                reward_type: c.reward_type,
                coins_amount: c.coins_amount || 0,
                xp_amount: c.xp_amount || 0,
                crystals_amount: c.crystals_amount || 0,
                buff_type: c.buff_type,
                buff_duration_minutes: c.buff_duration_minutes,
                created_at: c.created_at
            })),
            stats: result.stats
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching crates:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /capi/leaderboard/drops - Get drop leaderboard
 */
router.get('/leaderboard/drops', async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const leaderboard = await dbManager.getTopDropUsers(parseInt(limit));

        res.json({
            success: true,
            leaderboard: leaderboard.map(u => ({
                user_id: u.user_id,
                username: u.username,
                total_messages: u.total_messages || 0,
                total_drops: u.total_drops || 0,
                common: u.total_common_received || 0,
                rare: u.total_rare_received || 0,
                epic: u.total_epic_received || 0,
                legendary: u.total_legendary_received || 0
            })),
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching drop leaderboard:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 8. STEAM PUBLISHER GAMES ENDPOINTS
// ============================================================

/**
 * GET /capi/steam/games - Get all Steam publisher games
 */
router.get('/steam/games', async (req, res) => {
    try {
        const { announced, comingSoon, discounted } = req.query;

        let games;

        if (announced === 'false') {
            games = await dbManager.getUngamedSteamGames();
        } else if (comingSoon === 'true') {
            games = await dbManager.getReleasedSteamGames();
            games = games.filter(g => g.coming_soon === true);
        } else if (discounted === 'true') {
            games = await dbManager.getDiscountedSteamGames();
        } else {
            games = await dbManager.getAllSteamGames();
        }

        res.json({
            success: true,
            games: games.map(g => ({
                appid: g.appid,
                name: g.name,
                release_date: g.release_date,
                header_image: g.header_image,
                announced: g.announced,
                coming_soon: g.coming_soon,
                initial_price: g.initial_price,
                current_price: g.current_price,
                discount_percent: g.discount_percent,
                current_version: g.current_version,
                review_text: g.review_text || '',   // ✅ صحيح
                review_count: g.review_count || 0,  // ✅ صحيح
                genre: g.genre || '',
                about: g.about || '',  // ✅ صحيح
                first_seen: g.first_seen,
                last_checked: g.last_checked
            })),
            count: games.length
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching steam games:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /capi/steam/sales - Get live sales
 */
router.get('/steam/sales', async (req, res) => {
    try {
        const sales = await dbManager.getSteamLiveSales();

        // Get game details for each sale
        const salesWithDetails = [];
        for (const sale of sales) {
            const game = await dbManager.getSteamGame(sale.appid);
            if (game) {
                salesWithDetails.push({
                    appid: sale.appid,
                    name: game.name,
                    header_image: game.header_image,
                    discount_percent: sale.discount_percent,
                    initial_price: sale.initial_price,
                    current_price: sale.current_price,
                    sale_ends_at: sale.sale_ends_at,
                    message_id: sale.message_id,
                    channel_id: sale.channel_id,
                    review_text: game.review_text || '',
                    review_count: game.review_count || 0,
                    genre: game.genre || '',
                    about: game.about || ''
                });
            }
        }

        res.json({
            success: true,
            sales: salesWithDetails,
            count: salesWithDetails.length
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching steam sales:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===================GET /capi/hero/active-event
router.get('/hero/active-event', async (req, res) => {
    try {
        const event = await dbManager.getActiveSteamEvent();
        if (!event) {
            return res.json({ success: false, error: 'No active event' });
        }
        res.json({ success: true, data: event });
    } catch (error) {
        console.error('❌ Error fetching active event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /capi/humble/active
router.get('/humble/active', async (req, res) => {
    try {
        const choice = await dbManager.getActiveHumbleChoice();
        if (!choice) {
            return res.json({ success: false, error: 'No active Humble Choice' });
        }
        res.json({ success: true, data: choice });
    } catch (error) {
        console.error('❌ Error fetching active Humble Choice:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 10. ROLES ENDPOINT
// ============================================================

/**
 * GET /capi/roles - Get all roles from guild
 */
router.get('/roles', async (req, res) => {
    try {
        const { guildId } = req.query;

        if (!guildId) {
            return res.status(400).json({ success: false, error: 'guildId is required' });
        }

        if (!botClient) {
            return res.status(503).json({ success: false, error: 'Bot is not ready' });
        }

        const guild = await botClient.guilds.fetch(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const roles = await guild.roles.fetch();
        const roleList = [...roles.values()]
            .filter(r => r.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => ({
                id: r.id,
                name: r.name,
                color: r.hexColor
            }));

        res.json({ success: true, roles: roleList });

    } catch (error) {
        console.error('❌ CAPI Error fetching roles:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// Helper: Parse Duration
// ============================================================

function parseDuration(durationStr) {
    if (!durationStr) return null;
    let ms = 0;
    const regex = /(\d+)\s*(d|h|m|s)/gi;
    let match;
    while ((match = regex.exec(durationStr))) {
        const val = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        if (unit === 'd') ms += val * 86400000;
        else if (unit === 'h') ms += val * 3600000;
        else if (unit === 'm') ms += val * 60000;
        else if (unit === 's') ms += val * 1000;
    }
    return ms || null;
}

// ============================================================
// 11. INVITED MEMBERS ENDPOINT (جلب اللي دخلوا عن طريق الشخص)
// ============================================================

router.get('/user/invited-members', async (req, res) => {
    try {
        const { userId, limit = 10 } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        if (!botClient) {
            return res.status(503).json({ success: false, error: 'Bot is not ready' });
        }

        // 1. جلب أول سيرفر موجود في البوت (أو اللي فيه العضو)
        let guild = null;
        for (const [id, g] of botClient.guilds.cache) {
            guild = g;
            break;
        }

        if (!guild) {
            return res.status(404).json({ success: false, error: 'No guilds found' });
        }

        const guildId = guild.id;

        // 2. جلب IDs الأعضاء من قاعدة البيانات
        const members = await dbManager.all(
            `SELECT member_id, last_join_date 
             FROM member_join_history 
             WHERE inviter_id = $1 
             ORDER BY last_join_date DESC 
             LIMIT $2`,
            [userId, parseInt(limit)]
        );

        if (!members.length) {
            return res.json({ success: true, members: [], count: 0 });
        }

        // 3. جلب بيانات كل عضو من Discord
        const membersWithDetails = [];
        for (const member of members) {
            try {
                const guildMember = await guild.members.fetch(member.member_id);
                const user = guildMember.user;

                const verification = await dbManager.get(
                    `SELECT is_verified FROM member_verification_status WHERE member_id = $1`,
                    [member.member_id]
                );

                membersWithDetails.push({
                    member_id: member.member_id,
                    username: user.username,
                    avatar: user.displayAvatarURL({ dynamic: true, size: 32 }),
                    is_verified: verification?.is_verified === true,
                    join_date: member.last_join_date
                });
            } catch (err) {
                console.warn(`Member ${member.member_id} not found`);
            }
        }

        res.json({
            success: true,
            members: membersWithDetails,
            count: membersWithDetails.length
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/user/limits', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        // جلب البيانات من الداتابيز
        const userData = await dbManager.get(
            `SELECT 
                xp_earned_today,
                coins_earned_today
            FROM levels WHERE user_id = ?`,
            [userId]
        );

        // جلب التذاكر المفتوحة
        const tickets = await dbManager.get(
            `SELECT COUNT(*) as count FROM support_tickets WHERE user_id = ? AND status = 'open'`,
            [userId]
        );

        // جلب الجيفاواي النشطة
        const giveaways = await dbManager.get(
            `SELECT COUNT(*) as count FROM community_giveaways WHERE host_id = ? AND is_active = true AND is_ended = false`,
            [userId]
        );

        res.json({
            success: true,
            daily_coins: userData?.coins_earned_today || 0,    // دايركت من الصف
            daily_xp: userData?.xp_earned_today || 0,          // دايركت من الصف
            tickets_available: 2 - (tickets?.count || 0),
            giveaways_available: 2 - (giveaways?.count || 0)
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// Wishlist from Google Sheets
// ============================================================

const { google } = require('googleapis');

// إعداد الاتصال بجوجل شيت
const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID = process.env.WISHLIST_SHEET; // ضيف ID الشيت في .env

router.get('/wishlist/google', async (req, res) => {
    try {
        const sheetsService = google.sheets({ version: 'v4', auth });

        const response = await sheetsService.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'A3:A', // الأسماء من الصف 3 تحت
        });

        const rows = response.data.values || [];
        const users = rows.filter(row => row[0] && row[0].trim() !== '').map(row => row[0].trim());

        res.json({
            success: true,
            users: users,
            count: users.length
        });

    } catch (error) {
        console.error('Error fetching wishlist from Google Sheets:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// Wishlist Avatars with Cache
// ============================================================

let avatarCache = {
    data: null,
    timestamp: null,
    usersHash: null
};
const CACHE_DURATION = 3600000; // 1 ساعة

// دالة لعمل hash للمستخدمين عشان نعرف لو اتغيروا
function getUsersHash(users) {
    return users.join(',');
}

router.get('/wishlist/avatars', async (req, res) => {
    try {
        // 1. جلب الـ wishlist من Google Sheets
        const sheetsService = google.sheets({ version: 'v4', auth });

        const response = await sheetsService.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'A3:A',
        });

        const rows = response.data.values || [];
        const users = rows.filter(row => row[0] && row[0].trim() !== '').map(row => row[0].trim());

        const currentUsersHash = getUsersHash(users);

        // 2. لو في cache وصالح، ارجعه
        if (avatarCache.data && 
            avatarCache.timestamp && 
            (Date.now() - avatarCache.timestamp) < CACHE_DURATION &&
            avatarCache.usersHash === currentUsersHash) {

            console.log('✅ Returning cached wishlist avatars');
            return res.json({
                success: true,
                users: avatarCache.data.users,
                avatars: avatarCache.data.avatars,
                count: avatarCache.data.users.length,
                cached: true
            });
        }

        // 3. جلب السيرفر
        const guild = botClient.guilds.cache.first();
        if (!guild) {
            return res.status(404).json({ success: false, error: 'No guild found' });
        }

        // 4. جلب كل الأعضاء (مرة واحدة لكل request)
        // لو السيرفر كبير، ممكن نحسنها بجلب الـ wishlist members بس
        const members = await guild.members.fetch();

        const avatars = {};
        for (const username of users) {
            const member = members.find(m => m.user.username.toLowerCase() === username.toLowerCase());
            if (member) {
                avatars[username] = member.user.displayAvatarURL({ dynamic: true, size: 64 });
            } else {
                // Avatar افتراضي حسب أول حرف من الاسم
                const defaultIndex = username.charCodeAt(0) % 5;
                avatars[username] = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
            }
        }

        // 5. تخزين في cache
        avatarCache = {
            data: {
                users: users,
                avatars: avatars
            },
            timestamp: Date.now(),
            usersHash: currentUsersHash
        };

        console.log(`✅ Fetched fresh wishlist avatars for ${users.length} users`);

        res.json({
            success: true,
            users: users,
            avatars: avatars,
            count: users.length,
            cached: false
        });

    } catch (error) {
        console.error('❌ Error fetching wishlist avatars:', error);

        // لو في cache قديم، ارجعه كحل احتياطي
        if (avatarCache.data) {
            return res.json({
                success: true,
                users: avatarCache.data.users,
                avatars: avatarCache.data.avatars,
                count: avatarCache.data.users.length,
                cached: true,
                warning: 'Using cached data due to error'
            });
        }

        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// GET /capi/user/hosted-giveaways - عدد الجيفاواي اللي استضافها الشخص
// ============================================================

router.get('/user/hosted-giveaways', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        // جلب عدد الـ Community Giveaways اللي الشخص عملها
        const result = await dbManager.get(
            `SELECT COUNT(*) as count FROM community_giveaways WHERE host_id = ? AND is_active = false AND is_ended = true`,
            [userId]
        );

        res.json({
            success: true,
            hosted_count: result?.count || 0
        });

    } catch (error) {
        console.error('❌ Error fetching hosted giveaways:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// GET /capi/user/skywell - Get user skywell stats
// ============================================================

router.get('/user/skywell', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        // جلب بيانات Skywell للمستخدم
        const skywellStats = await dbManager.getSkywellStats(userId);

        if (!skywellStats) {
            return res.json({
                success: true,
                stats: null,
                message: 'User not found in skywell system'
            });
        }

        // حساب إجمالي المرمي (عملات + كريستالات محولة)
        const totalThrown = (skywellStats.total_coins_thrown || 0) + (skywellStats.total_converted_coins || 0);

        res.json({
            success: true,
            stats: {
                user_id: skywellStats.user_id,
                username: skywellStats.username,
                level: skywellStats.current_level || 0,           // Wish LVL
                total_thrown: totalThrown,                        // Wish Amount (الإجمالي)
                total_coins_thrown: skywellStats.total_coins_thrown || 0,
                total_crystals_thrown: skywellStats.total_crystals_thrown || 0,
                total_converted_coins: skywellStats.total_converted_coins || 0,
                throw_count: skywellStats.throw_count || 0,
                highest_single_throw: skywellStats.highest_single_throw || 0,
                next_level_coins: skywellStats.nextLevelCoins || 0,
                progress: skywellStats.progress || 0
            }
        });

    } catch (error) {
        console.error('❌ CAPI Error fetching skywell stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================================
// Export
// ============================================================
module.exports = { router, initCAPI };