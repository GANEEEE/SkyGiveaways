require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const dbManager = require('./Bot/Data/database'); // استيراد مدير قاعدة البيانات
const keep_alive = require(`./keep_alive.js`);

// التحقق من وجود التوكن
if (!process.env.TOKEN) {
  console.error('❌ Missing TOKEN in .env file');
  process.exit(1);
}

// إنشاء البوت
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions, // ⭐⭐ هذا اللي ناقص!
    GatewayIntentBits.GuildPresences, // ⭐⭐ اختياري لكن مفيد
  ],
  partials: [Partials.User, Partials.GuildMember, Partials.Message, Partials.Reaction],
  allowedMentions: { parse: ['users', 'roles'], repliedUser: true }
});

// ✅ اكتب حدث rateLimit هنا بالظبط
client.on('rateLimit', info => {
  console.log("⚠️ Rate limit hit!", {
    timeout: info.timeout,
    limit: info.limit,
    method: info.method,
    path: info.path,
    route: info.route,
    global: info.global
  });
});

// تهيئة الأنظمة الأساسية
client.commands = new Collection();
client.dbManager = dbManager; // تخزين مدير قاعدة البيانات في العميل

// تحميل الأوامر
const commandsPath = path.join(__dirname, 'Bot', 'Commands');
if (fs.existsSync(commandsPath)) {
  fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'))
    .forEach(file => {
      try {
        const command = require(path.join(commandsPath, file));
        if (command.data && command.execute) {
          client.commands.set(command.data.name, command);
          console.log(`✅ Loaded command: ${command.data.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to load command ${file}:`, error.message);
      }
    });
}

// تحميل الأحداث
const eventsPath = path.join(__dirname, 'Bot', 'Events');
if (fs.existsSync(eventsPath)) {
  fs.readdirSync(eventsPath)
    .filter(file => file.endsWith('.js'))
    .forEach(file => {
      try {
        const event = require(path.join(eventsPath, file));
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client));
        }
        console.log(`✅ Loaded event: ${event.name}`);
      } catch (error) {
        console.error(`❌ Failed to load event ${file}:`, error.message);
      }
    });
}

// الاتصال بقاعدة البيانات قبل تسجيل الدخول
async function initializeDatabase() {
  try {
    console.log('⏳ Waiting for database initialization...');

    // الانتظار لبضع ثوان للتأكد من اكتمال تهيئة قاعدة البيانات
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('✅ Database connected successfully');

    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  }
}

// تسجيل الدخول بعد تهيئة قاعدة البيانات
async function startBot() {
  const dbConnected = await initializeDatabase();

  if (!dbConnected) {
    console.error('❌ Cannot start bot without database connection');
    process.exit(1);
  }

  try {
    await client.login(process.env.TOKEN);
    console.log('🔗 Starting bot connection...');
  } catch (error) {
    console.error('❌ Login failed:', error);
    process.exit(1);
  }
}

// بدء تشغيل البوت
startBot();

// معالجة الأخطاء
process.on('unhandledRejection', error => {
  console.error('⚠️ Unhandled Rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('⚠️ Uncaught Exception:', error);
  setTimeout(() => process.exit(1), 1000);
});

// إغلاق نظيف مع إغلاق قاعدة البيانات
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, async () => {
    console.log(`\n${signal} received, shutting down...`);

    try {
      // إغلاق العميل أولاً
      client.destroy();

      // ثم إغلاق اتصال قاعدة البيانات
      await dbManager.close();

      console.log('✅ Shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });
});

// حدث عند اكتمال تسجيل الدخول
client.once('ready', () => {
  console.log(`✅ ${client.user.tag} is now ready!`);
});

// حدث عند فقدان الاتصال
client.on('disconnect', () => {
  console.log('⚠️ Bot disconnected from Discord');
});

// حدث عند إعادة الاتصال
client.on('reconnecting', () => {
  console.log('🔗 Bot reconnecting to Discord...');
});