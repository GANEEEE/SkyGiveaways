const { SectionBuilder, ContainerBuilder, MessageFlags } = require('discord.js');
const dbManager = require('../Data/database');
const buffSystem = require('../LevelSystem/globalbuffs');
const levelSystem = require('../LevelSystem/levelsystem');

const VOTE_BOT_SETTINGS = {
    VOTE_BOT_ID: '1180555656969863228',
    ALLOWED_CHANNEL_IDS: ['1441101222747574427'],
    REWARD_CHANNEL_ID: '1385514822132830299', // ⭐⭐ غير ID القناة هنا ⭐⭐
    KEYWORDS: ['vote', 'voted', 'voting', 'thanks for voting']
};

async function execute(message, client) {
    console.log('🎯 === VOTE SYSTEM TRIGGERED ===');
    console.log(`📊 Message ID: ${message.id}`);

    if (!isValidMessage(message)) {
        console.log('❌ Message validation failed');
        console.log('🎯 === END VOTE SYSTEM ===');
        return;
    }

    const voteData = await extractVoteData(message);
    if (!voteData) {
        console.log('❌ Not a vote message or no user found');
        console.log('🎯 === END VOTE SYSTEM ===');
        return;
    }

    console.log(`✅ Valid vote detected from ${voteData.username}`);
    await giveVoteRewards(voteData, client, message.guild);
    console.log('🎯 === VOTE REWARDS GIVEN ===');
}

async function giveVoteRewards(voteData, client, guild) {
    try {
        console.log(`🎁 Calculating vote rewards for ${voteData.username}...`);

        const xp = calculateVoteXP();
        const coins = calculateVoteCoins();
        const hasCrystal = calculateCrystalChance();

        console.log(`📊 Base Rewards: ${xp} XP, ${coins} Coins, Crystal: ${hasCrystal ? 'YES' : 'NO'}`);

        const rewardResult = await updateUserRewards(
            voteData.userId, 
            voteData.username, 
            xp, 
            coins, 
            hasCrystal, 
            guild
        );

        if (!rewardResult.success) {
            console.error(`❌ Failed to give vote rewards to ${voteData.username}`);
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
            console.log(`🎊 ${voteData.username} leveled up to Level ${newLevel}!`);
        }

        const userData = await dbManager.getUserProfile(voteData.userId);
        console.log(`💰 User balance: ${userData?.sky_coins || 0} Coins, ${userData?.sky_crystals || 0} Crystals`);

        await sendRewardMessage(
            voteData, 
            finalXP, 
            finalCoins, 
            finalCrystals > 0, 
            userData, 
            guild, 
            userBuff,
            levelUp,
            newLevel
        );

        console.log(`✅ ${voteData.username} received vote rewards successfully!`);

    } catch (error) {
        console.error(`❌ Error giving vote rewards:`, error);
    }
}

function isValidMessage(message) {
    if (!message.author.bot) return false;
    if (message.author.id !== VOTE_BOT_SETTINGS.VOTE_BOT_ID) return false;
    if (!message.guild) return false;
    if (!isAllowedChannel(message)) return false;
    return true;
}

function isAllowedChannel(message) {
    return VOTE_BOT_SETTINGS.ALLOWED_CHANNEL_IDS.includes(message.channel.id);
}

async function extractVoteData(message) {
    if (!message.embeds || message.embeds.length === 0) return null;

    const embed = message.embeds[0];
    const isVoteMessage = checkIfVoteMessage(embed);
    if (!isVoteMessage) return null;

    let userMatch = null;
    if (embed.description) userMatch = embed.description.match(/<@!?(\d+)>/);
    if (!userMatch && embed.title) userMatch = embed.title.match(/<@!?(\d+)>/);

    if (!userMatch && embed.fields) {
        for (const field of embed.fields) {
            if (field.value) {
                userMatch = field.value.match(/<@!?(\d+)>/);
                if (userMatch) break;
            }
        }
    }

    if (!userMatch && message.content) {
        userMatch = message.content.match(/<@!?(\d+)>/);
    }

    if (!userMatch) {
        console.log('❌ Could not find user in vote message');
        return null;
    }

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
        username: username,
        timestamp: Date.now()
    };
}

function checkIfVoteMessage(embed) {
    if (embed.title && containsVoteKeyword(embed.title)) return true;
    if (embed.description && containsVoteKeyword(embed.description)) return true;

    if (embed.fields) {
        for (const field of embed.fields) {
            if ((field.name && containsVoteKeyword(field.name)) || 
                (field.value && containsVoteKeyword(field.value))) {
                return true;
            }
        }
    }

    if (embed.footer && embed.footer.text && containsVoteKeyword(embed.footer.text)) {
        return true;
    }

    return false;
}

function containsVoteKeyword(text) {
    const lowerText = text.toLowerCase();
    return VOTE_BOT_SETTINGS.KEYWORDS.some(keyword => 
        lowerText.includes(keyword.toLowerCase())
    );
}

function calculateVoteXP() {
    return Math.floor(Math.random() * 21) + 40;
}

