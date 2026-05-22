// ========== ملف: api.js ==========
const express = require('express');
const router = express.Router();
const dbManager = require('./Bot/Data/database');

// تخزين الـ client reference
let botClient = null;

/**
 * دالة لتهيئة الـ API بالـ client
 * @param {Client} client - Discord.js Client instance
 */
function initAPI(client) {
    botClient = client;
    console.log('🔗 API initialized with bot client');
}

// ============================================================
// ✅ CORS MIDDLEWARE
// ============================================================
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-API-Key, x-api-key');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next();
});

// ============================================================
// ✅ AUTHENTICATION MIDDLEWARE
// ============================================================
router.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next();
    }

    if (req.path === '/health' && req.method === 'GET') {
        return next();
    }

    const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];

    if (!process.env.DASHBOARD_API_KEY) {
        console.warn('⚠️ DASHBOARD_API_KEY not set in .env - allowing all requests (INSECURE)');
        return next();
    }

    if (!apiKey) {
        console.warn(`⚠️ Missing API key - IP: ${req.ip}, Path: ${req.path}`);
        return res.status(401).json({ 
            success: false, 
            error: 'Missing API key. Include x-api-key in headers.' 
        });
    }

    if (apiKey !== process.env.DASHBOARD_API_KEY) {
        console.warn(`❌ Invalid API key attempt - IP: ${req.ip}, Key: ${apiKey.substring(0, 8)}...`);
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid API key' 
        });
    }

    next();
});

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================
router.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Giveaway API is running',
        botReady: !!botClient,
        botTag: botClient?.user?.tag || 'Not ready',
        uptime: process.uptime(),
        timestamp: Date.now(),
        env: process.env.NODE_ENV || 'development'
    });
});

// ============================================================
// 🚀 دالة مساعدة: نشر المحتوى في القناة فعلياً
// ============================================================
async function publishToChannel(channel, content) {
    try {
        if (typeof content === 'string' && content.length > 0) {
            await channel.send(content);
            console.log('✅ [API] Published string message to channel');
            return;
        }

        if (content && typeof content === 'object') {
            const messagePayload = {};

            if (content.content) messagePayload.content = content.content;
            if (content.embeds?.length > 0) messagePayload.embeds = content.embeds;
            if (content.components?.length > 0) messagePayload.components = content.components;
            if (content.files?.length > 0) messagePayload.files = content.files;
            if (content.attachments?.length > 0) messagePayload.attachments = content.attachments;

            if (Object.keys(messagePayload).length > 0) {
                await channel.send(messagePayload);
                console.log('✅ [API] Published message to channel');
            }
        }
    } catch (err) {
        console.error('❌ [API] Failed to publish to channel:', err.message);
    }
}

// ============================================================
// دالة مساعدة لتحويل مدة النص إلى ميلي ثانية
// ============================================================
function parseDurationString(str) {
    if (!str) return null;

    const units = {
        y: 31536000000,
        mo: 2592000000,
        w: 604800000,
        d: 86400000,
        h: 3600000,
        m: 60000,
        s: 1000
    };

    let ms = 0;
    const regex = /(\d+)\s*(y|mo|w|d|h|m|s)/gi;
    let match;

    while ((match = regex.exec(str)) !== null) {
        const unit = match[2].toLowerCase();
        if (units[unit]) {
            ms += parseInt(match[1]) * units[unit];
        }
    }

    return ms || null;
}

// ============================================================
// دالة مساعدة لجلب القنوات النصية
// ============================================================
async function getAllTextChannels(guild) {
    try {
        const channels = await guild.channels.fetch();
        const textChannels = channels.filter(ch => 
            ch.type === 0 &&
            ch.viewable &&
            !ch.isVoiceBased()
        );

        const sortedChannels = [...textChannels.values()].sort((a, b) => 
            a.name.localeCompare(b.name)
        );

        return sortedChannels.map(ch => ({
            id: ch.id,
            name: ch.name,
            type: ch.type
        }));
    } catch (error) {
        console.error('❌ Error fetching channels:', error);
        return [];
    }
}

