const { SectionBuilder, ContainerBuilder, MessageFlags } = require('discord.js');
const dbManager = require('../Data/database');
const buffSystem = require('../LevelSystem/globalbuffs');
const levelSystem = require('../LevelSystem/levelsystem');

const BUMP_BOT_SETTINGS = {
    BUMP_BOT_ID: '813077581749288990',
    ALLOWED_CHANNEL_IDS: ['1385514822132830299'],
    KEYWORDS: ['bump', 'bumped', 'bumping', 'done', 'server bumped']
};

async function execute(message, client) {
    console.log('🎯 === BUMP SYSTEM TRIGGERED ===');
    console.log(`📊 Message ID: ${message.id}`);

    if (!isValidMessage(message)) {
        console.log('❌ Message validation failed');
        console.log('🎯 === END BUMP SYSTEM ===');
        return;
    }

    const bumpData = await extractBumpData(message);
    if (!bumpData) {
        console.log('❌ Not a bump message or no user found');
        console.log('🎯 === END BUMP SYSTEM ===');
        return;
    }

    console.log(`✅ Valid bump detected from ${bumpData.username} (${bumpData.userId})`);
    await giveBumpRewards(bumpData, client, message.guild);
    console.log('🎯 === BUMP REWARDS GIVEN ===');
}

async function giveBumpRewards(bumpData, client, guild) {
    try {
        console.log(`🎁 Calculating bump rewards for ${bumpData.username}...`);

        const xp = calculateBumpXP();
        const coins = calculateBumpCoins();
        const hasCrystal = calculateCrystalChance();

        console.log(`📊 Base Rewards: ${xp} XP, ${coins} Coins, Crystal: ${hasCrystal ? 'YES' : 'NO'}`);

        // ⭐⭐ استخدام levelSystem مع skipDailyLimits ⭐⭐
        const rewardResult = await updateUserRewards(
            bumpData.userId, 
            bumpData.username, 
            xp, 
            coins, 
            hasCrystal, 
            guild
        );

        if (!rewardResult.success) {
            console.error(`❌ Failed to give bump rewards to ${bumpData.username}`);
            return;
        }

        const finalXP = rewardResult.xp;
        const finalCoins = rewardResult.coins;
        const finalCrystals = rewardResult.crystals;
        const userBuff = rewardResult.buffApplied || 0;
        const levelUp = rewardResult.levelUp;
        const newLevel = rewardResult.newLevel;

        console.log(`📊 Final Rewards: ${finalXP} XP (+${userBuff}%), ${finalCoins} Coins (+${userBuff}%)`);
        if (levelUp) {
            console.log(`🎊 ${bumpData.username} leveled up to Level ${newLevel}!`);
        }

        await updateBumpGoalsProgress(bumpData.userId);
        await checkAndClaimCompletedGoals(bumpData.userId);

        const userData = await dbManager.getUserProfile(bumpData.userId);
        console.log(`💰 User balance: ${userData?.sky_coins || 0} Coins, ${userData?.sky_crystals || 0} Crystals`);

        // ⭐⭐ تحديث sendRewardMessage لتعكس النتائج الجديدة ⭐⭐
        await sendRewardMessage(
            bumpData, 
            finalXP, 
            finalCoins, 
            finalCrystals > 0, 
            userData, 
            guild,
            userBuff,
            levelUp,
            newLevel
        );

        console.log(`✅ ${bumpData.username} received bump rewards successfully!`);

    } catch (error) {
        console.error(`❌ Error giving bump rewards:`, error);
    }
}

