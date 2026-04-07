const { 
    SlashCommandBuilder, 
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    SeparatorSpacingSize
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rates')
        .setDescription('View all reward rates and probabilities'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            await showMainRates(interaction);
        } catch (error) {
            console.error('Error in rates command:', error);
            await showError(interaction, 'main');
        }
    },

    selectMenuHandler: async function(interaction) {
        try {
            await interaction.deferUpdate();
            const selectedValue = interaction.values[0];

            switch(selectedValue) {
                case 'drops': await showDropRates(interaction); break;
                case 'crates': await showCrateRates(interaction); break;
                case 'buffs': await showBuffRates(interaction); break;
                case 'events': await showEventRates(interaction); break;
                case 'globalbuffs': await showGlobalBuffRates(interaction); break;
                case 'levels': await showLevelSystemRates(interaction); break;
                case 'challenges': await showChallengeSystemRates(interaction); break;
                case 'missions': await showMissionSystemRates(interaction); break;
                case 'coupons': await showCouponSystemRates(interaction); break;
                case 'info': await showSystemInfo(interaction); break;
                case 'main': await showMainRates(interaction); break;
                default: await showMainRates(interaction);
            }
        } catch (error) {
            console.error('❌ Error in rates selectMenuHandler:', error);
            await showError(interaction, 'handler');
        }
    }
};

// ========== ALL RATES DATA (HARDCODED) ==========

// 1. Chat System
const CHAT_SYSTEM = {
    name: "💬 Chat Rewards",
    xpRange: "3 - 8 XP",
    coinsRange: " 2 - 5 Coins",
    distribution: "XP: 3 - 8 | Coins: 2 - 5",
    targetMessages: "3 - 8 messages per reward",
    dailyLimit: "500 XP, 750 Coins"
};

// 2. Voice System
const VOICE_SYSTEM = {
    name: "🎤 Voice Rewards",
    streamerRewards: "1 - 3 XP • 1 - 3 Coins • 3% Crystal chance",
    activeRewards: "1 - 2 XP • 1 - 2 Coins • 1% Crystal chance",
    mutedRewards: "1 - 1 XP • 1 - 1 Coins",
    interval: "Every 30 minutes | *Minimum Users: +3 per channel*",
    vipBonus: "+10% XP, +25% Coins in VIP channels",
    dailyLimit: "500 XP, 750 Coins"
};

// 3. Vote System
const VOTE_SYSTEM = {
    name: "⭐ Vote Rewards",
    rewards: "40 - 60 XP • 40 - 60 Coins",
    crystalChance: "1% chance for crystal",
    cooldown: "Every 12 hours",
    botId: "1180555656969863228"
};

// 4. Bump System
const BUMP_SYSTEM = {
    name: "🚀 Bump Rewards",
    rewards: "7 - 12 XP • 7 - 12 Coins",
    crystalChance: "0.05% chance for crystal",
    cooldown: "Every 30 minutes"
};

// 5. Level System - ALL 15 LEVELS
const LEVEL_SYSTEM = {
    name: "📈 Level System",
    dailyLimits: "500 XP • 750 Coins",
    levels: [
        { level: 0, xp: 0, roleId: null },
        { level: 1, xp: 250, roleId: "1453692596785254480" },
        { level: 2, xp: 750, roleId: "1465705382658838724" },
        { level: 3, xp: 1500, roleId: "1465705413117739018" },
        { level: 4, xp: 2500, roleId: "1465705447666225383" },
        { level: 5, xp: 5000, roleId: "1465705479123636415" },
        { level: 6, xp: 10000, roleId: "1465705518210224168" },
        { level: 7, xp: 20000, roleId: "1465705556395163851" },
        { level: 8, xp: 35000, roleId: "1465705620689649841" },
        { level: 9, xp: 55000, roleId: "1465705698989179030" },
        { level: 10, xp: 80000, roleId: "1465705733659164915" },
        { level: 11, xp: 110000, roleId: "1465705763069493423" },
        { level: 12, xp: 145000, roleId: "1465705800755445938" },
        { level: 13, xp: 185000, roleId: "1465705829272518894" },
        { level: 14, xp: 230000, roleId: "1465705879004381382" },
        { level: 15, xp: 280000, roleId: "1465785463984886045" }
    ]
};

// 6. Drop System
const DROP_SYSTEM = {
    name: "📦 Drop System",
    rates: [
        { type: "Common", chance: "50%", messages: "100 - 150", emoji: "📦" },
        { type: "Rare", chance: "30%", messages: "250 - 300", emoji: "✨" },
        { type: "Epic", chance: "15%", messages: "350 - 500", emoji: "💎" },
        { type: "Legendary", chance: "5%", messages: "550 - 800", emoji: "🔥" }
    ]
};

