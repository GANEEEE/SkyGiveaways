// System/GiveawaysBack.js

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
        return await fn(); // محاولة أخيرة
      }
      throw err;
    }
  }
}

const rl = new SimpleRateLimiter();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ============================================================

async function restoreActiveGiveaways(client) {
    try {
        console.log('🔄 Restoring active giveaways...');
        await endExpiredGiveaways(client);
        await restoreActiveOnes(client);
        console.log('✅ Giveaway restoration complete');
    } catch (error) {
        console.error('❌ Error in giveaway restoration:', error);
    }
}

// ============================================================
async function endExpiredGiveaways(client) {
    try {
        const expiredGiveaways = await dbManager.getExpiredActiveGiveaways();
        if (expiredGiveaways.length === 0) return;

        console.log(`⏰ Found ${expiredGiveaways.length} expired giveaways to end...`);

        for (const giveaway of expiredGiveaways) {
            try {
                // كل fetch يمر بالـ rate limiter
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

                const giveawayCommand = client.commands.get('giveaway');
                if (!giveawayCommand) continue;

                console.log(`⏰ Ending expired giveaway: ${giveaway.giveaway_code}`);

                const result = await dbManager.endGiveaway(giveaway.giveaway_code);
                if (!result.success) continue;

                if (result.noParticipants) {
                    const endedMessage = giveawayCommand.createEndedGiveawayMessage(
                        giveaway.game_name, giveaway.game_link, giveaway.platform,
                        giveaway.image_url, giveaway.note, giveaway.host_id,
                        0, giveaway.winners_count, giveaway.giveaway_code,
                        giveaway.message_req_type, giveaway.message_req_amount,
                        0, 0, [], []
                    );
                    await rl.run(
                        () => message.edit(endedMessage),
                        `edit_no_participants_${giveaway.giveaway_code}`
                    );
                } else {
                    // منح الرول — كل winner لوحده بـ throttle
                    for (const winnerId of result.winners) {
                        try {
                            const member = await rl.run(
                                () => message.guild.members.fetch(winnerId).catch(() => null),
                                `fetch_winner_${winnerId}`
                            );
                            if (!member) continue;

                            await rl.run(
                                () => member.roles.add('1395730680926965781'),
                                `add_role_${winnerId}`
                            );
                        } catch (roleError) {
                            console.error(`Error giving winner role to ${winnerId}:`, roleError.message);
                        }
                    }

                    const endedMessage = giveawayCommand.createEndedGiveawayMessage(
                        giveaway.game_name, giveaway.game_link, giveaway.platform,
                        giveaway.image_url, giveaway.note, giveaway.host_id,
                        result.participantsCount || 0, result.winners.length,
                        giveaway.giveaway_code, giveaway.message_req_type,
                        giveaway.message_req_amount, 0, 0, result.winners, []
                    );
                    await rl.run(
                        () => message.edit(endedMessage),
                        `edit_ended_${giveaway.giveaway_code}`
                    );
                }

                console.log(`✅ Ended expired giveaway: ${giveaway.giveaway_code}`);

                // delay بين كل giveaway كاملة
                await sleep(500);

            } catch (error) {
                console.error(`❌ Error ending giveaway ${giveaway.giveaway_code}:`, error.message);
            }
        }

    } catch (error) {
        console.error('❌ Error in endExpiredGiveaways:', error);
    }
}

// ============================================================
async function restoreActiveOnes(client) {
    try {
        const activeGiveaways = await dbManager.getActiveGiveawaysForRestore();
        if (activeGiveaways.length === 0) return;

        console.log(`📦 Found ${activeGiveaways.length} active giveaways to restore`);

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

                const giveawayCommand = client.commands.get('giveaway');
                if (!giveawayCommand) continue;

                const participantsCount = giveaway.participants?.length || 0;

                if (giveawayCommand.updateGiveawayMessage) {
                    const updatedMessage = giveawayCommand.updateGiveawayMessage(
                        giveaway.game_name, giveaway.game_link, giveaway.platform,
                        endsAt, giveaway.winners_count, giveaway.note,
                        giveaway.req_role_id, giveaway.image_url, giveaway.giveaway_code,
                        giveaway.host_id, participantsCount,
                        giveaway.message_req_type, giveaway.message_req_amount
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
                    hostUsername: giveaway.host_name,
                    messageReqType: giveaway.message_req_type,
                    messageReqAmount: giveaway.message_req_amount
                };

                // الـ collectors مش بيبعتوا API requests وقت setup — آمنين
                giveawayCommand.setupJoinCollector?.(
                    message, giveaway.giveaway_code, endsAt,
                    giveaway.winners_count, client, giveawayData
                );
                giveawayCommand.setupConfirmCollector?.(
                    message, giveaway.giveaway_code, client
                );

                console.log(`✅ Restored giveaway: ${giveaway.giveaway_code} (${participantsCount} participants)`);

                // delay بين كل giveaway
                await sleep(300);

            } catch (error) {
                console.error(`❌ Error restoring giveaway ${giveaway.giveaway_code}:`, error.message);
            }
        }

    } catch (error) {
        console.error('❌ Error in restoreActiveOnes:', error);
    }
}

module.exports = restoreActiveGiveaways;