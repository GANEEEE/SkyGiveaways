const { 
    ContainerBuilder, 
    TextDisplayBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    MessageFlags,
    ActionRowBuilder
} = require('discord.js');
const dbManager = require('../Data/database');
const levelSystem = require('../LevelSystem/levelsystem');
const buffSystem = require('../LevelSystem/globalbuffs');
const axios = require('axios');
const crypto = require('crypto');

class GlobalChallengeManager {
    constructor(client) {
        this.client = client;
        this.activeChallenges = new Map();
        this.activeChallengeMessages = new Map();
        this.userParticipations = new Map();
        this.recentlyCreatedChallenges = new Map();
        this.challengeParticipants = new Map();
        this.challengeTimeouts = new Map();

        this.challengeTypes = {
            'quick_math': {
                name: 'QUICK MATH',
                emoji: '➗',
                category: 'star',
                duration: 60,
                generateData: this.generateMathData.bind(this),
                createMessage: this.createMathMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'trivia': {
                name: 'TRIVIA',
                emoji: '🧠',
                category: 'star',
                duration: 60,
                generateData: this.generateTriviaData.bind(this),
                createMessage: this.createTriviaMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'between_trivia': {
                name: 'TRIVIA',
                emoji: '🧠',
                category: 'between',
                duration: 60,
                generateData: this.generateTriviaData.bind(this),
                createMessage: this.createTriviaMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'between_math': {
                name: 'QUICK MATH',
                emoji: '➗',
                category: 'between',
                duration: 60,
                generateData: this.generateMathData.bind(this),
                createMessage: this.createMathMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'random_keyword': {
                name: 'RANDOM KEY',
                emoji: '🌀',
                category: 'between',
                duration: 60,
                generateData: this.generateKeywordData.bind(this),
                createMessage: this.createKeywordMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'fast_typing': {
                name: 'FAST TYPING',
                emoji: '⌨️',
                category: 'between',
                duration: 60,
                generateData: this.generateTypingData.bind(this),
                createMessage: this.createTypingMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'first_voice_join': {
                name: 'VOICE PARTY',
                emoji: '🎧',
                category: 'voice',
                duration: 1500,
                generateData: this.generateVoiceJoinData.bind(this),
                createMessage: this.createVoiceJoinMessageV2.bind(this),
                processWin: this.processMultiVoiceJoinWin.bind(this),
                minStayRequired: 600,
                maxStayRequired: 900
            },
            'nebula_trivia': {
                name: 'TRIVIA MASTER',
                emoji: '🧠',
                category: 'nebula',
                duration: 60,
                generateData: this.generateTriviaData.bind(this),
                createMessage: this.createTriviaMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'nebula_advanced_math': {
                name: 'ADVANCED MATH',
                emoji: '🧮',
                category: 'nebula',
                duration: 60,
                generateData: this.generateAdvancedMathData.bind(this),
                createMessage: this.createAdvancedMathMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'nebula_quick_math': {
                name: 'QUICK MATH',
                emoji: '➗',
                category: 'nebula',
                duration: 60,
                generateData: this.generateMathData.bind(this),
                createMessage: this.createMathMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'meteoroid_trivia': {
                name: 'LEGENDARY TRIVIA',
                emoji: '🧠',
                category: 'meteoroid',
                duration: 60,
                generateData: this.generateTriviaData.bind(this),
                createMessage: this.createTriviaMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'meteoroid_advanced_math': {
                name: 'LEGENDARY MATH',
                emoji: '🧮',
                category: 'meteoroid',
                duration: 60,
                generateData: this.generateAdvancedMathData.bind(this),
                createMessage: this.createAdvancedMathMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            }
        };

        this.levelTargets = {
            star: { min: 100, max: 150 },
            comet: { min: 250, max: 350 },
            nebula: { min: 400, max: 600 },
            meteoroid: { min: 800, max: 1000 }
        };

        this.betweenEventRanges = {
            'before_star': { min: 25, max: 90 },
            'star_comet': { min: 160, max: 240 },
            'comet_nebula': { min: 200, max: 300 },
            'nebula_meteoroid': { min: 300, max: 450 },
            'voice_challenge': { min: 10, max: 540 }
        };

        this.dropTypes = {
            'star': 'common',
            'comet': 'rare',
            'nebula': 'epic',
            'meteoroid': 'legendary'
        };

        this.levelRewards = {
            'star': {
                drop: 'common',
                xp: { min: 80, max: 120 },
                coins: { min: 80, max: 100 },
                crystals: { min: 0, max: 1 },
                crystalChance: 0.15
            },
            'comet': {
                drop: 'rare',
                xp: { min: 120, max: 200 },
                coins: { min: 120, max: 180 },
                crystals: { min: 0, max: 1 },
                crystalChance: 0.25
            },
            'nebula': {
                drop: 'epic',
                xp: { min: 250, max: 400 },
                coins: { min: 250, max: 380 },
                crystals: { min: 0, max: 2 },
                crystalChance: 0.5
            },
            'meteoroid': {
                drop: 'legendary',
                xp: { min: 600, max: 800 },
                coins: { min: 600, max: 780 },
                crystals: { min: 1, max: 3 },
                crystalChance: 0.9
            }
        };

        this.betweenRewards = {
            'before-star': { xp: { min: 30, max: 50 }, coins: { min: 25, max: 90 } },
            'star-comet': { xp: { min: 70, max: 100 }, coins: { min: 65, max: 150 } },
            'comet-nebula': { xp: { min: 120, max: 180 }, coins: { min: 110, max: 270 } },
            'nebula-meteoroid': { xp: { min: 300, max: 400 }, coins: { min: 300, max: 500 } },
            'voice-join': { 
                xp: { min: 150, max: 250 }, 
                coins: { min: 200, max: 300 },
                crystalChance: 0.1
            }
        };

        this.setupEventListeners();
    }

    async setup() {
        console.log('🚀 Global Challenge System initializing...');
        this.setupMemoryCleanup();
        await this.cleanupOnStartup();
        const mem = process.memoryUsage();
        console.log(`✅ EventSystem ready! Initial memory: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        return this;
    }

    async getGlobalChallenge(guildId) {
        try {
            return await dbManager.getGlobalChallenge(guildId);
        } catch (error) {
            console.error('Error getting global challenge:', error);
            return null;
        }
    }

    async processMessageForChallenge(guildId, userId, username, message) {
        try {
            this.userParticipations.set(userId, Date.now());

            if (this.userParticipations.size > 500) {
                const now = Date.now();
                const THIRTY_MINUTES = 30 * 60 * 1000;
                for (const [uid, timestamp] of this.userParticipations.entries()) {
                    if (now - timestamp > THIRTY_MINUTES) this.userParticipations.delete(uid);
                }
            }

            const challenge = await this.getGlobalChallenge(guildId);
            if (!challenge) {
                await this.initializeNewChallenge(guildId);
                return { success: true, initialized: true, message: "New challenge initialized for guild" };
            }

            const incrementResult = await dbManager.incrementGlobalChallengeMessages(guildId, 1);
            if (!incrementResult.success) return { success: false, error: 'Failed to increment messages' };

            const currentCycleCount = incrementResult.cycleCount || 0;
            const totalMessages = incrementResult.totalCount || 0;
            const eventResult = await this.checkAndTriggerEvents(guildId, currentCycleCount, message);

            return {
                success: true,
                cycleCount: currentCycleCount,
                totalMessages: totalMessages,
                levelEvents: eventResult.levelEvents || [],
                betweenEvents: eventResult.betweenEvents || [],
                userParticipated: true
            };
        } catch (error) {
            console.error('❌ Error processing challenge message:', error);
            return { success: false, error: error.message, code: 'PROCESSING_ERROR' };
        }
    }

    generateAllTargets() {
        const star = this.getRandomBetween(100, 150);
        const comet = this.getRandomBetween(250, 350);
        const nebula = this.getRandomBetween(400, 600);
        const meteoroid = this.getRandomBetween(800, 1000);
        const before_star = this.getRandomBetween(25, Math.min(90, star - 1));
        const star_comet = this.getRandomBetween(star + 160, Math.min(star + 240, comet - 1));
        const comet_nebula = this.getRandomBetween(comet + 200, Math.min(comet + 300, nebula - 1));
        const nebula_meteoroid = this.getRandomBetween(nebula + 300, Math.min(nebula + 450, meteoroid - 1));
        const voice_challenge = this.getRandomBetween(10, 540);
        return { star_target: star, comet_target: comet, nebula_target: nebula, meteoroid_target: meteoroid,
            before_star_target: before_star, star_comet_target: star_comet, comet_nebula_target: comet_nebula,
            nebula_meteoroid_target: nebula_meteoroid, voice_challenge_target: voice_challenge };
    }

    async checkAndTriggerEvents(guildId, currentMessages, originalMessage) {
        try {
            const challenge = await this.getGlobalChallenge(guildId);
            if (!challenge) return {};
            const levelEvents = [];
            const betweenEvents = [];
            const levels = ['star', 'comet', 'nebula', 'meteoroid'];
            for (const level of levels) {
                const target = challenge[`${level}_target`];
                const reached = challenge[`${level}_reached`];
                if (target && currentMessages >= target && !reached) {
                    levelEvents.push(level);
                    await dbManager.markChallengeLevelReached(guildId, level);
                    if (originalMessage && originalMessage.channel) await this.startLevelChallenge(guildId, originalMessage.channel, level);
                    console.log(`🎮 ${level.toUpperCase()} challenge started!`);
                    if (level === 'meteoroid') await this.resetAllTargets(guildId);
                }
            }
            const betweenTypes = ['before_star_target','star_comet_target','comet_nebula_target','nebula_meteoroid_target','voice_challenge_target'];
            const completedTypes = ['before_star_completed','star_comet_completed','comet_nebula_completed','nebula_meteoroid_completed','voice_challenge_completed'];
            for (let i = 0; i < betweenTypes.length; i++) {
                const target = challenge[betweenTypes[i]];
                const completed = challenge[completedTypes[i]];
                if (target && currentMessages >= target && !completed) {
                    const eventType = betweenTypes[i].replace('_target', '');
                    betweenEvents.push(eventType);
                    await dbManager.markBetweenTargetCompleted(guildId, eventType);
                    if (originalMessage && originalMessage.channel) await this.startBetweenChallenge(guildId, originalMessage.channel, { type: eventType, target });
                }
            }
            return { levelEvents, betweenEvents };
        } catch (error) {
            console.error('Error checking and triggering events:', error);
            return {};
        }
    }

    async initializeNewChallenge(guildId) {
        try {
            const targets = this.generateAllTargets();
            await dbManager.saveGlobalChallengeTargets(guildId, targets);
            console.log(`✅ Initialized new challenge for guild ${guildId}`);
        } catch (error) {
            console.error('Error initializing new challenge:', error);
        }
    }

    async startLevelChallenge(guildId, channel, level) {
        try {
            const protectionKey = `level_${guildId}_${level}`;
            if (this.recentlyCreatedChallenges.has(protectionKey)) { console.log(`⚠️ Level ${level} challenge already starting`); return null; }
            this.recentlyCreatedChallenges.set(protectionKey, Date.now());
            setTimeout(() => this.recentlyCreatedChallenges.delete(protectionKey), 60000);
            const challengeType = this.selectLevelChallenge(level);
            const challengeInfo = this.challengeTypes[challengeType];
            if (!challengeInfo) return null;
            const challengeData = await challengeInfo.generateData();
            return await this.createChallenge(guildId, channel, challengeType, challengeInfo, challengeData, this.dropTypes[level], level.toUpperCase(), 'level');
        } catch (error) {
            console.error(`Error starting ${level} challenge:`, error);
            this.recentlyCreatedChallenges.delete(`level_${guildId}_${level}`);
            return null;
        }
    }

    async startBetweenChallenge(guildId, channel, eventData) {
        try {
            const protectionKey = `between_${guildId}_${eventData.type}`;
            if (this.recentlyCreatedChallenges.has(protectionKey)) { console.log(`⚠️ Between challenge ${eventData.type} already starting`); return null; }
            this.recentlyCreatedChallenges.set(protectionKey, Date.now());
            setTimeout(() => this.recentlyCreatedChallenges.delete(protectionKey), 30000);
            const challengeType = this.selectBetweenChallenge(eventData.type);
            const challengeInfo = this.challengeTypes[challengeType];
            if (!challengeInfo) return null;
            const challengeData = await challengeInfo.generateData();
            // تحديد الاسم حسب نوع الحدث
            const levelTag = this.getBetweenLevelTag(eventData.type);
            return await this.createChallenge(guildId, channel, challengeType, challengeInfo, challengeData, null, levelTag, 'between');
        } catch (error) {
            console.error('Error starting between challenge:', error);
            this.recentlyCreatedChallenges.delete(`between_${guildId}_${eventData.type}`);
            return null;
        }
    }

    getCorrectAnswer(challengeType, data) {
        switch(challengeType) {
            case 'quick_math': case 'nebula_quick_math': case 'between_math':
                return data.answer.toString().toLowerCase();
            case 'advanced_math': case 'nebula_advanced_math': case 'meteoroid_advanced_math':
                return data.answer.toString().toLowerCase();
            case 'random_keyword': return data.keyword.toLowerCase();
            case 'fast_typing': return data.phrase.toLowerCase();
            case 'trivia': case 'nebula_trivia': case 'meteoroid_trivia': case 'between_trivia':
                return data.correctAnswer.toLowerCase();
            case 'first_voice_join': return null;
            default: return null;
        }
    }

    selectLevelChallenge(level) {
        const weighted = {
            'star':     [{ type: 'trivia', weight: 65 }, { type: 'quick_math', weight: 35 }],
            'comet':    [{ type: 'trivia', weight: 65 }, { type: 'quick_math', weight: 35 }],
            'nebula':   [{ type: 'nebula_trivia', weight: 50 }, { type: 'nebula_advanced_math', weight: 30 }, { type: 'nebula_quick_math', weight: 20 }],
            'meteoroid':[{ type: 'meteoroid_trivia', weight: 65 }, { type: 'meteoroid_advanced_math', weight: 35 }]
        };
        const pool = weighted[level] || weighted.star;
        const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const item of pool) { roll -= item.weight; if (roll <= 0) return item.type; }
        return pool[0].type;
    }

    selectBetweenChallenge(eventType = 'before_star') {
        if (eventType === 'voice_challenge') return 'first_voice_join';
        const pool = [
            { type: 'between_trivia', weight: 40 },
            { type: 'between_math', weight: 20 },
            { type: 'random_keyword', weight: 20 },
            { type: 'fast_typing', weight: 20 }
        ];
        const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const item of pool) { roll -= item.weight; if (roll <= 0) return item.type; }
        return pool[0].type;
    }

    async createChallenge(guildId, channel, type, info, data, dropType, levelTag, challengeType) {
        try {
            const duplicateKey = `challenge_${guildId}_${type}_${Math.floor(Date.now() / 10000)}`;
            const now = Date.now();
            if (this.recentlyCreatedChallenges.has(duplicateKey)) {
                if (now - this.recentlyCreatedChallenges.get(duplicateKey) < 5000) { console.log(`⚠️ Skipping duplicate: ${type}`); return null; }
            }
            this.recentlyCreatedChallenges.set(duplicateKey, now);
            setTimeout(() => this.recentlyCreatedChallenges.delete(duplicateKey), 3600000);

            const challengeId = `${guildId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            const challenge = {
                id: challengeId, type, guildId, channelId: channel.id,
                data: this.compressChallengeData(data, type), dropType,
                info: { name: info.name, emoji: info.emoji, duration: info.duration },
                levelTag, challengeType, isActive: true,
                startedAt: Date.now(), expiresAt: Date.now() + (info.duration * 1000),
                participants: [], winners: [],
                correctAnswer: this.getCorrectAnswer(type, data),
                originalMessageContent: '', messageContent: '',
                messageId: null, resultsMessageId: null, timeoutMessageId: null
            };

            if (type === 'first_voice_join') challenge.voiceData = { participants: new Map(), winners: new Map() };

            this.activeChallenges.set(challengeId, challenge);
            this.challengeParticipants.set(challengeId, new Set());

            let messageOptions = info.createMessage(challenge, channel);
            if (!messageOptions || !messageOptions.content) {
                messageOptions = { content: `${info.emoji} **${levelTag} CHALLENGE - ${info.name}**\n\nChallenge is starting...` };
            }

            const message = await channel.send(messageOptions);
            challenge.messageContent = message.content;
            challenge.messageId = message.id;
            challenge.originalMessageContent = message.content;
            this.activeChallengeMessages.set(challengeId, message.id);

            const timeoutId = setTimeout(() => {
                const c = this.activeChallenges.get(challengeId);
                if (c && c.isActive) { console.log(`⏰ Challenge ${challengeId} expired!`); this.endChallenge(challengeId, 'timeout'); }
            }, info.duration * 1000);
            this.challengeTimeouts.set(challengeId, timeoutId);

            console.log(`🎮 Started ${type} (${challengeType}) in ${channel.guild.name}`);
            return challengeId;
        } catch (error) {
            console.error('Error creating challenge:', error);
            this.recentlyCreatedChallenges.delete(`challenge_${guildId}_${type}_${Math.floor(Date.now() / 10000)}`);
            if (error.code === 50006) {
                try { await channel.send({ content: `${info.emoji} **${levelTag} CHALLENGE - ${info.name}**\n\nChallenge is starting...` }); } catch(e) {}
            }
            return null;
        }
    }

    compressChallengeData(data, type) {
        switch(type) {
            case 'quick_math': case 'between_math': return { question: data.question, answer: data.answer };
            case 'first_voice_join': return { stayRequired: data.stayRequired, rewardRange: data.rewardRange };
            default: return data;
        }
    }

    async handleChallengeWin(challengeId, userId, username) {
        try {
            const challenge = this.activeChallenges.get(challengeId);
            if (!challenge || !challenge.isActive) { console.log(`⚠️ Challenge ${challengeId} not found or ended`); return false; }
            const participants = this.challengeParticipants.get(challengeId);
            if (participants && participants.has(userId)) { console.log(`⚠️ ${username} already answered`); return false; }
            if (participants) participants.add(userId);
            const now = Date.now();
            const timeTaken = (now - challenge.startedAt) / 1000;
            const timeReduction = this.calculateTimeReduction(timeTaken);
            const winnerData = { userId, username, winTime: now, timeTaken: timeTaken.toFixed(1), timeReductionPercent: timeReduction, isFirstWinner: challenge.winners.length === 0, processed: false };
            challenge.winners.push(winnerData);
            console.log(`🏆 ${username} answered at ${timeTaken.toFixed(1)}s (${timeReduction}% reduction)`);
            if (winnerData.isFirstWinner) { await this.processFirstWinnerRewards(challenge, winnerData); }
            else { await this.processOtherWinnerRewards(challenge, winnerData); }
            await this.updateChallengeMessageWithWinners(challenge);
            if (challenge.winners.length >= 3) {
                setTimeout(() => { const c = this.activeChallenges.get(challengeId); if (c && c.isActive) this.endChallenge(challengeId, 'max_winners'); }, 2000);
            }
            return true;
        } catch (error) { console.error('❌ Error handling win:', error); return false; }
    }

    calculateTimeReduction(timeTaken) {
        if (timeTaken <= 10) return 0;
        else if (timeTaken <= 20) return 25;
        else if (timeTaken <= 30) return 50;
        else if (timeTaken <= 40) return 75;
        else return 90;
    }

    async processFirstWinnerRewards(challenge, winnerData) {
        try {
            const { userId, username, timeReductionPercent: timeReduction } = winnerData;
            let xp, coins, crystals = 0, dropType = null;
            if (challenge.challengeType === 'between') {
                const betweenType = this.getBetweenTypeFromLevel(challenge.levelTag);
                const rewards = this.betweenRewards[betweenType] || this.betweenRewards['star-comet'];
                xp = this.getRandomBetween(rewards.xp.min, rewards.xp.max);
                coins = this.getRandomBetween(rewards.coins.min, rewards.coins.max);
                if (challenge.type === 'first_voice_join' && Math.random() < 0.3) crystals = this.getRandomBetween(1, 3);
            } else {
                const level = challenge.levelTag.toLowerCase();
                const rewards = this.levelRewards[level] || this.levelRewards.star;
                xp = this.getRandomBetween(rewards.xp.min, rewards.xp.max);
                coins = this.getRandomBetween(rewards.coins.min, rewards.coins.max);
                dropType = challenge.dropType;
                if (Math.random() < rewards.crystalChance) crystals = this.getRandomBetween(rewards.crystals.min, rewards.crystals.max);
            }
            const mult = (100 - timeReduction) / 100;
            xp = Math.round(xp * mult); coins = Math.round(coins * mult);
            if (crystals > 0) crystals = Math.max(1, Math.round(crystals * mult));
            let userBuff = 0, finalReward = { xp, coins, crystals };
            try {
                const guild = this.client.guilds.cache.get(challenge.guildId);
                if (guild && buffSystem) { userBuff = await buffSystem.getBuff(userId, guild); if (userBuff > 0) finalReward = buffSystem.applyBuff(finalReward, userBuff); }
            } catch(e) { console.error(`⚠️ Buff error:`, e.message); }
            const rewardResult = await levelSystem.processUserRewards(userId, username, finalReward.xp, finalReward.coins, finalReward.crystals, this.client, this.client.guilds.cache.get(challenge.guildId), 'challenge', true);
            if (!rewardResult.success) { console.error(`❌ Failed reward for ${username}`); return false; }
            if (dropType) {
                try { const cr = await dbManager.createCrate(userId, username, dropType); if (cr.success) console.log(`📦 ${dropType.toUpperCase()} crate added to ${username}`); }
                catch(e) { console.error(`❌ Crate error:`, e.message); }
            }
            winnerData.rewards = { xp: finalReward.xp, coins: finalReward.coins, crystals: finalReward.crystals, dropType, levelUp: rewardResult.levelUp, newLevel: rewardResult.newLevel, timeReduction };
            winnerData.processed = true;
            return true;
        } catch (error) { console.error('❌ Error processing first winner rewards:', error); return false; }
    }

    async processOtherWinnerRewards(challenge, winnerData) {
        try {
            const { userId, username, timeReductionPercent: timeReduction } = winnerData;
            const position = challenge.winners.length;
            let xp, coins, crystals = 0;
            if (challenge.challengeType === 'between') {
                const rewards = this.betweenRewards[this.getBetweenTypeFromLevel(challenge.levelTag)] || this.betweenRewards['star-comet'];
                const pm = Math.max(0.5, 1 - (position * 0.2));
                xp = this.getRandomBetween(rewards.xp.min, rewards.xp.max) * pm;
                coins = this.getRandomBetween(rewards.coins.min, rewards.coins.max) * pm;
            } else {
                const rewards = this.levelRewards[challenge.levelTag.toLowerCase()] || this.levelRewards.star;
                const pm = Math.max(0.4, 1 - (position * 0.15));
                xp = this.getRandomBetween(rewards.xp.min, rewards.xp.max) * pm;
                coins = this.getRandomBetween(rewards.coins.min, rewards.coins.max) * pm;
                if (Math.random() < (0.2 * pm)) crystals = Math.max(0, this.getRandomBetween(0, 1));
            }
            const tm = (100 - timeReduction) / 100;
            xp = Math.round(xp * tm); coins = Math.round(coins * tm);
            if (crystals > 0) crystals = Math.max(0, Math.round(crystals * tm * 0.8));
            const rewardResult = await levelSystem.processUserRewards(userId, username, xp, coins, crystals, this.client, this.client.guilds.cache.get(challenge.guildId), 'challenge', true);
            if (rewardResult.success) { winnerData.rewards = { xp, coins, crystals, levelUp: rewardResult.levelUp, newLevel: rewardResult.newLevel, timeReduction, position }; winnerData.processed = true; }
            return rewardResult.success;
        } catch (error) { console.error('❌ Error processing other winner rewards:', error); return false; }
    }

    async updateChallengeMessageWithWinners(challenge) {
        try {
            if (challenge.type === 'first_voice_join') return;
            const channel = this.client.channels.cache.get(challenge.channelId);
            if (!channel) return;
            const message = await channel.messages.fetch(challenge.messageId).catch(() => null);
            if (!message) return;
            let newContent = challenge.messageContent || message.content;
            if (newContent.includes('✦ ───────────── ✦')) newContent = newContent.split('✦ ───────────── ✦')[0].trim();
            newContent += '\n\n✦ ───────────── ✦\n**Amazing work! 🔥**\n';
            for (let i = 0; i < challenge.winners.length; i++) {
                const winner = challenge.winners[i];
                if (winner.processed && winner.rewards) {
                    const rt = `${winner.rewards.xp} <:XP:1468446751282302976> & ${winner.rewards.coins} <:Coins:1468446651965374534>` +
                        (winner.rewards.crystals > 0 ? ` & ${winner.rewards.crystals} <:Crystal:1468446688338251793>` : '') +
                        (i === 0 && winner.rewards.dropType ? ` & ${winner.rewards.dropType.toUpperCase()} Crate` : '');
                    newContent += `${i + 1}) <@${winner.userId}> Won ${rt} | Answered In ${winner.timeTaken}s\n`;
                }
            }
            await message.edit({ content: newContent });
            challenge.messageContent = newContent;
        } catch (error) { console.error('❌ Error updating challenge message:', error); }
    }

    createWinnerLine(challenge, winnerData) {
        if (!winnerData.rewards) return '';
        const position = winnerData.isFirstWinner ? 1 : challenge.winners.indexOf(winnerData) + 1;
        return `${position}) <@${winnerData.userId}> Won ${winnerData.rewards.xp} <:XP:1468446751282302976> & ${winnerData.rewards.coins} <:Coins:1468446651965374534>` +
            (winnerData.rewards.crystals > 0 ? ` & ${winnerData.rewards.crystals} <:Crystal:1468446688338251793>` : '') +
            (winnerData.isFirstWinner && winnerData.rewards.dropType ? ` & ${winnerData.rewards.dropType.toUpperCase()} Crate` : '') +
            ` | Answered In ${winnerData.timeTaken}s`;
    }

    async endChallenge(challengeId, reason) {
        const challenge = this.activeChallenges.get(challengeId);
        if (!challenge) { console.log(`⚠️ Challenge ${challengeId} not found`); return; }
        if (!challenge.isActive) { console.log(`⚠️ Challenge ${challengeId} already ended`); return; }
        challenge.isActive = false;
        console.log(`🔚 Ending challenge ${challengeId} (${reason})`);
        const timeoutId = this.challengeTimeouts.get(challengeId);
        if (timeoutId) { clearTimeout(timeoutId); this.challengeTimeouts.delete(challengeId); }
        if (challenge.type === 'first_voice_join') { await this.handleVoiceChallengeEnd(challenge, reason); }
        else { await this.sendFinalChallengeResults(challenge, reason); }
        this.activeChallenges.delete(challengeId);
        this.challengeParticipants.delete(challengeId);
        setTimeout(async () => { await this.cleanupChallengeMessages(challenge); }, 2 * 60 * 1000); // دقيقتين
        const messageId = this.activeChallengeMessages.get(challengeId);
        if (messageId) this.activeChallengeMessages.delete(challengeId);
        console.log(`✅ Challenge ${challengeId} ended`);
    }

    async cleanupChallengeMessages(challenge) {
        try {
            const channel = this.client.channels.cache.get(challenge.channelId);
            if (!channel) return;
            let deletedCount = 0;
            for (const { id, label } of [{ id: challenge.messageId, label: 'challenge' }, { id: challenge.resultsMessageId, label: 'results' }, { id: challenge.timeoutMessageId, label: 'timeout' }]) {
                if (!id) continue;
                try { const msg = await channel.messages.fetch(id).catch(() => null); if (msg && msg.deletable) { await msg.delete(); deletedCount++; } }
                catch(e) { console.error(`❌ Error deleting ${label}: ${e.message}`); }
            }
            console.log(`🧹 Cleanup done: ${deletedCount} messages deleted`);
        } catch (error) { console.error('Error cleaning up messages:', error); }
    }

    async sendFinalChallengeResults(challenge, reason) {
        try {
            const channel = this.client.channels.cache.get(challenge.channelId);
            if (!channel) return;
            if (challenge.winners.length === 0) { await this.sendChallengeEndedMessage(channel, challenge); return; }
            let content = `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE ENDED\n\n`;
            content += `**${challenge.winners.length} Winner${challenge.winners.length > 1 ? 's' : ''} Found!**\n\n${"─".repeat(40)}\n`;
            for (let i = 0; i < challenge.winners.length; i++) {
                const w = challenge.winners[i]; if (!w.rewards) continue;
                const rt = `${w.rewards.xp} <:XP:1468446751282302976> & ${w.rewards.coins} <:Coins:1468446651965374534>` +
                    (w.rewards.crystals > 0 ? ` & ${w.rewards.crystals} <:Crystal:1468446688338251793>` : '') +
                    (i === 0 && w.rewards.dropType ? ` & ${w.rewards.dropType.toUpperCase()} Crate` : '');
                const pos = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1})`;
                content += `${pos} **${w.username}** ➠ ${rt} | Answered In ${w.timeTaken}s\n`;
            }
            content += "─".repeat(40) + "\n";
            const msg = await channel.send(content);
            challenge.resultsMessageId = msg.id;
        } catch (error) { console.error('Error sending final results:', error); }
    }

    async sendChallengeEndedMessage(channel, challenge) {
        try {
            const content = challenge.type === 'first_voice_join' ?
                `### ⏰ TIME'S UP!\n**Voice Party Challenge has ended!**\n\nRequired Time: **${Math.floor(challenge.data.stayRequired / 60)} minute(s)**\nFinal results will be announced shortly...` :
                `### ⏰ TIME'S UP!\n**${challenge.info.name} challenge has ended!**\n\n**No one answered correctly in time**\n\n-# Correct answer was: **${challenge.correctAnswer || 'Hidden'}**\n`;
            const msg = await channel.send({ content });
            challenge.timeoutMessageId = msg.id;
        } catch (error) { console.error('Error sending ended message:', error); }
    }

    async handleVoiceChallengeEnd(challenge, reason) {
        if (!challenge.voiceData) return;
        if (challenge.voiceData.timers && Array.isArray(challenge.voiceData.timers)) {
            for (const t of challenge.voiceData.timers) { if (t) clearTimeout(t); }
        }
        if (challenge.channelId) {
            setTimeout(() => {
                this.checkVoiceWinnersAtEnd(challenge).then(winners => this.sendVoiceChallengeEndReport(challenge, winners, reason))
                    .catch(err => { console.error('Error checking voice winners:', err.message); this.sendVoiceChallengeEndReport(challenge, new Map(), reason); });
            }, 3000);
        }
    }

    // ========== MESSAGE CREATORS ==========
    createMathMessageV2(challenge, channel) {
        const messageContent = `## ${challenge.info.emoji} **${challenge.levelTag} CHALLENGE - ${challenge.info.name}**\n\n` +
            `What's the answer?\n` +
            `**${challenge.data.question} = ?**\n\n` +
            `-# **Duration:** ${challenge.info.duration}s\n` +
            `**Reward:** ${this.getRewardText(challenge)}`;
        challenge.originalMessageContent = messageContent;
        return { content: messageContent };
    }

    createAdvancedMathMessageV2(challenge, channel) {
        const messageContent = `${challenge.info.emoji} **${challenge.levelTag} CHALLENGE - ${challenge.info.name}**\n\n` +
            `What's the answer?\n` +
            `**${challenge.data.question} = ?**\n\n` +
            `-# **Duration:** ${challenge.info.duration}s\n` +
            `**Reward:** ${this.getRewardText(challenge)}`;
        challenge.originalMessageContent = messageContent;
        return { content: messageContent };
    }

    async createKeywordMessageV2(challenge, channel) {
        try {
            const displayKeyword = challenge.data.displayKeyword || challenge.data.keyword.toUpperCase();
            const spacedKeyword = displayKeyword.split('').join(' ');
            const messageContent = `${challenge.info.emoji} **${challenge.levelTag} CHALLENGE - ${challenge.info.name}**\n\n` +
                `Type these letters lowercase (no spaces):\n# ${spacedKeyword}\n\n` +
                `-# **${displayKeyword.length} letters** | **Duration:** ${challenge.info.duration}s\n` +
                `**Reward:** ${this.getRewardText(challenge)}\n\n-# **Type all letters lowercase with no spaces!**`;
            challenge.originalMessageContent = messageContent;
            challenge.messageContent = messageContent;
            return { content: messageContent };
        } catch (error) {
            console.error('❌ Error in createKeywordMessageV2:', error);
            return { content: `${challenge.info.emoji} **${challenge.levelTag} CHALLENGE - ${challenge.info.name}**\n\nChallenge is starting...` };
        }
    }

    createTypingMessageV2(challenge, channel) {
        const displayText = challenge.data.displayPhrase || challenge.data.phrase.toUpperCase();
        const spacedDisplay = displayText.split('').join(' ');
        const messageContent = `${challenge.info.emoji} **${challenge.levelTag} CHALLENGE - ${challenge.info.name}**\n\n` +
            `Type these letters in order (lowercase):\n# ${spacedDisplay}\n\n` +
            `-# **${displayText.length} letters** | **Duration:** ${challenge.info.duration}s\n` +
            `**Reward:** ${this.getRewardText(challenge)}\n\n-# **Type all letters lowercase with no spaces!**`;
        challenge.originalMessageContent = messageContent;
        return { content: messageContent };
    }

    createTriviaMessageV2(challenge, channel) {
        const allOptions = [challenge.data.correctAnswer, ...challenge.data.wrongAnswers];
        const shuffledOptions = this.shuffleArray([...allOptions]);
        const messageContent = `${challenge.info.emoji} **${challenge.levelTag} CHALLENGE - ${challenge.info.name}**\n\n` +
            `Answer The Question:\n**${challenge.data.question}**\n\n` +
            `1) ${shuffledOptions[0]}\n2) ${shuffledOptions[1]}\n3) ${shuffledOptions[2]}\n4) ${shuffledOptions[3]}\n\n` +
            `-# **Duration:** ${challenge.info.duration}s\n**Reward:** ${this.getRewardText(challenge)}\n\n` +
            `-# **Type the correct answer text in chat (lowercase)!**`;
        challenge.data.correctIndex = shuffledOptions.indexOf(challenge.data.correctAnswer);
        challenge.originalMessageContent = messageContent;
        return { content: messageContent };
    }

    // ===== FIX 1: Voice message — إزالة Rules =====
    createVoiceJoinMessageV2(challenge, channel) {
        const voiceChannels = channel.guild.channels.cache.filter(ch => ch.isVoiceBased());
        let totalParticipants = 0;
        voiceChannels.forEach(targetChannel => {
            if (!targetChannel.members) return;
            targetChannel.members.forEach(member => {
                if (!member.user.bot && !challenge.voiceData.participants.has(member.id)) {
                    const bonusTime = Math.floor(Math.random() * 60) * 1000;
                    challenge.voiceData.participants.set(member.id, {
                        username: member.user.username, joinTime: Date.now() - bonusTime,
                        channelId: targetChannel.id, hasWon: false, existingUser: true, bonusTime
                    });
                    totalParticipants++;
                }
            });
        });
        console.log(`🎯 Total existing users added: ${totalParticipants}`);
        const minutesRequired = Math.floor(challenge.data.stayRequired / 60);
        const endTime = Math.floor(challenge.expiresAt / 1000);

        // ===== FIX 1: بدون Rules section =====
        const durationMinutes = challenge.data.durationMinutes || Math.floor(challenge.data.duration / 60);
        const messageContent = `## **VOICE PARTY CHALLENGE**\n\n` +
            `Join a voice channel | ` +
            `**Time Left:** <t:${endTime}:R>\n\n` +
            `**Participants (${challenge.voiceData.participants.size}):**\n` +
            `${this.getVoiceParticipantsList(challenge)}\n\n` +
            `-# Rewards are calculated based on time spent in voice`;
        challenge.originalMessageContent = messageContent;
        return { content: messageContent };
    }

    async processAnswerWin(challenge, userId, username, answer) {
        if (answer !== answer.toLowerCase()) { console.log(`❌ ${username} used uppercase`); return false; }
        const normalizedAnswer = answer.trim().toLowerCase();
        let isCorrect = false;
        switch(challenge.type) {
            case 'quick_math': case 'nebula_quick_math': case 'between_math':
            case 'advanced_math': case 'nebula_advanced_math': case 'meteoroid_advanced_math':
                isCorrect = normalizedAnswer === challenge.data.answer.toString().toLowerCase(); break;
            case 'random_keyword': isCorrect = normalizedAnswer === challenge.data.keyword.toLowerCase(); break;
            case 'fast_typing': isCorrect = normalizedAnswer === challenge.data.phrase.toLowerCase(); break;
            case 'trivia': case 'nebula_trivia': case 'meteoroid_trivia': case 'between_trivia':
                isCorrect = normalizedAnswer === challenge.data.correctAnswer.toLowerCase(); break;
            default: return false;
        }
        if (isCorrect) return await this.handleChallengeWin(challenge.id, userId, username);
        return false;
    }

    setupMemoryCleanup() {
        setInterval(() => {
            const now = Date.now(); let cleaned = 0;
            for (const [challengeId, challenge] of this.activeChallenges.entries()) {
                if (!challenge.isActive) { this.activeChallenges.delete(challengeId); cleaned++; continue; }
                if (challenge.expiresAt < now) { this.endChallenge(challengeId, 'auto-cleanup'); cleaned++; }
            }
            for (const [userId, timestamp] of this.userParticipations.entries()) { if (now - timestamp > 30 * 60 * 1000) this.userParticipations.delete(userId); }
            for (const [challengeId] of this.challengeTimeouts.entries()) { if (!this.activeChallenges.has(challengeId)) this.challengeTimeouts.delete(challengeId); }
            if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} expired challenges`);
        }, 60000);
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        this.client.on('interactionCreate', async (interaction) => { if (!interaction.isButton()) return; });
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            for (const [challengeId, challenge] of this.activeChallenges) {
                if (!challenge.isActive || challenge.winners.length >= 3 || challenge.type === 'first_voice_join') continue;
                const result = await this.processAnswerWin(challenge, message.author.id, message.author.username, message.content.trim());
                if (result) break;
            }
        });
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            if (newState.member?.user?.bot) return;
            for (const [challengeId, challenge] of this.activeChallenges) {
                if (!challenge.isActive || challenge.type !== 'first_voice_join') continue;
                const userId = newState.id;
                if (!oldState.channelId && newState.channelId) { await this.processMultiVoiceJoinWin(newState, challenge); }
                else if (oldState.channelId && !newState.channelId) {
                    // لو خرج، نحسب الوقت اللي قعده ونضيفه للـ totalTime
                    const participant = challenge.voiceData?.participants.get(userId);
                    if (participant) {
                        const sessionTime = Date.now() - (participant.lastJoinTime || participant.joinTime);
                        participant.totalTimeMs = (participant.totalTimeMs || 0) + sessionTime;
                        participant.lastJoinTime = null; // مش في الـ voice دلوقتي
                        console.log(`👋 ${participant.username} left voice — total time: ${Math.floor(participant.totalTimeMs / 60000)}m`);
                        this.updateVoiceChallengeMessage(challenge);
                    }
                }
                break;
            }
        });
    }

    generateVoiceJoinData() {
        // مدة التحدي من 15 لـ 30 دقيقة عشوائي
        const durationMinutes = this.getRandomBetween(15, 30);
        const durationSeconds = durationMinutes * 60;
        return {
            challengeId: `voice_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            startedAt: Date.now(),
            duration: durationSeconds,
            durationMinutes: durationMinutes,
            // المكافأة لكل دقيقة في الـ voice
            xpPerMinute: this.getRandomBetween(5, 15),
            coinsPerMinute: this.getRandomBetween(8, 18),
            participants: new Map(), winners: new Map(), timers: new Map()
        };
    }

    async processMultiVoiceJoinWin(voiceState, challenge) {
        try {
            if (voiceState.member?.user?.bot || !voiceState.channelId || !challenge.isActive) return false;
            const userId = voiceState.id;
            if (!challenge.voiceData.participants.has(userId)) {
                challenge.voiceData.participants.set(userId, {
                    username: voiceState.member?.user?.username,
                    joinTime: Date.now(),
                    channelId: voiceState.channelId,
                    // لو خرج وفضل وقت متتبع، نضيفه للـ totalTime
                    totalTimeMs: 0,
                    lastJoinTime: Date.now()
                });
                console.log(`🎧 ${voiceState.member?.user?.username} joined voice!`);
                this.updateVoiceChallengeMessage(challenge);
            } else {
                // لو رجع تاني، نحدث الـ lastJoinTime
                const participant = challenge.voiceData.participants.get(userId);
                participant.lastJoinTime = Date.now();
                console.log(`🔄 ${voiceState.member?.user?.username} rejoined voice`);
            }
            return true;
        } catch (error) { console.error('Error processing voice join:', error); return false; }
    }

    async checkVoiceWinnersAtEnd(challenge) {
        try {
            const now = Date.now();
            const xpPerMinute = challenge.data.xpPerMinute || 7;
            const coinsPerMinute = challenge.data.coinsPerMinute || 13;

            for (const [userId, participant] of challenge.voiceData.participants) {
                // لو لسه في الـ voice، نضيف الوقت المتبقي
                let totalTimeMs = participant.totalTimeMs || 0;
                if (participant.lastJoinTime) {
                    totalTimeMs += now - participant.lastJoinTime;
                }

                // تحويل لدقائق (minimum 1 ثانية عشان نحسبه)
                const minutesInVoice = totalTimeMs / (60 * 1000);

                if (minutesInVoice < 0.1) {
                    console.log(`   ⏭️ ${participant.username}: less than 6 seconds, skipping`);
                    continue;
                }

                // المكافأة = دقائق × مكافأة الدقيقة
                const totalXp = Math.round(minutesInVoice * xpPerMinute) + this.getRandomBetween(0, 20);
                const totalCoins = Math.round(minutesInVoice * coinsPerMinute) + this.getRandomBetween(0, 15);
                const crystals = minutesInVoice >= 5 && Math.random() < 0.3 ? this.getRandomBetween(1, 2) : 0;

                console.log(`   ✅ ${participant.username}: ${minutesInVoice.toFixed(1)}m → ${totalXp} XP, ${totalCoins} coins`);

                await dbManager.run(
                    `UPDATE levels SET sky_coins = sky_coins + ?, xp = xp + ?, sky_crystals = sky_crystals + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
                    [totalCoins, totalXp, crystals, userId]
                );

                participant.xpReward = totalXp;
                participant.coinsReward = totalCoins;
                participant.crystalsReward = crystals;
                participant.minutesInVoice = minutesInVoice.toFixed(1);

                challenge.voiceData.winners.set(userId, {
                    username: participant.username,
                    xpReward: totalXp, coinsReward: totalCoins, crystalsReward: crystals,
                    minutesInVoice: minutesInVoice.toFixed(1)
                });
            }

            console.log(`🏆 Total rewarded: ${challenge.voiceData.winners.size}`);
            return challenge.voiceData.winners;
        } catch (error) { console.error('Error checking voice winners:', error); return new Map(); }
    }

    getVoiceParticipantsList(challenge) {
        if (!challenge.voiceData || challenge.voiceData.participants.size === 0) return "No participants yet";
        const now = Date.now();
        const participants = Array.from(challenge.voiceData.participants.values()).slice(0, 15);
        return participants.map((p, i) => {
            // حساب الوقت الكلي حتى اللحظة
            let totalMs = p.totalTimeMs || 0;
            if (p.lastJoinTime) totalMs += now - p.lastJoinTime; // لو لسه في الـ voice
            const mins = Math.floor(totalMs / 60000);
            const timeText = mins > 0 ? ` — ${mins}m` : '';
            return `${i + 1}. ${p.username}${timeText}`;
        }).join('\n') +
            (challenge.voiceData.participants.size > 15 ? `\n... and ${challenge.voiceData.participants.size - 15} more` : '');
    }

    async updateVoiceChallengeMessage(challenge) {
        try {
            if (!challenge.messageId || challenge.type !== 'first_voice_join') return;
            const channel = this.client.channels.cache.get(challenge.channelId);
            if (!channel) return;
            const message = await channel.messages.fetch(challenge.messageId).catch(() => null);
            if (!message) return;
            const minutesRequired = Math.floor(challenge.data.stayRequired / 60);
            const endTime = Math.floor(challenge.expiresAt / 1000);
            // ===== FIX 1: بدون Rules section =====
            const durationMins = challenge.data.durationMinutes || Math.floor(challenge.data.duration / 60);
            await message.edit({ content: `## **VOICE PARTY CHALLENGE**\n\nJoin a voice channel | **Time Left:** <t:${endTime}:R>\n\n**Participants (${challenge.voiceData.participants.size}):**\n${this.getVoiceParticipantsList(challenge)}\n\n-# Rewards are calculated based on time spent in voice` });
        } catch (error) { console.error('Error updating voice message:', error); }
    }

    async sendVoiceChallengeEndReport(challenge, winners, reason) {
        try {
            const channel = this.client.channels.cache.get(challenge.channelId);
            if (!channel) return;
            const participants = challenge.voiceData?.participants.size || 0;
            const rewarded = winners.size || 0;
            const durationMinutes = challenge.data.durationMinutes || Math.floor(challenge.data.duration / 60);

            let content = `## VOICE PARTY ENDED\n\n` +
                `• **Participants:** ${participants}\n` +
                `• **Rewarded:** ${rewarded}\n\n`;

            if (rewarded > 0) {
                content += `### 🏆 **Rewards (based on time in voice):**\n`;
                let idx = 1;
                for (const [userId, winner] of winners) {
                    const timeText = winner.minutesInVoice ? ` (${winner.minutesInVoice}m)` : '';
                    content += `**${idx}) ${winner.username}**${timeText} ➠ ` +
                        `${winner.xpReward} <:XP:1468446751282302976> & ${winner.coinsReward} <:Coins:1468446651965374534>` +
                        `${winner.crystalsReward > 0 ? ` & ${winner.crystalsReward} <:Crystal:1468446688338251793>` : ''}\n`;
                    idx++;
                }
                content += `\n-# **Rewards have been delivered successfully!**`;
            } else {
                content += `**No one participated this time!**`;
            }

            const msg = await channel.send(content);
            challenge.resultsMessageId = msg.id;
        } catch (error) { console.error('Error sending voice end report:', error); }
    }

    // ===== FIX 2: generateMathData — 3 عمليات، أرقام أصعب =====
    generateMathData() {
        const ops = ['+', '-', '*'];
        // 3 أرقام و2 عمليات → (a op1 b) op2 c
        const a = this.getRandomBetween(15, 50);
        const b = this.getRandomBetween(10, 40);
        const c = this.getRandomBetween(5, 25);
        const op1 = ops[Math.floor(Math.random() * ops.length)];
        const op2 = ops[Math.floor(Math.random() * ops.length)];

        // حساب الجواب بالترتيب من اليسار لليمين
        let step1;
        switch(op1) {
            case '+': step1 = a + b; break;
            case '-': step1 = a - b; break;
            case '*': step1 = a * b; break;
        }
        let answer;
        switch(op2) {
            case '+': answer = step1 + c; break;
            case '-': answer = step1 - c; break;
            case '*': answer = step1 * c; break;
        }

        const question = `${a} ${op1} ${b} ${op2} ${c}`;

        const wrongAnswers = [];
        while (wrongAnswers.length < 3) {
            const wrong = answer + this.getRandomBetween(-20, 20);
            if (wrong !== answer && !wrongAnswers.includes(wrong)) wrongAnswers.push(wrong);
        }

        return { question, answer, wrongAnswers };
    }

    // ===== FIX 3: generateAdvancedMathData — 5 عمليات مع أقواس =====
    generateAdvancedMathData() {
        // نولد معادلة بأقواس و5 عمليات
        const templates = [
            // (a + b) * (c - d) + e
            () => {
                const a = this.getRandomBetween(5, 20), b = this.getRandomBetween(3, 15);
                const c = this.getRandomBetween(10, 30), d = this.getRandomBetween(2, 10);
                const e = this.getRandomBetween(5, 50);
                const answer = (a + b) * (c - d) + e;
                return { question: `(${a} + ${b}) * (${c} - ${d}) + ${e}`, answer };
            },
            // (a * b) - (c + d) * e
            () => {
                const a = this.getRandomBetween(5, 15), b = this.getRandomBetween(3, 10);
                const c = this.getRandomBetween(2, 8), d = this.getRandomBetween(2, 8);
                const e = this.getRandomBetween(3, 12);
                const answer = (a * b) - (c + d) * e;
                return { question: `(${a} * ${b}) - (${c} + ${d}) * ${e}`, answer };
            },
            // a * (b + c) - d * e
            () => {
                const a = this.getRandomBetween(3, 12), b = this.getRandomBetween(5, 15);
                const c = this.getRandomBetween(3, 10), d = this.getRandomBetween(2, 8);
                const e = this.getRandomBetween(3, 10);
                const answer = a * (b + c) - d * e;
                return { question: `${a} * (${b} + ${c}) - ${d} * ${e}`, answer };
            },
            // (a - b) * c + d * (e + f)  ← 6 أرقام، 5 عمليات
            () => {
                const a = this.getRandomBetween(15, 30), b = this.getRandomBetween(3, 12);
                const c = this.getRandomBetween(3, 10), d = this.getRandomBetween(2, 8);
                const e = this.getRandomBetween(3, 10), f = this.getRandomBetween(2, 8);
                const answer = (a - b) * c + d * (e + f);
                return { question: `(${a} - ${b}) * ${c} + ${d} * (${e} + ${f})`, answer };
            },
            // a + b * (c - d) + e * f
            () => {
                const a = this.getRandomBetween(10, 30), b = this.getRandomBetween(3, 10);
                const c = this.getRandomBetween(10, 25), d = this.getRandomBetween(2, 8);
                const e = this.getRandomBetween(2, 8), f = this.getRandomBetween(3, 10);
                const answer = a + b * (c - d) + e * f;
                return { question: `${a} + ${b} * (${c} - ${d}) + ${e} * ${f}`, answer };
            }
        ];

        const template = templates[Math.floor(Math.random() * templates.length)];
        const { question, answer } = template();

        const wrongAnswers = [];
        while (wrongAnswers.length < 3) {
            const wrong = answer + this.getRandomBetween(-30, 30);
            if (wrong !== answer && !wrongAnswers.includes(wrong)) wrongAnswers.push(wrong);
        }

        return { question, answer, wrongAnswers };
    }

    async generateTriviaData() {
        let attempts = 0;
        const maxAttempts = 5;
        while (attempts < maxAttempts) {
            try {
                const categories = [9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,25,26,27,28,29,30,31,32];
                const apiUrl = `https://opentdb.com/api.php?amount=1&category=${categories[Math.floor(Math.random() * categories.length)]}&type=multiple&encode=url3986`;
                const response = await axios.get(apiUrl, { timeout: 5000 });
                if (!response.data.results || response.data.results.length === 0) throw new Error('No results');
                const qd = response.data.results[0];
                const political = ['Politics','politics','government','president','political','election','vote','party','democrat','republican','leader','minister','parliament','congress'];
                if (political.some(kw => qd.category.includes(kw) || qd.question.includes(kw))) throw new Error('Political question');
                const d = (html) => html.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'");
                return {
                    question: d(decodeURIComponent(qd.question)),
                    correctAnswer: d(decodeURIComponent(qd.correct_answer)),
                    wrongAnswers: qd.incorrect_answers.map(a => d(decodeURIComponent(a))),
                    category: d(decodeURIComponent(qd.category)),
                    difficulty: qd.difficulty, source: 'trivia_api'
                };
            } catch (error) {
                attempts++;
                if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 1000 * attempts));
                else throw new Error('All trivia attempts failed');
            }
        }
    }

    generateKeywordData() {
        const length = this.getRandomBetween(5, 7);
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let keyword = '';
        for (let i = 0; i < length; i++) keyword += alphabet[Math.floor(Math.random() * alphabet.length)];
        console.log(`🔠 Generated keyword: "${keyword}" (${length} letters)`);
        return { keyword: keyword.toLowerCase(), displayKeyword: keyword, displayDuration: 5000 };
    }

    generateTypingData() {
        const length = this.getRandomBetween(6, 10);
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let phrase = '';
        for (let i = 0; i < length; i++) phrase += alphabet[Math.floor(Math.random() * alphabet.length)];
        console.log(`⌨️ Generated phrase: "${phrase}" (${length} letters)`);
        return { phrase: phrase.toLowerCase(), displayPhrase: phrase, source: 'random', length: phrase.length, wordCount: 1 };
    }

    getRewardText(challenge) {
        if (challenge.type === 'first_voice_join') return '5-250 XP & 8-450 Coins & Crystals (Multiple winners!)';
        switch(challenge.levelTag) {
            // Main challenges
            case 'STAR':           return 'Common Drop & Rewards';
            case 'COMET':          return 'Rare Drop & Rewards';
            case 'NEBULA':         return 'Epic Drop & Rewards';
            case 'METEOROID':      return 'Legendary Drop & Rewards';
            // Mini challenges
            case 'MINI STAR':      return 'XP & Coins';
            case 'MINI COMET':     return 'XP & Coins';
            case 'MINI NEBULA':    return 'XP & Coins';
            case 'MINI METEOROID': return 'XP & Coins';
            default:               return 'XP & Coins';
        }
    }

    getBetweenLevelTag(eventType) {
        switch(eventType) {
            case 'before_star':      return 'MINI STAR';
            case 'star_comet':       return 'MINI COMET';
            case 'comet_nebula':     return 'MINI NEBULA';
            case 'nebula_meteoroid': return 'MINI METEOROID';
            case 'voice_challenge':  return 'VOICE PARTY';
            default:                 return 'MINI STAR';
        }
    }

    getBetweenTypeFromLevel(levelTag) {
        switch(levelTag) {
            case 'MINI STAR':      return 'before-star';
            case 'MINI COMET':     return 'star-comet';
            case 'MINI NEBULA':    return 'comet-nebula';
            case 'MINI METEOROID': return 'nebula-meteoroid';
            default:               return 'star-comet';
        }
    }
    getRandomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; }
        return array;
    }

    async resetAllTargets(guildId) {
        try {
            const newTargets = this.generateAllTargets();
            await dbManager.saveGlobalChallengeTargets(guildId, newTargets);
            await dbManager.run(`UPDATE global_challenges SET total_messages = 0, messages_in_current_cycle = 0, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`, [guildId]);
            console.log(`🔄 Reset all targets for guild ${guildId}`);
            return { success: true };
        } catch (error) { console.error('❌ Error resetting targets:', error); return { success: false, error: error.message }; }
    }

    cleanupOnStartup() {
        try {
            this.activeChallenges.clear(); this.activeChallengeMessages.clear();
            this.userParticipations.clear(); this.recentlyCreatedChallenges.clear();
            this.challengeParticipants.clear(); this.challengeTimeouts.clear();
            console.log('✅ Challenge System cleanup completed');
        } catch (error) { console.error('Error during startup cleanup:', error); }
    }

    async getChallengeStatus(guildId) {
        try {
            const challenge = await this.getGlobalChallenge(guildId);
            if (!challenge) return null;
            const activeChallenges = Array.from(this.activeChallenges.values()).filter(c => c.guildId === guildId && c.isActive);
            return {
                guildId, totalMessages: challenge.total_messages || 0,
                levelTargets: challenge.current_targets || {}, betweenTargets: challenge.between_targets || {},
                activeChallenges: activeChallenges.map(c => ({ type: c.type, levelTag: c.levelTag, challengeType: c.challengeType, timeLeft: Math.max(0, Math.floor((c.expiresAt - Date.now()) / 1000)) })),
                reachedLevels: { star: challenge.star_reached || false, comet: challenge.comet_reached || false, nebula: challenge.nebula_reached || false, meteoroid: challenge.meteoroid_reached || false }
            };
        } catch (error) { console.error('Error getting challenge status:', error); return null; }
    }

    getSystemStats() {
        return { activeChallenges: this.activeChallenges.size, activeMessages: this.activeChallengeMessages.size,
            duplicateProtection: this.recentlyCreatedChallenges.size, participantsTracking: this.challengeParticipants.size, activeTimeouts: this.challengeTimeouts.size };
    }
}

let globalChallengeManager = null;

async function setupGlobalChallengeSystem(client) {
    console.log('🚀 Setting up Global Challenge System...');
    globalChallengeManager = new GlobalChallengeManager(client);
    await globalChallengeManager.setup();
    console.log('✅ Global Challenge System setup complete!');
    return globalChallengeManager;
}

module.exports = {
    GlobalChallengeManager, setupGlobalChallengeSystem,
    getGlobalChallengeManager: () => globalChallengeManager,
    processMessageForGlobalChallenge: async function(guildId, userId, username, message) {
        try {
            if (!globalChallengeManager) { globalChallengeManager = new GlobalChallengeManager(message.client); await globalChallengeManager.setup(); }
            return await globalChallengeManager.processMessageForChallenge(guildId, userId, username, message);
        } catch (error) { console.error('Error processing global challenge:', error); return { success: false, error: error.message }; }
    },
    getChallengeStatus: async (guildId) => { if (!globalChallengeManager) return null; return await globalChallengeManager.getChallengeStatus(guildId); },
    getSystemStats: () => { if (!globalChallengeManager) return null; return globalChallengeManager.getSystemStats(); }
};