// 7. Crate System
const CRATE_SYSTEM = {
    common: {
        name: "📦 Common Crate",
        // ✅ الإجمالي: 100% بالضبط
        rewards: [
            { type: "coins", chance: "60%", min: 50, max: 100 },
            { type: "xp_coins", chance: "25%", xpMin: 20, xpMax: 40, coinsMin: 30, coinsMax: 60 },
            { type: "bonus_coins", chance: "10%", min: 75, max: 150 },
            { type: "double_xp", chance: "2.5%", duration: 15 },
            { type: "double_luck", chance: "2.5%", duration: 15 }
        ]
    },
    rare: {
        name: "✨ Rare Crate",
        // ✅ الإجمالي: 100% بالضبط
        rewards: [
            { type: "coins", chance: "35%", min: 120, max: 200 },
            { type: "coins_crystal", chance: "25%", coinsMin: 100, coinsMax: 180, crystalsMin: 1, crystalsMax: 2 },
            { type: "xp_coins", chance: "15%", xpMin: 50, xpMax: 80, coinsMin: 60, coinsMax: 100 },
            { type: "double_xp", chance: "13%", duration: 15 },
            { type: "double_luck", chance: "10%", duration: 15 },
            { type: "crystals_only", chance: "2%", min: 1, max: 2 }
        ]
    },
    epic: {
        name: "💎 Epic Crate",
        // ✅ الإجمالي: 100% بالضبط
        rewards: [
            { type: "coins_crystal", chance: "35%", coinsMin: 250, coinsMax: 400, crystalsMin: 1, crystalsMax: 3 },
            { type: "xp_coins", chance: "25%", xpMin: 100, xpMax: 150, coinsMin: 150, coinsMax: 250 },
            { type: "double_xp", chance: "15%", duration: 20 },
            { type: "double_luck", chance: "12%", duration: 20 },
            { type: "mega_coins", chance: "10%", min: 400, max: 600 },
            { type: "crystals_bundle", chance: "3%", min: 2, max: 4 }
        ]
    },
    legendary: {
        name: "🔥 Legendary Crate",
        // ✅ الإجمالي: 100% بالضبط
        rewards: [
            { type: "xp_coins", chance: "30%", xpMin: 250, xpMax: 400, coinsMin: 300, coinsMax: 500 },
            { type: "coins_crystal", chance: "25%", coinsMin: 600, coinsMax: 1000, crystalsMin: 2, crystalsMax: 4 },
            { type: "double_xp", chance: "17%", duration: 25 },
            { type: "double_luck", chance: "12%", duration: 25 },
            { type: "ultimate_reward", chance: "10%", coinsMin: 800, coinsMax: 1200, xpMin: 300, xpMax: 500 },
            { type: "coupon", chance: "6%", min_discount: 15, max_discount: 40, coupon_type: "item_specific" }
        ]
    }
};

// 8. Buff System
const BUFF_SYSTEM = {
    activeBuffs: [
        { name: "⚡ Double XP", effect: "Doubles all XP gained", duration: "15-25 min" },
        { name: "💰 Double Coins", effect: "Doubles all coins gained", duration: "15-25 min" },
        { name: "🍀 Double Luck", effect: "Doubles drop/chance rates", duration: "15-25 min" },
        { name: "📈 Daily Limit Boost", effect: "Increases daily earning limits", duration: "Depends on the source" }
    ]
};

// 9. Global Buff System
const GLOBAL_BUFF_SYSTEM = {
    name: "🏆 Global Buff Roles",
    roles: [
        // الأدوار الإضافية من القائمة الأولى
        { roleId: "1465705033604792558", bonus: "Prove you follow on Twitter Page" },
        { roleId: "1465705074343809096", bonus: "Prove you follow on Steam Page" },
        { roleId: "1465705124176597075", bonus: "Prove you follow on Reddit Page (Not Official Yet)" },
        { roleId: "1466171805869019137", bonus: "Send 10,000 messages" },
        { roleId: "1394820196375593122", bonus: "Host A 5 Successful Community Giveaway" },
        { roleId: "1441450267965915296", bonus: "Vote for the server every 12 hours by /vote" },
        { roleId: "1465800603224510536", bonus: "Get 100 Daily Streaks" }
    ],
    effect: "Each role gives +0.5% reward, stackable"
};

