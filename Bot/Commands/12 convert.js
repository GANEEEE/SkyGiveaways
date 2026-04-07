const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('convert')
        .setDescription('Convert messages to XP (every 10 messages = 3-5 XP)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option.setName('user').setDescription('Specific user (leave empty for all)'))
        .addIntegerOption(option => option.setName('min').setDescription('Minimum messages required').setMinValue(1)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // التحقق من Moderate Role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setDescription('Moderation role not assigned, Please configure the role to enable moderation features by `/setrole`.');
                return interaction.editReply({ embeds: [embed] });
            }

            // التحقق من أن المستخدم لديه Moderate Role
            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasModerateRole = member.roles.cache.has(roleInfo.id);

            if (!hasModerateRole) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⛔ Permission Denied')
                    .setDescription(`This command is available only for <@&${roleInfo.id}>.`);
                return interaction.editReply({ embeds: [embed] });
            }

            const targetUser = interaction.options.getUser('user');
            const minMessages = interaction.options.getInteger('min') || 1;

            // Calculate XP: Every 10 messages = 3-5 XP
            const calculateXP = (messages) => {
                const batches = Math.floor(messages / 10);
                let totalXP = 0;

                for (let i = 0; i < batches; i++) {
                    // Random XP between 3-5
                    totalXP += Math.floor(Math.random() * 3) + 3; // 3, 4, or 5
                }

                return totalXP;
            };

            // Get eligible users
            let users = [];
            if (targetUser) {
                const userData = await dbManager.get(
                    'SELECT sent FROM message_stats WHERE user_id = ? AND sent >= ?',
                    [targetUser.id, minMessages]
                );
                if (userData) {
                    users = [{ 
                        user_id: targetUser.id, 
                        username: targetUser.username, 
                        sent: userData.sent 
                    }];
                }
            } else {
                users = await dbManager.all(
                    'SELECT user_id, username, sent FROM message_stats WHERE sent >= ?',
                    [minMessages]
                );
            }

            if (users.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#FF9900')
                    .setTitle('⚠️ No Eligible Users')
                    .setDescription(`No users found with at least ${minMessages} messages.`);
                return interaction.editReply({ embeds: [embed] });
            }

            // Conversion process
            let totalXP = 0;
            let totalMessages = 0;
            let convertedUsers = 0;
            const failedUsers = [];

            for (const user of users) {
                try {
                    const userXP = calculateXP(user.sent);

                    // Update database
                    const result = await dbManager.run(
                        `UPDATE levels 
                         SET xp = xp + ?, 
                             chat_points = xp + ?,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE user_id = ?`,
                        [userXP, userXP, user.user_id]
                    );

                    if (result.changes > 0) {
                        totalXP += userXP;
                        totalMessages += user.sent;
                        convertedUsers++;
                    } else {
                        failedUsers.push(user.username);
                    }
                } catch (error) {
                    console.error(`Error converting user ${user.user_id}:`, error);
                    failedUsers.push(user.username);
                }
            }

            // Results embed
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Conversion Complete')
                .setDescription(
                    `**Executor:** ${interaction.user.tag}\n` +
                    `**Converted Users:** ${convertedUsers}\n` +
                    `**Moderate Role:** <@&${roleInfo.id}>\n\n` +
                    `📊 **Total Messages:** ${totalMessages.toLocaleString()}\n` +
                    `⭐ **Total XP Added:** ${totalXP.toLocaleString()}\n` +
                    `📝 **Chat Points Set:** ${totalXP.toLocaleString()}\n` +
                    `📈 **Average XP per user:** ${(totalXP / convertedUsers).toLocaleString()}`
                )
                .addFields(
                    { 
                        name: '📋 Conversion Rate', 
                        value: 'Every 10 messages = 3-5 XP (random)\n' +
                               `Each message ≈ ${(totalXP / totalMessages).toFixed(2)} XP on average`
                    }
                );

            // إضافة معلومات عن المستخدمين الفاشلين إن وجد
            if (failedUsers.length > 0) {
                embed.addFields({
                    name: '⚠️ Failed Conversions',
                    value: `Failed for ${failedUsers.length} user(s): ${failedUsers.slice(0, 10).join(', ')}${failedUsers.length > 10 ? '...' : ''}`
                });
            }

            embed.setFooter({ 
                text: `Minimum messages: ${minMessages} • ${new Date().toLocaleString()}` 
            })
            .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // تسجيل في السجلات
            console.log(`🔄 ${interaction.user.tag} converted messages to XP for ${convertedUsers} users`);

        } catch (error) {
            console.error('Error in convert command:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while executing the convert command')
                .addFields(
                    { name: 'Error Details', value: error.message.substring(0, 1000) }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};