async function updateUserRewards(userId, username, xp, coins, hasCrystal, guild) {
    try {
        console.log(`🎯 Updating rewards for ${username} via levelSystem...`);

        let userBuff = 0;
        let finalReward = { xp, coins, crystals: hasCrystal ? 1 : 0 };

        // ⭐⭐ تطبيق البافات (إذا موجودة) ⭐⭐
        if (guild && buffSystem) {
            try {
                userBuff = await buffSystem.getBuff(userId, guild);
                if (userBuff > 0) {
                    console.log(`📈 Applying ${userBuff}% buff to bump rewards`);
                    finalReward = buffSystem.applyBuff(finalReward, userBuff);
                }
            } catch (buffError) {
                console.error(`⚠️ Buff system error:`, buffError.message);
            }
        }

        // ⭐⭐ استدعاء levelSystem مع skipDailyLimits = true ⭐⭐
        const rewardResult = await levelSystem.processUserRewards(
            userId,
            username,
            finalReward.xp,      // XP بعد البافات
            finalReward.coins,   // Coins بعد البافات
            finalReward.crystals, // Crystals
            null,                // client (null لأننا مش محتاجين notifications هنا)
            guild,               // guild
            'bump',              // ⭐⭐ pointType = 'bump' ⭐⭐
            true                 // ⭐⭐ skipDailyLimits = true ⭐⭐
        );

        if (!rewardResult.success) {
            console.error(`❌ LevelSystem failed for ${username}:`, rewardResult.error);
            throw new Error(rewardResult.error || 'Failed to process rewards');
        }

        console.log(`✅ LevelSystem processed rewards for ${username}`);
        console.log(`   XP: ${xp} → ${finalReward.xp} (+${userBuff}%)`);
        console.log(`   Coins: ${coins} → ${finalReward.coins} (+${userBuff}%)`);
        console.log(`   Crystals: ${hasCrystal ? 'Yes' : 'No'}`);
        console.log(`   Level Up: ${rewardResult.levelUp ? 'Yes → Level ' + rewardResult.newLevel : 'No'}`);

        return {
            success: true,
            xp: rewardResult.xp,
            coins: rewardResult.coins,
            crystals: rewardResult.crystals,
            buffApplied: userBuff,
            levelUp: rewardResult.levelUp,
            newLevel: rewardResult.newLevel
        };

    } catch (error) {
        console.error(`❌ Error updating rewards for ${username}:`, error);
        throw error;
    }
}

async function sendRewardMessage(bumpData, xp, coins, hasCrystal, userData, guild, userBuff = 0, levelUp = false, newLevel = 0) {
    try {
        const channel = await findRewardChannel(guild);
        if (!channel) {
            console.log('⚠️ No reward channel found');
            return;
        }

        // الحصول على صورة المستخدم
        let userAvatar;
        try {
            const user = await guild.client.users.fetch(bumpData.userId).catch(() => null);
            userAvatar = user?.displayAvatarURL({ extension: 'png', size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
        } catch {
            userAvatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
        }

        const totalCoins = (userData?.sky_coins || 0) + coins;
        const totalCrystals = (userData?.sky_crystals || 0) + (hasCrystal ? 1 : 0);

        // بناء المحتوى (3 مكونات كحد أقصى)
        const thankYouText = `### Thanks <@${bumpData.userId}> for bumping!`;

        // المكون 1: المكافآت (جميعها في مكون واحد)
        let rewardsText = `-# 🎁 Bump Rewards Received:`;
        rewardsText += `\n${xp} <:XP:1468446751282302976>`;
        rewardsText += ` ||&|| ${coins} <:Coins:1468446651965374534> Coins`;
        if (hasCrystal) {
            rewardsText += ` ||&|| 1 <:Crystal:1468446688338251793> Crystal`;
        }

        // المكون 2: الأولوية لـ Level Up، ثم Buff
        let specialText = '';
        if (levelUp) {
            specialText = `### 🎊 **Level Up!**\nNow Level ${newLevel}`;
        } else if (userBuff > 0) {
            specialText = `-# **Role Bonus: **+${userBuff}%`;
        }

        // إنشاء الحاوية
        const container = new ContainerBuilder()
            .setAccentColor(levelUp ? 0xFFD700 : 0x0073ff);

        // إنشاء السكشن الواحد
        const mainSection = new SectionBuilder()
            .addTextDisplayComponents(
                (textDisplay) => textDisplay.setContent(thankYouText)
            )
            .addTextDisplayComponents(
                (textDisplay) => textDisplay.setContent(rewardsText)
            );

        // إضافة المكون الثالث فقط إذا كان له قيمة
        if (specialText) {
            mainSection.addTextDisplayComponents(
                (textDisplay) => textDisplay.setContent(specialText)
            );
        }

        // إضافة الثامبنيل
        mainSection.setThumbnailAccessory((thumbnail) =>
            thumbnail
                .setDescription(`${bumpData.username}'s bump reward`)
                .setURL(userAvatar)
        );

        // إضافة السكشن إلى الحاوية
        container.addSectionComponents((section) => mainSection);

        // إرسال الرسالة بدون منشنات
        await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        });

        console.log(`✅ Bump reward sent for ${bumpData.username}`);

    } catch (error) {
        console.error('❌ Error sending reward message:', error);
    }
}

async function updateBumpGoalsProgress(userId) {
    try {
        await dbManager.updateGoalProgress(userId, 'bumps', 1);
        console.log(`✅ Bump mission progress updated for ${userId}`);
    } catch (error) {
        console.error(`❌ Failed to update bump missions:`, error);
    }
}