// ============================================================
// 📊 جلب كل الجيف أواي للـ Dashboard
// ============================================================
router.get('/giveaways', async (req, res) => {
    try {
        const giveaways = await dbManager.getAllGiveaways(1000, 0);

        const formatted = giveaways.map(g => {
            // ===== استخراج الجوائز ومتطلبات الرسائل من entry_values =====
            let prizes = '';
            let messageReqs = '';
            let messagePeriod = 'none';
            let isSingleButton = false;

            if (g.entry_values) {
                let entryData = g.entry_values;
                if (typeof entryData === 'string') {
                    try { entryData = JSON.parse(entryData); } catch(e) {}
                }

                if (entryData && entryData.buttons && Array.isArray(entryData.buttons)) {
                    // استخراج الجوائز (من label)
                    const prizeLabels = entryData.buttons
                        .filter(btn => btn.label && btn.label !== 'Join')
                        .map(btn => btn.label);

                    if (prizeLabels.length > 0) {
                        prizes = prizeLabels.join(', ');
                    }

                    // استخراج متطلبات الرسائل (من required)
                    const requirements = entryData.buttons
                        .filter(btn => btn.required && btn.required > 0)
                        .map(btn => btn.required);

                    if (requirements.length > 0) {
                        messageReqs = requirements.join(', ');
                    }

                    // التحقق من نوع السحب (زرار واحد Join)
                    if (entryData.buttons.length === 1 && entryData.buttons[0].label === 'Join') {
                        isSingleButton = true;
                    }
                }

                // استخراج الفترة
                if (entryData && entryData.period) {
                    messagePeriod = entryData.period;
                }
            }

            // إذا مفيش جوائز من entry_values، نحاول من الوصف
            if (!prizes && g.description) {
                const prizeMatch = g.description.match(/\*\*Prizes:\*\*\s*(.+)/i);
                if (prizeMatch) prizes = prizeMatch[1];
            }

            // استخراج المشاركين (نفس الكود الموجود)
            let participantsCount = 0;
            let participantsData = [];
            if (g.entries) {
                if (typeof g.entries === 'object') {
                    participantsData = Object.values(g.entries);
                    participantsCount = participantsData.length;
                } else if (typeof g.entries === 'string') {
                    try {
                        const parsed = JSON.parse(g.entries);
                        participantsData = Object.values(parsed);
                        participantsCount = participantsData.length;
                    } catch(e) {}
                }
            }

            // وقت الانتهاء
            let endTimeMs = null;
            let endTimeFmt = null;
            if (g.end_time) {
                const d = new Date(g.end_time);
                if (!isNaN(d.getTime())) {
                    endTimeMs = d.getTime();
                    endTimeFmt = d.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }

            return {
                code: g.giveaway_code,
                title: g.title || g.template || 'Giveaway',
                host: g.host_name || null,
                host_id: g.host_id,
                status: g.status || 'unknown',
                winners_count: g.winners_count || 1,
                participants: participantsCount,
                participants_data: participantsData,
                end_time_fmt: endTimeFmt,
                end_time_ms: endTimeMs,
                created_at: g.created_at,
                duration: g.duration || '7d',
                description: g.description || '',
                image_url: g.image_url || '',
                channel_id: g.channel_id,
                message_id: g.message_id,
                color: g.color || 0x0073ff,
                // ⭐ الحقول الجديدة اللي كانت ناقصة
                prizes: prizes,                    // الجوائز
                message_reqs: messageReqs,        // متطلبات الرسائل
                message_period: messagePeriod,    // daily/weekly/monthly
                is_single_button: isSingleButton, // هل هو سحب بزرار واحد؟
                req_role_ids: g.reqrole || [],
                req_role_mode: g.req_role_mode || 'n',
                bypass_role_ids: g.bypass_role_id || [],
                bypass_role_mode: g.bypass_role_mode || 'n',
                ban_role_ids: g.banrole || [],
                multiplier: g.multiplier ? (typeof g.multiplier === 'string' ? JSON.parse(g.multiplier) : g.multiplier) : null,
                winners: g.winners || [],
                entry_values: g.entry_values     // نحتفظ بالقيم الأصلية للdebug
            };
        });

        formatted.sort((a, b) => {
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });

        console.log(`✅ Dashboard: Returning ${formatted.length} giveaways`);
        console.log(`📦 Sample prizes: ${formatted[0]?.prizes || 'none'}`);
        console.log(`📨 Sample message_reqs: ${formatted[0]?.message_reqs || 'none'}`);

        res.json({ 
            success: true, 
            giveaways: formatted,
            count: formatted.length
        });

    } catch (error) {
        console.error('❌ Dashboard API Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ============================================================
// 📡 جلب القنوات للـ Dashboard
// ============================================================
router.get('/channels', async (req, res) => {
    try {
        const { guildId } = req.query;

        if (!guildId) {
            return res.status(400).json({ 
                success: false, 
                error: 'guildId is required' 
            });
        }

        if (!botClient) {
            return res.status(503).json({ 
                success: false, 
                error: 'Bot is not ready yet' 
            });
        }

        const guild = await botClient.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            return res.status(404).json({ 
                success: false, 
                error: 'Guild not found' 
            });
        }

        const channels = await getAllTextChannels(guild);

        res.json({ 
            success: true, 
            channels: channels 
        });

    } catch (error) {
        console.error('❌ Channels API Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ============================================================
// 👥 جلب الأدوار للـ Dashboard
// ============================================================
router.get('/roles', async (req, res) => {
    try {
        const { guildId } = req.query;

        if (!guildId) {
            return res.status(400).json({ 
                success: false, 
                error: 'guildId is required' 
            });
        }

        if (!botClient) {
            return res.status(503).json({ 
                success: false, 
                error: 'Bot is not ready yet' 
            });
        }

        const guild = await botClient.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            return res.status(404).json({ 
                success: false, 
                error: 'Guild not found' 
            });
        }

        const roles = await guild.roles.fetch();
        const allRoles = [...roles.values()]
            .filter(r => r.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => ({
                id: r.id,
                name: r.name,
                color: r.hexColor
            }));

        res.json({ 
            success: true, 
            roles: allRoles 
        });

    } catch (error) {
        console.error('❌ Roles API Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ============================================================
// 🎁 إنشاء جيف أواي
// ============================================================
// ============================================================
// 🎁 إنشاء جيف أواي (مباشر بدون معاينة)
// ============================================================
router.post('/giveaway/create', async (req, res) => {
    const startTime = Date.now();

    try {
        const {
            template,
            title,
            duration,
            winners,
            prizes,
            description,
            image,
            requiredRoles,
            bypassRoles,
            blacklist,
            multiplier,
            messagesPeriod,
            messageReqs,
            color,
            channelId,
            guildId,
            userId,
            reqMode,
            bypassMode,
            winnerRoleId,
            scheduled
        } = req.body;

        // ✅ نشيل شرط userId
        if (!guildId || !channelId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: guildId, channelId' 
            });
        }

        if (!duration) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required field: duration' 
            });
        }

        if (!botClient) {
            return res.status(503).json({ 
                success: false, 
                error: 'Bot is not ready yet. Please wait.' 
            });
        }

        console.log(`📝 Creating giveaway directly: ${title || template} in guild ${guildId}`);

        // جلب السيرفر والقناة
        const guild = await botClient.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            return res.status(404).json({ success: false, error: 'Channel not found' });
        }

        if (!channel.isTextBased()) {
            return res.status(400).json({ success: false, error: 'Channel must be a text channel' });
        }

        // ✅ استخدم الـ hostId الجاي من الداشبورد
        const botUser = botClient.user;
        const hostId = req.body.hostId;

        if (!hostId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required field: hostId' 
            });
        }

        // ✅ عرّف hostName و userAvatar مع بعض
        let hostName = req.body.hostName;
        let userAvatar = null;  // ✅ أضف هذا

        try {
            const user = await botClient.users.fetch(hostId);
            hostName = user.username;
            userAvatar = user.displayAvatarURL({ dynamic: true });  // ✅ أضف هذا
        } catch(e) {
            if (!hostName) hostName = hostId;
            userAvatar = botUser?.displayAvatarURL();  // ✅ أضف هذا
        }

        // صلاحيات البوت
        const permissions = channel.permissionsFor(botClient.user);
        if (!permissions?.has('SendMessages') || !permissions?.has('ViewChannel')) {
            return res.status(403).json({ 
                success: false, 
                error: 'Bot lacks permissions in this channel (Need: SendMessages, ViewChannel)' 
            });
        }

        // تحضير الكود العشوائي
        const giveawayCode = 'GS-' + Math.random().toString(36).substring(2, 10).toUpperCase();

        // تحضير المدة ووقت الانتهاء
        const durationMs = parseDurationString(duration);
        let endsAt;

        if (scheduled) {
            // سحب مجدول: الوقت يبدأ من الوقت المحدد للتشغيل
            const scheduledTime = new Date(scheduled);
            endsAt = new Date(scheduledTime.getTime() + (durationMs || 604800000));
        } else {
            // سحب فوري: الوقت يبدأ من الآن
            endsAt = new Date(Date.now() + (durationMs || 604800000));
        }

        // تحضير عدد الفائزين
        const winnersCount = parseInt(winners) || 1;

        // ✅ تحضير الـ entry values
        let entryValues = null;
        let prizesList = [];

        if (prizes && prizes.trim()) {
            prizesList = prizes.split(',').map(p => p.trim()).filter(Boolean);
            let reqsList = messageReqs ? messageReqs.split(',').map(r => parseInt(r.trim())).filter(n => !isNaN(n)) : [];

            // ✅ ترتيب الأزرار حسب required من الأعلى للأقل
            let buttons = prizesList.map((prize, idx) => ({
                type: `CUSTOM_${idx}`,
                label: prize,
                required: reqsList[idx] || 0
            }));

            // ✅ ترتيب تنازلي (الأعلى أولاً)
            buttons.sort((a, b) => b.required - a.required);

            entryValues = {
                period: messagesPeriod || 'weekly',
                buttons: buttons
            };
        } else {
            entryValues = {
                period: messagesPeriod || 'weekly',
                buttons: [{ type: 'SINGLE', label: 'Join', required: 0 }]
            };
        }

        // ✅ بناء الـ description
        let descriptionText = `# ${title || 'Giveaway'}\n\n`;

        // إضافة الوصف المخصص من المستخدم
        if (description && description.trim()) {
            descriptionText += `### ${description.trim()}\n\n`;
        }

        if (!winnerRoleId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required field: winnerRoleId' 
            });
        }
        descriptionText += `Winner Will Get: <@&${winnerRoleId}>\n`;

        // إضافة الـ blacklist roles
        if (blacklist && blacklist.trim()) {
            descriptionText += `Blacklisted: ${blacklist}\n`;
        }

        // إضافة الـ required roles مع mode
        if (requiredRoles && requiredRoles.trim()) {
            const modeLabel = reqMode === 'y' ? ' (all)' : ' (any)';
            descriptionText += `Required Roles${modeLabel}: ${requiredRoles}\n`;
        }

        // إضافة الـ bypass roles مع mode
        if (bypassRoles && bypassRoles.trim()) {
            const modeLabel = bypassMode === 'y' ? ' (all)' : ' (any)';
            descriptionText += `Bypass Roles${modeLabel}: ${bypassRoles}\n`;
        }

        // إضافة Extra Entries (Multipliers)
        if (multiplier && multiplier.trim()) {
            const mults = multiplier.split(',').map(m => m.trim()).filter(m => m.includes(':'));
            if (mults.length > 0) {
                descriptionText += '\n**Extra Entries:**\n';
                mults.forEach(m => {
                    const [role, weight] = m.split(':');
                    descriptionText += `• ${role}: **${weight}** entries\n`;
                });
            }
        }

        // إضافة متطلبات الرسائل
        if (messagesPeriod !== 'none' && messageReqs) {
            const reqsList = messageReqs.split(',').map(r => parseInt(r.trim())).filter(n => !isNaN(n));
            const periodLabel = (messagesPeriod || 'weekly').toLowerCase();

            if (reqsList.length > 0) {
                descriptionText += `\n**Messages Required (${periodLabel}):**\n`;
                if (prizesList.length > 0) {
                    reqsList.forEach((req, idx) => {
                        const prize = prizesList[idx] || 'Prize';
                        descriptionText += `• ${req} ${periodLabel} messages ➠ ${prize}\n`;
                    });
                } else {
                    reqsList.forEach(req => {
                        descriptionText += `• ${req} ${periodLabel} messages\n`;
                    });
                }
            }
        }

        descriptionText = descriptionText.trim();

        // ✅ حفظ السحب في قاعدة البيانات
        const dbResult = await dbManager.createGiveaway({
            giveawayCode,
            template: template || 'normal',
            title: title || '',
            description: descriptionText,
            color: parseInt(color?.replace('#', ''), 16) || 0x0073ff,
            duration: duration,
            endsAt: endsAt.toISOString(),
            winnersCount: winnersCount,
            entryType: 'messages',
            entryValues: JSON.stringify(entryValues),
            multiplier: multiplier ? JSON.stringify(parseMultiplierInput(multiplier)) : null,
            reqRoleIds: parseRoleIdsFromString(requiredRoles),
            reqRoleMode: reqMode || 'n',
            banRoleIds: parseRoleIdsFromString(blacklist),
            bypassRoleIds: parseRoleIdsFromString(bypassRoles),
            bypassRoleMode: bypassMode || 'n',
            hostId: hostId,
            hostName: hostName,
            imageUrl: image || null,
            guildId: guildId,
            channelId: channelId,
            status: scheduled ? 'scheduled' : 'active',  // ✅ لو فيه scheduled، الحالة تكون scheduled
            schedule: scheduled || null  
        });

        if (!dbResult.success) {
            return res.status(500).json({ success: false, error: dbResult.error });
        }

        // ✅ بعد حفظ السحب في قاعدة البيانات
        if (scheduled) {
            const scheduledTime = new Date(scheduled);
            const delay = scheduledTime.getTime() - Date.now();

            if (delay > 0) {
                console.log(`⏰ Scheduling giveaway ${giveawayCode} to publish in ${Math.round(delay / 1000)} seconds`);

                setTimeout(async () => {
                    try {
                        console.log(`🚀 Publishing scheduled giveaway: ${giveawayCode}`);
                        const giveawayCommand = botClient.commands.get('giveaway');
                        if (giveawayCommand && giveawayCommand.publishScheduledGiveaway) {
                            await giveawayCommand.publishScheduledGiveaway(giveawayCode, botClient);
                        } else {
                            console.error(`❌ Cannot find publishScheduledGiveaway for ${giveawayCode}`);
                        }
                    } catch (err) {
                        console.error(`❌ Failed to publish ${giveawayCode}:`, err);
                    }
                }, delay);
            } else {
                // لو الوقت فات، انشره فوراً
                console.log(`⚠️ Scheduled time already passed for ${giveawayCode}, publishing now...`);
                const giveawayCommand = botClient.commands.get('giveaway');
                if (giveawayCommand && giveawayCommand.publishScheduledGiveaway) {
                    await giveawayCommand.publishScheduledGiveaway(giveawayCode, botClient);
                }
            }
        }

        // ✅ بناء Embed
        const embed = {
            //title: title || 'Giveaway',
            description: descriptionText,
            color: parseInt(color?.replace('#', ''), 16) || 0x0073ff,
            footer: {
                text: `${hostName} | ID: ${giveawayCode}`,
                icon_url: userAvatar
            },
            fields: [
                { name: 'Status', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
                { name: 'Participants', value: '0', inline: true },
                { name: 'Winners', value: `${winnersCount}`, inline: true }
            ]
        };

        // إضافة الصورة لو موجودة
        if (image && image.trim() && (image.startsWith('http://') || image.startsWith('https://'))) {
            embed.image = { url: image };
        }

        // ✅ بناء الأزرار
        const buttons = entryValues.buttons.map((btn, idx) => ({
            type: 2,
            style: 1,
            label: btn.label,
            custom_id: `giveaway_join_${giveawayCode}_${idx}_${btn.type}`,
            emoji: { name: '🎉' }
        }));

        // تقسيم الأزرار في صفوف
        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            rows.push({
                type: 1,
                components: buttons.slice(i, i + 5)
            });
        }

        // إضافة زر Participants لو عدد الأزرار 3 أو أقل
        if (buttons.length > 0 && buttons.length <= 3) {
            if (rows.length > 0) {
                rows[0].components.push({
                    type: 2,
                    style: 2,
                    label: 'Participants',
                    custom_id: `giveaway_participants_${giveawayCode}_view_1`,
                    emoji: { name: '👥' }
                });
            }
        }

        // ✅ نشر السحب في القناة
        let sentMessage = null;
        if (!scheduled) {
            sentMessage = await channel.send({
                embeds: [embed],
                components: rows
            });
        }

        // ✅ تحديث الـ message_id في قاعدة البيانات
        if (sentMessage) {
            await dbManager.updateGiveawayMessage(giveawayCode, sentMessage.id, channelId);
        }

        // ✅ إعداد الـ collector للأزرار
        const giveawayCommand = botClient.commands.get('giveaway');
        if (giveawayCommand && sentMessage) {
            giveawayCommand.setupJoinCollector(sentMessage, giveawayCode, endsAt, {
                winnersCount,
                entryValues,
                multiplier: parseMultiplierInput(multiplier),
                reqRoleIds: parseRoleIdsFromString(requiredRoles),
                reqRoleMode: reqMode || 'n',
                banRoleIds: parseRoleIdsFromString(blacklist),
                bypassRoleIds: parseRoleIdsFromString(bypassRoles),
                bypassRoleMode: bypassMode || 'n',
                title: title || 'Giveaway',
                color: parseInt(color?.replace('#', ''), 16) || 0x0073ff,
                host: { id: hostId, username: hostName }
            }, botClient);

            giveawayCommand.setupConfirmCollector(sentMessage, giveawayCode, botClient);
        }

        // ✅ تسجيل في الـ log channel (فقط لو مش مجدول)
        if (!scheduled) {
            await logToChannel(guild, {
                code: giveawayCode,
                title: title || 'Giveaway',
                winners: winnersCount,
                channel: channel,
                host: { username: hostName },
                endsAt
            });
        }

        const elapsed = Date.now() - startTime;
        console.log(`✅ Giveaway ${giveawayCode} created and ${scheduled ? 'scheduled' : 'published'} in ${elapsed}ms`);

        res.json({ 
            success: true, 
            message: scheduled ? 'Giveaway scheduled successfully! It will be posted at the scheduled time.' : 'Giveaway created and published successfully!',
            code: giveawayCode,
            channel: `#${channel.name}`,
            scheduled: !!scheduled,
            elapsed: `${elapsed}ms`
        });

    } catch (error) {
        console.error('❌ API Create Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Internal server error'
        });
    }
});

