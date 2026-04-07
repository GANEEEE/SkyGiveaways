const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../Data/database');

// ========== CONFIG ==========
const EGG_CONFIG = {
    DROP_CHANNEL_ID: '1369523365710397521',
    SERVER_MSG_TRIGGER: 100,
    USER_MSG_PER_HEAT: 20,
    SPECIAL_MSG_PER_HEAT: 10,
    EGG_DROP_TIMEOUT: 30000,
    HEAT_REPLY_TIMEOUT: 120000,
    DOUBLE_HEAT_DURATION: 5 * 60 * 1000,       // 5 دقايق
    DOUBLE_HEAT_MESSAGES: 350,                  // كل 100 رسالة
    MILESTONES: [25, 50, 75, 100],
    BOOST_ROLE_ID: '1374313963428253847',
    BOOST_MULTIPLIER: 1.25,
    EGG_COLORS: {
        green:  { emoji: '🟢', label: 'Green Egg',  embedColor: '#00FF88', chance: 0.30 },
        blue:   { emoji: '🔵', label: 'Blue Egg',   embedColor: '#00BFFF', chance: 0.25 },
        yellow: { emoji: '🟡', label: 'Yellow Egg', embedColor: '#FFD700', chance: 0.20 },
        orange: { emoji: '🟠', label: 'Orange Egg', embedColor: '#FF6B00', chance: 0.12 },
        red:    { emoji: '🔴', label: 'Red Egg',    embedColor: '#FF4444', chance: 0.08 },
        purple: { emoji: '🟣', label: 'Purple Egg', embedColor: '#9B59B6', chance: 0.05 },
    },
    SPECIAL_EGG: {
        emoji: '🐰',
        label: 'Spring Egg',
        type: 'special'
    },
    HEAT_TIERS: {
        legendary: { min: 100, label: '🐣 Golden Egg',   color: '#FFD700' },
        epic:      { min: 75,  label: '🔥 Flaming Egg',  color: '#FFA500' },
        rare:      { min: 50,  label: '🌟 Shining Egg',  color: '#00BFFF' },
        normal:    { min: 25,  label: '🥚 Lucky Egg',    color: '#00FF88' },
        rotten:    { min: 0,   label: '💀 Cursed Egg',   color: '#555555' }
    }
};

class EggSystem {
    constructor(client) {
        this.client = client;
        this.dropChannelId = EGG_CONFIG.DROP_CHANNEL_ID;
        this.isDoubleHeat = false;
        this.doubleHeatTimeout = null;
        this.guildId = null;
        this.pendingEggColor = null;
    }

    // ========== SETUP ==========
    async setup() {
        this.guildId = this.client.guilds.cache.first()?.id;
        console.log(`🥚 Egg System ready | Drop channel: ${this.dropChannelId}`);
        console.log(`🎲 Special egg chance: 15% every ${EGG_CONFIG.SERVER_MSG_TRIGGER} messages`);
        console.log(`⚡ Double Heat: every ${EGG_CONFIG.DOUBLE_HEAT_MESSAGES} messages for 5 minutes`);
    }

    // ========== GET OR CREATE SERVER STATE ==========
    async getServerState(guildId) {
        let state = await dbManager.get(
            'SELECT * FROM egg_server_state WHERE guild_id = $1',
            [guildId]
        );

        if (!state) {
            await dbManager.run(
                `INSERT INTO egg_server_state (guild_id, msg_counter, event_active)
                 VALUES ($1, 0, true)`,
                [guildId]
            );
            state = await dbManager.get(
                'SELECT * FROM egg_server_state WHERE guild_id = $1',
                [guildId]
            );
        }

        return state;
    }