// 10. Event System
const EVENT_SYSTEM = {
    name: "🎮 Events System",
    events: [
        { 
            name: "MINI STAR CHALLENGE", 
            trigger: "25 - 90 messages",
            duration: "30 seconds",
            rewards: "10 - 20 XP + 10 - 15 Coins"
        },
        { 
            name: "STAR CHALLENGE", 
            trigger: "100-150 messages",
            duration: "45 seconds",
            rewards: "25 - 45 XP + 15 - 35 Coins + Common Crate + 15% Crystal chance"
        },
        { 
            name: "MINI COMET CHALLENGE", 
            trigger: "160 - 240 messages",
            duration: "30 seconds",
            rewards: "25 - 40 XP + 20 - 30 Coins"
        },
        { 
            name: "COMET CHALLENGE", 
            trigger: "250 - 350 messages",
            duration: "45 seconds",
            rewards: "40 - 65 XP + 30 - 55 Coins + Rare Crate + 25% Crystal chance"
        },
        { 
            name: "MINI NEBULA CHALLENGE", 
            trigger: "200 - 300 messages",
            duration: "30 seconds",
            rewards: "50 - 70 XP + 35 - 50 Coins"
        },
        { 
            name: "NEBULA CHALLENGE", 
            trigger: "400-600 messages",
            duration: "60 seconds",
            rewards: "70 - 100 XP + 60 - 95 Coins + Epic Crate + 50% Crystal chance"
        },
        { 
            name: "MINI METEOROID CHALLENGE", 
            trigger: "300 - 450 messages",
            duration: "30 seconds",
            rewards: "80 - 100 XP + 60 - 100 Coins"
        },
        { 
            name: "METEOROID CHALLENGE", 
            trigger: "800 - 1000 messages",
            duration: "60 seconds",
            rewards: "120 - 180 XP + 100-160 Coins + Legendary Crate + 90% Crystal chance"
        },
        { 
            name: "🎧 VOICE PARTY", 
            trigger: "Random between 10-540 messages",
            duration: "10 minutes",
            requirement: "Stay 2 - 5 minutes in voice",
            rewards: "100 - 800 XP + 80 - 600 Coins + 30% Crystal chance",
            winners: "Multiple (all who stay required time)"
        }
    ]
};

// 11. Mission System
const MISSION_SYSTEM = {
    daily: [
        { 
            title: "Server Bumper", 
            description: "Bump the server 1 - 2 times",
            rewards: "80 - 100 XP • 40 - 60 Coins • 20% Crystal chance" 
        },
        { 
            title: "Chat Activator", 
            description: "Send 40 - 60 messages",
            rewards: "70 - 90 XP • 50 - 60 Coins • 15% XP bonus" 
        },
        { 
            title: "Drop Hunter", 
            description: "Claim 1 - 2 drops",
            rewards: "90 - 130 XP • 70 - 100 Coins • 10% XP bonus" 
        },
        { 
            title: "Voice Presence", 
            description: "Spend 30 - 45 minutes in voice",
            rewards: "70 - 95 XP • 40 - 70 Coins • 15% Coins bonus" 
        },
        { 
            title: "Smart Contributor", 
            description: "Get 1 - 2 staff reactions",
            rewards: "60 - 100 XP • 40 - 90 Coins • +60 XP bonus" 
        },
        { 
            title: "Lucky Day", 
            description: "Earn 350 - 500 coins from drops",
            rewards: "100 - 150 Coins • 20% Coins bonus" 
        },
        { 
            title: "Social Interaction", 
            description: "Reply to 7 - 15 different people",
            rewards: "40 - 60 XP • 50 - 80 Coins • +40 XP bonus (10%)" 
        }
    ],

    weekly: [
        { 
            title: "Weekly Bumper", 
            description: "Bump the server 8 - 12 times this week",
            rewards: "450 - 600 XP • 300 - 500 Coins • 0 - 1 Crystals" 
        },
        { 
            title: "Weekly Active", 
            description: "Send 400 - 600 messages this week",
            rewards: "550 - 800 XP • 500 - 700 Coins • 0 - 1 Crystals" 
        },
        { 
            title: "Voice Resident", 
            description: "Spend 24 - 48 hours in voice this week",
            rewards: "650 - 750 XP • 550 - 650 Coins • 0 - 1 Crystals" 
        },
        { 
            title: "Drop Master", 
            description: "Claim 7 - 10 drops this week",
            rewards: "350 - 450 XP • 300 - 500 Coins • 0 - 1 Crystals" 
        },
        { 
            title: "True Contributor", 
            description: "Get 12 - 18 staff reactions this week",
            rewards: "400 - 600 XP • 450 - 650 Coins • 0 - 1 Crystals" 
        },
        { 
            title: "Reward Collector", 
            description: "Collect 2500 - 3500 coins this week",
            rewards: "300 - 500 XP • 300 - 400 Coins • 0 - 1 Crystals" 
        }
    ]
};


