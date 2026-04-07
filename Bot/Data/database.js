const { Pool } = require('pg');
const path = require('path');

// ========== MISSION CONFIGURATION ==========

const MISSION_TEMPLATES = {
    daily: [
        {
            title: 'Server Bumper',
            description: 'Bump the server 1-2 times',
            req_type: 'bumps',
            req_min: 1, req_max: 2,
            xp_min: 80, xp_max: 100,
            coins_min: 40, coins_max: 60,
            crystals_min: 0, crystals_max: 0,
            bonus_chance: 0.20,
            bonus_type: 'add_crystal',
            bonus_value: 1
        },
        {
            title: 'Chat Activator',
            description: 'Send 40-60 messages',
            req_type: 'messages',
            req_min: 40, req_max: 60,
            xp_min: 70, xp_max: 90,
            coins_min: 50, coins_max: 60,
            crystals_min: 0, crystals_max: 0,
            bonus_chance: 0.15,
            bonus_type: 'multiply_xp',
            bonus_value: 1.5
        },
        {
            title: 'Drop Hunter',
            description: 'Claim 1-2 drops from (Chat - Event)',
            req_type: 'drops',
            req_min: 1, req_max: 2,
            xp_min: 90, xp_max: 130,
            coins_min: 70, coins_max: 100,
            crystals_min: 0, crystals_max: 0,
            bonus_chance: 0.10,
            bonus_type: 'multiply_xp',
            bonus_value: 2.0
        },
        {
            title: 'Voice Presence',
            description: 'Spend 30-45 minutes in voice',
            req_type: 'voice_minutes',
            req_min: 30, req_max: 45,
            xp_min: 70, xp_max: 95,
            coins_min: 40, coins_max: 70,
            crystals_min: 0, crystals_max: 0,
            bonus_chance: 0.15,
            bonus_type: 'multiply_coins',
            bonus_value: 1.5
        },
        {
            title: 'Smart Contributor',
            description: 'Get 1-2 react from level 5+ community members',
            req_type: 'staff_reacts',
            req_min: 1, req_max: 2,
            xp_min: 60, xp_max: 100,
            coins_min: 40, coins_max: 90,
            crystals_min: 0, crystals_max: 0,
            bonus_chance: 0.20,
            bonus_type: 'add_xp',
            bonus_value: 60
        },
        {
            title: 'Lucky Day',
            description: 'Earn 350-500 coins from (Chat - Drops)',
            req_type: 'drop_coins',
            req_min: 350, req_max: 500,
            xp_min: 30, xp_max: 50,
            coins_min: 100, coins_max: 150,
            crystals_min: 0, crystals_max: 0,
            bonus_chance: 0.20,
            bonus_type: 'multiply_coins',
            bonus_value: 2.0
        },
        {
            title: 'Social Interaction',
            description: 'Reply to 6-10 different people',
            req_type: 'unique_replies',
            req_min: 7, req_max: 15,
            xp_min: 40, xp_max: 60,
            coins_min: 50, coins_max: 80,
            crystals_min: 0, crystals_max: 0,
            bonus_chance: 0.10,
            bonus_type: 'add_xp',
            bonus_value: 40
        }
    ],

    weekly: [
        {
            title: 'Weekly Bumper',
            description: 'Bump the server 8-12 times',
            req_type: 'bumps',
            req_min: 8, req_max: 12,
            xp_min: 450, xp_max: 600,
            coins_min: 300, coins_max: 500,
            crystals_min: 0, crystals_max: 1,
            bonus_chance: 0.30,
            bonus_type: 'multiply_xp',
            bonus_value: 1.5
        },
        {
            title: 'Weekly Active',
            description: 'Send 400-600 messages',
            req_type: 'messages',
            req_min: 400, req_max: 600,
            xp_min: 550, xp_max: 800,
            coins_min: 600, coins_max: 750,
            crystals_min: 0, crystals_max: 1,
            bonus_chance: 0.35,
            bonus_type: 'add_coins',
            bonus_value: 200
        },
        {
            title: 'Voice Resident',
            description: 'Spend 24 - 48 hours in voice',
            req_type: 'voice_minutes',
            req_min: 1440, req_max: 2880,
            xp_min: 500, xp_max: 750,
            coins_min: 550, coins_max: 650,
            crystals_min: 0, crystals_max: 1,
            bonus_chance: 0.25,
            bonus_type: 'multiply_xp',
            bonus_value: 1.5
        },
        {
            title: 'Drop Master',
            description: 'Claim 7-10 drops from (Chat - Event)',
            req_type: 'drops',
            req_min: 7, req_max: 10,
            xp_min: 350, xp_max: 450,
            coins_min: 300, coins_max: 500,
            crystals_min: 0, crystals_max: 1,
            bonus_chance: 0.20,
            bonus_type: 'multiply_coins',
            bonus_value: 1.5
        },
        {
            title: 'True Contributor',
            description: 'Get 12-18 react from level 5+ community members',
            req_type: 'staff_reacts',
            req_min: 12, req_max: 18,
            xp_min: 400, xp_max: 600,
            coins_min: 450, coins_max: 650,
            crystals_min: 0, crystals_max: 1,
            bonus_chance: 0.25,
            bonus_type: 'add_xp',
            bonus_value: 200
        },
        {
            title: 'Reward Collector',
            description: 'Collect 2500-3500 coins (Chat - Drops)',
            req_type: 'total_coins',
            req_min: 2500, req_max: 3500,
            xp_min: 300, xp_max: 500,
            coins_min: 250, coins_max: 400,
            crystals_min: 0, crystals_max: 1,
            bonus_chance: 0.25,
            bonus_type: 'add_xp',
            bonus_value: 150
        }
    ]
};

class DatabaseManager {
    constructor() {

        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        this.init();
    }

    // تحويل الاستعلامات من ? إلى $1, $2, etc
    convertQueryToPGFormat(sql, params) {
        let convertedSql = sql;
        let paramIndex = 1;

        // استبدال جميع ? بـ $1, $2, etc
        convertedSql = convertedSql.replace(/\?/g, () => `$${paramIndex++}`);

        return convertedSql;
    }

    async init() {
        try {
            await this.initializeTables();
            console.log('✅ Connected to PostgreSQL database successfully');
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            // إعادة المحاولة بعد 5 ثواني في حالة الفشل
            setTimeout(() => this.init(), 5000);
        }
    }

