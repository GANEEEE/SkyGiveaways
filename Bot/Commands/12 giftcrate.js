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
        .setName('giftcrate')
        .setDescription('Add crates to a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to add crates to')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Type of crate')
                .setRequired(true)
                .addChoices(
                    { name: '🟢 Common', value: 'common' },
                    { name: '🔵 Rare', value: 'rare' },
                    { name: '🟣 Epic', value: 'epic' },
                    { name: '🟠 Legendary', value: 'legendary' }
                )
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Number of crates to add')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
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
            const crateType = interaction.options.getString('type');
            const amount = interaction.options.getInteger('amount');

            // عرض تأكيد
            const crateEmoji = {
                'common': '🟢',
                'rare': '🔵', 
                'epic': '🟣',
                'legendary': '🟠'
            }[crateType];

            const crateName = crateType.charAt(0).toUpperCase() + crateType.slice(1);

            const confirmationContainer = new ContainerBuilder()
                .setAccentColor(0x9B59B6)
                .addSectionComponents((section) => 
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(
                                `# 🎁 **Add Crates Confirmation**\n` +
                                `You are about to add crates to **${targetUser.tag}**\n\n` +
                                `**Crate Details:**\n` +
                                `• **Type:** ${crateEmoji} ${crateName}\n` +
                                `• **Amount:** ${amount} crate(s)\n\n` +
                                `**Executor:** ${interaction.user.tag}\n` +
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
                                .setCustomId('confirm_addcrates')
                                .setLabel('✅ Confirm')
                                .setStyle(ButtonStyle.Success)
                        )
                )
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent('*This action will create actual crates with random rewards*')
                        )
                        .setButtonAccessory((button) =>
                            button
                                .setCustomId('cancel_addcrates')
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

                    if (i.customId === 'cancel_addcrates') {
                        const cancelContainer = new ContainerBuilder()
                            .setAccentColor(0xFF0000)
                            .addSectionComponents((section) =>
                                section
                                    .addTextDisplayComponents((textDisplay) =>
                                        textDisplay.setContent('# ❌ **Action Cancelled**\nCrate addition has been cancelled.')
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

                    if (i.customId === 'confirm_addcrates') {
                        await this.executeAdd(i, targetUser, crateType, amount);
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
            console.error('Error in addcrates command:', error);

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

    async executeAdd(interaction, targetUser, crateType, amount) {
        try {
            // تأكد من وجود المستخدم في الداتابيز
            await dbManager.ensureUserExists(targetUser.id, targetUser.username);

            const createdCrates = [];
            const failedCrates = [];

            // إنشاء كل الـ crates
            for (let i = 0; i < amount; i++) {
                try {
                    const crateResult = await dbManager.createCrate(targetUser.id, targetUser.username, crateType);

                    if (crateResult.success) {
                        createdCrates.push(crateResult.crateId);
                    } else {
                        failedCrates.push(i + 1);
                    }
                } catch (error) {
                    failedCrates.push(i + 1);
                    console.error(`Error creating crate ${i + 1}:`, error);
                }
            }

            const crateEmoji = {
                'common': '🟢',
                'rare': '🔵', 
                'epic': '🟣',
                'legendary': '🟠'
            }[crateType];

            const crateName = crateType.charAt(0).toUpperCase() + crateType.slice(1);

            // عرض النتيجة
            const resultContainer = new ContainerBuilder()
            .setAccentColor(failedCrates.length === 0 ? 0x00FF00 : 0xFF9900)
            .addSectionComponents((section) => 
                section
                    .addTextDisplayComponents((textDisplay) => {
                        let title = failedCrates.length === 0 
                            ? '# ✅ **Crates Added Successfully**' 
                            : '# ⚠️ **Partial Success**';

                        let content = `${title}\n` +
                                     `Added to **${targetUser.tag}**\n\n` +
                                     `**Crate Type:** ${crateEmoji} ${crateName}\n` +
                                     `**Requested Amount:** ${amount}\n` +
                                     `**Successfully Created:** ${createdCrates.length}\n`;

                        if (failedCrates.length > 0) {
                            content += `**Failed:** ${failedCrates.length}\n`;
                            content += `**Failed crate numbers:** ${failedCrates.join(', ')}\n`;
                        }

                        content += `\n*🎁 ${createdCrates.length} ${crateName} crate(s) added to ${targetUser.username}*`;

                        return textDisplay.setContent(content);
                    })
                    .setThumbnailAccessory((thumbnail) =>
                        thumbnail
                            .setDescription('User Avatar')
                            .setURL(targetUser.displayAvatarURL({ size: 256, extension: 'png' }))
                    )
            );

            await interaction.editReply({
                components: [resultContainer],
                flags: MessageFlags.IsComponentsV2
            });

            // تسجيل في الكونسول
            console.log(`🎁 ${interaction.user.tag} added ${createdCrates.length} ${crateType} crates to ${targetUser.tag}`);

        } catch (error) {
            console.error('Error executing crate add:', error);

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