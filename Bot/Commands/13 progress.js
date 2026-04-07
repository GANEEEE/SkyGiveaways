const {
    SlashCommandBuilder,
    ContainerBuilder,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} = require('discord.js');

const dbManager = require('../Data/database');
const { ActivityRewardsManager, ACTIVITIES } = require('../LevelSystem/activitysystem');

const manager = new ActivityRewardsManager(dbManager);

const cv2  = { flags: MessageFlags.IsComponentsV2 };
const errC = (t, d) =>
    new ContainerBuilder()
        .setAccentColor(0xFF4444)
        .addTextDisplayComponents(tx => tx.setContent(`## ${t}\n${d}`));

// ── Helpers ───────────────────────────────────────────────────────────────────
const gLabel = g =>
    g === 'sky_vanguards'  ? '⚔️ Sky Vanguards'  :
    g === 'aether_raiders' ? '🌌 Aether Raiders' : '❓ Unknown';

function bar(cur, max, len = 8) {
    if (max === -1 || max === 0) return '░'.repeat(len);
    const filled = Math.round(Math.min(cur / max, 1) * len);
    return '█'.repeat(filled) + '░'.repeat(len - filled);
}

function pct(cur, max) {
    if (max <= 0) return '';
    return ` (${Math.round(Math.min(cur / max, 1) * 100)}%)`;
}

function actRow(label, cur, max) {
    if (max === -1) return `${label}\n> \`♾️\` ×${cur} done`;
    const done = cur >= max;
    return `${label}\n> \`${bar(cur, max)}\` **${cur}/${max}**${pct(cur, max)}${done ? ' ✅' : ''}`;
}

function buttonRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('progress_agent')
            .setLabel('Agent File')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('progress_routine')
            .setLabel('Routine Missions')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('progress_limited')
            .setLabel('Limited Missions')
            .setStyle(ButtonStyle.Secondary)
    );
}

