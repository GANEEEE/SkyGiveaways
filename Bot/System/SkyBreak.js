// 📂 Bot/Commands/SkyBreakGuard.js
const { EmbedBuilder } = require('discord.js');

class SkyBreakGuard {
    constructor() {
        this.SKY_BREAK_ROLE_ID = '1433808940839211100';
        this.CHAMPION_REST_ROLE_ID = '1394820353775112212';
        this.SYSTEM_NAME = 'SkyBreak Security System';

        console.log(`🛡️ ${this.SYSTEM_NAME} initialized`);
        //console.log(`🎯 Sky Break Role: ${this.SKY_BREAK_ROLE_ID}`);
        //console.log(`🛡️ Champion Rest Role: ${this.CHAMPION_REST_ROLE_ID}`);
    }

    /**
     * 🔍 الدالة الرئيسية: تحقق قبل الشراء
     * تستدعيها shop.js قبل أي عملية شراء
     */
    async validatePurchase(user, guild, itemRoleId) {
        try {
            console.log(`🔍 [SkyBreakGuard] Validating purchase for ${user.tag}`);
            console.log(`📦 Item Role ID: ${itemRoleId}`);
            console.log(`🎯 Sky Break ID: ${this.SKY_BREAK_ROLE_ID}`);

            // 1. إذا مش Sky Break، سيبها تعدي
            if (itemRoleId !== this.SKY_BREAK_ROLE_ID) {
                console.log(`✅ [SkyBreakGuard] Not a Sky Break purchase - allowing`);
                return { 
                    allowed: true,
                    isSkyBreak: false,
                    message: 'Not a Sky Break purchase'
                };
            }

            console.log(`🎯 [SkyBreakGuard] This is a Sky Break purchase!`);

            // 2. جيب بيانات العضو
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                console.log(`❌ [SkyBreakGuard] Member not found: ${user.id}`);
                return { 
                    allowed: false, 
                    error: 'Member not found',
                    isSkyBreak: true,
                    embed: this.createErrorEmbed(
                        user, 
                        'Member Not Found',
                        'Cannot find your account in this server.',
                        'Please make sure you are a member of this server.'
                    )
                };
            }

            // 3. تحقق من ChampionRest
            const hasChampionRest = member.roles.cache.has(this.CHAMPION_REST_ROLE_ID);
            console.log(`🛡️ [SkyBreakGuard] ${user.tag} has ChampionRest: ${hasChampionRest}`);

            if (hasChampionRest) {
                // ✅ عنده ChampionRest - يسمح بالشراء
                console.log(`✅ [SkyBreakGuard] ${user.tag} has ChampionRest - purchase allowed`);
                return { 
                    allowed: true,
                    hasChampionRest: true,
                    isSkyBreak: true,
                    member: member,
                    message: 'User has ChampionRest, purchase allowed'
                };
            }

            // ❌ ماعندهاش ChampionRest - يمنع الشراء
            console.log(`🚫 [SkyBreakGuard] ${user.tag} NO ChampionRest - PURCHASE BLOCKED`);

            return {
                allowed: false,
                hasChampionRest: false,
                isSkyBreak: true,
                member: member,
                embed: this.createBlockedPurchaseEmbed(user, member),
                error: 'Missing ChampionRest role'
            };

        } catch (error) {
            console.error(`💥 [SkyBreakGuard] Error in validatePurchase:`, error);
            return { 
                allowed: false, 
                error: error.message,
                isSkyBreak: false,
                embed: this.createErrorEmbed(
                    user,
                    'System Error',
                    'An error occurred while checking permissions.',
                    'Please try again later or contact support.'
                )
            };
        }
    }

    /**
     * 🔄 إزالة ChampionRest بعد انتهاء Refund period
     * تستدعيها shop.js بعد 30 ثانية إذا ما حصلش refund
     */
    async removeChampionRestAfterPurchase(userId, guild) {
        try {
            console.log(`🔄 [SkyBreakGuard] Removing ChampionRest for user: ${userId}`);

            // 1. جيب العضو
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) {
                console.log(`❌ [SkyBreakGuard] Member ${userId} not found for removal`);
                return { success: false, error: 'Member not found' };
            }

            // 2. تحقق إذا لسه عنده الرتبة
            const hasChampionRest = member.roles.cache.has(this.CHAMPION_REST_ROLE_ID);
            if (!hasChampionRest) {
                console.log(`✅ [SkyBreakGuard] ${member.user.tag} doesn't have ChampionRest - nothing to remove`);
                return { success: true, removed: false, reason: 'Already removed' };
            }

            console.log(`🎯 [SkyBreakGuard] Found ChampionRest on ${member.user.tag}, removing...`);

            // 3. شيل الرتبة
            const championRestRole = guild.roles.cache.get(this.CHAMPION_REST_ROLE_ID);
            if (!championRestRole) {
                console.log(`❌ [SkyBreakGuard] ChampionRest role not found in guild`);
                return { success: false, error: 'Role not found' };
            }

            await member.roles.remove(championRestRole);
            console.log(`✅ [SkyBreakGuard] Successfully removed ChampionRest from ${member.user.tag}`);

            return { 
                success: true, 
                removed: true,
                userTag: member.user.tag,
                userId: userId,
                timestamp: new Date()
            };

        } catch (error) {
            console.error(`💥 [SkyBreakGuard] Error removing ChampionRest:`, error);
            return { 
                success: false, 
                error: error.message,
                userId: userId
            };
        }
    }

    /**
     * 🎨 صنع رسالة الخطأ عند منع الشراء
     */
    createBlockedPurchaseEmbed(user, member) {
        return new EmbedBuilder()
            .setColor('#FF0000') // أحمر
            .setTitle('🚫 **SKY BREAK PURCHASE BLOCKED**')
            .setDescription(
                `**${user.tag}**, you **cannot** purchase **Sky Break**!\n\n`
            )
            .addFields(
                { 
                    name: 'Required Role', 
                    value: `<@&${this.CHAMPION_REST_ROLE_ID}>`, 
                    inline: true 
                },
                { 
                    name: '❌ Your Status', 
                    value: '**Not owned**', 
                    inline: true 
                },
                { 
                    name: 'Purchased Item', 
                    value: `<@&${this.SKY_BREAK_ROLE_ID}>`, 
                    inline: false 
                }
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    }

    /**
     * 🎨 صنع رسالة الخطأ العامة
     */
    createErrorEmbed(user, title, description, solution) {
        return new EmbedBuilder()
            .setColor('#FF6B00') // برتقالي
            .setTitle(`⚠️ **${title}**`)
            .setDescription(`**${user.tag}**, ${description}`)
            .addFields(
                { name: '🔧 Solution', value: solution, inline: false },
                { name: '📞 Support', value: 'Contact server staff for assistance', inline: false }
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ 
                text: `${this.SYSTEM_NAME} • Error Handling`,
                iconURL: 'https://cdn.discordapp.com/emojis/1106958732415377458.png'
            })
            .setTimestamp();
    }

    /**
     * 📊 معلومات النظام
     */
    getSystemInfo() {
        return {
            systemName: this.SYSTEM_NAME,
            skyBreakRoleId: this.SKY_BREAK_ROLE_ID,
            championRestRoleId: this.CHAMPION_REST_ROLE_ID,
            description: 'Security system that requires ChampionRest role for Sky Break purchases',
            features: [
                'Blocks Sky Break purchases without ChampionRest',
                'Automatically removes ChampionRest after successful purchase',
                'Clear error messages for users',
                'Simple integration with shop system'
            ],
            version: '2.0.0',
            active: true
        };
    }

    /**
     * 🔍 تحقق سريع
     */
    async quickCheck(userId, guild) {
        try {
            const member = await guild.members.fetch(userId);
            const hasChampionRest = member.roles.cache.has(this.CHAMPION_REST_ROLE_ID);
            const hasSkyBreak = member.roles.cache.has(this.SKY_BREAK_ROLE_ID);

            return {
                hasChampionRest: hasChampionRest,
                hasSkyBreak: hasSkyBreak,
                canPurchaseSkyBreak: hasChampionRest,
                userId: userId,
                username: member.user.tag,
                checkedAt: new Date()
            };
        } catch (error) {
            console.error(`[SkyBreakGuard] Quick check error:`, error);
            return { 
                hasChampionRest: false, 
                canPurchaseSkyBreak: false,
                error: error.message 
            };
        }
    }
}

// إنشاء نسخة واحدة فقط
const skyBreakGuard = new SkyBreakGuard();

// تصدير النسخة
module.exports = skyBreakGuard;