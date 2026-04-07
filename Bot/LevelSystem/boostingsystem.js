// File: boostReward.js
const { EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');
const buffSystem = require('../LevelSystem/globalbuffs');
const levelSystem = require('../LevelSystem/levelsystem');

// Configure reward channel ID here
const REWARD_CHANNEL_ID = '1369523365710397521'; // ← Put your channel ID here

module.exports = {
    name: 'guildMemberUpdate',

    async execute(oldMember, newMember, client) {
        //console.log('🚀 === BOOST SYSTEM CHECK ===');

        // Check if member started boosting
        if (!oldMember.premiumSince && newMember.premiumSince) {
            console.log(`✅ ${newMember.user.username} boosted the server!`);

            // Give boost rewards
            await giveBoostRewards(newMember, client);
        }

        // Check if member stopped boosting (optional - if you want to handle unboosting)
        if (oldMember.premiumSince && !newMember.premiumSince) {
            console.log(`⚠️ ${newMember.user.username} stopped boosting`);
            // You can add handling for when boost ends if needed
        }
    }
};

// ============ Reward Functions ============

async function giveBoostRewards(member, client) {
    try {
        console.log(`🎁 Calculating boost rewards for ${member.user.username}...`);

        const xp = 125;
        const coins = 2000;
        const hasCrystal = calculateCrystalChance();

        // ⭐⭐ أرسل client هنا ⭐⭐
        const rewardResult = await updateUserRewards(
            member, 
            xp, 
            coins, 
            hasCrystal,
            client  // ← أضف هذا
        );

        if (!rewardResult.success) {
            console.error(`❌ Failed to give boost rewards`);
            return;
        }

        await sendRewardMessage(
            member,
            rewardResult.xp,
            rewardResult.coins,
            rewardResult.crystals > 0,
            rewardResult.buffApplied || 0,
            rewardResult.levelUp,
            rewardResult.newLevel
        );

    } catch (error) {
        console.error(`❌ Error:`, error);
    }
}

function calculateCrystalChance() {
    // 10% chance for crystal (1 in 10)
    return Math.random() * 100 < 10;
}

async function updateUserRewards(member, xp, coins, hasCrystal, client) {
    try {
        let userBuff = 0;
        let finalReward = { xp, coins, crystals: hasCrystal ? 1 : 0 };

        // ⭐⭐ تطبيق البافات ⭐⭐
        userBuff = await buffSystem.getBuff(member.id, member.guild);
        if (userBuff > 0) {
            console.log(`📈 Applying ${userBuff}% buff to boost rewards`);
            finalReward = buffSystem.applyBuff(finalReward, userBuff);
        }

        // ⭐⭐ استخدام Level System ⭐⭐
        const rewardResult = await levelSystem.processUserRewards(
            member.id,
            member.user.username,
            finalReward.xp,
            finalReward.coins,
            finalReward.crystals,
            client,        // ⭐⭐ client هنا معرف ⭐⭐
            member.guild,
            'boost',
            true
        );

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
        console.error(`❌ Error updating boost rewards:`, error);
        throw error;
    }
}

async function sendRewardMessage(member, xp, coins, hasCrystal, userData) {
    try {
        // Get reward channel
        const channel = member.guild.channels.cache.get(REWARD_CHANNEL_ID);

        if (!channel) {
            console.log('⚠️ Reward channel not found');
            return;
        }

        const totalCoins = (userData?.sky_coins || 0) + coins;
        const totalCrystals = (userData?.sky_crystals || 0) + (hasCrystal ? 1 : 0);

        // Create embed
        const embed = new EmbedBuilder()
            .setColor('#0073ff')
            .setTitle('✨ Server Booster Rewards!')
            .setDescription(`Thank you ${member} for boosting our server! 💖`)
            .addFields(
                { 
                    name: '🎁 Boost Rewards', 
                    value: `**${coins}** Coins\n**${xp}** <:XP:1468446751282302976>${hasCrystal ? '\n**1** Crystal' : ''}`,
                    inline: true 
                }
            )
            .setFooter({ 
                text: `Thank you for supporting ${member.guild.name}!`, 
                iconURL: member.guild.iconURL() 
            });

        // Send message
        await channel.send({ 
            content: `${member} ✨`,
            embeds: [embed] 
        });

        console.log(`✅ Boost reward message sent to ${member.user.username} in #${channel.name}`);

    } catch (error) {
        console.error('❌ Error sending reward message:', error);
    }
}