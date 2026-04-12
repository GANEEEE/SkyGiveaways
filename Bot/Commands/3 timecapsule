const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timecapsule')
        .setDescription('Save a message to your future self')
        .addStringOption(opt =>
            opt.setName('message')
                .setDescription('The message you want to save')
                .setRequired(true)
                .setMaxLength(500)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const message = interaction.options.getString('message');

        try {
            // 1. Check if user exists in activity_rewards
            const userRecord = await dbManager.get(
                'SELECT user_id FROM activity_rewards WHERE user_id = $1',
                [interaction.user.id]
            );

            if (!userRecord) {
                return interaction.editReply({
                    content: '❌ You are not registered in the event yet!\nPlease use `/signup` first to participate'
                });
            }

            // 2. Check if user already has a time capsule
            const existingCapsule = await dbManager.get(
                'SELECT id FROM time_capsules WHERE user_id = $1',
                [interaction.user.id]
            );

            if (existingCapsule) {
                return interaction.editReply({
                    content: 'You have already saved a time capsule!\n\n' +
                             '✨ We hope to see you in good health next year! ✨\n' +
                             '-# You can only save one message per person.'
                });
            }

            // 3. Save the time capsule
            await dbManager.run(
                `INSERT INTO time_capsules (user_id, username, message) 
                 VALUES ($1, $2, $3)`,
                [interaction.user.id, interaction.user.username, message]
            );

            await interaction.editReply({
                content: `### Thank you so much for your message!\n> **${message}**\n\n-# ✨ We hope to see you in good health next year! ✨`
            });

        } catch (error) { 
            console.error('❌ Error saving time capsule:', error);
            await interaction.editReply({
                content: '❌ Something went wrong while saving your message. Please try again later.'
            });
        }
    }
};