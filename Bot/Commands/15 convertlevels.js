// commands/migrate.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const dbManager = require("../Data/database");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("migrate")
        .setDescription("[ADMIN] Migrate old levels to new Tier system")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // تأكيد أن المستخدم أدمن
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ You need Administrator permission to use this command!",
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // 1. جلب كل المستخدمين
            const allUsers = await dbManager.all('SELECT user_id, username, level, xp FROM levels');

            if (!allUsers || allUsers.length === 0) {
                return interaction.editReply({
                    content: "❌ No users found in database!",
                    ephemeral: true
                });
            }

            // الـ XP المطلوب لكل Tier
            const tierRequirements = {
                1: 1500,    // Tier 1 = Level 3
                2: 10000,   // Tier 2 = Level 6
                3: 55000,   // Tier 3 = Level 9
                4: 145000,  // Tier 4 = Level 12
                5: 280000   // Tier 5 = Level 15
            };

            // إحصائيات
            let stats = {
                total: allUsers.length,
                migrated: 0,
                alreadyCorrect: 0,
                errors: 0,
                byOldLevel: {},
                byNewTier: {}
            };

            let migrationLog = [];

            // 2. معالجة كل مستخدم
            for (const user of allUsers) {
                try {
                    const oldLevel = user.level || 0;
                    const currentXP = user.xp || 0;

                    // حساب الـ Tier الجديد
                    let newTier = 0;
                    if (currentXP >= tierRequirements[5]) newTier = 5;
                    else if (currentXP >= tierRequirements[4]) newTier = 4;
                    else if (currentXP >= tierRequirements[3]) newTier = 3;
                    else if (currentXP >= tierRequirements[2]) newTier = 2;
                    else if (currentXP >= tierRequirements[1]) newTier = 1;
                    else newTier = 0;

                    // تسجيل الإحصائيات
                    stats.byOldLevel[oldLevel] = (stats.byOldLevel[oldLevel] || 0) + 1;
                    stats.byNewTier[newTier] = (stats.byNewTier[newTier] || 0) + 1;

                    const needsMigration = oldLevel !== newTier;

                    if (needsMigration) {
                        migrationLog.push(`🔄 ${user.username}: Level ${oldLevel} → Tier ${newTier} (XP: ${currentXP})`);

                        await dbManager.run(
                            `UPDATE levels SET level = ? WHERE user_id = ?`,
                            [newTier, user.user_id]
                        );

                        stats.migrated++;
                    } else {
                        stats.alreadyCorrect++;
                    }

                } catch (userError) {
                    migrationLog.push(`❌ Error with ${user.username}: ${userError.message}`);
                    stats.errors++;
                }
            }

            // 3. عمل Embed للنتائج
            const embed = {
                color: 0x0073ff,
                title: "🔄 Migration Complete!",
                description: `Successfully migrated from **15 Levels** to **5 Tiers** system.`,
                fields: [
                    {
                        name: "📊 Statistics",
                        value: [
                            `**Total Users:** ${stats.total}`,
                            `**🔄 Migrated:** ${stats.migrated}`,
                            `**✅ Already Correct:** ${stats.alreadyCorrect}`,
                            `**❌ Errors:** ${stats.errors}`
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: "📈 Old Level Distribution",
                        value: Object.entries(stats.byOldLevel)
                            .sort((a,b) => parseInt(a[0]) - parseInt(b[0]))
                            .map(([level, count]) => `Level ${level}: ${count} users`)
                            .join('\n') || "No data",
                        inline: true
                    },
                    {
                        name: "🎯 New Tier Distribution",
                        value: Object.entries(stats.byNewTier)
                            .sort((a,b) => parseInt(a[0]) - parseInt(b[0]))
                            .map(([tier, count]) => {
                                const tierName = tier === '0' ? 'Beginner' : `Tier ${tier}`;
                                return `${tierName}: ${count} users`;
                            })
                            .join('\n') || "No data",
                        inline: true
                    }
                ],
                footer: {
                    text: `Migration completed at ${new Date().toLocaleString()}`
                }
            };

            // لو في log طويل، نرسله في فايل
            let files = [];
            if (migrationLog.length > 0 && stats.migrated > 0) {
                const { AttachmentBuilder } = require("discord.js");
                const logContent = migrationLog.join('\n');
                const logBuffer = Buffer.from(logContent, 'utf-8');
                const attachment = new AttachmentBuilder(logBuffer, { name: 'migration-log.txt' });
                files.push(attachment);
                embed.fields.push({
                    name: "📄 Migration Log",
                    value: "Check attached file for detailed log",
                    inline: false
                });
            }

            await interaction.editReply({
                embeds: [embed],
                files: files,
                ephemeral: true
            });

            console.log(`✅ Migration command executed by ${interaction.user.tag}`);
            console.log(`📊 Results: ${stats.migrated} migrated, ${stats.alreadyCorrect} correct, ${stats.errors} errors`);

        } catch (error) {
            console.error('❌ Migration command error:', error);
            await interaction.editReply({
                content: `❌ An error occurred during migration: ${error.message}`,
                ephemeral: true
            });
        }
    }
};