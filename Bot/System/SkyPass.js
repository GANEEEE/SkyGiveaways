const { EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');
const parseDuration = require('./durationParser');

class SkyPassGuard {
    constructor() {
        this.SKY_PASS_ROLE_ID = '1433808946455380038';
        this.DURATION = '7d';
        console.log('🎟️ SkyPass System Initialized');
    }

    // دالة جديدة لتحويل المدة إلى نص مقروء
    formatDurationText(duration) {
        const unitMap = {
            's': 'Seconds',
            'm': 'Minutes', 
            'h': 'Hours',
            'd': 'Days',
            'w': 'Weeks',
            'M': 'Months',
            'y': 'Years'
        };

        const match = duration.match(/^(\d+)([smhdwMy])$/);
        if (match) {
            const value = match[1];
            const unit = unitMap[match[2]] || match[2];
            return `${value} ${unit}`;
        }

        // إذا كانت المدة غير معروفة، نعيدها كما هي
        return duration;
    }

    async convertToTemprole(guild, userId, roleId) {
        try {
            // تنسيق المدة للعرض
            const formattedDuration = this.formatDurationText(this.DURATION);
            console.log(`🎟️ [SkyPass] Converting SkyPass to ${formattedDuration} temprole for user: ${userId}`);

            // جلب العضو والرول
            const member = await guild.members.fetch(userId);
            const role = guild.roles.cache.get(roleId);

            if (!member) {
                console.log(`❌ [SkyPass] Member ${userId} not found`);
                return { success: false, error: 'Member not found' };
            }

            if (!role) {
                console.log(`❌ [SkyPass] Role ${roleId} not found`);
                return { success: false, error: 'Role not found' };
            }

            console.log(`✅ [SkyPass] Found: ${member.user.tag}, role: ${role.name}`);

            // تحويل المدة
            const durationMs = parseDuration(this.DURATION);
            if (!durationMs) {
                console.log(`❌ [SkyPass] Invalid duration: ${this.DURATION}`);
                return { success: false, error: 'Invalid duration format' };
            }

            const expiresAt = new Date(Date.now() + durationMs);
            const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

            // حفظ في الداتابيز
            await dbManager.run(`
                INSERT INTO temp_roles 
                (user_id, user_name, role_id, role_name, guild_id, guild_name, expires_at, duration, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)
            `, [
                member.id, 
                member.user.tag, 
                role.id, 
                role.name, 
                guild.id, 
                guild.name, 
                expiresAt, 
                this.DURATION
            ]);

            // جدولة الإزالة والإشعار
            setTimeout(async () => {
                try {
                    const currentMember = await guild.members.fetch(userId).catch(() => null);

                    if (currentMember && currentMember.roles.cache.has(role.id)) {
                        // إزالة الرول
                        await currentMember.roles.remove(role);
                        console.log(`✅ [SkyPass] Removed ${role.name} from ${member.user.tag} after ${formattedDuration}`);

                        // إرسال إشعار انتهاء الرول
                        await this.sendExpirationNotification(guild, currentMember, role);
                    }

                    // حذف من الداتابيز
                    await dbManager.run(
                        'DELETE FROM temp_roles WHERE user_id = ? AND role_id = ?',
                        [userId, roleId]
                    );

                } catch (error) {
                    console.error(`❌ [SkyPass] Error in expiration process:`, error);
                }
            }, durationMs);

            // إرسال إشعار التفعيل
            await this.sendActivationNotification(guild, member, role, expiresTimestamp, formattedDuration);

            console.log(`✅ [SkyPass] Successfully converted to ${formattedDuration} temprole`);
            return { success: true };

        } catch (error) {
            console.error(`❌ [SkyPass] Error:`, error);
            return { success: false, error: error.message };
        }
    }

    async sendActivationNotification(guild, member, role, expiresTimestamp, formattedDuration) {
        try {
            const logChannel = guild.channels.cache.get('1385514822132830299');
            if (!logChannel) {
                console.log('❌ [SkyPass] Log channel not found');
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x0073ff)
                .setTitle('**SkyPass Activated**')
                .setDescription(`**${member.user.tag}'s** SkyPass role is activated`)
                .addFields(
                    { name: 'Role', value: `${role}`, inline: true },
                    { name: 'Duration', value: `**${formattedDuration}**`, inline: true },
                    { name: 'Expires', value: `<t:${expiresTimestamp}:F>`, inline: false }
                );

            await logChannel.send({ 
                embeds: [embed],
                content: `${member}`
            });

            console.log(`📢 [SkyPass] Sent activation notification for ${member.user.tag}`);
        } catch (error) {
            console.error(`❌ [SkyPass] Error sending activation notification:`, error);
        }
    }

    async sendExpirationNotification(guild, member, role) {
        try {
            const logChannel = guild.channels.cache.get('1385514822132830299');
            if (!logChannel) {
                console.log('❌ [SkyPass] Log channel not found');
                return;
            }

            // تنسيق المدة للعرض في رسالة الانتهاء
            const formattedDuration = this.formatDurationText(this.DURATION);

            const embed = new EmbedBuilder()
                .setColor(0x8B0000)
                .setTitle('**SkyPass Expired**')
                .setDescription(`**${member.user.tag}'s** SkyPass temporary role has expired and been removed`)
                .addFields(
                    { name: 'Role Removed', value: `${role}`, inline: true },
                    { name: 'Duration', value: `**${formattedDuration}**`, inline: true },
                    { name: 'Status', value: '**EXPIRED**', inline: false }
                )

            await logChannel.send({ 
                embeds: [embed],
                content: `${member}`
            });

            console.log(`📢 [SkyPass] Sent expiration notification for ${member.user.tag}`);
        } catch (error) {
            console.error(`❌ [SkyPass] Error sending expiration notification:`, error);
        }
    }

    setDuration(newDuration) {
        this.DURATION = newDuration;
        const formattedDuration = this.formatDurationText(newDuration);
        console.log(`🔄 [SkyPass] Duration changed to: ${formattedDuration}`);
    }
}

const skyPassGuard = new SkyPassGuard();
module.exports = skyPassGuard;