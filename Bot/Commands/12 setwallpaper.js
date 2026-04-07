const { SlashCommandBuilder } = require('discord.js');
const dbManager = require('../Data/database');

// ⭐⭐ تصنيفات الوالبيبرز والرولات المطلوبة ⭐⭐
const WALLPAPER_CATEGORIES = {
    RARE: {
        id: 'rare',
        name: 'Rare',
        emoji: '🟦',
        requiredRoleId: '1466171760918659264',
        removeRoleOnApply: true
    },
    EPIC: {
        id: 'epic',
        name: 'Epic',
        emoji: '🟪',
        requiredRoleId: '1466171800395448587', // ⭐ غير هذا الـ ID
        removeRoleOnApply: true
    },
    MYTHIC: {
        id: 'mythic',
        name: 'Mythic',
        emoji: '🟨',
        requiredRoleId: '1466171802765234351', // ⭐ غير هذا الـ ID
        removeRoleOnApply: true
    },
    OG: {
        id: 'og',
        name: 'OG',
        emoji: '👑',
        requiredRoleId: '1466171805869019137', // ⭐ غير هذا الـ ID
        removeRoleOnApply: false // ⭐ OG ما تتشالش
    }
};

// كل الوالبيبرز مع تصنيفاتها
const WALLPAPERS = [
    {
        url: 'https://i.ibb.co/BVf7r2p9/Anime-Green.png',
        name: 'CrazyGreen',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/vxdq3fYF/Attack-on-titan.png',
        name: 'Eren',
        category: 'MYTHIC'
    },
    {
        url: 'https://i.ibb.co/R4H5cTF0/Beach.png',
        name: 'Beach',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/TMm4wW0G/Blue-Monster.png',
        name: 'BlueMonster',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/mFR5XLtV/Cute-Girl.png',
        name: 'Purbleeyes',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/8DZYS3Kr/Cute-Mario.png',
        name: 'CuteMario',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/MDdfNTLj/DMC-5.png',
        name: 'dmc5',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/35cNd9QC/Fight.png',
        name: 'vs',
        category: 'MYTHIC'
    },
    {
        url: 'https://i.ibb.co/W4tJTfRW/Goku.png',
        name: 'Goku',
        category: 'MYTHIC'
    },
    {
        url: 'https://i.ibb.co/2Y0mFvrJ/Heavy-Sword.png',
        name: 'HeavySword',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/bMhnry9r/Hello-Kitty.png',
        name: 'Kitty',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/RTYLjj0j/Hoshimi-Miyabi.png',
        name: 'Hoshimi',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/S7H57Wkr/Iron-man-Doom.png',
        name: 'Ironman Doom',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/vCDLB8vc/Jinx-2.png',
        name: 'Jnix',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/LXK1XmGZ/Jinx.png',
        name: 'Jnix',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/YTckvPPB/Lost.png',
        name: 'lost guy',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/b5Yy66cB/Purpble.png',
        name: 'purble anime',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/w58HLHz/Quite-girl.png',
        name: 'Quite girl',
        category: 'OG'
    },
    {
        url: 'https://i.ibb.co/nN0g96Nf/Snow.png',
        name: 'Pinguen',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/210D56ZR/Spider-Girl.png',
        name: 'Stancy',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/1fB4r17p/Spiderman.png',
        name: 'Spiderman',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/cfjbVyM/Spiderman-Venom.png',
        name: 'Venom',
        category: 'MYTHIC'
    },
    {
        url: 'https://i.ibb.co/Lzs1CxTp/Zombie.png',
        name: 'Zombie',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/V0Lff75Z/Zoro.png',
        name: 'Zoro',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/4nfHZK6q/Silk-Song.png',
        name: 'Silk Song',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/5WLs382q/Where-Winds-Meet.png',
        name: 'Where Winds Meet',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/1fnQnq6Y/The-Moon.png',
        name: 'The Moon',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/RT4DJcRw/Samurai.png',
        name: 'Samurai',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/W4S57x7k/Redblade.png',
        name: 'Redblade',
        category: 'OG'
    },
    {
        url: 'https://i.ibb.co/MyRNgyym/Minecraft.png',
        name: 'Minecraft',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/s934JGrf/Medival.png',
        name: 'Medieval',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/27bwfR9d/Jocker.png',
        name: 'Joker',
        category: 'MYTHIC'
    },
    {
        url: 'https://i.ibb.co/PGKC5r1V/Fallout.png',
        name: 'Fallout',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/2z3hRmk/Elden-Ring.png',
        name: 'Elden Ring',
        category: 'MYTHIC'
    },
    {
        url: 'https://i.ibb.co/9Hmd1DSD/Dying-Light.png',
        name: 'Dying Light',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/W4kXMzpY/Lofi.png',
        name: 'Lofi',
        category: 'OG'
    },
    {
        url: 'https://i.ibb.co/7Jq0306C/Relax-Forest.png',
        name: 'Relax Forest',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/qMs67q04/Relax-Night.png',
        name: 'Relax Night',
        category: 'EPIC'
    },
    {
        url: 'https://i.ibb.co/4nTmMqZy/Anime-Vollion.png',
        name: 'Anime Vollion',
        category: 'RARE'
    },
    {
        url: 'https://i.ibb.co/9kctDJm6/Anime-Girl.png',
        name: 'Anime Girl',
        category: 'EPIC'
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setwallpaper')
        .setDescription('🎨 Set wallpaper for your rank card')
        .setDMPermission(false),

    async execute(interaction) {
        try {
            // تحقق من وجود الحساب
            const userData = await dbManager.getUserProfile(interaction.user.id);
            if (!userData) {
                return interaction.reply({
                    content: ':x: You need to create an account first! Use `/start`',
                    ephemeral: true
                });
            }

            // إرسال الصفحة الأولى مع فلتر للـ RARE أولاً
            await this.sendWallpaperPage(interaction, 0, 'RARE');

        } catch (error) {
            console.error('Error executing wallpaper command:', error);
            await interaction.reply({ 
                content: ':x: An unexpected error occurred', 
                ephemeral: true
            });
        }
    },

    async sendWallpaperPage(interaction, page = 0, categoryFilter = 'ALL', successMessage = null) {
        try {
            // جلب بيانات المستخدم
            const userData = await dbManager.getUserProfile(interaction.user.id);
            const currentWallpaper = userData?.wallpaper_url;

            // فلتر الوالبيبرز حسب التصنيف
            let filteredWallpapers = WALLPAPERS;
            if (categoryFilter !== 'ALL') {
                filteredWallpapers = WALLPAPERS.filter(wp => wp.category === categoryFilter);
            }

            // حساب الصفحات
            const ITEMS_PER_PAGE = 3;
            const totalPages = Math.ceil(filteredWallpapers.length / ITEMS_PER_PAGE);

            // تصحيح رقم الصفحة
            if (page < 0) page = 0;
            if (page >= totalPages) page = totalPages - 1;

            // جلب والبيبرز الصفحة الحالية
            const start = page * ITEMS_PER_PAGE;
            const end = Math.min(start + ITEMS_PER_PAGE, filteredWallpapers.length);
            const pageWallpapers = filteredWallpapers.slice(start, end);

            // بناء الكونتينر
            const container = {
                type: 17,
                components: []
            };

            // ⭐⭐ العنوان مع فلتر التصنيفات ⭐⭐
            let title = `## 🎨 Wallpaper Gallery\nChoose a design for your rank card\n-# • Total: ${WALLPAPERS.length} wallpapers • Page: ${page + 1}/${totalPages} • Filter: ${categoryFilter === 'ALL' ? 'All' : categoryFilter}`;

            // إضافة رسالة النجاح إذا كانت موجودة
            if (successMessage) {
                title = successMessage + '\n\n' + title;
            }

            container.components.push({
                type: 10,
                content: title
            });

            // ⭐⭐ أزرار فلتر التصنيفات ⭐⭐
            const filterButtons = {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: categoryFilter === 'ALL' ? 1 : 2,
                        custom_id: `wallpaper_filter_ALL_${page}`,
                        label: 'All',
                        disabled: categoryFilter === 'ALL'
                    },
                    {
                        type: 2,
                        style: categoryFilter === 'RARE' ? 1 : 2,
                        custom_id: `wallpaper_filter_RARE_${page}`,
                        label: '🟦 Rare',
                        disabled: categoryFilter === 'RARE'
                    },
                    {
                        type: 2,
                        style: categoryFilter === 'EPIC' ? 1 : 2,
                        custom_id: `wallpaper_filter_EPIC_${page}`,
                        label: '🟪 Epic',
                        disabled: categoryFilter === 'EPIC'
                    },
                    {
                        type: 2,
                        style: categoryFilter === 'MYTHIC' ? 1 : 2,
                        custom_id: `wallpaper_filter_MYTHIC_${page}`,
                        label: '🟨 Mythic',
                        disabled: categoryFilter === 'MYTHIC'
                    },
                    {
                        type: 2,
                        style: categoryFilter === 'OG' ? 1 : 2,
                        custom_id: `wallpaper_filter_OG_${page}`,
                        label: '👑 OG',
                        disabled: categoryFilter === 'OG'
                    }
                ]
            };

            container.components.push(filterButtons);
            container.components.push({
                type: 14,
                spacing: 1,
                divider: true
            });

            // إضافة الوالبيبرز
            pageWallpapers.forEach((wallpaper, index) => {
                const globalIndex = WALLPAPERS.findIndex(wp => wp.url === wallpaper.url);
                const isCurrentWallpaper = currentWallpaper === wallpaper.url;
                const category = WALLPAPER_CATEGORIES[wallpaper.category];

                // التحقق من الرتبة
                const member = interaction.guild.members.cache.get(interaction.user.id);
                const hasRequiredRole = member?.roles.cache.has(category.requiredRoleId);
                const canApply = hasRequiredRole && !isCurrentWallpaper;

                // الصورة
                container.components.push({
                    type: 12,
                    items: [{
                        media: { url: wallpaper.url },
                        description: null,
                        spoiler: false
                    }]
                });

                // ⭐⭐ معلومات الوالبيبر بدون mentions ⭐⭐
                const roleMention = `<@&${category.requiredRoleId}>`;
                container.components.push({
                    type: 10,
                    content: `-# ${category.emoji} **Category:** ${category.name} | **Required:** ${roleMention}`
                });

                // زر التطبيق - تم التعديل هنا لجعل الزر disabled عند التطبيق
                container.components.push({
                    type: 1,
                    components: [{
                        type: 2,
                        style: isCurrentWallpaper ? 1 : (canApply ? 3 : 2),
                        custom_id: `wallpaper_apply_${globalIndex}_${page}_${categoryFilter}`,
                        label: isCurrentWallpaper ? '✅ Applied' : (canApply ? '🎨 Apply' : '🔒 Locked'),
                        disabled: isCurrentWallpaper || !canApply // ⭐⭐ التعديل: جعل الزر disabled عند التطبيق ⭐⭐
                    }]
                });

                // فاصل بين الصور
                if (index < pageWallpapers.length - 1) {
                    container.components.push({
                        type: 14,
                        spacing: 1,
                        divider: true
                    });
                }
            });

            // أزرار التنقل بين الصفحات
            if (totalPages > 1) {
                container.components.push({
                    type: 14,
                    spacing: 1,
                    divider: true
                });

                container.components.push({
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 2,
                            custom_id: `wallpaper_prev_${page}_${categoryFilter}`,
                            label: '◀️ Previous',
                            disabled: page === 0
                        },
                        {
                            type: 2,
                            style: 1,
                            custom_id: `wallpaper_page_${page}`,
                            label: `📄 ${page + 1}/${totalPages}`,
                            disabled: true
                        },
                        {
                            type: 2,
                            style: 2,
                            custom_id: `wallpaper_next_${page}_${categoryFilter}`,
                            label: 'Next ▶️',
                            disabled: page === totalPages - 1
                        }
                    ]
                });
            }

            // ⭐⭐ إرسال الرسالة مع disabled mentions ⭐⭐
            const messageData = {
                components: [container],
                flags: 32768,
                allowedMentions: { users: [], roles: [], parse: [] }
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(messageData);
            } else {
                await interaction.reply(messageData);
            }

        } catch (error) {
            console.error('Error in sendWallpaperPage:', error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ Failed to load wallpapers',
                    ephemeral: true
                });
            }
        }
    },

    async handleButtonInteraction(interaction) {
        try {
            // ⭐⭐ مهم: deferUpdate أولاً ⭐⭐
            await interaction.deferUpdate();

            const customId = interaction.customId;
            const parts = customId.split('_');
            const action = `${parts[0]}_${parts[1]}`;

            if (action === 'wallpaper_filter') {
                // فلتر التصنيف
                const category = parts[2];
                const pageNum = parseInt(parts[3]);
                await this.sendWallpaperPage(interaction, pageNum, category);
            }
            else if (action === 'wallpaper_apply') {
                // تطبيق الوالبيبر
                const index = parseInt(parts[2]);
                const pageNum = parseInt(parts[3]);
                const filter = parts[4];

                if (index >= 0 && index < WALLPAPERS.length) {
                    const wallpaper = WALLPAPERS[index];
                    const category = WALLPAPER_CATEGORIES[wallpaper.category];

                    // التحقق من العضو
                    const member = interaction.guild.members.cache.get(interaction.user.id);
                    if (!member) {
                        await interaction.followUp({
                            content: '❌ Cannot find your member data',
                            ephemeral: true
                        });
                        return;
                    }

                    // التحقق من الرتبة المطلوبة
                    const hasRequiredRole = member.roles.cache.has(category.requiredRoleId);

                    if (!hasRequiredRole) {
                        await interaction.followUp({
                            content: `❌ **Access Denied!**\n\nYou need the **${category.name} Role** to apply **${category.name}** wallpapers.`,
                            ephemeral: true
                        });
                        return;
                    }

                    // التحقق إذا كان مطبق بالفعل
                    const userData = await dbManager.getUserProfile(interaction.user.id);
                    if (userData?.wallpaper_url === wallpaper.url) {
                        await interaction.followUp({
                            content: '⚠️ This wallpaper is already applied to your profile!',
                            ephemeral: true
                        });
                        return;
                    }

                    try {
                        // ⭐⭐ إزالة الرتبة إذا كان التصنيف يسمح بذلك ⭐⭐
                        if (category.removeRoleOnApply) {
                            await member.roles.remove(category.requiredRoleId);
                            console.log(`✅ Removed ${category.name} role from ${interaction.user.username}`);
                        }

                        // تحديث قاعدة البيانات
                        const result = await dbManager.run(
                            `UPDATE levels 
                             SET wallpaper_url = ?, 
                                 updated_at = CURRENT_TIMESTAMP 
                             WHERE user_id = ?`,
                            [wallpaper.url, interaction.user.id]
                        );

                        if (result.changes > 0) {
                            // بناء رسالة النجاح
                            let roleMessage = '';
                            if (category.removeRoleOnApply) {
                                roleMessage = `🔧 **Role Removed:** **${category.name} Role**`;
                            } else {
                                roleMessage = `⭐ **Role Kept:** **${category.name} Role** (OG wallpapers don't remove roles)`;
                            }

                            const successMessage = `🎉 **Wallpaper Applied Successfully!**\n\n` +
                                                  `✅ **Wallpaper:** ${category.emoji} ${wallpaper.name}\n` +
                                                  `${roleMessage}\n` +
                                                  `🎨 **Preview:** Use \`/rank\` to see your new look!`;

                            // تحديث الصفحة مع إضافة رسالة النجاح في الكونتينر
                            await this.sendWallpaperPage(interaction, pageNum, filter);

                        } else {
                            await interaction.followUp({
                                content: '❌ Failed to update your profile',
                                ephemeral: true
                            });
                        }

                    } catch (roleError) {
                        console.error('Role removal error:', roleError);
                        await interaction.followUp({
                            content: `❌ Failed to process your request: ${roleError.message}`,
                            ephemeral: true
                        });
                    }
                }
            }
            else if (action === 'wallpaper_prev') {
                // الصفحة السابقة
                const pageNum = parseInt(parts[2]);
                const filter = parts[3];
                await this.sendWallpaperPage(interaction, pageNum - 1, filter);
            }
            else if (action === 'wallpaper_next') {
                // الصفحة التالية
                const pageNum = parseInt(parts[2]);
                const filter = parts[3];
                await this.sendWallpaperPage(interaction, pageNum + 1, filter);
            }

        } catch (error) {
            console.error('Error in handleButtonInteraction:', error);
            try {
                await interaction.followUp({
                    content: '❌ An error occurred while processing your request',
                    ephemeral: true
                });
            } catch (e) {
                // تجاهل إذا كانت الرسالة محذوفة
            }
        }
    }
};