// 📂 Bot/Commands/MessageGuard.js
const { EmbedBuilder } = require('discord.js');

class MessageGuard {
    constructor() {
        // ⭐⭐ هنا حط الـ Role ID والعدد المطلوب ⭐⭐
        this.ROLE_ID = '1466171805869019137'; // Role ID الي عايز متطلبات له
        this.REQUIRED_MESSAGES = 10000; // عدد الرسائل المطلوب

        this.SYSTEM_NAME = 'Message Requirements Guard';

        console.log(`🛡️ ${this.SYSTEM_NAME} initialized`);
        console.log(`🎯 Target Role: ${this.ROLE_ID}`);
        console.log(`📊 Required Messages: ${this.REQUIRED_MESSAGES}`);
    }

    /**
     * 🔍 الدالة الرئيسية: تحقق قبل الشراء
     * تستدعيها shop.js قبل أي عملية شراء
     */
    async validatePurchase(user, guild, itemRoleId) {
        try {
            console.log(`🔍 [MessageGuard] Validating purchase for ${user.tag}`);
            console.log(`📦 Item Role ID: ${itemRoleId}`);
            console.log(`🎯 Target Role ID: ${this.ROLE_ID}`);

            // 1. إذا مش الرول المطلوب، سيبها تعدي
            if (itemRoleId !== this.ROLE_ID) {
                console.log(`✅ [MessageGuard] Not our target role - allowing`);
                return { 
                    allowed: true,
                    isTargetRole: false,
                    message: 'Not our target role purchase'
                };
            }

            console.log(`🎯 [MessageGuard] This is our target role purchase!`);

            // 2. جيب بيانات العضو
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                console.log(`❌ [MessageGuard] Member not found: ${user.id}`);
                return { 
                    allowed: false, 
                    error: 'Member not found',
                    isTargetRole: true,
                    embed: this.createErrorEmbed(
                        user, 
                        'Member Not Found',
                        'Cannot find your account in this server.',
                        'Please make sure you are a member of this server.'
                    )
                };
            }

            // 3. جيب عدد رسائل المستخدم مباشرة من message_stats
            const db = require('../Data/database'); // ⭐⭐ تعديل المسار لو فيه فرق
            const messageStats = await db.get(
                'SELECT sent FROM message_stats WHERE user_id = ?',
                [user.id]
            );

            const userMessages = messageStats ? messageStats.sent || 0 : 0;
            console.log(`📊 [MessageGuard] ${user.tag} has ${userMessages} total messages`);

            // 4. تحقق من عدد الرسائل
            const hasEnoughMessages = userMessages >= this.REQUIRED_MESSAGES;
            console.log(`🎯 [MessageGuard] ${user.tag} has enough messages (${this.REQUIRED_MESSAGES}): ${hasEnoughMessages}`);

            if (hasEnoughMessages) {
                // ✅ عنده رسائل كافية - يسمح بالشراء
                console.log(`✅ [MessageGuard] ${user.tag} has enough messages - purchase allowed`);
                return { 
                    allowed: true,
                    hasEnoughMessages: true,
                    isTargetRole: true,
                    userMessages: userMessages,
                    requiredMessages: this.REQUIRED_MESSAGES,
                    member: member,
                    message: 'User has enough messages, purchase allowed'
                };
            }

            // ❌ ماعندهوش رسائل كافية - يمنع الشراء
            console.log(`🚫 [MessageGuard] ${user.tag} NOT enough messages - PURCHASE BLOCKED`);

            return {
                allowed: false,
                hasEnoughMessages: false,
                isTargetRole: true,
                userMessages: userMessages,
                requiredMessages: this.REQUIRED_MESSAGES,
                member: member,
                embed: this.createBlockedPurchaseEmbed(user, member, userMessages),
                error: 'Not enough messages'
            };

        } catch (error) {
            console.error(`💥 [MessageGuard] Error in validatePurchase:`, error);
            return { 
                allowed: false, 
                error: error.message,
                isTargetRole: false,
                embed: this.createErrorEmbed(
                    user,
                    'System Error',
                    'An error occurred while checking message count.',
                    'Please try again later or contact support.'
                )
            };
        }
    }

    /**
     * 🎨 صنع رسالة الخطأ عند منع الشراء
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
            .setColor('#FF0000') // أحمر
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
            .setColor('#FF6B00') // برتقالي
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
            targetRoleId: this.ROLE_ID,
            requiredMessages: this.REQUIRED_MESSAGES,
            description: 'Security system that requires minimum message count for specific role purchases',
            features: [
                `Blocks <@&${this.ROLE_ID}> purchases without ${this.REQUIRED_MESSAGES} messages`,
                'Checks message_stats table directly',
                'Clear progress tracking for users',
                'Simple integration with shop system'
            ],
            version: '1.0.0',
            active: true
        };
    }

    /**
     * 🔍 تحقق سريع
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
            const hasRole = member.roles.cache.has(this.ROLE_ID);

            return {
                userId: userId,
                username: member.user.tag,
                currentMessages: userMessages,
                requiredMessages: this.REQUIRED_MESSAGES,
                hasEnoughMessages: hasEnoughMessages,
                hasRole: hasRole,
                canPurchase: hasEnoughMessages,
                progress: Math.floor((userMessages / this.REQUIRED_MESSAGES) * 100),
                checkedAt: new Date()
            };
        } catch (error) {
            console.error(`[MessageGuard] Quick check error:`, error);
            return { 
                hasEnoughMessages: false, 
                canPurchase: false,
                error: error.message 
            };
        }
    }
}

// إنشاء نسخة واحدة فقط
const messageGuard = new MessageGuard();

// تصدير النسخة
module.exports = messageGuard;