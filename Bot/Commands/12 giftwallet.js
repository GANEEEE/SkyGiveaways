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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giftwallet')
        .setDescription('Add coins, crystals, or XP to a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to add currency to')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('coins')
                .setDescription('Amount of Sky Coins to add')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName('crystals')
                .setDescription('Amount of Sky Crystals to add')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName('xp')
                .setDescription('Amount of XP to add')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // التحقق من Moderate Role - نفس reset بالظبط
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setImage(process.env.RedLine || '')
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
                    .setImage(process.env.RedLine || '')
                    .setDescription(`This command is available only for <@&${roleInfo.id}>.`);
                return interaction.editReply({ embeds: [embed] });
            }

            const targetUser = interaction.options.getUser('user');
            const coins = interaction.options.getInteger('coins') || 0;
            const crystals = interaction.options.getInteger('crystals') || 0;
            const xp = interaction.options.getInteger('xp') || 0;

            // التحقق من أن هناك قيمة على الأقل
            if (coins === 0 && crystals === 0 && xp === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#FF9900')
                    .setTitle('⚠️ No Values Provided')
                    .setDescription('Please provide at least one value (coins, crystals, or XP)')
                    .addFields(
                        { name: 'Usage', value: '`/addcoins user:<user> [coins:<amount>] [crystals:<amount>] [xp:<amount>]`' }
                    );
                return interaction.editReply({ embeds: [embed] });
            }

            // عرض تأكيد
            const confirmationContainer = new ContainerBuilder()
                .setAccentColor(0x0099FF)
                .addSectionComponents((section) => 
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(
                                `# 💰 **Add Currency Confirmation**\n` +
                                `You are about to add currency to **${targetUser.tag}**\n\n` +
                                `**Values to add:**\n` +
                                `${coins > 0 ? `• 🪙 **Sky Coins:** ${coins}\n` : ''}` +
                                `${crystals > 0 ? `• 💎 **Sky Crystals:** ${crystals}\n` : ''}` +
                                `${xp > 0 ? `• ⭐ **XP:** ${xp}\n` : ''}` +
                                `\n**Executor:** ${interaction.user.tag}\n` +
                                `**Server:** ${interaction.guild.name}`
                            )
                        )
                        .setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription(`User Avatar: ${targetUser.tag}`)
                                .setURL(targetUser.displayAvatarURL({ size: 256, extension: 'png' }))
                        )
                )
                .addSeparatorComponents((separator) => separator.setDivider(true))
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent('**Please confirm or cancel this action:**')
                        )
                        .setButtonAccessory((button) =>
                            button
                                .setCustomId('confirm_addcoins')
                                .setLabel('✅ Confirm')
                                .setStyle(ButtonStyle.Success)
                        )
                )
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent('*This action will be logged*')
                        )
                        .setButtonAccessory((button) =>
                            button
                                .setCustomId('cancel_addcoins')
                                .setLabel('❌ Cancel')
                                .setStyle(ButtonStyle.Danger)
                        )
                );

            await interaction.editReply({
                components: [confirmationContainer],
                flags: MessageFlags.IsComponentsV2
            });

            // Collector بسيط
            const filter = (i) => i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ 
                filter, 
                time: 60000,
                max: 1 
            });

            collector.on('collect', async (i) => {
                try {
                    await i.deferUpdate();

                    if (i.customId === 'cancel_addcoins') {
                        const cancelContainer = new ContainerBuilder()
                            .setAccentColor(0xFF0000)
                            .addSectionComponents((section) =>
                                section
                                    .addTextDisplayComponents((textDisplay) =>
                                        textDisplay.setContent('# ❌ **Action Cancelled**\nCurrency addition has been cancelled.')
                                    )
                                    .setThumbnailAccessory((thumbnail) =>
                                        thumbnail
                                            .setDescription('Cancelled')
                                            .setURL('https://cdn-icons-png.flaticon.com/512/753/753345.png')
                                    )
                            );

                        await i.editReply({
                            components: [cancelContainer],
                            flags: MessageFlags.IsComponentsV2
                        });
                        return;
                    }

                    if (i.customId === 'confirm_addcoins') {
                        await this.executeAdd(i, targetUser, coins, crystals, xp);
                    }

                } catch (error) {
                    console.error('Error in collector:', error);

                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((textDisplay) =>
                                    textDisplay.setContent(`# ❌ **Error**\nAn error occurred: ${error.message.substring(0, 200)}`)
                                )
                                .setThumbnailAccessory((thumbnail) =>
                                    thumbnail
                                        .setDescription('Error')
                                        .setURL('https://cdn-icons-png.flaticon.com/512/753/753345.png')
                                )
                        );

                    await i.editReply({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    const timeoutContainer = new ContainerBuilder()
                        .setAccentColor(0xFF9900)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((textDisplay) =>
                                    textDisplay.setContent('# ⏰ **Time Expired**\nPlease use the command again.')
                                )
                                .setThumbnailAccessory((thumbnail) =>
                                    thumbnail
                                        .setDescription('Timeout')
                                        .setURL('https://cdn-icons-png.flaticon.com/512/656/656528.png')
                                )
                        );

                    interaction.editReply({
                        components: [timeoutContainer],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in addcoins command:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while executing the command')
                .addFields(
                    { name: 'Error Details', value: error.message.substring(0, 1000) }
                )
                .setTimestamp();

            await interaction.editReply({ 
                embeds: [errorEmbed],
                flags: MessageFlags.IsComponentsV2 
            });
        }
    },

    async executeAdd(interaction, targetUser, coins, crystals, xp) {
        try {
            // تأكد من وجود المستخدم في الداتابيز
            await dbManager.ensureUserExists(targetUser.id, targetUser.username);

            // تحديث العملات
            let updateQuery = 'UPDATE levels SET ';
            const params = [];

            if (coins > 0) {
                updateQuery += 'sky_coins = sky_coins + ?, ';
                params.push(coins);
            }

            if (crystals > 0) {
                updateQuery += 'sky_crystals = sky_crystals + ?, ';
                params.push(crystals);
            }

            if (xp > 0) {
                updateQuery += 'xp = xp + ?, ';
                params.push(xp);
            }

            // إزالة الفاصلة الأخيرة وإضافة WHERE
            updateQuery = updateQuery.slice(0, -2);
            updateQuery += ', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?';
            params.push(targetUser.id);

            // تنفيذ التحديث
            const result = await dbManager.run(updateQuery, params);

            if (result.changes === 0) {
                throw new Error('User not found in database');
            }

            // عرض نتيجة النجاح
            // عرض نتيجة النجاح (جميع المعلومات في قسم واحد)
            const successContainer = new ContainerBuilder()
                .setAccentColor(0x00FF00)
                .addSectionComponents((section) => 
                    section
                        .addTextDisplayComponents((textDisplay) => {
                            let content = `# ✅ **Currency Added Successfully**\n`;
                            content += `User: **${targetUser.tag}** (**${targetUser.id}**)\n\n`;

                            // إضافة معلومات العملات
                            if (coins > 0) content += `• 🪙 **Sky Coins:** +${coins}\n`;
                            if (crystals > 0) content += `• 💎 **Sky Crystals:** +${crystals}\n`;
                            if (xp > 0) content += `• ⭐ **XP:** +${xp}\n`;

                            content += `\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`;

                            return textDisplay.setContent(content);
                        })
                        .setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription('User Avatar')
                                .setURL(targetUser.displayAvatarURL({ size: 256, extension: 'png' }))
                        )
                )
                // يمكنك إضافة قسم إضافي هنا إذا أردت

            await interaction.editReply({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });

            // تسجيل في الكونسول
            console.log(`💰 ${interaction.user.tag} added to ${targetUser.tag}: ${coins} coins, ${crystals} crystals, ${xp} XP`);

        } catch (error) {
            console.error('Error executing currency add:', error);

            const errorContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(`# ❌ **Error**\nAn error occurred: ${error.message.substring(0, 200)}`)
                        )
                        .setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription('Error')
                                .setURL('https://cdn-icons-png.flaticon.com/512/753/753345.png')
                        )
                );

            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};