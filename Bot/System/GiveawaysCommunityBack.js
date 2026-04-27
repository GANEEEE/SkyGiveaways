// System/CommunityGiveawaysBack.js

const dbManager = require('../Data/database');

// ============================================================
// Rate Limiter خاص بالـ Giveaway Restoration
// ============================================================
class SimpleRateLimiter {
    constructor() {
        this.requests = 0;
        this.windowStart = Date.now();
        this.max = 40;
    }

    async throttle() {
        if (Date.now() - this.windowStart >= 1000) {
            this.requests = 0;
            this.windowStart = Date.now();
        }

        if (this.requests >= this.max) {
            const wait = 1000 - (Date.now() - this.windowStart);
            if (wait > 0) await sleep(wait);
            this.requests = 0;
            this.windowStart = Date.now();
        }

        this.requests++;
    }

    async run(fn, taskName = '') {
        await this.throttle();
        try {
            return await fn();
        } catch (err) {
            if (err.status === 429) {
                const wait = (err.retryAfter ?? 5) * 1000 + 500;
                console.warn(`⚠️ [429] ${taskName} — waiting ${wait}ms`);
                await sleep(wait);
                await this.throttle();
                return await fn();
            }
            throw err;
        }
    }
}

const rl = new SimpleRateLimiter();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Constants
const WINNER_ROLE_ID = '1395730680926965781';
const DEFAULT_COLOR = 0x4bff4b;

// ============================================================

async function restoreActiveGiveaways(client) {
    try {
        console.log('🔄 Restoring active community giveaways...');
        await endExpiredGiveaways(client);
        await restoreActiveOnes(client);
        console.log('✅ Community giveaway restoration complete');
    } catch (error) {
        console.error('❌ Error in community giveaway restoration:', error);
    }
}

// ============================================================
async function endExpiredGiveaways(client) {
    try {
        const expiredGiveaways = await dbManager.getExpiredActiveCommunityGiveaways();
        if (expiredGiveaways.length === 0) return;

        console.log(`⏰ Found ${expiredGiveaways.length} expired community giveaways to end...`);

        for (const giveaway of expiredGiveaways) {
            try {
                const channel = await rl.run(
                    () => client.channels.fetch(giveaway.channel_id).catch(() => null),
                    `fetch_channel_${giveaway.channel_id}`
                );
                if (!channel) continue;

                const message = await rl.run(
                    () => channel.messages.fetch(giveaway.message_id).catch(() => null),
                    `fetch_message_${giveaway.message_id}`
                );
                if (!message) continue;

                const giveawayCommand = client.commands.get('communitygiveaway');
                if (!giveawayCommand) continue;

                console.log(`⏰ Ending expired community giveaway: ${giveaway.giveaway_code}`);

                const result = await dbManager.endCommunityGiveaway(giveaway.giveaway_code);
                if (!result.success) continue;

                const guildMember = await rl.run(
                    () => message.guild.members.fetch(giveaway.host_id).catch(() => null),
                    `fetch_host_${giveaway.host_id}`
                );
                const hostUsername = guildMember?.user?.username || giveaway.host_name || 'Host';
                const hostAvatar = guildMember?.user?.displayAvatarURL({ dynamic: true }) || null;
                const embedColor = giveaway.embed_color ? parseInt(giveaway.embed_color, 10) : DEFAULT_COLOR;

                if (result.noParticipants) {
                    const endedMessage = giveawayCommand.createEndedGiveawayMessage(
                        giveaway.game_name,
                        giveaway.game_link,
                        giveaway.platform,
                        giveaway.image_url,
                        giveaway.note,
                        giveaway.host_id,
                        0,
                        giveaway.winners_count,
                        giveaway.giveaway_code,
                        giveaway.message_req_type,
                        giveaway.message_req_amount,
                        [],
                        hostUsername,
                        hostAvatar,
                        giveaway.req_role_id,
                        embedColor
                    );

                    await rl.run(
                        () => message.edit(endedMessage),
                        `edit_no_participants_${giveaway.giveaway_code}`
                    );

                    const announcementMessage = giveawayCommand.buildWinnersAnnouncementEmbed(
                        giveaway.game_name,
                        giveaway.host_id,
                        0,
                        [],
                        hostUsername,
                        hostAvatar,
                        giveaway.giveaway_code
                    );

                    await rl.run(
                        () => message.channel.send(announcementMessage),
                        `announce_no_participants_${giveaway.giveaway_code}`
                    );
                } else {
                    for (const winnerId of result.winners) {
                        try {
                            const member = await rl.run(
                                () => message.guild.members.fetch(winnerId).catch(() => null),
                                `fetch_winner_${winnerId}`
                            );
                            if (!member) continue;

                            await rl.run(
                                () => member.roles.add(WINNER_ROLE_ID),
                                `add_role_${winnerId}`
                            );
                        } catch (roleError) {
                            console.error(`Error giving winner role to ${winnerId}:`, roleError.message);
                        }
                    }

                    const endedMessage = giveawayCommand.createEndedGiveawayMessage(
                        giveaway.game_name,
                        giveaway.game_link,
                        giveaway.platform,
                        giveaway.image_url,
                        giveaway.note,
                        giveaway.host_id,
                        result.participantsCount || 0,
                        result.winners.length,
                        giveaway.giveaway_code,
                        giveaway.message_req_type,
                        giveaway.message_req_amount,
                        result.winners,
                        hostUsername,
                        hostAvatar,
                        giveaway.req_role_id,
                        embedColor
                    );

                    await rl.run(
                        () => message.edit(endedMessage),
                        `edit_ended_${giveaway.giveaway_code}`
                    );

                    const announcementMessage = giveawayCommand.buildWinnersAnnouncementEmbed(
                        giveaway.game_name,
                        giveaway.host_id,
                        result.participantsCount || 0,
                        result.winners,
                        hostUsername,
                        hostAvatar,
                        giveaway.giveaway_code
                    );

                    await rl.run(
                        () => message.channel.send(announcementMessage),
                        `announce_winners_${giveaway.giveaway_code}`
                    );
                }

                console.log(`✅ Ended expired community giveaway: ${giveaway.giveaway_code}`);
                await sleep(500);

            } catch (error) {
                console.error(`❌ Error ending community giveaway ${giveaway.giveaway_code}:`, error.message);
            }
        }
    } catch (error) {
        console.error('❌ Error in endExpiredGiveaways:', error);
    }
}

