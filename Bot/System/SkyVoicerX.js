// 📂 Bot/Commands/SkyVoiceGuard.js
const { EmbedBuilder } = require('discord.js');

class SkyVoiceGuard {
    constructor() {
        // ⭐⭐ هنا حط الـ Role ID والمتطلبات ⭐⭐
        this.ROLE_ID = '1416129414072107110'; // Role ID الي عايز متطلبات له (SkyPass)
        this.REQUIRED_VOICE_POINTS = 2500; // عدد Voice Points المطلوب

        this.SYSTEM_NAME = 'Voice Points Guard';

        console.log(`🔊 ${this.SYSTEM_NAME} initialized`);
        console.log(`🎯 Target Role: ${this.ROLE_ID}`);
        console.log(`📊 Required Voice Points: ${this.REQUIRED_VOICE_POINTS}`);
    }

    /**
     * 🔍 الدالة الرئيسية: تحقق قبل الشراء
     * تستدعيها shop.js قبل أي عملية شراء للرول المحدد
     */
    async validatePurchase(user, guild, itemRoleId) {
        try {
            console.log(`🔍 [SkyVoiceGuard] Validating purchase for ${user.tag}`);
            console.log(`📦 Item Role ID: ${itemRoleId}`);
            console.log(`🎯 Target Role ID: ${this.ROLE_ID}`);

            // 1. إذا مش الرول المطلوب، سيبها تعدي
            if (itemRoleId !== this.ROLE_ID) {
                console.log(`✅ [SkyVoiceGuard] Not our target role - allowing`);
                return { 
                    allowed: true,
                    isTargetRole: false,
                    message: 'Not our target role purchase'
                };
            }

            console.log(`🎯 [SkyVoiceGuard] This is our target role purchase! (SkyPass)`);

            // 2. جيب بيانات العضو
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                console.log(`❌ [SkyVoiceGuard] Member not found: ${user.id}`);
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

            // 3. جيب Voice Points من جدول levels
            const db = require('../Data/database');
            const userData = await db.get(
                'SELECT voice_points FROM levels WHERE user_id = ?',
                [user.id]
            );

            const userVoicePoints = userData ? userData.voice_points || 0 : 0;
            console.log(`🔊 [SkyVoiceGuard] ${user.tag} has ${userVoicePoints} voice points`);

            // 4. تحقق من عدد Voice Points
            const hasEnoughVoicePoints = userVoicePoints >= this.REQUIRED_VOICE_POINTS;
            console.log(`🎯 [SkyVoiceGuard] ${user.tag} has enough voice points (${this.REQUIRED_VOICE_POINTS}): ${hasEnoughVoicePoints}`);

            if (hasEnoughVoicePoints) {
                // ✅ عنده نقاط كافية - يسمح بالشراء
                console.log(`✅ [SkyVoiceGuard] ${user.tag} has enough voice points - purchase allowed`);
                return { 
                    allowed: true,
                    hasEnoughVoicePoints: true,
                    isTargetRole: true,
                    userVoicePoints: userVoicePoints,
                    requiredVoicePoints: this.REQUIRED_VOICE_POINTS,
                    member: member,
                    message: 'User has enough voice points, purchase allowed'
                };
            }

            // ❌ ماعندهوش نقاط كافية - يمنع الشراء
            console.log(`🚫 [SkyVoiceGuard] ${user.tag} NOT enough voice points - PURCHASE BLOCKED`);

            return {
                allowed: false,
                hasEnoughVoicePoints: false,
                isTargetRole: true,
                userVoicePoints: userVoicePoints,
                requiredVoicePoints: this.REQUIRED_VOICE_POINTS,
                member: member,
                embed: this.createBlockedPurchaseEmbed(user, member, userVoicePoints),
                error: 'Not enough voice points'
            };

        } catch (error) {
            console.error(`💥 [SkyVoiceGuard] Error in validatePurchase:`, error);
            return { 
                allowed: false, 
                error: error.message,
                isTargetRole: false,
                embed: this.createErrorEmbed(
                    user,
                    'System Error',
                    'An error occurred while checking voice points.',
                    'Please try again later or contact support.'
                )
            };
        }
    }