// ============================================================
// دوال مساعدة
// ============================================================

function parseRoleIdsFromString(input) {
    if (!input) return [];
    const matches = input.match(/<@&(\d+)>/g) || [];
    return matches.map(m => m.replace(/[<@&>]/g, ''));
}

function parseMultiplierInput(input) {
    if (!input) return null;
    const result = {};
    const parts = input.split(',').map(p => p.trim());
    for (const part of parts) {
        const [role, weight] = part.split(':');
        if (role && weight) {
            const roleId = role.replace(/[<@&>]/g, '');
            result[roleId] = parseInt(weight) || 2;
        }
    }
    return result;
}

async function logToChannel(guild, data) {
    try {
        const logChannelId = '1385531928446373970';
        const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        const embed = {
            title: '🎁 Giveaway Created',
            description: `**Code:** \`${data.code}\`\n**Title:** ${data.title}\n**Winners:** ${data.winners}\n**Channel:** ${data.channel}\n**Host:** ${data.host.username}`,
            color: 0x57F287,
            timestamp: new Date().toISOString(),
            footer: { text: `Ends: ${data.endsAt.toLocaleString()}` }
        };

        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.warn('⚠️ Could not send to log channel:', e.message);
    }
}

// ============================================================
// ⏹️ إنهاء جيف أواي
// ============================================================
router.post('/giveaway/end', async (req, res) => {
    try {
        const { code, guildId, userId } = req.body;

        if (!code || !guildId || !userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: code, guildId, userId' 
            });
        }

        if (!botClient) {
            return res.status(503).json({ 
                success: false, 
                error: 'Bot is not ready yet' 
            });
        }

        console.log(`⏹️ Ending giveaway: ${code} by ${userId}`);

        const guild = await botClient.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const giveaway = await dbManager.getGiveawayByCode(code);
        let channel = null;
        if (giveaway?.channel_id) {
            channel = await guild.channels.fetch(giveaway.channel_id).catch(() => null);
        }

        const giveawayManageCommand = botClient.commands.get('giveawaymanage');
        if (!giveawayManageCommand) {
            return res.status(500).json({ 
                success: false, 
                error: 'Giveaway manage command not found' 
            });
        }

        const mockInteraction = {
            guildId: guildId,
            guild: guild,
            channel: channel,
            user: { 
                id: userId,
                username: member.user.username 
            },
            member: member,
            client: botClient,
            deferReply: async () => {},
            editReply: async (content) => {
                if (channel) await publishToChannel(channel, content);
                return content;
            },
            reply: async (content) => {
                if (channel) await publishToChannel(channel, content);
                return content;
            },
            options: {
                getString: (name) => name === 'end' ? code : null
            }
        };

        await giveawayManageCommand.handleEnd(mockInteraction, code);

        console.log(`✅ Giveaway ${code} ended successfully`);
        res.json({ success: true, message: 'Giveaway ended successfully!' });

    } catch (error) {
        console.error('❌ API End Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to end giveaway' 
        });
    }
});