// 12. Coupon System (NEW)
const COUPON_SYSTEM = {
    name: "🎫 Coupon System",
    sources: [
        {
            source: "Legendary Drops",
            chance: "20% from Legendary Crates",
            discountRange: "15% - 40% off",
            type: "item_specific",
            duration: "14 days"
        },
        {
            source: "Streak Rewards",
            description: "For maintaining daily streaks",
            discountRange: "10-40% off (based on streak)",
            type: "all_items",
            duration: "7 days"
        }
    ],
    discountTiers: [
        { min: 40, max: 40, chance: "5%" },
        { min: 35, max: 39, chance: "10%" },
        { min: 30, max: 34, chance: "15%" },
        { min: 25, max: 29, chance: "20%" },
        { min: 20, max: 24, chance: "20%" },
        { min: 15, max: 19, chance: "15%" },
        { min: 10, max: 14, chance: "15%" }
    ],
    codeFormat: "SKY-XXXXXXXX (8 numbers)",
    usage: "Apply in shop for discounts"
};

// ========== DISPLAY FUNCTIONS ==========

async function showMainRates(interaction) {
    try {
        const components = [];

        components.push(
            new TextDisplayBuilder()
                .setContent(`## 📊 **MAIN RATES & STATISTICS**\n*Complete overview of all reward systems*`)
        );

        components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

        // Chat System
        components.push(
            new TextDisplayBuilder()
                .setContent(`### ${CHAT_SYSTEM.name}\n**Rewards:** ${CHAT_SYSTEM.xpRange} • ${CHAT_SYSTEM.coinsRange}\n**Target:** ${CHAT_SYSTEM.targetMessages}\n**Daily:** ${CHAT_SYSTEM.dailyLimit}`)
        );
        components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

        // Voice System
        components.push(
            new TextDisplayBuilder()
                .setContent(`### ${VOICE_SYSTEM.name}\n**Streamer:** ${VOICE_SYSTEM.streamerRewards}\n**Active:** ${VOICE_SYSTEM.activeRewards}\n**Muted:** ${VOICE_SYSTEM.mutedRewards}\n**Interval:** ${VOICE_SYSTEM.interval}`)
        );
        components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

        // Vote System
        components.push(
            new TextDisplayBuilder()
                .setContent(`### ${VOTE_SYSTEM.name}\n**Rewards:** ${VOTE_SYSTEM.rewards}\n**Crystal:** ${VOTE_SYSTEM.crystalChance}\n**Cooldown:** ${VOTE_SYSTEM.cooldown}`)
        );
        components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

        // Bump System
        components.push(
            new TextDisplayBuilder()
                .setContent(`### ${BUMP_SYSTEM.name}\n**Rewards:** ${BUMP_SYSTEM.rewards}\n**Crystal:** ${BUMP_SYSTEM.crystalChance}\n**Cooldown:** ${BUMP_SYSTEM.cooldown}`)
        );

        // Quick Stats
        components.push(new SeparatorBuilder().setDivider(true));
        components.push(
            new TextDisplayBuilder()
                .setContent(`### 📈 **Quick Stats**\n• **Daily XP Limit:** 500 XP\n• **Daily Coins Limit:** 750 Coins\n• **VIP Bonus:** Extra rewards in VIP channels`)
        );

        // Notes
        components.push(new SeparatorBuilder().setDivider(true));
        components.push(
            new TextDisplayBuilder()
                .setContent(`*📌 **Notes:***\n• Daily limits reset every 24 from start\n• Crystal chances are per reward instance\n• All rates are base values without buffs\n-# • Select category below for detailed rates*`)
        );

        // Select Menu
        const selectMenu = createRatesSelectMenu('main');
        const container = new ContainerBuilder().setAccentColor(0x0073ff);
        container.components = [...components, new ActionRowBuilder().setComponents([selectMenu])];

        await interaction.editReply({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] } // تعطيل جميع mentions
        });

    } catch (error) {
        console.error('Error in showMainRates:', error);
        await showError(interaction, 'main');
    }
}

