// 📂 Bot/Commands/ColorsMessageGuard.js
const { EmbedBuilder } = require('discord.js');

class ColorsMessageGuard {
    constructor() {
        // ⭐⭐ هنا حط الـ Role ID لـ Colors والعدد المطلوب ⭐⭐
        this.COLORS_ROLE_ID = '1430929136129409126'; // حط Role ID الـ Colors هنا
        this.REQUIRED_MESSAGES = 1000; // عدد الرسائل المطلوب للـ Colors

        this.SYSTEM_NAME = 'Colors Message Requirements Guard';

        console.log(`🎨 ${this.SYSTEM_NAME} initialized`);
        console.log(`🎯 Colors Role: ${this.COLORS_ROLE_ID}`);
        console.log(`📊 Required Messages for Colors: ${this.REQUIRED_MESSAGES}`);
    }

    /**
     * 🔍 الدالة الرئيسية: تحقق قبل شراء Colors
     */
    async validatePurchase(user, guild, itemRoleId) {
        try {
            console.log(`🎨 [ColorsGuard] Validating purchase for ${user.tag}`);
            console.log(`📦 Item Role ID: ${itemRoleId}`);
            console.log(`🎯 Colors Role ID: ${this.COLORS_ROLE_ID}`);

            // 1. إذا مش Colors Role، سيبها تعدي
            if (itemRoleId !== this.COLORS_ROLE_ID) {
                console.log(`✅ [ColorsGuard] Not a Colors role - allowing`);
                return { 
                    allowed: true,
                    isColorsRole: false,
                    message: 'Not a Colors role purchase'
                };
            }

            console.log(`🎯 [ColorsGuard] This is a Colors role purchase!`);

            // 2. جيب بيانات العضو
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                console.log(`❌ [ColorsGuard] Member not found: ${user.id}`);
                return { 
                    allowed: false, 
                    error: 'Member not found',
                    isColorsRole: true,
                    embed: this.createErrorEmbed(
                        user, 
                        'Member Not Found',
                        'Cannot find your account in this server.',
                        'Please make sure you are a member of this server.'
                    )
                };
            }

            // 3. جيب عدد رسائل المستخدم
            const db = require('../Data/database');
            const messageStats = await db.get(
                'SELECT sent FROM message_stats WHERE user_id = ?',
                [user.id]
            );

            const userMessages = messageStats ? messageStats.sent || 0 : 0;
            console.log(`📊 [ColorsGuard] ${user.tag} has ${userMessages} total messages`);

            // 4. تحقق من عدد الرسائل للـ Colors
            const hasEnoughMessages = userMessages >= this.REQUIRED_MESSAGES;
            console.log(`🎯 [ColorsGuard] ${user.tag} has enough messages for Colors (${this.REQUIRED_MESSAGES}): ${hasEnoughMessages}`);

            if (hasEnoughMessages) {
                // ✅ عنده رسائل كافية للـ Colors
                console.log(`✅ [ColorsGuard] ${user.tag} has enough messages for Colors - purchase allowed`);
                return { 
                    allowed: true,
                    hasEnoughMessages: true,
                    isColorsRole: true,
                    userMessages: userMessages,
                    requiredMessages: this.REQUIRED_MESSAGES,
                    member: member,
                    message: 'User has enough messages for Colors, purchase allowed'
                };
            }

            // ❌ ماعندهوش رسائل كافية للـ Colors
            console.log(`🚫 [ColorsGuard] ${user.tag} NOT enough messages for Colors - PURCHASE BLOCKED`);

            return {
                allowed: false,
                hasEnoughMessages: false,
                isColorsRole: true,
                userMessages: userMessages,
                requiredMessages: this.REQUIRED_MESSAGES,
                member: member,
                embed: this.createBlockedPurchaseEmbed(user, member, userMessages),
                error: 'Not enough messages for Colors'
            };

        } catch (error) {
            console.error(`💥 [ColorsGuard] Error in validatePurchase:`, error);
            return { 
                allowed: false, 
                error: error.message,
                isColorsRole: false,
                embed: this.createErrorEmbed(
                    user,
                    'System Error',
                    'An error occurred while checking message count for Colors.',
                    'Please try again later or contact support.'
                )
            };
        }
    }

    /**
     * 🎨 صنع رسالة الخطأ عند منع شراء Colors
     */
    createBlockedPurchaseEmbed(user, member, currentMessages) {
        const missingMessages = this.REQUIRED_MESSAGES - currentMessages;
        const progressPercentage = Math.floor((currentMessages / this.REQUIRED_MESSAGES) * 100);

        // إنشاء شريط تقدم رسومي
        const bars = 10;
        const filledBars = Math.floor((progressPercentage / 100) * bars);
        let progressBar = '';

        for (let i = 0; i < bars; i++) {
            progressBar += i < filledBars ? ' 🟦' : ' ⬛';
        }

        return new EmbedBuilder()
            .setColor('#FF0000') // لون برتقالي للـ Colors
            .setTitle('🚫 **MESSAGE REQUIREMENT NOT MET**')
            .setDescription(
                `### **Message Progress**\n` +
                `${progressBar} **${progressPercentage}%**\n\n` +
                `**Required:** ${this.REQUIRED_MESSAGES.toLocaleString()} messages\n` +
                `**You have:** ${currentMessages.toLocaleString()} messages\n` +
                `**Missing:** ${missingMessages.toLocaleString()} messages\n\n`
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    }

    /**
     * 🎨 صنع رسالة الخطأ العامة
     */
    createErrorEmbed(user, title, description, solution) {
        return new EmbedBuilder()
            .setColor('#FF6B00')
            .setTitle(`⚠️ **${title}**`)
            .setDescription(`**${user.tag}**, ${description}`)
            .addFields(
                { name: '🔧 Solution', value: solution, inline: false },
                { name: '📞 Support', value: 'Contact server staff for assistance', inline: false }
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    }

    /**
     * 📊 معلومات النظام
     */
    getSystemInfo() {
        return {
            systemName: this.SYSTEM_NAME,
            colorsRoleId: this.COLORS_ROLE_ID,
            requiredMessages: this.REQUIRED_MESSAGES,
            description: 'Security system that requires 1,000 messages to purchase Colors roles',
            features: [
                `Blocks Colors role purchases without ${this.REQUIRED_MESSAGES} messages`,
                'Visual progress tracking with percentage',
                'Colorful and engaging error messages',
                'Encourages community participation'
            ],
            version: '1.0.0',
            active: true
        };
    }

    /**
     * 🔍 تحقق سريع لمستخدم معين
     */
    async quickCheck(userId, guild) {
        try {
            const member = await guild.members.fetch(userId);

            // جيب عدد الرسائل
            const db = require('../Data/database');
            const messageStats = await db.get(
                'SELECT sent FROM message_stats WHERE user_id = ?',
                [userId]
            );

            const userMessages = messageStats ? messageStats.sent || 0 : 0;
            const hasEnoughMessages = userMessages >= this.REQUIRED_MESSAGES;
            const hasColorsRole = member.roles.cache.has(this.COLORS_ROLE_ID);
            const progressPercentage = Math.floor((userMessages / this.REQUIRED_MESSAGES) * 100);

            return {
                userId: userId,
                username: member.user.tag,
                currentMessages: userMessages,
                requiredMessages: this.REQUIRED_MESSAGES,
                hasEnoughMessages: hasEnoughMessages,
                hasColorsRole: hasColorsRole,
                canPurchaseColors: hasEnoughMessages,
                progressPercentage: progressPercentage,
                status: hasEnoughMessages ? 'Unlocked 🎨' : 'Locked 🔒',
                missingMessages: Math.max(0, this.REQUIRED_MESSAGES - userMessages),
                checkedAt: new Date()
            };
        } catch (error) {
            console.error(`[ColorsGuard] Quick check error:`, error);
            return { 
                hasEnoughMessages: false, 
                canPurchaseColors: false,
                error: error.message 
            };
        }
    }

    /**
     * 📝 جلب قائمة جميع ألوان Colors في السيرفر
     */
    async getAllColorsRoles(guild) {
        try {
            // يمكنك تعديل هذا البحث بناءً على أسماء الرولات
            const allRoles = await guild.roles.fetch();
            const colorsRoles = allRoles.filter(role => 
                role.name.toLowerCase().includes('color') || 
                role.name.toLowerCase().includes('colour') ||
                role.name.toLowerCase().includes('hex')
            );

            return Array.from(colorsRoles.values());
        } catch (error) {
            console.error('[ColorsGuard] Error fetching colors roles:', error);
            return [];
        }
    }
}

// إنشاء نسخة واحدة فقط
const colorsMessageGuard = new ColorsMessageGuard();

// تصدير النسخة
module.exports = colorsMessageGuard;