// ============================================================
// 🎲 إعادة سحب (Reroll)
// ============================================================
router.post('/giveaway/reroll', async (req, res) => {
    try {
        const { code, target, exclude, guildId, userId } = req.body;

        if (!code || !guildId || !userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: code, guildId, userId' 
            });
        }

        if (!botClient) {
            return res.status(503).json({ 
                success: false, 
                error: 'Bot is not ready yet' 
            });
        }

        console.log(`🎲 Rerolling giveaway: ${code} by ${userId}`);

        const guild = await botClient.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const giveaway = await dbManager.getGiveawayByCode(code);
        let channel = null;
        if (giveaway?.channel_id) {
            channel = await guild.channels.fetch(giveaway.channel_id).catch(() => null);
        }

        const giveawayManageCommand = botClient.commands.get('giveawaymanage');
        if (!giveawayManageCommand) {
            return res.status(500).json({ 
                success: false, 
                error: 'Giveaway manage command not found' 
            });
        }

        const mockInteraction = {
            guildId: guildId,
            guild: guild,
            channel: channel,
            user: { id: userId },
            member: member,
            client: botClient,
            deferReply: async () => {},
            editReply: async (content) => {
                if (channel) await publishToChannel(channel, content);
                return content;
            },
            reply: async (content) => {
                if (channel) await publishToChannel(channel, content);
                return content;
            },
            options: {
                getString: (name) => {
                    if (name === 'reroll') {
                        let rerollStr = code;
                        if (target) rerollStr += ' ' + target;
                        if (exclude === 'y') rerollStr += ' y';
                        return rerollStr;
                    }
                    return null;
                }
            }
        };

        await giveawayManageCommand.handleReroll(mockInteraction, code, null, exclude === 'y', target);

        console.log(`✅ Giveaway ${code} rerolled successfully`);
        res.json({ success: true, message: 'Reroll completed!' });

    } catch (error) {
        console.error('❌ API Reroll Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to reroll' 
        });
    }
});