async function showLevelSystemRates(interaction) {
    try {
        const components = [];

        components.push(
            new TextDisplayBuilder()
                .setContent(`# 📈 **LEVEL SYSTEM**\n*Complete level progression requirements*`)
        );

        components.push(new SeparatorBuilder().setDivider(true));

        // Show ALL 15 levels
        components.push(
            new TextDisplayBuilder()
                .setContent(`## 🎯 **Level Requirements**`)
        );

        // Group levels for better display
        const levelGroups = [
            { start: 0, end: 5, title: "Beginner Levels (0 - 5)" },
            { start: 6, end: 10, title: "Intermediate Levels (6 - 10)" },
            { start: 11, end: 15, title: "Advanced Levels (11 - 15)" }
        ];

        levelGroups.forEach((group, groupIndex) => {
            components.push(
                new TextDisplayBuilder()
                    .setContent(`### ${group.title}`)
            );

            for (let i = group.start; i <= group.end; i++) {
                const level = LEVEL_SYSTEM.levels[i];
                if (level) {
                    const roleInfo = level.roleId ? `\n-# 🎖️ Role: <@&${level.roleId}>` : '\n-# 🎖️ No Role';
                    components.push(
                        new TextDisplayBuilder()
                            .setContent(`Level ${level.level}: **${level.xp.toLocaleString()} XP ${roleInfo}**`)
                    );
                }
            }

            if (groupIndex < levelGroups.length - 1) {
                components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            }
        });

        // XP Requirements Summary
        components.push(new SeparatorBuilder().setDivider(true));

        const totalXP = LEVEL_SYSTEM.levels[15].xp;
        const averageXPPerLevel = Math.round(totalXP / 15);

        components.push(
            new TextDisplayBuilder()
                .setContent(`*💡 **Leveling Tips:***\n• Complete daily missions for rewards\n• Participate in voice channels\n• Claim drops from chat\n• Use buffs during active`)
        );

        // Select Menu
        const selectMenu = createRatesSelectMenu('levels');
        const container = new ContainerBuilder().setAccentColor(0x0073ff);
        container.components = [...components, new ActionRowBuilder().setComponents([selectMenu])];

        await interaction.editReply({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] } // تعطيل جميع mentions
        });

    } catch (error) {
        console.error('Error showing level rates:', error);
        await showError(interaction, 'levels');
    }
}

async function showCouponSystemRates(interaction) {
    try {
        const components = [];

        components.push(
            new TextDisplayBuilder()
                .setContent(`# 🎫 **COUPON SYSTEM**\n*Discount coupons from Legendary Drops*`)
        );

        components.push(new SeparatorBuilder().setDivider(true));

        // Coupon Sources
        components.push(
            new TextDisplayBuilder()
                .setContent(`### 1) 📦 **Coupon Sources**`)
        );

        COUPON_SYSTEM.sources.forEach((source, index) => {
            let sourceText = `**${source.source}**\n`;
            if (source.description) sourceText += `${source.description}\n`;
            sourceText += `Discount: **${source.discountRange}** | Duration: **${source.duration}**`;

            components.push(new TextDisplayBuilder().setContent(sourceText));

            if (index < COUPON_SYSTEM.sources.length - 1) {
                components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            }
        });

        // Discount Tiers
        components.push(new SeparatorBuilder().setDivider(true));
        components.push(
            new TextDisplayBuilder()
                .setContent(`### 🎯 **Discount Probability**\n*Higher discounts = lower chances*`)
        );

        COUPON_SYSTEM.discountTiers.forEach(tier => {
            components.push(
                new TextDisplayBuilder()
                    .setContent(`• ${tier.min}%-${tier.max}% off: **${tier.chance}**`)
            );
        });

        // Coupon Information
        components.push(new SeparatorBuilder().setDivider(true));
        components.push(
            new TextDisplayBuilder()
                .setContent(`### ℹ️ **Coupon Information**\n**Code Format:** ${COUPON_SYSTEM.codeFormat}\n**Usage:** ${COUPON_SYSTEM.usage}\n**Stacking:** Cannot stack with other coupons\n**Expiration:** Coupons expire if not used`)
        );

        // Example
        components.push(new SeparatorBuilder().setDivider(true));
        components.push(
            new TextDisplayBuilder()
                .setContent(`*🎁 **Example:***\n• Get Legendary Drop → 6% chance for coupon\n• Coupon Code: SKY-52523452\n• Valid for: 14 days`)
        );

        // Select Menu
        const selectMenu = createRatesSelectMenu('coupons');
        const container = new ContainerBuilder().setAccentColor(0x0073ff);
        container.components = [...components, new ActionRowBuilder().setComponents([selectMenu])];

        await interaction.editReply({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] } // تعطيل جميع mentions
        });

    } catch (error) {
        console.error('Error showing coupon rates:', error);
        await showError(interaction, 'coupons');
    }
}