    /**
     * 🎨 صنع رسالة الخطأ عند منع الشراء
     */
    createBlockedPurchaseEmbed(user, member, currentVoicePoints) {
        const missingPoints = this.REQUIRED_VOICE_POINTS - currentVoicePoints;
        const progressPercentage = Math.floor((currentVoicePoints / this.REQUIRED_VOICE_POINTS) * 100);

        // إنشاء شريط تقدم رسومي
        const bars = 10;
        const filledBars = Math.floor((progressPercentage / 100) * bars);
        let progressBar = '';

        for (let i = 0; i < bars; i++) {
            progressBar += i < filledBars ? ' 🟦' : ' ⬛';
        }

        return new EmbedBuilder()
            .setColor('#FF0000') // لون برتقالي-أحمر
            .setTitle('🚫 **VOICE XP REQUIREMENT NOT MET**')
            .setDescription(
                `### **Voice XP Progress**\n` +
                `${progressBar} **${progressPercentage}%**\n\n` +
                `**Required:** ${this.REQUIRED_VOICE_POINTS.toLocaleString()} voice xp\n` +
                `**You have:** ${currentVoicePoints.toLocaleString()} voice xp\n` +
                `**Missing:** ${missingPoints.toLocaleString()} voice xp\n\n`
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
            targetRoleId: this.ROLE_ID,
            requiredVoicePoints: this.REQUIRED_VOICE_POINTS,
            description: 'Security system that requires minimum voice points for SkyPass purchase',
            features: [
                `Blocks <@&${this.ROLE_ID}> purchases without ${this.REQUIRED_VOICE_POINTS} voice points`,
                'Checks voice_points column in levels table',
                'Clear progress tracking for users',
                'Simple integration with shop system'
            ],
            version: '1.0.0',
            active: true
        };
    }

    /**
     * 🔍 تحقق سريع من Voice Points
     */
    async quickCheck(userId, guild) {
        try {
            const member = await guild.members.fetch(userId);

            // جيب Voice Points
            const db = require('../Data/database');
            const userData = await db.get(
                'SELECT voice_points FROM levels WHERE user_id = ?',
                [userId]
            );

            const userVoicePoints = userData ? userData.voice_points || 0 : 0;
            const hasEnoughVoicePoints = userVoicePoints >= this.REQUIRED_VOICE_POINTS;
            const hasRole = member.roles.cache.has(this.ROLE_ID);

            return {
                userId: userId,
                username: member.user.tag,
                currentVoicePoints: userVoicePoints,
                requiredVoicePoints: this.REQUIRED_VOICE_POINTS,
                hasEnoughVoicePoints: hasEnoughVoicePoints,
                hasRole: hasRole,
                canPurchase: hasEnoughVoicePoints,
                progress: Math.floor((userVoicePoints / this.REQUIRED_VOICE_POINTS) * 100),
                checkedAt: new Date()
            };
        } catch (error) {
            console.error(`[SkyVoiceGuard] Quick check error:`, error);
            return { 
                hasEnoughVoicePoints: false, 
                canPurchase: false,
                error: error.message 
            };
        }
    }

    /**
     * 📈 جلب أفضل المستخدمين في Voice Points
     */
    async getTopVoiceUsers(limit = 10) {
        try {
            const db = require('../Data/database');
            const topUsers = await db.all(
                `SELECT user_id, username, voice_points 
                 FROM levels 
                 WHERE voice_points > 0 
                 ORDER BY voice_points DESC 
                 LIMIT ?`,
                [limit]
            );

            return topUsers;
        } catch (error) {
            console.error('[SkyVoiceGuard] Error getting top voice users:', error);
            return [];
        }
    }
}

// إنشاء نسخة واحدة فقط
const skyVoiceGuard = new SkyVoiceGuard();

// تصدير النسخة
module.exports = skyVoiceGuard;