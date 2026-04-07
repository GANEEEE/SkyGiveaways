const { 
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ComponentType
} = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('progress')
        .setDescription('View your progress in different reward systems'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            await showMainProgressMenu(interaction);

        } catch (error) {
            console.error('❌ Error in progress command:', error);
            try {
                const errContainer = new ContainerBuilder()
                    .setAccentColor(0xff0000)
                    .addTextDisplayComponents((text) => text.setContent('❌ Error executing command.'));
                await interaction.editReply({ 
                    components: [errContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch {}
        }
    }
};

// ========== MAIN MENU ==========

async function showMainProgressMenu(interaction) {
    try {
        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff);

        container
            .addTextDisplayComponents((text) => text.setContent(`## Welcome ${interaction.user.username} To Progress Menu`))
            .addTextDisplayComponents((text) => text.setContent('-# Choose system to view:'))
            .addSeparatorComponents((sep) => sep.setDivider(true))
            .addTextDisplayComponents((text) => text.setContent('### 🎯 Global Challenges Info'))
            .addTextDisplayComponents((text) => text.setContent('Server-wide challenge progress'))
            .addTextDisplayComponents((text) => text.setContent('### 📦 Drops Info'))
            .addTextDisplayComponents((text) => text.setContent('Your crate & drop progress'))
            .addSeparatorComponents((sep) => sep.setDivider(false))
            .addActionRowComponents((row) =>
                row.setComponents(
                    new ButtonBuilder()
                        .setCustomId('progress_challenges')
                        .setLabel('View Challenges')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('progress_crates')
                        .setLabel('View Drops')
                        .setStyle(ButtonStyle.Success)
                )
            );

        await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        const message = await interaction.fetchReply();
        createCollectorForPage(message, interaction, 'main');

    } catch (error) {
        if (error.code === 10062) return;
        console.error('Error showing main menu:', error);
    }
}

// ========== GLOBAL CHALLENGES PROGRESS ==========

async function showChallengesProgress(interaction) {
    try {
        // ⭐ دايما deferUpdate في الأول
        try {
            await interaction.deferUpdate();
        } catch (deferError) {
            if (deferError.code === 10062) return;
        }

        const guildId = interaction.guild?.id;
        const userId  = interaction.user.id;

        const challengeData = await dbManager.getGlobalChallengeWithTargets(guildId);

        if (!challengeData) {
            const errContainer = new ContainerBuilder()
                .setAccentColor(0xff0000)
                .addTextDisplayComponents((text) => text.setContent('❌ No active challenges in this server.'));

            await interaction.editReply({
                components: [errContainer],
                flags: MessageFlags.IsComponentsV2
            });
            return;
        }

        const currentMessages = challengeData.messages_in_current_cycle;

        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff);

        container
            .addTextDisplayComponents((text) => text.setContent('# 🎯 Global Challenges'))
            .addTextDisplayComponents((text) => text.setContent(`Total Messages: **${currentMessages.toLocaleString()}**`))
            .addSeparatorComponents((sep) => sep.setDivider(true))
            .addTextDisplayComponents((text) => text.setContent('## Main Events'));

        // Star
        const starReached      = currentMessages >= challengeData.star_target;
        const starRemaining    = Math.max(0, challengeData.star_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${starReached ? '✅' : '⭐'} Star Drop** ➠ (Drop in **${challengeData.star_target.toLocaleString()}** - Remaining: **${starRemaining}** messages)`
        ));

        // Comet
        const cometReached     = currentMessages >= challengeData.comet_target;
        const cometRemaining   = Math.max(0, challengeData.comet_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${cometReached ? '✅' : '☄️'} Comet Drop** ➠ (Drop in **${challengeData.comet_target.toLocaleString()}** - Remaining: **${cometRemaining}** messages)`
        ));

        // Nebula
        const nebulaReached    = currentMessages >= challengeData.nebula_target;
        const nebulaRemaining  = Math.max(0, challengeData.nebula_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${nebulaReached ? '✅' : '🌌'} Nebula Drop** ➠ (Drop in **${challengeData.nebula_target.toLocaleString()}** - Remaining: **${nebulaRemaining}** messages)`
        ));

        // Meteoroid
        const meteoroidReached   = currentMessages >= challengeData.meteoroid_target;
        const meteoroidRemaining = Math.max(0, challengeData.meteoroid_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${meteoroidReached ? '✅' : '🔥'} Meteoroid Drop** ➠ (Drop in **${challengeData.meteoroid_target.toLocaleString()}** - Remaining: **${meteoroidRemaining}** messages)`
        ));

        container
            .addSeparatorComponents((sep) => sep.setDivider(true))
            .addTextDisplayComponents((text) => text.setContent('## Mini Events'));

        // Before-Star
        const beforeStarRemaining = Math.max(0, challengeData.before_star_target - currentMessages);
        const beforeStarStatus    = challengeData.before_star_completed ? '✅' : '🎯';
        container.addTextDisplayComponents((text) => text.setContent(
            `**${beforeStarStatus} Mini Star** ➠ (Drop in **${challengeData.before_star_target.toLocaleString()}** - Remaining: **${beforeStarRemaining}** messages)`
        ));

        // Star-Comet
        const starCometRemaining = Math.max(0, challengeData.star_comet_target - currentMessages);
        const starCometStatus    = challengeData.star_comet_completed ? '✅' : '⚡';
        container.addTextDisplayComponents((text) => text.setContent(
            `**${starCometStatus} Mini Comet** ➠ (Drop in **${challengeData.star_comet_target.toLocaleString()}** - Remaining: **${starCometRemaining}** messages)`
        ));

        // Comet-Nebula
        const cometNebulaRemaining = Math.max(0, challengeData.comet_nebula_target - currentMessages);
        const cometNebulaStatus    = challengeData.comet_nebula_completed ? '✅' : '💫';
        container.addTextDisplayComponents((text) => text.setContent(
            `**${cometNebulaStatus} Mini Nebula** ➠ (Drop in **${challengeData.comet_nebula_target.toLocaleString()}** - Remaining: **${cometNebulaRemaining}** messages)`
        ));

        // Nebula-Meteoroid
        const nebulaMeteoroidRemaining = Math.max(0, challengeData.nebula_meteoroid_target - currentMessages);
        const nebulaMeteoroidStatus    = challengeData.nebula_meteoroid_completed ? '✅' : '🌀';
        container.addTextDisplayComponents((text) => text.setContent(
            `**${nebulaMeteoroidStatus} Mini Meteoroid** ➠ (Drop in **${challengeData.nebula_meteoroid_target.toLocaleString()}** - Remaining: **${nebulaMeteoroidRemaining}** messages)`
        ));

        // Voice Challenge
        const voiceChallengeRemaining = Math.max(0, challengeData.voice_challenge_target - currentMessages);
        const voiceChallengeStatus    = challengeData.voice_challenge_completed ? '✅' : '🎧';
        container.addTextDisplayComponents((text) => text.setContent(
            `**${voiceChallengeStatus} Voice Challenge** ➠ (Drop in **${challengeData.voice_challenge_target.toLocaleString()}** - Remaining: **${voiceChallengeRemaining}** messages)`
        ));

        container
            .addSeparatorComponents((sep) => sep.setDivider(false))
            .addActionRowComponents((row) =>
                row.setComponents(
                    new ButtonBuilder()
                        .setCustomId('progress_challenges')
                        .setLabel('Challenges')
                        .setEmoji('🎯')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('progress_crates')
                        .setLabel('Drops')
                        .setEmoji('📦')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(false)
                )
            );

        await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        const message = await interaction.fetchReply();
        createCollectorForPage(message, interaction, 'challenges');

    } catch (error) {
        if (error.code === 10062) return;
        console.error('Error showing challenges progress:', error);
    }
}