// ============================================================
async function restoreActiveOnes(client) {
    try {
        const activeGiveaways = await dbManager.getActiveCommunityGiveawaysForRestore();
        if (activeGiveaways.length === 0) return;

        console.log(`📦 Found ${activeGiveaways.length} active community giveaways to restore`);

        for (const giveaway of activeGiveaways) {
            try {
                const channel = await rl.run(
                    () => client.channels.fetch(giveaway.channel_id).catch(() => null),
                    `fetch_channel_${giveaway.channel_id}`
                );
                if (!channel) continue;

                const message = await rl.run(
                    () => channel.messages.fetch(giveaway.message_id).catch(() => null),
                    `fetch_message_${giveaway.message_id}`
                );
                if (!message) continue;

                const endsAt = new Date(giveaway.ends_at);
                if (endsAt.getTime() - Date.now() <= 0) continue;

                const giveawayCommand = client.commands.get('communitygiveaway');
                if (!giveawayCommand) continue;

                const guildMember = await rl.run(
                    () => message.guild.members.fetch(giveaway.host_id).catch(() => null),
                    `fetch_host_${giveaway.host_id}`
                );
                const hostUsername = guildMember?.user?.username || giveaway.host_name || 'Host';
                const hostAvatar = guildMember?.user?.displayAvatarURL({ dynamic: true }) || null;
                const participantsCount = giveaway.participants?.length || 0;
                const embedColor = giveaway.embed_color ? parseInt(giveaway.embed_color, 10) : DEFAULT_COLOR;

                if (giveawayCommand.updateGiveawayMessage) {
                    const updatedMessage = giveawayCommand.updateGiveawayMessage(
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
                        hostUsername,
                        hostAvatar,
                        participantsCount,
                        giveaway.message_req_type,
                        giveaway.message_req_amount,
                        embedColor
                    );

                    await rl.run(
                        () => message.edit(updatedMessage),
                        `edit_restore_${giveaway.giveaway_code}`
                    );
                }

                const giveawayData = {
                    gameName: giveaway.game_name,
                    gameLink: giveaway.game_link,
                    platform: giveaway.platform,
                    note: giveaway.note,
                    reqRoleId: giveaway.req_role_id,
                    imageUrl: giveaway.image_url,
                    hostId: giveaway.host_id,
                    hostUsername,
                    hostAvatar,
                    messageReqType: giveaway.message_req_type,
                    messageReqAmount: giveaway.message_req_amount,
                    embedColor,
                    winnersCount: giveaway.winners_count
                };

                giveawayCommand.setupJoinCollector?.(
                    message,
                    giveaway.giveaway_code,
                    endsAt,
                    giveaway.winners_count,
                    client,
                    giveawayData
                );

                giveawayCommand.setupConfirmCollector?.(
                    message,
                    giveaway.giveaway_code,
                    client,
                    giveawayCommand
                );

                console.log(`✅ Restored community giveaway: ${giveaway.giveaway_code} (${participantsCount} participants)`);
                await sleep(300);

            } catch (error) {
                console.error(`❌ Error restoring community giveaway ${giveaway.giveaway_code}:`, error.message);
            }
        }
    } catch (error) {
        console.error('❌ Error in restoreActiveOnes:', error);
    }
}

module.exports = restoreActiveGiveaways;
