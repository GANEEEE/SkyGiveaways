const {
  SlashCommandBuilder,
  SectionBuilder,
  ContainerBuilder,
  MessageFlags
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
      .setName('pingchat')
      .setDescription('🏓 Check bot latency')
      .setDMPermission(true),

  async execute(interaction) {
      try {
          // حساب الـ ping
          const sent = await interaction.reply({ 
              content: '🏓 **Calculating...**', 
              fetchReply: true 
          });

          const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
          const apiLatency = interaction.client.ws.ping;

          // تحديد اللون بناءً على الـ Ping
          let accentColor;
          let statusEmoji;
          let statusText;

          if (botLatency < 100) {
              accentColor = 0x0073ff; // أخضر فاتح (Excellent)
              statusEmoji = '🟢';
              statusText = 'Excellent';
          } else if (botLatency < 250) {
              accentColor = 0xFFFF00; // أصفر (Good)
              statusEmoji = '🟡';
              statusText = 'Good';
          } else if (botLatency < 500) {
              accentColor = 0xFFA500; // برتقالي (Moderate)
              statusEmoji = '🟠';
              statusText = 'Moderate';
          } else {
              accentColor = 0xFF0000; // أحمر (Slow)
              statusEmoji = '🔴';
              statusText = 'Slow';
          }

          // ثمبنيل البوت
          const botAvatar = interaction.client.user.displayAvatarURL({ 
              extension: 'png', 
              size: 256 
          });

          // سكشن واحد فيه كل حاجة + ثمبنيل
          const pingSection = new SectionBuilder()
              .addTextDisplayComponents((textDisplay) =>
                  textDisplay.setContent(
                      '### **BOT LATENCY STATICS**\n' +
                      '```css\n' +
                      `Bot: ${botLatency} ms\n\n` +
                      `API: ${apiLatency} ms\n` +

                      '```\n' +
                      '-# Powered by SkyChat'
                      /*'## **📈 STATUS**\n' +
                      `${statusEmoji} **${statusText}**\n\n` +

                      '## **🤖 BOT INFO**\n' +
                      `• Servers: \`${interaction.client.guilds.cache.size}\`\n` +
                      `• Uptime: \`${this.formatUptime(interaction.client.uptime)}\``*/
                  )
              )
              // هنا الثمبنيل!
              .setThumbnailAccessory((thumbnail) =>
                  thumbnail
                      .setDescription(`${interaction.client.user.username} Bot Avatar`)
                      .setURL(botAvatar)
              );

          // كونتينر مع اللون الديناميكي
          const container = new ContainerBuilder()
              .setAccentColor(accentColor)
              .addSectionComponents((section) => pingSection);

          // إرسال
          await interaction.editReply({
              content: '',
              components: [container],
              flags: MessageFlags.IsComponentsV2
          });

      } catch (error) {
          console.error('Error in ping command:', error);
          await interaction.reply({
              content: '❌ Error checking ping.',
              ephemeral: true
          });
      }
  },

  formatUptime(uptime) {
      const seconds = Math.floor(uptime / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ${hours % 24}h`;
      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
      return `${seconds}s`;
  }
};