async function showCrateRates(interaction) {
    try {
        const components = [];

        components.push(
            new TextDisplayBuilder()
                .setContent(`# 🎁 **CRATE REWARDS**\n*Complete crate reward probabilities*`)
        );

        components.push(new SeparatorBuilder().setDivider(true));

        // Display all crate types
        const crateTypes = ['common', 'rare', 'epic', 'legendary'];

        crateTypes.forEach((crateType, index) => {
            const crate = CRATE_SYSTEM[crateType];

            components.push(
                new TextDisplayBuilder()
                    .setContent(`### ${crate.name}`)
            );

            crate.rewards.forEach(reward => {
                let rewardText = `• ${reward.type.toUpperCase()}: **${reward.chance}**`;

                if (reward.type === 'coupon') {
                    rewardText += ` (${reward.min_discount} - ${reward.max_discount}% discount)`;
                } else if (reward.min !== undefined) {
                    rewardText += ` (${reward.min} - ${reward.max} coins)`;
                } else if (reward.xpMin !== undefined) {
                    rewardText += ` (${reward.xpMin} - ${reward.xpMax} XP + ${reward.coinsMin} - ${reward.coinsMax} coins)`;
                } else if (reward.coinsMin !== undefined && reward.crystalsMin !== undefined) {
                    rewardText += ` (${reward.coinsMin} - ${reward.coinsMax} coins + ${reward.crystalsMin} - ${reward.crystalsMax} crystals)`;
                } else if (reward.duration) {
                    rewardText += ` (${reward.duration} min buff)`;
                }

                components.push(new TextDisplayBuilder().setContent(rewardText));
            });

            if (index < crateTypes.length - 1) {
                components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            }
        });

        // Coupon Note in Legendary Crate
        components.push(new SeparatorBuilder().setDivider(true));
        components.push(
            new TextDisplayBuilder()
                .setContent(`-# *🎫 **Note:** Legendary Crates have 6% chance for discount coupons*\n-# *Coupons give 15 - 40% off on shop items*`)
        );

        // Select Menu
        const selectMenu = createRatesSelectMenu('crates');
        const container = new ContainerBuilder().setAccentColor(0x0073ff);
        container.components = [...components, new ActionRowBuilder().setComponents([selectMenu])];

        await interaction.editReply({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] } // تعطيل جميع mentions
        });

    } catch (error) {
        console.error('Error showing crate rates:', error);
        await showError(interaction, 'crates');
    }
}

// ========== OTHER DISPLAY FUNCTIONS ==========

async function showDropRates(interaction) {
    try {
        const components = [];

        components.push(
            new TextDisplayBuilder()
                .setContent(`# 📦 **DROP SYSTEM RATES**\n*Message-based drop probabilities*`)
        );

        components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

        DROP_SYSTEM.rates.forEach((drop, index) => {
            components.push(
                new TextDisplayBuilder()
                    .setContent(`### ${drop.emoji} **${drop.type} Drop**\nChance: **${drop.chance}**\nEvery: **${drop.messages}** messages`)
            );

            if (index < DROP_SYSTEM.rates.length - 1) {
                components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            }
        });

        // Select Menu
        const selectMenu = createRatesSelectMenu('drops');
        const container = new ContainerBuilder().setAccentColor(0x0073ff);
        container.components = [...components, new ActionRowBuilder().setComponents([selectMenu])];

        await interaction.editReply({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] } // تعطيل جميع mentions
        });

    } catch (error) {
        console.error('Error showing drop rates:', error);
        await showError(interaction, 'drops');
    }
}