    // ========== GET OR CREATE DOUBLE HEAT STATE ==========
    // ✅ رو منفصل في نفس الجدول بـ guild_id = "guildId_double_heat"
    async getDoubleHeatState(guildId) {
        const doubleHeatId = `${guildId}_double_heat`;

        let state = await dbManager.get(
            'SELECT * FROM egg_server_state WHERE guild_id = $1',
            [doubleHeatId]
        );

        if (!state) {
            await dbManager.run(
                `INSERT INTO egg_server_state (guild_id, msg_counter, event_active)
                 VALUES ($1, 0, true)`,
                [doubleHeatId]
            );
            state = await dbManager.get(
                'SELECT * FROM egg_server_state WHERE guild_id = $1',
                [doubleHeatId]
            );
        }

        return state;
    }

    // ========== PROCESS MESSAGE ==========
    async processMessage(message) {
        try {
            if (!message.guild || message.author.bot) return;

            const guildId = message.guild.id;
            const userId = message.author.id;
            const username = message.author.username;

            const isCounted = await dbManager.isChannelCounted(guildId, message.channel.id);
            if (!isCounted) return;

            const state = await this.getServerState(guildId);
            if (!state.event_active) return;

            // ===== 1. SERVER COUNTER (كل 30 رسالة → فرصة Spring Egg) =====
            const newServerCount = (state.msg_counter || 0) + 1;
            await dbManager.run(
                `UPDATE egg_server_state SET msg_counter = $1 WHERE guild_id = $2`,
                [newServerCount, guildId]
            );

            if (newServerCount >= EGG_CONFIG.SERVER_MSG_TRIGGER) {
                await dbManager.run(
                    `UPDATE egg_server_state SET msg_counter = 0 WHERE guild_id = $1`,
                    [guildId]
                );

                if (Math.random() < 0.05) {
                    console.log('🎲 Special egg chance triggered! Attempting drop...');
                    await this.dropSpecialEgg(message.guild);
                }
            }

            // ===== 2. DOUBLE HEAT COUNTER (كل 100 رسالة) =====
            // ✅ رو منفصل في الداتابيز بـ guild_id = "guildId_double_heat"
            const doubleHeatState = await this.getDoubleHeatState(guildId);
            const newDoubleHeatCount = (doubleHeatState.msg_counter || 0) + 1;

            if (newDoubleHeatCount >= EGG_CONFIG.DOUBLE_HEAT_MESSAGES) {
                await dbManager.run(
                    `UPDATE egg_server_state SET msg_counter = 0 WHERE guild_id = $1`,
                    [`${guildId}_double_heat`]
                );
                await this.activateDoubleHeat(message.guild);
            } else {
                await dbManager.run(
                    `UPDATE egg_server_state SET msg_counter = $1 WHERE guild_id = $2`,
                    [newDoubleHeatCount, `${guildId}_double_heat`]
                );
            }

            // ===== 3. USER HEAT COUNTER =====
            const normalEgg = await dbManager.get(
                `SELECT * FROM egg_holders WHERE user_id = $1 AND hatched = false AND egg_type = 'normal'`,
                [userId]
            );

            const specialEgg = await dbManager.get(
                `SELECT * FROM egg_holders WHERE user_id = $1 AND hatched = false AND egg_type = 'special'`,
                [userId]
            );

            const member = await message.guild.members.fetch(userId).catch(() => null);

            if (normalEgg) {
                await this.processEggHeat(message, username, normalEgg, EGG_CONFIG.USER_MSG_PER_HEAT, member);
            }

            if (specialEgg) {
                await this.processEggHeat(message, username, specialEgg, EGG_CONFIG.SPECIAL_MSG_PER_HEAT, member);
            }

        } catch (error) {
            console.error('❌ EggSystem processMessage error:', error.message);
        }
    }