// ===== View Builders =====
function buildAgentFile(targetUser, record) {
    const guild       = gLabel(record.guild);
    const tokens      = record.total_sky_tokens ?? 0;
    const streak      = record.quest_streak ?? 0;
    const dailyMsg    = record.daily_messages  ?? 0;
    const weeklyMsg   = record.weekly_messages ?? 0;
    const hasPartner  = !!record.partner_id;
    const accent      = record.guild === 'sky_vanguards' ? 0x5865F2 :
                        record.guild === 'aether_raiders' ? 0x9B59B6 : 0x2B2D31;

    const nextMs     = streak < 7 ? 7 : streak < 14 ? 14 : null;
    const streakLine = nextMs
        ? `🔥 **${streak}** | next milestone: Day **${nextMs}**`
        : `🔥 **${streak}** | 🏆 All milestones reached`;

    return new ContainerBuilder()
        .setAccentColor(accent)
        .addTextDisplayComponents(t => t.setContent(`## Project Horizon | Agent File`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addSectionComponents(s =>
            s.addTextDisplayComponents(t => t.setContent(
                `### 👤 ${targetUser.username}\n` +
                `**${guild}**${hasPartner ? `  |  **🤝 ${record.partner_name}**` : '  |  **🚶 Solo**'}\n\n` +
                `**Sky-Tokens: ${tokens.toLocaleString()} 💠**\n` +
                `-# ${streakLine}`
            ))
            .setThumbnailAccessory(th =>
                th.setDescription(targetUser.username)
                  .setURL(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
            )
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(
            `### 💬 Messages\n` +
            `Today: **${dailyMsg}** msgs` +
            `| Week: **${weeklyMsg}** msgs`
        ))
        .addSeparatorComponents(s => s.setDivider(true))
        .addActionRowComponents(buttonRow());
}

function buildRoutineMissions(record) {
    const accent = record.guild === 'sky_vanguards' ? 0x5865F2 :
                   record.guild === 'aether_raiders' ? 0x9B59B6 : 0x2B2D31;

    // Daily activities
    const dailyRows = [
        actRow('📨 50 Messages',   record.msg_50_claimed            ?? 0, 3),
        actRow('✅ Daily Quest',   record.goals_daily_claimed        ?? 0, 1),
        actRow('❤️ Like + RT',     record.interaction_claimed        ?? 0, 1),
        actRow('📢 Tweet/Reddit',  record.tweet_reddit_post_claimed  ?? 0, 2),
        actRow('🐞 Bug Publisher', record.bug_publisher_claimed      ?? 0, 3),
        actRow('🤖 Bug SkyBots',   record.bug_skybots_claimed        ?? 0, 3),
    ];

    // Guild-exclusive daily
    if (record.guild === 'sky_vanguards')
        dailyRows.push(actRow('🛡️ Helper', record.helper_claimed ?? 0, 2));
    if (record.guild === 'aether_raiders')
        dailyRows.push(actRow('🏆 Steam Achievement', record.steam_achievement_claimed ?? 0, -1));

    // Weekly activities (replaced Top 5 Weekly with Steam Achievements Weekly)
    const weeklyRows = [
        actRow('📨 500 Messages', record.msg_500_claimed ?? 0, 3),
        actRow('🎮 20 Steam Achievements', record.steamachievements_weekly_claimed ?? 0, 1),   // <-- جديد
    ];

    // Count completed for summary
    const dailyDone = [
        (record.msg_50_claimed            ?? 0) >= 3,
        (record.goals_daily_claimed       ?? 0) >= 1,
        (record.interaction_claimed       ?? 0) >= 1,
        (record.tweet_reddit_post_claimed ?? 0) >= 2,
        (record.bug_publisher_claimed     ?? 0) >= 3,
        (record.bug_skybots_claimed       ?? 0) >= 3,
        record.guild === 'sky_vanguards'  ? (record.helper_claimed              ?? 0) >= 2 : null,
        record.guild === 'aether_raiders' ? (record.steam_achievement_claimed   ?? 0) >= 1 : null,
    ].filter(v => v !== null);
    const dailyCompleted = dailyDone.filter(Boolean).length;
    const dailyTotal     = dailyDone.length;

    // Weekly completed count (now with new activity)
    const weeklyCompleted = [
        (record.msg_500_claimed ?? 0) >= 3,
        (record.steamachievements_weekly_claimed ?? 0) >= 1,   // <-- تعديل
    ].filter(Boolean).length;

    return new ContainerBuilder()
        .setAccentColor(accent)
        .addTextDisplayComponents(t => t.setContent(`## Project Horizon | Routine Missions`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(
            `### ☀️ Daily Activities | ${dailyCompleted}/${dailyTotal} done\n` +
            dailyRows.join('\n')
        ))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(
            `### 📆 Weekly Activities | ${weeklyCompleted}/2 done\n` +
            weeklyRows.join('\n')
        ))
        .addSeparatorComponents(s => s.setDivider(true))
        .addActionRowComponents(buttonRow());
}

function buildLimitedMissions(record) {
    const accent = record.guild === 'sky_vanguards' ? 0x5865F2 :
                   record.guild === 'aether_raiders' ? 0x9B59B6 : 0x2B2D31;

    const inviteProgress = record.invite_claimed ?? 0;
    const inviteMax = 40;
    const inviteDone = inviteProgress >= inviteMax;

    const group1Rows = [
        actRow('🤝 Invite', inviteProgress, inviteMax),
        actRow('🏅 100% Achievements',      record.achievements_claimed           ?? 0, 5),
        actRow('🎮 Finish Gamersky Achievements', record.finish_game_claimed          ?? 0, 3),
        actRow('🎁 Community Giveaways',    record.community_giveaways_claimed    ?? 0, 3),
    ];

    const group2Rows = [
        `🔗 Steam Linked\n> ${record.steam_linked ? '`✅ Completed`' : '`❌ Not Done`'}`,
        `🐦 Follow Twitter\n> ${record.follow_twitter ? '`✅ Completed`' : '`❌ Not Done`'}`,
        `📱 Follow Reddit\n> ${record.follow_reddit ? '`✅ Completed`' : '`❌ Not Done`'}`,
        `🎮 Follow Steam\n> ${record.follow_steam ? '`✅ Completed`' : '`❌ Not Done`'}`,
        `🚀 Boost Server\n> ${record.boosted_server ? '`✅ Completed`' : '`❌ Not Done`'}`,
    ];

    const group3Rows = [
        actRow('⭐ Wishlist',        record.wishlist_claimed     ? 1 : 0, 1),
        actRow('📝 Review',          record.review_claimed       ? 1 : 0, 1),
        actRow('💡 Suggestion',      record.suggestion_claimed   ? 1 : 0, 1),
        actRow('🔍 Letter Hunt',     record.letter_hunt_wins      ?? 0, -1),
    ];

    const oneTimeDone = [
        inviteProgress >= inviteMax,
        (record.achievements_claimed ?? 0) >= 5,
        (record.finish_game_claimed ?? 0) >= 3,
        (record.community_giveaways_claimed ?? 0) >= 3,
        record.steam_linked, record.follow_twitter, record.follow_reddit,
        record.follow_steam, record.boosted_server, record.wishlist_claimed,
        record.review_claimed, record.suggestion_claimed,
    ];
    const oneTimeCompleted = oneTimeDone.filter(Boolean).length;
    const oneTimeTotal     = oneTimeDone.length;

    return new ContainerBuilder()
        .setAccentColor(accent)
        .addTextDisplayComponents(t => t.setContent(`## Project Horizon | Limited Missions`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(
            `### 🏅 Limited Missions | ${oneTimeCompleted}/${oneTimeTotal} done`
        ))
        .addTextDisplayComponents(t => t.setContent(group1Rows.join('\n')))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(group2Rows.join('\n')))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(group3Rows.join('\n')))
        .addSeparatorComponents(s => s.setDivider(true))
        .addActionRowComponents(buttonRow());
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
    data: new SlashCommandBuilder()
        .setName('agentfile')
        .setDescription('View your Sky-Token progress for Project Horizon')
        .addUserOption(opt =>
            opt.setName('agent')
                .setDescription('View another member\'s progress')
                .setRequired(false)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const executor    = interaction.user;
            const targetOption = interaction.options.getUser('agent');
            const targetUser = targetOption ?? executor;

            const record = await manager.getUser(targetUser.id);
            if (!record)
                return interaction.editReply({
                    components: [errC(
                        '❌ Not Registered',
                        targetUser.id === executor.id
                            ? 'You haven\'t signed up yet. Use `/signup` to join **Project Horizon**!'
                            : `**${targetUser.username}** hasn't signed up yet.`
                    )],
                    ...cv2
                });

            const initialContainer = buildAgentFile(targetUser, record);
            const message = await interaction.editReply({
                components: [initialContainer],
                ...cv2
            });

            const filter = (i) => i.user.id === executor.id && i.customId.startsWith('progress_');
            const collector = message.createMessageComponentCollector({
                filter,
                time: 180000 // 3 minutes
            });

            collector.on('collect', async (btnInteraction) => {
                await btnInteraction.deferUpdate();

                let newContainer;
                switch (btnInteraction.customId) {
                    case 'progress_agent':
                        newContainer = buildAgentFile(targetUser, record);
                        break;
                    case 'progress_routine':
                        newContainer = buildRoutineMissions(record);
                        break;
                    case 'progress_limited':
                        newContainer = buildLimitedMissions(record);
                        break;
                    default:
                        return;
                }

                await btnInteraction.editReply({
                    components: [newContainer],
                    ...cv2
                });
            });

            collector.on('end', async () => {
                try {
                    const freshMessage = await interaction.channel.messages.fetch(message.id).catch(() => null);
                    if (!freshMessage) return;

                    const currentComponents = freshMessage.components;
                    if (currentComponents.length === 0) return;

                    const disabledRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('progress_agent')
                            .setLabel('Agent File')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('progress_routine')
                            .setLabel('Routine Missions')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('progress_limited')
                            .setLabel('Limited Missions')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );

                    const newComponents = [...currentComponents];
                    newComponents[newComponents.length - 1] = disabledRow;
                    await freshMessage.edit({ components: newComponents }).catch(() => {});
                } catch (e) {
                    if (e.code !== 10008) console.error('Could not disable buttons:', e);
                }
            });

        } catch (err) {
            console.error('❌ /agentfile error:', err);
            await interaction.editReply({
                components: [errC('❌ Unexpected Error', `\`${err.message.substring(0, 500)}\``)],
                ...cv2
            });
        }
    },
};