async function showEventRates(interaction) {
    try {
        const components = [];

        components.push(
            new TextDisplayBuilder()
                .setContent(`# 🎮 **SERVER EVENTS**\n*Global challenge events*`)
        );

        components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

        // Display all events
        EVENT_SYSTEM.events.forEach((event, index) => {
            components.push(
                new TextDisplayBuilder()
                    .setContent(`### ${event.name}\nTrigger: **${event.trigger}**\nDuration: **${event.duration}**\nRewards: **${event.rewards}**`)
            );

            if (event.requirement) {
                components.push(new TextDisplayBuilder().setContent(`Requirement: **${event.requirement}**`));
            }
            if (event.winners) {
                components.push(new TextDisplayBuilder().setContent(`Winners: **${event.winners}**`));
            }

            if (index < EVENT_SYSTEM.events.length - 1) {
                components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            }
        });

        // Select Menu
        const selectMenu = createRatesSelectMenu('events');
        const container = new ContainerBuilder().setAccentColor(0x0073ff);
        container.components = [...components, new ActionRowBuilder().setComponents([selectMenu])];

        await interaction.editReply({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] } // تعطيل جميع mentions
        });

    } catch (error) {
        console.error('Error showing event rates:', error);
        await showError(interaction, 'events');
    }
}

async function showMissionSystemRates(interaction) {
    try {
        const components = [];

        components.push(
            new TextDisplayBuilder()
                .setContent(`# 🎯 **MISSION TYPES**\n*Daily and weekly objectives*`)
        );

        components.push(new SeparatorBuilder().setDivider(true));

        // Daily Missions
        components.push(
            new TextDisplayBuilder()
                .setContent(`### 📅 **Daily Missions**`)
        );

        MISSION_SYSTEM.daily.forEach((mission, index) => {
            components.push(
                new TextDisplayBuilder()
                    .setContent(`**${mission.title}**\n• Requirement: **${mission.description}**\n• Rewards: **${mission.rewards}**`)
            );

            if (index < MISSION_SYSTEM.daily.length - 1) {
                components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            }
        });

        components.push(new SeparatorBuilder().setDivider(true));

        // Weekly Missions
        components.push(
            new TextDisplayBuilder()
                .setContent(`### 📆 **Weekly Missions**`)
        );

        MISSION_SYSTEM.weekly.forEach((mission, index) => {
            components.push(
                new TextDisplayBuilder()
                    .setContent(`**${mission.title}**\n• Requirement: **${mission.description}**\n• Rewards: **${mission.rewards}**`)
            );

            if (index < MISSION_SYSTEM.weekly.length - 1) {
                components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            }
        });

        // Select Menu
        const selectMenu = createRatesSelectMenu('missions');
        const container = new ContainerBuilder().setAccentColor(0x0073ff);
        container.components = [...components, new ActionRowBuilder().setComponents([selectMenu])];

        await interaction.editReply({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] } // تعطيل جميع mentions
        });

    } catch (error) {
        console.error('Error showing mission rates:', error);
        await showError(interaction, 'missions');
    }
}

async function showBuffRates(interaction) {
    try {
        const components = [];

        components.push(
            new TextDisplayBuilder()
                .setContent(`# ✨ **ACTIVE BUFFS **\n*Temporary boosters from crates*`)
        );

        components.push(new SeparatorBuilder().setDivider(true));

        BUFF_SYSTEM.activeBuffs.forEach((buff, index) => {
            components.push(
                new TextDisplayBuilder()
                    .setContent(`### ${buff.name}\n**Effect: ${buff.effect}**\nDuration: **${buff.duration}**`)
            );

            if (index < BUFF_SYSTEM.activeBuffs.length - 1) {
                components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            }
        });

        // Select Menu
        const selectMenu = createRatesSelectMenu('buffs');
        const container = new ContainerBuilder().setAccentColor(0x0073ff);
        container.components = [...components, new ActionRowBuilder().setComponents([selectMenu])];

        await interaction.editReply({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] } // تعطيل جميع mentions
        });

    } catch (error) {
        console.error('Error showing buff rates:', error);
        await showError(interaction, 'buffs');
    }
}

async function showGlobalBuffRates(interaction) {
    try {
        const components = [];

        components.push(
            new TextDisplayBuilder()
                .setContent(`# 🏆 **GLOBAL BUFF ROLES**\n*Permanent bonus roles*`)
        );

        components.push(new SeparatorBuilder().setDivider(true));

        components.push(
            new TextDisplayBuilder()
                .setContent(`### ${GLOBAL_BUFF_SYSTEM.name}\n**Effect:** ${GLOBAL_BUFF_SYSTEM.effect}`)
        );

        GLOBAL_BUFF_SYSTEM.roles.forEach((role, index) => {
            components.push(
                new TextDisplayBuilder()
                .setContent(`• **Role:** <@&${role.roleId}>\n-# **Obtain:** ${role.bonus}`)
                );
        });

        // Select Menu
        const selectMenu = createRatesSelectMenu('globalbuffs');
        const container = new ContainerBuilder().setAccentColor(0x0073ff);
        container.components = [...components, new ActionRowBuilder().setComponents([selectMenu])];

        await interaction.editReply({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] } // تعطيل جميع mentions
        });

    } catch (error) {
        console.error('Error showing global buff rates:', error);
        await showError(interaction, 'globalbuffs');
    }
}

