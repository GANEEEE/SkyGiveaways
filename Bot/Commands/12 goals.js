const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    SectionBuilder, 
    SeparatorBuilder, 
    TextDisplayBuilder,
    MessageFlags 
} = require('discord.js');
const dbManager = require('../Data/database');
const levelSystem = require('../LevelSystem/levelsystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('goals')
        .setDescription('🎯 View your daily and weekly missions')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('View another user\'s goals (optional)')
                .setRequired(false)),

    async execute(interaction) {
        let targetUser = interaction.options.getUser('user');
        const isSelf = !targetUser || targetUser.id === interaction.user.id;

        if (!targetUser) targetUser = interaction.user;

        const userId   = targetUser.id;
        const username = targetUser.username;

        try {
            console.log(`🔍 /goals command for ${username} (${userId}) requested by ${interaction.user.username}`);

            if (isSelf) {
                const generateResult = await dbManager.generateUserGoals(userId, username);

                if (generateResult.error) {
                    console.error('Generate error:', generateResult.error);
                    await interaction.reply({
                        content: '❌ An error occurred while generating goals.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
            }

            const goalsData = await dbManager.getUserGoals(userId);
            console.log('Goals data loaded:', {
                dailyCount: goalsData.daily?.length || 0,
                weeklyExists: !!goalsData.weekly,
                weekly2Exists: !!goalsData.weekly2,
                dailyStreak: goalsData.dailyStreak,
                weeklyStreak: goalsData.weeklyStreak
            });

            if ((!goalsData.daily || goalsData.daily.length === 0) && !goalsData.weekly) {
                const container = new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addTextDisplayComponents((t) =>
                        t.setContent(`### <:Milo_IDK:1416560959475945522> No Goals Found\n-#${username} doesn't have any active goals`)
                    );

                if (isSelf) {
                    container.addTextDisplayComponents((t) =>
                        t.setContent('*Try again in a few seconds, or contact an admin if the issue persists.*')
                    );
                }

                await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                return;
            }

            if (isSelf) {
                await checkAndClaimGoals(userId, goalsData, interaction.guild, interaction.client);

                const updatedGoalsData = await dbManager.getUserGoals(userId);
                if (updatedGoalsData) {
                    goalsData.daily      = updatedGoalsData.daily;
                    goalsData.weekly     = updatedGoalsData.weekly;
                    goalsData.weekly2    = updatedGoalsData.weekly2;
                    goalsData.userStreak = updatedGoalsData.userStreak;
                }
            }

            const goalsContainer = createGoalsContainer(goalsData, targetUser, isSelf);

            await interaction.reply({ components: [goalsContainer], flags: MessageFlags.IsComponentsV2 });

            console.log(`✅ /goals command completed for ${username}`);

        } catch (error) {
            console.error('❌ Error in /goals command:', error);
            await interaction.reply({
                content: '❌ An error occurred while displaying goals. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};

// ========== HELPER FUNCTIONS ==========

async function checkAndClaimGoals(userId, goalsData, guild, client) {
    try {
        console.log(`🔍 Checking claimable goals for ${userId}`);

        const goalTypes = ['daily1', 'daily2', 'daily3'];

        if (goalsData.daily && Array.isArray(goalsData.daily)) {
            for (let i = 0; i < goalsData.daily.length; i++) {
                const goal = goalsData.daily[i];
                if (!goal || !goal.completed || goal.claimed) continue;

                console.log(`🎁 Found completed daily goal: ${goal.title} (${goalTypes[i]})`);
                const result = await claimGoalRewardAndUpdateLevels(userId, goal.rowId, goalTypes[i], guild, client);
                if (result?.success) console.log(`✅ Claimed: ${goal.title}`);
            }
        }

        if (goalsData.weekly?.completed && !goalsData.weekly.claimed) {
            console.log(`🎁 Found completed weekly goal: ${goalsData.weekly.title}`);
            const result = await claimGoalRewardAndUpdateLevels(userId, goalsData.weekly.rowId, 'weekly', guild, client);
            if (result?.success) console.log(`✅ Claimed weekly: ${goalsData.weekly.title}`);
        }

        if (goalsData.weekly2?.completed && !goalsData.weekly2.claimed) {
            console.log(`🎁 Found completed weekly2 goal: ${goalsData.weekly2.title}`);
            const result = await claimGoalRewardAndUpdateLevels(userId, goalsData.weekly2.rowId, 'weekly2', guild, client);
            if (result?.success) console.log(`✅ Claimed weekly2: ${goalsData.weekly2.title}`);
        }

    } catch (error) {
        console.error('Error in checkAndClaimGoals:', error);
    }
}

async function claimGoalRewardAndUpdateLevels(userId, rowId, goalType, guild = null, client = null) {
    try {
        console.log(`💰 Claiming ${goalType} goal ${rowId} for user ${userId}`);

        const userGoals = await dbManager.getUserGoals(userId);

        let targetGoal = null;

        if (goalType === 'daily1' && userGoals.daily?.length > 0) {
            targetGoal = userGoals.daily[0];
        } else if (goalType === 'daily2' && userGoals.daily?.length > 1) {
            targetGoal = userGoals.daily[1];
        } else if (goalType === 'daily3' && userGoals.daily?.length > 2) {
            targetGoal = userGoals.daily[2];
        } else if (goalType === 'weekly') {
            targetGoal = userGoals.weekly;
        } else if (goalType === 'weekly2') {
            targetGoal = userGoals.weekly2;
        }

        if (!targetGoal) {
            console.log(`❌ Goal ${goalType} not found for user ${userId}`);
            return { success: false, error: 'Goal not found', code: 'GOAL_NOT_FOUND' };
        }

        let isCompleted = targetGoal.completed || false;
        const isClaimed = targetGoal.claimed   || false;

        console.log(`📊 Goal status: completed=${isCompleted}, claimed=${isClaimed}`);

        if (!isCompleted) {
            const progress    = targetGoal.progress || 0;
            const requirement = targetGoal.assigned_requirement || 1;

            if (progress >= requirement) {
                console.log(`🎯 Progress reached requirement! Marking as completed...`);

                const updateField = `${goalType}_completed`;
                await dbManager.run(
                    `UPDATE user_goals SET ${updateField} = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
                    [userId]
                );
                isCompleted = true;
            }
        }

        if (!isCompleted) return { success: false, error: 'Goal not completed yet',  code: 'GOAL_NOT_COMPLETED' };
        if (isClaimed)    return { success: false, error: 'Goal already claimed',     code: 'ALREADY_CLAIMED' };

        const claimResult = await dbManager.claimGoalReward(userId, rowId, goalType);

        if (!claimResult?.success) {
            console.log(`❌ Failed to claim ${goalType}:`, claimResult?.error || 'Unknown error');
            return claimResult || { success: false, error: 'Claim failed' };
        }

        const baseReward = {
            xp:       claimResult.rewards?.xp       || 0,
            coins:    claimResult.rewards?.coins     || 0,
            crystals: claimResult.rewards?.crystals  || 0
        };

        let username = 'Unknown';
        if (client) {
            try {
                const user = await client.users.fetch(userId);
                username = user?.username || 'Unknown';
            } catch {
                const userData = await dbManager.getUserProfile(userId);
                username = userData?.username || 'Unknown';
            }
        } else {
            const userData = await dbManager.getUserProfile(userId);
            username = userData?.username || 'Unknown';
        }

        const levelSystemResult = await levelSystem.processUserRewards(
            userId, username,
            baseReward.xp, baseReward.coins, baseReward.crystals,
            client, guild, 'goal', true
        );

        console.log(`✅ Goal rewards processed:`, {
            baseReward,
            levelUp:  levelSystemResult?.levelUp  || false,
            newLevel: levelSystemResult?.newLevel  || 0,
            gotBonus: claimResult?.gotBonus        || false
        });

        return {
            success:           true,
            goalId:            rowId,
            goalType:          goalType,
            goalTitle:         targetGoal.title,
            rewards:           baseReward,
            gotBonus:          claimResult?.gotBonus  || false,
            bonusType:         claimResult?.bonusType,
            levelSystemResult: levelSystemResult
        };

    } catch (error) {
        console.error('❌ Error claiming goal and updating levels:', error);
        return { success: false, error: error.message, code: 'UNEXPECTED_ERROR' };
    }
}

function createGoalsContainer(goalsData, user, isSelf) {
    const userAvatar = user.displayAvatarURL({ extension: 'png', size: 256 }) || 'https://i.imgur.com/AfFp7pu.png';

    const dailyStreak  = goalsData.dailyStreak  || 0;
    const weeklyStreak = goalsData.weeklyStreak || 0;

    const container = new ContainerBuilder().setAccentColor(0x0073ff);

    // ===== HEADER =====
    let headerText = `# ${user.username}'s Goals\n`;
    if (isSelf) {
        headerText += `*Check \`/cooldown\` for reset time*\n\n` +
            `**-# Any unfair methods (AFK, farming, etc.) may result in balance\n` +
            `-# as XP being reduced, partially removed, or fully reset**`;
    }

    container.addSectionComponents((section) =>
        section
            .addTextDisplayComponents((t) => t.setContent(headerText))
            .setThumbnailAccessory((thumb) =>
                thumb.setDescription(`${user.username}'s Goals`).setURL(userAvatar)
            )
    );
    container.addSeparatorComponents((s) => s);

    const hasDailyGoals = goalsData.daily?.length > 0 && goalsData.daily.some(Boolean);
    const hasWeeklyGoal = !!goalsData.weekly?.title;

    if (!hasDailyGoals && !hasWeeklyGoal) {
        container.addTextDisplayComponents((t) =>
            t.setContent(`## 📭 No Goals Found\n*${user.username} doesn't have any active goals yet.*`)
        );
        if (!isSelf) {
            container.addTextDisplayComponents((t) =>
                t.setContent('*Only users can generate goals for themselves by using `/goals`*')
            );
        }
        return container;
    }

    // ===== DAILY GOALS =====
    if (hasDailyGoals) {
        container.addTextDisplayComponents((t) => t.setContent('## ⏰ Daily Goals'));

        const regularDailyGoals = goalsData.daily.filter(g => g && !g.isBonus);
        const bonusDailyGoal    = goalsData.daily.find(g => g?.isBonus);

        regularDailyGoals.forEach((goal, index) => {
            renderGoal(container, goal);

            if (index < regularDailyGoals.length - 1) {
                container.addSeparatorComponents((s) => s);
            }
        });

        container.addSeparatorComponents((s) => s);

        // ===== DAILY BONUS أو LOCKED =====
        if (bonusDailyGoal) {
            renderGoal(container, bonusDailyGoal, true);
        } else {
            container.addTextDisplayComponents((t) =>
                t.setContent(`**🔒 Bonus Daily Mission**\n`)
            );
            container.addTextDisplayComponents((t) =>
                t.setContent(`-# Daily Streak: **${dailyStreak}/5** | Keep going to unlock this bonus mission!`)
            );
        }
    }

    // فاصل بين Daily و Weekly
    if (hasDailyGoals && hasWeeklyGoal) {
        container.addSeparatorComponents((s) => s);
    }

    // ===== WEEKLY GOAL =====
    if (hasWeeklyGoal) {
        container.addTextDisplayComponents((t) => t.setContent('## 📆 Weekly Mission'));

        renderGoal(container, goalsData.weekly);

        container.addSeparatorComponents((s) => s);

        // ===== WEEKLY BONUS أو LOCKED =====
        if (goalsData.weekly2) {
            renderGoal(container, goalsData.weekly2, true);
        } else {
            container.addTextDisplayComponents((t) =>
                t.setContent(`**🔒 Bonus Weekly Mission**\n`)
            );
            container.addTextDisplayComponents((t) =>
                t.setContent(`-# Weekly Streak: **${weeklyStreak}/5** | Keep going to unlock this bonus mission!`)
            );
        }
    }

    return container;
}

function renderGoal(container, goal, isBonus = false) {
    const progress    = goal.progress || 0;
    const requirement = goal.actualRequirement || goal.assigned_requirement || 1;
    const progressBar = createVisualProgressBar(progress, requirement);
    const doneEmoji   = goal.completed ? '' : '';
    const hasBonus    = goal.bonus_chance && goal.bonus_chance > 0;
    const desc        = simplifyDescription(goal);
    const bonusLabel  = isBonus ? ' *(Streak Bonus)*' : '';
    const bonusIcon   = isBonus ? '🌟 ' : '';

    container.addTextDisplayComponents((t) =>
        t.setContent(`**${bonusIcon}${goal.title || 'Untitled'}${doneEmoji}${bonusLabel}**\n\`\`\`\n${desc}\n\`\`\``)
    );

    let rewardsText = `-# Rewards: **${goal.assigned_xp || 0} <:XP:1468446751282302976>** ||||| **${goal.assigned_coins || 0} <:Coins:1468446651965374534>**`;
    if (goal.assigned_crystals > 0) rewardsText += ` ||||| **${goal.assigned_crystals} <:Crystal:1468446688338251793>**`;
    container.addTextDisplayComponents((t) => t.setContent(rewardsText));

    let progressText = `-# **Progress:** ${progress}/${requirement}\n${progressBar}`;
    if (goal.completed && goal.claimed) progressText += ` ||||| **<:Done:1468054867502174229> Claimed**`;
    container.addTextDisplayComponents((t) => t.setContent(progressText));
}

function createVisualProgressBar(current, total) {
    if (total === 0) return '';

    const percentage   = Math.min(100, (current / total) * 100);
    const filledBlocks = Math.min(10, Math.floor(percentage / 10));
    const emptyBlocks  = 10 - filledBlocks;

    const filled = ' 🟦'.repeat(filledBlocks);
    const empty  = ' ⬛'.repeat(emptyBlocks);

    return `-# ${filled}${empty} (${Math.round(percentage)}%)`;
}

function simplifyDescription(goal) {
    if (!goal) return 'No description';

    const desc = goal.description || '';
    const req  = goal.assigned_requirement || goal.actualRequirement || 1;

    if (goal.req_type === 'voice_minutes') {
        return `Spend ${req} minutes in voice`;
    }

    return desc.replace(/\d+-\d+/, req.toString()).trim();
}