async function checkAndClaimCompletedGoals(userId) {
    try {
        const goalsData = await dbManager.getUserGoals(userId);
        if (!goalsData) return;

        // التحقق من المهام اليومية
        if (goalsData.daily && Array.isArray(goalsData.daily)) {
            for (let i = 0; i < goalsData.daily.length; i++) {
                const goal = goalsData.daily[i];
                if (!goal) continue;
                const goalType = i === 0 ? 'daily1' : 'daily2';

                if (goal.completed && !goal.claimed) {
                    await dbManager.claimGoalReward(userId, goal.rowId, goalType);
                }
            }
        }

        // التحقق من المهمة الأسبوعية
        if (goalsData.weekly && goalsData.weekly.completed && !goalsData.weekly.claimed) {
            await dbManager.claimGoalReward(userId, goalsData.weekly.rowId, 'weekly');
        }
    } catch (error) {
        console.error('Error checking and claiming completed goals:', error);
    }
}

function isValidMessage(message) {
    if (!message.author.bot) return false;
    if (message.author.id !== BUMP_BOT_SETTINGS.BUMP_BOT_ID) return false;
    if (!message.guild) return false;
    if (!isAllowedChannel(message)) return false;
    return true;
}

function isAllowedChannel(message) {
    return BUMP_BOT_SETTINGS.ALLOWED_CHANNEL_IDS.includes(message.channel.id);
}

async function extractBumpData(message) {
    if (!message.embeds || message.embeds.length === 0) return null;

    const embed = message.embeds[0];
    const isBumpMessage = checkIfBumpMessage(embed);
    if (!isBumpMessage) return null;

    const userMatch = findUserInEmbed(embed);
    if (!userMatch) return null;

    const userId = userMatch[1];
    let username = 'Unknown User';

    try {
        const user = await message.client.users.fetch(userId).catch(() => null);
        if (user) username = user.username;
    } catch (error) {
        console.log(`⚠️ Could not fetch user ${userId}:`, error.message);
    }

    return {
        userId: userId,
        username: username
    };
}

function findUserInEmbed(embed) {
    if (embed.description) {
        const match = embed.description.match(/<@!?(\d+)>/);
        if (match) return match;
    }

    if (embed.title) {
        const match = embed.title.match(/<@!?(\d+)>/);
        if (match) return match;
    }

    if (embed.fields) {
        for (const field of embed.fields) {
            if (field.value) {
                const match = field.value.match(/<@!?(\d+)>/);
                if (match) return match;
            }
        }
    }

    if (embed.footer && embed.footer.text) {
        const match = embed.footer.text.match(/<@!?(\d+)>/);
        if (match) return match;
    }

    return null;
}

function checkIfBumpMessage(embed) {
    let textToCheck = '';
    if (embed.title) textToCheck += ' ' + embed.title;
    if (embed.description) textToCheck += ' ' + embed.description;

    if (embed.fields) {
        embed.fields.forEach(field => {
            if (field.name) textToCheck += ' ' + field.name;
            if (field.value) textToCheck += ' ' + field.value;
        });
    }

    if (embed.footer?.text) {
        textToCheck += ' ' + embed.footer.text;
    }

    const lowerText = textToCheck.toLowerCase();

    // Check for bump keywords
    const hasBumpKeyword = BUMP_BOT_SETTINGS.KEYWORDS.some(keyword => 
        lowerText.includes(keyword.toLowerCase())
    );

    // Check for bump patterns
    const bumpPatterns = [
        /bump.*done/i,
        /server.*bump/i,
        /bumped.*success/i,
        /next.*bump.*(\d+).*(minute|hour)/i
    ];

    const hasBumpPattern = bumpPatterns.some(pattern => pattern.test(textToCheck));
    return hasBumpKeyword || hasBumpPattern;
}

function calculateBumpXP() {
    return Math.floor(Math.random() * 6) + 7;
}

function calculateBumpCoins() {
    return Math.floor(Math.random() * 6) + 7;
}

function calculateCrystalChance() {
    return Math.random() * 100 < 0.05;
}

async function findRewardChannel(guild) {
    try {
        const bumpChannelId = BUMP_BOT_SETTINGS.ALLOWED_CHANNEL_IDS[0];
        if (bumpChannelId) {
            const channel = guild.channels.cache.get(bumpChannelId);
            if (channel) return channel;
        }

        const possibleChannels = ['rewards', 'bump-rewards', 'bump', 'general', 'chat', 'main'];
        for (const channelName of possibleChannels) {
            const channel = guild.channels.cache.find(
                ch => ch.name.toLowerCase().includes(channelName) && ch.isTextBased()
            );
            if (channel) return channel;
        }

        return guild.channels.cache.find(ch => ch.isTextBased());
    } catch (error) {
        console.error('❌ Error finding reward channel:', error);
        return null;
    }
}

module.exports = { 
    execute
}