    // تهيئة الجداول
    async initializeTables() {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const queries = [
                `CREATE TABLE IF NOT EXISTS bot_settings (
                    id SERIAL PRIMARY KEY,
                    setting_key TEXT UNIQUE NOT NULL,
                    setting_value TEXT,
                    guild_id TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_by TEXT
                )`,
                `CREATE TABLE IF NOT EXISTS log_channels (
                    id SERIAL PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    channel_type TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    channel_name TEXT,
                    set_by TEXT,
                    set_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(guild_id, channel_type)
                )`,
                `CREATE TABLE IF NOT EXISTS counted_channels (
                    id SERIAL PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    channel_name TEXT,
                    added_by TEXT,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(guild_id, channel_id)
                )`,
                `CREATE TABLE IF NOT EXISTS giveaway_auto_channels (
                    id SERIAL PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    channel_name TEXT NOT NULL,
                    set_by TEXT NOT NULL,
                    set_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(guild_id, channel_id)
                )`,
                `CREATE TABLE IF NOT EXISTS fame_points (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL UNIQUE,
                    username TEXT NOT NULL,
                    daily INTEGER DEFAULT 0,
                    special INTEGER DEFAULT 0,
                    vip INTEGER DEFAULT 0,
                    weekly INTEGER DEFAULT 0,
                    humbler INTEGER DEFAULT 0,
                    total INTEGER DEFAULT 0,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS message_stats (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE,
                username TEXT NOT NULL,
                sent INTEGER DEFAULT 0,
                deleted INTEGER DEFAULT 0,
                total INTEGER DEFAULT 0,
                daily_sent INTEGER DEFAULT 0,
                daily_deleted INTEGER DEFAULT 0,
                daily_total INTEGER DEFAULT 0,
                weekly_sent INTEGER DEFAULT 0,
                weekly_deleted INTEGER DEFAULT 0,
                weekly_total INTEGER DEFAULT 0,
                monthly_sent INTEGER DEFAULT 0,
                monthly_deleted INTEGER DEFAULT 0,
                monthly_total INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                daily_reset_date TEXT DEFAULT '',
                weekly_reset_date TEXT DEFAULT '',
                monthly_reset_date TEXT DEFAULT ''
                )`,
                `CREATE TABLE IF NOT EXISTS message_auto_roles (
                    id SERIAL PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    username TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    total_messages INTEGER DEFAULT 0,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(guild_id, user_id)
                )`,
                `CREATE TABLE IF NOT EXISTS live_leaderboards (
                    id SERIAL PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    leaderboard_type TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    message_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(guild_id, leaderboard_type)
                )`,
                `CREATE TABLE IF NOT EXISTS temp_roles (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    user_name TEXT NOT NULL,
                    role_id TEXT NOT NULL,
                    role_name TEXT NOT NULL,
                    guild_id TEXT NOT NULL,
                    guild_name TEXT,
                    expires_at TIMESTAMP NOT NULL,
                    duration TEXT NOT NULL,
                    assigned_by TEXT,
                    assigned_by_name TEXT,
                    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    initial_message_id TEXT,
                    channel_id TEXT,
                    is_active BOOLEAN DEFAULT true
                )`,
                `CREATE TABLE IF NOT EXISTS invites (
                    user_id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    total INTEGER DEFAULT 0,
                    verified INTEGER DEFAULT 0,
                    unverified INTEGER DEFAULT 0,
                    left_count INTEGER DEFAULT 0,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS invite_usage (
                    guild_id TEXT NOT NULL,
                    invite_code TEXT NOT NULL,
                    uses INTEGER DEFAULT 0,
                    inviter_id TEXT,
                    PRIMARY KEY (guild_id, invite_code)
                )`,
                `CREATE TABLE IF NOT EXISTS member_join_history (
                    member_id TEXT PRIMARY KEY,
                    first_join_date TIMESTAMP NOT NULL,
                    last_join_date TIMESTAMP NOT NULL,
                    inviter_id TEXT DEFAULT 'Unknown',
                    join_count INTEGER DEFAULT 1
                )`,
                `CREATE TABLE IF NOT EXISTS member_verification_status (
                    member_id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    is_verified BOOLEAN DEFAULT false,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS discord_verify_steam (
                    id SERIAL PRIMARY KEY,

                    -- بيانات Discord
                    discord_id TEXT NOT NULL UNIQUE,
                    discord_username TEXT NOT NULL,

                    -- بيانات Steam
                    steam_id TEXT,
                    steam_profile_url TEXT NOT NULL,
                    steam_name TEXT,

                    -- نظام التحقق
                    verification_code VARCHAR(20) UNIQUE,
                    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified'
                    verified_at TIMESTAMP,

                    -- معلومات الإضافة
                    added_by TEXT NOT NULL,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS verify_panel_settings (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    panel_channel_id TEXT,
                    panel_message_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS shame_points (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL UNIQUE,
                    username TEXT NOT NULL,
                    giveaway_ban INTEGER DEFAULT 0,
                    warns INTEGER DEFAULT 0,
                    total INTEGER DEFAULT 0,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS story_progress (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    username TEXT NOT NULL,
                    story_title TEXT NOT NULL,
                    ending_id TEXT NOT NULL,
                    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, story_title, ending_id)
                )`,
                `CREATE TABLE IF NOT EXISTS tester_applications (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    user_tag TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processed_at TIMESTAMP,
                    processed_by TEXT,
                    message_id TEXT,
                    thread_id TEXT,
                    thread_status TEXT,
                    UNIQUE(user_id)
                )`,
                `CREATE TABLE IF NOT EXISTS tester_panel_settings (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    panel_message_id TEXT,
                    panel_channel_id TEXT,
                    current_game_link TEXT DEFAULT 'https://store.steampowered.com/app/3794610/Goblin_Vyke/',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT single_row CHECK (id = 1)
                )`,
                // santa letter
                `CREATE TABLE IF NOT EXISTS gift_feedback (
                    gift_id VARCHAR(20) PRIMARY KEY,
                    user_id VARCHAR(20) UNIQUE NOT NULL,
                    username VARCHAR(100) NOT NULL,
                    region VARCHAR(100) NOT NULL,
                    game_name VARCHAR(100) NOT NULL,
                    game_description TEXT,
                    server_feedback TEXT NOT NULL,
                    company_feedback TEXT
                )`,

                // جدول المستخدمين
                `CREATE TABLE IF NOT EXISTS levels (
                    -- الأساسيات
                    user_id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,

                    -- العملات والخبرة (مع الحدود اليومية)
                    xp INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 0, -- بدء من المستوى 0
                    sky_coins INTEGER DEFAULT 0,
                    sky_crystals INTEGER DEFAULT 0,

                    -- النقاط حسب النشاط (مع الحدود اليومية)
                    chat_points INTEGER DEFAULT 0,
                    voice_points INTEGER DEFAULT 0,
                    reaction_points INTEGER DEFAULT 0,
                    invite_points INTEGER DEFAULT 0,

                    wallpaper_url TEXT DEFAULT NULL,

                    -- نظام الصرف اليومي (Exchange Daily System)
                    crystals_exchanged_today INTEGER DEFAULT 0, -- الكريستالات المستبدلة اليوم
                    last_exchange_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- آخر مرة تم فيها تصفير العدادات

                    -- المهام اليومية والأسبوعية
                    last_daily TIMESTAMP,
                    last_weekly TIMESTAMP,
                    daily_streak INTEGER DEFAULT 0,
                    weekly_streak INTEGER DEFAULT 0,

                    -- الحدود اليومية (Daily Caps)
                    xp_earned_today INTEGER DEFAULT 0, -- XP المكتسبة اليوم
                    coins_earned_today INTEGER DEFAULT 0, -- العملات المكتسبة اليوم
                    last_daily_earned TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- آخر مرة تم فيها إعادة تعيين الحدود

                    -- الفهارس للسرعة
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                // في initializeTables() بعد جدول levels
                `CREATE TABLE IF NOT EXISTS shop_items (
                    id SERIAL PRIMARY KEY,

                    -- بيانات المنتج الأساسية
                    role_id TEXT NOT NULL UNIQUE,
                    item_emoji TEXT DEFAULT '🛒', 

                    -- الأسعار الأصلية
                    original_price_coins INTEGER NOT NULL DEFAULT 0,
                    original_price_crystals INTEGER NOT NULL DEFAULT 0,

                    -- الأسعار بعد الخصم (تحسب تلقائياً)
                    discounted_price_coins INTEGER DEFAULT 0,
                    discounted_price_crystals INTEGER DEFAULT 0,

                    -- نظام التخفيض الجديد
                    discount_chance INTEGER DEFAULT 0, -- فرصة ظهور التخفيض (0-100)%
                    current_discount INTEGER DEFAULT 0, -- التخفيض الحالي النشط (0-100)%
                    is_on_sale BOOLEAN DEFAULT false, -- عليه تخفيض ولا لا

                    -- المخزون
                    quantity INTEGER NOT NULL DEFAULT 1,

                    -- الوصف والتفاصيل
                    description TEXT,

                    buff_type TEXT,              -- نوع الـ Buff: 'double_xp', 'double_coins', 'double_luck'
                    buff_duration_minutes INTEGER DEFAULT 0, -- مدة الـ Buff بالدقائق

                    -- معلومات النظام
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by TEXT,

                    UNIQUE(role_id)
                )`,

                `CREATE TABLE IF NOT EXISTS user_crates (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    username TEXT NOT NULL,
                    crate_type TEXT NOT NULL,
                    reward_type TEXT NOT NULL,

                    -- القيم
                    coins_amount INTEGER DEFAULT 0,
                    xp_amount INTEGER DEFAULT 0,
                    crystals_amount INTEGER DEFAULT 0,

                    -- الـ Buffs
                    buff_type TEXT,
                    buff_duration_minutes INTEGER,

                    coupon_discount INTEGER DEFAULT NULL,
                    coupon_info JSONB DEFAULT NULL,

                    -- حالة الصندوق
                    is_used BOOLEAN DEFAULT FALSE,
                    used_at TIMESTAMP,

                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS shop_coupons (
                    id SERIAL PRIMARY KEY,

                    

                    -- علاقة بالدروب (من أي drop جاية)
                    user_id TEXT NOT NULL,
                    username TEXT NOT NULL,

                    coupon_code TEXT UNIQUE,

                    -- معلومات الكوبون
                    discount_percentage INTEGER NOT NULL CHECK (discount_percentage BETWEEN 5 AND 40),
                    expires_at TIMESTAMP NOT NULL, -- تاريخ الانتهاء

                    -- المنتج المطبق عليه (NULL = أي منتج)
                    applicable_item_id INTEGER REFERENCES shop_items(id),

                    -- حالة الكوبون
                    is_used BOOLEAN DEFAULT false,
                    used_at TIMESTAMP,
                    used_on_item_id INTEGER, -- المنتج اللي اشتُري باستخدام الكوبون

                    source_drop_type TEXT, -- 'common', 'rare', 'epic', 'legendary'
                    source_crate_id INTEGER REFERENCES user_crates(id),

                    -- إحصائيات
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS user_drop_progress (
                    user_id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    total_messages INTEGER DEFAULT 0,

                    -- الـ Targets الحالية
                    common_target INTEGER DEFAULT 0,
                    rare_target INTEGER DEFAULT 0,
                    epic_target INTEGER DEFAULT 0,
                    legendary_target INTEGER DEFAULT 0,

                    -- آخر مرة أخذ فيها Drop
                    last_common_at INTEGER DEFAULT 0,
                    last_rare_at INTEGER DEFAULT 0,
                    last_epic_at INTEGER DEFAULT 0,
                    last_legendary_at INTEGER DEFAULT 0,

                    -- إحصاءات
                    total_common_received INTEGER DEFAULT 0,
                    total_rare_received INTEGER DEFAULT 0,
                    total_epic_received INTEGER DEFAULT 0,
                    total_legendary_received INTEGER DEFAULT 0,

                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS active_buffs (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    buff_type TEXT NOT NULL,

                    -- معلومات الـ Buff
                    multiplier REAL DEFAULT 2.0,
                    duration_minutes INTEGER NOT NULL,
                    expires_at TIMESTAMP NOT NULL,

                    shop_item_id INTEGER REFERENCES shop_items(id),
                    role_id TEXT,

                    -- المصدر
                    source_crate_type TEXT,
                    source_crate_id INTEGER,
                    

                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS drop_config (
                    drop_type TEXT PRIMARY KEY,
                    min_messages INTEGER NOT NULL,
                    max_messages INTEGER NOT NULL,
                    description TEXT,
                    rewards_config JSONB DEFAULT '[]',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS user_goals (
                    -- الأساسيات
                    goal_id SERIAL PRIMARY KEY,
                    user_id VARCHAR(50) NOT NULL,
                    period_date TIMESTAMP,         -- للمهام اليومية
                    period_date_weekly TIMESTAMP,  -- للمهام الأسبوعية

                    -- المهام اليومية (مخزنة كـ JSON)
                    daily_goal1 JSONB,  -- title, description, req_type, assigned_requirement, assigned_xp, assigned_coins, assigned_crystals, bonus_chance, bonus_type, bonus_value
                    daily_goal2 JSONB,  -- نفس الهيكل
                    daily_goal3 JSONB,  -- bonus - تتفعل لما daily_streak >= 5

                    -- المهام الأسبوعية (مخزنة كـ JSON)
                    weekly_goal  JSONB, -- نفس الهيكل
                    weekly_goal2 JSONB, -- bonus - تتفعل لما weekly_streak >= 5

                    -- التقدم لكل مهمة
                    daily1_progress  INTEGER DEFAULT 0,
                    daily2_progress  INTEGER DEFAULT 0,
                    daily3_progress  INTEGER DEFAULT 0,
                    weekly_progress  INTEGER DEFAULT 0,
                    weekly2_progress INTEGER DEFAULT 0,

                    -- حالة الإكمال
                    daily1_completed  BOOLEAN DEFAULT FALSE,
                    daily2_completed  BOOLEAN DEFAULT FALSE,
                    daily3_completed  BOOLEAN DEFAULT FALSE,
                    weekly_completed  BOOLEAN DEFAULT FALSE,
                    weekly2_completed BOOLEAN DEFAULT FALSE,

                    -- حالة الاستلام
                    daily1_claimed  BOOLEAN DEFAULT FALSE,
                    daily2_claimed  BOOLEAN DEFAULT FALSE,
                    daily3_claimed  BOOLEAN DEFAULT FALSE,
                    weekly_claimed  BOOLEAN DEFAULT FALSE,
                    weekly2_claimed BOOLEAN DEFAULT FALSE,

                    -- حالة البونص
                    daily1_bonus  BOOLEAN DEFAULT FALSE,
                    daily2_bonus  BOOLEAN DEFAULT FALSE,
                    daily3_bonus  BOOLEAN DEFAULT FALSE,
                    weekly_bonus  BOOLEAN DEFAULT FALSE,
                    weekly2_bonus BOOLEAN DEFAULT FALSE,

                    -- التواريخ
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                    UNIQUE(user_id, period_date)
                )`,

                `CREATE TABLE IF NOT EXISTS global_challenges (
                    -- الأساسيات
                    challenge_id SERIAL PRIMARY KEY,
                    guild_id TEXT NOT NULL UNIQUE,

                    -- العداد الجماعي (الدوري)
                    total_messages INTEGER DEFAULT 0,
                    messages_in_current_cycle INTEGER DEFAULT 0,

                    -- ========== LEVEL TARGETS ==========
                    star_target INTEGER DEFAULT 0,
                    comet_target INTEGER DEFAULT 0,
                    nebula_target INTEGER DEFAULT 0,
                    meteoroid_target INTEGER DEFAULT 0,

                    -- ========== BETWEEN TARGETS ==========
                    before_star_target INTEGER DEFAULT 0,
                    star_comet_target INTEGER DEFAULT 0,
                    comet_nebula_target INTEGER DEFAULT 0,
                    nebula_meteoroid_target INTEGER DEFAULT 0,
                    voice_challenge_target INTEGER DEFAULT 0,

                    -- حالة الإكمال للـ Level Targets
                    star_reached BOOLEAN DEFAULT FALSE,
                    comet_reached BOOLEAN DEFAULT FALSE,
                    nebula_reached BOOLEAN DEFAULT FALSE,
                    meteoroid_reached BOOLEAN DEFAULT FALSE,

                    -- حالة الإكمال للـ Between Targets
                    before_star_completed BOOLEAN DEFAULT FALSE,
                    star_comet_completed BOOLEAN DEFAULT FALSE,
                    comet_nebula_completed BOOLEAN DEFAULT FALSE,
                    nebula_meteoroid_completed BOOLEAN DEFAULT FALSE,
                    voice_challenge_completed BOOLEAN DEFAULT FALSE,

                    -- التحدي النشط حالياً
                    challenge_type TEXT DEFAULT 'mention_bot',
                    challenge_description TEXT DEFAULT 'Mention the bot the fastest!',
                    challenge_duration_minutes INTEGER DEFAULT 60,
                    challenge_end_time TIMESTAMP,
                    current_winner TEXT,
                    winners_list JSONB DEFAULT '[]',
                    rewards_distributed BOOLEAN DEFAULT FALSE,

                    -- إحصائيات السيرفر
                    total_cycles INTEGER DEFAULT 0,
                    total_star_challenges INTEGER DEFAULT 0,
                    total_comet_challenges INTEGER DEFAULT 0,
                    total_nebula_challenges INTEGER DEFAULT 0,
                    total_meteoroid_challenges INTEGER DEFAULT 0,

                    -- التواريخ
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_challenge_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS skywell_users (
                    -- ========== الأساسيات ==========
                    user_id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,

                    -- ========== الإجماليات ==========
                    total_coins_thrown INTEGER DEFAULT 0,          -- Coins المرمية مباشرة
                    total_crystals_thrown INTEGER DEFAULT 0,       -- Crystals المرمية
                    total_converted_coins INTEGER DEFAULT 0,       -- Coins من تحويل Crystals

                    -- ========== المستوي الحالي ==========
                    current_level INTEGER DEFAULT 0,               -- 0 = مبتدئ
                    current_role_id TEXT,                          -- ID الرول الحالي

                    -- ========== الإحصائيات ==========
                    throw_count INTEGER DEFAULT 0,
                    highest_single_throw INTEGER DEFAULT 0,

                    -- ========== التواريخ ==========
                    first_throw_at TIMESTAMP,
                    last_throw_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                // ===== GIVEAWAY SYSTEM TABLES =====
                /*`CREATE TABLE IF NOT EXISTS communitygiveaways (
                    id SERIAL PRIMARY KEY,
                    giveaway_code VARCHAR(20) UNIQUE NOT NULL,

                    -- بيانات الجيفاواي الأساسية
                    game_name TEXT NOT NULL,
                    game_link TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    image_url TEXT NOT NULL,
                    note TEXT,
                    req_role_id TEXT,
                    winners_count INTEGER DEFAULT 1,

                    -- متطلبات الرسائل (اختياري)
                    message_req_type TEXT,
                    message_req_amount INTEGER,

                    -- وقت الإنشاء والانتهاء
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ends_at TIMESTAMP NOT NULL,
                    ended_at TIMESTAMP,

                    -- صاحب الجيفاواي
                    host_id TEXT NOT NULL,
                    host_name TEXT NOT NULL,
                    guild_id TEXT NOT NULL,

                    -- رسالة الجيفاواي
                    message_id TEXT,
                    channel_id TEXT,

                    -- المشاركين والفائزين
                    participants TEXT[] DEFAULT '{}',
                    winners TEXT[] DEFAULT '{}',

                    -- الحالة
                    is_active BOOLEAN DEFAULT true,
                    is_ended BOOLEAN DEFAULT false,
                    winner_rewarded BOOLEAN DEFAULT false,

                    -- ========== الأعمدة الجديدة لنظام التأكيد ==========
                    co_de_members JSONB DEFAULT '[]',      -- تخزين الفائزين مع حالاتهم
                    confirm_count INTEGER DEFAULT 0,        -- عدد المؤكدين
                    decline_count INTEGER DEFAULT 0,        -- عدد الرافضين
                    all_responded BOOLEAN DEFAULT false,    -- الكل استجاب؟
                    all_confirmed BOOLEAN DEFAULT false,    -- الكل أكد؟
                    host_rewarded BOOLEAN DEFAULT false,    -- الـ Host أخذ المكافأة؟

                    -- الفهارس
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,*/

                // =============================================
                // Migration: activity_rewards (Single Table)

                `CREATE TABLE IF NOT EXISTS activity_rewards (
                    -- الأساسيات
                    user_id          VARCHAR(50)  PRIMARY KEY,
                    username         VARCHAR(100) NOT NULL,
                    total_sky_tokens INTEGER      DEFAULT 0,

                    -- Guild & Partner
                    guild            VARCHAR(50)  DEFAULT NULL,
                    partner_id       VARCHAR(50)  DEFAULT NULL,
                    partner_name     VARCHAR(100) DEFAULT NULL,
                    forum_post_id    TEXT,

                    -- ===== Message Tracking =====
                    daily_messages   INTEGER  DEFAULT 0,
                    weekly_messages  INTEGER  DEFAULT 0,

                    -- ===== Daily Quest Streak =====
                    quest_streak     INTEGER  DEFAULT 0,

                    -- ===== Daily Activities (reset every day) =====
                    msg_50_claimed              INTEGER  DEFAULT 0,
                    goals_daily_claimed         INTEGER  DEFAULT 0,
                    invite_claimed              INTEGER  DEFAULT 0,
                    interaction_claimed         INTEGER  DEFAULT 0,
                    tweet_reddit_post_claimed   INTEGER  DEFAULT 0,
                    bug_publisher_claimed       INTEGER  DEFAULT 0,
                    bug_skybots_claimed         INTEGER  DEFAULT 0,
                    helper_claimed              INTEGER  DEFAULT 0,
                    steam_achievement_claimed   INTEGER  DEFAULT 0,

                    -- ===== Weekly Activities (reset every Monday) =====
                    msg_500_claimed     INTEGER  DEFAULT 0,
                    steamachievements_weekly_claimed INTEGER DEFAULT 0,

                    -- ===== One-Time Activities (boolean) =====
                    steam_linked        BOOLEAN  DEFAULT FALSE,
                    follow_twitter      BOOLEAN  DEFAULT FALSE,
                    follow_reddit       BOOLEAN  DEFAULT FALSE,
                    follow_steam        BOOLEAN  DEFAULT FALSE,
                    boosted_server      BOOLEAN  DEFAULT FALSE,
                    achievements_claimed INTEGER  DEFAULT 0,
                    finish_game_claimed INTEGER  DEFAULT 0,
                    wishlist_claimed    BOOLEAN  DEFAULT FALSE,
                    review_claimed      BOOLEAN  DEFAULT FALSE,
                    suggestion_claimed  BOOLEAN  DEFAULT FALSE,

                    -- ===== Community Giveaways =====
                    community_giveaways_claimed INTEGER  DEFAULT 0,

                    -- ===== Letter Hunt =====
                    letter_hunt_wins    INTEGER  DEFAULT 0,
                    letter_hunt_rewards INTEGER  DEFAULT 0,

                    -- Timestamps
                    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                // جدول طلبات الشريك
                `CREATE TABLE IF NOT EXISTS partner_requests (
                    id SERIAL PRIMARY KEY,
                    requester_id TEXT NOT NULL,
                    requester_name TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    target_name TEXT NOT NULL,
                    guild TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    message_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS time_capsules (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    username TEXT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS reset_tracker (
                    reset_type TEXT PRIMARY KEY,
                    last_reset TIMESTAMP NOT NULL
                )`,

                `CREATE TABLE IF NOT EXISTS egg_holders (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    username TEXT NOT NULL,
                    egg_color TEXT NOT NULL,
                    egg_type TEXT DEFAULT 'normal',
                    heat REAL DEFAULT 0,
                    msg_counter INTEGER DEFAULT 0,
                    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    hatched BOOLEAN DEFAULT FALSE,
                    UNIQUE(user_id, egg_type)
                )`,

                `CREATE TABLE IF NOT EXISTS egg_server_state (
                    guild_id TEXT PRIMARY KEY,
                    msg_counter INTEGER DEFAULT 0,
                    active_msg_id TEXT,
                    active_channel_id TEXT,
                    active_egg_type TEXT,
                    event_active BOOLEAN DEFAULT FALSE
                )`,

                `CREATE TABLE IF NOT EXISTS giveaways (
                    id BIGSERIAL PRIMARY KEY,
                    giveaway_code TEXT UNIQUE NOT NULL,
                    channel_id TEXT NOT NULL,
                    message_id TEXT,                     -- nullable لأن المجدول ليس له رسالة بعد
                    template TEXT DEFAULT NULL,
                    duration TEXT NOT NULL,
                    end_time TIMESTAMPTZ NOT NULL,
                    winners_count INTEGER DEFAULT 1,
                    entry_type TEXT DEFAULT 'messages',
                    entry_values JSONB DEFAULT NULL,
                    multiplier JSONB DEFAULT NULL,
                    reqrole JSONB DEFAULT NULL,
                    banrole JSONB DEFAULT NULL,
                    host_id TEXT NOT NULL,
                    image_url TEXT DEFAULT NULL,
                    schedule TIMESTAMPTZ DEFAULT NULL,    -- وقت البدء المؤجل
                    status TEXT DEFAULT 'active',
                    entries JSONB DEFAULT '{}'::jsonb,
                    winners JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),

                    CONSTRAINT valid_status CHECK (status IN ('active', 'ended', 'cancelled', 'scheduled')),
                    CONSTRAINT valid_entry_type CHECK (entry_type IN ('messages', 'coins', 'crystals', 'xp'))
                )`,

                // الفهارس
                `CREATE INDEX IF NOT EXISTS idx_giveaways_code ON giveaways(giveaway_code)`,
                `CREATE INDEX IF NOT EXISTS idx_giveaways_status ON giveaways(status)`,
                `CREATE INDEX IF NOT EXISTS idx_giveaways_end_time ON giveaways(end_time)`,
                `CREATE INDEX IF NOT EXISTS idx_giveaways_host ON giveaways(host_id)`,

                `CREATE INDEX IF NOT EXISTS idx_egg_holders_user ON egg_holders(user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_egg_holders_heat ON egg_holders(heat DESC)`,
                `CREATE INDEX IF NOT EXISTS idx_egg_holders_active ON egg_holders(user_id, hatched, egg_type)`,

                `CREATE INDEX IF NOT EXISTS idx_partner_requests_target    ON partner_requests(target_id, status)`,
                `CREATE INDEX IF NOT EXISTS idx_partner_requests_requester ON partner_requests(requester_id, status)`,
                `CREATE INDEX IF NOT EXISTS idx_partner_requests_status    ON partner_requests(status)`,
                
                `CREATE INDEX IF NOT EXISTS idx_ar_guild        ON activity_rewards(guild)`,
                `CREATE INDEX IF NOT EXISTS idx_ar_partner      ON activity_rewards(partner_id)`,
                `CREATE INDEX IF NOT EXISTS idx_ar_tokens       ON activity_rewards(total_sky_tokens DESC)`,
                `CREATE INDEX IF NOT EXISTS idx_ar_streak       ON activity_rewards(quest_streak DESC)`,
                `CREATE INDEX IF NOT EXISTS idx_ar_user_guild   ON activity_rewards(user_id, guild)`,
                `CREATE INDEX IF NOT EXISTS idx_ar_partner_null ON activity_rewards(partner_id) WHERE partner_id IS NULL`,


                `CREATE INDEX IF NOT EXISTS idx_active_buffs_role ON active_buffs(role_id)`,
                `CREATE INDEX IF NOT EXISTS idx_active_buffs_shop_item ON active_buffs(shop_item_id)`,
                `CREATE INDEX IF NOT EXISTS idx_shop_items_buff ON shop_items(buff_type) WHERE buff_type IS NOT NULL`,
                
                `CREATE INDEX IF NOT EXISTS idx_coupons_code ON shop_coupons(coupon_code)`,
                `CREATE INDEX IF NOT EXISTS idx_coupons_user ON shop_coupons(user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_coupons_expires ON shop_coupons(expires_at)`,
                
                `CREATE INDEX IF NOT EXISTS idx_global_challenges_guild ON global_challenges(guild_id)`,
                `CREATE INDEX IF NOT EXISTS idx_global_challenges_active ON global_challenges(challenge_end_time)`,
                `CREATE INDEX IF NOT EXISTS idx_global_challenges_reset ON global_challenges(last_challenge_reset)`,
                
                `CREATE INDEX IF NOT EXISTS idx_user_goals_user_date ON user_goals(user_id, period_date)`,
                `CREATE INDEX IF NOT EXISTS idx_user_goals_daily_completed ON user_goals(user_id) 
                 WHERE (daily1_completed = true OR daily2_completed = true)`,
                `CREATE INDEX IF NOT EXISTS idx_user_goals_weekly_completed ON user_goals(user_id) 
                 WHERE weekly_completed = true`,
                `CREATE INDEX IF NOT EXISTS idx_user_goals_daily_claimed ON user_goals(user_id) 
                 WHERE (daily1_claimed = false OR daily2_claimed = false)`,
                `CREATE INDEX IF NOT EXISTS idx_user_goals_weekly_claimed ON user_goals(user_id) 
                 WHERE weekly_claimed = false`,
                `CREATE INDEX IF NOT EXISTS idx_user_goals_created_at ON user_goals(created_at DESC)`,
                `CREATE INDEX IF NOT EXISTS idx_user_goals_period_date ON user_goals(period_date DESC)`,
                `CREATE INDEX IF NOT EXISTS idx_user_goals_user_stats ON user_goals(user_id, created_at)`,

                `CREATE INDEX IF NOT EXISTS idx_user_drop_progress_user ON user_drop_progress(user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_user_drop_progress_messages ON user_drop_progress(total_messages DESC)`,
                `CREATE INDEX IF NOT EXISTS idx_user_crates_user ON user_crates(user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_user_crates_unused ON user_crates(user_id, is_used)`,
                `CREATE INDEX IF NOT EXISTS idx_user_crates_type ON user_crates(crate_type, user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_user_crates_created ON user_crates(created_at DESC)`,
                `CREATE INDEX IF NOT EXISTS idx_active_buffs_user ON active_buffs(user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_active_buffs_expiry ON active_buffs(expires_at)`,
                `CREATE INDEX IF NOT EXISTS idx_active_buffs_user_buff ON active_buffs(user_id, buff_type)`,
                `CREATE INDEX IF NOT EXISTS idx_drop_config_type ON drop_config(drop_type)`,
                `ALTER TABLE active_buffs ADD COLUMN IF NOT EXISTS role_id TEXT`,

                `CREATE INDEX IF NOT EXISTS idx_shop_items_price ON shop_items(original_price_coins, original_price_crystals)`,
                `CREATE INDEX IF NOT EXISTS idx_shop_items_created_at ON shop_items(created_at DESC)`,

                `CREATE INDEX IF NOT EXISTS idx_levels_xp ON levels(xp DESC)`,
                `CREATE INDEX IF NOT EXISTS idx_levels_level ON levels(level DESC)`,
                `CREATE INDEX IF NOT EXISTS idx_levels_coins ON levels(sky_coins DESC)`,
                `CREATE INDEX IF NOT EXISTS idx_levels_last_active ON levels(updated_at DESC)`,

                `CREATE INDEX IF NOT EXISTS idx_gift_user_id ON gift_feedback(user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_gift_gift_id ON gift_feedback(gift_id)`,
                `CREATE INDEX IF NOT EXISTS idx_gift_user_game ON gift_feedback(user_id, game_name)`,
                `CREATE INDEX IF NOT EXISTS idx_gift_username ON gift_feedback(username)`,

                `CREATE INDEX IF NOT EXISTS idx_tester_apps_user_id ON tester_applications(user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_tester_apps_status ON tester_applications(status)`,
                `CREATE INDEX IF NOT EXISTS idx_tester_apps_thread_status ON tester_applications(thread_status)`,
                `CREATE INDEX IF NOT EXISTS idx_fame_points_total ON fame_points(total)`,
                `CREATE INDEX IF NOT EXISTS idx_message_stats_total ON message_stats(total)`,
                `CREATE INDEX IF NOT EXISTS idx_temp_roles_expires ON temp_roles(expires_at)`,
                `CREATE INDEX IF NOT EXISTS idx_temp_roles_user ON temp_roles(user_id, guild_id)`,
                `CREATE INDEX IF NOT EXISTS idx_invites_total ON invites(total)`,
                `CREATE INDEX IF NOT EXISTS idx_member_join_history ON member_join_history(member_id)`,
                `CREATE INDEX IF NOT EXISTS idx_member_verification_status ON member_verification_status(member_id, is_verified)`,

                `CREATE INDEX IF NOT EXISTS idx_dvs_discord_id ON discord_verify_steam(discord_id)`,
                `CREATE INDEX IF NOT EXISTS idx_dvs_verification_code ON discord_verify_steam(verification_code)`,
                `CREATE INDEX IF NOT EXISTS idx_dvs_status ON discord_verify_steam(status)`,
                `CREATE INDEX IF NOT EXISTS idx_dvs_verified_at ON discord_verify_steam(verified_at)`,

                `CREATE INDEX IF NOT EXISTS idx_shame_points_total ON shame_points(total)`,
                `CREATE INDEX IF NOT EXISTS idx_story_progress_user ON story_progress(user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_story_progress_story ON story_progress(story_title)`,
                `CREATE INDEX IF NOT EXISTS idx_story_progress_completion ON story_progress(completed_at)`
            ];

            for (const query of queries) {
                await client.query(query);
            }

            await client.query('COMMIT');
            console.log('✅ All tables initialized successfully');

            await this.initializeDropConfigs();
            console.log('✅ Drop System tables initialized successfully');

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error initializing tables:', error);
            throw error;
        } finally {
            client.release();
        }

    }

    // ===== دوال تنفيذ الاستعلامات الأساسية =====
    async run(sql, params = []) {
        const convertedSql = this.convertQueryToPGFormat(sql, params);
        const client = await this.pool.connect();
        try {
            const result = await client.query(convertedSql, params);
            return { id: result.rows[0]?.id, changes: result.rowCount };
        } catch (error) {
            console.error('❌ Database error:', error);
            console.error('📝 Original SQL:', sql);
            console.error('📝 Converted SQL:', convertedSql);
            throw error;
        } finally {
            client.release();
        }
    }

    async get(sql, params = []) {
        const convertedSql = this.convertQueryToPGFormat(sql, params);
        const client = await this.pool.connect();
        try {
            const result = await client.query(convertedSql, params);
            return result.rows[0] || null;
        } catch (error) {
            console.error('❌ Database error:', error);
            console.error('📝 Original SQL:', sql);
            console.error('📝 Converted SQL:', convertedSql);
            throw error;
        } finally {
            client.release();
        }
    }

    async all(sql, params = []) {
        const convertedSql = this.convertQueryToPGFormat(sql, params);
        const client = await this.pool.connect();
        try {
            const result = await client.query(convertedSql, params);
            return result.rows;
        } catch (error) {
            console.error('❌ Database error:', error);
            console.error('📝 Original SQL:', sql);
            console.error('📝 Converted SQL:', convertedSql);
            throw error;
        } finally {
            client.release();
        }
    }

    async close() {
        await this.pool.end();
        console.log('Database connection closed');
    }

    // ===== دوال خاصة بالإعدادات والقنوات =====
    async setLogChannel(guildId, channelType, channelId, channelName, setBy) {
        try {
            const existing = await this.get(
                'SELECT * FROM log_channels WHERE guild_id = ? AND channel_type = ?',
                [guildId, channelType]
            );

            if (existing) {
                await this.run(
                    'UPDATE log_channels SET channel_id = ?, channel_name = ?, set_by = ?, set_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND channel_type = ?',
                    [channelId, channelName, setBy, guildId, channelType]
                );
            } else {
                await this.run(
                    'INSERT INTO log_channels (guild_id, channel_type, channel_id, channel_name, set_by) VALUES (?, ?, ?, ?, ?)',
                    [guildId, channelType, channelId, channelName, setBy]
                );
            }
            return true;
        } catch (error) {
            console.error('⚠️ Failed to set log channel:', error.message);
            return false;
        }
    }

    async getLogChannels(guildId) {
        try {
            return await this.all('SELECT * FROM log_channels WHERE guild_id = ?', [guildId]);
        } catch (error) {
            console.error('⚠️ Failed to get log channels:', error.message);
            return [];
        }
    }

    async getLogChannel(guildId, channelType) {
        try {
            return await this.get(
                'SELECT * FROM log_channels WHERE guild_id = ? AND channel_type = ?',
                [guildId, channelType]
            );
        } catch (error) {
            console.error('⚠️ Failed to get log channel:', error.message);
            return null;
        }
    }

    async toggleCountedChannel(guildId, channelId, channelName, addedBy) {
        try {
            const existing = await this.get(
                'SELECT * FROM counted_channels WHERE guild_id = ? AND channel_id = ?',
                [guildId, channelId]
            );

            if (existing) {
                await this.run(
                    'DELETE FROM counted_channels WHERE guild_id = ? AND channel_id = ?',
                    [guildId, channelId]
                );
                return 'removed';
            } else {
                await this.run(
                    'INSERT INTO counted_channels (guild_id, channel_id, channel_name, added_by) VALUES (?, ?, ?, ?)',
                    [guildId, channelId, channelName, addedBy]
                );
                return 'added';
            }
        } catch (error) {
            console.error('⚠️ Failed to toggle counted channel:', error.message);
            return 'error';
        }
    }

    async getCountedChannels(guildId) {
        try {
            return await this.all('SELECT * FROM counted_channels WHERE guild_id = ?', [guildId]);
        } catch (error) {
            console.error('⚠️ Failed to get counted channels:', error.message);
            return [];
        }
    }

    async isChannelCounted(guildId, channelId) {
        try {
            const result = await this.get(
                'SELECT COUNT(*) as count FROM counted_channels WHERE guild_id = ? AND channel_id = ?',
                [guildId, channelId]
            );
            return result.count > 0;
        } catch (error) {
            console.error('⚠️ Failed to check if channel is counted:', error.message);
            return false;
        }
    }

    // ===== دوال خاصة بالرولات المؤقتة =====
    async addTempRole(data) {
        try {
            const {
                userId, userName, roleId, roleName, guildId, guildName,
                expiresAt, duration, assignedBy, assignedByName, initialMessageId, channelId
            } = data;

            const result = await this.run(
                `INSERT INTO temp_roles 
                (user_id, user_name, role_id, role_name, guild_id, guild_name, expires_at, duration, assigned_by, assigned_by_name, initial_message_id, channel_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
                [userId, userName, roleId, roleName, guildId, guildName, expiresAt, duration, assignedBy, assignedByName, initialMessageId, channelId]
            );

            return result;
        } catch (error) {
            console.error('⚠️ Failed to add temp role:', error.message);
            return null;
        }
    }

    async removeTempRole(userId, roleId, guildId) {
        try {
            await this.run(
                'UPDATE temp_roles SET is_active = false WHERE user_id = ? AND role_id = ? AND guild_id = ? AND is_active = true',
                [userId, roleId, guildId]
            );
            return true;
        } catch (error) {
            console.error('⚠️ Failed to remove temp role:', error.message);
            return false;
        }
    }

    async getActiveTempRoles() {
        try {
            return await this.all('SELECT * FROM temp_roles WHERE is_active = true AND expires_at > NOW()');
        } catch (error) {
            console.error('⚠️ Failed to get active temp roles:', error.message);
            return [];
        }
    }

    async getExpiredTempRoles() {
        try {
            return await this.all('SELECT * FROM temp_roles WHERE is_active = true AND expires_at <= NOW()');
        } catch (error) {
            console.error('⚠️ Failed to get expired temp roles:', error.message);
            return [];
        }
    }

    // ===== دوال خاصة بنظام القصص =====
    async saveStoryProgress(userId, username, storyTitle, endingId) {
        try {
            const result = await this.run(
                'INSERT INTO story_progress (user_id, username, story_title, ending_id) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, story_title, ending_id) DO NOTHING RETURNING id',
                [userId, username, storyTitle, endingId]
            );
            return { success: true, id: result.id };
        } catch (error) {
            console.error('Failed to save story progress:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getUserStoryStats(userId, storyTitle = null) {
        try {
            let query = 'SELECT story_title, COUNT(ending_id) as endings_completed FROM story_progress WHERE user_id = ?';
            let params = [userId];

            if (storyTitle) {
                query += ' AND story_title = ? GROUP BY story_title';
                params.push(storyTitle);
            } else {
                query += ' GROUP BY story_title';
            }

            return await this.all(query, params);
        } catch (error) {
            console.error('Failed to get user story stats:', error.message);
            return [];
        }
    }

    async getUserStoryCompletionCount(userId) {
        try {
            return await this.all(
                `SELECT story_title, COUNT(ending_id) as completed_endings 
                 FROM story_progress 
                 WHERE user_id = ? 
                 GROUP BY story_title`,
                [userId]
            );
        } catch (error) {
            console.error('Failed to get user story completion count:', error.message);
            return [];
        }
    }

    async getStoryLeaderboard(storyTitle = null, limit = 10) {
        try {
            let query = '';
            let params = [];

            if (storyTitle) {
                query = `
                    SELECT user_id, username, COUNT(ending_id) as endings_completed
                    FROM story_progress 
                    WHERE story_title = ?
                    GROUP BY user_id, username
                    ORDER BY endings_completed DESC 
                    LIMIT ?
                `;
                params = [storyTitle, limit];
            } else {
                query = `
                    SELECT user_id, username, COUNT(ending_id) as endings_completed
                    FROM story_progress 
                    GROUP BY user_id, username
                    ORDER BY endings_completed DESC 
                    LIMIT ?
                `;
                params = [limit];
            }

            return await this.all(query, params);
        } catch (error) {
            console.error('Failed to get story leaderboard:', error.message);
            return [];
        }
    }

    async getStoryDetailedStats(storyTitle = null) {
        try {
            let query = '';
            let params = [];

            if (storyTitle) {
                query = `
                    SELECT 
                        story_title,
                        COUNT(DISTINCT user_id) as unique_players,
                        COUNT(ending_id) as total_completions,
                        COUNT(DISTINCT ending_id) as unique_endings_completed
                    FROM story_progress 
                    WHERE story_title = ?
                    GROUP BY story_title
                `;
                params = [storyTitle];
            } else {
                query = `
                    SELECT 
                        story_title,
                        COUNT(DISTINCT user_id) as unique_players,
                        COUNT(ending_id) as total_completions,
                        COUNT(DISTINCT ending_id) as unique_endings_completed
                    FROM story_progress 
                    GROUP BY story_title
                    ORDER BY total_completions DESC
                `;
            }

            return await this.all(query, params);
        } catch (error) {
            console.error('Failed to get story detailed stats:', error.message);
            return [];
        }
    }

    async hasUserCompletedEnding(userId, storyTitle, endingId) {
        try {
            const result = await this.get(
                'SELECT COUNT(*) as count FROM story_progress WHERE user_id = ? AND story_title = ? AND ending_id = ?',
                [userId, storyTitle, endingId]
            );
            return result.count > 0;
        } catch (error) {
            console.error('Failed to check user ending completion:', error.message);
            return false;
        }
    }

    async getUserCompletedEndings(userId, storyTitle) {
        try {
            return await this.all(
                'SELECT ending_id, completed_at FROM story_progress WHERE user_id = ? AND story_title = ? ORDER BY completed_at',
                [userId, storyTitle]
            );
        } catch (error) {
            console.error('Failed to get user completed endings:', error.message);
            return [];
        }
    }

    // ===== دوال إضافية للمساعدة =====
    async getBotSetting(settingKey) {
        try {
            return await this.get('SELECT * FROM bot_settings WHERE setting_key = ?', [settingKey]);
        } catch (error) {
            console.error('⚠️ Failed to get bot setting:', error.message);
            return null;
        }
    }

    async setBotSetting(settingKey, settingValue, guildId, updatedBy) {
        try {
            await this.run(
                `INSERT INTO bot_settings (setting_key, setting_value, guild_id, updated_by) 
                 VALUES (?, ?, ?, ?) 
                 ON CONFLICT (setting_key) 
                 DO UPDATE SET setting_value = ?, guild_id = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP`,
                [settingKey, settingValue, guildId, updatedBy, settingValue, guildId, updatedBy]
            );
            return true;
        } catch (error) {
            console.error('⚠️ Failed to set bot setting:', error.message);
            return false;
        }
    }

    // ===== دوال خاصة بالشوب (مصححة للتكامل مع النظام الجديد) =====

    // 1. إضافة منتج جديد (للأدمن) - مصححة
    async addShopItem(data) {
        try {
            const {
                role_id, 
                item_emoji = '🎮',
                original_price_coins = 0,  // تغيير من price_coins إلى original_price_coins
                original_price_crystals = 0, // تغيير من price_crystals إلى original_price_crystals
                quantity = 1, 
                description = null,
                created_by
            } = data;

            console.log('📦 Adding shop item with data:', data);

            // استخدم RETURNING للحصول على العنصر المضاف
            const result = await this.run(
                `INSERT INTO shop_items 
                (role_id, item_emoji, original_price_coins, original_price_crystals, 
                 quantity, description, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [role_id, item_emoji, original_price_coins, original_price_crystals,
                 quantity, description, created_by]
            );

            // جلب العنصر المضاف حديثاً
            const addedItem = await this.get(
                'SELECT * FROM shop_items WHERE role_id = ? ORDER BY created_at DESC LIMIT 1',
                [role_id]
            );

            return { 
                success: true, 
                item: addedItem,
                id: addedItem ? addedItem.id : null
            };
        } catch (error) {
            console.error('❌ Failed to add shop item:', error.message);
            console.error('❌ Full error:', error);
            return { 
                success: false, 
                error: error.message.includes('unique') 
                    ? 'This role is already in the shop!' 
                    : error.message 
            };
        }
    }

    // 2. جلب كل منتجات الشوب (المنشطة فقط)
    async getActiveShopItems() {
        try {
            // ترتيب حسب مجموع السعرين (coins + crystals) من الأعلى للأقل
            const items = await this.all(
                'SELECT * FROM shop_items ORDER BY (original_price_coins + original_price_crystals) DESC'
            );
            console.log(`📋 Found ${items.length} shop items sorted by highest price`);
            return items || [];
        } catch (error) {
            console.error('❌ Failed to get shop items:', error.message);
            return [];
        }
    }

    // 3. جلب منتج بواسطة role_id
    async getShopItemByRoleId(roleId) {
        try {
            return await this.get(
                'SELECT * FROM shop_items WHERE role_id = ?', // إزالة شرط is_active
                [roleId]
            );
        } catch (error) {
            console.error('❌ Failed to get shop item by role id:', error.message);
            return null;
        }
    }

    // 4. جلب منتج بواسطة ID (استخدم هذه الدالة في edit)
    async getShopItemById(itemId) {
        try {
            const item = await this.get(
                'SELECT * FROM shop_items WHERE id = ?',
                [itemId]
            );
            console.log(`🔍 Get shop item by id ${itemId}:`, item ? 'Found' : 'Not found');
            return item;
        } catch (error) {
            console.error('❌ Failed to get shop item by id:', error.message);
            return null;
        }
    }

    // 5. تحديث منتج (للأدمن) - مصححة للتكامل مع النظام الجديد
    async updateShopItem(itemId, updates) {
        try {
            console.log(`✏️ Updating shop item ${itemId} with:`, updates);

            // ⭐⭐ تحديث allowedFields ليشمل Buffs ⭐⭐
            const allowedFields = [
                'item_emoji',
                'original_price_coins',
                'original_price_crystals',
                'discount_chance',
                'current_discount',
                'discounted_price_coins',
                'discounted_price_crystals',
                'is_on_sale',
                'quantity',
                'description',
                'buff_type',           // ⭐⭐ أضف هذا ⭐⭐
                'buff_duration_minutes' // ⭐⭐ أضف هذا ⭐⭐
            ];

            let setClause = '';
            const params = [];

            for (const [key, value] of Object.entries(updates)) {
                // ⭐⭐ معالجة خاصة لـ buff_type يمكن تكون null ⭐⭐
                if (allowedFields.includes(key) && value !== undefined) {
                    if (setClause) setClause += ', ';
                    setClause += `${key} = ?`;

                    // ⭐⭐ تحويل buff_type من 'none' إلى null ⭐⭐
                    if (key === 'buff_type' && (value === 'none' || value === null || value === '')) {
                        params.push(null);
                    } else {
                        params.push(value);
                    }
                }
            }

            if (!setClause) {
                return { success: false, error: 'No valid fields to update' };
            }

            setClause += ', updated_at = CURRENT_TIMESTAMP';
            params.push(itemId);

            // ⭐⭐ طباعة الـ query للتأكد ⭐⭐
            console.log('📝 SQL Query:', `UPDATE shop_items SET ${setClause} WHERE id = ?`);
            console.log('📝 Parameters:', params);

            await this.run(
                `UPDATE shop_items SET ${setClause} WHERE id = ?`,
                params
            );

            // جلب العنصر المحدث
            const updatedItem = await this.getShopItemById(itemId);

            return { 
                success: true, 
                item: updatedItem
            };
        } catch (error) {
            console.error('❌ Failed to update shop item:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 6. حذف منتج (حذف فعلي من الداتابيز) - كما هي
    async deleteShopItem(itemId) {
        try {
            console.log(`🗑️ Deleting shop item ${itemId} from database`);

            // استخدم DELETE مباشرة بدل UPDATE
            const sql = 'DELETE FROM shop_items WHERE id = $1';
            const params = [itemId];

            const client = await this.pool.connect();
            try {
                const result = await client.query(sql, params);

                console.log(`🗑️ Delete query executed. Rows affected: ${result.rowCount}`);

                return { 
                    success: true, 
                    deleted: result.rowCount > 0,
                    affectedRows: result.rowCount
                };
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('❌ Failed to delete shop item:', error.message);
            console.error('❌ Full error:', error);
            return { success: false, error: error.message };
        }
    }

    // 7. جلب عدد المنتجات النشطة
    async getActiveShopItemsCount() {
        try {
            // البحث في كل العناصر بدون شرط is_active
            const result = await this.get(
                'SELECT COUNT(*) as count FROM shop_items' // إزالة شرط WHERE is_active = true
            );
            return result ? result.count : 0;
        } catch (error) {
            console.error('❌ Failed to get shop items count:', error.message);
            return 0;
        }
    }

    // 8. دالة مساعدة: تطبيق التخفيض على منتج (للاستخدام في اليانصيب)
    async applyDiscountToItem(itemId, discountPercentage) {
        try {
            const item = await this.getShopItemById(itemId);
            if (!item) return false;

            const discountedCoins = Math.floor(item.original_price_coins * (1 - discountPercentage/100));
            const discountedCrystals = Math.floor(item.original_price_crystals * (1 - discountPercentage/100));

            await this.run(
                `UPDATE shop_items 
                 SET current_discount = ?,
                     discounted_price_coins = ?,
                     discounted_price_crystals = ?,
                     is_on_sale = true,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [discountPercentage, discountedCoins, discountedCrystals, itemId]
            );

            console.log(`✅ Applied ${discountPercentage}% discount to item ${itemId}`);
            return true;

        } catch (error) {
            console.error('❌ Error applying discount:', error);
            return false;
        }
    }

    // 9. دالة مساعدة: إعادة تعيين كل التخفيضات
    async resetAllDiscounts() {
        try {
            const result = await this.run(
                `UPDATE shop_items 
                 SET current_discount = 0,
                     discounted_price_coins = 0,
                     discounted_price_crystals = 0,
                     is_on_sale = false,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE is_on_sale = true`
            );

            console.log(`🔄 Reset ${result.changes} active discounts`);
            return { success: true, resetCount: result.changes };
        } catch (error) {
            console.error('❌ Error resetting all discounts:', error);
            return { success: false, error: error.message };
        }
    }

    // 10. دالة مساعدة: جلب المنتجات المخفضة حالياً
    async getDiscountedItems() {
        try {
            return await this.all(
                `SELECT * FROM shop_items 
                 WHERE is_on_sale = true 
                 AND current_discount > 0
                 ORDER BY current_discount DESC`
            );
        } catch (error) {
            console.error('❌ Error getting discounted items:', error);
            return [];
        }
    }

    // ===== دوال خاصة بنظام اللفلات =====
    // دوال daily الأساسية في DatabaseManager
    async getUserProfile(userId) {
        try {
            return await this.get(
                `SELECT * FROM levels WHERE user_id = ?`,
                [userId]
            );
        } catch (error) {
            console.error('❌ Failed to get user profile:', error.message);
            return null;
        }
    }

    async canClaimDaily(userId) {
        try {
            const user = await this.get(
                'SELECT last_daily FROM levels WHERE user_id = ?',
                [userId]
            );

            if (!user || !user.last_daily) {
                return { canClaim: true, nextClaim: null };
            }

            const lastClaim = new Date(user.last_daily);
            const now = new Date();
            const hoursDiff = (now - lastClaim) / (1000 * 60 * 60);

            // 24-hour cooldown
            if (hoursDiff < 24) {
                const nextClaim = new Date(lastClaim.getTime() + (24 * 60 * 60 * 1000));
                return { 
                    canClaim: false, 
                    nextClaim: nextClaim.toISOString(),
                    hoursRemaining: (24 - hoursDiff).toFixed(2)
                };
            }

            return { canClaim: true, nextClaim: null };
        } catch (error) {
            console.error('❌ Failed to check daily claim:', error.message);
            return { canClaim: false, nextClaim: null, error: error.message };
        }
    }

    async claimDailyFirstTime(userId, username) {
        try {
            // Ensure user exists
            await this.ensureUserExists(userId, username);

            // Generate first time rewards
            const baseCoins = Math.floor(Math.random() * 3) + 15; // 15-17
            const xp = Math.floor(Math.random() * 21) + 20; // 20-40

            await this.run(
                `UPDATE levels 
                 SET sky_coins = sky_coins + ?,
                     xp = xp + ?,
                     last_daily = CURRENT_TIMESTAMP,
                     daily_streak = 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,
                [baseCoins, xp, userId]
            );

            return {
                success: true,
                rewards: {
                    coins: baseCoins,
                    xp: xp,
                    streak: 1
                }
            };
        } catch (error) {
            console.error('❌ Failed to claim first daily:', error.message);
            return { success: false, error: error.message };
        }
    }

    async calculateDailyStreak(userId, lastDaily) {
        try {
            if (!lastDaily) {
                return { newStreak: 1, streakMaintained: true };
            }

            const lastClaim = new Date(lastDaily);
            const now = new Date();
            const hoursDiff = (now - lastClaim) / (1000 * 60 * 60);

            // Get current streak
            const user = await this.get(
                'SELECT daily_streak FROM levels WHERE user_id = ?',
                [userId]
            );

            let currentStreak = user?.daily_streak || 0;

            // Check streak maintenance
            if (hoursDiff > 28) { // More than 28 hours = streak broken
                return { newStreak: 1, streakMaintained: false };
            } else if (hoursDiff >= 24 && hoursDiff <= 28) {
                // Within claim window (24-28 hours)
                return { newStreak: currentStreak + 1, streakMaintained: true };
            }

            return { newStreak: currentStreak, streakMaintained: false };
        } catch (error) {
            console.error('❌ Failed to calculate daily streak:', error.message);
            return { newStreak: 1, streakMaintained: false };
        }
    }

    async updateDailyRewards(userId, coins, xp, crystals = 0, newStreak) {
        try {
            // Calculate new level based on XP
            const user = await this.get('SELECT xp FROM levels WHERE user_id = ?', [userId]);
            const currentXP = (user?.xp || 0) + xp;
            const newLevel = Math.floor(Math.sqrt(currentXP / 100)) + 1;

            await this.run(
                `UPDATE levels 
                 SET sky_coins = sky_coins + ?,
                     sky_crystals = sky_crystals + ?,
                     xp = xp + ?,
                     level = ?,
                     last_daily = CURRENT_TIMESTAMP,
                     daily_streak = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,
                [coins, crystals, xp, newLevel, newStreak, userId]
            );

            return true;
        } catch (error) {
            console.error('❌ Failed to update daily rewards:', error.message);
            return false;
        }
    }

    async ensureUserExists(userId, username) {
        try {
            const existing = await this.get(
                'SELECT * FROM levels WHERE user_id = ?',
                [userId]
            );

            if (!existing) {
                await this.run(
                    'INSERT INTO levels (user_id, username) VALUES (?, ?)',
                    [userId, username]
                );
                return { created: true };
            }

            // Update username if changed
            if (existing.username !== username) {
                await this.run(
                    'UPDATE levels SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
                    [username, userId]
                );
            }

            return { created: false, user: existing };
        } catch (error) {
            console.error('❌ Failed to ensure user exists:', error.message);
            return { created: false, error: error.message };
        }
    }

    // Weekly reward functions for DatabaseManager.js

    async canClaimWeekly(userId) {
        try {
            const user = await this.get(
                'SELECT last_weekly FROM levels WHERE user_id = ?',
                [userId]
            );

            if (!user || !user.last_weekly) {
                return { canClaim: true, nextClaim: null };
            }

            const lastClaim = new Date(user.last_weekly);
            const now = new Date();
            const daysDiff = (now - lastClaim) / (1000 * 60 * 60 * 24);

            // 7-day cooldown
            if (daysDiff < 7) {
                const nextClaim = new Date(lastClaim.getTime() + (7 * 24 * 60 * 60 * 1000));
                return { 
                    canClaim: false, 
                    nextClaim: nextClaim.toISOString(),
                    daysRemaining: (7 - daysDiff).toFixed(2)
                };
            }

            return { canClaim: true, nextClaim: null };
        } catch (error) {
            console.error('❌ Failed to check weekly claim:', error.message);
            return { canClaim: false, nextClaim: null, error: error.message };
        }
    }

    async claimWeeklyFirstTime(userId, username) {
        try {
            // Ensure user exists
            await this.ensureUserExists(userId, username);

            // Generate first time rewards
            const baseCoins = Math.floor(Math.random() * 16) + 80; // 80-95
            const xp = Math.floor(Math.random() * 31) + 40; // 40-70

            // Crystal chance for first time
            let crystals = 0;
            if (Math.random() * 100 < 20) {
                crystals = Math.random() < 0.65 ? 1 : 2;
            }

            await this.run(
                `UPDATE levels 
                 SET sky_coins = sky_coins + ?,
                     sky_crystals = sky_crystals + ?,
                     xp = xp + ?,
                     last_weekly = CURRENT_TIMESTAMP,
                     weekly_streak = 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,
                [baseCoins, crystals, xp, userId]
            );

            return {
                success: true,
                rewards: {
                    coins: baseCoins,
                    xp: xp,
                    crystals: crystals,
                    streak: 1
                }
            };
        } catch (error) {
            console.error('❌ Failed to claim first weekly:', error.message);
            return { success: false, error: error.message };
        }
    }

    async calculateWeeklyStreak(userId, lastWeekly) {
        try {
            if (!lastWeekly) {
                return { newStreak: 1, streakMaintained: true };
            }

            const lastClaim = new Date(lastWeekly);
            const now = new Date();
            const daysDiff = (now - lastClaim) / (1000 * 60 * 60 * 24);

            // Get current streak
            const user = await this.get(
                'SELECT weekly_streak FROM levels WHERE user_id = ?',
                [userId]
            );

            let currentStreak = user?.weekly_streak || 0;

            // Check streak maintenance (7-10 days window)
            if (daysDiff > 10) { // More than 10 days = streak broken
                return { newStreak: 1, streakMaintained: false };
            } else if (daysDiff >= 7 && daysDiff <= 10) {
                // Within claim window (7-10 days)
                return { newStreak: currentStreak + 1, streakMaintained: true };
            }

            return { newStreak: currentStreak, streakMaintained: false };
        } catch (error) {
            console.error('❌ Failed to calculate weekly streak:', error.message);
            return { newStreak: 1, streakMaintained: false };
        }
    }

    async updateWeeklyRewards(userId, coins, xp, crystals = 0, newStreak) {
        try {
            // Calculate new level based on XP
            const user = await this.get('SELECT xp FROM levels WHERE user_id = ?', [userId]);
            const currentXP = (user?.xp || 0) + xp;
            const newLevel = Math.floor(Math.sqrt(currentXP / 100)) + 1;

            await this.run(
                `UPDATE levels 
                 SET sky_coins = sky_coins + ?,
                     sky_crystals = sky_crystals + ?,
                     xp = xp + ?,
                     level = ?,
                     last_weekly = CURRENT_TIMESTAMP,
                     weekly_streak = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,
                [coins, crystals, xp, newLevel, newStreak, userId]
            );

            return true;
        } catch (error) {
            console.error('❌ Failed to update weekly rewards:', error.message);
            return false;
        }
    }

    async getWeeklyStats(userId) {
        try {
            const user = await this.get(
                `SELECT 
                    weekly_streak,
                    last_weekly,
                    sky_coins,
                    sky_crystals,
                    xp,
                    level
                 FROM levels 
                 WHERE user_id = ?`,
                [userId]
            );

            if (!user) return null;

            let nextClaim = null;
            let canClaim = true;

            if (user.last_weekly) {
                const lastClaim = new Date(user.last_weekly);
                const now = new Date();
                const daysDiff = (now - lastClaim) / (1000 * 60 * 60 * 24);

                if (daysDiff < 7) {
                    canClaim = false;
                    nextClaim = new Date(lastClaim.getTime() + (7 * 24 * 60 * 60 * 1000));
                }
            }

            // Calculate streak bonuses
            const streakBonus = Math.min(user.weekly_streak, 3);
            const coinBonus = streakBonus * 5;
            const crystalBonus = streakBonus * 2;

            return {
                streak: user.weekly_streak,
                coinBonus: `${coinBonus}%`,
                crystalBonus: `${crystalBonus}%`,
                canClaim,
                nextClaim,
                lastClaim: user.last_weekly,
                totalCoins: user.sky_coins,
                totalCrystals: user.sky_crystals
            };
        } catch (error) {
            console.error('❌ Failed to get weekly stats:', error.message);
            return null;
        }
    }

    // ========== Drop System - User Drop Progress ==========

    /**
     * 1.1 إنشاء أو جلب تقدم المستخدم
     */
    async getUserDropProgress(userId, username = null) {
        try {
            let user = await this.get(
                'SELECT * FROM user_drop_progress WHERE user_id = ?',
                [userId]
            );

            if (!user && username) {
                user = await this.createUserDropProgress(userId, username);
            }

            return user;
        } catch (error) {
            console.error('❌ Failed to get user drop progress:', error.message);
            return null;
        }
    }

    /**
     * 1.2 إنشاء تقدم جديد (مع أرقام عشوائية مختلفة)
     */
    async createUserDropProgress(userId, username) {
        try {
            // توليد أرقام عشوائية أولية مختلفة لكل drop
            const commonTarget = this.generateRandomDropTarget('common');
            const rareTarget = this.generateRandomDropTarget('rare');
            const epicTarget = this.generateRandomDropTarget('epic');
            const legendaryTarget = this.generateRandomDropTarget('legendary');

            await this.run(
                `INSERT INTO user_drop_progress 
                (user_id, username, common_target, rare_target, epic_target, legendary_target) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, username, commonTarget, rareTarget, epicTarget, legendaryTarget]
            );

            console.log(`📝 Created drop progress for ${username}: C=${commonTarget}, R=${rareTarget}, E=${epicTarget}, L=${legendaryTarget}`);

            return await this.getUserDropProgress(userId);
        } catch (error) {
            console.error('❌ Failed to create user drop progress:', error.message);
            return null;
        }
    }

    /**
     * توليد رقم عشوائي لـ drop type معين
     */
    generateRandomDropTarget(dropType) {
        const ranges = {
            'common': { min: 100, max: 150 },
            'rare': { min: 250, max: 300 },
            'epic': { min: 350, max: 500 },
            'legendary': { min: 550, max: 800 }
        };

        const range = ranges[dropType];
        if (!range) return 0;

        return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    }

    /**
     * 1.3 زيادة عدد الرسائل والتحقق من الـ Drops
     */
    async incrementUserMessages(userId, username) {
        try {
            // تأكد من وجود المستخدم
            await this.getUserDropProgress(userId, username);

            await this.run(
                `UPDATE user_drop_progress 
                 SET total_messages = total_messages + 1,
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = ?`,
                [userId]
            );

            // التحقق من الـ Drops المتاحة بعد زيادة الرسائل
            const availableDrops = await this.checkAvailableDrops(userId);

            const user = await this.getUserDropProgress(userId);

            return {
                user: user,
                availableDrops: availableDrops,
                messageCount: user.total_messages
            };
        } catch (error) {
            console.error('❌ Failed to increment user messages:', error.message);
            return null;
        }
    }

    /**
     * 1.4 تحديث target بعد الـ drop (رقم عشوائي جديد مختلف)
     */
    async updateDropTarget(userId, dropType) {
        try {
            const config = await this.getDropConfig(dropType);
            if (!config) return false;

            // توليد رقم عشوائي جديد مختلف تمامًا
            const newTarget = this.generateRandomDropTarget(dropType);

            const updateField = `${dropType}_target`;
            const countField = `total_${dropType}_received`;
            const lastField = `last_${dropType}_at`;

            const user = await this.getUserDropProgress(userId);
            if (!user) return false;

            // الحصول على العدد الحالي للرسائل
            const currentMessages = user.total_messages;

            // الـ target الجديد = الرسائل الحالية + الرقم العشوائي الجديد
            const nextTarget = currentMessages + newTarget;

            await this.run(
                `UPDATE user_drop_progress 
                 SET ${updateField} = ?,
                     ${countField} = ${countField} + 1,
                     ${lastField} = ?,
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = ?`,
                [nextTarget, currentMessages, userId]
            );

            console.log(`🎯 Updated ${dropType} target for ${userId}: new target = ${nextTarget} (${newTarget} messages from now)`);

            return true;
        } catch (error) {
            console.error(`❌ Failed to update ${dropType} target:`, error.message);
            return false;
        }
    }

    /**
     * التحقق من الـ Drops المتاحة
     */
    async checkAvailableDrops(userId) {
        try {
            const user = await this.getUserDropProgress(userId);
            if (!user) return [];

            const drops = [];
            const dropTypes = ['common', 'rare', 'epic', 'legendary'];

            for (const dropType of dropTypes) {
                const targetField = `${dropType}_target`;
                const lastField = `last_${dropType}_at`;

                // تحقق إذا وصل لـ target ولم يأخذ الـ drop بعد
                if (user.total_messages >= user[targetField] && user[lastField] !== user.total_messages) {
                    drops.push({
                        type: dropType,
                        messages: user.total_messages,
                        target: user[targetField],
                        description: `${dropType.charAt(0).toUpperCase() + dropType.slice(1)} Drop`
                    });
                }
            }

            return drops;
        } catch (error) {
            console.error('❌ Failed to check available drops:', error.message);
            return [];
        }
    }

    // ========== Drop System - User Crates ==========

    /**
     * 2.1 إنشاء crate جديدة مع مكافأة عشوائية + معالجة الكوبونات
     */
    async createCrate(userId, username, crateType) {
        try {
            console.log(`🎮 Creating ${crateType} crate for ${username} (${userId})`);

            const rewardData = await this.getRandomCrateReward(crateType);
            if (!rewardData) {
                return { success: false, error: 'Failed to generate reward' };
            }

            console.log(`📊 Reward data for ${crateType}:`, rewardData);

            // ⭐⭐ ⭐⭐ ⭐⭐ التعديل هنا: نضيف column جديد ⭐⭐ ⭐⭐ ⭐⭐
            // بدل ما نخزن الكوبون، نخزن معلوماته فقط في الـ crate
            let couponDiscount = null;
            let couponInfo = null;

            if (rewardData.reward_type === 'coupon') {
                console.log(`🎫 COUPON DETECTED in ${crateType} crate! (NOT SAVED YET)`);

                // ⭐⭐ ⭐⭐ ⭐⭐ هنا ما نحفظش في shop_coupons ⭐⭐ ⭐⭐ ⭐⭐
                // بدل كده نخزن المعلومات في الـ crate نفسه

                const dropConfig = await this.getDropConfig(crateType);
                if (dropConfig && dropConfig.rewards_config) {
                    try {
                        let rewards;
                        if (typeof dropConfig.rewards_config === 'string') {
                            rewards = JSON.parse(dropConfig.rewards_config);
                        } else {
                            rewards = dropConfig.rewards_config;
                        }

                        const couponReward = rewards.find(r => r.reward_type === 'coupon');

                        if (couponReward) {
                            // توليد نسبة تخفيض (لكن ما نحفظش في shop_coupons)
                            couponDiscount = Math.floor(Math.random() * 
                                (couponReward.max_discount - couponReward.min_discount + 1)) + 
                                couponReward.min_discount;

                            couponInfo = {
                                discount: couponDiscount,
                                min: couponReward.min_discount,
                                max: couponReward.max_discount,
                                type: 'pending'  // ⭐⭐ لسه مش متخزن ⭐⭐
                            };

                            console.log(`🎯 Coupon prepared (NOT SAVED): ${couponDiscount}% discount`);
                        }
                    } catch (parseError) {
                        console.error(`❌ Error parsing rewards config:`, parseError.message);
                    }
                }
            }

            // ⭐⭐ ⭐⭐ ⭐⭐ نخزن معلومات الكوبون في column جديد ⭐⭐ ⭐⭐ ⭐⭐
            // لكن لازم تعدل جدول user_crates أولاً!
            const result = await this.run(
                `INSERT INTO user_crates 
                (user_id, username, crate_type, reward_type, 
                 coins_amount, xp_amount, crystals_amount,
                 buff_type, buff_duration_minutes,
                 coupon_discount, coupon_info)  -- ⭐⭐ ⭐⭐ ⭐⭐ أضف هذه ⭐⭐ ⭐⭐ ⭐⭐
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
                [
                    userId, username, crateType, rewardData.reward_type,
                    rewardData.coins || 0, rewardData.xp || 0, rewardData.crystals || 0,
                    rewardData.buff_type || null, rewardData.buff_duration || null,
                    couponDiscount,  // ⭐⭐ تخزين نسبة الخصم
                    couponInfo ? JSON.stringify(couponInfo) : null  // ⭐⭐ تخزين المعلومات
                ]
            );

            if (result && result.id) {
                await this.run(
                    `UPDATE user_drop_progress 
                     SET total_${crateType}_received = total_${crateType}_received + 1
                     WHERE user_id = ?`,
                    [userId]
                );
            }

            const crateId = result.id;
            console.log(`📦 Created ${crateType} crate ID: ${crateId}`);

            return { 
                success: true, 
                crateId: crateId,
                crateData: {
                    type: crateType,
                    reward: rewardData,
                    has_pending_coupon: !!couponDiscount  // ⭐⭐ إشعار أن فيه كوبون pending
                }
            };

        } catch (error) {
            console.error('❌ Failed to create crate:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * دالة مساعدة لحفظ الكوبون فقط
     */
    async saveCouponToDatabase(couponResult, userId, username, crateType, crateId) {
        try {
            if (!couponResult || !couponResult.success) {
                return false;
            }

            // التحقق من التكرار
            const existingCoupon = await this.get(
                'SELECT coupon_code FROM shop_coupons WHERE coupon_code = ?',
                [couponResult.couponCode]
            );

            if (existingCoupon) {
                console.log(`⚠️ Coupon code exists, skipping save`);
                return false;
            }

            // حفظ بسيط
            await this.run(
                `INSERT INTO shop_coupons 
                 (coupon_code, user_id, username, discount_percentage, 
                  expires_at, source_drop_type, source_crate_id, is_used) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, false)`,
                [
                    couponResult.couponCode,
                    userId,
                    username,
                    couponResult.discountPercentage,
                    couponResult.expiresAt,
                    crateType,
                    crateId
                ]
            );

            console.log(`💾 Coupon saved: ${couponResult.couponCode}`);
            return true;

        } catch (error) {
            console.error('❌ Error saving coupon:', error.message);
            return false;
        }
    }

    /**
     * توليد مكافأة عشوائية للـ crate
     */
    async getRandomCrateReward(crateType) {
        try {
            const config = await this.getDropConfig(crateType);
            if (!config || !config.rewards_config) return null;

            const rewards = config.rewards_config;
            const random = Math.random();
            let cumulativeChance = 0;

            for (const reward of rewards) {
                cumulativeChance += reward.chance;
                if (random <= cumulativeChance) {
                    const result = { reward_type: reward.reward_type };

                    // توليد قيم عشوائية بناءً على المدى
                    if (reward.min_coins !== undefined && reward.max_coins !== undefined) {
                        result.coins = this.getRandomValue(reward.min_coins, reward.max_coins);
                    }

                    if (reward.min_xp !== undefined && reward.max_xp !== undefined) {
                        result.xp = this.getRandomValue(reward.min_xp, reward.max_xp);
                    }

                    if (reward.min_crystals !== undefined && reward.max_crystals !== undefined) {
                        result.crystals = this.getRandomValue(reward.min_crystals, reward.max_crystals);
                    }

                    if (reward.buff_type) {
                        result.buff_type = reward.buff_type;
                        result.buff_duration = reward.buff_duration;
                    }

                    return result;
                }
            }

            return rewards[0] ? { reward_type: rewards[0].reward_type } : null;
        } catch (error) {
            console.error('❌ Failed to get random crate reward:', error.message);
            return null;
        }
    }

    /**
     * توليد قيمة عشوائية بين min و max
     */
    getRandomValue(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * 2.2 جلب صناديق المستخدم (محسنة)
     */
    async getUserCrates(userId, options = {}) {
        try {
            const { 
                crateType = null, 
                unusedOnly = true,
                limit = 50,
                offset = 0 
            } = options;

            let query = 'SELECT * FROM user_crates WHERE user_id = ?';
            const params = [userId];

            if (unusedOnly) {
                query += ' AND is_used = false';
            }

            if (crateType) {
                query += ' AND crate_type = ?';
                params.push(crateType);
            }

            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const crates = await this.all(query, params);

            // حساب إحصائيات إضافية
            const stats = {
                total: crates.length,
                byType: {},
                unused: 0
            };

            for (const crate of crates) {
                if (!crate.is_used) {
                    stats.unused++;
                }

                if (!stats.byType[crate.crate_type]) {
                    stats.byType[crate.crate_type] = {
                        total: 0,
                        unused: 0
                    };
                }

                stats.byType[crate.crate_type].total++;
                if (!crate.is_used) {
                    stats.byType[crate.crate_type].unused++;
                }
            }

            return {
                crates: crates,
                stats: stats
            };
        } catch (error) {
            console.error('❌ Failed to get user crates:', error.message);
            return { crates: [], stats: { total: 0, unused: 0, byType: {} } };
        }
    }

    /**
     * 2.3 فتح crate (مع دعم الكوبونات)
     */
    async openCrate(crateId, userId) {
        try {
            const crate = await this.get(
                'SELECT * FROM user_crates WHERE id = ? AND user_id = ?',
                [crateId, userId]
            );

            if (!crate) return { success: false, error: 'Crate not found' };
            if (crate.is_used) return { success: false, error: 'Crate already opened' };

            // 🔍 التحقق البسيط عن الكوبون
            let couponData = null;
            if (crate.reward_type === 'coupon') {
                couponData = await this.get(
                    `SELECT * FROM shop_coupons 
                     WHERE source_crate_id = ? AND user_id = ?`,
                    [crateId, userId]
                );
            }

            // تحديث حالة الصندوق
            await this.run(
                `DELETE FROM user_crates WHERE id = ?`,
                [crateId]
            );

            // النتيجة البسيطة
            const result = {
                success: true,
                crate: {
                    id: crate.id,
                    type: crate.crate_type,
                    reward_type: crate.reward_type,
                    rewards: {
                        coins: crate.coins_amount || 0,
                        xp: crate.xp_amount || 0,
                        crystals: crate.crystals_amount || 0
                    }
                }
            };

            // إضافة الكوبون لو موجود
            if (couponData) {
                result.coupon = {
                    code: couponData.coupon_code,
                    discount: couponData.discount_percentage
                };
            }

            console.log(`🎁 Crate opened: ${crateId}, has coupon: ${!!couponData}`);

            return result;

        } catch (error) {
            console.error('❌ Failed to open crate:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * توليد رقم عشوائي بين قيمتين
     */
    getRandomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * جلب كل الكوبونات المرتبطة بـ crate معين
     */
    async getCouponsByCrateId(crateId) {
        try {
            return await this.all(
                'SELECT * FROM shop_coupons WHERE source_crate_id = ?',
                [crateId]
            );
        } catch (error) {
            console.error('❌ Error getting coupons by crate id:', error);
            return [];
        }
    }

    // ========== Drop System - Active Buffs ==========

    /**
     * 3.1 إضافة buff نشط مع التحقق من التكرار
     */
    async addActiveBuff(userId, buffType, durationMinutes, sourceCrateType, sourceCrateId, client = null, guildId = null, roleId = null) {
        try {
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

            const existingBuff = await this.get(
                'SELECT * FROM active_buffs WHERE user_id = ? AND buff_type = ?',
                [userId, buffType]
            );

            let finalDuration = durationMinutes;

            if (existingBuff) {
                const existingExpires = new Date(existingBuff.expires_at);
                const newExpiresAt = expiresAt > existingExpires ? expiresAt : existingExpires;
                finalDuration = Math.floor((newExpiresAt - new Date()) / (1000 * 60));

                await this.run(
                    `UPDATE active_buffs 
                     SET duration_minutes = ?,
                         expires_at = ?,
                         role_id = COALESCE(role_id, ?),
                         source_crate_type = COALESCE(?, source_crate_type),
                         source_crate_id = COALESCE(?, source_crate_id),
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = ? AND buff_type = ?`,
                    [finalDuration, newExpiresAt, roleId, sourceCrateType, sourceCrateId, userId, buffType]
                );

                console.log(`🔄 Extended ${buffType} buff for ${userId}: ${finalDuration} minutes`);

                if (client && guildId && roleId) {
                    const msUntilExpiry = finalDuration * 60 * 1000;

                    setTimeout(async () => {
                        try {
                            const guild = client.guilds.cache.get(guildId);
                            const member = await guild?.members.fetch(userId).catch(() => null);
                            if (!member) return;

                            if (member.roles.cache.has(roleId)) {
                                await member.roles.remove(roleId);
                                console.log(`🔴 Removed ${buffType} role from ${userId} after extension`);
                            }
                        } catch (err) {
                            console.error(`❌ Error removing role after timeout:`, err.message);
                        }
                    }, msUntilExpiry);

                    console.log(`⏰ Re-scheduled role removal for ${userId} in ${finalDuration} minutes`);
                }

            } else {
                // ✅ الـ INSERT بيشمل role_id دلوقتي
                await this.run(
                    `INSERT INTO active_buffs 
                    (user_id, buff_type, duration_minutes, expires_at, role_id, source_crate_type, source_crate_id) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [userId, buffType, durationMinutes, expiresAt, roleId, sourceCrateType, sourceCrateId]
                );

                console.log(`✨ Added ${buffType} buff for ${userId}: ${durationMinutes} minutes | Role: ${roleId}`);

                if (client && guildId && roleId) {
                    const msUntilExpiry = finalDuration * 60 * 1000;

                    setTimeout(async () => {
                        try {
                            const guild = client.guilds.cache.get(guildId);
                            const member = await guild?.members.fetch(userId).catch(() => null);
                            if (!member) return;

                            if (member.roles.cache.has(roleId)) {
                                await member.roles.remove(roleId);
                                console.log(`🔴 Removed ${buffType} role from ${userId} after ${finalDuration} minutes`);
                            }
                        } catch (err) {
                            console.error(`❌ Error removing role after timeout:`, err.message);
                        }
                    }, msUntilExpiry);

                    console.log(`⏰ Scheduled role removal for ${userId} in ${finalDuration} minutes`);
                }
            }

            return { success: true };

        } catch (error) {
            console.error('❌ Failed to add active buff:', error.message);
            return { success: false };
        }
    }

    /**
     * 3.2 جلب buffs نشطة للمستخدم مع الوقت المتبقي
     */
    async getUserActiveBuffs(userId) {
        try {
            const buffs = await this.all(
                `SELECT *, 
                        EXTRACT(EPOCH FROM (expires_at - NOW())) / 60 as minutes_remaining,
                        EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_remaining
                 FROM active_buffs 
                 WHERE user_id = ? AND expires_at > NOW() 
                 ORDER BY expires_at ASC`,
                [userId]
            );

            const formattedBuffs = buffs.map(buff => {
                const totalMinutes = Math.max(0, Math.floor(buff.minutes_remaining));
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                const seconds = Math.floor(buff.seconds_remaining % 60);

                let timeRemaining = '';
                if (hours > 0) timeRemaining += `${hours} ساعة `;
                if (minutes > 0 || hours === 0) timeRemaining += `${minutes} دقيقة `;
                if (seconds > 0 && totalMinutes < 1) timeRemaining += `${seconds} ثانية`;

                return {
                    ...buff,
                    time_remaining: timeRemaining.trim(),
                    minutes_remaining: totalMinutes,
                    is_expired: totalMinutes <= 0
                };
            });

            return formattedBuffs;
        } catch (error) {
            console.error('❌ Failed to get user active buffs:', error.message);
            return [];
        }
    }

    /**
     * 3.3 تنظيف الـ buffs المنتهية + شيل الـ Roles كـ backup
     */
    async cleanupExpiredBuffs(client = null, guildId = null) {
        try {
            const expiredBuffs = await this.all(
                `SELECT user_id, buff_type, role_id
                 FROM active_buffs 
                 WHERE expires_at <= NOW()`
            );

            if (expiredBuffs.length > 0 && client && guildId) {
                const BUFF_ROLES_MAP = {
                    double_xp:    '1465704728779296940',
                    double_coins: '1465704922656936021',
                    double_luck:  '1465704959491444747'
                };

                const guild = client.guilds.cache.get(guildId);

                for (const buff of expiredBuffs) {
                    try {
                        // ✅ جيب الـ roleId من الداتابيز أو من الـ MAP كـ fallback
                        const roleId = buff.role_id || BUFF_ROLES_MAP[buff.buff_type] || null;
                        if (!roleId) continue;

                        const member = await guild?.members.fetch(buff.user_id).catch(() => null);
                        if (!member) continue;

                        if (member.roles.cache.has(roleId)) {
                            await member.roles.remove(roleId);
                            console.log(`🔴 [Cleanup Backup] Removed ${buff.buff_type} role from ${buff.user_id}`);
                        }
                    } catch (err) {
                        console.error(`❌ Error removing role for ${buff.user_id}:`, err.message);
                    }
                }
            }

            const result = await this.run(
                'DELETE FROM active_buffs WHERE expires_at <= NOW()'
            );

            if (result.changes > 0) {
                console.log(`🧹 Cleaned ${result.changes} expired buffs`);
            }

            return { success: true, cleaned: result.changes || 0 };

        } catch (error) {
            console.error('❌ Failed to cleanup expired buffs:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ========== DROP SYSTEM - CORRECTED LOGIC ==========

    /**
     * 4.1 جلب إعدادات drop معين
     */
    async getDropConfig(dropType) {
        try {
            const config = await this.get(
                'SELECT * FROM drop_config WHERE drop_type = ?',
                [dropType]
            );

            if (config && config.rewards_config) {
                try {
                    // إذا كانت string، حولها لـ object
                    if (typeof config.rewards_config === 'string') {
                        config.rewards_config = JSON.parse(config.rewards_config);
                    }
                } catch (e) {
                    console.error(`❌ Failed to parse rewards_config for ${dropType}:`, e.message);
                    config.rewards_config = [];
                }
            } else if (config) {
                config.rewards_config = [];
            }

            return config;
        } catch (error) {
            console.error(`❌ Failed to get ${dropType} config:`, error.message);
            return null;
        }
    }

    /**
     * 4.2 جلب كل الإعدادات
     */
    async getAllDropConfigs() {
        try {
            const configs = await this.all('SELECT * FROM drop_config ORDER BY min_messages');

            return configs.map(config => {
                if (config.rewards_config) {
                    try {
                        config.rewards_config = JSON.parse(config.rewards_config);
                    } catch (e) {
                        console.error(`❌ Failed to parse rewards_config for ${config.drop_type}:`, e);
                        config.rewards_config = [];
                    }
                }
                return config;
            });
        } catch (error) {
            console.error('❌ Failed to get all drop configs:', error.message);
            return [];
        }
    }

    // ========== FIXED DROP TARGET SYSTEM ==========

    /**
     * توليد جميع الـ targets الجديدة بعد الـ Legendary
     */
    async generateNewDropTargets(userId) {
        try {
            const newTargets = {
                common_target: this.generateRandomDropTarget('common'),
                rare_target: this.generateRandomDropTarget('rare'),
                epic_target: this.generateRandomDropTarget('epic'),
                legendary_target: this.generateRandomDropTarget('legendary')
            };

            // إعادة تعيين كل شيء إلى 0
            await this.run(
                `UPDATE user_drop_progress 
                 SET total_messages = 0,
                     common_target = ?,
                     rare_target = ?,
                     epic_target = ?,
                     legendary_target = ?,
                     last_common_at = 0,
                     last_rare_at = 0,
                     last_epic_at = 0,
                     last_legendary_at = 0,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,
                [
                    newTargets.common_target,
                    newTargets.rare_target,
                    newTargets.epic_target,
                    newTargets.legendary_target,
                    userId
                ]
            );

            console.log(`🔄 Generated new targets for ${userId}:`, newTargets);
            return newTargets;

        } catch (error) {
            console.error('❌ Failed to generate new drop targets:', error.message);
            return null;
        }
    }

    /**
     * تحديث الـ Drop (بدون تغيير الـ target)
     */
    async updateDropTarget(userId, dropType, currentMessages = null) {
        try {
            const user = await this.getUserDropProgress(userId);
            if (!user) return false;

            // ⭐⭐ التعديل هنا: نزيد العداد أولاً ⭐⭐
            const countField = `total_${dropType}_received`;
            const lastField = `last_${dropType}_at`;

            // 1. أولاً: نزيد العداد + نسجل آخر مرة
            await this.run(
                `UPDATE user_drop_progress 
                 SET ${countField} = ${countField} + 1,
                     ${lastField} = ?,
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = ?`,
                [currentMessages || user.total_messages, userId]
            );

            console.log(`✅ Increased ${dropType} count for ${userId}: now ${user[countField] + 1}`);

            // 2. إذا كان legendary، نعيد تعيين الـ targets
            if (dropType === 'legendary') {
                console.log(`🏆 ${userId} reached LEGENDARY! Resetting all targets...`);
                await this.generateNewDropTargets(userId);
            }

            return true;

        } catch (error) {
            console.error(`❌ Failed to update ${dropType} drop:`, error.message);
            return false;
        }
    }

    // ========== CORRECTED DROP PROCESSING ==========

    /**
     * التحقق من الـ Drops المتاحة (الثابتة)
     */
    async checkAvailableDrops(userId) {
        try {
            const user = await this.getUserDropProgress(userId);
            if (!user) return [];

            const drops = [];
            const dropTypes = ['common', 'rare', 'epic', 'legendary'];

            for (const dropType of dropTypes) {
                const targetField = `${dropType}_target`;
                const lastField = `last_${dropType}_at`;

                // تحقق إذا وصل للـ target ولم يأخذ الـ Drop بعد
                // الشرط: الرسائل >= الـ target AND آخر مرة أخذ فيها الـ drop مش عند نفس الـ target
                if (user.total_messages >= user[targetField] &&
                    user[lastField] < user[targetField]) {
                    drops.push({
                        type: dropType,
                        currentMessages: user.total_messages,
                        target: user[targetField]
                    });
                }
            }

            return drops;
        } catch (error) {
            console.error('❌ Failed to check available drops:', error.message);
            return [];
        }
    }

    /**
     * المعالجة الرئيسية للرسائل والـ Drops (المصححة)
     */
    async processMessageForDrops(userId, username) {
        console.log(`🎯 processMessageForDrops called for: ${username} (${userId})`);
        console.trace('Call stack:'); // 👈 هتظهرلك مين اللي استدعى الدالة
        try {
            // 1. جلب تقدم المستخدم
            const userProgress = await this.getUserDropProgress(userId, username);
            if (!userProgress) {
                return { success: false, error: 'User not found' };
            }

            // 2. زيادة عدد الرسائل بمقدار 1
            const oldCount = userProgress.total_messages;
            const newCount = oldCount + 1;

            // 3. تحديث عدد الرسائل
            await this.run(
                `UPDATE user_drop_progress 
                 SET total_messages = ?,
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = ?`,
                [newCount, userId]
            );

            // 4. إذا كان legendary، نتحقق قبل زيادة الرسائل
            if (userProgress.legendary_target <= oldCount &&
                userProgress.last_legendary_at < userProgress.legendary_target) {
                console.log(`🏆 ${username} reached LEGENDARY! Starting reset process...`);
            }

            // 5. التحقق من الـ Drops المتاحة بعد زيادة الرسائل
            const availableDrops = await this.checkAvailableDrops(userId);

            console.log(`🔍 ${username}: ${newCount} messages | Available drops: ${availableDrops.length}`);

            if (availableDrops.length === 0) {
                return {
                    success: true,
                    hasDrops: false,
                    messageCount: newCount,
                    drops: [],
                    message: '📝 تم عد الرسالة'
                };
            }

            // 6. إنشاء الـ Drops
            const processedDrops = [];

            for (const drop of availableDrops) {
                console.log(`🎁 ${username} reached ${drop.type} drop at ${newCount} messages! (Target: ${drop.target})`);

                const crateResult = await this.createCrate(userId, username, drop.type);

                if (crateResult.success) {
                    // تحديث الـ drop (بدون تغيير الـ target)
                    await this.updateDropTarget(userId, drop.type);

                    processedDrops.push({
                        type: drop.type,
                        crateId: crateResult.crateId,
                        reward: crateResult.crateData.reward
                    });

                    // إذا كان legendary، تمت المعالجة في updateDropTarget
                    if (drop.type === 'legendary') {
                        console.log(`🎊 ${username} completed a LEGENDARY cycle!`);
                    }
                }
            }

            return {
                success: true,
                hasDrops: true,
                messageCount: newCount,
                drops: processedDrops,
                message: `🎉 حصلت على ${processedDrops.length} drop${processedDrops.length > 1 ? 's' : ''}!`
            };

        } catch (error) {
            console.error('❌ Failed to process message for drops:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب إحصائيات الـ drops (المصححة)
     */
    async getDropStats(userId) {
        try {
            const user = await this.getUserDropProgress(userId);
            if (!user) return null;

            const dropTypes = ['common', 'rare', 'epic', 'legendary'];
            const stats = {
                total_messages: user.total_messages,
                drops: {}
            };

            for (const dropType of dropTypes) {
                const targetField = `${dropType}_target`;
                const countField = `total_${dropType}_received`;
                const lastField = `last_${dropType}_at`;

                // الحساب الصحيح: متى يأخذ الـ drop التالي؟
                let remaining = 0;
                let progress = 0;
                let nextAt = user[targetField];

                if (user.total_messages >= user[targetField]) {
                    // إذا وصل للـ target وأخذ الـ drop، التالي هو نفس الـ target
                    if (user[lastField] >= user[targetField]) {
                        remaining = 0;
                        progress = 100;
                    } else {
                        // إذا وصل للـ target ولم يأخذ الـ drop بعد
                        remaining = 0;
                        progress = 100;
                    }
                } else {
                    // إذا لم يصل للـ target بعد
                    remaining = user[targetField] - user.total_messages;
                    progress = Math.floor((user.total_messages / user[targetField]) * 100);
                }

                stats.drops[dropType] = {
                    received: user[countField],
                    next_at: nextAt,
                    last_at: user[lastField],
                    remaining: remaining,
                    progress: progress,
                    is_available: user.total_messages >= user[targetField] && user[lastField] < user[targetField]
                };
            }

            // حساب أقرب drop
            let nextDrop = null;
            let minRemaining = Infinity;

            for (const [dropType, dropStats] of Object.entries(stats.drops)) {
                if (dropStats.remaining < minRemaining && dropStats.remaining > 0) {
                    minRemaining = dropStats.remaining;
                    nextDrop = {
                        type: dropType,
                        messages_needed: dropStats.remaining,
                        progress: dropStats.progress
                    };
                }
            }

            stats.next_drop = nextDrop;

            return stats;
        } catch (error) {
            console.error('❌ Failed to get drop stats:', error.message);
            return null;
        }
    }

    // ========== DROP SYSTEM INITIALIZATION ==========

    /**
     * Initialize Drop System configurations
     */
    async initializeDropConfigs() {
        try {
            console.log('🎮 Initializing Drop System configurations...');

            const dropConfigs = [
                {
                    drop_type: 'common',
                    min_messages: 100,
                    max_messages: 150,
                    description: '📦 Common Drop - Every 100-150 messages',
                    rewards_config: JSON.stringify([
                        // العملات الأساسية - 85%
                        { reward_type: 'coins', chance: 0.60, min_coins: 50, max_coins: 100 },           // 60% ⭐
                        { reward_type: 'xp_coins', chance: 0.25, min_coins: 30, max_coins: 60, min_xp: 20, max_xp: 40 }, // 25% ⭐

                        // مكافآت إضافية - 10%
                        { reward_type: 'bonus_coins', chance: 0.10, min_coins: 75, max_coins: 150 },     // 10% ⭐

                        // كريستالات - 2.5%
                        { reward_type: 'small_crystals', chance: 0.025, min_crystals: 1, max_crystals: 1 }, // 2.5% ⭐

                        // بافات نادرة جداً - 2.5%
                        { reward_type: 'double_xp', chance: 0.0125, buff_type: 'double_xp', buff_duration: 15 },  // 1.25%
                        { reward_type: 'double_luck', chance: 0.0125, buff_type: 'double_luck', buff_duration: 15 } // 1.25%
                    ])
                },
                {
                    drop_type: 'rare',
                    min_messages: 250,
                    max_messages: 300,
                    description: '✨ Rare Drop - Every 250-300 messages',
                    rewards_config: JSON.stringify([
                        // العملات - 50%
                        { reward_type: 'coins', chance: 0.35, min_coins: 120, max_coins: 200 },          // 35%
                        { reward_type: 'coins_crystal', chance: 0.15, min_coins: 100, max_coins: 180, min_crystals: 1, max_crystals: 2 }, // 15%

                        // خبرة - 20%
                        { reward_type: 'xp_coins', chance: 0.20, min_coins: 60, max_coins: 100, min_xp: 50, max_xp: 80 }, // 20%

                        // بافات - 25%
                        { reward_type: 'double_xp', chance: 0.15, buff_type: 'double_xp', buff_duration: 15 },  // 15%
                        { reward_type: 'double_luck', chance: 0.10, buff_type: 'double_luck', buff_duration: 15 },   // 10%

                        // كريستالات - 5%
                        { reward_type: 'crystals_only', chance: 0.05, min_crystals: 1, max_crystals: 2 } // 5%
                    ])
                },
                {
                    drop_type: 'epic',
                    min_messages: 350,
                    max_messages: 500,
                    description: '💎 Epic Drop - Every 350-500 messages',
                    rewards_config: JSON.stringify([
                        // مكافآت قيمة - 60%
                        { reward_type: 'coins_crystal', chance: 0.40, min_coins: 250, max_coins: 400, min_crystals: 1, max_crystals: 3 }, // 40%
                        { reward_type: 'xp_coins', chance: 0.20, min_coins: 150, max_coins: 250, min_xp: 100, max_xp: 150 }, // 20%

                        // بافات - 25%
                        { reward_type: 'double_xp', chance: 0.15, buff_type: 'double_xp', buff_duration: 20 },  // 15%
                        { reward_type: 'double_luck', chance: 0.10, buff_type: 'double_luck', buff_duration: 20 }, // 10%

                        // مكافآت ضخمة - 15%
                        { reward_type: 'mega_coins', chance: 0.10, min_coins: 400, max_coins: 600 },               // 10%
                        { reward_type: 'crystals_bundle', chance: 0.05, min_crystals: 2, max_crystals: 4 }         // 5%
                    ])
                },
                {
                    drop_type: 'legendary',
                    min_messages: 550,
                    max_messages: 800,
                    description: '🔥 Legendary Drop - Every 550-800 messages',
                    rewards_config: JSON.stringify([
                        // ⭐⭐ الأعلى: XP + عملات (المستوى الأول)
                        { reward_type: 'xp_coins', chance: 0.30, min_coins: 300, max_coins: 500, min_xp: 250, max_xp: 400 }, // 30%

                        // ⭐⭐ الثاني: عملات + كريستالات (المستوى الثاني)
                        { reward_type: 'coins_crystal', chance: 0.25, min_coins: 600, max_coins: 1000, min_crystals: 2, max_crystals: 4 }, // 25%

                        // ⭐⭐ الثالث: البافات القوية (المستوى الثالث)
                        { reward_type: 'double_xp', chance: 0.15, buff_type: 'double_xp', buff_duration: 25 },  // 15%
                        { reward_type: 'double_luck', chance: 0.10, buff_type: 'double_luck', buff_duration: 25 }, // 10%

                        // ⭐⭐ الرابع: المكافأة الفائقة (المستوى الرابع)
                        { reward_type: 'ultimate_reward', chance: 0.08, min_coins: 800, max_coins: 1200, min_xp: 300, max_xp: 500 }, // 8%

                        // ⭐⭐ الأخير: الكوبونات (المستوى الخامس)
                        { reward_type: 'coupon', chance: 0.12, min_discount: 15, max_discount: 40 }  // 12%
                    ])
                }
            ];

            for (const config of dropConfigs) {
                await this.run(
                    `INSERT INTO drop_config (drop_type, min_messages, max_messages, description, rewards_config) 
                     VALUES (?, ?, ?, ?, ?) 
                     ON CONFLICT (drop_type) 
                     DO UPDATE SET 
                        min_messages = EXCLUDED.min_messages,
                        max_messages = EXCLUDED.max_messages,
                        description = EXCLUDED.description,
                        rewards_config = EXCLUDED.rewards_config,
                        updated_at = CURRENT_TIMESTAMP`,
                    [config.drop_type, config.min_messages, config.max_messages, config.description, config.rewards_config]
                );
            }

            console.log('✅ Drop System configurations initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing drop configs:', error);
        }
    }

    // ========== HELPER FUNCTIONS ==========

    /**
     * فتح جميع الصناديق من نوع معين
     */
    async openAllCratesOfType(userId, crateType) {
        try {
            const crateResult = await this.getUserCrates(userId, {
                crateType: crateType,
                unusedOnly: true
            });

            if (!crateResult.crates || crateResult.crates.length === 0) {
                return {
                    success: false,
                    error: `No ${crateType} crates available`,
                    code: 'NO_CRATES'
                };
            }

            const results = [];
            let totalCoins = 0;
            let totalXP = 0;
            let totalCrystals = 0;
            const buffs = [];

            for (const crate of crateResult.crates) {
                const openResult = await this.openCrate(crate.id, userId);
                if (openResult.success) {
                    results.push(openResult);
                    totalCoins += crate.coins_amount;
                    totalXP += crate.xp_amount;
                    totalCrystals += crate.crystals_amount;

                    if (openResult.buff) {
                        buffs.push(openResult.buff);
                    }
                }
            }

            return {
                success: true,
                opened: results.length,
                total: {
                    coins: totalCoins,
                    xp: totalXP,
                    crystals: totalCrystals
                },
                buffs: buffs,
                details: results
            };
        } catch (error) {
            console.error('❌ Failed to open all crates:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب أفضل المستخدمين في الـ Drops
     */
    async getTopDropUsers(limit = 10) {
        try {
            return await this.all(
                `SELECT 
                    user_id,
                    username,
                    total_messages,
                    total_common_received + total_rare_received + total_epic_received + total_legendary_received as total_drops,
                    total_common_received,
                    total_rare_received,
                    total_epic_received,
                    total_legendary_received
                 FROM user_drop_progress 
                 ORDER BY total_messages DESC 
                 LIMIT ?`,
                [limit]
            );
        } catch (error) {
            console.error('❌ Failed to get top drop users:', error.message);
            return [];
        }
    }

    /**
     * إعادة تعيين بيانات Drop لمستخدم
     */
    async resetUserDropData(userId) {
        try {
            await this.run('DELETE FROM user_drop_progress WHERE user_id = ?', [userId]);
            await this.run('DELETE FROM user_crates WHERE user_id = ?', [userId]);
            await this.run('DELETE FROM active_buffs WHERE user_id = ?', [userId]);

            return { success: true, message: 'User drop data reset successfully' };
        } catch (error) {
            console.error('❌ Failed to reset user drop data:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * تحديث اسم المستخدم في Drop System
     */
    async updateDropUsername(userId, newUsername) {
        try {
            await Promise.all([
                this.run('UPDATE user_drop_progress SET username = ? WHERE user_id = ?', [newUsername, userId]),
                this.run('UPDATE user_crates SET username = ? WHERE user_id = ?', [newUsername, userId])
            ]);

            return { success: true };
        } catch (error) {
            console.error('❌ Failed to update drop username:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * اختبار النظام
     */
    async testDropSystem(userId = 'test_user_123', username = 'TestUser') {
        try {
            console.log('🧪 Testing Drop System...');

            // 1. إنشاء مستخدم جديد
            await this.createUserDropProgress(userId, username);

            // 2. إضافة 200 رسالة دفعة واحدة
            console.log(`📨 Adding 200 messages for ${username}...`);

            const dropsReceived = [];

            for (let i = 0; i < 200; i++) {
                const result = await this.processMessageForDrops(userId, username);

                if (result && result.hasDrops) {
                    console.log(`🎉 Got drops at message ${i + 1}:`, result.drops.length);
                    dropsReceived.push(...result.drops);
                }
            }

            // 3. عرض النتائج
            const status = await this.getCompleteDropStatus(userId);
            const crateStats = await this.getUserCrates(userId, { unusedOnly: true });

            console.log('📊 Test Results:');
            console.log(`- Total Messages: ${status?.user?.total_messages || 0}`);
            console.log(`- Drops Received: ${dropsReceived.length}`);
            console.log(`- Unused Crates: ${crateStats.stats?.unused || 0}`);
            console.log(`- Available Drops: ${status?.available_drops?.length || 0}`);

            return {
                success: true,
                dropsReceived: dropsReceived.length,
                crates: crateStats.stats?.unused || 0
            };

        } catch (error) {
            console.error('❌ Drop System test failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ========== MISSION SYSTEM FUNCTIONS (MODIFIED) ==========

    /**
     * توليد رقم عشوائي بين قيمتين
     */
    randomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * بداية الأسبوع (الإثنين)
     */
    getWeekStartDate() {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        return monday.toISOString().split('T')[0];
    }

    /**
     * توليد مهمة يومية عشوائية
     */
    generateRandomDailyGoal() {
        const templates = MISSION_TEMPLATES.daily;
        const template = templates[Math.floor(Math.random() * templates.length)];

        const requirement    = this.randomBetween(template.req_min,      template.req_max);
        const xpReward       = this.randomBetween(template.xp_min,       template.xp_max);
        const coinsReward    = this.randomBetween(template.coins_min,    template.coins_max);
        const crystalsReward = this.randomBetween(template.crystals_min, template.crystals_max);

        return {
            title:                template.title,
            description:          template.description.replace('X', requirement),
            req_type:             template.req_type,
            assigned_requirement: requirement,
            assigned_xp:          xpReward,
            assigned_coins:       coinsReward,
            assigned_crystals:    crystalsReward,
            bonus_chance:         template.bonus_chance,
            bonus_type:           template.bonus_type,
            bonus_value:          template.bonus_value
        };
    }

    /**
     * توليد مهمة أسبوعية عشوائية
     */
    generateRandomWeeklyGoal() {
        const templates = MISSION_TEMPLATES.weekly;
        const template = templates[Math.floor(Math.random() * templates.length)];

        const requirement    = this.randomBetween(template.req_min,      template.req_max);
        const xpReward       = this.randomBetween(template.xp_min,       template.xp_max);
        const coinsReward    = this.randomBetween(template.coins_min,    template.coins_max);
        const crystalsReward = this.randomBetween(template.crystals_min, template.crystals_max);

        return {
            title:                template.title,
            description:          template.description.replace('X', requirement),
            req_type:             template.req_type,
            assigned_requirement: requirement,
            assigned_xp:          xpReward,
            assigned_coins:       coinsReward,
            assigned_crystals:    crystalsReward,
            bonus_chance:         template.bonus_chance,
            bonus_type:           template.bonus_type,
            bonus_value:          template.bonus_value
        };
    }

    /**
     * تحليل بيانات الهدف (JSON أو Object)
     */
    parseGoalData(data) {
        if (!data) return null;
        try {
            if (typeof data === 'string') return JSON.parse(data);
            if (typeof data === 'object') return data;
            return null;
        } catch (error) {
            console.error('Error parsing goal data:', error);
            console.error('Data that caused error:', data);
            return null;
        }
    }

    /**
     * توليد أهداف جديدة لمستخدم (في صف واحد فقط)
     */
    async generateUserGoals(userId, username) {
        try {
            const now = new Date();

            // ⭐ جلب الـ daily_streak والـ weekly_streak بشكل منفصل
            const levelData = await this.get(
                'SELECT daily_streak, weekly_streak FROM levels WHERE user_id = $1',
                [userId]
            );
            const dailyStreak  = levelData?.daily_streak  || 0;
            const weeklyStreak = levelData?.weekly_streak || 0;

            // ⭐ daily3 يتحكم فيه daily_streak، weekly2 يتحكم فيه weekly_streak
            const hasDailyBonus  = dailyStreak  >= 5;
            const hasWeeklyBonus = weeklyStreak >= 5;

            console.log(`📊 ${username} streaks: daily=${dailyStreak} (bonus: ${hasDailyBonus}), weekly=${weeklyStreak} (bonus: ${hasWeeklyBonus})`);

            const existingGoals = await this.get(
                'SELECT * FROM user_goals WHERE user_id = $1',
                [userId]
            );

            // ⭐ التحقق من المهام اليومية
            let needDailyReset = true;
            if (existingGoals?.period_date) {
                const hoursDiff = (now - new Date(existingGoals.period_date)) / (1000 * 60 * 60);
                if (hoursDiff < 24) {
                    needDailyReset = false;
                    console.log(`⏰ Daily goals still valid (${hoursDiff.toFixed(1)} hours old)`);
                }
            }

            // ⭐ التحقق من المهام الأسبوعية
            let needWeeklyReset = true;
            if (existingGoals?.period_date_weekly) {
                const daysDiff = (now - new Date(existingGoals.period_date_weekly)) / (1000 * 60 * 60 * 24);
                if (daysDiff < 7) {
                    needWeeklyReset = false;
                    console.log(`📅 Weekly goal still valid (${daysDiff.toFixed(1)} days old)`);
                }
            }

            // ===== مستخدم جديد =====
            if (!existingGoals) {
                console.log(`🆕 Creating NEW goals row for ${username}`);

                const dailyGoal1  = this.generateRandomDailyGoal();
                const dailyGoal2  = this.generateRandomDailyGoal();
                const dailyGoal3  = hasDailyBonus  ? this.generateRandomDailyGoal()  : null;
                const weeklyGoal  = this.generateRandomWeeklyGoal();
                const weeklyGoal2 = hasWeeklyBonus ? this.generateRandomWeeklyGoal() : null;

                await this.run(
                    `INSERT INTO user_goals
                     (user_id, period_date, period_date_weekly,
                      daily_goal1, daily_goal2, daily_goal3,
                      weekly_goal, weekly_goal2,
                      daily1_progress, daily2_progress, daily3_progress,
                      weekly_progress, weekly2_progress)
                     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,0,0,0,0,0)`,
                    [
                        userId, now.toISOString(), now.toISOString(),
                        JSON.stringify(dailyGoal1),
                        JSON.stringify(dailyGoal2),
                        dailyGoal3  ? JSON.stringify(dailyGoal3)  : null,
                        JSON.stringify(weeklyGoal),
                        weeklyGoal2 ? JSON.stringify(weeklyGoal2) : null
                    ]
                );

                return { success: true, reset: 'all' };
            }

            // ===== تجديد يومي =====
            if (needDailyReset) {
                console.log(`🔄 Resetting DAILY goals for ${username} (dailyStreak: ${dailyStreak}, bonus: ${hasDailyBonus})`);

                const dailyGoal1 = this.generateRandomDailyGoal();
                const dailyGoal2 = this.generateRandomDailyGoal();
                const dailyGoal3 = hasDailyBonus ? this.generateRandomDailyGoal() : null;

                await this.run(
                    `UPDATE user_goals
                     SET period_date       = $1,
                         daily_goal1       = $2::jsonb,
                         daily_goal2       = $3::jsonb,
                         daily_goal3       = $4::jsonb,
                         daily1_progress   = 0, daily2_progress   = 0, daily3_progress   = 0,
                         daily1_completed  = false, daily2_completed  = false, daily3_completed  = false,
                         daily1_claimed    = false, daily2_claimed    = false, daily3_claimed    = false,
                         daily1_bonus      = false, daily2_bonus      = false, daily3_bonus      = false,
                         updated_at        = CURRENT_TIMESTAMP
                     WHERE user_id = $5`,
                    [
                        now.toISOString(),
                        JSON.stringify(dailyGoal1),
                        JSON.stringify(dailyGoal2),
                        dailyGoal3 ? JSON.stringify(dailyGoal3) : null,
                        userId
                    ]
                );
            }

            // ===== تجديد أسبوعي =====
            if (needWeeklyReset) {
                console.log(`🔄 Resetting WEEKLY goals for ${username} (weeklyStreak: ${weeklyStreak}, bonus: ${hasWeeklyBonus})`);

                const weeklyGoal  = this.generateRandomWeeklyGoal();
                const weeklyGoal2 = hasWeeklyBonus ? this.generateRandomWeeklyGoal() : null;

                await this.run(
                    `UPDATE user_goals
                     SET period_date_weekly = $1,
                         weekly_goal        = $2::jsonb,
                         weekly_goal2       = $3::jsonb,
                         weekly_progress    = 0, weekly2_progress  = 0,
                         weekly_completed   = false, weekly2_completed = false,
                         weekly_claimed     = false, weekly2_claimed   = false,
                         weekly_bonus       = false, weekly2_bonus     = false,
                         updated_at         = CURRENT_TIMESTAMP
                     WHERE user_id = $4`,
                    [
                        now.toISOString(),
                        JSON.stringify(weeklyGoal),
                        weeklyGoal2 ? JSON.stringify(weeklyGoal2) : null,
                        userId
                    ]
                );
            }

            // ===== daily_streak وصل 5 وما فيش daily3 → نضيفه =====
            if (!needDailyReset && hasDailyBonus && !existingGoals.daily_goal3) {
                console.log(`⭐ Adding missing daily3 for ${username} (dailyStreak: ${dailyStreak})`);
                const dailyGoal3 = this.generateRandomDailyGoal();
                await this.run(
                    `UPDATE user_goals
                     SET daily_goal3      = $1::jsonb,
                         daily3_progress  = 0,
                         daily3_completed = false,
                         daily3_claimed   = false,
                         daily3_bonus     = false,
                         updated_at       = CURRENT_TIMESTAMP
                     WHERE user_id = $2`,
                    [JSON.stringify(dailyGoal3), userId]
                );
            }

            // ===== weekly_streak وصل 5 وما فيش weekly2 → نضيفه =====
            if (!needWeeklyReset && hasWeeklyBonus && !existingGoals.weekly_goal2) {
                console.log(`⭐ Adding missing weekly2 for ${username} (weeklyStreak: ${weeklyStreak})`);
                const weeklyGoal2 = this.generateRandomWeeklyGoal();
                await this.run(
                    `UPDATE user_goals
                     SET weekly_goal2      = $1::jsonb,
                         weekly2_progress  = 0,
                         weekly2_completed = false,
                         weekly2_claimed   = false,
                         weekly2_bonus     = false,
                         updated_at        = CURRENT_TIMESTAMP
                     WHERE user_id = $2`,
                    [JSON.stringify(weeklyGoal2), userId]
                );
            }

            // ===== daily_streak وقع تحت 5 → نمسح daily3 =====
            if (!needDailyReset && !hasDailyBonus && existingGoals.daily_goal3) {
                console.log(`🔒 Removing daily3 for ${username} - dailyStreak dropped below 5 (${dailyStreak})`);
                await this.run(
                    `UPDATE user_goals
                     SET daily_goal3      = NULL,
                         daily3_progress  = 0,
                         daily3_completed = false,
                         daily3_claimed   = false,
                         daily3_bonus     = false,
                         updated_at       = CURRENT_TIMESTAMP
                     WHERE user_id = $1`,
                    [userId]
                );
            }

            // ===== weekly_streak وقع تحت 5 → نمسح weekly2 =====
            if (!needWeeklyReset && !hasWeeklyBonus && existingGoals.weekly_goal2) {
                console.log(`🔒 Removing weekly2 for ${username} - weeklyStreak dropped below 5 (${weeklyStreak})`);
                await this.run(
                    `UPDATE user_goals
                     SET weekly_goal2      = NULL,
                         weekly2_progress  = 0,
                         weekly2_completed = false,
                         weekly2_claimed   = false,
                         weekly2_bonus     = false,
                         updated_at        = CURRENT_TIMESTAMP
                     WHERE user_id = $1`,
                    [userId]
                );
            }

            return { success: true, dailyReset: needDailyReset, weeklyReset: needWeeklyReset };

        } catch (error) {
            console.error(`❌ Error generating goals for ${userId}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب أهداف المستخدم (من صف واحد)
     */
    async getUserGoals(userId) {
        try {
            const userRow = await this.get(
                'SELECT * FROM user_goals WHERE user_id = $1',
                [userId]
            );

            const result = {
                daily: [],
                weekly: null,
                weekly2: null,
                dailyStreak: 0,      // ⭐ أضف هذا
                weeklyStreak: 0,      // ⭐ أضف هذا
                timestamps: {
                    daily_reset: userRow?.period_date,
                    weekly_reset: userRow?.period_date_weekly,
                    next_daily_reset: null,
                    next_weekly_reset: null,
                    can_reset_daily: false,
                    can_reset_weekly: false
                }
            };

            if (!userRow) {
                console.log(`❌ No goals found for user ${userId}`);
                return result;
            }

            // ⭐ جلب الـ streaks من جدول levels
            const levelData = await this.get(
                'SELECT daily_streak, weekly_streak FROM levels WHERE user_id = $1',
                [userId]
            );

            result.dailyStreak = levelData?.daily_streak || 0;
            result.weeklyStreak = levelData?.weekly_streak || 0;

            console.log(`✅ Found goals for user ${userId}:`, {
                hasDaily1: !!userRow.daily_goal1,
                hasDaily2: !!userRow.daily_goal2,
                hasDaily3: !!userRow.daily_goal3,
                hasWeekly: !!userRow.weekly_goal,
                hasWeekly2: !!userRow.weekly_goal2,
                dailyStreak: result.dailyStreak,    // ⭐ للتأكيد
                weeklyStreak: result.weeklyStreak    // ⭐ للتأكيد
            });

            // ⭐ باقي الكود لتحليل الأهداف كما هو
            const now = new Date();

            if (userRow.period_date) {
                const lastDaily = new Date(userRow.period_date);
                const hoursDiff = (now - lastDaily) / (1000 * 60 * 60);
                result.timestamps.next_daily_reset = new Date(lastDaily.getTime() + 24 * 60 * 60 * 1000);
                result.timestamps.can_reset_daily = hoursDiff >= 24;
            }

            if (userRow.period_date_weekly) {
                const lastWeekly = new Date(userRow.period_date_weekly);
                const daysDiff = (now - lastWeekly) / (1000 * 60 * 60 * 24);
                result.timestamps.next_weekly_reset = new Date(lastWeekly.getTime() + 7 * 24 * 60 * 60 * 1000);
                result.timestamps.can_reset_weekly = daysDiff >= 7;
            }

            // ===== Helper داخلي لتحليل بيانات الهدف =====
            const parseGoal = (raw, progress, completed, claimed, bonus, goalType, isBonus = false) => {
                if (!raw) return null;
                try {
                    const g = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    if (!g?.title) return null;
                    return {
                        ...g,
                        progress: progress || 0,
                        completed: completed || false,
                        claimed: claimed || false,
                        got_bonus: bonus || false,
                        rowId: userRow.goal_id,
                        goalType: goalType,
                        actualRequirement: g.assigned_requirement || g.req_min || 1,
                        isBonus: isBonus
                    };
                } catch (e) {
                    console.error(`❌ Error parsing ${goalType}:`, e);
                    return null;
                }
            };

            // Daily 1, 2, 3
            const g1 = parseGoal(userRow.daily_goal1, userRow.daily1_progress, userRow.daily1_completed, userRow.daily1_claimed, userRow.daily1_bonus, 'daily1');
            const g2 = parseGoal(userRow.daily_goal2, userRow.daily2_progress, userRow.daily2_completed, userRow.daily2_claimed, userRow.daily2_bonus, 'daily2');
            const g3 = parseGoal(userRow.daily_goal3, userRow.daily3_progress, userRow.daily3_completed, userRow.daily3_claimed, userRow.daily3_bonus, 'daily3', true);

            if (g1) result.daily.push(g1);
            if (g2) result.daily.push(g2);
            if (g3) result.daily.push(g3);

            // Weekly 1, 2
            result.weekly = parseGoal(userRow.weekly_goal, userRow.weekly_progress, userRow.weekly_completed, userRow.weekly_claimed, userRow.weekly_bonus, 'weekly');
            result.weekly2 = parseGoal(userRow.weekly_goal2, userRow.weekly2_progress, userRow.weekly2_completed, userRow.weekly2_claimed, userRow.weekly2_bonus, 'weekly2', true);

            // التحقق من الإكمال بناءً على التقدم
            for (const g of result.daily) {
                if (g && !g.completed && g.progress >= g.actualRequirement) {
                    console.log(`🎯 ${g.goalType} reached requirement!`);
                    g.completed = true;
                }
            }
            if (result.weekly && !result.weekly.completed && result.weekly.progress >= result.weekly.actualRequirement) result.weekly.completed = true;
            if (result.weekly2 && !result.weekly2.completed && result.weekly2.progress >= result.weekly2.actualRequirement) result.weekly2.completed = true;

            return result;

        } catch (error) {
            console.error('❌ Error in getUserGoals:', error);
            return { 
                daily: [], 
                weekly: null, 
                weekly2: null, 
                dailyStreak: 0,      // ⭐ حتى في حالة الخطأ
                weeklyStreak: 0,      // ⭐ حتى في حالة الخطأ
                timestamps: null 
            };
        }
    }

    /**
     * تحديث تقدم الهدف
     */
    async updateGoalProgress(userId, progressType, amount = 1) {
        try {
            console.log(`📈 Updating progress for ${userId}: ${progressType} +${amount}`);

            await this.run(
                `UPDATE user_goals SET
                    daily1_progress = CASE
                        WHEN daily_goal1->>'req_type' = $1 AND daily1_completed = false
                        THEN LEAST(daily1_progress + $2, (daily_goal1->>'assigned_requirement')::INTEGER)
                        ELSE daily1_progress END,
                    daily1_completed = CASE
                        WHEN daily_goal1->>'req_type' = $1
                        AND daily1_progress + $2 >= (daily_goal1->>'assigned_requirement')::INTEGER
                        THEN true ELSE daily1_completed END,

                    daily2_progress = CASE
                        WHEN daily_goal2->>'req_type' = $1 AND daily2_completed = false
                        THEN LEAST(daily2_progress + $2, (daily_goal2->>'assigned_requirement')::INTEGER)
                        ELSE daily2_progress END,
                    daily2_completed = CASE
                        WHEN daily_goal2->>'req_type' = $1
                        AND daily2_progress + $2 >= (daily_goal2->>'assigned_requirement')::INTEGER
                        THEN true ELSE daily2_completed END,

                    daily3_progress = CASE
                        WHEN daily_goal3 IS NOT NULL
                        AND daily_goal3->>'req_type' = $1 AND daily3_completed = false
                        THEN LEAST(daily3_progress + $2, (daily_goal3->>'assigned_requirement')::INTEGER)
                        ELSE daily3_progress END,
                    daily3_completed = CASE
                        WHEN daily_goal3 IS NOT NULL
                        AND daily_goal3->>'req_type' = $1
                        AND daily3_progress + $2 >= (daily_goal3->>'assigned_requirement')::INTEGER
                        THEN true ELSE daily3_completed END,

                    weekly_progress = CASE
                        WHEN weekly_goal->>'req_type' = $1 AND weekly_completed = false
                        THEN LEAST(weekly_progress + $2, (weekly_goal->>'assigned_requirement')::INTEGER)
                        ELSE weekly_progress END,
                    weekly_completed = CASE
                        WHEN weekly_goal->>'req_type' = $1
                        AND weekly_progress + $2 >= (weekly_goal->>'assigned_requirement')::INTEGER
                        THEN true ELSE weekly_completed END,

                    weekly2_progress = CASE
                        WHEN weekly_goal2 IS NOT NULL
                        AND weekly_goal2->>'req_type' = $1 AND weekly2_completed = false
                        THEN LEAST(weekly2_progress + $2, (weekly_goal2->>'assigned_requirement')::INTEGER)
                        ELSE weekly2_progress END,
                    weekly2_completed = CASE
                        WHEN weekly_goal2 IS NOT NULL
                        AND weekly_goal2->>'req_type' = $1
                        AND weekly2_progress + $2 >= (weekly_goal2->>'assigned_requirement')::INTEGER
                        THEN true ELSE weekly2_completed END,

                    updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $3`,
                [progressType, amount, userId]
            );

            console.log(`✅ Progress updated for ${userId}`);
            return true;

        } catch (error) {
            console.error('❌ Error updating goal progress:', error);
            return false;
        }
    }

    /**
     * تحديث تقدم Staff Reactions
     */
    async updateStaffReactions(userId, staffMemberId) {
        return await this.updateGoalProgress(userId, 'staff_reacts', 1);
    }

    /**
     * تحديث Unique Replies
     */
    async updateUniqueReply(userId, targetUserId) {
        return await this.updateGoalProgress(userId, 'unique_replies', 1);
    }

    /**
     * تحديث تقدم البامب
     */
    async updateBumpProgress(userId) {
        return await this.updateGoalProgress(userId, 'bumps', 1);
    }

    /**
     * استلام مكافأة الهدف
     */
    async claimGoalReward(userId, rowId, goalType) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const goalRow = await client.query(`
                SELECT * FROM user_goals 
                WHERE goal_id = $1 AND user_id = $2
            `, [rowId, userId]);

            if (goalRow.rows.length === 0) throw new Error('Goal row not found');

            const row = goalRow.rows[0];
            let goalData, completed, claimed, bonusField, completedField, progressValue;

            // تحديد المهمة المطلوبة بناءً على النوع
            switch (goalType) {
                case 'daily1':
                    goalData       = this.parseGoalData(row.daily_goal1);
                    completed      = row.daily1_completed;
                    claimed        = row.daily1_claimed;
                    bonusField     = 'daily1_bonus';
                    completedField = 'daily1_completed';
                    progressValue  = row.daily1_progress;
                    break;
                case 'daily2':
                    goalData       = this.parseGoalData(row.daily_goal2);
                    completed      = row.daily2_completed;
                    claimed        = row.daily2_claimed;
                    bonusField     = 'daily2_bonus';
                    completedField = 'daily2_completed';
                    progressValue  = row.daily2_progress;
                    break;
                case 'daily3':
                    goalData       = this.parseGoalData(row.daily_goal3);
                    completed      = row.daily3_completed;
                    claimed        = row.daily3_claimed;
                    bonusField     = 'daily3_bonus';
                    completedField = 'daily3_completed';
                    progressValue  = row.daily3_progress;
                    break;
                case 'weekly':
                    goalData       = this.parseGoalData(row.weekly_goal);
                    completed      = row.weekly_completed;
                    claimed        = row.weekly_claimed;
                    bonusField     = 'weekly_bonus';
                    completedField = 'weekly_completed';
                    progressValue  = row.weekly_progress;
                    break;
                case 'weekly2':
                    goalData       = this.parseGoalData(row.weekly_goal2);
                    completed      = row.weekly2_completed;
                    claimed        = row.weekly2_claimed;
                    bonusField     = 'weekly2_bonus';
                    completedField = 'weekly2_completed';
                    progressValue  = row.weekly2_progress;
                    break;
                default:
                    throw new Error('Invalid goal type');
            }

            if (!goalData) throw new Error('Goal data not found');
            if (claimed)   throw new Error('Goal already claimed');

            // لو مش completed في الـ DB، نتحقق من التقدم ونعمل UPDATE تلقائي
            if (!completed) {
                const requirement = goalData.assigned_requirement || 1;
                if (progressValue >= requirement) {
                    console.log(`🎯 Auto-completing ${goalType} (progress: ${progressValue}/${requirement})`);
                    await client.query(
                        `UPDATE user_goals SET ${completedField} = true, updated_at = CURRENT_TIMESTAMP WHERE goal_id = $1`,
                        [rowId]
                    );
                    completed = true;
                }
            }

            if (!completed) throw new Error('Goal not completed yet');

            // حساب المكافآت مع البونص
            let finalXP       = goalData.assigned_xp      || 0;
            let finalCoins    = goalData.assigned_coins    || 0;
            let finalCrystals = goalData.assigned_crystals || 0;
            let gotBonus      = false;

            if (goalData.bonus_chance > 0 && Math.random() < parseFloat(goalData.bonus_chance)) {
                gotBonus = true;
                switch (goalData.bonus_type) {
                    case 'multiply_xp':
                        finalXP       = Math.floor(finalXP    * parseFloat(goalData.bonus_value)); break;
                    case 'multiply_coins':
                        finalCoins    = Math.floor(finalCoins * parseFloat(goalData.bonus_value)); break;
                    case 'add_xp':
                        finalXP      += parseInt(goalData.bonus_value); break;
                    case 'add_coins':
                        finalCoins   += parseInt(goalData.bonus_value); break;
                    case 'add_crystal':
                        finalCrystals += parseInt(goalData.bonus_value); break;
                }
            }

            // منح المكافآت في جدول levels
            await client.query(`
                UPDATE levels 
                SET xp           = xp           + $1,
                    sky_coins    = sky_coins    + $2,
                    sky_crystals = sky_crystals + $3,
                    updated_at   = CURRENT_TIMESTAMP
                WHERE user_id = $4
            `, [finalXP, finalCoins, finalCrystals, userId]);

            // تحديث حالة الاستلام في نفس الصف
            const updateField = `${goalType}_claimed`;
            await client.query(`
                UPDATE user_goals 
                SET ${updateField} = true,
                    ${bonusField}  = $1,
                    updated_at     = CURRENT_TIMESTAMP
                WHERE goal_id = $2
            `, [gotBonus, rowId]);

            await client.query('COMMIT');

            return {
                success:   true,
                goalId:    rowId,
                goalType:  goalType,
                goalTitle: goalData.title,
                rewards:   { xp: finalXP, coins: finalCoins, crystals: finalCrystals },
                gotBonus:  gotBonus,
                bonusType: goalData.bonus_type
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error claiming goal reward:', error);
            return { success: false, error: error.message };
        } finally {
            client.release();
        }
    }

    /**
     * جلب المهام المكتملة والقابلة للاستلام
     */
    async getClaimableGoals(userId) {
        try {
            const row = await this.get(
                'SELECT * FROM user_goals WHERE user_id = $1',
                [userId]
            );

            if (!row) return [];

            const claimableGoals = [];

            const checkGoal = (goalJson, completed, claimed, goalType) => {
                if (!completed || claimed || !goalJson) return;
                try {
                    const g = typeof goalJson === 'string' ? JSON.parse(goalJson) : goalJson;
                    claimableGoals.push({
                        rowId:       row.goal_id,
                        goalType:    goalType,
                        title:       g.title,
                        description: g.description,
                        rewards: {
                            xp:       g.assigned_xp,
                            coins:    g.assigned_coins,
                            crystals: g.assigned_crystals
                        }
                    });
                } catch (e) {
                    console.error(`Error parsing ${goalType}:`, e);
                }
            };

            checkGoal(row.daily_goal1,  row.daily1_completed,  row.daily1_claimed,  'daily1');
            checkGoal(row.daily_goal2,  row.daily2_completed,  row.daily2_claimed,  'daily2');
            checkGoal(row.daily_goal3,  row.daily3_completed,  row.daily3_claimed,  'daily3');
            checkGoal(row.weekly_goal,  row.weekly_completed,  row.weekly_claimed,  'weekly');
            checkGoal(row.weekly_goal2, row.weekly2_completed, row.weekly2_claimed, 'weekly2');

            return claimableGoals;

        } catch (error) {
            console.error('Error getting claimable goals:', error);
            return [];
        }
    }

    /**
     * إحصائيات المهام للمستخدم
     */
    async getUserGoalsStats(userId) {
        try {
            const rows = await this.all(
                'SELECT * FROM user_goals WHERE user_id = $1',
                [userId]
            );

            let totalGoals = 0, completedGoals = 0, claimedGoals = 0, bonusGoals = 0;
            let totalXp = 0, totalCoins = 0, totalCrystals = 0;

            const processGoal = (goalJson, completed, claimed, bonus) => {
                if (!goalJson) return;
                try {
                    const g = typeof goalJson === 'string' ? JSON.parse(goalJson) : goalJson;
                    totalGoals++;
                    totalXp       += g.assigned_xp      || 0;
                    totalCoins    += g.assigned_coins    || 0;
                    totalCrystals += g.assigned_crystals || 0;
                    if (completed) completedGoals++;
                    if (claimed)   claimedGoals++;
                    if (bonus)     bonusGoals++;
                } catch (e) {
                    console.error('Error parsing goal stats:', e);
                }
            };

            for (const row of rows) {
                processGoal(row.daily_goal1,  row.daily1_completed,  row.daily1_claimed,  row.daily1_bonus);
                processGoal(row.daily_goal2,  row.daily2_completed,  row.daily2_claimed,  row.daily2_bonus);
                processGoal(row.daily_goal3,  row.daily3_completed,  row.daily3_claimed,  row.daily3_bonus);
                processGoal(row.weekly_goal,  row.weekly_completed,  row.weekly_claimed,  row.weekly_bonus);
                processGoal(row.weekly_goal2, row.weekly2_completed, row.weekly2_claimed, row.weekly2_bonus);
            }

            return {
                total_goals:           totalGoals,
                completed_goals:       completedGoals,
                claimed_goals:         claimedGoals,
                bonus_goals:           bonusGoals,
                total_xp_earned:       totalXp,
                total_coins_earned:    totalCoins,
                total_crystals_earned: totalCrystals
            };

        } catch (error) {
            console.error('Error getting user goals stats:', error);
            return null;
        }
    }

    /**
     * مسح الأهداف القديمة
     */
    async cleanupOldGoals(daysToKeep = 30) {
        try {
            const result = await this.run(
                `DELETE FROM user_goals 
                 WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days' 
                 AND daily1_claimed = true AND daily2_claimed = true AND weekly_claimed = true`,
                []
            );

            if (result.changes > 0) {
                console.log(`🧹 Cleaned ${result.changes} old goals`);
            }

            return { success: true, cleaned: result.changes };
        } catch (error) {
            console.error('Error cleaning old goals:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== GLOBAL CHALLENGES FUNCTIONS ==========

    /**
     * حفظ التارجتات الجديدة للسيرفر
     */
    async saveGlobalChallengeTargets(guildId, targets) {
        try {
            console.log(`💾 Saving targets for guild ${guildId}:`, targets);

            const query = `
                INSERT INTO global_challenges 
                (guild_id, 
                 star_target, comet_target, nebula_target, meteoroid_target,
                 before_star_target, star_comet_target, comet_nebula_target, 
                 nebula_meteoroid_target, voice_challenge_target)  -- ⭐⭐ أضف هذا ⭐⭐
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)  -- ⭐⭐ أضف $10 ⭐⭐
                ON CONFLICT (guild_id) 
                DO UPDATE SET 
                    star_target = $2,
                    comet_target = $3,
                    nebula_target = $4,
                    meteoroid_target = $5,
                    before_star_target = $6,
                    star_comet_target = $7,
                    comet_nebula_target = $8,
                    nebula_meteoroid_target = $9,
                    voice_challenge_target = $10,  -- ⭐⭐ أضف هذا ⭐⭐
                    star_reached = false,
                    comet_reached = false,
                    nebula_reached = false,
                    meteoroid_reached = false,
                    before_star_completed = false,
                    star_comet_completed = false,
                    comet_nebula_completed = false,
                    nebula_meteoroid_completed = false,
                    voice_challenge_completed = false,  -- ⭐⭐ أضف هذا ⭐⭐
                    messages_in_current_cycle = 0,
                    updated_at = CURRENT_TIMESTAMP
            `;

            const params = [
                guildId,
                targets.star_target || 0,
                targets.comet_target || 0,
                targets.nebula_target || 0,
                targets.meteoroid_target || 0,
                targets.before_star_target || 0,
                targets.star_comet_target || 0,
                targets.comet_nebula_target || 0,
                targets.nebula_meteoroid_target || 0,
                targets.voice_challenge_target || 0  // ⭐⭐ أضف هذا ⭐⭐
            ];

            await this.run(query, params);
            console.log(`✅ Successfully saved targets for guild ${guildId}`);
            return { success: true };

        } catch (error) {
            console.error('❌ Error saving global challenge targets:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * تحديد Between Target كـ مكتمل
     */
    async markBetweenTargetCompleted(guildId, targetType) {
        try {
            console.log(`✅ Marking ${targetType} as completed for guild ${guildId}`);
            const field = `${targetType}_completed`;

            const query = `
                UPDATE global_challenges 
                SET ${field} = true,
                    updated_at = CURRENT_TIMESTAMP
                WHERE guild_id = $1
            `;

            await this.run(query, [guildId]);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error marking ${targetType} as completed:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب التحدي مع التارجتس
     */
    async getGlobalChallengeWithTargets(guildId) {
        try {
            const query = `SELECT * FROM global_challenges WHERE guild_id = $1`;
            const challenge = await this.get(query, [guildId]);

            if (!challenge) {
                console.log(`⚠️ No challenge found for guild ${guildId}`);
                return null;
            }

            console.log(`📊 Found challenge for guild ${guildId}:`, {
                star_target: challenge.star_target,
                messages_in_current_cycle: challenge.messages_in_current_cycle  // 👈 هنا اتغيرت
            });

            return challenge;

        } catch (error) {
            console.error('❌ Error getting global challenge with targets:', error);
            return null;
        }
    }

    /**
     * إنشاء أو تحديث التحدي للسيرفر
     */
    async createOrUpdateGlobalChallenge(guildId, data = {}) {
        try {
            const existing = await this.get(
                'SELECT * FROM global_challenges WHERE guild_id = ?',
                [guildId]
            );

            if (existing) {
                // تحديث التحدي الموجود
                const setClause = [];
                const params = [];

                if (data.current_targets) {
                    setClause.push('current_targets = ?');
                    params.push(JSON.stringify(data.current_targets));
                }

                if (data.challenge_type) {
                    setClause.push('challenge_type = ?');
                    params.push(data.challenge_type);
                }

                if (data.challenge_description) {
                    setClause.push('challenge_description = ?');
                    params.push(data.challenge_description);
                }

                if (data.challenge_end_time) {
                    setClause.push('challenge_end_time = ?');
                    params.push(data.challenge_end_time);
                }

                if (data.messages_in_current_cycle !== undefined) {
                    setClause.push('messages_in_current_cycle = ?');
                    params.push(data.messages_in_current_cycle);
                }

                if (setClause.length > 0) {
                    setClause.push('updated_at = CURRENT_TIMESTAMP');
                    params.push(guildId);

                    await this.run(
                        `UPDATE global_challenges SET ${setClause.join(', ')} WHERE guild_id = ?`,
                        params
                    );
                }

                return { success: true, action: 'updated', guildId };
            } else {
                // إنشاء تحد جديد
                const defaultTargets = {
                    star: 150,
                    comet: 400,
                    nebula: 700,
                    meteoroid: 1300
                };

                await this.run(
                    `INSERT INTO global_challenges 
                     (guild_id, current_targets, challenge_type, challenge_description,
                      challenge_duration_minutes, challenge_end_time, messages_in_current_cycle) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        guildId,
                        JSON.stringify(data.current_targets || defaultTargets),
                        data.challenge_type || 'mention_bot',
                        data.challenge_description || 'Mention the bot the fastest!',
                        data.challenge_duration_minutes || 60,
                        data.challenge_end_time || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                        0  // 👈 نبدأ من صفر
                    ]
                );

                return { success: true, action: 'created', guildId };
            }
        } catch (error) {
            console.error('❌ Error creating/updating global challenge:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب بيانات التحدي
     */
    async getGlobalChallenge(guildId) {
        try {
            const result = await this.get(
                'SELECT * FROM global_challenges WHERE guild_id = ?',
                [guildId]
            );

            if (result) {
                try {
                    if (result.current_targets && typeof result.current_targets === 'string') {
                        result.current_targets = JSON.parse(result.current_targets);
                    }
                    if (result.winners_list && typeof result.winners_list === 'string') {
                        result.winners_list = JSON.parse(result.winners_list);
                    }
                } catch (e) {
                    console.error('Error parsing JSON in global challenge:', e);
                }
            }

            return result;
        } catch (error) {
            console.error('❌ Error getting global challenge:', error);
            return null;
        }
    }

    /**
     * زيادة عداد الرسائل في الدورة الحالية فقط
     */
    async incrementGlobalChallengeMessages(guildId, amount = 1) {
        try {
            // 1. زود العدادين
            await this.run(
                `UPDATE global_challenges 
                 SET messages_in_current_cycle = messages_in_current_cycle + ?,
                     total_messages = total_messages + ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE guild_id = ?`,
                [amount, amount, guildId]
            );

            // 2. رجع القيم الجديدة
            const updated = await this.get(
                'SELECT messages_in_current_cycle, total_messages FROM global_challenges WHERE guild_id = ?',
                [guildId]
            );

            console.log(`📊 ${guildId}: Cycle=${updated.messages_in_current_cycle}, Total=${updated.total_messages}`);

            return { 
                success: true, 
                cycleCount: updated.messages_in_current_cycle,
                totalCount: updated.total_messages 
            };

        } catch (error) {
            console.error('❌ Error incrementing global challenge messages:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * تحديد Level كـ مكتمل
     */
    async markChallengeLevelReached(guildId, level) {
        try {
            const field = `${level}_reached`;
            await this.run(
                `UPDATE global_challenges 
                 SET ${field} = true,
                     total_${level}_challenges = total_${level}_challenges + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE guild_id = ?`,
                [guildId]
            );

            return { success: true };
        } catch (error) {
            console.error(`❌ Error marking ${level} level as reached:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * إعادة تعيين التحدي (بعد meteoroid)
     */
    async resetGlobalChallenge(guildId, newTargets = null) {
        try {
            const defaultTargets = newTargets || {
                star: Math.floor(Math.random() * 100) + 50,
                comet: Math.floor(Math.random() * 200) + 200,
                nebula: Math.floor(Math.random() * 300) + 400,
                meteoroid: Math.floor(Math.random() * 500) + 800
            };

            const now = new Date();
            const endTime = new Date(now.getTime() + 60 * 60 * 1000);

            await this.run(
                `UPDATE global_challenges 
                 SET messages_in_current_cycle = 0,  // 👈 نبدأ من صفر
                     current_targets = ?,
                     star_reached = false,
                     comet_reached = false,
                     nebula_reached = false,
                     meteoroid_reached = false,
                     before_star_completed = false,
                     star_comet_completed = false,
                     comet_nebula_completed = false,
                     nebula_meteoroid_completed = false,
                     challenge_type = 'mention_bot',
                     challenge_description = 'Mention the bot the fastest!',
                     challenge_duration_minutes = 60,
                     challenge_end_time = ?,
                     current_winner = NULL,
                     winners_list = '[]',
                     rewards_distributed = false,
                     last_challenge_reset = CURRENT_TIMESTAMP,
                     total_cycles = total_cycles + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE guild_id = ?`,
                [JSON.stringify(defaultTargets), endTime.toISOString(), guildId]
            );

            return { success: true, newTargets: defaultTargets };
        } catch (error) {
            console.error('❌ Error resetting global challenge:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * تسجيل الفائز بالتحدي
     */
    async recordChallengeWinner(guildId, userId, username, challengeType, messageContent = '') {
        try {
            const challenge = await this.getGlobalChallenge(guildId);
            let winnersList = [];

            if (challenge && challenge.winners_list) {
                winnersList = Array.isArray(challenge.winners_list) 
                    ? challenge.winners_list 
                    : (typeof challenge.winners_list === 'string' 
                        ? JSON.parse(challenge.winners_list) 
                        : []);
            }

            const winnerData = {
                userId: userId,
                username: username,
                timestamp: new Date().toISOString(),
                challengeType: challengeType,
                messageContent: messageContent.substring(0, 100)
            };

            winnersList.push(winnerData);

            await this.run(
                `UPDATE global_challenges 
                 SET current_winner = ?,
                     winners_list = ?,
                     challenge_end_time = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE guild_id = ?`,
                [userId, JSON.stringify(winnersList), guildId]
            );

            return { success: true, winnerData };
        } catch (error) {
            console.error('❌ Error recording challenge winner:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب أفضل السيرفرات (برضو على أساس total_messages عشان الإحصائيات)
     */
    async getTopGlobalChallengeGuilds(limit = 10) {
        try {
            return await this.all(
                `SELECT guild_id, total_messages, total_cycles,
                        total_star_challenges, total_comet_challenges,
                        total_nebula_challenges, total_meteoroid_challenges
                 FROM global_challenges 
                 ORDER BY total_messages DESC 
                 LIMIT ?`,
                [limit]
            );
        } catch (error) {
            console.error('❌ Error getting top global challenge guilds:', error);
            return [];
        }
    }

    /**
     * جلب التحديات النشطة
     */
    async getActiveGlobalChallenges() {
        try {
            return await this.all(
                `SELECT * FROM global_challenges 
                 WHERE challenge_end_time > NOW() 
                 AND current_winner IS NULL
                 ORDER BY challenge_end_time ASC`
            );
        } catch (error) {
            console.error('❌ Error getting active global challenges:', error);
            return [];
        }
    }

    /**
     * تنظيف التحديات المنتهية
     */
    async cleanupExpiredGlobalChallenges() {
        try {
            const result = await this.run(
                `UPDATE global_challenges 
                 SET challenge_end_time = NOW() + INTERVAL '1 hour',
                     current_winner = NULL
                 WHERE challenge_end_time < NOW() - INTERVAL '2 hour'
                 AND current_winner IS NULL`
            );

            return { success: true, cleaned: result.changes };
        } catch (error) {
            console.error('❌ Error cleaning up expired global challenges:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * تحديث إحصائيات التحدي
     */
    async updateChallengeStatistics(guildId, level) {
        try {
            const field = `total_${level}_challenges`;
            await this.run(
                `UPDATE global_challenges 
                 SET ${field} = ${field} + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE guild_id = ?`,
                [guildId]
            );

            return { success: true };
        } catch (error) {
            console.error(`❌ Error updating ${level} statistics:`, error);
            return { success: false, error: error.message };
        }
    }

    // ========== DISCOUNT LOTTERY SYSTEM ==========

    /**
     * Run daily discount lottery (Fixed - ONE ITEM ONLY)
     */
    async runDailyDiscountLottery() {
        try {
            console.log('🎰 Starting daily discount lottery...');

            // 1. Calculate today's chance
            const lotteryResult = await this.runDailyLotteryLogic();
            const successChance = lotteryResult.successChance;
            const currentDay = lotteryResult.currentDay;

            // 2. Try lottery
            const randomRoll = Math.random() * 100;
            const isSuccess = randomRoll <= successChance;

            if (!isSuccess) {
                console.log(`🎰 Lottery FAILED! Rolled ${randomRoll.toFixed(2)} > ${successChance}% chance`);
                console.log(`📊 Day ${currentDay}: ${successChance}% chance ✗ FAILED → Keep OLD discount`);

                const newFailures = await this.updateLotteryFailure();

                // ⭐⭐ جلب التخفيض الحالي لو في ⭐⭐
                const currentDiscounts = await this.getCurrentDiscountedItems();
                let currentDiscountMessage = 'No current discount';

                if (currentDiscounts.length > 0) {
                    const currentItem = currentDiscounts[0];
                    currentDiscountMessage = `Current discount remains: ${currentItem.description || currentItem.role_id} (${currentItem.current_discount}% off)`;
                }

                return { 
                    success: false, 
                    message: 'Lottery failed - Keep old discount', 
                    chance: successChance,
                    nextDayChance: Math.min(successChance * 2, 100),
                    day: currentDay,
                    failures: newFailures,
                    currentDiscount: currentDiscounts.length > 0 ? currentDiscounts[0] : null,
                    code: 'LOTTERY_FAILED'
                };
            }

            console.log(`🎰 Lottery SUCCESS! Day ${currentDay}, ${successChance}% chance`);
            console.log(`📊 Day ${currentDay}: ${successChance}% chance ✓ SUCCESS → NEW discount on ONE item`);

            // ⭐⭐⭐ 3. FIRST: Remove OLD discount ONLY if lottery succeeded ⭐⭐⭐
            await this.resetAllDiscounts();
            console.log('🔄 Removed old discount to apply new one');

            // 4. Get eligible items (items WITHOUT discount)
            const eligibleItems = await this.all(
                `SELECT * FROM shop_items 
                 WHERE discount_chance > 0 
                 AND current_discount = 0
                 ORDER BY RANDOM()`
            );

            if (eligibleItems.length === 0) {
                console.log('🎰 No eligible items for discount lottery');
                return { 
                    success: false, 
                    message: 'No eligible items for discount lottery',
                    code: 'NO_ELIGIBLE_ITEMS'
                };
            }

            console.log(`🎰 Found ${eligibleItems.length} eligible items after reset`);

            // 5. Select ONE item only
            const selectedItem = await this.selectSingleItemForDiscount(eligibleItems);
            if (!selectedItem) {
                console.log('❌ Failed to select item');
                return { 
                    success: false, 
                    message: 'Failed to select item',
                    code: 'SELECTION_FAILED' 
                };
            }

            // 6. Generate discount
            let discountPercentage = this.generateRandomDiscount();

            // Verify discount value
            console.log(`🔍 Generated discount: ${discountPercentage}% (type: ${typeof discountPercentage})`);

            if (typeof discountPercentage !== 'number' || isNaN(discountPercentage)) {
                console.warn(`⚠️ Invalid discount generated: ${discountPercentage}, using default 20%`);
                discountPercentage = 20;
            }

            // 7. Apply discount to the ONE item
            const applied = await this.applyDiscountToItem(selectedItem.id, discountPercentage);
            if (!applied) {
                return { 
                    success: false, 
                    message: 'Failed to apply discount',
                    code: 'APPLICATION_FAILED'
                };
            }

            // 8. Reset failure counter
            await this.resetLotteryFailure();

            // Get updated item data
            const updatedItem = await this.getShopItemById(selectedItem.id);

            console.log(`✅ Applied NEW ${discountPercentage}% discount to item: ${selectedItem.description || selectedItem.role_id}`);
            console.log(`🔄 OLD discount removed, NEW discount applied`);

            return {
                success: true,
                message: '🎉 NEW DISCOUNT APPLIED TO ONE ITEM!',
                item: {
                    id: updatedItem.id,
                    role_id: updatedItem.role_id,
                    name: updatedItem.description || `Role ${updatedItem.role_id}`
                },
                discount: discountPercentage,
                chance: successChance,
                day: currentDay,
                old_price_coins: updatedItem.original_price_coins,
                old_price_crystals: updatedItem.original_price_crystals,
                new_price_coins: updatedItem.discounted_price_coins || Math.floor(updatedItem.original_price_coins * (1 - discountPercentage/100)),
                new_price_crystals: updatedItem.discounted_price_crystals || Math.floor(updatedItem.original_price_crystals * (1 - discountPercentage/100))
            };

        } catch (error) {
            console.error('❌ Error in daily discount lottery:', error);
            console.error('📊 Full error details:', error.stack);
            return { 
                success: false, 
                error: error.message,
                code: 'UNEXPECTED_ERROR'
            };
        }
    }

    /**
     * Daily lottery logic calculation
     */
    async runDailyLotteryLogic() {
        try {
            const lastLottery = await this.get(
                `SELECT * FROM bot_settings 
                 WHERE setting_key = 'daily_discount_lottery'`
            );

            if (!lastLottery) {
                await this.run(
                    `INSERT INTO bot_settings (setting_key, setting_value) 
                     VALUES ('daily_discount_lottery', ?)`,
                    [JSON.stringify({
                        last_run: new Date().toISOString(),
                        consecutive_failures: 0,
                        current_day: 1,
                        total_lotteries: 0,
                        successful_lotteries: 0
                    })]
                );

                return { successChance: 12.5, currentDay: 1 };
            }

            const data = JSON.parse(lastLottery.setting_value || '{}');
            const failures = data.consecutive_failures || 0;
            const currentDay = Math.min(failures + 1, 4);

            const successChances = { 1: 12.5, 2: 25, 3: 50, 4: 100 };
            const successChance = successChances[currentDay];

            return {
                successChance: successChance,
                currentDay: currentDay,
                consecutiveFailures: failures,
                totalLotteries: data.total_lotteries || 0,
                successfulLotteries: data.successful_lotteries || 0
            };

        } catch (error) {
            console.error('❌ Error in lottery logic:', error);
            return { successChance: 12.5, currentDay: 1 };
        }
    }

    /**
     * Select single item based on chances
     */
    async selectSingleItemForDiscount(items) {
        try {
            if (items.length === 0) return null;

            const totalChance = items.reduce((sum, item) => sum + (item.discount_chance || 0), 0);

            if (totalChance === 0) {
                // If all chances are 0, select randomly
                const randomIndex = Math.floor(Math.random() * items.length);
                return items[randomIndex];
            }

            const randomValue = Math.random() * totalChance;
            let cumulativeChance = 0;

            for (const item of items) {
                cumulativeChance += (item.discount_chance || 0);
                if (randomValue <= cumulativeChance) {
                    console.log(`🎯 Selected item: ${item.id} (chance: ${item.discount_chance}%)`);
                    return item;
                }
            }

            return items[0];

        } catch (error) {
            console.error('❌ Error selecting item:', error);
            return items[0] || null;
        }
    }

    /**
     * Generate random discount (10-40% with 5% increments)
     */
    generateRandomDiscount() {
        const possibleDiscounts = [10, 15, 20, 25, 30, 35, 40];

        // Probability weights
        const weights = {
            10: 0.35,   // 35% chance
            15: 0.25,   // 25% chance
            20: 0.20,   // 20% chance
            25: 0.10,   // 10% chance
            30: 0.05,   // 5% chance
            35: 0.03,   // 3% chance
            40: 0.02    // 2% chance
        };

        const random = Math.random();
        let cumulativeWeight = 0;

        for (const discount of possibleDiscounts) {
            cumulativeWeight += weights[discount];
            if (random <= cumulativeWeight) {
                console.log(`🎯 Generated discount: ${discount}%`);
                return discount;
            }
        }

        // Default 15%
        return 15;
    }

    /**
     * Apply discount to item (Fixed)
     */
    async applyDiscountToItem(itemId, discountPercentage) {
        try {
            console.log(`🔧 Applying discount to item ${itemId}: ${discountPercentage}%`);

            // Verify discountPercentage is a number
            if (typeof discountPercentage !== 'number' || isNaN(discountPercentage)) {
                console.error(`❌ Invalid discount percentage: ${discountPercentage}, type: ${typeof discountPercentage}`);
                console.error('📊 Debug info:', { 
                    itemId, 
                    discountPercentage, 
                    type: typeof discountPercentage 
                });

                // Use safe default value
                discountPercentage = parseInt(discountPercentage) || 15;
                console.log(`🔄 Using fallback discount: ${discountPercentage}%`);
            }

            // Verify value is within allowed range
            if (discountPercentage < 5 || discountPercentage > 100) {
                console.warn(`⚠️ Discount percentage out of range: ${discountPercentage}%, clamping to 15-40%`);
                discountPercentage = Math.max(5, Math.min(40, discountPercentage));
            }

            const item = await this.get('SELECT * FROM shop_items WHERE id = ?', [itemId]);
            if (!item) {
                console.error(`❌ Item ${itemId} not found`);
                return false;
            }

            // Calculate discounted prices
            const discountedCoins = Math.floor(item.original_price_coins * (1 - discountPercentage / 100));
            const discountedCrystals = Math.floor(item.original_price_crystals * (1 - discountPercentage / 100));

            console.log(`📊 Discount calculation for item ${itemId}:`);
            console.log(`   - Original coins: ${item.original_price_coins}`);
            console.log(`   - Original crystals: ${item.original_price_crystals}`);
            console.log(`   - Discount: ${discountPercentage}%`);
            console.log(`   - Discounted coins: ${discountedCoins}`);
            console.log(`   - Discounted crystals: ${discountedCrystals}`);

            // Verify values before update
            const params = [
                discountPercentage, // number
                discountedCoins,    // number
                discountedCrystals, // number
                itemId              // number
            ];

            console.log(`📝 SQL Parameters:`, params.map((p, i) => `$${i+1}=${p} (${typeof p})`).join(', '));

            await this.run(
                `UPDATE shop_items 
                 SET current_discount = ?,
                     discounted_price_coins = ?,
                     discounted_price_crystals = ?,
                     is_on_sale = true,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                params
            );

            console.log(`✅ Applied ${discountPercentage}% discount to item ${itemId}`);

            // Update lottery statistics
            await this.updateLotteryStats(true);

            return true;

        } catch (error) {
            console.error('❌ Error applying discount:', error);
            console.error('📊 Context:', {
                itemId,
                discountPercentage,
                errorMessage: error.message,
                errorStack: error.stack
            });
            return false;
        }
    }

    /**
     * Update lottery failure
     */
    async updateLotteryFailure() {
        try {
            const lastLottery = await this.get(
                `SELECT * FROM bot_settings 
                 WHERE setting_key = 'daily_discount_lottery'`
            );

            let newFailures = 1;
            let lotteryData = {};

            if (lastLottery) {
                try {
                    lotteryData = JSON.parse(lastLottery.setting_value || '{}');
                    newFailures = Math.min((lotteryData.consecutive_failures || 0) + 1, 4);
                } catch (parseError) {
                    console.log('⚠️ Error parsing lottery data, using defaults');
                    newFailures = 1;
                    lotteryData = {
                        total_lotteries: 0,
                        successful_lotteries: 0
                    };
                }
            }

            await this.updateLotteryStats(false);

            // New data for update
            const updatedData = {
                last_run: new Date().toISOString(),
                consecutive_failures: newFailures,
                current_day: newFailures,
                total_lotteries: (lotteryData.total_lotteries || 0) + 1,
                successful_lotteries: lotteryData.successful_lotteries || 0
            };

            await this.run(
                `INSERT INTO bot_settings (setting_key, setting_value) 
                 VALUES ('daily_discount_lottery', ?)
                 ON CONFLICT (setting_key) 
                 DO UPDATE SET setting_value = ?,
                              updated_at = CURRENT_TIMESTAMP`,
                [
                    JSON.stringify(updatedData),
                    JSON.stringify(updatedData)
                ]
            );

            console.log(`📊 Lottery failures: ${newFailures}/4 (Day ${newFailures})`);
            return newFailures;

        } catch (error) {
            console.error('❌ Error updating lottery failure:', error);
            return 1;
        }
    }

    /**
     * Reset lottery failure
     */
    async resetLotteryFailure() {
        try {
            const lastLottery = await this.get(
                `SELECT * FROM bot_settings 
                 WHERE setting_key = 'daily_discount_lottery'`
            );

            let lotteryData = {};
            if (lastLottery) {
                try {
                    lotteryData = JSON.parse(lastLottery.setting_value || '{}');
                } catch (parseError) {
                    console.log('⚠️ Error parsing lottery data in reset');
                    lotteryData = {
                        total_lotteries: 0,
                        successful_lotteries: 0
                    };
                }
            }

            const resetData = {
                last_run: new Date().toISOString(),
                consecutive_failures: 0,
                current_day: 1,
                total_lotteries: (lotteryData.total_lotteries || 0) + 1,
                successful_lotteries: (lotteryData.successful_lotteries || 0) + 1
            };

            await this.run(
                `UPDATE bot_settings 
                 SET setting_value = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE setting_key = 'daily_discount_lottery'`,
                [JSON.stringify(resetData)]
            );

            console.log('🔄 Lottery reset to Day 1 (12.5% chance)');
            return true;

        } catch (error) {
            console.error('❌ Error resetting lottery:', error);
            return false;
        }
    }

    /**
     * Update lottery statistics
     */
    async updateLotteryStats(isSuccess) {
        try {
            const lastLottery = await this.get(
                `SELECT * FROM bot_settings 
                 WHERE setting_key = 'daily_discount_lottery'`
            );

            if (!lastLottery) return;

            const data = JSON.parse(lastLottery.setting_value || '{}');

            await this.run(
                `UPDATE bot_settings 
                 SET setting_value = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE setting_key = 'daily_discount_lottery'`,
                [JSON.stringify({
                    ...data,
                    total_lotteries: (data.total_lotteries || 0) + 1,
                    successful_lotteries: (data.successful_lotteries || 0) + (isSuccess ? 1 : 0),
                    last_run: new Date().toISOString()
                })]
            );

        } catch (error) {
            console.error('❌ Error updating lottery stats:', error);
        }
    }

    /**
     * Clean old discounts
     */
    async cleanupOldDiscounts() {
        try {
            const result = await this.run(
                `UPDATE shop_items 
                 SET current_discount = 0,
                     discounted_price_coins = 0,
                     discounted_price_crystals = 0,
                     is_on_sale = false,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE is_on_sale = true 
                 AND updated_at < NOW() - INTERVAL '7 days'`
            );

            if (result.changes > 0) {
                console.log(`🧹 Cleaned ${result.changes} old discounts`);
            }

            return result.changes;
        } catch (error) {
            console.error('❌ Error cleaning old discounts:', error);
            return 0;
        }
    }

    /**
     * Get current lottery status
     */
    async getLotteryStatus() {
        try {
            const lastLottery = await this.get(
                `SELECT * FROM bot_settings 
                 WHERE setting_key = 'daily_discount_lottery'`
            );

            if (!lastLottery) {
                return {
                    currentDay: 1,
                    successChance: 12.5,
                    consecutiveFailures: 0,
                    totalLotteries: 0,
                    successfulLotteries: 0,
                    lastRun: null
                };
            }

            const data = JSON.parse(lastLottery.setting_value || '{}');
            const failures = data.consecutive_failures || 0;
            const currentDay = Math.min(failures + 1, 4);
            const successChances = { 1: 12.5, 2: 25, 3: 50, 4: 100 };

            return {
                currentDay: currentDay,
                successChance: successChances[currentDay],
                consecutiveFailures: failures,
                totalLotteries: data.total_lotteries || 0,
                successfulLotteries: data.successful_lotteries || 0,
                lastRun: data.last_run,
                nextLotteryIn: this.calculateNextLotteryTime(data.last_run)
            };

        } catch (error) {
            console.error('❌ Error getting lottery status:', error);
            return null;
        }
    }

    /**
     * Calculate time until next lottery
     */
    calculateNextLotteryTime(lastRun) {
        if (!lastRun) return 'Unknown';

        const lastRunDate = new Date(lastRun);
        const now = new Date();
        const twelveHours = 12 * 60 * 60 * 1000;

        const nextRun = new Date(lastRunDate.getTime() + twelveHours);
        const timeLeft = nextRun - now;

        if (timeLeft <= 0) return 'Now';

        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m`;
    }

    /**
     * Get current discounted items
     */
    async getCurrentDiscountedItems() {
        try {
            return await this.all(
                `SELECT * FROM shop_items 
                 WHERE is_on_sale = true 
                 AND current_discount > 0
                 ORDER BY current_discount DESC`
            );
        } catch (error) {
            console.error('❌ Error getting discounted items:', error);
            return [];
        }
    }

    /**
     * Reset ALL discounts (For admin use)
     */
    async resetAllDiscounts() {
        try {
            // ⭐⭐ Reset only ACTIVE discounts (not ALL items) ⭐⭐
            const result = await this.run(
                `UPDATE shop_items 
                 SET current_discount = 0,
                     discounted_price_coins = 0,
                     discounted_price_crystals = 0,
                     is_on_sale = false,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE is_on_sale = true AND current_discount > 0`
            );

            console.log(`🔄 Reset ${result.changes} active discount(s)`);
            return result.changes || 0;
        } catch (error) {
            console.error('❌ Error resetting all discounts:', error);
            return 0;
        }
    }

    // ⭐⭐⭐ NEW FUNCTION: Remove discount when item is purchased ⭐⭐⭐
    /**
     * Remove discount from purchased item
     * Call this in shop command after successful purchase
     */
    async removeDiscountOnPurchase(itemId) {
        try {
            console.log(`🔄 Removing discount from purchased item ${itemId}`);

            await this.run(
                `UPDATE shop_items 
                 SET current_discount = 0,
                     discounted_price_coins = 0,
                     discounted_price_crystals = 0,
                     is_on_sale = false,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND is_on_sale = true`,
                [itemId]
            );

            console.log(`✅ Removed discount from purchased item ${itemId}`);
            return true;
        } catch (error) {
            console.error(`❌ Error removing discount after purchase:`, error);
            return false;
        }
    }

    // COUPON SYSTEM
    async createCoupon(userId, username, discountPercentage, sourceType, sourceData = {}) {
        try {
            const couponCode = `CPN-${Date.now().toString(36).toUpperCase()}`;

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 14);

            // نستخدم source_drop_type لنتعرف على المصدر
            const sourceDropType = sourceType === 'event' ? 'event_reward' : sourceData.dropType;

            await this.run(
                `INSERT INTO shop_coupons 
                 (coupon_code, user_id, username, discount_percentage, 
                  expires_at, source_drop_type, source_crate_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    couponCode, 
                    userId, 
                    username, 
                    discountPercentage,
                    expiresAt.toISOString(),
                    sourceDropType,  // نستخدم source_drop_type للمصدر
                    sourceData.crateId || null
                ]
            );

            console.log(`🎫 Created ${sourceType} coupon: ${couponCode} (${discountPercentage}% off)`);

            return {
                success: true,
                couponCode: couponCode,
                discountPercentage: discountPercentage,
                expiresAt: expiresAt,
                validForDays: 14,
                source: sourceType
            };

        } catch (error) {
            console.error('❌ Error creating coupon:', error.message);
            return null;
        }
    }

    async getRandomShopItem(maxDiscountChance = 10) {
        try {
            // نستخدم الجدول الموجود shop_items
            const items = await this.all(
                `SELECT * FROM shop_items 
                 WHERE discount_chance <= ? 
                 AND discount_chance > 0
                 ORDER BY RANDOM() 
                 LIMIT 1`,
                [maxDiscountChance]
            );

            return items[0] || null;
        } catch (error) {
            console.error('❌ Error getting random shop item:', error.message);
            return null;
        }
    }

    async getCouponsBySourceType(userId, sourceType) {
        try {
            // نستخدم source_drop_type للتمييز
            let query = `SELECT * FROM shop_coupons WHERE user_id = ?`;
            let params = [userId];

            if (sourceType === 'drop') {
                query += ` AND source_drop_type IN ('common', 'rare', 'epic', 'legendary')`;
            } else if (sourceType === 'event') {
                query += ` AND source_drop_type = 'event_reward'`;
            }

            query += ` AND is_used = false AND expires_at > CURRENT_TIMESTAMP ORDER BY expires_at ASC`;

            return await this.all(query, params);
        } catch (error) {
            console.error('❌ Error getting coupons by source:', error.message);
            return [];
        }
    }

    /**
     * توليد تخفيض عشوائي (10-40% بزيادات 5%) - مصححة
     */
    generateRandomDiscount() {
        try {
            const possibleDiscounts = [10, 15, 20, 25, 30, 35, 40];

            // الأوزان الاحتمالية
            const weights = {
                10: 0.35,   // 35% فرصة
                15: 0.25,   // 25% فرصة
                20: 0.20,   // 20% فرصة
                25: 0.10,   // 10% فرصة
                30: 0.05,   // 5% فرصة
                35: 0.03,   // 3% فرصة
                40: 0.02    // 2% فرصة
            };

            const random = Math.random();
            let cumulativeWeight = 0;

            for (const discount of possibleDiscounts) {
                cumulativeWeight += weights[discount];
                if (random <= cumulativeWeight) {
                    console.log(`🎯 Generated discount: ${discount}% (type: number)`);
                    return discount; // تأكد من إرجاع رقم
                }
            }

            // الإفتراضي 15% إذا فشل كل شيء
            console.log(`🎯 Using default discount: 15%`);
            return 15;
        } catch (error) {
            console.error('❌ Error in generateRandomDiscount:', error);
            return 20; // قيمة آمنة افتراضية
        }
    }

    // ========== SKYWELL - ZEFT MASBOUT ==========

    async updateCoinThrow(userId, coinAmount, username = 'Unknown') {
        try {
            await this.run(
                `INSERT INTO skywell_users (user_id, username, total_coins_thrown, throw_count, highest_single_throw, last_throw_at, first_throw_at)
                 VALUES ($1, $2, $3, 1, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id) 
                 DO UPDATE SET 
                    total_coins_thrown = skywell_users.total_coins_thrown + $3,
                    throw_count = skywell_users.throw_count + 1,
                    highest_single_throw = GREATEST(skywell_users.highest_single_throw, $3),
                    last_throw_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP`,
                [userId, username, coinAmount]
            );

            return { success: true };
        } catch (error) {
            console.error('Error updateCoinThrow:', error.message);
            return { success: false, error: error.message };
        }
    }

    async updateCrystalThrow(userId, crystalAmount, username = 'Unknown') {
        try {
            const convertedCoins = crystalAmount * 175;

            await this.run(
                `INSERT INTO skywell_users (user_id, username, total_crystals_thrown, total_converted_coins, throw_count, last_throw_at, first_throw_at)
                 VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id) 
                 DO UPDATE SET 
                    total_crystals_thrown = skywell_users.total_crystals_thrown + $3,
                    total_converted_coins = skywell_users.total_converted_coins + $4,
                    throw_count = skywell_users.throw_count + 1,
                    last_throw_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP`,
                [userId, username, crystalAmount, convertedCoins]
            );

            return { success: true, convertedCoins: convertedCoins };
        } catch (error) {
            console.error('Error updateCrystalThrow:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getSkywellStats(userId) {
        try {
            const user = await this.get(
                'SELECT * FROM skywell_users WHERE user_id = $1',
                [userId]
            );

            if (!user) return null;

            // ✅ استخدم current_level مش currentLevel
            const totalEffective = (user.total_coins_thrown || 0) + (user.total_converted_coins || 0);

            let currentLevel = 0;
            let nextLevelCoins = 0;
            let progress = 0;

            if (totalEffective >= 50000) {
                currentLevel = 5;
                progress = 100;
            } else if (totalEffective >= 30000) {
                currentLevel = 4;
                nextLevelCoins = 50000 - totalEffective;
                progress = Math.floor(((totalEffective - 30000) / 20000) * 100);
            } else if (totalEffective >= 15000) {
                currentLevel = 3;
                nextLevelCoins = 30000 - totalEffective;
                progress = Math.floor(((totalEffective - 15000) / 15000) * 100);
            } else if (totalEffective >= 5000) {
                currentLevel = 2;
                nextLevelCoins = 15000 - totalEffective;
                progress = Math.floor(((totalEffective - 5000) / 10000) * 100);
            } else if (totalEffective >= 500) {  // ⚠️ لاحظ 500 مش 100
                currentLevel = 1;
                nextLevelCoins = 5000 - totalEffective;
                progress = Math.floor(((totalEffective - 500) / 4500) * 100);
            }

            return {
                ...user,
                totalEffectiveCoins: totalEffective,
                current_level: currentLevel,  // ✅ استخدم current_level
                nextLevelCoins: nextLevelCoins,
                progress: progress
            };
        } catch (error) {
            console.error('❌ Error getSkywellStats:', error.message);
            return null;
        }
    }

    async updateSkywellLevel(userId, newLevel, newRoleId = null) {
        try {
            console.log(`📝 Updating skywell level for ${userId}: Level ${newLevel}, Role ${newRoleId}`);

            // استخدم UPDATE مباشرة مع RETURNING
            const result = await this.pool.query(
                `UPDATE skywell_users 
                 SET current_level = $1, 
                     current_role_id = $2, 
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = $3
                 RETURNING *`,
                [newLevel, newRoleId, userId]
            );

            if (result.rows.length > 0) {
                console.log(`✅ Skywell level updated:`, result.rows[0]);
                return { success: true, data: result.rows[0] };
            } else {
                console.log(`⚠️ User not found, creating new record...`);
                // لو المستخدم مش موجود، اعمل insert
                const insertResult = await this.pool.query(
                    `INSERT INTO skywell_users (user_id, username, current_level, current_role_id)
                     VALUES ($1, $2, $3, $4)
                     RETURNING *`,
                    [userId, 'Unknown', newLevel, newRoleId]
                );
                return { success: true, data: insertResult.rows[0] };
            }
        } catch (error) {
            console.error('❌ Error updateSkywellLevel:', error.message);
            return { success: false, error: error.message };
        }
    }

    // دالة لجلب بيانات المستخدم الأساسية
    async getUserProfile(userId) {
        try {
            return await this.get(
                `SELECT * FROM levels WHERE user_id = ?`,
                [userId]
            );
        } catch (error) {
            console.error('❌ Failed to get user profile:', error.message);
            return null;
        }
    }

    // دالة لجلب إحصائيات الرسائل للمستخدم
    async getUserMessageStats(userId, period = 'total') {
        try {
            return await this.get(
                `SELECT * FROM message_stats WHERE user_id = ?`,
                [userId]
            );
        } catch (error) {
            console.error('❌ Failed to get user message stats:', error.message);
            return null;
        }
    }

    // دالة لجلب إحصائيات Skywell
    async getSkywellStats(userId) {
        try {
            const user = await this.get(
                'SELECT * FROM skywell_users WHERE user_id = ?',
                [userId]
            );

            if (!user) return null;

            const totalEffective = (user.total_coins_thrown || 0) + (user.total_converted_coins || 0);

            let currentLevel = 0;
            let nextLevelCoins = 0;
            let progress = 0;

            if (totalEffective >= 50000) {
                currentLevel = 5;
                progress = 100;
            } else if (totalEffective >= 30000) {
                currentLevel = 4;
                nextLevelCoins = 50000 - totalEffective;
                progress = Math.floor(((totalEffective - 30000) / 20000) * 100);
            } else if (totalEffective >= 15000) {
                currentLevel = 3;
                nextLevelCoins = 30000 - totalEffective;
                progress = Math.floor(((totalEffective - 15000) / 15000) * 100);
            } else if (totalEffective >= 5000) {
                currentLevel = 2;
                nextLevelCoins = 15000 - totalEffective;
                progress = Math.floor(((totalEffective - 5000) / 10000) * 100);
            } else if (totalEffective >= 100) {
                currentLevel = 1;
                nextLevelCoins = 5000 - totalEffective;
                progress = Math.floor(((totalEffective - 100) / 4900) * 100);
            }

            return {
                ...user,
                totalEffectiveCoins: totalEffective,
                currentLevel: currentLevel,
                nextLevelCoins: nextLevelCoins,
                progress: progress
            };
        } catch (error) {
            console.error('❌ Error getSkywellStats:', error.message);
            return null;
        }
    }

    // ============================================================
    // ========== GIVEAWAY SYSTEM - COMPLETE FUNCTIONS ==========
    // ============================================================

    /**
     * إنشاء جيفاواي جديد
     */
    async createGiveaway(data) {
        try {
            const {
                giveawayCode, template, duration, endsAt, winnersCount,
                entryType, entryValues, multiplier, reqRoleId, banRoleId,
                hostId, hostName, imageUrl, schedule, guildId, messageId, channelId,
                status = 'active' // <-- جديد
            } = data;

            const result = await this.run(
                `INSERT INTO giveaways 
                 (giveaway_code, channel_id, message_id, template, duration, end_time, 
                  winners_count, entry_type, entry_values, multiplier, reqrole, banrole, 
                  host_id, image_url, schedule, status, entries, winners)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'{}'::jsonb,'[]'::jsonb)
                 RETURNING id`,
                [giveawayCode, channelId, messageId, template, duration, endsAt,
                 winnersCount, entryType, entryValues, multiplier, reqRoleId, banRoleId,
                 hostId, imageUrl, schedule, status]
            );
            return { success: true, id: result.id, giveawayCode };
        } catch (error) {
            console.error('❌ createGiveaway:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب جيفاواي نشط بالكود
     */
    async getActiveGiveawayByCode(giveawayCode) {
        try {
            return await this.get(
                `SELECT * FROM giveaways WHERE giveaway_code = $1 AND status = 'active'`,
                [giveawayCode]
            );
        } catch (error) {
            console.error('❌ getActiveGiveawayByCode:', error);
            return null;
        }
    }

    /**
     * جلب جيفاواي بالكود (أي حالة)
     */
    async getGiveawayByCode(giveawayCode) {
        try {
            return await this.get(`SELECT * FROM giveaways WHERE giveaway_code = $1`, [giveawayCode]);
        } catch (error) {
            console.error('❌ getGiveawayByCode:', error);
            return null;
        }
    }

    /**
     * جلب جيفاواي برسالة ID
     */
    async getGiveawayByMessageId(messageId) {
        try {
            return await this.get(`SELECT * FROM giveaways WHERE message_id = $1`, [messageId]);
        } catch (error) {
            console.error('❌ getGiveawayByMessageId:', error);
            return null;
        }
    }

    /**
     * جلب كل الجيفاواي النشطة (كل السيرفرات)
     */
    async getActiveGiveaways() {
        try {
            return await this.all(`SELECT * FROM giveaways WHERE status = 'active' ORDER BY end_time ASC`);
        } catch (error) {
            console.error('❌ getActiveGiveaways:', error);
            return [];
        }
    }

    /**
     * جلب كل الجيفاواي (للمسؤول)
     */
    async getAllGiveaways(limit = 100, offset = 0) {
        try {
            return await this.all(
                `SELECT * FROM giveaways ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
                [limit, offset]
            );
        } catch (error) {
            console.error('❌ getAllGiveaways:', error);
            return [];
        }
    }

    /**
     * جلب جيفاواي المستخدم (اللي أنشأها)
     */
    async getUserGiveaways(userId, limit = 50) {
        try {
            return await this.all(
                `SELECT * FROM giveaways WHERE host_id = $1 ORDER BY created_at DESC LIMIT $2`,
                [userId, limit]
            );
        } catch (error) {
            console.error('❌ getUserGiveaways:', error);
            return [];
        }
    }

    /**
     * جلب الجيفاواي اللي شارك فيها المستخدم (مصححة لـ entries المركبة)
     */
    async getUserParticipatedGiveaways(userId, limit = 50) {
        try {
            // البحث عن وجود userId داخل قيم entries (كائن يحتوي على userId)
            return await this.all(
                `SELECT * FROM giveaways 
                 WHERE status = 'ended' 
                 AND entries::jsonb @> jsonb_build_object($1::text, '{}')
                 ORDER BY created_at DESC 
                 LIMIT $2`,
                [userId, limit]
            );
        } catch (error) {
            console.error('❌ getUserParticipatedGiveaways:', error);
            return [];
        }
    }

    /**
     * التحقق من عدد الجيفاواي النشطة لمستخدم معين
     */
    async checkUserActiveGiveaways(userId) {
        try {
            const result = await this.get(
                `SELECT COUNT(*) as count FROM giveaways WHERE host_id = $1 AND status = 'active'`,
                [userId]
            );
            return result ? parseInt(result.count) : 0;
        } catch (error) {
            console.error('❌ checkUserActiveGiveaways:', error);
            return 0;
        }
    }

    // ============================================================
    // 2. PARTICIPANT MANAGEMENT
    // ============================================================

    /**
     * إضافة مشارك مع دعم نوع الدخول والوزن (يُخزن كائن)
     */
    async addParticipant(giveawayCode, userId, username, entryType = 'default', roleIdForEntry = null, customWeight = 1) {
        try {
            const giveaway = await this.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) return { success: false, error: 'Giveaway not found' };

            let entries = giveaway.entries || {};
            const compositeKey = `${userId}:${entryType}`;

            // السماح بالبونص حتى لو كان موجوداً مسبقاً (سيتم زيادة الوزن بدلاً من الإضافة المكررة)
            let weight = customWeight || 1;
            if (entryType === 'bonus') weight = 2;
            else if (entryType === 'GCD') weight = 2;

            // إذا كان الدخول موجوداً مسبقاً وليس بونص، نرفض
            if (entryType !== 'bonus' && entries[compositeKey]) {
                return { success: false, error: 'Already joined this entry type', code: 'ALREADY_JOINED_TYPE' };
            }

            // إذا كان بونص وموجود مسبقاً، نضاعف الوزن بدلاً من إضافة كيان جديد (حسب منطقك)
            if (entryType === 'bonus' && entries[compositeKey]) {
                entries[compositeKey].weight = (entries[compositeKey].weight || 1) + weight;
            } else {
                entries[compositeKey] = {
                    userId,
                    username,
                    type: entryType,
                    weight,
                    roleId: roleIdForEntry,
                    joinedAt: new Date().toISOString()
                };
            }

            await this.run(
                `UPDATE giveaways SET entries = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE giveaway_code = $2`,
                [JSON.stringify(entries), giveawayCode]
            );

            const uniqueParticipants = new Set(Object.values(entries).map(e => e.userId)).size;
            return { success: true, participantsCount: uniqueParticipants, entries };
        } catch (error) {
            console.error('❌ addParticipant:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * إزالة مشارك (بنوع محدد أو الكل)
     */
    async removeParticipant(giveawayCode, userId, entryType = null) {
        try {
            const giveaway = await this.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) return { success: false, error: 'Giveaway not found' };

            let entries = giveaway.entries || {};
            const beforeCount = Object.keys(entries).length;

            if (entryType) {
                const compositeKey = `${userId}:${entryType}`;
                if (entries[compositeKey]) {
                    delete entries[compositeKey];
                } else {
                    return { success: false, error: 'Not a participant of this type' };
                }
            } else {
                for (const key of Object.keys(entries)) {
                    if (key.startsWith(`${userId}:`)) {
                        delete entries[key];
                    }
                }
            }

            if (Object.keys(entries).length === beforeCount) {
                return { success: false, error: 'Not a participant' };
            }

            await this.run(
                `UPDATE giveaways SET entries = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE giveaway_code = $2`,
                [JSON.stringify(entries), giveawayCode]
            );

            const uniqueParticipants = new Set(Object.values(entries).map(e => e.userId)).size;
            return { success: true, participantsCount: uniqueParticipants, entries };
        } catch (error) {
            console.error('❌ removeParticipant:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب عدد المشاركين (عدد كائنات entries)
     */
    async getParticipantCount(giveawayCode) {
        try {
            const giveaway = await this.getGiveawayByCode(giveawayCode);
            return giveaway ? Object.keys(giveaway.entries || {}).length : 0;
        } catch (error) {
            console.error('❌ getParticipantCount:', error);
            return 0;
        }
    }

    /**
     * جلب قائمة المشاركين (مفاتيح entries)
     */
    async getParticipants(giveawayCode) {
        try {
            const giveaway = await this.getGiveawayByCode(giveawayCode);
            return giveaway ? Object.keys(giveaway.entries || {}) : [];
        } catch (error) {
            console.error('❌ getParticipants:', error);
            return [];
        }
    }

    /**
     * التحقق إذا كان المستخدم مشارك في أي نوع
     */
    async isParticipant(giveawayCode, userId) {
        try {
            const giveaway = await this.getGiveawayByCode(giveawayCode);
            if (!giveaway) return false;
            const entries = giveaway.entries || {};
            return Object.keys(entries).some(key => key.startsWith(`${userId}:`));
        } catch (error) {
            console.error('❌ isParticipant:', error);
            return false;
        }
    }

    // ============================================================
    // 3. WINNER MANAGEMENT (محدثة بنظام الأوزان)
    // ============================================================

    /**
     * إنهاء الجيفاواي واختيار الفائزين بنظام الأوزان (عام)
     * (غير مستخدمة حالياً، ولكن تبقى للتوافق)
     */
    async endGiveaway(giveawayCode) {
        try {
            const giveaway = await this.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) return { success: false, error: 'Giveaway not found' };

            const entries = giveaway.entries || {};
            const entryList = Object.values(entries);
            const winnersCount = giveaway.winners_count || 1;

            if (entryList.length === 0) {
                await this.run(`UPDATE giveaways SET status = 'ended' WHERE giveaway_code = $1`, [giveawayCode]);
                return { success: true, noParticipants: true, participantsCount: 0 };
            }

            let weightedList = [];
            for (const entry of entryList) {
                const weight = entry.weight || 1;
                for (let i = 0; i < weight; i++) {
                    weightedList.push({ userId: entry.userId, type: entry.type });
                }
            }

            const winners = [];
            const shuffled = [...weightedList].sort(() => 0.5 - Math.random());
            for (let i = 0; i < shuffled.length && winners.length < winnersCount; i++) {
                winners.push(shuffled[i]);
            }

            await this.run(
                `UPDATE giveaways SET status = 'ended', winners = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE giveaway_code = $2`,
                [JSON.stringify(winners), giveawayCode]
            );

            const uniqueParticipants = new Set(entryList.map(e => e.userId)).size;
            return { success: true, winners, participantsCount: uniqueParticipants };
        } catch (error) {
            console.error('❌ endGiveaway:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * تحديث الفائزين (للـ reroll)
     */
    async updateGiveawayWinners(giveawayCode, newWinners) {
        try {
            await this.run(
                `UPDATE giveaways SET winners = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE giveaway_code = $2`,
                [JSON.stringify(newWinners), giveawayCode]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ updateGiveawayWinners:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب الفائزين (مصفوفة كائنات)
     */
    async getGiveawayWinners(giveawayCode) {
        try {
            const giveaway = await this.getGiveawayByCode(giveawayCode);
            return giveaway?.winners || [];
        } catch (error) {
            console.error('❌ getGiveawayWinners:', error);
            return [];
        }
    }

    /**
     * التحقق إذا كان المستخدم فائز
     */
    async isWinner(giveawayCode, userId) {
        try {
            const winners = await this.getGiveawayWinners(giveawayCode);
            return winners.some(w => w.userId === userId);
        } catch (error) {
            console.error('❌ isWinner:', error);
            return false;
        }
    }

    // ============================================================
    // 4. GIVEAWAY MANAGEMENT (Edit/Delete/Cancel)
    // ============================================================

    async cancelGiveaway(giveawayCode) {
        try {
            await this.run(
                `UPDATE giveaways SET status = 'cancelled' WHERE giveaway_code = $1 AND status = 'active'`,
                [giveawayCode]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ cancelGiveaway:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteGiveaway(giveawayCode) {
        try {
            await this.run(`DELETE FROM giveaways WHERE giveaway_code = $1`, [giveawayCode]);
            return { success: true };
        } catch (error) {
            console.error('❌ deleteGiveaway:', error);
            return { success: false, error: error.message };
        }
    }

    async updateGiveawayMessage(giveawayCode, newMessageId, newChannelId) {
        try {
            await this.run(
                `UPDATE giveaways SET message_id = $1, channel_id = $2 WHERE giveaway_code = $3`,
                [newMessageId, newChannelId, giveawayCode]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ updateGiveawayMessage:', error);
            return { success: false, error: error.message };
        }
    }

    async extendGiveaway(giveawayCode, additionalMinutes) {
        try {
            await this.run(
                `UPDATE giveaways SET end_time = end_time + ($1 || ' minutes')::interval WHERE giveaway_code = $2 AND status = 'active'`,
                [additionalMinutes, giveawayCode]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ extendGiveaway:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================================
    // 5. RESTORE FUNCTIONS (لـ GiveawaysBack)
    // ============================================================

    async getExpiredActiveGiveaways() {
        try {
            return await this.all(`SELECT * FROM giveaways WHERE status = 'active' AND end_time <= CURRENT_TIMESTAMP`);
        } catch (error) {
            console.error('❌ getExpiredActiveGiveaways:', error);
            return [];
        }
    }

    async getActiveGiveawaysForRestore() {
        try {
            return await this.all(`SELECT * FROM giveaways WHERE status = 'active' AND end_time > CURRENT_TIMESTAMP`);
        } catch (error) {
            console.error('❌ getActiveGiveawaysForRestore:', error);
            return [];
        }
    }

    // ============================================================
    // 6. STATISTICS FUNCTIONS (مصححة لـ JSONB)
    // ============================================================

    async getGiveawayStats() {
        try {
            const result = await this.get(`
                SELECT 
                    COUNT(*) as total_giveaways,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_giveaways,
                    COUNT(CASE WHEN status = 'ended' THEN 1 END) as ended_giveaways,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_giveaways,
                    COALESCE(AVG(jsonb_array_length(COALESCE(winners, '[]'::jsonb))), 0) as avg_winners,
                    COALESCE(MAX(jsonb_array_length(COALESCE(winners, '[]'::jsonb))), 0) as max_winners
                FROM giveaways
            `);
            return {
                total_giveaways: parseInt(result?.total_giveaways) || 0,
                active_giveaways: parseInt(result?.active_giveaways) || 0,
                ended_giveaways: parseInt(result?.ended_giveaways) || 0,
                cancelled_giveaways: parseInt(result?.cancelled_giveaways) || 0,
                avg_winners: parseFloat(result?.avg_winners) || 0,
                max_winners: parseInt(result?.max_winners) || 0
            };
        } catch (error) {
            console.error('❌ getGiveawayStats:', error);
            return { total_giveaways: 0, active_giveaways: 0, ended_giveaways: 0, cancelled_giveaways: 0, avg_winners: 0, max_winners: 0 };
        }
    }

    async getUserGiveawayStats(userId) {
        try {
            // عدد الجيفاواي التي أنشأها
            const created = await this.get(
                `SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'active' THEN 1 END) as active FROM giveaways WHERE host_id = $1`,
                [userId]
            );

            // عدد الجيفاواي التي شارك فيها (تم تعديل الاستعلام لـ entries المركبة)
            const participated = await this.get(
                `SELECT COUNT(*) as total FROM giveaways 
                 WHERE status = 'ended' 
                 AND entries::jsonb @> jsonb_build_object($1::text, '{}')`,
                [userId]
            );

            // عدد مرات الفوز
            const won = await this.get(
                `SELECT COUNT(*) as total FROM giveaways 
                 WHERE status = 'ended' 
                 AND winners::jsonb @> jsonb_build_array(jsonb_build_object('userId', $1))`,
                [userId]
            );

            return {
                created: { total: parseInt(created?.total) || 0, active: parseInt(created?.active) || 0 },
                participated: parseInt(participated?.total) || 0,
                won: parseInt(won?.total) || 0
            };
        } catch (error) {
            console.error('❌ getUserGiveawayStats:', error);
            return { created: { total: 0, active: 0 }, participated: 0, won: 0 };
        }
    }

    async getTopWinners(limit = 10) {
        try {
            // استخراج userId من مصفوفة winners
            return await this.all(
                `SELECT winner->>'userId' as winner_id, COUNT(*) as wins 
                 FROM giveaways, jsonb_array_elements(winners) as winner 
                 WHERE status = 'ended' 
                 GROUP BY winner_id 
                 ORDER BY wins DESC 
                 LIMIT $1`,
                [limit]
            );
        } catch (error) {
            console.error('❌ getTopWinners:', error);
            return [];
        }
    }

    async getTopHosts(limit = 10) {
        try {
            return await this.all(
                `SELECT host_id, COUNT(*) as total_giveaways FROM giveaways GROUP BY host_id ORDER BY total_giveaways DESC LIMIT $1`,
                [limit]
            );
        } catch (error) {
            console.error('❌ getTopHosts:', error);
            return [];
        }
    }

    // ============================================================
    // 7. CLEANUP FUNCTIONS
    // ============================================================

    async cleanupOldGiveaways(daysToKeep = 30) {
        try {
            const result = await this.run(
                `DELETE FROM giveaways WHERE status IN ('ended', 'cancelled') AND end_time < CURRENT_TIMESTAMP - ($1 || ' days')::interval`,
                [daysToKeep]
            );
            console.log(`🧹 Cleaned ${result.changes} old giveaways`);
            return { success: true, cleaned: result.changes };
        } catch (error) {
            console.error('❌ cleanupOldGiveaways:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== دوال الجدولة الجديدة ==========

    /**
     * جلب الجيفاواي المجدولة التي حان وقتها (للاستخدام عند بدء التشغيل)
     */
    async getScheduledGiveawaysReadyToStart() {
        return await this.all(
            `SELECT * FROM giveaways WHERE status = 'scheduled' AND schedule <= NOW()`
        );
    }

    /**
     * جلب جميع الجيفاواي المجدولة التي لم يحن وقتها بعد (لإعادة ضبط الـ setTimeout)
     */
    async getPendingScheduledGiveaways() {
        return await this.all(
            `SELECT * FROM giveaways WHERE status = 'scheduled' AND schedule > NOW()`
        );
    }

    /**
     * تفعيل الجيفاواي المجدول بعد النشر (تحديث status, message_id, channel_id)
     */
    async activateScheduledGiveaway(giveawayCode, messageId, channelId) {
        await this.run(
            `UPDATE giveaways SET status = 'active', message_id = $1, channel_id = $2, updated_at = NOW() WHERE giveaway_code = $3`,
            [messageId, channelId, giveawayCode]
        );
    }
    
}

// إنشاء وتصدير نسخة واحدة من مدير قاعدة البيانات
const dbManager = new DatabaseManager();
module.exports = dbManager;