// ============================================================
// ✏️ تعديل جيف أواي
// ============================================================
// ============================================================
// ✏️ تعديل جيف أواي
// ============================================================
router.post('/giveaway/edit', async (req, res) => {
    try {
        const { 
            code, title, duration, winners, image, description, 
            requiredRoles, bypassRoles, blacklist, multiplier, 
            reqMode, bypassMode, guildId,
            color, prizes, messagesPeriod, messageReqs, winnerRoleId, scheduled
        } = req.body;

        if (!code || !guildId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: code, guildId' 
            });
        }

        if (!botClient) {
            return res.status(503).json({ 
                success: false, 
                error: 'Bot is not ready yet' 
            });
        }

        console.log(`✏️ Editing giveaway: ${code} via Dashboard`);

        const guild = await botClient.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        // جلب بيانات السحب الحالية
        const giveaway = await dbManager.getGiveawayByCode(code);
        if (!giveaway) {
            return res.status(404).json({ success: false, error: 'Giveaway not found' });
        }

        // جلب القناة
        let channel = null;
        if (giveaway.channel_id) {
            channel = await guild.channels.fetch(giveaway.channel_id).catch(() => null);
        }

        // ✅ بناء الـ description الجديد (نفس ترتيب giveawayCreate - من غير سطر Prizes)
        let descriptionText = `# ${title || giveaway.title || 'Giveaway'}\n\n`;

        // إضافة الوصف المخصص من المستخدم
        if (description && description.trim()) {
            descriptionText += `### ${description.trim()}\n\n`;
        }

        // ✅ تم إلغاء سطر Prizes
        // if (prizesList.length > 0) {
        //     descriptionText += `**Prizes:** ${prizesList.join(', ')}\n`;
        // }

        if (!winnerRoleId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required field: winnerRoleId' 
            });
        }
        if (!descriptionText.includes('Winner Will Get:')) {
            descriptionText += `Winner Will Get: <@&${winnerRoleId}>\n`;
        }

        if (blacklist && blacklist.trim() && !descriptionText.includes('Blacklisted:')) {
            descriptionText += `Blacklisted: ${blacklist}\n`;
        }

        if (requiredRoles && requiredRoles.trim() && !descriptionText.includes('Required Roles')) {
            const modeLabel = reqMode === 'y' ? ' (ALL required)' : ' (ANY required)';
            descriptionText += `Required Roles${modeLabel}: ${requiredRoles}\n`;
        }

        if (bypassRoles && bypassRoles.trim() && !descriptionText.includes('Bypass Roles')) {
            const modeLabel = bypassMode === 'y' ? ' (ALL required)' : ' (ANY required)';
            descriptionText += `Bypass Roles${modeLabel}: ${bypassRoles}\n`;
        }

        // إضافة Extra Entries (Multipliers) لو موجودة
        if (multiplier && multiplier.trim()) {
            const mults = multiplier.split(',').map(m => m.trim()).filter(m => m.includes(':'));
            if (mults.length > 0 && !descriptionText.includes('**Extra Entries:**')) {
                descriptionText += '\n**Extra Entries:**\n';
                mults.forEach(m => {
                    const [role, weight] = m.split(':');
                    descriptionText += `• ${role}: **${weight}** entries\n`;
                });
            }
        }

        // إضافة متطلبات الرسائل
        if (messagesPeriod && messagesPeriod !== 'none' && messageReqs) {
            const prizesList = prizes ? prizes.split(',').map(p => p.trim()).filter(Boolean) : [];
            const reqsList = messageReqs.split(',').map(r => parseInt(r.trim())).filter(n => !isNaN(n));
            const periodLabel = messagesPeriod.toLowerCase();

            if (reqsList.length > 0 && !descriptionText.includes(`**Messages Required (${periodLabel}):**`)) {
                descriptionText += `\n**Messages Required (${periodLabel}):**\n`;
                if (prizesList.length > 0) {
                    reqsList.forEach((req, idx) => {
                        const prize = prizesList[idx] || 'Prize';
                        descriptionText += `• ${req} ${periodLabel} messages ➠ ${prize}\n`;
                    });
                } else {
                    reqsList.forEach(req => {
                        descriptionText += `• ${req} ${periodLabel} messages\n`;
                    });
                }
            }
        }

        descriptionText = descriptionText.trim();

        // ✅ تحديث قاعدة البيانات مباشرة
        const updates = [];
        const values = [];

        if (scheduled !== undefined) {
            if (scheduled) {
                updates.push(`schedule = $${updates.length + 1}`);
                values.push(scheduled);
                updates.push(`status = $${updates.length + 1}`);
                values.push('scheduled');
            } else {
                updates.push(`schedule = $${updates.length + 1}`);
                values.push(null);
                updates.push(`status = $${updates.length + 1}`);
                values.push('active');
            }
        }
        
        if (title) {
            updates.push(`title = $${updates.length + 1}`);
            values.push(title);
        }
        if (duration) {
            updates.push(`duration = $${updates.length + 1}`);
            values.push(duration);
            // إعادة حساب end_time
            const durationMs = parseDurationString(duration);
            if (durationMs) {
                let newEndTime;
                // إذا كان السحب مجدول، نحسب من وقت الجدولة
                if (scheduled) {
                    const scheduledTime = new Date(scheduled);
                    newEndTime = new Date(scheduledTime.getTime() + durationMs);
                } else {
                    newEndTime = new Date(Date.now() + durationMs);
                }
                updates.push(`end_time = $${updates.length + 1}`);
                values.push(newEndTime.toISOString());
            }
        }
        if (winners) {
            updates.push(`winners_count = $${updates.length + 1}`);
            values.push(parseInt(winners));
        }
        if (image) {
            updates.push(`image_url = $${updates.length + 1}`);
            values.push(image);
        }
        if (descriptionText) {
            updates.push(`description = $${updates.length + 1}`);
            values.push(descriptionText);
        }
        if (color) {
            updates.push(`color = $${updates.length + 1}`);
            values.push(parseInt(color.replace('#', ''), 16));
        }
        if (requiredRoles) {
            updates.push(`reqrole = $${updates.length + 1}::text[]`);
            values.push(requiredRoles ? parseRoleIdsFromString(requiredRoles) : []);
        }
        if (reqMode) {
            updates.push(`req_role_mode = $${updates.length + 1}`);
            values.push(reqMode);
        }
        if (bypassRoles) {
            updates.push(`bypass_role_id = $${updates.length + 1}::text[]`);
            values.push(bypassRoles ? parseRoleIdsFromString(bypassRoles) : []);
        }
        if (bypassMode) {
            updates.push(`bypass_role_mode = $${updates.length + 1}`);
            values.push(bypassMode);
        }
        if (blacklist) {
            updates.push(`banrole = $${updates.length + 1}::text[]`);
            const blacklistArray = blacklist ? parseRoleIdsFromString(blacklist) : [];
            values.push(blacklistArray);
        }
        if (multiplier) {
            updates.push(`multiplier = $${updates.length + 1}::jsonb`);
            values.push(JSON.stringify(parseMultiplierInput(multiplier)));
        }

        if (messagesPeriod !== undefined || messageReqs !== undefined || prizes !== undefined) {
            let prizesList = [];
            let reqsList = [];

            if (prizes) {
                prizesList = prizes.split(',').map(p => p.trim()).filter(Boolean);
            }

            if (messageReqs) {
                reqsList = messageReqs.split(',').map(r => parseInt(r.trim())).filter(n => !isNaN(n));
            }

            let period = (messagesPeriod && messagesPeriod !== 'none') ? messagesPeriod : 'weekly';

            let entryValues = {
                period: period,
                buttons: []
            };

            if (prizesList.length > 0) {
                entryValues.buttons = prizesList.map((prize, idx) => ({
                    type: `CUSTOM_${idx}`,
                    label: prize,
                    required: reqsList[idx] || 0
                }));
            } else {
                entryValues.buttons = [{
                    type: 'SINGLE',
                    label: 'Join',
                    required: 0
                }];
            }

            updates.push(`entry_values = $${updates.length + 1}::jsonb`);
            values.push(JSON.stringify(entryValues));
        }

        if (updates.length > 0) {
            values.push(code);
            const query = `UPDATE giveaways SET ${updates.join(', ')}, updated_at = NOW() WHERE giveaway_code = $${values.length}`;
            await dbManager.run(query, values);
        }

        // ✅ تحديث رسالة السحب في القناة (نفس ترتيب giveawayCreate)
        // ✅ تحديث رسالة السحب في القناة
        if (channel && giveaway.message_id) {
            try {
                const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
                if (message) {
                    const updatedGiveaway = await dbManager.getGiveawayByCode(code);
                    const endsAt = new Date(updatedGiveaway.end_time);

                    // ✅ جلب صورة المستخدم (الـ Host)
                    const hostIdFromGiveaway = updatedGiveaway.host_id;
                    let hostAvatar = null;
                    let hostDisplayName = updatedGiveaway.host_name || 'Host';

                    try {
                        if (hostIdFromGiveaway) {
                            const user = await botClient.users.fetch(hostIdFromGiveaway);
                            hostDisplayName = user.username;
                            hostAvatar = user.displayAvatarURL({ dynamic: true });
                        }
                    } catch(e) {
                        hostAvatar = botClient.user?.displayAvatarURL();
                    }

                    // بناء الـ embed الجديد
                    const embed = {
                        //title: updatedGiveaway.title || 'Giveaway',
                        description: updatedGiveaway.description,
                        color: updatedGiveaway.color || 0x0073ff,
                        footer: {
                            text: `${hostDisplayName} | ID: ${code}`,
                            icon_url: hostAvatar  // ✅ صورة المستخدم
                        },
                        fields: [
                            { name: 'Status', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
                            { name: 'Participants', value: `${Object.keys(updatedGiveaway.entries || {}).length}`, inline: true },
                            { name: 'Winners', value: `${updatedGiveaway.winners_count || 1}`, inline: true }
                        ]
                    };

                    if (updatedGiveaway.image_url) {
                        embed.image = { url: updatedGiveaway.image_url };
                    }

                    // ✅ بناء الأزرار
                    let entryValues = updatedGiveaway.entry_values;
                    if (typeof entryValues === 'string') {
                        try { entryValues = JSON.parse(entryValues); } catch(e) { entryValues = null; }
                    }

                    if (entryValues && entryValues.buttons) {
                        const buttons = entryValues.buttons.map((btn, idx) => ({
                            type: 2,
                            style: 1,
                            label: btn.label,
                            custom_id: `giveaway_join_${code}_${idx}_${btn.type}`,
                            emoji: { name: '🎉' }
                        }));

                        const rows = [];
                        for (let i = 0; i < buttons.length; i += 5) {
                            rows.push({
                                type: 1,
                                components: buttons.slice(i, i + 5)
                            });
                        }

                        if (buttons.length > 0 && buttons.length <= 3 && rows.length > 0) {
                            rows[0].components.push({
                                type: 2,
                                style: 2,
                                label: 'Participants',
                                custom_id: `giveaway_participants_${code}_view_1`,
                                emoji: { name: '👥' }
                            });
                        }

                        await message.edit({ 
                            embeds: [embed],
                            components: rows
                        });
                    } else {
                        await message.edit({ embeds: [embed] });
                    }
                }
            } catch (e) {
                console.warn('⚠️ Could not edit message:', e.message);
            }
        }

        console.log(`✅ Giveaway ${code} edited successfully via Dashboard`);
        res.json({ success: true, message: 'Giveaway edited successfully!' });

    } catch (error) {
        console.error('❌ API Edit Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to edit giveaway' 
        });
    }
});

