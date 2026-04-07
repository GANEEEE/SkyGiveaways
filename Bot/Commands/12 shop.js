const {
    SlashCommandBuilder,
    SectionBuilder,
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    SeparatorBuilder,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder
} = require('discord.js');
const dbManager = require('../Data/database');
const { couponSystem } = require('../LevelSystem/couponsystem');
const skyBreakGuard = require('../System/SkyBreak');
const skyPassGuard = require('../System/SkyPass');
const messageGuard = require('../System/SkyOG');
const colorsMessageGuard = require('../System/SkyColors');
const skyVoiceGuard = require('../System/SkyVoicerX');

const SHOP_LOG_CHANNEL_ID = '1434904222805004411';

// Shop session management
class ShopSessionManager {
    constructor() {
        this.sessions = new Map();
        this.refundTimers = new Map();
        this.purchaseMessages = new Map();
        this.client = null;
        this.startCleanup();
    }

    formatNumber(num) {
        if (!num || num === 0) return '0';
        return num.toLocaleString();
    }

    getSession(userId) {
        return this.sessions.get(userId);
    }

    setSession(userId, sessionData) {
        this.sessions.set(userId, {
            ...sessionData,
            lastUpdated: Date.now()
        });
    }

    deleteSession(userId) {
        return this.sessions.delete(userId);
    }

    hasSession(userId) {
        return this.sessions.has(userId);
    }

    // ✅ FIX: Added paidCoins and paidCrystals parameters to store actual paid amounts
    addRefundRequest(userId, itemId, roleId, refundMessageId, refundChannelId, purchaseId, paidCoins, paidCrystals) {
        console.log(`📝 Setting up refund timer for user ${userId}, message: ${refundMessageId}, purchase: ${purchaseId}`);

        const timer = setTimeout(() => {
            console.log(`⏰ Refund timer expired for purchase: ${purchaseId}`);
            this.removeRefundRequest(userId);
        }, 30000);

        this.refundTimers.set(userId, {
            itemId,
            roleId,
            timer,
            timestamp: Date.now(),
            refundMessageId,
            refundChannelId,
            purchaseId,
            paidCoins,    // ✅ FIX: Store actual paid coins
            paidCrystals, // ✅ FIX: Store actual paid crystals
            isProcessing: false // ✅ FIX: Flag to prevent double refund
        });

        console.log(`✅ Refund timer set for user ${userId}, total timers: ${this.refundTimers.size}`);
    }

    removeRefundRequest(userId) {
        const refund = this.refundTimers.get(userId);
        if (refund) {
            clearTimeout(refund.timer);
            this.refundTimers.delete(userId);
            console.log(`✅ Removed refund request for user ${userId}`);
        }
    }

    hasRefundRequest(userId) {
        return this.refundTimers.has(userId);
    }

    getRefundRequest(userId) {
        return this.refundTimers.get(userId);
    }

    registerPurchaseMessage(messageId, purchaseData, client) {
        console.log(`📝 Registering purchase message ${messageId} for user ${purchaseData.userId}`);
        this.client = client;
        this.purchaseMessages.set(messageId, {
            ...purchaseData,
            timestamp: Date.now()
        });
        console.log(`✅ Registered purchase message ${messageId}, total tracked: ${this.purchaseMessages.size}`);
        return messageId;
    }

    async updateMessageToCelebration(messageId) {
        try {
            const purchaseData = this.purchaseMessages.get(messageId);
            if (!purchaseData) {
                console.log(`❌ No purchase data found for message ${messageId}`);
                return false;
            }

            console.log(`🎉 Updating message ${messageId} to celebration for user ${purchaseData.username}`);

            const channel = await this.client.channels.fetch(purchaseData.channelId);
            if (!channel) {
                console.log(`❌ Channel not found: ${purchaseData.channelId}`);
                return false;
            }

            const message = await channel.messages.fetch(messageId);
            if (!message) {
                console.log(`❌ Message not found: ${messageId}`);
                return false;
            }

            let userAvatar;
            try {
                const user = await this.client.users.fetch(purchaseData.userId);
                userAvatar = user.displayAvatarURL({ extension: 'png', size: 256 });
            } catch (error) {
                console.log('⚠️ Could not fetch user avatar, using default');
                userAvatar = channel.guild.iconURL({ extension: 'png', size: 256 });
            }

            const celebrationContainer = new ContainerBuilder()
                .setAccentColor(0x0073ff)
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(
                                `## **🎉 PURCHASE COMPLETE 🎉**\n\n` +
                                `**Item:** <@&${purchaseData.roleId}>\n` +
                                /*`**Buyer:** ${purchaseData.username}\n` +*/
                                `**Cost:** ${purchaseData.finalPriceCoins > 0 ? `${this.formatNumber(purchaseData.finalPriceCoins)} <:Coins:1468446651965374534>` : ''}` +
                                `${purchaseData.finalPriceCoins > 0 && purchaseData.finalPriceCrystals > 0 ? ' + ' : ''}` +
                                `${purchaseData.finalPriceCrystals > 0 ? `${this.formatNumber(purchaseData.finalPriceCrystals)} <:Crystal:1468446688338251793>` : ''}\n` +
                                `${purchaseData.couponDiscount > 0 ? `**Discount:** 🎟️ ${purchaseData.couponDiscount}% OFF\n` : ''}` +
                                /*`${purchaseData.shopDiscount > 0 ? `**Sale:** 🔥 ${purchaseData.shopDiscount}% OFF\n` : ''}` +*/
                                `-# ✅ **Purchased Successfully, Enjoy ${purchaseData.username}**`
                            )
                        )
                        .setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription('Purchase Complete!')
                                .setURL(userAvatar)
                        )
                );

            await message.edit({
                components: [celebrationContainer],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] }
            });

            console.log(`✅ Successfully updated message ${messageId} to celebration`);
            console.log(`📤 Sending purchase confirmation to log channel after refund period ended...`);

            await sendPurchaseToLogChannelV2(this.client, {
                userId: purchaseData.userId,
                username: purchaseData.username,
                roleId: purchaseData.roleId,
                finalPriceCoins: purchaseData.finalPriceCoins,
                finalPriceCrystals: purchaseData.finalPriceCrystals,
                couponDiscount: purchaseData.couponDiscount,
                shopDiscount: purchaseData.shopDiscount,
                avatarURL: purchaseData.avatarURL,
                purchaseId: purchaseData.purchaseId
            });

            this.purchaseMessages.delete(messageId);
            return true;

        } catch (error) {
            console.error(`❌ Error updating message ${messageId} to celebration:`, error.message);
            return false;
        }
    }

    cancelPurchaseMessage(messageId) {
        if (this.purchaseMessages.has(messageId)) {
            this.purchaseMessages.delete(messageId);
            console.log(`✅ Cancelled purchase message ${messageId}`);
            return true;
        }
        return false;
    }

    getPurchaseByMessageId(messageId) {
        return this.purchaseMessages.get(messageId);
    }

    isMessageTracked(messageId) {
        return this.purchaseMessages.has(messageId);
    }

    async handlePurchaseTimeout(messageId) {
        try {
            const purchaseData = this.purchaseMessages.get(messageId);
            if (!purchaseData) {
                console.log(`❌ No purchase data found for message ${messageId}`);
                return;
            }
            this.purchaseMessages.delete(messageId);
            this.removeRefundRequest(purchaseData.userId);
            return purchaseData;
        } catch (error) {
            console.error(`❌ Error handling purchase timeout:`, error);
        }
    }

    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            let deletedCount = 0;
            let refundDeletedCount = 0;
            let messageDeletedCount = 0;

            for (const [userId, session] of this.sessions.entries()) {
                if (now - session.lastUpdated > 30 * 60 * 1000) {
                    this.sessions.delete(userId);
                    deletedCount++;
                }
            }

            for (const [userId, refund] of this.refundTimers.entries()) {
                if (now - refund.timestamp > 10000) {
                    this.removeRefundRequest(userId);
                    refundDeletedCount++;
                }
            }

            for (const [messageId, purchaseData] of this.purchaseMessages.entries()) {
                if (now - purchaseData.timestamp > 60000) {
                    this.purchaseMessages.delete(messageId);
                    messageDeletedCount++;
                }
            }

            if (deletedCount > 0 || refundDeletedCount > 0 || messageDeletedCount > 0) {
                console.log(`🧹 Cleaned ${deletedCount} shop sessions, ${refundDeletedCount} refund requests, ${messageDeletedCount} purchase messages`);
            }
        }, 5 * 60 * 1000);
    }
}

