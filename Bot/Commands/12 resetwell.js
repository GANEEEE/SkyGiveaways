const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    SectionBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    TextDisplayBuilder,
    MessageFlags,
    EmbedBuilder,
    PermissionFlagsBits 
} = require('discord.js');
const dbManager = require('../Data/database');

const SKYWELL_ROLE_IDS = [
    "1465705164139794443",
    "1465705207760556186",
    "1465705232280453283",
    "1465705263209123975",
    "1465705294234652736"
];

const BATCH_SIZE = 5;
const BATCH_DELAY = 500;
const ROLE_DELAY = 100;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetwell')
        .setDescription('Reset ALL Skywell user data COMPLETELY')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Type of reset to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Soft Reset (Only stats)', value: 'soft' },
                )
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Specific user to reset (leave empty for ALL users)')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setImage(process.env.RedLine || '')
                    .setDescription('Moderation role not assigned. Please configure the role to enable moderation features by `/setrole`.');
                return interaction.editReply({ embeds: [embed] });
            }

            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasModerateRole = member.roles.cache.has(roleInfo.id);

            if (!hasModerateRole) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⛔ Permission Denied')
                    .setImage(process.env.RedLine || '')
                    .setDescription(`This command is available only for <@&${roleInfo.id}>.`);
                return interaction.editReply({ embeds: [embed] });
            }

            const resetType = interaction.options.getString('type');
            const targetUser = interaction.options.getUser('user');
            const executor = interaction.user;
            const guild = interaction.guild;

            await this.showConfirmationContainer(interaction, targetUser, resetType, executor, guild);

        } catch (error) {
            console.error('Error in resetwell command:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while executing the command')
                .addFields({ name: 'Error Details', value: error.message.substring(0, 1000) })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // ========== دالة إزالة الرولز بالـ Batch ==========
    async removeSkywellRoles(guild, targetUser = null) {
        let removedCount = 0;
        let failedCount = 0;

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // دالة إزالة role واحدة مع retry
        const removeRoleWithRetry = async (member, roleId, retries = 3) => {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    await member.roles.remove(roleId);
                    return true;
                } catch (error) {
                    if (error.status === 429) {
                        const retryAfter = (error.retryAfter || 1000) + 100;
                        console.log(`⏳ Rate limit - waiting ${retryAfter}ms (attempt ${attempt}/${retries})`);
                        await delay(retryAfter);
                    } else {
                        console.error(`❌ Failed to remove role from ${member.user.tag}:`, error.message);
                        return false;
                    }
                }
            }
            return false;
        };

        // دالة تشغيل batch واحدة
        const processBatch = async (batch) => {
            const promises = batch.map(async ({ member, roleId }) => {
                const success = await removeRoleWithRetry(member, roleId);
                if (success) removedCount++;
                else failedCount++;
                await delay(ROLE_DELAY); // delay صغير بين كل role جوه الـ batch
            });

            await Promise.all(promises);
        };

        try {
            if (targetUser) {
                // ===== مستخدم محدد =====
                const member = await guild.members.fetch(targetUser.id).catch(() => null);
                if (member) {
                    for (const roleId of SKYWELL_ROLE_IDS) {
                        if (member.roles.cache.has(roleId)) {
                            const success = await removeRoleWithRetry(member, roleId);
                            if (success) removedCount++;
                            else failedCount++;
                            await delay(ROLE_DELAY);
                        }
                    }
                }
            } else {
                // ===== كل المستخدمين =====
                console.log(`🔍 Fetching all members...`);
                const members = await guild.members.fetch();

                // فلتر اللي عندهم Skywell roles بس
                const membersWithRoles = members.filter(member =>
                    SKYWELL_ROLE_IDS.some(roleId => member.roles.cache.has(roleId))
                );

                console.log(`🎭 ${membersWithRoles.size} members have Skywell roles (out of ${members.size} total)`);

                // بناء قايمة كل الـ { member, roleId } المطلوب شيلها
                const allRoleRemovals = [];
                for (const [, member] of membersWithRoles) {
                    for (const roleId of SKYWELL_ROLE_IDS) {
                        if (member.roles.cache.has(roleId)) {
                            allRoleRemovals.push({ member, roleId });
                        }
                    }
                }

                console.log(`📋 Total role removals needed: ${allRoleRemovals.length}`);

                // تقسيم على batches وتشغيلها
                for (let i = 0; i < allRoleRemovals.length; i += BATCH_SIZE) {
                    const batch = allRoleRemovals.slice(i, i + BATCH_SIZE);
                    await processBatch(batch);

                    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                    const totalBatches = Math.ceil(allRoleRemovals.length / BATCH_SIZE);

                    console.log(`📊 Batch ${batchNumber}/${totalBatches} done | removed: ${removedCount} | failed: ${failedCount}`);

                    // delay بين كل batch
                    if (i + BATCH_SIZE < allRoleRemovals.length) {
                        await delay(BATCH_DELAY);
                    }
                }
            }

            console.log(`✅ Done - removed: ${removedCount} | failed: ${failedCount}`);
            return { removedCount, failedCount };

        } catch (error) {
            console.error('❌ Error removing Skywell roles:', error);
            return { removedCount, failedCount };
        }
    },

    // ========== واجهة التأكيد ==========
    async showConfirmationContainer(interaction, targetUser, resetType, executor, guild) {
        try {
            const isAllUsers = !targetUser;

            const resetDescription = '🔄 **Soft Reset** - Only statistics will be reset (Throw count & timestamps preserved)';
            const consequences = 
                '**Consequences:**\n' +
                '• All coins/crystals thrown will be reset to 0\n' +
                '• Levels will be reset to beginner\n' +
                '• Highest throw will be reset to 0\n' +
                '• **Skywell roles will be removed** 🎭\n' +
                '• Throw count will be preserved ✅\n' +
                '• Timestamps will be preserved ✅';

            const confirmationContainer = new ContainerBuilder()
                .setAccentColor(0xFF9900)
                .addSectionComponents((section) => {
                    const sectionBuilder = new SectionBuilder()
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(
                                `# ⚠️ **CRITICAL ACTION REQUIRED**\n` +
                                `You are about to reset Skywell data ${isAllUsers ? 'for **ALL USERS**' : `for **${targetUser.tag}**`}\n\n` +
                                `${resetDescription}\n\n` +
                                `${consequences}\n\n` +
                                `**Target:** ${isAllUsers ? 'ALL Users' : targetUser.tag}\n` +
                                `**Reset Type:** Soft (Stats Only)\n` +
                                `**Executor:** ${executor.tag}\n` +
                                `**Server:** ${guild.name}`
                            )
                        );

                    if (isAllUsers) {
                        sectionBuilder.setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription(`Server Icon: ${guild.name}`)
                                .setURL(guild.iconURL({ size: 256, extension: 'png' }) || '')
                        );
                    } else {
                        sectionBuilder.setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription(`User Avatar: ${targetUser.tag}`)
                                .setURL(targetUser.displayAvatarURL({ size: 256, extension: 'png' }))
                        );
                    }

                    return sectionBuilder;
                })
                .addSeparatorComponents((separator) => separator.setDivider(true))
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(`**❗Please confirm carefully:**`)
                        )
                        .setButtonAccessory((button) =>
                            button
                                .setCustomId('confirm_resetwell')
                                .setLabel('🔄 CONFIRM RESET')
                                .setStyle(ButtonStyle.Success)
                        )
                )
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent('*⚠️ This action is permanent and cannot be undone*')
                        )
                        .setButtonAccessory((button) =>
                            button
                                .setCustomId('cancel_resetwell')
                                .setLabel('❌ Cancel')
                                .setStyle(ButtonStyle.Secondary)
                        )
                );

            await interaction.editReply({
                components: [confirmationContainer],
                flags: MessageFlags.IsComponentsV2
            });

            this.setupConfirmationCollector(interaction, targetUser, resetType, executor, guild);

        } catch (error) {
            console.error('Error showing confirmation container:', error);
            throw error;
        }
    },

    // ========== Collector ==========
    setupConfirmationCollector(interaction, targetUser, resetType, executor, guild) {
        const filter = (i) => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 60000,
            max: 1 
        });

        collector.on('collect', async (i) => {
            try {
                await i.deferUpdate();

                if (i.customId === 'cancel_resetwell') {
                    const cancelContainer = new ContainerBuilder()
                        .setAccentColor(0x0073ff)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((textDisplay) =>
                                    textDisplay.setContent('# ✅ **Operation Cancelled**\nSkywell reset has been cancelled safely')
                                )
                                .setThumbnailAccessory((thumbnail) =>
                                    thumbnail
                                        .setDescription('Cancelled')
                                        .setURL(guild.iconURL({ size: 256, extension: 'png' }) || 'https://cdn-icons-png.flaticon.com/512/190/190411.png')
                                )
                        );

                    await i.editReply({
                        components: [cancelContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    console.log(`✅ ${executor.tag} cancelled Skywell reset`);
                    return;
                }

                if (i.customId === 'confirm_resetwell') {
                    await this.executeSkywellReset(i, targetUser, resetType, executor, guild);
                }

            } catch (error) {
                console.error('Error in confirmation collector:', error);

                const errorContainer = new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addSectionComponents((section) =>
                        section
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent('# ❌ **Critical Error**\nAn error occurred while processing your request.')
                            )
                            .setThumbnailAccessory((thumbnail) =>
                                thumbnail
                                    .setDescription('Error')
                                    .setURL(guild.iconURL({ size: 256, extension: 'png' }) || '')
                            )
                    );

                i.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({
                    components: [],
                    content: '⏰ **Time expired!** Please use the command again'
                }).catch(() => {});
            }
        });
    },

    // ========== تنفيذ الـ Reset ==========
    async executeSkywellReset(interaction, targetUser, resetType, executor, guild) {
        try {
            const isAllUsers = !targetUser;

            // ===== رسالة "جاري التنفيذ" على طول =====
            await interaction.editReply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xFF9900)
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(
                                `# ⏳ **Reset In Progress...**\n\n` +
                                `Resetting stats and removing Skywell roles\n` +
                                `This may take a few minutes, please wait...`
                            )
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });

            // ===== عدد السجلات قبل الـ reset =====
            let beforeCount = 0;
            if (isAllUsers) {
                const countResult = await dbManager.get('SELECT COUNT(*) as total FROM skywell_users');
                beforeCount = countResult?.total || 0;
            } else {
                const userExists = await dbManager.get(
                    'SELECT 1 FROM skywell_users WHERE user_id = $1',
                    [targetUser.id]
                );
                beforeCount = userExists ? 1 : 0;
            }

            // ===== Soft Reset =====
            let result;
            if (targetUser) {
                result = await dbManager.run(
                    `UPDATE skywell_users 
                     SET total_coins_thrown = 0,
                         total_crystals_thrown = 0,
                         total_converted_coins = 0,
                         current_level = 0,
                         current_role_id = NULL,
                         highest_single_throw = 0
                     WHERE user_id = $1`,
                    [targetUser.id]
                );
            } else {
                result = await dbManager.run(
                    `UPDATE skywell_users 
                     SET total_coins_thrown = 0,
                         total_crystals_thrown = 0,
                         total_converted_coins = 0,
                         current_level = 0,
                         current_role_id = NULL,
                         highest_single_throw = 0
                     WHERE user_id IS NOT NULL`
                );
            }

            console.log(`🔄 SOFT RESET: Reset stats for ${result.changes || 0} user(s)`);

            // ===== إزالة الرولز =====
            const rolesResult = await this.removeSkywellRoles(guild, targetUser);
            console.log(`🎭 Roles removed: ${rolesResult.removedCount} (failed: ${rolesResult.failedCount})`);

            const affectedUsers = result.changes || 0;

            if (affectedUsers === 0 && beforeCount === 0) {
                const message = isAllUsers 
                    ? '❌ No users found in Skywell database'
                    : `❌ User ${targetUser.tag} not found in Skywell database`;

                await interaction.editReply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0xFF9900)
                            .addSectionComponents((section) =>
                                section
                                    .addTextDisplayComponents((textDisplay) =>
                                        textDisplay.setContent(`# ${message}\n\nNo action was performed`)
                                    )
                                    .setThumbnailAccessory((thumbnail) =>
                                        thumbnail
                                            .setDescription('No Data')
                                            .setURL(guild.iconURL({ size: 256, extension: 'png' }) || '')
                                    )
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2
                });
                return;
            }

            // ===== رسالة النجاح =====
            let successContent = '';

            if (isAllUsers) {
                successContent = 
                    `# 🔄 **SKYWELL STATS RESET**\n\n` +
                    `**${affectedUsers} user(s)** have had their Skywell stats reset to zero\n\n` +
                    `**Type:** Soft Reset (Stats Only)\n` +
                    `**Users Affected:** ${affectedUsers} user(s)\n` +
                    `**Actions Performed:**\n` +
                    `• Coins/Crystals thrown reset to 0 ✅\n` +
                    `• Levels reset to beginner ✅\n` +
                    `• Highest throw reset to 0 ✅\n` +
                    `• Skywell roles removed: ${rolesResult.removedCount}\n` +
                    `• Throw count preserved 🔒\n` +
                    `• Timestamps preserved 🔒\n\n` +
                    `**Executor:** ${executor.tag}\n` +
                    `**Server:** ${guild.name}\n` +
                    `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                    `*✅ Skywell statistics have been reset. Users can start fresh*`;
            } else {
                successContent = 
                    `# 🔄 **SKYWELL STATS RESET**\n\n` +
                    `User **${targetUser.tag}** has had Skywell stats reset to zero\n\n` +
                    `**User:** ${targetUser.tag}\n` +
                    `**ID:** ${targetUser.id}\n` +
                    `**Type:** Soft Reset (Stats Only)\n` +
                    `**Actions Performed:**\n` +
                    `• Coins/Crystals thrown reset to 0 ✅\n` +
                    `• Level reset to beginner ✅\n` +
                    `• Highest throw reset to 0 ✅\n` +
                    `• Skywell roles removed: ${rolesResult.removedCount}\n` +
                    `• Throw count preserved 🔒\n` +
                    `• Timestamps preserved 🔒\n\n` +
                    `**Executor:** ${executor.tag}\n` +
                    `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                    `*✅ Skywell statistics have been reset. Users can start fresh*`;
            }

            await interaction.editReply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x00FF00)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((textDisplay) =>
                                    textDisplay.setContent(successContent)
                                )
                                .setThumbnailAccessory((thumbnail) =>
                                    thumbnail
                                        .setDescription('Stats Reset')
                                        .setURL(guild.iconURL({ size: 256, extension: 'png' }) || '')
                                )
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });

            console.log(`🔄 ${executor.tag} performed soft reset on Skywell for ${isAllUsers ? `${affectedUsers} users` : targetUser.tag} in ${guild.name}`);

        } catch (error) {
            console.error('Error executing Skywell reset:', error);

            await interaction.editReply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((textDisplay) =>
                                    textDisplay.setContent(`# ❌ **Skywell Reset Failed**\n**Error:** ${error.message.substring(0, 200)}`)
                                )
                                .setThumbnailAccessory((thumbnail) =>
                                    thumbnail
                                        .setDescription('Error')
                                        .setURL(guild.iconURL({ size: 256, extension: 'png' }) || '')
                                )
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};