const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const dbManager = require("../Data/database");
const mainLevelSystem = require("../LevelSystem/levelsystem");

// ========== نظام الـ Tiers الجديد (بدل الـ Levels) ==========
class TierSystem {
    constructor() {
        // نظام الـ 5 Tiers الجديد
        this.tiers = [
            { tier: 0, xpRequired: 0, roleId: null },        // Tier 0 = مبتدئ
            { tier: 1, xpRequired: 1500, roleId: null },     // Tier 1 = Level 3 XP
            { tier: 2, xpRequired: 10000, roleId: null },    // Tier 2 = Level 6 XP
            { tier: 3, xpRequired: 55000, roleId: null },    // Tier 3 = Level 9 XP
            { tier: 4, xpRequired: 145000, roleId: null },   // Tier 4 = Level 12 XP
            { tier: 5, xpRequired: 280000, roleId: null }    // Tier 5 = Level 15 XP
        ];

        // Channel ID للإشعارات
        this.notificationChannelId = "123456789012345693";
    }

    // تحويل رقم التير لرقم روماني (Tier 0 = "-")
    toRoman(num) {
        if (num === 0) return "-";

        const romanNumerals = {
            1: "I",
            2: "II",
            3: "III",
            4: "IV",
            5: "V"
        };
        return romanNumerals[num] || num.toString();
    }

    // الحصول على التير بناءً على الـ XP
    getTierFromXP(xp) {
        for (let i = this.tiers.length - 1; i >= 0; i--) {
            if (xp >= this.tiers[i].xpRequired) {
                return this.tiers[i];
            }
        }
        return this.tiers[0]; // Tier 0 افتراضي
    }

    // الحصول على التير التالي
    getNextTier(currentTier) {
        if (currentTier.tier === 0) {
            return this.tiers[1] || null;
        }

        const nextIndex = this.tiers.findIndex(t => t.tier === currentTier.tier) + 1;
        return this.tiers[nextIndex] || null;
    }
}

// دالة مساعدة لرسم مستطيل مستدير
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
}