const shopSessionManager = new ShopSessionManager();

// دالة إرسال الشراء للوج
async function sendPurchaseToLogChannelV2(client, purchaseData) {
    try {
        const logChannel = await client.channels.fetch(SHOP_LOG_CHANNEL_ID);
        if (!logChannel) {
            console.error('❌ Shop log channel not found');
            return false;
        }

        const logSection = new SectionBuilder()
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## 🛒 **PURCHASE CONFIRMED** 🛒\n\n` +
                    `**Buyer:** <@${purchaseData.userId}> (${purchaseData.username})\n` +
                    `**Item:** <@&${purchaseData.roleId}>\n` +
                    `**Cost:** ` +
                    (purchaseData.finalPriceCoins > 0 ? `**${shopSessionManager.formatNumber(purchaseData.finalPriceCoins)}** <:Coins:1468446651965374534>` : '') +
                    (purchaseData.finalPriceCoins > 0 && purchaseData.finalPriceCrystals > 0 ? ' + ' : '') +
                    (purchaseData.finalPriceCrystals > 0 ? `**${shopSessionManager.formatNumber(purchaseData.finalPriceCrystals)}** <:Crystal:1468446688338251793>` : '') + '\n' +
                    `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                    (purchaseData.couponDiscount > 0 ? `🎟️ **Coupon:** ${purchaseData.couponDiscount}% OFF\n` : '') +
                    (purchaseData.shopDiscount > 0 ? `🔥 **Shop Sale:** ${purchaseData.shopDiscount}% OFF\n` : '') +
                    `\n✅ **Transaction Completed Successfully**`
                )
            )
            .setThumbnailAccessory((thumbnail) =>
                thumbnail
                    .setDescription(`Purchase by ${purchaseData.username}`)
                    .setURL(purchaseData.avatarURL || client.user.displayAvatarURL({ extension: 'png', size: 256 }))
            );

        const logContainer = new ContainerBuilder()
            .setAccentColor(0x0073ff)
            .addSectionComponents((section) => logSection);

        await logChannel.send({
            components: [logContainer],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        });

        console.log(`✅ Purchase logged in channel: ${SHOP_LOG_CHANNEL_ID}`);
        return true;

    } catch (error) {
        console.error('❌ Failed to send purchase to log channel:', error.message);
        return false;
    }
}

// دالة مساعدة لجلب السيل الحالي مع نسبة الخصم (للعرض فقط)
async function getActiveSaleText() {
    try {
        console.log('🔍 Checking for active sales...');
        const activeSales = await dbManager.all(
            `SELECT sc.username, sc.expires_at, sc.discount_percentage
             FROM shop_coupons sc
             WHERE sc.source_drop_type = 'admin_sale' 
             AND sc.is_used = false 
             AND sc.expires_at > NOW()
             ORDER BY sc.created_at DESC 
             LIMIT 1`
        );
        console.log('🔍 Active sales found:', activeSales?.length, activeSales);
        if (activeSales && activeSales.length > 0) {
            const sale = activeSales[0];
            const expiryTimestamp = Math.floor(new Date(sale.expires_at).getTime() / 1000);
            return `\n-# Sale on: **${sale.username}** | **${sale.discount_percentage}% Discount** | Ends <t:${expiryTimestamp}:R>`;
        }
    } catch (err) {
        console.error('Error fetching active sale:', err.message);
    }
    return '';
}

