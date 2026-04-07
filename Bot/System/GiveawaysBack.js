// System/GiveawaysBack.js

const dbManager = require('../Data/database');

// ============================================================
// Rate Limiter
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Constants
const WINNER_ROLE_ID = '1395730680926965781';

// ============================================================

async function restoreActiveGiveaways(client) {
    try {
        console.log('🔄 Restoring active giveaways...');
        await endExpiredGiveaways(client);
        await restoreActiveOnes(client);

        // 🆕 استعادة الجيفاواي المجدولة
        const giveawayCommand = client.commands.get('giveaway');
        if (giveawayCommand && giveawayCommand.restoreScheduledGiveaways) {
            await giveawayCommand.restoreScheduledGiveaways(client);
        }

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

                // بناء الـ config من بيانات الجيفاواي
                const config = {
                    winnersCount: giveaway.winners_count,
                    host: { id: giveaway.host_id },
                    imageUrl: giveaway.image_url,
                    entryType: giveaway.entry_type,
                    entryValues: giveaway.entry_values ? JSON.parse(giveaway.entry_values) : null,
                    multiplier: giveaway.multiplier ? JSON.parse(giveaway.multiplier) : null,
                    reqRole: giveaway.reqrole ? { id: giveaway.reqrole } : null,
                    banRole: giveaway.banrole ? { id: giveaway.banrole } : null
                };

                if (result.noParticipants) {
                    const endedMessage = giveawayCommand.createEndedGiveawayMessage(
                        config,
                        [],
                        giveaway.giveaway_code,
                        0
                    );
                    await rl.run(
                        () => message.edit(endedMessage),
                        `edit_no_participants_${giveaway.giveaway_code}`
                    );
                } else {
                    const winners = result.winners || [];

                    for (const winnerId of winners) {
                        try {
                            const member = await rl.run(
                                () => message.guild.members.fetch(winnerId).catch(() => null),
                                `fetch_winner_${winnerId}`
                            );
                            if (member) {
                                await rl.run(
                                    () => member.roles.add(WINNER_ROLE_ID),
                                    `add_role_${winnerId}`
                                );
                            }
                        } catch (roleError) {
                            console.error(`Error giving winner role to ${winnerId}:`, roleError.message);
                        }
                    }

                    const endedMessage = giveawayCommand.createEndedGiveawayMessage(
                        config,
                        winners,
                        giveaway.giveaway_code,
                        result.participantsCount || 0
                    );
                    await rl.run(
                        () => message.edit(endedMessage),
                        `edit_ended_${giveaway.giveaway_code}`
                    );
                }

                console.log(`✅ Ended expired giveaway: ${giveaway.giveaway_code}`);
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

                const endsAt = new Date(giveaway.end_time);
                if (endsAt.getTime() - Date.now() <= 0) continue;

                const giveawayCommand = client.commands.get('giveaway');
                if (!giveawayCommand) continue;

                const config = {
                    winnersCount: giveaway.winners_count,
                    entryType: giveaway.entry_type,
                    entryValues: giveaway.entry_values ? JSON.parse(giveaway.entry_values) : null,
                    multiplier: giveaway.multiplier ? JSON.parse(giveaway.multiplier) : null,
                    reqRole: giveaway.reqrole ? { id: giveaway.reqrole } : null,
                    banRole: giveaway.banrole ? { id: giveaway.banrole } : null,
                    host: { id: giveaway.host_id },
                    imageUrl: giveaway.image_url,
                    schedule: giveaway.schedule
                };

                const entries = giveaway.entries || {};
                const participantsCount = Object.keys(entries).length;

                const updatedMessage = giveawayCommand.updateGiveawayMessage(
                    config,
                    endsAt,
                    giveaway.giveaway_code,
                    giveaway.host_id,
                    entries
                );

                await rl.run(
                    () => message.edit(updatedMessage),
                    `edit_restore_${giveaway.giveaway_code}`
                );

                if (giveawayCommand.setupJoinCollector) {
                    giveawayCommand.setupJoinCollector(
                        message,
                        giveaway.giveaway_code,
                        endsAt,
                        config,
                        client
                    );
                }

                if (giveawayCommand.setupConfirmCollector) {
                    giveawayCommand.setupConfirmCollector(
                        message,
                        giveaway.giveaway_code,
                        client
                    );
                }

                console.log(`✅ Restored giveaway: ${giveaway.giveaway_code} (${participantsCount} participants)`);
                await sleep(300);

            } catch (error) {
                console.error(`❌ Error restoring giveaway ${giveaway.giveaway_code}:`, error.message);
            }
        }

    } catch (error) {
        console.error('❌ Error in restoreActiveOnes:', error);
    }
}

// ============================================================
module.exports = restoreActiveGiveaways;