    // ========== ACTIVATE DOUBLE HEAT ==========
    async activateDoubleHeat(guild) {
        try {
            if (this.isDoubleHeat) return;

            const channel = guild.channels.cache.get(this.dropChannelId);
            if (!channel) return;

            this.isDoubleHeat = true;
            console.log('⚡ Double Heat activated for 5 minutes!');

            const doubleHeatMsg = await channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#0073ff')
                    .setTitle('🔥 Double Heat Is Active')
                    .setDescription(
                        '* 🥚 Colored Egg: Every **20 messages** = **+2% heat**!\n' +
                        '* 🐰 Spring Egg: Every **10 messages** = **+2% heat**!\n' +
                        `-# Ends <t:${Math.floor((Date.now() + EGG_CONFIG.DOUBLE_HEAT_DURATION) / 1000)}:R>`
                    )]
            });

            // ✅ تخزين الرسالة في DB
            await dbManager.run(
                `UPDATE egg_server_state 
                 SET active_msg_id = $1, active_channel_id = $2
                 WHERE guild_id = $3`,
                [doubleHeatMsg.id, channel.id, `${guild.id}_double_heat`]
            );

            this.doubleHeatTimeout = setTimeout(async () => {
                this.isDoubleHeat = false;
                console.log('⚡ Double Heat ended');

                // ✅ حذف الرسالة ومسح البيانات من DB
                await doubleHeatMsg.delete().catch(() => {});
                await dbManager.run(
                    `UPDATE egg_server_state 
                     SET active_msg_id = NULL, active_channel_id = NULL
                     WHERE guild_id = $1`,
                    [`${guild.id}_double_heat`]
                );

                const endMsg = await channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#555555')
                        .setTitle('⏰ Double Heat Ended')
                        .setDescription(
                            '**See you all in a bit! 🐣**\n'
                        )]
                });
                setTimeout(() => endMsg.delete().catch(() => {}), 30000);
            }, EGG_CONFIG.DOUBLE_HEAT_DURATION);

        } catch (error) {
            console.error('❌ Error activating double heat:', error.message);
            this.isDoubleHeat = false;
        }
    }

    // ========== PROCESS EGG HEAT ==========
    // في دالة processEggHeat
    async processEggHeat(message, username, egg, msgsPerHeat, member = null) {
        try {
            const oldHeat = parseFloat(egg.heat) || 0;

            // ✅ إذا كانت الحرارة 100% أو أكثر، لا تزيد
            if (oldHeat >= 100) {
                return;
            }

            const newMsgCounter = (egg.msg_counter || 0) + 1;

            if (newMsgCounter >= msgsPerHeat) {
                let heatGain = this.isDoubleHeat ? 2 : 1;

                const hasBoosted = member?.roles.cache.has(EGG_CONFIG.BOOST_ROLE_ID);
                if (hasBoosted) {
                    heatGain = heatGain * EGG_CONFIG.BOOST_MULTIPLIER;
                }

                let newHeat = oldHeat + heatGain;

                // ✅ لا تتجاوز 100%
                if (newHeat > 100) {
                    newHeat = 100;
                }

                newHeat = Math.round(newHeat * 100) / 100;

                await dbManager.run(
                    `UPDATE egg_holders SET heat = $1, msg_counter = 0 WHERE id = $2`,
                    [newHeat, egg.id]
                );

                // ✅ فقط نتحقق من الميليستون إذا لم تكن 100% بالفعل
                if (oldHeat < 100) {
                    await this.checkMilestone(message, username, oldHeat, newHeat, egg.egg_type);
                }

            } else {
                await dbManager.run(
                    `UPDATE egg_holders SET msg_counter = $1 WHERE id = $2`,
                    [newMsgCounter, egg.id]
                );
            }
        } catch (error) {
            console.error('❌ Error processing egg heat:', error.message);
        }
    }

    // ========== CHECK MILESTONE ==========
    async checkMilestone(message, username, oldHeat, newHeat, eggType = 'normal') {
        try {
            const guild = message.guild;
            const channel = guild.channels.cache.get(this.dropChannelId);
            if (!channel) return;

            const eggLabel = eggType === 'special' ? '🐰 Spring Egg' : '🥚 Egg';

            for (const milestone of EGG_CONFIG.MILESTONES) {
                if (oldHeat < milestone && newHeat >= milestone) {
                    const tier = this.getHeatTier(newHeat);
                    const heatEmoji = this.getHeatEmoji(newHeat);
                    const isFinal = milestone === 100;

                    const reply = await message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(tier.color)
                            .setTitle(isFinal ? 'EGG FULLY HEATED!' : `Milestone Reached!`)
                            .setDescription(
                                isFinal
                                    ? `🐣 **${username}** has reached **100% heat!**\n-# ${eggLabel} is ready to hatch! Stay tuned for the ceremony!`
                                    : `-# ${heatEmoji} **${username}** just reached **${milestone}% heat!**`
                            )]
                    });

                    setTimeout(() => reply.delete().catch(() => {}), EGG_CONFIG.HEAT_REPLY_TIMEOUT);

                    if (message.channel.id !== this.dropChannelId) {
                        await channel.send({
                            embeds: [new EmbedBuilder()
                                .setColor(tier.color)
                                .setTitle(isFinal ? '🎉 Egg Fully Heated!' : `🌡️ Milestone!`)
                                .setDescription(
                                    isFinal
                                        ? `<@${message.author.id}> ${eggLabel} reached **100% heat!** Ready to hatch!`
                                        : `<@${message.author.id}> ${eggLabel} just hit **${milestone}%** heat! ${heatEmoji}`
                                )]
                        });
                    }

                    break;
                }
            }
        } catch (error) {
            console.error('❌ Error checking milestone:', error.message);
        }
    }

    // ========== DROP SPECIAL EGG ==========
    async dropSpecialEgg(guild) {
        try {
            const channel = guild.channels.cache.get(this.dropChannelId);
            if (!channel) {
                console.log('⚠️ Egg drop channel not found');
                return;
            }

            const state = await this.getServerState(guild.id);
            if (state.active_msg_id) {
                console.log('⚠️ Egg already active, skipping drop');
                return;
            }

            const colorKey = this.rollEggColor();
            const colorData = EGG_CONFIG.EGG_COLORS[colorKey];
            this.pendingEggColor = colorKey;

            const embed = new EmbedBuilder()
                .setColor(colorData.embedColor)
                .setTitle(`🐰 | A Spring Egg Appeared!`)
                .setDescription(`**A magical Spring Egg has dropped!**\n`)
                .setFooter({ text: 'First come, first served!' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('egg_collect')
                    .setLabel('Collect Spring Egg')
                    .setEmoji('🐰')
                    .setStyle(ButtonStyle.Primary)
            );

            const msg = await channel.send({ embeds: [embed], components: [row] });

            await dbManager.run(
                `UPDATE egg_server_state 
                 SET active_msg_id = $1, active_channel_id = $2, active_egg_type = 'special'
                 WHERE guild_id = $3`,
                [msg.id, channel.id, guild.id]
            );

            setTimeout(async () => {
                try {
                    await msg.delete().catch(() => {});
                    this.pendingEggColor = null;
                    await dbManager.run(
                        `UPDATE egg_server_state 
                         SET active_msg_id = NULL, active_channel_id = NULL, active_egg_type = NULL
                         WHERE guild_id = $1`,
                        [guild.id]
                    );
                    console.log('🗑️ Special egg expired and deleted');
                } catch (err) {
                    console.error('❌ Error deleting special egg message:', err.message);
                }
            }, EGG_CONFIG.EGG_DROP_TIMEOUT);

            console.log(`🐰 Special egg dropped! Color: ${colorKey} ${colorData.emoji}`);

        } catch (error) {
            console.error('❌ EggSystem dropSpecialEgg error:', error.message);
        }
    }

    // ========== HANDLE COLLECT BUTTON ==========
    async handleCollect(interaction) {
        try {
            await interaction.deferReply({ ephemeral: false });

            const userId = interaction.user.id;
            const username = interaction.user.username;
            const guildId = interaction.guild.id;

            const verified = await dbManager.get(
                `SELECT 1 FROM discord_verify_steam WHERE discord_id = $1 AND status = 'verified'`,
                [userId]
            );
            if (!verified) {
                return interaction.followUp({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF4444')
                        .setTitle('❌ Not Verified!')
                        .setDescription('* Use `/verify me` to get started')],
                    ephemeral: true
                });
            }

            const hasAnyEgg = await dbManager.get(
                `SELECT 1 FROM egg_holders WHERE user_id = $1 AND hatched = false`,
                [userId]
            );
            if (!hasAnyEgg) {
                await interaction.deleteReply().catch(() => {});
                return interaction.followUp({
                    embeds: [new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('⚠️ No Egg Found')
                        .setDescription('You need to sign up first using `/signup` to get a starter egg before collecting a Spring Egg!')],
                    ephemeral: true
                });
            }

            const state = await this.getServerState(guildId);
            if (!state.active_msg_id || state.active_msg_id !== interaction.message.id) {
                return interaction.followUp({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF4444')
                        .setTitle('💨 Too Late!')
                        .setDescription('This egg has already been collected or expired!')],
                    ephemeral: true
                });
            }

            return await this.handleSpecialCollect(interaction, userId, username, guildId);

        } catch (error) {
            console.error('❌ EggSystem handleCollect error:', error.message);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Error collecting egg.', ephemeral: true });
            }
        }
    }

    // ========== HANDLE SPECIAL COLLECT ==========
    async handleSpecialCollect(interaction, userId, username, guildId) {
        try {
            const existingSpecial = await dbManager.get(
                `SELECT * FROM egg_holders WHERE user_id = $1 AND hatched = false AND egg_type = 'special'`,
                [userId]
            );

            if (existingSpecial) {
                return interaction.followUp({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF4444')
                        .setTitle('🐰 Already Have a Spring Egg!')
                        .setDescription(
                            `You already have a **🐰 Spring Egg**!\n\n` +
                            `* 🌡️ Current Heat: **${parseFloat(existingSpecial.heat).toFixed(2)}%**\n` +
                            `-# You can only have one Spring Egg at a time!`
                        )],
                    ephemeral: true
                });
            }

            const specialColor = this.pendingEggColor || this.rollEggColor();
            const specialColorData = EGG_CONFIG.EGG_COLORS[specialColor];

            const normalEgg = await dbManager.get(
                `SELECT * FROM egg_holders WHERE user_id = $1 AND hatched = false AND egg_type = 'normal'`,
                [userId]
            );

            let startHeat = 0;
            let replacedMsg = '';

            if (normalEgg) {
                startHeat = parseFloat(normalEgg.heat) || 0;
                await dbManager.run(
                    `DELETE FROM egg_holders WHERE user_id = $1 AND egg_type = 'normal'`,
                    [userId]
                );
                const oldColor = EGG_CONFIG.EGG_COLORS[normalEgg.egg_color];
                replacedMsg = `\n-# Your **${oldColor.emoji} ${oldColor.label}** \`${startHeat.toFixed(2)}% heat\` was replaced!`;
                console.log(`🔄 ${username}'s normal egg (${startHeat}%) replaced → Spring Egg keeps same heat`);
            }

            await dbManager.run(
                `INSERT INTO egg_holders (user_id, username, egg_color, egg_type, heat, msg_counter)
                 VALUES ($1, $2, $3, 'special', $4, 0)`,
                [userId, username, specialColor, startHeat]
            );

            await dbManager.run(
                `UPDATE egg_server_state 
                 SET active_msg_id = NULL, active_channel_id = NULL, active_egg_type = NULL
                 WHERE guild_id = $1`,
                [guildId]
            );

            this.pendingEggColor = null;
            await interaction.message.delete().catch(() => {});

            console.log(`🐰 ${username} collected a Spring Egg! Color: ${specialColor} ${specialColorData.emoji} | Heat: ${startHeat}%`);

            await interaction.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor(specialColorData.embedColor)
                    .setTitle(`🐰 | Spring Egg Collected!`)
                    .setDescription(
                        `**${username}** got a **🐰 Spring Egg**!${replacedMsg}\n` +
                        `* 🌡️ Current Heat: \`${startHeat.toFixed(2)}%\`\n` +
                        `* 💬 Every **${EGG_CONFIG.SPECIAL_MSG_PER_HEAT} messages** = **+1% heat**\n` +
                        `-# Spring Eggs heat up faster!`
                    )]
            });

            await interaction.deleteReply().catch(() => {});

        } catch (error) {
            console.error('❌ Error in handleSpecialCollect:', error.message);
            throw error;
        }
    }

    // ========== HATCH EGG ==========
    async hatchEgg(userId) {
        try {
            const eggHolder = await dbManager.get(
                'SELECT * FROM egg_holders WHERE user_id = $1 AND hatched = false ORDER BY egg_type DESC LIMIT 1',
                [userId]
            );

            if (!eggHolder) {
                return { success: false, error: 'No active egg found for this user' };
            }

            const heat = parseFloat(eggHolder.heat) || 0;
            const tier = this.getHeatTier(heat);
            const colorData = EGG_CONFIG.EGG_COLORS[eggHolder.egg_color];

            await dbManager.run(
                `UPDATE egg_holders SET hatched = true WHERE id = $1`,
                [eggHolder.id]
            );

            console.log(`🐣 ${eggHolder.username} hatched! Type: ${eggHolder.egg_type} | Color: ${eggHolder.egg_color} | Heat: ${heat}% | Tier: ${tier.label}`);

            return {
                success: true,
                userId,
                username: eggHolder.username,
                heat,
                tier,
                colorData,
                egg_color: eggHolder.egg_color,
                egg_type: eggHolder.egg_type
            };

        } catch (error) {
            console.error('❌ EggSystem hatchEgg error:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ========== GET USER EGG ==========
    async getUserEgg(userId) {
        try {
            return await dbManager.all(
                'SELECT * FROM egg_holders WHERE user_id = $1 AND hatched = false',
                [userId]
            );
        } catch (error) {
            console.error('❌ Error getting user egg:', error.message);
            return [];
        }
    }

    // ========== GET ALL ACTIVE EGGS ==========
    async getAllActiveEggs() {
        try {
            return await dbManager.all(
                'SELECT * FROM egg_holders WHERE hatched = false ORDER BY heat DESC'
            );
        } catch (error) {
            console.error('❌ Error getting all active eggs:', error.message);
            return [];
        }
    }

    // ========== HELPERS ==========
    rollEggColor() {
        const random = Math.random();
        let cumulative = 0;
        for (const [colorKey, colorData] of Object.entries(EGG_CONFIG.EGG_COLORS)) {
            cumulative += colorData.chance;
            if (random < cumulative) return colorKey;
        }
        return 'green';
    }

    getHeatTier(heat) {
        if (heat >= 100) return EGG_CONFIG.HEAT_TIERS.legendary;
        if (heat >= 75)  return EGG_CONFIG.HEAT_TIERS.epic;
        if (heat >= 50)  return EGG_CONFIG.HEAT_TIERS.rare;
        if (heat >= 25)  return EGG_CONFIG.HEAT_TIERS.normal;
        return EGG_CONFIG.HEAT_TIERS.rotten;
    }

    getHeatEmoji(heat) {
        if (heat >= 100) return '🐣';
        if (heat >= 75)  return '🔥';
        if (heat >= 50)  return '🌡️';
        if (heat >= 25)  return '💤';
        return '❄️';
    }
}

module.exports = { EggSystem, EGG_CONFIG };