// دالة للحصول على تخفيض الـ Admin Sale النشط (للاستخدام في الحسابات)
async function getActiveAdminSale() {
    try {
        const activeSale = await dbManager.all(
            `SELECT discount_percentage, expires_at, coupon_code
             FROM shop_coupons
             WHERE source_drop_type = 'admin_sale'
               AND is_used = false
               AND expires_at > NOW()
             ORDER BY created_at DESC
             LIMIT 1`
        );
        if (activeSale && activeSale.length > 0) {
            return {
                discount: activeSale[0].discount_percentage,
                expiresAt: activeSale[0].expires_at,
                couponCode: activeSale[0].coupon_code
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching active admin sale:', error);
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('🛒 Browse and purchase items from the shop')
        .setDMPermission(false),

    async getCouponExpiryInfo(coupons) {
        if (!coupons || coupons.length === 0) return null;

        const sortedCoupons = coupons.sort((a, b) =>
            new Date(a.expires_at) - new Date(b.expires_at)
        );

        const nearestCoupon = sortedCoupons[0];
        const expiresAt = new Date(nearestCoupon.expires_at);

        return {
            count: coupons.length,
            nearestExpiry: expiresAt,
            timestamp: Math.floor(expiresAt.getTime() / 1000),
            discountPercentage: nearestCoupon.discount_percentage
        };
    },

    async execute(interaction) {
        try {
            console.log(`🛒 /shop command by ${interaction.user.tag}`);

            const userData = await dbManager.getUserProfile(interaction.user.id);
            if (!userData) {
                return await interaction.reply({
                    content: '❌ **No Account Found**\nSend a message in chat to create your account first.',
                    ephemeral: true
                });
            }

            const activeCoupons = await couponSystem.getActiveCoupons(interaction.user.id);
            userData.activeCoupons = activeCoupons.length;

            const items = await dbManager.getActiveShopItems();
            if (items.length === 0) {
                return await this.displayEmptyShop(interaction, userData);
            }

            await this.displayShopPage(interaction, 1, items, userData, true);

        } catch (error) {
            console.error('Error executing shop command:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription('❌ **An error occurred while loading the shop**\nPlease try again later')
                .setTimestamp();

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed], components: [], allowedMentions: { parse: [] } });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true, allowedMentions: { parse: [] } });
            }
        }
    },

    async displayEmptyShop(interaction, userData) {
        const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 });

        const coupons = await couponSystem.getActiveCoupons(interaction.user.id);
        const couponInfo = coupons.length > 0 ? await this.getCouponExpiryInfo(coupons) : null;

        const activeSaleText = await getActiveSaleText();

        let userInfoText = `# 🛒 **GAMERSKY SHOP**\n` +
            `### Welcome to our server shop!\n\n` +
            `Your Balance: **${userData.sky_coins.toLocaleString()}** <:Coins:1468446651965374534> ||&|| ` +
            `**${userData.sky_crystals.toLocaleString()}** <:Crystal:1468446688338251793>`;

        if (activeSaleText) userInfoText += activeSaleText;

        if (couponInfo && couponInfo.count > 0) {
            if (couponInfo.count === 1) {
                userInfoText += `\n-# 🎟️ Active Coupon: **1** | **${couponInfo.discountPercentage}% Discount** | Expires <t:${couponInfo.timestamp}:R>`;
            } else {
                userInfoText += `\n-# 🎟️ Active Coupons: **${couponInfo.count}** | Best: **${couponInfo.discountPercentage}% Discount** | Earliest expires <t:${couponInfo.timestamp}:R>`;
            }
        } else if (userData.activeCoupons && userData.activeCoupons > 0) {
            userInfoText += `\n-# 🎟️ Active Coupons: **${userData.activeCoupons}**`;
        }

        const firstSection = new SectionBuilder()
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(userInfoText)
            )
            .setThumbnailAccessory((thumbnail) =>
                thumbnail
                    .setDescription(`${interaction.guild.name} Shop`)
                    .setURL(serverIcon)
            );

        const secondSection = new SectionBuilder()
            .setButtonAccessory((button) =>
                button
                    .setCustomId('shop_refresh')
                    .setLabel('Check back later')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            )
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent('**Shop is currently empty!**')
            );

        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff)
            .addSectionComponents((section) => firstSection)
            .addSeparatorComponents((separator) => new SeparatorBuilder().setDivider(true))
            .addSectionComponents((section) => secondSection);

        const response = await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: false,
            fetchReply: true,
            allowedMentions: { parse: [] }
        });

        shopSessionManager.setSession(interaction.user.id, {
            page: 1,
            items: [],
            messageId: response.id,
            channelId: interaction.channelId,
            totalPages: 1,
            userData: userData
        });
    },

    async displayShopPage(interaction, pageNumber, allItems, userData, isNewCommand = false) {
        try {
            const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 });
            const itemsPerPage = 5;
            const totalPages = Math.max(1, Math.ceil(allItems.length / itemsPerPage));

            if (pageNumber > totalPages) pageNumber = totalPages;
            if (pageNumber < 1) pageNumber = 1;

            const startIndex = (pageNumber - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const pageItems = allItems.slice(startIndex, endIndex);

            // جلب الكوبونات الشخصية فقط إذا لم يكن هناك Sale Admin نشط
            let couponInfo = null;
            const adminSale = await getActiveAdminSale();
            if (!adminSale) {
                const coupons = await couponSystem.getActiveCoupons(interaction.user.id);
                couponInfo = coupons.length > 0 ? await this.getCouponExpiryInfo(coupons) : null;
            }

            const container = await this.buildShopContainer(
                interaction, pageNumber, totalPages, pageItems, userData, serverIcon, couponInfo, adminSale
            );

            const userSession = shopSessionManager.getSession(interaction.user.id);

            if (userSession && userSession.messageId && userSession.channelId && !isNewCommand) {
                try {
                    const channel = await interaction.guild.channels.fetch(userSession.channelId);
                    const message = await channel.messages.fetch(userSession.messageId);

                    if (message.author.id === interaction.client.user.id) {
                        await message.edit({
                            components: [container],
                            flags: MessageFlags.IsComponentsV2,
                            allowedMentions: { parse: [] }
                        });

                        shopSessionManager.setSession(interaction.user.id, {
                            ...userSession,
                            page: pageNumber,
                            items: allItems,
                            totalPages: totalPages,
                            userData: userData
                        });

                        if (interaction.isButton()) {
                            await interaction.deferUpdate().catch(() => {});
                        }

                        return;
                    }
                } catch (error) {
                    console.log('⚠️ Could not edit original message:', error.message);
                }
            }

            let response;

            if (interaction.deferred || interaction.replied) {
                response = await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] },
                    fetchReply: true
                });
            } else {
                response = await interaction.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: false,
                    allowedMentions: { parse: [] },
                    fetchReply: true
                });
            }

            shopSessionManager.setSession(interaction.user.id, {
                page: pageNumber,
                items: allItems,
                messageId: response.id,
                channelId: response.channelId || interaction.channelId,
                totalPages: totalPages,
                userData: userData
            });

        } catch (error) {
            console.error('Error in displayShopPage:', error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Error displaying shop. Please use `/shop` again.',
                    ephemeral: true
                });
            }
        }
    },

    async buildShopContainer(interaction, pageNumber, totalPages, pageItems, userData, serverIcon, couponInfo = null, adminSale = null) {
        const hasAdminSale = adminSale !== null;
        let couponDiscount = 0;
        let couponCodeForButton = 'nocoupon';

        if (hasAdminSale) {
            couponDiscount = adminSale.discount;
            couponCodeForButton = 'adminsale';
            // لا نجلب الكوبونات الشخصية عند وجود Sale Admin
        } else {
            // استخدام الكوبون الشخصي الأفضل إن وجد
            if (couponInfo && couponInfo.count > 0) {
                couponDiscount = couponInfo.discountPercentage;
                // نحتاج للكوبون الفعلي من قاعدة البيانات للحصول على الكود
                const coupons = await couponSystem.getActiveCoupons(interaction.user.id);
                if (coupons.length > 0) {
                    couponCodeForButton = coupons[0].coupon_code;
                }
            }
        }

        // عرض معلومات السيل في الواجهة
        const activeSaleText = await getActiveSaleText();

        let userInfoText = `# 🛒 **GAMERSKY SHOP**\n` +
            `### Welcome to our server shop, browse and purchase items\n\n` +
            `Your Balance: **${userData.sky_coins.toLocaleString()} <:Coins:1468446651965374534>** ||&|| ` +
            `**${userData.sky_crystals.toLocaleString()} <:Crystal:1468446688338251793>**`;

        if (activeSaleText) userInfoText += activeSaleText;

        // عرض معلومات الكوبونات الشخصية فقط في حالة عدم وجود Sale Admin
        if (!hasAdminSale && couponInfo && couponInfo.count > 0) {
            if (couponInfo.count === 1) {
                userInfoText += `\n-# 🎟️ Active Coupon: **1** | **${couponInfo.discountPercentage}% Discount** | Expires <t:${couponInfo.timestamp}:R>`;
            } else {
                userInfoText += `\n-# 🎟️ Active Coupons: **${couponInfo.count}** | Best: **${couponInfo.discountPercentage}% Discount** | Earliest expires <t:${couponInfo.timestamp}:R>`;
            }
        } else if (!hasAdminSale && userData.activeCoupons && userData.activeCoupons > 0) {
            userInfoText += `\n-# 🎟️ Active Coupons: **${userData.activeCoupons}**`;
        }

        const firstSection = new SectionBuilder()
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(userInfoText)
            )
            .setThumbnailAccessory((thumbnail) =>
                thumbnail
                    .setDescription(`${interaction.guild.name} Shop`)
                    .setURL(serverIcon)
            );

        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff)
            .addSectionComponents((section) => firstSection)
            .addSeparatorComponents((separator) => new SeparatorBuilder().setDivider(true));

        for (const item of pageItems) {
            const emoji = item.item_emoji && item.item_emoji.trim() !== '' ? item.item_emoji : '';
            const role = interaction.guild.roles.cache.get(item.role_id);
            const roleMention = role ? `<@&${item.role_id}>` : `Unknown Role`;

            const member = interaction.guild.members.cache.get(interaction.user.id);
            const hasRole = member ? member.roles.cache.has(item.role_id) : false;

            const hasRefundRequest = shopSessionManager.hasRefundRequest(interaction.user.id);
            const refundData = shopSessionManager.getRefundRequest(interaction.user.id);
            const isRefundForThisItem = hasRefundRequest && refundData && refundData.roleId === item.role_id;

            let originalPriceCoins = item.original_price_coins;
            let originalPriceCrystals = item.original_price_crystals;
            let finalPriceCoins = originalPriceCoins;
            let finalPriceCrystals = originalPriceCrystals;

            // تطبيق التخفيض حسب الأولوية
            if (item.is_on_sale && item.current_discount > 0) {
                let salePriceCoins = item.discounted_price_coins || Math.floor(originalPriceCoins * (1 - item.current_discount / 100));
                let salePriceCrystals = item.discounted_price_crystals || Math.floor(originalPriceCrystals * (1 - item.current_discount / 100));
                finalPriceCoins = salePriceCoins;
                finalPriceCrystals = salePriceCrystals;
            } else {
                finalPriceCoins = originalPriceCoins;
                finalPriceCrystals = originalPriceCrystals;
            }

            // تطبيق الكوبون (Admin Sale أو شخصي)
            if (couponDiscount > 0) {
                finalPriceCoins = Math.floor(finalPriceCoins * (1 - couponDiscount / 100));
                finalPriceCrystals = Math.floor(finalPriceCrystals * (1 - couponDiscount / 100));
            }

            // Price text for button
            let priceTextForButton = '';
            if (finalPriceCoins > 0 && finalPriceCrystals > 0) {
                priceTextForButton = `${shopSessionManager.formatNumber(finalPriceCoins)} 🪙 & ${shopSessionManager.formatNumber(finalPriceCrystals)} 💎`;
            } else if (finalPriceCoins > 0) {
                priceTextForButton = `${shopSessionManager.formatNumber(finalPriceCoins)} 🪙`;
            } else if (finalPriceCrystals > 0) {
                priceTextForButton = `${shopSessionManager.formatNumber(finalPriceCrystals)} 💎`;
            } else {
                priceTextForButton = 'FREE';
            }

            const canAfford = userData.sky_coins >= finalPriceCoins && userData.sky_crystals >= finalPriceCrystals;

            // Stock text
            let stockText = '';
            if (item.quantity === -1) {
                stockText = '♾️ Unlimited';
            } else if (item.quantity === 0) {
                stockText = '⛔ Unavailable';
            } else if (item.quantity <= 2) {
                stockText = `🟡 x${item.quantity} Left`;
            } else {
                stockText = `🟢 x${item.quantity} In Stock`;
            }

            const isAvailable = item.quantity === -1 || item.quantity > 0;
            const canPurchase = canAfford && isAvailable && !hasRole && !isRefundForThisItem;

            // Role line with stock
            let roleAndDescription = `### ${emoji}${emoji ? ' ' : ''}${roleMention}\n`;

            if (item.description && item.description.trim() !== '') {
                roleAndDescription += `${item.description}\n\n`;
            }

            // Price display
            let displayedPriceText = '';

            if (couponDiscount > 0) {
                // Show original + discount applied
                let originalParts = [];
                let finalParts = [];
                if (originalPriceCoins > 0) {
                    originalParts.push(`${shopSessionManager.formatNumber(originalPriceCoins)} <:Coins:1468446651965374534>`);
                    finalParts.push(`${shopSessionManager.formatNumber(finalPriceCoins)} <:Coins:1468446651965374534>`);
                }
                if (originalPriceCrystals > 0) {
                    originalParts.push(`${shopSessionManager.formatNumber(originalPriceCrystals)} <:Crystal:1468446688338251793>`);
                    finalParts.push(`${shopSessionManager.formatNumber(finalPriceCrystals)} <:Crystal:1468446688338251793>`);
                }
                if (item.is_on_sale && item.current_discount > 0) {
                    displayedPriceText = `**Price:** ~~${originalParts.join(' & ')}~~ → **${finalParts.join(' & ')}**`;
                } else {
                    displayedPriceText = `**Price:** ~~${originalParts.join(' & ')}~~ → **${finalParts.join(' & ')}**`;
                }
            } else if (item.is_on_sale && item.current_discount > 0) {
                const salePriceCoins = item.discounted_price_coins || Math.floor(originalPriceCoins * (1 - item.current_discount / 100));
                const salePriceCrystals = item.discounted_price_crystals || Math.floor(originalPriceCrystals * (1 - item.current_discount / 100));
                let originalParts = [];
                let finalParts = [];
                if (originalPriceCoins > 0) {
                    originalParts.push(`${shopSessionManager.formatNumber(originalPriceCoins)} <:Coins:1468446651965374534>`);
                    finalParts.push(`${shopSessionManager.formatNumber(salePriceCoins)} <:Coins:1468446651965374534>`);
                }
                if (originalPriceCrystals > 0) {
                    originalParts.push(`${shopSessionManager.formatNumber(originalPriceCrystals)} <:Crystal:1468446688338251793>`);
                    finalParts.push(`${shopSessionManager.formatNumber(salePriceCrystals)} <:Crystal:1468446688338251793>`);
                }
                displayedPriceText = `**Price:** ~~${originalParts.join(' & ')}~~ → **${finalParts.join(' & ')}**`;
            } else {
                let priceParts = [];
                if (originalPriceCoins > 0 && originalPriceCrystals > 0) {
                    priceParts.push(`${shopSessionManager.formatNumber(originalPriceCoins)} <:Coins:1468446651965374534> & ${shopSessionManager.formatNumber(originalPriceCrystals)} <:Crystal:1468446688338251793>`);
                } else if (originalPriceCoins > 0) {
                    priceParts.push(`${shopSessionManager.formatNumber(originalPriceCoins)} <:Coins:1468446651965374534>`);
                } else if (originalPriceCrystals > 0) {
                    priceParts.push(`${shopSessionManager.formatNumber(originalPriceCrystals)} <:Crystal:1468446688338251793>`);
                } else {
                    priceParts.push('🎁 FREE');
                }
                displayedPriceText = `**Price:** ${priceParts.join('')}`;
            }

            roleAndDescription += displayedPriceText + '\n';
            roleAndDescription += `-# ${stockText}\n`;

            const itemSection = new SectionBuilder();

            let sectionContent = roleAndDescription.trim();

            itemSection.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(sectionContent)
            );

            // Button
            if (isRefundForThisItem) {
                itemSection.setButtonAccessory((button) =>
                    button
                        .setCustomId(`refund_${item.role_id}_${item.id}`)
                        .setLabel('⚠️ Refund Pending...')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true)
                );
            } else if (hasRole) {
                itemSection.setButtonAccessory((button) =>
                    button
                        .setCustomId(`purchased_${item.role_id}`)
                        .setLabel('✅ Purchased')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            } else if (canPurchase) {
                itemSection.setButtonAccessory((button) =>
                    button
                        .setCustomId(`buy_item_${item.id}_${couponCodeForButton}`)
                        .setLabel(`BUY (${priceTextForButton})`)
                        .setStyle(ButtonStyle.Success)
                );
            } else {
                itemSection.setButtonAccessory((button) =>
                    button
                        .setCustomId(`buy_item_${item.id}_nocoupon`)
                        .setLabel(`BUY (${priceTextForButton})`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            }

            container
                .addSectionComponents((section) => itemSection)
                .addSeparatorComponents((separator) => new SeparatorBuilder().setDivider(true));
        }

        const navigationSection = new SectionBuilder();

        navigationSection.setButtonAccessory((button) =>
            button
                .setCustomId('shop_next_page')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pageNumber >= totalPages)
        );

        navigationSection.addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(`-# Page ${pageNumber} of ${totalPages}`)
        );

        container.addSectionComponents((section) => navigationSection);

        if (pageNumber > 1) {
            container.addActionRowComponents((actionRow) =>
                actionRow.setComponents(
                    new ButtonBuilder()
                        .setCustomId('shop_prev_page')
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Secondary)
                )
            );
        }

        return container;
    },

    async buttonHandler(interaction) {
        try {
            console.log(`🛒 Shop button clicked: ${interaction.customId} by ${interaction.user.tag}`);

            const userSession = shopSessionManager.getSession(interaction.user.id);

            if (userSession && userSession.messageId) {
                try {
                    const channel = await interaction.guild.channels.fetch(userSession.channelId);
                    const message = await channel.messages.fetch(userSession.messageId);

                    if (message.author.id !== interaction.client.user.id) {
                        shopSessionManager.deleteSession(interaction.user.id);
                        const userData = await dbManager.getUserProfile(interaction.user.id);
                        const items = await dbManager.getActiveShopItems();
                        return await this.displayShopPage(interaction, 1, items, userData, true);
                    }
                } catch (error) {
                    shopSessionManager.deleteSession(interaction.user.id);
                    const userData = await dbManager.getUserProfile(interaction.user.id);
                    const items = await dbManager.getActiveShopItems();
                    return await this.displayShopPage(interaction, 1, items, userData, true);
                }
            }

            if (interaction.customId === 'shop_next_page') {
                if (!userSession) {
                    const userData = await dbManager.getUserProfile(interaction.user.id);
                    const items = await dbManager.getActiveShopItems();
                    return await this.displayShopPage(interaction, 1, items, userData, true);
                }
                const newPage = userSession.page + 1;
                if (newPage <= userSession.totalPages) {
                    await interaction.deferUpdate().catch(() => {});
                    return await this.displayShopPage(interaction, newPage, userSession.items, userSession.userData);
                }
            } else if (interaction.customId === 'shop_prev_page') {
                if (!userSession) {
                    const userData = await dbManager.getUserProfile(interaction.user.id);
                    const items = await dbManager.getActiveShopItems();
                    return await this.displayShopPage(interaction, 1, items, userData, true);
                }
                const newPage = userSession.page - 1;
                if (newPage >= 1) {
                    await interaction.deferUpdate().catch(() => {});
                    return await this.displayShopPage(interaction, newPage, userSession.items, userSession.userData);
                }
            } else if (interaction.customId.startsWith('buy_item_')) {
                return await this.handlePurchase(interaction, interaction.customId);
            } else if (interaction.customId.startsWith('refund_')) {
                return await this.handleRefund(interaction);
            }

        } catch (error) {
            console.error('Error in shop button handler:', error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred. Please try again.',
                    ephemeral: true
                });
            }
        }
    },

    async handlePurchase(interaction, fullCustomId) {
        try {
            await interaction.deferUpdate();

            const parts = fullCustomId.split('_');
            if (parts.length < 3) {
                return await interaction.followUp({ content: '❌ Invalid purchase request.', ephemeral: true });
            }

            const itemId = parts[2];
            const couponCode = parts[3] !== 'nocoupon' ? parts[3] : null;

            const item = await dbManager.getShopItemById(itemId);
            if (!item) {
                return await interaction.followUp({ content: '❌ Item not found or has been removed.', ephemeral: true });
            }

            // SKY BREAK CHECK
            const securityCheck = await skyBreakGuard.validatePurchase(interaction.user, interaction.guild, item.role_id);
            if (!securityCheck.allowed && securityCheck.isSkyBreak) {
                return await interaction.followUp({ embeds: [securityCheck.embed], ephemeral: false });
            }

            // MESSAGE REQUIREMENT CHECK
            const requirementCheck = await messageGuard.validatePurchase(interaction.user, interaction.guild, item.role_id);
            if (!requirementCheck.allowed && requirementCheck.isTargetRole) {
                return await interaction.followUp({ embeds: [requirementCheck.embed], ephemeral: false });
            }

            // COLORS CHECK
            const colorsCheck = await colorsMessageGuard.validatePurchase(interaction.user, interaction.guild, item.role_id);
            if (!colorsCheck.allowed && colorsCheck.isColorsRole) {
                return await interaction.followUp({ embeds: [colorsCheck.embed], ephemeral: false });
            }

            // VOICE POINTS CHECK
            const voicePointsCheck = await skyVoiceGuard.validatePurchase(interaction.user, interaction.guild, item.role_id);
            if (!voicePointsCheck.allowed && voicePointsCheck.isTargetRole) {
                return await interaction.followUp({ embeds: [voicePointsCheck.embed], ephemeral: false });
            }

            // Determine discount and coupon usage
            let couponDiscount = 0;
            let couponId = null;

            if (couponCode === 'adminsale') {
                const adminSale = await getActiveAdminSale();
                if (!adminSale) {
                    return await interaction.followUp({ content: '❌ Sale has expired.', ephemeral: true });
                }
                couponDiscount = adminSale.discount;
                // No couponId, so we won't consume any coupon
            } else if (couponCode && couponCode !== 'nocoupon') {
                const validation = await couponSystem.validateCoupon(interaction.user.id, couponCode);
                if (validation.valid) {
                    couponDiscount = validation.discountPercentage;
                    couponId = validation.coupon.id;
                }
            }

            const userData = await dbManager.getUserProfile(interaction.user.id);
            if (!userData) {
                return await interaction.followUp({ content: '❌ User account not found.', ephemeral: true });
            }

            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (member && member.roles.cache.has(item.role_id)) {
                return await interaction.followUp({ content: '❌ You already have this role!', ephemeral: true });
            }

            if (item.quantity !== -1 && item.quantity <= 0) {
                return await interaction.followUp({ content: '❌ This item is out of stock!', ephemeral: true });
            }

            let originalPriceCoins = item.original_price_coins;
            let originalPriceCrystals = item.original_price_crystals;
            let finalPriceCoins = originalPriceCoins;
            let finalPriceCrystals = originalPriceCrystals;

            if (item.is_on_sale && item.current_discount > 0) {
                let salePriceCoins = item.discounted_price_coins || Math.floor(originalPriceCoins * (1 - item.current_discount / 100));
                let salePriceCrystals = item.discounted_price_crystals || Math.floor(originalPriceCrystals * (1 - item.current_discount / 100));
                finalPriceCoins = salePriceCoins;
                finalPriceCrystals = salePriceCrystals;
            }

            if (couponDiscount > 0) {
                finalPriceCoins = Math.floor(finalPriceCoins * (1 - couponDiscount / 100));
                finalPriceCrystals = Math.floor(finalPriceCrystals * (1 - couponDiscount / 100));
            }

            if (userData.sky_coins < finalPriceCoins || userData.sky_crystals < finalPriceCrystals) {
                return await interaction.followUp({ content: '❌ You cannot afford this item!', ephemeral: true });
            }

            if (shopSessionManager.hasRefundRequest(interaction.user.id)) {
                return await interaction.followUp({ content: '❌ You have a pending refund request. Please wait for it to expire.', ephemeral: true });
            }

            const role = interaction.guild.roles.cache.get(item.role_id);
            if (!role) {
                return await interaction.followUp({ content: '❌ Role not found. Please contact an administrator.', ephemeral: true });
            }

            try {
                await member.roles.add(role);
            } catch (roleError) {
                console.error('Error adding role:', roleError);
                return await interaction.followUp({ content: '❌ Could not give you the role. Please contact an administrator.', ephemeral: true });
            }

            await dbManager.run(
                `UPDATE levels SET sky_coins = sky_coins - ?, sky_crystals = sky_crystals - ? WHERE user_id = ?`,
                [finalPriceCoins, finalPriceCrystals, interaction.user.id]
            );

            if (item.quantity !== -1 && item.quantity > 0) {
                await dbManager.run(`UPDATE shop_items SET quantity = quantity - 1 WHERE id = ?`, [itemId]);
            }

            // Consume personal coupon if used
            if (couponId) {
                await couponSystem.useCoupon(couponId);
                console.log(`✅ Used coupon for purchase of item ${itemId}`);
            }

            // Remove shop discount if item was on sale (admin sale is not removed here)
            if (item.is_on_sale && item.current_discount > 0) {
                await dbManager.removeDiscountOnPurchase(itemId);
                console.log(`🔄 Discount removed from purchased item`);
            }

            const purchaseId = `purchase_${Date.now()}_${interaction.user.id}_${itemId}`;
            console.log(`🆔 Generated purchase ID: ${purchaseId}`);

            const successContainer = new ContainerBuilder()
                .setAccentColor(0x0073ff)
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(
                                `## ✅ **PURCHASE SUCCESSFUL!**\n\n` +
                                `Item: <@&${item.role_id}>\n` +
                                `Cost: ${finalPriceCoins > 0 ? `**${shopSessionManager.formatNumber(finalPriceCoins)} <:Coins:1468446651965374534>**` : ''}` +
                                `${finalPriceCoins > 0 && finalPriceCrystals > 0 ? ' ||&|| ' : ''}` +
                                `${finalPriceCrystals > 0 ? `**${shopSessionManager.formatNumber(finalPriceCrystals)} <:Crystal:1468446688338251793>**` : ''}` +
                                /*`${couponDiscount > 0 ? `\nCoupon Used: **🎟️ ${couponDiscount}% OFF**` : ''}` +*/
                                `${item.is_on_sale && item.current_discount > 0 ? `\nShop Sale: **🔥 ${item.current_discount}% OFF**` : ''}`
                            )
                        )
                        .setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription(`${interaction.user.username}'s Purchase`)
                                .setURL(interaction.user.displayAvatarURL({ extension: 'png', size: 256 }))
                        )
                )
                .addSeparatorComponents((separator) => separator.setDivider(true))
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(`**⚠️ You have 30 seconds to refund this purchase**`)
                        )
                        .setButtonAccessory((button) =>
                            button
                                .setCustomId(`refund_${item.role_id}_${itemId}_${purchaseId}`)
                                .setLabel('Refund Purchase')
                                .setStyle(ButtonStyle.Danger)
                        )
                );

            const channel = interaction.channel;
            const refundMessage = await channel.send({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] }
            });

            console.log(`📝 Sent purchase message with ID: ${refundMessage.id}, Purchase ID: ${purchaseId}`);

            const purchaseData = {
                itemId: itemId,
                roleId: item.role_id,
                finalPriceCoins: finalPriceCoins,
                finalPriceCrystals: finalPriceCrystals,
                couponDiscount: couponDiscount,
                shopDiscount: item.is_on_sale ? item.current_discount : 0,
                avatarURL: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
                userId: interaction.user.id,
                username: interaction.user.username,
                guildId: interaction.guild.id,
                purchaseId: purchaseId,
                channelId: refundMessage.channelId,
                messageId: refundMessage.id
            };

            shopSessionManager.registerPurchaseMessage(refundMessage.id, purchaseData, interaction.client);

            // ✅ FIX: Pass finalPriceCoins and finalPriceCrystals to store actual paid amounts
            shopSessionManager.addRefundRequest(
                interaction.user.id,
                itemId,
                item.role_id,
                refundMessage.id,
                refundMessage.channelId,
                purchaseId,
                finalPriceCoins,    // ✅ actual paid coins
                finalPriceCrystals  // ✅ actual paid crystals
            );

            const updateTimeout = setTimeout(async () => {
                try {
                    if (shopSessionManager.isMessageTracked(refundMessage.id)) {
                        // APPLY BUFF
                        if (item.buff_type && item.buff_type !== 'none' && item.buff_duration_minutes > 0) {
                            try {
                                const expiresAt = new Date(Date.now() + item.buff_duration_minutes * 60000);
                                await dbManager.run(
                                    `INSERT INTO active_buffs (user_id, buff_type, duration_minutes, expires_at, shop_item_id, role_id) VALUES (?, ?, ?, ?, ?, ?)`,
                                    [interaction.user.id, item.buff_type, item.buff_duration_minutes, expiresAt, item.id, item.role_id]
                                );
                                console.log(`🎁 Applied ${item.buff_type} buff for ${item.buff_duration_minutes} minutes`);
                            } catch (error) {
                                console.error('❌ Error applying buff:', error.message);
                            }
                        }

                        // REMOVE CHAMPIONREST
                        if (item.role_id === skyBreakGuard.SKY_BREAK_ROLE_ID) {
                            try {
                                await skyBreakGuard.removeChampionRestAfterPurchase(interaction.user.id, interaction.guild);
                            } catch (removeError) {
                                console.error(`💥 Error in ChampionRest removal:`, removeError);
                            }
                        }

                        // SKYPASS CONVERSION
                        if (item.role_id === skyPassGuard.SKY_PASS_ROLE_ID) {
                            try {
                                await skyPassGuard.convertToTemprole(interaction.guild, interaction.user.id, item.role_id);
                            } catch (skyPassError) {
                                console.error(`💥 Error in SkyPass conversion:`, skyPassError);
                            }
                        }

                        await shopSessionManager.updateMessageToCelebration(refundMessage.id);
                    }

                    shopSessionManager.removeRefundRequest(interaction.user.id);

                    setTimeout(async () => {
                        try {
                            const updatedUserData = await dbManager.getUserProfile(interaction.user.id);
                            const updatedItems = await dbManager.getActiveShopItems();
                            const userSession = shopSessionManager.getSession(interaction.user.id);

                            if (userSession && userSession.messageId && userSession.channelId) {
                                const currentPage = userSession.page || 1;
                                const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 });
                                const itemsPerPage = 5;
                                const totalPages = Math.max(1, Math.ceil(updatedItems.length / itemsPerPage));
                                const pageItems = updatedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                                // جلب الكوبونات الشخصية فقط إذا لم يكن هناك Sale Admin
                                let couponInfo = null;
                                const adminSale = await getActiveAdminSale();
                                if (!adminSale) {
                                    const coupons = await couponSystem.getActiveCoupons(interaction.user.id);
                                    couponInfo = coupons.length > 0 ? await this.getCouponExpiryInfo(coupons) : null;
                                }

                                const container = await this.buildShopContainer(interaction, currentPage, totalPages, pageItems, updatedUserData, serverIcon, couponInfo, adminSale);

                                const shopChannel = await interaction.guild.channels.fetch(userSession.channelId).catch(() => null);
                                if (shopChannel) {
                                    const originalMessage = await shopChannel.messages.fetch(userSession.messageId).catch(() => null);
                                    if (originalMessage) {
                                        await originalMessage.edit({
                                            components: [container],
                                            flags: MessageFlags.IsComponentsV2,
                                            allowedMentions: { parse: [] }
                                        });
                                        console.log(`✅ Shop interface updated successfully`);
                                    }
                                }
                            }
                        } catch (shopUpdateError) {
                            console.error('Error updating shop after timeout:', shopUpdateError.message);
                        }
                    }, 500);

                } catch (error) {
                    console.error('❌ Error in timeout callback:', error);
                }
            }, 30000);

            const userSession = shopSessionManager.getSession(interaction.user.id);
            if (userSession) {
                userSession.updateTimeout = updateTimeout;
                shopSessionManager.setSession(interaction.user.id, userSession);
            }

            const updatedUserData = await dbManager.getUserProfile(interaction.user.id);
            const updatedItems = await dbManager.getActiveShopItems();
            const currentPage = userSession?.page || 1;

            await this.displayShopPage(interaction, currentPage, updatedItems, updatedUserData);

        } catch (error) {
            console.error('❌ Error in handlePurchase:', error);
            await interaction.followUp({ content: '❌ An error occurred during purchase. Please try again.', ephemeral: true });
        }
    },

    async handleRefund(interaction) {
        try {
            console.log(`🔄 Starting refund process for ${interaction.user.tag}`);

            const customId = interaction.customId;
            const parts = customId.split('_');

            if (parts.length < 4) {
                return await interaction.reply({ content: '❌ Invalid refund request.', ephemeral: true });
            }

            const roleId = parts[1];
            const itemId = parts[2];
            const purchaseId = parts.slice(3).join('_');

            const refundData = shopSessionManager.getRefundRequest(interaction.user.id);
            if (!refundData) {
                return await interaction.reply({ content: '❌ Refund window has expired! (30 seconds passed)', ephemeral: true });
            }

            if (refundData.purchaseId !== purchaseId) {
                return await interaction.reply({ content: '❌ Invalid refund request.', ephemeral: true });
            }

            // ✅ FIX: Prevent double-click / double refund
            if (refundData.isProcessing) {
                return await interaction.reply({ content: '❌ Refund is already being processed. Please wait.', ephemeral: true });
            }

            // ✅ FIX: Mark as processing immediately to block any duplicate requests
            refundData.isProcessing = true;
            shopSessionManager.refundTimers.set(interaction.user.id, refundData);

            await interaction.deferReply({ ephemeral: true });

            const userSession = shopSessionManager.getSession(interaction.user.id);
            if (userSession && userSession.updateTimeout) {
                clearTimeout(userSession.updateTimeout);
                delete userSession.updateTimeout;
                shopSessionManager.setSession(interaction.user.id, userSession);
            }

            if (refundData.refundMessageId) {
                shopSessionManager.cancelPurchaseMessage(refundData.refundMessageId);
            }

            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) {
                return await interaction.editReply({ content: '❌ Member not found.', ephemeral: true });
            }

            const role = interaction.guild.roles.cache.get(roleId);
            if (role) {
                try {
                    await member.roles.remove(role);
                    console.log(`✅ Removed role: ${role.name}`);
                } catch (error) {
                    console.error(`❌ Error removing role ${roleId}:`, error);
                    return await interaction.editReply({ content: '❌ Could not remove role. Please contact an administrator.', ephemeral: true });
                }
            }

            // ✅ FIX: Use the actual paid amounts stored in refundData instead of recalculating from DB
            const refundCoins = refundData.paidCoins;
            const refundCrystals = refundData.paidCrystals;

            await dbManager.run(
                `UPDATE levels SET sky_coins = sky_coins + ?, sky_crystals = sky_crystals + ? WHERE user_id = ?`,
                [refundCoins, refundCrystals, interaction.user.id]
            );

            // Restore quantity if item is not unlimited
            const item = await dbManager.getShopItemById(itemId);
            if (item && item.quantity !== -1) {
                await dbManager.run(`UPDATE shop_items SET quantity = quantity + 1 WHERE id = ?`, [itemId]);
            }

            console.log(`✅ Money refunded successfully: ${refundCoins} coins, ${refundCrystals} crystals`);

            shopSessionManager.removeRefundRequest(interaction.user.id);

            try {
                if (refundData.refundMessageId && refundData.refundChannelId) {
                    const channel = await interaction.guild.channels.fetch(refundData.refundChannelId).catch(() => null);
                    if (channel) {
                        const message = await channel.messages.fetch(refundData.refundMessageId).catch(() => null);
                        if (message && !message.deleted) {
                            await message.delete();
                        }
                    }
                }
            } catch (error) {
                console.log('Could not delete original message:', error.message);
            }

            await interaction.editReply({
                content: '✅ **REFUND COMPLETED!**\nYour money has been returned and the role has been removed.',
                ephemeral: true
            });

            await this.updateShopAfterRefund(interaction);

        } catch (error) {
            console.error('❌ Error in handleRefund:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: `❌ Refund failed: ${error.message}`, ephemeral: true });
                } else {
                    await interaction.editReply({ content: `❌ Refund failed: ${error.message}`, ephemeral: true });
                }
            } catch (replyError) {
                console.error('Could not send error message:', replyError);
            }
        }
    },

    async updateShopAfterRefund(interaction) {
        try {
            console.log(`🔄 Updating shop interface after refund...`);

            const updatedUserData = await dbManager.getUserProfile(interaction.user.id);
            const updatedItems = await dbManager.getActiveShopItems();
            const userSession = shopSessionManager.getSession(interaction.user.id);

            if (userSession) {
                const currentPage = userSession.page || 1;
                const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 });
                const itemsPerPage = 5;
                const totalPages = Math.max(1, Math.ceil(updatedItems.length / itemsPerPage));
                const pageItems = updatedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                let couponInfo = null;
                const adminSale = await getActiveAdminSale();
                if (!adminSale) {
                    const coupons = await couponSystem.getActiveCoupons(interaction.user.id);
                    couponInfo = coupons.length > 0 ? await this.getCouponExpiryInfo(coupons) : null;
                }

                const container = await this.buildShopContainer(interaction, currentPage, totalPages, pageItems, updatedUserData, serverIcon, couponInfo, adminSale);

                const channel = interaction.guild.channels.cache.get(userSession.channelId);
                if (channel) {
                    const originalMessage = await channel.messages.fetch(userSession.messageId).catch(() => null);
                    if (originalMessage) {
                        await originalMessage.edit({
                            components: [container],
                            flags: MessageFlags.IsComponentsV2,
                            allowedMentions: { parse: [] }
                        });
                        console.log(`✅ Shop interface updated successfully`);
                    }
                }
            }
        } catch (updateError) {
            console.error('Error updating shop after refund:', updateError.message);
        }
    }
};