// دوال مساعدة
function parseRoleIdsFromString(input) {
    if (!input) return [];
    const matches = input.match(/<@&(\d+)>/g) || [];
    return matches.map(m => m.replace(/[<@&>]/g, ''));
}

function parseMultiplierInput(input) {
    if (!input) return null;
    const result = {};
    const parts = input.split(',').map(p => p.trim());
    for (const part of parts) {
        const [role, weight] = part.split(':');
        if (role && weight) {
            const roleId = role.replace(/[<@&>]/g, '');
            result[roleId] = parseInt(weight) || 2;
        }
    }
    return result;
}

function parseDurationString(str) {
    if (!str) return null;
    const units = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
    let ms = 0;
    const regex = /(\d+)\s*(d|h|m|s)/gi;
    let match;
    while ((match = regex.exec(str)) !== null) {
        ms += parseInt(match[1]) * (units[match[2]] || 0);
    }
    return ms || null;
}

// ============================================================
// 🏠 جلب معلومات السيرفر الحالي
// ============================================================
router.get('/guild', async (req, res) => {
    try {
        if (!botClient) {
            return res.status(503).json({ 
                success: false, 
                error: 'Bot is not ready yet' 
            });
        }

        // جلب أول سيرفر موجود فيه البوت (لأن البوت في سيرفر واحد)
        const guild = botClient.guilds.cache.first();

        if (!guild) {
            return res.status(404).json({ 
                success: false, 
                error: 'No guild found' 
            });
        }

        res.json({ 
            success: true, 
            guildId: guild.id,
            guildName: guild.name,
            guildIcon: guild.iconURL()
        });

    } catch (error) {
        console.error('❌ Guild API Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ============================================================
// 🔐 OAuth2 Authentication Endpoints
// ============================================================

// جلب رابط OAuth
router.get('/auth/discord', (req, res) => {
    const { guildId } = req.query;

    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds.members.read',
        state: guildId || ''
    });

    res.json({ 
        success: true, 
        url: `https://discord.com/api/oauth2/authorize?${params.toString()}`
    });
});

// معالج الـ callback بعد تسجيل الدخول
router.get('/auth/discord/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        const guildId = state;

        if (!code) {
            return res.redirect(`${process.env.DASHBOARD_URL}?error=no_code`);
        }

        // تبادل الكود مع توكن
        const tokenParams = new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.DISCORD_REDIRECT_URI
        });

        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            return res.redirect(`${process.env.DASHBOARD_URL}?error=token_failed`);
        }

        // جلب بيانات المستخدم
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        const userData = await userResponse.json();

        // جلب رتب المستخدم في السيرفر
        const guild = botClient.guilds.cache.get(guildId);
        let hasModerateRole = false;
        let moderateRoleId = null;

        // جلب الـ moderate role من الداتابيز
        const moderateSetting = await dbManager.getBotSetting('moderateRole');
        if (moderateSetting) {
            let roleData = moderateSetting.setting_value;
            if (typeof roleData === 'string') roleData = JSON.parse(roleData);
            moderateRoleId = roleData.id;

            if (guild) {
                try {
                    const member = await guild.members.fetch(userData.id);
                    hasModerateRole = member.roles.cache.has(moderateRoleId);
                } catch(e) {
                    console.error('Failed to fetch member:', e);
                }
            }
        }

        // إنشاء session token (JWT بسيط)
        const sessionToken = Buffer.from(JSON.stringify({
            userId: userData.id,
            username: userData.username,
            guildId: guildId,
            hasModerateRole: hasModerateRole,
            expires: Date.now() + 24 * 60 * 60 * 1000
        })).toString('base64');

        // التوجيه للـ Dashboard مع الـ token
        const redirectUrl = `${process.env.DASHBOARD_URL}?token=${sessionToken}`;
        res.redirect(redirectUrl);

    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`${process.env.DASHBOARD_URL}?error=auth_failed`);
    }
});

