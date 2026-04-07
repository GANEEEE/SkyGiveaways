const { 
    SlashCommandBuilder, 
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rates')
        .setDescription('Complete tutorial for all reward systems'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            await showWelcomeTutorial(interaction);
        } catch (error) {
            console.error('❌ Error in rates tutorial:', error);
            await interaction.editReply({
                content: '⚠️ Error loading tutorial. Please try again!',
                embeds: [],
                components: []
            });
        }
    },

    async selectMenuHandler(interaction) {
        try {
            await interaction.deferUpdate();
            const selectedValue = interaction.values[0];

            switch(selectedValue) {
                case 'step_1': await showStep1(interaction); break;
                case 'step_2': await showStep2(interaction); break;
                case 'step_3': await showStep3(interaction); break;
                case 'step_4': await showStep4(interaction); break;
                case 'step_5': await showStep5(interaction); break;
                case 'step_6': await showStep6(interaction); break;
                case 'step_7': await showStep7(interaction); break;
                case 'main': await showWelcomeTutorial(interaction); break;
                case 'quick_ref': await showQuickReference(interaction); break;
                default: await showWelcomeTutorial(interaction);
            }
        } catch (error) {
            console.error('❌ Error in tutorial menu:', error);
        }
    }
};

// ========== SYSTEM DATA ==========

// 1. Chat System
const CHAT_SYSTEM = {
    name: "Chat Rewards",
    xpRange: "3 - 8 XP",
    coinsRange: "2 - 5 Coins",
    targetMessages: "3 - 8 messages per reward",
    dailyLimit: "500 XP, 750 Coins"
};

// 2. Voice System
const VOICE_SYSTEM = {
    name: "Voice Rewards",
    streamerRewards: "1 - 3 XP • 1 - 3 Coins • 3% Crystal chance",
    activeRewards: "1 - 2 XP • 1 - 2 Coins • 1% Crystal chance",
    mutedRewards: "1 - 1 XP • 1 - 1 Coins",
    interval: "Every 15 minutes | Minimum Users: +3 per channel",
    vipBonus: "+10% XP, +25% Coins in VIP channels",
    dailyLimit: "500 XP, 750 Coins"
};

// 3. Vote System
const VOTE_SYSTEM = {
    name: "Vote Rewards",
    rewards: "40 - 60 XP • 40 - 60 Coins",
    crystalChance: "1% chance for crystal",
    cooldown: "Every 12 hours",
    botId: "1180555656969863228"
};

// 4. Bump System
const BUMP_SYSTEM = {
    name: "Bump Rewards",
    rewards: "7 - 12 XP • 7 - 12 Coins",
    crystalChance: "0.05% chance for crystal",
    cooldown: "Every 30 minutes"
};

// 5. Level System
const LEVEL_SYSTEM = {
    name: "Level System",
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
    name: "Drop System",
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
        name: "Common Crate",
        rewards: [
            { type: "coins", chance: "60%", min: 50, max: 100 },
            { type: "xp_coins", chance: "25%", xpMin: 20, xpMax: 40, coinsMin: 30, coinsMax: 60 },
            { type: "bonus_coins", chance: "10%", min: 75, max: 150 },
            { type: "double_xp", chance: "2.5%", duration: 15 },
            { type: "double_luck", chance: "2.5%", duration: 15 }
        ]
    },
    rare: {
        name: "Rare Crate",
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
        name: "Epic Crate",
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
        name: "Legendary Crate",
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
        { name: "Double XP", effect: "Doubles all XP gained", duration: "15-25 min" },
        { name: "Double Coins", effect: "Doubles all coins gained", duration: "15-25 min" },
        { name: "Double Luck", effect: "Doubles drop/chance rates", duration: "15-25 min" },
        { name: "Daily Limit Boost", effect: "Increases daily earning limits", duration: "Depends on the source" }
    ]
};