// ========== CRATE PROGRESS ==========

async function showCratesProgress(interaction) {
    try {
        // ⭐ دايما deferUpdate في الأول
        try {
            await interaction.deferUpdate();
        } catch (deferError) {
            if (deferError.code === 10062) return;
        }

        const userId = interaction.user.id;

        const dropProgress = await dbManager.getUserDropProgress(userId);

        if (!dropProgress) {
            const container = new ContainerBuilder()
                .setAccentColor(0x0073ff);

            container
                .addTextDisplayComponents((text) => text.setContent('# 📦 Drop Progress'))
                .addTextDisplayComponents((text) => text.setContent('## ❌ No Drops Available'))
                .addTextDisplayComponents((text) => text.setContent('### Start grinding messages to earn your first drop!'))
                .addTextDisplayComponents((text) => text.setContent('- Send messages in counted channels'))
                .addTextDisplayComponents((text) => text.setContent('- Complete challenges'))
                .addTextDisplayComponents((text) => text.setContent('- Stay active in the server'))
                .addSeparatorComponents((sep) => sep.setDivider(false))
                .addActionRowComponents((row) =>
                    row.setComponents(
                        new ButtonBuilder()
                            .setCustomId('progress_challenges')
                            .setLabel('Challenges')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🎯')
                            .setDisabled(false),
                        new ButtonBuilder()
                            .setCustomId('progress_crates')
                            .setLabel('Drops')
                            .setEmoji('📦')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(true)
                    )
                );

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

            const message = await interaction.fetchReply();
            createCollectorForPage(message, interaction, 'crates');
            return;
        }

        const currentMessages = dropProgress.total_messages;

        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff);

        container
            .addTextDisplayComponents((text) => text.setContent('# 📦 Drop Progress'))
            .addTextDisplayComponents((text) => text.setContent(`**Total Messages:** ${currentMessages.toLocaleString()}`))
            .addSeparatorComponents((sep) => sep.setDivider(true));

        // Common
        const commonReached    = currentMessages >= dropProgress.common_target;
        const commonRemaining  = Math.max(0, dropProgress.common_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${commonReached ? '✅' : '📦'} Common Drop** ➠ (Drop in **${dropProgress.common_target.toLocaleString()}** - Remaining: **${commonRemaining}** messages)\n-# Received: **${dropProgress.total_common_received}** times`
        ));

        // Rare
        const rareReached      = currentMessages >= dropProgress.rare_target;
        const rareRemaining    = Math.max(0, dropProgress.rare_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${rareReached ? '✅' : '✨'} Rare Drop** ➠ (Drop in **${dropProgress.rare_target.toLocaleString()}** - Remaining: **${rareRemaining}** messages)\n-# Received: **${dropProgress.total_rare_received}** times`
        ));

        // Epic
        const epicReached      = currentMessages >= dropProgress.epic_target;
        const epicRemaining    = Math.max(0, dropProgress.epic_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${epicReached ? '✅' : '💎'} Epic Drop** ➠ (Drop in **${dropProgress.epic_target.toLocaleString()}** - Remaining: **${epicRemaining}** messages)\n-# Received: **${dropProgress.total_epic_received}** times`
        ));

        // Legendary
        const legendaryReached   = currentMessages >= dropProgress.legendary_target;
        const legendaryRemaining = Math.max(0, dropProgress.legendary_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${legendaryReached ? '✅' : '🔥'} Legendary Drop** ➠ (Drop in **${dropProgress.legendary_target.toLocaleString()}** - Remaining: **${legendaryRemaining}** messages)\n-# Received: **${dropProgress.total_legendary_received}** times`
        ));

        // Available drops
        const availableDrops = [];
        if (commonReached    && dropProgress.last_common_at    < dropProgress.common_target)    availableDrops.push('📦 Common Drop Available!');
        if (rareReached      && dropProgress.last_rare_at      < dropProgress.rare_target)      availableDrops.push('✨ Rare Drop Available!');
        if (epicReached      && dropProgress.last_epic_at      < dropProgress.epic_target)      availableDrops.push('💎 Epic Drop Available!');
        if (legendaryReached && dropProgress.last_legendary_at < dropProgress.legendary_target) availableDrops.push('🔥 Legendary Drop Available!');

        if (availableDrops.length > 0) {
            container
                .addSeparatorComponents((sep) => sep.setDivider(true))
                .addTextDisplayComponents((text) => text.setContent('## 🎁 Available Drops!'))
                .addTextDisplayComponents((text) => text.setContent(availableDrops.join('\n')));
        }

        container
            .addSeparatorComponents((sep) => sep.setDivider(false))
            .addActionRowComponents((row) =>
                row.setComponents(
                    new ButtonBuilder()
                        .setCustomId('progress_challenges')
                        .setLabel('Challenges')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🎯')
                        .setDisabled(false),
                    new ButtonBuilder()
                        .setCustomId('progress_crates')
                        .setLabel('Drops')
                        .setEmoji('📦')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                )
            );

        await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        const message = await interaction.fetchReply();
        createCollectorForPage(message, interaction, 'crates');

    } catch (error) {
        if (error.code === 10062) return;
        console.error('Error showing crates progress:', error);
    }
}

// ========== COLLECTOR ==========

function createCollectorForPage(message, interaction, currentPage) {
    // ⭐ وقف أي collector قديم
    if (message._progressCollector) {
        message._progressCollector.stop('replaced');
    }

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000,
        filter: (i) => i.user.id === interaction.user.id
    });

    message._progressCollector = collector;

    collector.on('collect', async (i) => {
        try {
            if (!i.isButton()) return;

            // لو الزر محظور (الصفحة الحالية) مش هنعمل حاجة
            if ((currentPage === 'challenges' && i.customId === 'progress_challenges') ||
                (currentPage === 'crates'     && i.customId === 'progress_crates')) {
                try { await i.deferUpdate(); } catch {}
                return;
            }

            // ⭐ مش بنعمل deferUpdate هنا، الـ functions بتعمله بنفسها
            switch (i.customId) {
                case 'progress_challenges':
                    await showChallengesProgress(i);
                    break;
                case 'progress_crates':
                    await showCratesProgress(i);
                    break;
            }

        } catch (error) {
            if (error.code === 10062) return;
            console.error('Error in progress collector:', error);
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason !== 'replaced') {
            console.log(`Progress collector ended: ${reason}, collected: ${collected.size}`);
        }
    });

    return collector;
}