// التحقق من صحة المستخدم
router.get('/auth/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ success: false, error: 'No token provided' });
        }

        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

        if (decoded.expires < Date.now()) {
            return res.status(401).json({ success: false, error: 'Token expired' });
        }

        // التحقق من الرتبة تاني من السيرفر (للتأكد)
        const guild = botClient.guilds.cache.get(decoded.guildId);
        let hasModerateRole = false;

        if (guild) {
            try {
                const member = await guild.members.fetch(decoded.userId);
                const moderateSetting = await dbManager.getBotSetting('moderateRole');
                if (moderateSetting) {
                    let roleData = moderateSetting.setting_value;
                    if (typeof roleData === 'string') roleData = JSON.parse(roleData);
                    hasModerateRole = member.roles.cache.has(roleData.id);
                }
            } catch(e) {}
        }

        if (!hasModerateRole && decoded.hasModerateRole) {
            decoded.hasModerateRole = false;
        }

        res.json({ 
            success: true, 
            user: {
                id: decoded.userId,
                username: decoded.username,
                hasModerateRole: decoded.hasModerateRole
            }
        });

    } catch (error) {
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

// ============================================================
// 🗑️ إلغاء جيف أواي مجدول (Scheduled)
// ============================================================
router.post('/giveaway/cancel-scheduled', async (req, res) => {
    try {
        const { code, guildId } = req.body;

        if (!code || !guildId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: code, guildId' 
            });
        }

        if (!botClient) {
            return res.status(503).json({ 
                success: false, 
                error: 'Bot is not ready yet' 
            });
        }

        const giveaway = await dbManager.getGiveawayByCode(code);

        if (!giveaway) {
            return res.status(404).json({ 
                success: false, 
                error: 'Giveaway not found' 
            });
        }

        // ✅ التأكد إن السحب مجدول
        if (giveaway.status !== 'scheduled') {
            return res.status(400).json({ 
                success: false, 
                error: 'Only scheduled giveaways can be cancelled' 
            });
        }

        // ✅ حذف السحب من قاعدة البيانات
        const deleted = await dbManager.deleteGiveaway(code);

        if (deleted.success) {
            console.log(`🗑️ Cancelled scheduled giveaway: ${code}`);
            res.json({ 
                success: true, 
                message: `Giveaway ${code} has been cancelled and removed from schedule.` 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to delete giveaway from database' 
            });
        }

    } catch (error) {
        console.error('❌ API Cancel Scheduled Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to cancel scheduled giveaway' 
        });
    }
});
// ============================================================
// تصدير
// ============================================================
module.exports = { router, initAPI };