// 9. Global Buff System
const GLOBAL_BUFF_SYSTEM = {
    name: "Global Buff Roles",
    roles: [
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
    name: "Events System",
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
            name: "VOICE PARTY", 
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

// 12. Coupon System
const COUPON_SYSTEM = {
    name: "Coupon System",
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

// ========== TUTORIAL STEPS ==========

async function showWelcomeTutorial(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('**Welcome to Rewards Tutorial**')
        .setDescription(`**Follow this 7-step guide to master all earning systems!**\n`)
        .setColor(0x0073ff)
        .setThumbnail(interaction.client.user.displayAvatarURL())
        .addFields(
            {
                name: '📋 **What You\'ll Learn**',
                value: '```\nSTEP 1 ➠ Basic Earning Systems\nSTEP 2 ➠ Leveling & Progression\nSTEP 3 ➠ Drops & Crates\nSTEP 4 ➠ Missions & Events\nSTEP 5 ➠ Buffs & Bonuses\nSTEP 6 ➠ Coupons & Discounts\nSTEP 7 ➠ Pro Strategies\n```',
                inline: false
            },
            {
                name: '**Daily Limits**',
                value: `\`\`\`yaml\nDaily Max XP: ${CHAT_SYSTEM.dailyLimit.split(',')[0]}\nDaily Max Coins: ${CHAT_SYSTEM.dailyLimit.split(',')[1]}\nReset: Every 24 hours\n\`\`\``,
                inline: false
            },
            {
                name: '**Start Your Journey**',
                value: '**Select any step from below to begin!**',
                inline: false
            }
        )
        .setFooter({ text: 'Tutorial Step: Welcome' });

    const selectMenu = createTutorialSelectMenu('welcome');
    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

async function showStep1(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('**STEP 1 ➠ Basic Earning Systems**')
        .setColor(0x00ff88)
        .addFields(
            {
                name: `**${CHAT_SYSTEM.name}**`,
                value: `\`\`\`bash\nRewards: ${CHAT_SYSTEM.xpRange} • ${CHAT_SYSTEM.coinsRange}\nTarget: ${CHAT_SYSTEM.targetMessages}\nDaily Limit: ${CHAT_SYSTEM.dailyLimit}\n\`\`\``,
                inline: false
            },
            {
                name: `**${VOICE_SYSTEM.name}**`,
                value: `\`\`\`bash\nStreamer: ${VOICE_SYSTEM.streamerRewards}\nActive: ${VOICE_SYSTEM.activeRewards}\nMuted: ${VOICE_SYSTEM.mutedRewards}\nInterval: ${VOICE_SYSTEM.interval}\nVIP: ${VOICE_SYSTEM.vipBonus}\n\`\`\``,
                inline: false
            },
            {
                name: `**${VOTE_SYSTEM.name}**`,
                value: `\`\`\`bash\nRewards: ${VOTE_SYSTEM.rewards}\nCrystal: ${VOTE_SYSTEM.crystalChance}\nCooldown: ${VOTE_SYSTEM.cooldown}\nBot ID: ${VOTE_SYSTEM.botId}\n\`\`\``,
                inline: false
            },
            {
                name: `**${BUMP_SYSTEM.name}**`,
                value: `\`\`\`bash\nRewards: ${BUMP_SYSTEM.rewards}\nCrystal: ${BUMP_SYSTEM.crystalChance}\nCooldown: ${BUMP_SYSTEM.cooldown}\n\`\`\``,
                inline: false
            },
            {
                name: '**Daily Strategy**',
                value: '```bash\nCombine for maximum daily earnings:\n\n1) Vote twice (morning/night)\n2) Join voice channels\n3) Chat 50+ messages\n4) Bump 4-6 times\n━━━━━━━━━━━━━━━━━━\nResult: 400-600 XP daily\n━━━━━━━━━━━━━━━━━━\nUsing all systems optimally\n```',
                inline: false
            }
        )
        .setFooter({ text: 'Step 1 of 7' });

    const selectMenu = createTutorialSelectMenu('step_1');
    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

async function showStep2(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('**STEP 2 ➠ Level System & Progression**')
        .setColor(0x9B59B6)
        .setDescription(`**Level up to unlock special roles!**`)
        .addFields(
            {
                name: '**How It Works**',
                value: `\`\`\`bash\nLevels: 0 to 15\nDaily Limit: ${LEVEL_SYSTEM.dailyLimits}\n\`\`\``,
                inline: false
            },
            {
                name: '**Milestone Levels**',
                value: '```bash\nLevel 1: 250 XP\nLevel 5: 5,000 XP\nLevel 10: 80,000 XP\nLevel 15: 280,000 XP\n```',
                inline: false
            },
            {
                name: '**All Levels (Complete List)**',
                value: '```\n┌──────────┬─────────────┐\n│  Level   │  XP Needed  │\n├──────────┼─────────────┤\n│    1     │     250     │\n│    2     │     750     │\n│    3     │    1,500    │\n│    4     │    2,500    │\n│    5     │    5,000    │\n│    6     │   10,000    │\n│    7     │   20,000    │\n│    8     │   35,000    │\n│    9     │   55,000    │\n│   10     │   80,000    │\n│   11     │  110,000    │\n│   12     │  145,000    │\n│   13     │  185,000    │\n│   14     │  230,000    │\n│   15     │  280,000    │\n└──────────┴─────────────┘\n```',
                inline: false
            },
            {
                name: '**Fastest Leveling Methods**',
                value: '```bash\nFrom fastest to slowest:\n\n1) Complete missions (90 - 130 XP each)\n2) Vote (40 - 60 XP every 12h)\n3) Participate in events (up to +500 XP)\n4) Voice activity (1 - 3 XP every 30min)\n5) Chat consistently (3 - 8 XP per message)\n6) Open crates (chance for XP rewards)\n```',
                inline: false
            }
        )
        .setFooter({ text: 'Step 2 of 7' });

    const selectMenu = createTutorialSelectMenu('step_2');
    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

async function showStep3(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('**STEP 3 ➠ Drops & Crates System**')
        .setColor(0x3498DB)
        .setDescription('**Collect drops while chatting and open crates for rewards!**')
        .addFields(
            {
                name: `**${DROP_SYSTEM.name}**`,
                value: `\`\`\`bash\n${DROP_SYSTEM.rates.map(drop => 
                    `${drop.emoji} ${drop.type} Drop\nChance: ${drop.chance}\nEvery: ${drop.messages} messages`
                ).join('\n\n')}\n\`\`\``,
                inline: false
            },
            {
                name: '📦 **Common Crate Rewards**',
                value: `\`\`\`bash\n${CRATE_SYSTEM.common.rewards.map(reward => {
                    if (reward.type === 'coins') return `• Coins (${reward.chance}): ${reward.min}-${reward.max} coins`;
                    if (reward.type === 'xp_coins') return `• XP+Coins (${reward.chance}): ${reward.xpMin}-${reward.xpMax} XP + ${reward.coinsMin}-${reward.coinsMax} coins`;
                    if (reward.type === 'bonus_coins') return `• Bonus Coins (${reward.chance}): ${reward.min}-${reward.max} coins`;
                    if (reward.type === 'double_xp') return `• Double XP (${reward.chance}): ${reward.duration} min buff`;
                    if (reward.type === 'double_luck') return `• Double Luck (${reward.chance}): ${reward.duration} min buff`;
                }).join('\n')}\n\`\`\``,
                inline: false
            },
            {
                name: '✨ **Rare Crate Rewards**',
                value: `\`\`\`bash\n${CRATE_SYSTEM.rare.rewards.map(reward => {
                    if (reward.type === 'coins') return `• Coins (${reward.chance}): ${reward.min}-${reward.max} coins`;
                    if (reward.type === 'coins_crystal') return `• Coins+Crystals (${reward.chance}): ${reward.coinsMin}-${reward.coinsMax} coins + ${reward.crystalsMin}-${reward.crystalsMax} crystals`;
                    if (reward.type === 'xp_coins') return `• XP+Coins (${reward.chance}): ${reward.xpMin}-${reward.xpMax} XP + ${reward.coinsMin}-${reward.coinsMax} coins`;
                    if (reward.type === 'double_xp') return `• Double XP (${reward.chance}): ${reward.duration} min buff`;
                    if (reward.type === 'double_luck') return `• Double Luck (${reward.chance}): ${reward.duration} min buff`;
                    if (reward.type === 'crystals_only') return `• Crystals Only (${reward.chance}): ${reward.min}-${reward.max} crystals`;
                }).join('\n')}\n\`\`\``,
                inline: false
            },
            {
                name: '💎 **Epic Crate Rewards**',
                value: `\`\`\`bash\n${CRATE_SYSTEM.epic.rewards.map(reward => {
                    if (reward.type === 'coins_crystal') return `• Coins+Crystals (${reward.chance}): ${reward.coinsMin}-${reward.coinsMax} coins + ${reward.crystalsMin}-${reward.crystalsMax} crystals`;
                    if (reward.type === 'xp_coins') return `• XP+Coins (${reward.chance}): ${reward.xpMin}-${reward.xpMax} XP + ${reward.coinsMin}-${reward.coinsMax} coins`;
                    if (reward.type === 'double_xp') return `• Double XP (${reward.chance}): ${reward.duration} min buff`;
                    if (reward.type === 'double_luck') return `• Double Luck (${reward.chance}): ${reward.duration} min buff`;
                    if (reward.type === 'mega_coins') return `• Mega Coins (${reward.chance}): ${reward.min}-${reward.max} coins`;
                    if (reward.type === 'crystals_bundle') return `• Crystal Bundle (${reward.chance}): ${reward.min}-${reward.max} crystals`;
                }).join('\n')}\n\`\`\``,
                inline: false
            },
            {
                name: '🔥 **Legendary Crate Rewards**',
                value: `\`\`\`bash\n${CRATE_SYSTEM.legendary.rewards.map(reward => {
                    if (reward.type === 'xp_coins') return `• XP+Coins (${reward.chance}): ${reward.xpMin}-${reward.xpMax} XP + ${reward.coinsMin}-${reward.coinsMax} coins`;
                    if (reward.type === 'coins_crystal') return `• Coins+Crystals (${reward.chance}): ${reward.coinsMin}-${reward.coinsMax} coins + ${reward.crystalsMin}-${reward.crystalsMax} crystals`;
                    if (reward.type === 'double_xp') return `• Double XP (${reward.chance}): ${reward.duration} min buff`;
                    if (reward.type === 'double_luck') return `• Double Luck (${reward.chance}): ${reward.duration} min buff`;
                    if (reward.type === 'ultimate_reward') return `• Ultimate Reward (${reward.chance}): ${reward.coinsMin}-${reward.coinsMax} coins + ${reward.xpMin}-${reward.xpMax} XP`;
                    if (reward.type === 'coupon') return `• Coupon (${reward.chance}): ${reward.min_discount}-${reward.max_discount}% discount coupon`;
                }).join('\n')}\n\`\`\``,
                inline: false
            },
            {
                name: '💡 **Crate Strategy**',
                value: '```bash\n# Open Strategy:\n1) COMMON ➠ Open immediately\n   Reason: 60% chance for coins\n\n2) RARE ➠ Open when needed\n   Reason: 25% chance for crystals\n\n3) EPIC ➠ Save for buffs\n   Reason: 15% chance for Double XP\n\n4) LEGENDARY ➠ Save for coupons\n   Reason: 6% chance for discount\n```',
                inline: false
            }
        )
        .setFooter({ text: 'Step 3 of 7' });

    const selectMenu = createTutorialSelectMenu('step_3');
    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

async function showStep4(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('**STEP 4 ➠ Missions & Events**')
        .setColor(0xE74C3C)
        .setDescription('**Complete missions and participate in events for bonus rewards!**')
        .addFields(
            {
                name: '**Daily Missions**',
                value: `\`\`\`bash\n${MISSION_SYSTEM.daily.map(mission => 
                    `${mission.title}\nRequirement: ${mission.description}\nRewards: ${mission.rewards}`
                ).join('\n\n')}\n\`\`\``,
                inline: false
            },
            {
                name: '**Weekly Missions**',
                value: `\`\`\`bash\n${MISSION_SYSTEM.weekly.map(mission => 
                    `${mission.title}\nRequirement: ${mission.description}\nRewards: ${mission.rewards}`
                ).join('\n\n')}\n\`\`\``,
                inline: false
            },
            {
                name: '**Server Events 1**',
                value: `\`\`\`bash\n${EVENT_SYSTEM.events.slice(0, 4).map(event => {
                    let triggerText = event.trigger;
                    if (triggerText.includes(' messages')) {
                        triggerText = triggerText.replace(' messages', '');
                    }
                    return `${event.name}\nTrigger: ${triggerText}\nDuration: ${event.duration}\nRewards: ${event.rewards}${event.requirement ? `\nRequirement: ${event.requirement}` : ''}`;
                }).join('\n\n')}\n\`\`\``,
                inline: false
            },
            {
                name: '**Server Events 2**',
                value: `\`\`\`bash\n${EVENT_SYSTEM.events.slice(4).map(event => {
                    let triggerText = event.trigger;
                    if (triggerText.includes(' messages')) {
                        triggerText = triggerText.replace(' messages', '');
                    }
                    return `${event.name}\nTrigger: ${triggerText}\nDuration: ${event.duration}\nRewards: ${event.rewards}${event.requirement ? `\nRequirement: ${event.requirement}` : ''}`;
                }).join('\n\n')}\n\`\`\``,
                inline: false
            },
            {
                name: '**Mission Strategy**',
                value: '```bash\nMorning (First Hour):\n1) Vote for the bot\n2) Join voice channels\n3) Send 20+ messages\n\nThroughout Day:\n4) Complete chat missions\n5) Participate in events\n6) Claim drops\n\nEvening:\n7) Vote again (if 12h passed)\n8) Complete remaining missions\n\nDaily Bonus:\n300 - 500 XP & 200 - 400 Coins\n━━━━━━━━━━━━━━━━━━\n*From mission rewards alone*\n```',
                inline: false
            }
        )
        .setFooter({ text: 'Step 4 of 7' });

    const selectMenu = createTutorialSelectMenu('step_4');
    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

async function showStep5(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('**STEP 5 ➠ Buffs & Bonuses**')
        .setColor(0xF1C40F)
        .setDescription('**Temporary buffs and permanent bonuses to boost your earnings!**')
        .addFields(
            {
                name: '**Active Buffs (From Crates)**',
                value: `\`\`\`bash\n${BUFF_SYSTEM.activeBuffs.map(buff => 
                    `${buff.name}\nEffect: ${buff.effect}\nDuration: ${buff.duration}`
                ).join('\n\n')}\n\`\`\``,
                inline: false
            },
            {
                name: `**${GLOBAL_BUFF_SYSTEM.name}**`,
                value: `**Effect:** ${GLOBAL_BUFF_SYSTEM.effect}\n\n${GLOBAL_BUFF_SYSTEM.roles.map(role => 
                    `• <@&${role.roleId}> → ${role.bonus}`
                ).join('\n')}`,
                inline: false
            },
            {
                name: '**VIP Benefits**',
                value: `\`\`\`bash\nVIP Channels: ${VOICE_SYSTEM.vipBonus}\`\`\``,
                inline: false
            },
            {
                name: '**Buff Strategy**',
                value: '**Maximize your buff usage:**\n```bash\nStacking Strategy:\n1) Activate Double XP & Double Coins\n   ➠ Doubles ALL earnings\n\n2) Open crates during Double Luck\n   ➠ Increases rare rewards\n\n3) Complete missions during buffs\n   ➠ Bonus XP gets doubled\n\nTiming is Everything:\n• Use before big activities\n• Stack with events\n• Combine with missions\n\nMaximum Bonus:\nBase & VIP & Global Buffs = +38.5%\n```',
                inline: false
            }
        )
        .setFooter({ text: 'Step 5 of 7' });

    const selectMenu = createTutorialSelectMenu('step_5');
    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

async function showStep6(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('**STEP 6 ➠ Coupon System**')
        .setColor(0x9B59B6)
        .setDescription('**Discount coupons from Legendary Drops!**')
        .addFields(
            {
                name: `**${COUPON_SYSTEM.name}**`,
                value: `\`\`\`bash\n${COUPON_SYSTEM.sources.map(source => 
                    `${source.source}\n${source.description ? `${source.description}\n` : ''}Discount: ${source.discountRange}\nType: ${source.type}\nDuration: ${source.duration}`
                ).join('\n\n')}\n\`\`\``,
                inline: false
            },
            {
                name: '**Discount Probabilities**',
                value: `\`\`\`bash\n${COUPON_SYSTEM.discountTiers.map(tier => 
                    `${tier.min}% - ${tier.max}% off ➠ ${tier.chance} chance`
                ).join('\n')}\n\`\`\``,
                inline: false
            },
            {
                name: '**Coupon Information**',
                value: `\`\`\`bash\nCode Format: ${COUPON_SYSTEM.codeFormat}\nUsage: ${COUPON_SYSTEM.usage}\nStacking: Cannot stack with other coupons\nExpiration: Use within validity period\n\`\`\``,
                inline: false
            },
            {
                name: '**Coupon Strategy**',
                value: '```bash\nWhen to use coupons:\n1) EXPENSIVE ITEMS ➠ 40% off\n   Example: 10,000 coin item\n   Save: 4,000 coins\n\n2) LIMITED ITEMS ➠ 30-35% off\n   Before they disappear\n\n3. MULTIPLE ITEMS ➠ 25% off\n   When buying in bulk\n\nPro Tips:\n• Save for expensive purchases\n• Check expiration dates\n• Cannot combine with sales\n• One coupon per transaction\n```',
                inline: false
            },
            {
                name: '**Getting Coupons**',
                value: '```yaml\nFrom: Legendary Crates\nChance: 6% (system value)\nDiscount Range: 15 - 40%\nValid For: 14 days\n\nHow to get more:\n1) Chat consistently ➠ Drops\n2) Get Legendary Drops ➠ Crates\n3) Open crates ➠ Chance for coupons\n4) Maintain streaks ➠ Bonus coupons\n```',
                inline: false
            }
        )
        .setFooter({ text: 'Step 6 of 7' });

    const selectMenu = createTutorialSelectMenu('step_6');
    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

async function showStep7(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('**STEP 7 ➠ Pro Strategies & Mastery**')
        .setColor(0x1ABC9C)
        .setDescription('**Advanced strategies combining everything you\'ve learned!**')
        .addFields(
            {
                name: '**Optimal Daily Schedule**',
                value: '```bash\nMORNING (First 2 Hours):\n1) Vote (40 - 60 XP) ✅\n2) Join voice channels ✅\n3) Send 30 messages (90 - 240 XP) ✅\n4) Complete 2 missions (140 - 230 XP) ✅\n━━━━━━━━━━━━━━━━━━\nMorning Total: 270 - 530 XP\n━━━━━━━━━━━━━━━━━━\n\nDAYTIME (Next 8 Hours):\n5) Participate in voice (16 - 48 XP) ✅\n6) Chat occasionally (60 - 160 XP) ✅\n7) Participate in 1 event (10 - 180 XP) ✅\n8) Claim 1 drop (chance for crate) ✅\n━━━━━━━━━━━━━━━━━━\nDaytime Total: 146 - 388 XP\n━━━━━━━━━━━━━━━━━━\n\nEVENING (Last 2 Hours):\n9) Vote again (40 - 60 XP) ✅\n10) Complete remaining missions ✅\n11) Open crates if buffs active ✅\n12) Collect final rewards ✅\n━━━━━━━━━━━━━━━━━━\nEvening Total: 40 - 60 XP & missions\n━━━━━━━━━━━━━━━━━━\n\nDAILY MAXIMUM:\n456 - 978 XP (approaching 500 limit)```',
                inline: false
            },
            {
                name: '**Coin Farming Strategy**',
                value: '```yaml\n1) VOTING (Highest Return):\n• 40 - 60 coins every 12h\n• 80 - 120 coins daily\n• 1% crystal chance\n\n2) MISSIONS (Consistent):\n• 200 - 400 coins daily bonus\n• From completing all missions\n• Additional XP bonuses\n\n3) VOICE (Passive):\n• 1 - 3 coins every 30min\n• 48 - 144 coins in 24h\n• Requires +3 users in channel\n\n4) CHAT (Active):\n• 2 - 5 coins per message\n• 100 - 250 coins from 50 msgs\n• Also gives XP\n\n5) CRATES (Bonus):\n• Common: 50 - 100 coins (60%)\n• Rare: 120 - 200 coins (35%)\n• Epic: 250 - 400 coins (35%)\n• Legendary: 600 - 1000 coins (25%)\n\nDAILY TARGET:\n400 - 700 coins (approaching 750 limit)\n```',
                inline: false
            },
            {
                name: '**Advanced Crate Tactics**',
                value: '```bash\nCrate Management:\nCOMMON (📦):\n• Open immediately\n• Reason: 60% for coins\n• Best for: Quick cash\n\nRARE (✨):\n• Open when needed\n• Reason: 25% for crystals\n• Best for: Crystal farming\n\nEPIC (💎):\n• Save for Double XP buff\n• Reason: 15% for Double XP\n• Best for: Leveling sessions\n\nLEGENDARY (🔥):\n• Save for shopping trips\n• Reason: 6% for coupons\n• Best for: Big purchases\n\nPro Strategy:\n1) Get Double Luck buff\n2) Open ALL saved crates\n3) Maximize rare rewards\n```',
                inline: false
            },
            {
                name: '**Event Participation Guide**',
                value: '```yaml\nQUICK EVENTS (30 - 45s):\n• Mini Star: 25 - 90 messages\n• Star: 100 - 150 messages\n• Mini Comet: 160 - 240 messages\n• Comet: 250 - 350 messages\n• Mini Nebula: 200 - 300 messages\n• Mini Meteoroid: 300 - 450 messages\n\nLONG EVENTS (60s):\n• Nebula: 400 - 600 messages\n• Meteoroid: 800 - 1000 messages\n\nVOICE EVENT (10 min):\n• Voice Party: Random 10 - 540 messages\n• Requirement: Stay 2 -5  minutes\n• Winners: Multiple people\n\nStrategy:\n• Chat consistently for triggers\n• Join voice for big rewards\n• Multiple people can win\n```',
                inline: false
            },
            {
                name: '**Master Level Strategies**',
                value: '```bash\nStacking Buffs:\n1) Activate Double XP\n2) Activate Double Coins\n3) Complete ALL missions\n4) Participate in events\n5) Open crates\n\nTiming Optimization:\n• Vote exactly every 12 hours\n• Start missions early\n• Join active chat channels\n• Help new players\n\nLong Term Goals:\n• Collect all global buff roles\n• Maintain 100 days streak\n• Get VIP benefits\n• Use coupons strategically\n```',
                inline: false
            },
            {
                name: '🎉 **Congratulations!** 🎉',
                value: '```bash\nYou\'ve mastered the reward systems! 🎊\n\nYou now know:\n• All exact earning rates from the system\n• Optimal strategies for each system\n• How to maximize daily limits\n• Advanced tactics for professionals\n\nStart applying what you learned today using the exact system data!\n```',
                inline: false
            }
        )
        .setFooter({ text: 'Tutorial Complete!' });

    const selectMenu = createTutorialSelectMenu('step_7');
    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

async function showQuickReference(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('**Quick Reference Guide**')
        .setColor(0x2ECC71)
        .setDescription('**All key system information in one place**')
        .addFields(
                {
                    name: '**Daily Limits**',
                    value: `\`\`\`bash\nMax XP: ${CHAT_SYSTEM.dailyLimit.split(',')[0]}\nMax Coins: ${CHAT_SYSTEM.dailyLimit.split(',')[1]}\nReset: Every 24 hours\n\`\`\``,
                    inline: false
                },
                {
                    name: '**Earning Rates**',
                    value: `\`\`\`bash\nChat: ${CHAT_SYSTEM.xpRange} + ${CHAT_SYSTEM.coinsRange}\nVoice: 1 - 3 XP/coins per 30 min\nVote: ${VOTE_SYSTEM.rewards}\nBump: ${BUMP_SYSTEM.rewards}\n\`\`\``,
                    inline: false
                },
                {
                    name: '**Drop Rates**',
                    value: `\`\`\`bash\n${DROP_SYSTEM.rates.map(d => 
                        `${d.emoji} ${d.type}: ${d.chance} every ${d.messages} messages`
                    ).join('\n')}\n\`\`\``,
                    inline: false
                },
                {
                    name: '**Daily Mission Bonus**',
                    value: '```bash\nXP Bonus: 300 - 500\nCoin Bonus: 200 - 400\nComplete all for maximum\n```',
                    inline: false
                },
                {
                    name: '**Key Levels (XP)**',
                    value: '```bash\nLevel 1: 250 XP\nLevel 5: 5,000 XP\nLevel 10: 80,000 XP\nLevel 15: 280,000 XP\n```',
                    inline: false
                },
                {
                    name: '**Pro Tips**',
                    value: '```bash\n1) Vote every 12h\n2) Complete all missions\n3) Join voice channels\n4) Save crates for buffs\n5) Chat consistently for drops\n```',
                    inline: false
                }
            )
        .setFooter({ text: 'Quick Reference | Return to tutorial for details' });

    const selectMenu = createTutorialSelectMenu('quick_ref');
    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

// ========== HELPER FUNCTIONS ==========

function createTutorialSelectMenu(currentPage = 'welcome') {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('rates_select_menu')
        .setPlaceholder('Select tutorial step...')
        .setMinValues(1)
        .setMaxValues(1);

    const options = [];

    // Add back to main/home option
    if (currentPage !== 'welcome') {
        options.push({ label: 'Tutorial Home', value: 'main', emoji: '🏠' });
    }

    // Tutorial steps in order
    const tutorialSteps = [
        { label: 'Step 1: Basic Systems', value: 'step_1', emoji: '🎯' },
        { label: 'Step 2: Level System', value: 'step_2', emoji: '📈' },
        { label: 'Step 3: Drops & Crates', value: 'step_3', emoji: '📦' },
        { label: 'Step 4: Missions & Events', value: 'step_4', emoji: '🎯' },
        { label: 'Step 5: Buffs & Bonuses', value: 'step_5', emoji: '✨' },
        { label: 'Step 6: Coupon System', value: 'step_6', emoji: '🎫' },
        { label: 'Step 7: Pro Strategies', value: 'step_7', emoji: '💡' }
    ];

    // Add all steps except current one
    tutorialSteps.forEach(step => {
        if (step.value !== currentPage) {
            options.push(step);
        }
    });

    // Add quick reference at the end
    options.push({ label: 'Quick Reference', value: 'quick_ref', emoji: '📋' });

    // Build the menu
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