function calculateVoteCoins() {
    return Math.floor(Math.random() * 21) + 40;
}

function calculateCrystalChance() {
    return Math.random() * 100 < 1;
}

async function updateUserRewards(userId, username, xp, coins, hasCrystal, guild) {
    try {
        console.log(`🎯 Updating vote rewards for ${username} via levelSystem...`);

        let userBuff = 0;
        let finalReward = { xp, coins, crystals: hasCrystal ? 1 : 0 };

        if (guild && buffSystem) {
            try {
                userBuff = await buffSystem.getBuff(userId, guild);
                if (userBuff > 0) {
                    console.log(`📈 Applying ${userBuff}% buff to vote rewards`);
                    finalReward = buffSystem.applyBuff(finalReward, userBuff);
                }
            } catch (buffError) {
                console.error(`⚠️ Buff system error:`, buffError.message);
            }
        }

        console.log(`📊 Vote rewards for ${username}:`);
        console.log(`   Base: ${xp} XP, ${coins} Coins, Crystal: ${hasCrystal ? 'Yes' : 'No'}`);
        console.log(`   After Buff: ${finalReward.xp} XP, ${finalReward.coins} Coins`);

        const rewardResult = await levelSystem.processUserRewards(
            userId,
            username,
            finalReward.xp,
            finalReward.coins,
            finalReward.crystals,
            null,
            guild,
            'vote',
            true
        );

        if (!rewardResult.success) {
            console.error(`❌ LevelSystem failed for ${username}:`, rewardResult.error);
            throw new Error(rewardResult.error || 'Failed to process vote rewards');
        }

        console.log(`✅ LevelSystem processed vote rewards for ${username}`);
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
        console.error(`❌ Error updating vote rewards for ${username}:`, error);
        throw error;
    }
}

async function sendRewardMessage(voteData, xp, coins, hasCrystal, userData, guild, userBuff = 0, levelUp = false, newLevel = 0) {
    try {
        const channel = await findRewardChannel(guild);
        if (!channel) {
            console.log('⚠️ No reward channel found');
            return;
        }

        let userAvatar;
        try {
            const user = await guild.client.users.fetch(voteData.userId).catch(() => null);
            userAvatar = user?.displayAvatarURL({ extension: 'png', size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
        } catch {
            userAvatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
        }

        const thankYouText = `### Thanks <@${voteData.userId}> for voting!`;

        let rewardsText = `-# 🎁 Rewards Received:`;
        rewardsText += `\n${xp} <:XP:1468446751282302976>`;
        rewardsText += ` ||&|| ${coins} <:Coins:1468446651965374534> Coins`;
        if (hasCrystal) {
            rewardsText += ` ||&|| 1 <:Crystal:1468446688338251793> Crystal`;
        }

        let thirdText = '';
        if (levelUp) {
            thirdText = `### 🎊 **Level Up!**\nNow Level ${newLevel}`;
        } else if (userBuff > 0) {
            thirdText = `-# **Role Bonus: **+${userBuff}% XP`;
        }

        const container = new ContainerBuilder()
            .setAccentColor(levelUp ? 0xFFD700 : 0x0073ff);

        const mainSection = new SectionBuilder()
            .addTextDisplayComponents(
                (textDisplay) => textDisplay.setContent(thankYouText)
            )
            .addTextDisplayComponents(
                (textDisplay) => textDisplay.setContent(rewardsText)
            );

        if (thirdText) {
            mainSection.addTextDisplayComponents(
                (textDisplay) => textDisplay.setContent(thirdText)
            );
        }

        mainSection.setThumbnailAccessory((thumbnail) =>
            thumbnail
                .setDescription(`${voteData.username}'s vote reward`)
                .setURL(userAvatar)
        );

        container.addSectionComponents((section) => mainSection);

        await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        });

        console.log(`✅ Vote reward sent to channel: ${channel.name} (${channel.id})`);

    } catch (error) {
        console.error('❌ Error sending reward message:', error);
    }
}

async function findRewardChannel(guild) {
    try {
        // ⭐⭐ الأولوية للقناة المخصصة للمكافآت ⭐⭐
        if (VOTE_BOT_SETTINGS.REWARD_CHANNEL_ID) {
            const rewardChannel = guild.channels.cache.get(VOTE_BOT_SETTINGS.REWARD_CHANNEL_ID);
            if (rewardChannel) {
                console.log(`✅ Found reward channel: ${rewardChannel.name} (${rewardChannel.id})`);
                return rewardChannel;
            } else {
                console.log(`⚠️ Reward channel ID ${VOTE_BOT_SETTINGS.REWARD_CHANNEL_ID} not found`);
            }
        }

        const voteChannelId = VOTE_BOT_SETTINGS.ALLOWED_CHANNEL_IDS[0];
        if (voteChannelId) {
            const channel = guild.channels.cache.get(voteChannelId);
            if (channel) return channel;
        }

        const possibleChannels = ['rewards', 'vote-rewards', 'general', 'chat', 'voting', 'announcements'];
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
};