async function showSystemInfo(interaction) {
    try {
        const components = [];

        components.push(
            new TextDisplayBuilder()
                .setContent(`# ℹ️ **SYSTEM INFORMATION**\n*Complete guide to all game systems*`)
        );

        // Core Systems
        components.push(
            new TextDisplayBuilder()
                .setContent(`### **Core Systems**\n**💬 Chat System:** Earn XP/Coins by messaging\n**🎤 Voice System:** Bonus for voice activity\n**⭐ Vote System:** Rewards for voting\n**🚀 Bump System:** Server promotion rewards\n**📦 Drop System:** Crates from messages`)
        );

        components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

        // Advanced Systems
        components.push(
            new TextDisplayBuilder()
                .setContent(`### ⚙️ **Advanced Systems**\n**📈 Level System:** Progression with role rewards\n**✨ Buff System:** Temporary boosters\n**🎯 Mission System:** Daily/weekly objectives\n**⚔️ Global Challenges:** Server-wide events\n**🎮 Events System:** Mini-events and challenges\n**🎫 Coupon System:** Discount coupons from drops`)
        );

        components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

        // Rules
        components.push(
            new TextDisplayBuilder()
                .setContent(`### 📜 **Rules & Limits**\n• **Daily Limits:** 500 XP / 750 Coins\n• **Reset Time:** Every 24 hour from the start\n• **Anti-Spam:** Cooldowns on all systems\n• **VIP Benefits:** Extra limits and bonuses\n• **Fair Play:** No cheating or exploitation`)
        );

        components.push(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

        // Tips
        components.push(
            new TextDisplayBuilder()
                .setContent(`### 💡 **Tips & Strategies**\n**⚡ Quick Leveling:**\n• Chat regularly for drops\n• Complete all missions daily\n• Participate in voice challenges\n\n**💰 Coin Farming:**\n• Vote every 12 hours\n• Bump server every 30 hours\n• Open crates strategically\n\n**🎫 Coupon Strategy:**\n• Save coupons for expensive items\n• Use before expiration\n• Combine with sales for maximum discount`)
        );

        // Select Menu
        const selectMenu = createRatesSelectMenu('info');
        const container = new ContainerBuilder().setAccentColor(0x0073ff);
        container.components = [...components, new ActionRowBuilder().setComponents([selectMenu])];

        await interaction.editReply({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] } // تعطيل جميع mentions
        });

    } catch (error) {
        console.error('Error showing system info:', error);
        await showError(interaction, 'info');
    }
}

// ========== HELPER FUNCTIONS ==========

function createRatesSelectMenu(currentPage = 'main') {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('rates_select_menu')
        .setPlaceholder('📊 Select category')
        .setMinValues(1)
        .setMaxValues(1);

    const options = [
        { label: 'Drop System', value: 'drops', emoji: '📦' },
        { label: 'Crate System', value: 'crates', emoji: '🎁' },
        { label: 'Active Buffs', value: 'buffs', emoji: '✨' },
        { label: 'Events System', value: 'events', emoji: '🎮' },
        { label: 'Global Buff Roles', value: 'globalbuffs', emoji: '🏆' },
        { label: 'Level System', value: 'levels', emoji: '📈' },
        { label: 'Mission System', value: 'missions', emoji: '🎯' },
        { label: 'Coupon System', value: 'coupons', emoji: '🎫' },
        { label: 'System Info', value: 'info', emoji: 'ℹ️' }
    ];

    if (currentPage !== 'main') {
        options.unshift({ label: 'All Systems', value: 'main', emoji: '📊' });
    }

    options.forEach(opt => {
        selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(opt.label)
                .setValue(opt.value)
                .setEmoji(opt.emoji)
        );
    });

    return selectMenu;
}

async function showError(interaction, section) {
    const errorDisplay = new TextDisplayBuilder()
        .setContent(`# ❌ **Error Loading ${section.toUpperCase()}**\nCould not load data from system.`);

    const selectMenu = createRatesSelectMenu(section);
    const container = new ContainerBuilder().setAccentColor(0xFF0000);
    container.components = [errorDisplay, new ActionRowBuilder().setComponents([selectMenu])];

    await interaction.editReply({ 
        components: [container], 
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] } // تعطيل جميع mentions
    });
}