// دالة لرسم قوس بروجرس بار حول الدائرة
function drawProgressArc(
    ctx,
    centerX,
    centerY,
    radius,
    startAngle,
    endAngle,
    color,
    lineWidth,
) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Show user statistics in an image")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("User to show statistics for")
                .setRequired(false),
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser("user") || interaction.user;
            const member = interaction.guild.members.cache.get(targetUser.id) ||
                (await interaction.guild.members.fetch(targetUser.id).catch(() => null));

            if (!member) {
                return interaction.editReply({
                    content: "❌ User not found in this server",
                    ephemeral: true,
                });
            }

            // ========== جلب الخلفية ==========
            let userWallpaperUrl = null;
            try {
                const userData = await dbManager.get(
                    `SELECT wallpaper_url FROM levels WHERE user_id = ?`,
                    [targetUser.id]
                );

                if (userData && userData.wallpaper_url && 
                    userData.wallpaper_url !== 'null' && 
                    userData.wallpaper_url.trim() !== '') {
                    userWallpaperUrl = userData.wallpaper_url;
                    console.log(`🎨 Custom wallpaper found for ${targetUser.username}: ${userWallpaperUrl}`);
                } else {
                    console.log(`🎨 No custom wallpaper for ${targetUser.username}, using default`);
                }
            } catch (dbError) {
                console.error('❌ Error fetching wallpaper from DB:', dbError);
            }

            // جلب الليمتس الفعالة
            const effectiveLimits = await mainLevelSystem.getEffectiveDailyLimits(targetUser.id);
            const maxXP = effectiveLimits.MAX_XP || 500;
            const maxCoins = effectiveLimits.MAX_COINS || 750;

            console.log(`📊 Rank Limits for ${targetUser.username}: XP=${maxXP}, Coins=${maxCoins}`);

            // جلب بيانات المستخدم من الداتابيز
            let userData = {
                xpEarnedToday: 0,
                coinsEarnedToday: 0,
                totalXP: 0,
                sky_coins: 0,
                sky_crystals: 0,
                chatPoints: 0,
                voicePoints: 0,
                last_daily: null,
                last_weekly: null,
            };

            try {
                // جلب بيانات المستوى الأساسية
                const userProfile = await dbManager.getUserProfile(targetUser.id);

                if (userProfile) {
                    userData.xpEarnedToday = userProfile.xp_earned_today ?? 0;
                    userData.coinsEarnedToday = userProfile.coins_earned_today ?? 0;
                    userData.totalXP = userProfile.xp ?? 0;
                    userData.sky_coins = userProfile.sky_coins ?? 0;
                    userData.sky_crystals = userProfile.sky_crystals ?? 0;
                    userData.chatPoints = userProfile.chat_points ?? 0;
                    userData.voicePoints = userProfile.voice_points ?? 0;
                    userData.last_daily = userProfile.last_daily;
                    userData.last_weekly = userProfile.last_weekly;
                }

                // جلب بيانات Skywell
                const skywellData = await dbManager.get(
                    'SELECT total_coins_thrown, total_converted_coins, current_level FROM skywell_users WHERE user_id = ?',
                    [targetUser.id]
                );

                if (skywellData) {
                    userData.total_coins_thrown = skywellData.total_coins_thrown ?? 0;
                    userData.total_converted_coins = skywellData.total_converted_coins ?? 0;
                    userData.current_level = skywellData.current_level ?? 0;
                }

                console.log(`📊 All Data Loaded for ${targetUser.username}`);

            } catch (dbError) {
                console.log("Error loading data:", dbError.message);
            }

            // جلب عدد الرسائل الإجمالي
            let totalSentMessages = 0;
            try {
                const messageStats = await dbManager.get(
                    'SELECT sent FROM message_stats WHERE user_id = ?',
                    [targetUser.id]
                );
                totalSentMessages = messageStats?.sent || 0;
            } catch (error) {
                console.error('⚠️ Error fetching message stats:', error.message);
            }

            // ========== نظام الـ Tiers الجديد ==========
            const tierSystem = new TierSystem();
            const currentTierData = tierSystem.getTierFromXP(userData.totalXP);
            const nextTierData = tierSystem.getNextTier(currentTierData);

            // الأرقام الرومانية للتير الحالي والتالي
            const currentRoman = tierSystem.toRoman(currentTierData.tier);
            const nextRoman = nextTierData ? tierSystem.toRoman(nextTierData.tier) : "MAX";

            // حساب الرتبة حسب الـ XP
            let userRank = 1;
            try {
                const rankResult = await dbManager.get(
                    'SELECT COUNT(*) + 1 as rank FROM levels WHERE xp > ?',
                    [userData.totalXP]
                );

                if (rankResult && rankResult.rank) {
                    userRank = rankResult.rank;
                }

                console.log(`📊 Calculated Rank for ${targetUser.username}: #${userRank} (XP: ${userData.totalXP})`);
            } catch (error) {
                console.log("Error calculating rank:", error.message);
            }

            // أبعاد الصورة
            const width = 940;
            const height = 296;
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext("2d");

            // تحميل الخلفية
            let mainBackground;
            let backgroundSource = 'default';

            try {
                if (userWallpaperUrl) {
                    try {
                        mainBackground = await loadImage(userWallpaperUrl);
                        backgroundSource = 'custom';
                        console.log(`✅ Loaded custom wallpaper from: ${userWallpaperUrl}`);
                    } catch (customError) {
                        console.warn(`⚠️ Failed to load custom wallpaper:`, customError.message);
                        mainBackground = await loadImage("https://i.ibb.co/201993LH/Main-Wallpaper.png");
                        console.log(`✅ Loaded default wallpaper (custom failed)`);
                    }
                } else {
                    mainBackground = await loadImage("https://i.ibb.co/201993LH/Main-Wallpaper.png");
                    console.log(`✅ Loaded default wallpaper (no custom)`);
                }
            } catch (bgError) {
                console.error('❌ Failed to load any wallpaper:', bgError);
                ctx.fillStyle = "#1a1a2e";
                ctx.fillRect(0, 0, width, height);
                console.log("⚠️ Using fallback solid background");
            }

            if (mainBackground) {
                ctx.drawImage(mainBackground, 0, 0, width, height);
                console.log(`🎨 Background drawn (source: ${backgroundSource})`);
            }

            // تحميل خلفية الكومبوننتات
            try {
                const componentsBackground = await loadImage("https://i.ibb.co/BVYPsqbX/Compenets.png");
                const compX = 45;
                const compY = 25;
                const compWidth = 876;
                const compHeight = 289;

                ctx.drawImage(componentsBackground, compX, compY, compWidth, compHeight);
                console.log(`✅ Components background drawn`);
            } catch (componentsError) {
                console.error('❌ Failed to load components background:', componentsError);
            }

            // الإحداثيات الأساسية
            const circleX = 137 - 7;
            const circleY = 125 - 10;
            const circleRadius = 85;
            const progressBarWidth = 5;

            // صورة المستخدم في الدائرة
            try {
                const avatarUrl = targetUser.displayAvatarURL({
                    extension: "png",
                    size: 512,
                });
                const avatar = await loadImage(avatarUrl);

                ctx.save();
                ctx.beginPath();
                ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();

                ctx.drawImage(
                    avatar,
                    circleX - circleRadius,
                    circleY - circleRadius,
                    circleRadius * 2,
                    circleRadius * 2,
                );

                ctx.restore();

                ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;

                ctx.beginPath();
                ctx.arc(circleX, circleY, circleRadius + 2, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log("✅ Avatar added successfully with dropshadow");
            } catch (error) {
                console.error("❌ Failed to load avatar:", error);
            }

            // رسم البروجرس بار حول الدائرة - XP (النصف الأيسر)
            try {
                const xpProgress = Math.min(
                    1,
                    Math.max(0, userData.xpEarnedToday / maxXP),
                );
                const startAngleXP = Math.PI / 2;
                const endAngleXP = startAngleXP + xpProgress * Math.PI;
                const xpColor = "#0073ff";

                ctx.shadowColor = "rgba(0, 115, 255, 0.5)";
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                drawProgressArc(
                    ctx,
                    circleX,
                    circleY,
                    circleRadius + progressBarWidth / 2,
                    startAngleXP,
                    endAngleXP,
                    xpColor,
                    progressBarWidth,
                );

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ XP Progress Arc: ${userData.xpEarnedToday}/${maxXP}`);
            } catch (error) {
                console.error("❌ Failed to draw XP progress arc:", error);
            }

            // رسم البروجرس بار حول الدائرة - Coins (النصف الأيمن)
            try {
                const coinsProgress = Math.min(
                    1,
                    Math.max(0, userData.coinsEarnedToday / maxCoins),
                );
                const startAngleCoins = Math.PI / 2;
                const endAngleCoins = startAngleCoins - coinsProgress * Math.PI;
                const coinsColor = "#FFD700";

                ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                drawProgressArc(
                    ctx,
                    circleX,
                    circleY,
                    circleRadius + progressBarWidth / 2,
                    endAngleCoins,
                    startAngleCoins,
                    coinsColor,
                    progressBarWidth,
                );

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Coins Progress Arc: ${userData.coinsEarnedToday}/${maxCoins}`);
            } catch (error) {
                console.error("❌ Failed to draw Coins progress arc:", error);
            }

            // الاسم المستخدم
            try {
                ctx.font = "bold 40px Arial";
                const usernameGradient = ctx.createLinearGradient(245, 50, 500, 50);
                usernameGradient.addColorStop(0, "#0073ff");
                usernameGradient.addColorStop(1, "#FFFFFF");
                ctx.fillStyle = usernameGradient;
                ctx.textAlign = "left";

                const textX = 240;
                const textY = 52;

                const username = targetUser.username;
                const maxLength = 18;
                const displayText = username.length > maxLength
                    ? username.substring(0, maxLength - 3) + "..."
                    : username;

                ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;

                ctx.fillText(displayText, textX, textY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Username added: ${username}`);
            } catch (error) {
                console.error("❌ Failed to add username:", error);
            }

            // Progress Bar (باستخدام الـ Tiers بدل الـ Levels)
            try {
                const barX = 250;
                const barY = 210;
                const barWidth = 650;
                const barHeight = 35;
                const barRadius = barHeight / 2;

                // حساب التقدم بين الـ Tiers
                const currentTierXP = currentTierData.xpRequired;
                const nextTierXP = nextTierData ? nextTierData.xpRequired : currentTierXP;

                let progress = 0;
                if (nextTierData) {
                    if (currentTierData.tier === 0) {
                        progress = userData.totalXP / nextTierXP;
                    } else {
                        progress = (userData.totalXP - currentTierXP) / (nextTierXP - currentTierXP);
                    }
                    progress = Math.max(0, Math.min(1, progress));
                }

                ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;

                // خلفية البروجرس بار
                ctx.fillStyle = "#0B0B0B";
                drawRoundedRect(ctx, barX, barY, barWidth, barHeight, barRadius);
                ctx.fill();

                // الجزء المملوء
                if (progress > 0) {
                    const filledWidth = Math.floor(barWidth * progress);

                    if (filledWidth >= 1) {
                        const gradient = ctx.createLinearGradient(
                            barX, barY,
                            barX + filledWidth, barY
                        );
                        gradient.addColorStop(0, "#004599");
                        gradient.addColorStop(0.5, "#0073ff");
                        gradient.addColorStop(1, "#2D8CFF");

                        ctx.fillStyle = gradient;

                        ctx.shadowColor = "rgba(0, 115, 255, 0.5)";
                        ctx.shadowBlur = 8;
                        ctx.shadowOffsetX = 2;
                        ctx.shadowOffsetY = 2;

                        ctx.save();
                        ctx.beginPath();
                        drawRoundedRect(ctx, barX, barY, barWidth, barHeight, barRadius);
                        ctx.clip();
                        ctx.fillRect(barX, barY, filledWidth, barHeight);
                        ctx.restore();

                        console.log(`✅ Progress Bar: ${Math.round(progress * 100)}%`);
                    }
                }

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                // نص التقدم
                const displayText = nextTierData ? `${userData.totalXP} / ${nextTierXP}` : `${userData.totalXP} / MAX`;
                ctx.font = "bold 16px Arial";

                const textGradient = ctx.createLinearGradient(
                    barX + barWidth/2 - 50, barY + barHeight/2,
                    barX + barWidth/2 + 50, barY + barHeight/2
                );
                textGradient.addColorStop(0, "#FFFFFF");
                textGradient.addColorStop(1, "#CCCCCC");
                ctx.fillStyle = textGradient;

                ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                ctx.shadowBlur = 5;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(displayText, barX + barWidth / 2, barY + barHeight / 2);

                // Current Tier على اليسار
                ctx.font = "bold 28px Arial";
                const leftGradient = ctx.createLinearGradient(barX + 20, barY - 20, barX + 40, barY - 5);
                leftGradient.addColorStop(0, "#1D83FF");
                leftGradient.addColorStop(1, "#0073ff");
                ctx.fillStyle = leftGradient;
                ctx.textAlign = "center";

                ctx.shadowColor = "rgba(0, 150, 255, 0.75)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.fillText(currentRoman, barX + 30, barY - 15);

                // Next Tier على اليمين
                const rightGradient = ctx.createLinearGradient(barX + barWidth - 45, barY - 20, barX + barWidth - 25, barY - 5);
                rightGradient.addColorStop(0, "#FFD700");
                rightGradient.addColorStop(1, "#FFA500");
                ctx.fillStyle = rightGradient;
                const nextRomanText = nextTierData ? nextRoman : "MAX";

                ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.fillText(nextRomanText, barX + barWidth - 35, barY - 15);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

            } catch (error) {
                console.error("❌ Progress Bar Error:", error);
            }

            // XP Today
            try {
                ctx.font = "bold 24px Arial";
                const xpGradient = ctx.createLinearGradient(75, 240, 105, 240);
                xpGradient.addColorStop(0, "#ffffff");
                xpGradient.addColorStop(1, "#0073ff");
                ctx.fillStyle = xpGradient;
                ctx.textAlign = "center";

                const xpTextX = 80;
                const xpTextY = 247;

                ctx.shadowColor = "rgba(0, 150, 255, 0.75)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.fillText(userData.xpEarnedToday.toString(), xpTextX, xpTextY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ XP Today (${userData.xpEarnedToday}) added successfully`);
            } catch (error) {
                console.error("❌ Failed to add XP:", error);
            }

            // Coins Today
            try {
                ctx.font = "bold 24px Arial";
                const coinsGradient = ctx.createLinearGradient(165, 240, 195, 240);
                coinsGradient.addColorStop(0, "#FFD700");
                coinsGradient.addColorStop(1, "#FFA500");
                ctx.fillStyle = coinsGradient;
                ctx.textAlign = "center";

                const coinsTextX = 178;
                const coinsTextY = 247;

                ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.fillText(userData.coinsEarnedToday.toString(), coinsTextX, coinsTextY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Coins Today (${userData.coinsEarnedToday}) added successfully`);
            } catch (error) {
                console.error("❌ Failed to add Coins:", error);
            }

            // Chat Points
            try {
                ctx.font = "bold 28px Arial";
                const chatGradient = ctx.createLinearGradient(320, 105, 360, 115);
                chatGradient.addColorStop(0, "#FFFFFF");
                chatGradient.addColorStop(1, "#0073ff");
                ctx.fillStyle = chatGradient;
                ctx.textAlign = "center";

                const chatPointsX = 327;
                const chatPointsY = 95;

                ctx.shadowColor = "rgba(0, 170, 255, 0.5)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.fillText(`${userData.chatPoints}`, chatPointsX, chatPointsY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Chat Points (${userData.chatPoints})`);
            } catch (error) {
                console.error("❌ Failed to add Chat Points:", error);
            }

            // Voice Points
            try {
                ctx.font = "bold 28px Arial";
                const voiceGradient = ctx.createLinearGradient(810, 105, 850, 115);
                voiceGradient.addColorStop(0, "#FFFFFF");
                voiceGradient.addColorStop(1, "#0073ff");
                ctx.fillStyle = voiceGradient;
                ctx.textAlign = "center";

                const voicePointsX = 805;
                const voicePointsY = 95;

                ctx.shadowColor = "rgba(0, 255, 136, 0.5)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.fillText(`${userData.voicePoints}`, voicePointsX, voicePointsY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Voice Points (${userData.voicePoints})`);
            } catch (error) {
                console.error("❌ Failed to add Voice Points:", error);
            }

            // Sky Coins
            try {
                ctx.font = "bold 17px Arial";
                const coinsGradient = ctx.createLinearGradient(405, 272, 435, 282);
                coinsGradient.addColorStop(0, "#FFD700");
                coinsGradient.addColorStop(1, "#FFA500");
                ctx.fillStyle = coinsGradient;
                ctx.textAlign = "center";

                const skyCoinsX = 328;
                const skyCoinsY = 278;

                ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                ctx.fillText(`${userData.sky_coins}`, skyCoinsX, skyCoinsY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Sky Coins: ${userData.sky_coins}`);
            } catch (error) {
                console.error("❌ Failed to add Sky Coins:", error);
            }

            // Sky Crystals
            try {
                ctx.font = "bold 17px Arial";
                const crystalsGradient = ctx.createLinearGradient(535, 272, 565, 282);
                crystalsGradient.addColorStop(0, "#55E8FF");
                crystalsGradient.addColorStop(1, "#FFFFFF");
                ctx.fillStyle = crystalsGradient;
                ctx.textAlign = "center";

                const skyCrystalsX = 428;
                const skyCrystalsY = 278;

                ctx.shadowColor = "rgba(0, 255, 255, 0.5)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                ctx.fillText(`${userData.sky_crystals}`, skyCrystalsX, skyCrystalsY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Sky Crystals: ${userData.sky_crystals}`);
            } catch (error) {
                console.error("❌ Failed to add Sky Crystals:", error);
            }

            // Total Effective Coins (Skywell)
            try {
                ctx.font = "bold 16px Arial";
                const thrownGradient = ctx.createLinearGradient(655, 272, 685, 282);
                thrownGradient.addColorStop(0, "#FFD700");
                thrownGradient.addColorStop(1, "#FFA500");
                ctx.fillStyle = thrownGradient;
                ctx.textAlign = "center";

                const thrownX = 813;
                const thrownY = 283;

                const totalCoinsThrown = userData.total_coins_thrown !== undefined ? userData.total_coins_thrown : 0;
                const totalConvertedCoins = userData.total_converted_coins !== undefined ? userData.total_converted_coins : 0;
                const totalThrown = totalCoinsThrown + totalConvertedCoins;
                const thrownValue = (totalCoinsThrown > 0 || totalConvertedCoins > 0) ? totalThrown.toString() : "-";

                ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                ctx.fillText(`${thrownValue}`, thrownX, thrownY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Total Effective Coins: ${thrownValue}`);
            } catch (error) {
                console.error("❌ Failed to add Total Effective Coins:", error);
            }

            // Skywell Current Level
            try {
                ctx.font = "bold 17px Arial";
                const levelGradient = ctx.createLinearGradient(775, 272, 805, 282);
                levelGradient.addColorStop(0, "#4ECDC4");
                levelGradient.addColorStop(1, "#44A08D");
                ctx.fillStyle = levelGradient;
                ctx.textAlign = "center";

                const levelX = 697;
                const levelY = 283;

                const levelValue = userData.current_level !== undefined ? userData.current_level : "-";

                ctx.shadowColor = "rgba(0, 150, 255, 0.75)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                ctx.fillText(`${levelValue}`, levelX, levelY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Skywell Current Level: ${levelValue}`);
            } catch (error) {
                console.error("❌ Failed to add Skywell Current Level:", error);
            }

            // Rank
            try {
                const rankX = 560;
                const rankY = 80;

                ctx.font = "bold 24px Arial";
                const rankGradient = ctx.createLinearGradient(
                    rankX - 30, rankY,
                    rankX + 30, rankY
                );
                rankGradient.addColorStop(0, "#FFFFFF");
                rankGradient.addColorStop(1, "#0073ff");
                ctx.fillStyle = rankGradient;
                ctx.textAlign = "center";

                ctx.shadowColor = "rgba(0, 150, 255, 0.75)";
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;

                ctx.fillText(`${userRank}`, rankX, rankY + 10);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Rank #${userRank}`);
            } catch (error) {
                console.error("❌ Failed to add Rank:", error);
            }

            // OG Badge
            try {
                if (totalSentMessages >= 10000) {
                    ctx.font = "bold 18px Arial";
                    const ogGradient = ctx.createLinearGradient(245, 90, 305, 100);
                    ogGradient.addColorStop(0, "#FFD700");
                    ogGradient.addColorStop(1, "#FFA500");
                    ctx.fillStyle = ogGradient;
                    ctx.textAlign = "left";

                    ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
                    ctx.shadowBlur = 8;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;

                    ctx.fillText("OG", 110, 219);

                    ctx.shadowColor = "transparent";
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;

                    console.log(`✅ Added OG badge for ${targetUser.username} (${totalSentMessages} messages)`);
                }
            } catch (error) {
                console.error('❌ Failed to add OG badge:', error.message);
            }

            // Daily Checkmark
            try {
                const now = new Date();
                const dailyCheckX = 528;
                const dailyCheckY = 270;
                const checkSize = 20;

                const dailyIconUrl = "https://i.ibb.co/wNH2XLg9/Check.png";

                ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                if (userData.last_daily) {
                    const lastDaily = new Date(userData.last_daily);
                    const hoursDiff = (now - lastDaily) / (1000 * 60 * 60);

                    if (hoursDiff < 24) {
                        try {
                            const dailyIcon = await loadImage(dailyIconUrl);
                            ctx.drawImage(dailyIcon, dailyCheckX, dailyCheckY, checkSize, checkSize);
                            console.log("✅ Daily checkmark icon added from URL");
                        } catch (iconError) {
                            ctx.fillStyle = "#0073ff";
                            ctx.beginPath();
                            ctx.arc(dailyCheckX + checkSize/2, dailyCheckY + checkSize/2, checkSize/2, 0, Math.PI * 2);
                            ctx.fill();

                            ctx.fillStyle = "#FFFFFF";
                            ctx.font = "bold 16px Arial";
                            ctx.textAlign = "center";
                            ctx.textBaseline = "middle";
                            ctx.fillText("✓", dailyCheckX + checkSize/2, dailyCheckY + checkSize/2);
                        }
                    } else {
                        ctx.fillStyle = "#073ff";
                        ctx.beginPath();
                        ctx.arc(dailyCheckX + checkSize/2, dailyCheckY + checkSize/2, checkSize/2, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = "#FFFFFF";
                        ctx.font = "bold 16px Arial";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText("D", dailyCheckX + checkSize/2, dailyCheckY + checkSize/2);
                    }
                } else {
                    const centerX = dailyCheckX + checkSize/2;
                    const centerY = dailyCheckY + checkSize/2;
                    const radiusX = (checkSize/2) + 1.5;
                    const radiusY = (checkSize/2) + 1.5;

                    ctx.fillStyle = "#0073ff";
                    ctx.beginPath();
                    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = "#FFFFFF";
                    ctx.font = "bold 16px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("D", centerX, centerY);
                }

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

            } catch (error) {
                console.error("❌ Failed to add daily checkmark:", error);
            }

            // Weekly Checkmark
            try {
                const now = new Date();
                const weeklyCheckX = 573;
                const weeklyCheckY = 270;
                const checkSize = 20;

                const weeklyIconUrl = "https://i.ibb.co/wNH2XLg9/Check.png";

                ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                if (userData.last_weekly) {
                    const lastWeekly = new Date(userData.last_weekly);
                    const daysDiff = (now - lastWeekly) / (1000 * 60 * 60 * 24);

                    if (daysDiff < 7) {
                        try {
                            const weeklyIcon = await loadImage(weeklyIconUrl);
                            ctx.drawImage(weeklyIcon, weeklyCheckX, weeklyCheckY, checkSize, checkSize);
                            console.log("✅ Weekly checkmark icon added from URL");
                        } catch (iconError) {
                            ctx.fillStyle = "#0073ff";
                            ctx.beginPath();
                            ctx.arc(weeklyCheckX + checkSize/2, weeklyCheckY + checkSize/2, checkSize/2, 0, Math.PI * 2);
                            ctx.fill();

                            ctx.fillStyle = "#FFFFFF";
                            ctx.font = "bold 16px Arial";
                            ctx.textAlign = "center";
                            ctx.textBaseline = "middle";
                            ctx.fillText("✓", weeklyCheckX + checkSize/2, weeklyCheckY + checkSize/2);
                        }
                    } else {
                        ctx.fillStyle = "#FF0000";
                        ctx.beginPath();
                        ctx.arc(weeklyCheckX + checkSize/2, weeklyCheckY + checkSize/2, checkSize/2, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = "#FFFFFF";
                        ctx.font = "bold 14px Arial";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText("W", weeklyCheckX + checkSize/2, weeklyCheckY + checkSize/2);
                    }
                } else {
                    const centerX = weeklyCheckX + checkSize/2;
                    const centerY = weeklyCheckY + checkSize/2;
                    const radiusX = (checkSize/2) + 1.5;
                    const radiusY = (checkSize/2) + 1.5;

                    ctx.fillStyle = "#0073ff";
                    ctx.beginPath();
                    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = "#FFFFFF";
                    ctx.font = "bold 14px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("W", centerX, centerY);
                }

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

            } catch (error) {
                console.error("❌ Failed to add weekly checkmark:", error);
            }

            // تحويل وإرسال
            const buffer = canvas.toBuffer("image/png");
            const attachment = new AttachmentBuilder(buffer, {
                name: "rank-card.png",
            });

            await interaction.editReply({
                files: [attachment],
            });

            console.log(`✅ Rank card generated successfully for ${targetUser.username}`);
            console.log(`🎨 Background: ${backgroundSource}`);
            console.log(`📊 Stats:`);
            console.log(`  - Tier: ${currentRoman} (${currentTierData.tier})`);
            console.log(`  - Rank: #${userRank}`);
            console.log(`  - XP Total: ${userData.totalXP}`);
            console.log(`  - XP Today: ${userData.xpEarnedToday}/${maxXP}`);
            console.log(`  - Coins Today: ${userData.coinsEarnedToday}/${maxCoins}`);

        } catch (error) {
            console.error("Error in /rank command:", error);
            await interaction.editReply({
                content: "❌ An error occurred. Please try again.",
                ephemeral: true,
            });
        }
    },
};