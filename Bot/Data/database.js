const { Pool } = require('pg');
const path = require('path');

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
                `CREATE TABLE IF NOT EXISTS community_giveaways (
                    id SERIAL PRIMARY KEY,
                    giveaway_code VARCHAR(20) UNIQUE NOT NULL,

                    -- بيانات الجيفاواي الأساسية
                    game_name TEXT NOT NULL,
                    game_link TEXT,
                    platform TEXT NOT NULL,
                    image_url TEXT NOT NULL,
                    embed_color TEXT,
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
                )`,

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
                    guild_id TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    message_id TEXT DEFAULT NULL, -- nullable لأن المجدول ليس له رسالة بعد

                    template TEXT DEFAULT NULL,
                    title TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    color INTEGER DEFAULT 7536639, -- 0x0073ff

                    duration TEXT NOT NULL,
                    end_time TIMESTAMPTZ NOT NULL,
                    schedule TIMESTAMPTZ DEFAULT NULL, -- وقت البدء المؤجل

                    winners_count INTEGER DEFAULT 1,
                    entry_type TEXT DEFAULT 'messages',
                    entry_values JSONB DEFAULT NULL,
                    multiplier JSONB DEFAULT NULL,

reqrole TEXT[] DEFAULT '{}'::TEXT[],
req_role_mode TEXT DEFAULT 'n',
banrole TEXT[] DEFAULT '{}'::TEXT[],
bypass_role_id TEXT[] DEFAULT '{}'::TEXT[],
bypass_role_mode TEXT DEFAULT 'n',

                    host_id TEXT NOT NULL,
                    host_name TEXT DEFAULT NULL,
                    image_url TEXT DEFAULT NULL,

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

                `CREATE INDEX IF NOT EXISTS idx_community_giveaways_code ON community_giveaways(giveaway_code)`,
                `CREATE INDEX IF NOT EXISTS idx_community_giveaways_active ON community_giveaways(is_active, ends_at)`,
                `CREATE INDEX IF NOT EXISTS idx_community_giveaways_host ON community_giveaways(host_id)`,
                `CREATE INDEX IF NOT EXISTS idx_community_giveaways_guild ON community_giveaways(guild_id)`,
                `CREATE INDEX IF NOT EXISTS idx_community_giveaways_message ON community_giveaways(message_id)`,
                `CREATE INDEX IF NOT EXISTS idx_community_giveaways_ended ON community_giveaways(is_ended, ended_at)`,
                `CREATE INDEX IF NOT EXISTS idx_community_giveaways_participants ON community_giveaways USING gin(participants)`,
                `CREATE INDEX IF NOT EXISTS idx_community_giveaways_winners ON community_giveaways USING gin(winners)`,
                `CREATE INDEX IF NOT EXISTS idx_community_giveaways_host_active ON community_giveaways(host_id, is_active)`,
                `CREATE INDEX IF NOT EXISTS idx_community_giveaways_confirmation ON community_giveaways(all_responded, host_rewarded)`,
                `CREATE INDEX IF NOT EXISTS idx_community_giveaways_confirm_count ON community_giveaways(confirm_count)`,
                `CREATE INDEX IF NOT EXISTS idx_community_giveaways_decline_count ON community_giveaways(decline_count)`,

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

    async getUserProfile(userId) {
        try {
            return await this.get('SELECT * FROM levels WHERE user_id = ?', [userId]);
        } catch (error) {
            console.error('❌ getUserProfile error:', error.message);
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

    // ============================================================
    // ========== GIVEAWAY SYSTEM - COMPLETE FUNCTIONS ==========
    // ============================================================

    /**
     * إنشاء جيفاواي جديد
     */
    async createGiveaway(data) {
        try {
            const {
                giveawayCode, guildId, channelId, messageId,
                template, title, description, color,
                duration, endsAt, schedule,
                winnersCount, entryType, entryValues, multiplier,
                reqRoleIds = [],        // مصفوفة IDs
                reqRoleMode = 'n',      // 'y' = ALL, 'n' = ANY
                banRoleIds = [],        // مصفوفة IDs
                bypassRoleIds = [],     // مصفوفة IDs
                bypassRoleMode = 'n',   // 'y' = ALL, 'n' = ANY
                hostId, hostName, imageUrl,
                status = 'active'
            } = data;

            // تحويل المصفوفات إلى صيغة PostgreSQL '{id1,id2}'
            const reqRoleArray = reqRoleIds.length ? `{${reqRoleIds.join(',')}}` : null;
            const banRoleArray = banRoleIds.length ? `{${banRoleIds.join(',')}}` : null;
            const bypassRoleArray = bypassRoleIds.length ? `{${bypassRoleIds.join(',')}}` : null;

            const result = await this.run(
                `INSERT INTO giveaways (
                    giveaway_code, guild_id, channel_id, message_id,
                    template, title, description, color,
                    duration, end_time, schedule,
                    winners_count, entry_type, entry_values, multiplier,
                    reqrole, req_role_mode, banrole,
                    bypass_role_id, bypass_role_mode,
                    host_id, host_name, image_url,
                    status, entries, winners
                )
                VALUES (
                    $1, $2, $3, $4,
                    $5, $6, $7, $8,
                    $9, $10, $11,
                    $12, $13, $14, $15,
                    $16::text[], $17, $18::text[],
                    $19::text[], $20,
                    $21, $22, $23,
                    $24, '{}'::jsonb, '[]'::jsonb
                )
                RETURNING id`,
                [
                    giveawayCode, guildId, channelId, messageId || null,
                    template || null, title || null, description || null, color ?? 0x0073ff,
                    duration, endsAt, schedule || null,
                    winnersCount || 1, entryType || 'messages', entryValues || null, multiplier || null,
                    reqRoleArray, reqRoleMode, banRoleArray,
                    bypassRoleArray, bypassRoleMode,
                    hostId, hostName || null, imageUrl || null,
                    status
                ]
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
            return await this.get(
                `SELECT * FROM giveaways WHERE giveaway_code = $1`,
                [giveawayCode]
            );
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
            return await this.get(
                `SELECT * FROM giveaways WHERE message_id = $1`,
                [messageId]
            );
        } catch (error) {
            console.error('❌ getGiveawayByMessageId:', error);
            return null;
        }
    }

    /**
     * جلب كل الجيفاواي النشطة
     */
    async getActiveGiveaways() {
        try {
            return await this.all(
                `SELECT * FROM giveaways WHERE status = 'active' ORDER BY end_time ASC`
            );
        } catch (error) {
            console.error('❌ getActiveGiveaways:', error);
            return [];
        }
    }

    /**
     * جلب كل الجيفاواي
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
     * جلب جيفاواي المستخدم
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
     * جلب الجيفاواي اللي شارك فيها المستخدم
     */
    async getUserParticipatedGiveaways(userId, limit = 50) {
        try {
            return await this.all(
                `SELECT *
                 FROM giveaways
                 WHERE status = 'ended'
                   AND EXISTS (
                       SELECT 1
                       FROM jsonb_each(COALESCE(entries, '{}'::jsonb)) AS e(key, value)
                       WHERE value->>'userId' = $1
                   )
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
            return result ? parseInt(result.count, 10) : 0;
        } catch (error) {
            console.error('❌ checkUserActiveGiveaways:', error);
            return 0;
        }
    }

    // ============================================================
    // 2. PARTICIPANT MANAGEMENT
    // ============================================================

    /**
     * إضافة مشارك مع دعم نوع الدخول والوزن
     */
    async addParticipant(giveawayCode, userId, username, entryType = 'default', roleIdForEntry = null, customWeight = 1, prizeLabel = null) {
        try {
            const giveaway = await this.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) return { success: false, error: 'Giveaway not found' };

            const entries = giveaway.entries || {};
            const compositeKey = `${userId}:${entryType}`;

            let weight = customWeight || 1;
            if (entryType === 'bonus') weight = 2;
            else if (entryType === 'GCD') weight = 2;

            if (entryType !== 'bonus' && entries[compositeKey]) {
                return { success: false, error: 'Already joined this entry type', code: 'ALREADY_JOINED_TYPE' };
            }

            if (entryType === 'bonus' && entries[compositeKey]) {
                entries[compositeKey].weight = (entries[compositeKey].weight || 1) + weight;
            } else {
                entries[compositeKey] = {
                    userId,
                    username,
                    type: entryType,
                    prizeLabel: prizeLabel || null,
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
     * جلب دخول مستخدم بنوع محدد
     */
    async getParticipantByType(giveawayCode, userId, entryType) {
        try {
            const giveaway = await this.getGiveawayByCode(giveawayCode);
            if (!giveaway) return null;

            const entries = giveaway.entries || {};
            return entries[`${userId}:${entryType}`] || null;
        } catch (error) {
            console.error('❌ getParticipantByType:', error);
            return null;
        }
    }

    /**
     * إزالة مشارك
     */
    async removeParticipant(giveawayCode, userId, entryType = null) {
        try {
            const giveaway = await this.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) return { success: false, error: 'Giveaway not found' };

            const entries = giveaway.entries || {};
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
                `UPDATE giveaways
                 SET entries = $1::jsonb, updated_at = CURRENT_TIMESTAMP
                 WHERE giveaway_code = $2`,
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
     * جلب عدد المشاركين
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
     * جلب قائمة المشاركين
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
     * التحقق إذا كان المستخدم مشارك
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
    // 3. WINNER MANAGEMENT
    // ============================================================

    /**
     * إنهاء الجيفاواي واختيار الفائزين
     */
    async endGiveaway(giveawayCode) {
        try {
            const giveaway = await this.getActiveGiveawayByCode(giveawayCode);
            if (!giveaway) return { success: false, error: 'Giveaway not found' };

            const entries = giveaway.entries || {};
            const entryList = Object.values(entries);
            const winnersCount = giveaway.winners_count || 1;

            if (entryList.length === 0) {
                await this.run(
                    `UPDATE giveaways SET status = 'ended', updated_at = CURRENT_TIMESTAMP WHERE giveaway_code = $1`,
                    [giveawayCode]
                );
                return { success: true, noParticipants: true, participantsCount: 0 };
            }

            const weightedList = [];
            for (const entry of entryList) {
                const weight = entry.weight || 1;
                for (let i = 0; i < weight; i++) {
                    weightedList.push({ userId: entry.userId, type: entry.type });
                }
            }

            const winners = [];
            const usedUserIds = new Set();

            while (winners.length < winnersCount && weightedList.length > 0) {
                const index = Math.floor(Math.random() * weightedList.length);
                const selected = weightedList[index];

                if (!usedUserIds.has(selected.userId)) {
                    winners.push(selected);
                    usedUserIds.add(selected.userId);
                }

                for (let i = weightedList.length - 1; i >= 0; i--) {
                    if (weightedList[i].userId === selected.userId) {
                        weightedList.splice(i, 1);
                    }
                }
            }

            await this.run(
                `UPDATE giveaways
                 SET status = 'ended', winners = $1::jsonb, updated_at = CURRENT_TIMESTAMP
                 WHERE giveaway_code = $2`,
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
     * تحديث الفائزين
     */
    async updateGiveawayWinners(giveawayCode, newWinners) {
        try {
            await this.run(
                `UPDATE giveaways
                 SET winners = $1::jsonb, updated_at = CURRENT_TIMESTAMP
                 WHERE giveaway_code = $2`,
                [JSON.stringify(newWinners), giveawayCode]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ updateGiveawayWinners:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب الفائزين
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
    // 4. GIVEAWAY MANAGEMENT
    // ============================================================

    async cancelGiveaway(giveawayCode) {
        try {
            await this.run(
                `UPDATE giveaways
                 SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
                 WHERE giveaway_code = $1 AND status IN ('active', 'scheduled')`,
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
                `UPDATE giveaways
                 SET message_id = $1, channel_id = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE giveaway_code = $3`,
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
                `UPDATE giveaways
                 SET end_time = end_time + ($1 || ' minutes')::interval,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE giveaway_code = $2 AND status = 'active'`,
                [additionalMinutes, giveawayCode]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ extendGiveaway:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================================
    // 5. RESTORE FUNCTIONS
    // ============================================================

    async getExpiredActiveGiveaways() {
        try {
            return await this.all(
                `SELECT * FROM giveaways WHERE status = 'active' AND end_time <= CURRENT_TIMESTAMP`
            );
        } catch (error) {
            console.error('❌ getExpiredActiveGiveaways:', error);
            return [];
        }
    }

    async getActiveGiveawaysForRestore() {
        try {
            return await this.all(
                `SELECT * FROM giveaways WHERE status = 'active' AND end_time > CURRENT_TIMESTAMP`
            );
        } catch (error) {
            console.error('❌ getActiveGiveawaysForRestore:', error);
            return [];
        }
    }

    // ============================================================
    // 6. STATISTICS FUNCTIONS
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
                total_giveaways: parseInt(result?.total_giveaways, 10) || 0,
                active_giveaways: parseInt(result?.active_giveaways, 10) || 0,
                ended_giveaways: parseInt(result?.ended_giveaways, 10) || 0,
                cancelled_giveaways: parseInt(result?.cancelled_giveaways, 10) || 0,
                avg_winners: parseFloat(result?.avg_winners) || 0,
                max_winners: parseInt(result?.max_winners, 10) || 0
            };
        } catch (error) {
            console.error('❌ getGiveawayStats:', error);
            return {
                total_giveaways: 0,
                active_giveaways: 0,
                ended_giveaways: 0,
                cancelled_giveaways: 0,
                avg_winners: 0,
                max_winners: 0
            };
        }
    }

    async getUserGiveawayStats(userId) {
        try {
            const created = await this.get(
                `SELECT
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active
                 FROM giveaways
                 WHERE host_id = $1`,
                [userId]
            );

            const participated = await this.get(
                `SELECT COUNT(*) as total
                 FROM giveaways
                 WHERE status = 'ended'
                   AND EXISTS (
                       SELECT 1
                       FROM jsonb_each(COALESCE(entries, '{}'::jsonb)) AS e(key, value)
                       WHERE value->>'userId' = $1
                   )`,
                [userId]
            );

            const won = await this.get(
                `SELECT COUNT(*) as total
                 FROM giveaways
                 WHERE status = 'ended'
                   AND EXISTS (
                       SELECT 1
                       FROM jsonb_array_elements(COALESCE(winners, '[]'::jsonb)) AS w
                       WHERE w->>'userId' = $1
                   )`,
                [userId]
            );

            return {
                created: {
                    total: parseInt(created?.total, 10) || 0,
                    active: parseInt(created?.active, 10) || 0
                },
                participated: parseInt(participated?.total, 10) || 0,
                won: parseInt(won?.total, 10) || 0
            };
        } catch (error) {
            console.error('❌ getUserGiveawayStats:', error);
            return { created: { total: 0, active: 0 }, participated: 0, won: 0 };
        }
    }

    async getTopWinners(limit = 10) {
        try {
            return await this.all(
                `SELECT w.value->>'userId' as winner_id, COUNT(*) as wins
                 FROM giveaways g,
                      jsonb_array_elements(COALESCE(g.winners, '[]'::jsonb)) AS w(value)
                 WHERE g.status = 'ended'
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
                `SELECT host_id, COUNT(*) as total_giveaways
                 FROM giveaways
                 GROUP BY host_id
                 ORDER BY total_giveaways DESC
                 LIMIT $1`,
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
                `DELETE FROM giveaways
                 WHERE status IN ('ended', 'cancelled')
                   AND end_time < CURRENT_TIMESTAMP - ($1 || ' days')::interval`,
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
     * جلب الجيفاواي المجدولة التي حان وقتها
     */
    async getScheduledGiveawaysReadyToStart() {
        try {
            return await this.all(
                `SELECT * FROM giveaways WHERE status = 'scheduled' AND schedule <= NOW()`
            );
        } catch (error) {
            console.error('❌ getScheduledGiveawaysReadyToStart:', error);
            return [];
        }
    }

    /**
     * جلب جميع الجيفاواي المجدولة التي لم يحن وقتها بعد
     */
    async getPendingScheduledGiveaways() {
        try {
            return await this.all(
                `SELECT * FROM giveaways WHERE status = 'scheduled' AND schedule > NOW()`
            );
        } catch (error) {
            console.error('❌ getPendingScheduledGiveaways:', error);
            return [];
        }
    }

    /**
     * تفعيل الجيفاواي المجدول بعد النشر
     */
    async activateScheduledGiveaway(giveawayCode, messageId, channelId) {
        try {
            await this.run(
                `UPDATE giveaways
                 SET status = 'active',
                     message_id = $1,
                     channel_id = $2,
                     updated_at = NOW()
                 WHERE giveaway_code = $3`,
                [messageId, channelId, giveawayCode]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ activateScheduledGiveaway:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================================
    // ========== COMMUNITY GIVEAWAYS SYSTEM (COMPLETE) ==========
    // ============================================================
    // جميع الدوال تستخدم جدول منفصل: community_giveaways
    // الأسماء مختلفة تماماً عن دوال giveaways العادية

    /**
     * إنشاء جيفاواي مجتمعي جديد
     */
    async createCommunityGiveaway(data) {
        try {
            const {
                giveawayCode, gameName, gameLink, platform, imageUrl,
                winnersCount, note, reqRoleId, messageReqType, messageReqAmount,
                endsAt, hostId, hostName, guildId, messageId, channelId, embedColor
            } = data;

            const result = await this.run(
                `INSERT INTO community_giveaways
                 (giveaway_code, game_name, game_link, platform, image_url, note, req_role_id,
                  winners_count, message_req_type, message_req_amount, ends_at, host_id, host_name,
                  guild_id, message_id, channel_id, participants, winners, is_active, is_ended, embed_color)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                 RETURNING id`,
                [
                    giveawayCode,
                    gameName,
                    gameLink || null,
                    platform,
                    imageUrl,
                    note || null,
                    reqRoleId || null,
                    winnersCount,
                    messageReqType || null,
                    messageReqAmount || null,
                    endsAt,
                    hostId,
                    hostName,
                    guildId,
                    messageId,
                    channelId,
                    '{}',
                    '{}',
                    true,
                    false,
                    embedColor || null
                ]
            );

            return { success: true, id: result.id };
        } catch (error) {
            console.error('❌ Error creating community giveaway:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب جيفاواي مجتمعي نشط بالكود
     */
    async getActiveCommunityGiveawayByCode(giveawayCode) {
        try {
            return await this.get(
                `SELECT * FROM community_giveaways
                 WHERE giveaway_code = $1 AND is_active = true AND is_ended = false`,
                [giveawayCode]
            );
        } catch (error) {
            console.error('❌ Error getting active community giveaway:', error.message);
            return null;
        }
    }

    /**
     * جلب جيفاواي مجتمعي برسالة ID
     */
    async getCommunityGiveawayByMessage(messageId) {
        try {
            return await this.get(
                `SELECT * FROM community_giveaways WHERE message_id = $1`,
                [messageId]
            );
        } catch (error) {
            console.error('❌ Error getting community giveaway by message:', error.message);
            return null;
        }
    }

    /**
     * جلب جيفاواي مجتمعي بالكود (أي حالة)
     */
    async getCommunityGiveawayByCode(giveawayCode) {
        try {
            return await this.get(
                `SELECT * FROM community_giveaways WHERE giveaway_code = $1`,
                [giveawayCode]
            );
        } catch (error) {
            console.error('❌ Error getting community giveaway by code:', error.message);
            return null;
        }
    }

    /**
     * إضافة مشارك لجيفاواي مجتمعي
     */
    async addCommunityGiveawayParticipant(giveawayCode, userId, username) {
        try {
            const client = await this.pool.connect();
            try {
                const giveaway = await client.query(
                    `SELECT * FROM community_giveaways
                     WHERE giveaway_code = $1 AND is_active = true AND is_ended = false`,
                    [giveawayCode]
                );
                if (giveaway.rows.length === 0) {
                    return { success: false, error: 'Giveaway not found' };
                }

                const currentParticipants = giveaway.rows[0].participants || [];
                if (currentParticipants.includes(userId)) {
                    return { success: false, error: 'Already joined', code: 'ALREADY_JOINED' };
                }

                const newParticipants = [...currentParticipants, userId];
                await client.query(
                    `UPDATE community_giveaways
                     SET participants = $1, updated_at = CURRENT_TIMESTAMP
                     WHERE giveaway_code = $2`,
                    [newParticipants, giveawayCode]
                );

                return { success: true, participantsCount: newParticipants.length, participants: newParticipants };
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('❌ Error adding community participant:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * إزالة مشارك من جيفاواي مجتمعي
     */
    async removeCommunityGiveawayParticipant(giveawayCode, userId) {
        try {
            const client = await this.pool.connect();
            try {
                const giveaway = await client.query(
                    `SELECT * FROM community_giveaways
                     WHERE giveaway_code = $1 AND is_active = true AND is_ended = false`,
                    [giveawayCode]
                );
                if (giveaway.rows.length === 0) {
                    return { success: false, error: 'Giveaway not found' };
                }

                const currentParticipants = giveaway.rows[0].participants || [];
                if (!currentParticipants.includes(userId)) {
                    return { success: false, error: 'Not a participant' };
                }

                const newParticipants = currentParticipants.filter(id => id !== userId);
                await client.query(
                    `UPDATE community_giveaways
                     SET participants = $1, updated_at = CURRENT_TIMESTAMP
                     WHERE giveaway_code = $2`,
                    [newParticipants, giveawayCode]
                );

                return { success: true, participantsCount: newParticipants.length, participants: newParticipants };
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('❌ Error removing community participant:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * إنهاء الجيفاواي المجتمعي واختيار الفائزين
     */
    async endCommunityGiveaway(giveawayCode) {
        try {
            const client = await this.pool.connect();
            try {
                const giveaway = await client.query(
                    `SELECT * FROM community_giveaways
                     WHERE giveaway_code = $1 AND is_active = true AND is_ended = false`,
                    [giveawayCode]
                );
                if (giveaway.rows.length === 0) {
                    return { success: false, error: 'Giveaway not found' };
                }

                const giveawayData = giveaway.rows[0];
                const participants = giveawayData.participants || [];
                const winnersCount = giveawayData.winners_count || 1;

                if (participants.length === 0) {
                    await client.query(
                        `UPDATE community_giveaways
                         SET is_active = false, is_ended = true, ended_at = CURRENT_TIMESTAMP
                         WHERE giveaway_code = $1`,
                        [giveawayCode]
                    );
                    return { success: true, noParticipants: true, message: 'No participants' };
                }

                let winners = [];
                if (participants.length <= winnersCount) {
                    winners = [...participants];
                } else {
                    const shuffled = [...participants].sort(() => 0.5 - Math.random());
                    winners = shuffled.slice(0, winnersCount);
                }

                await client.query(
                    `UPDATE community_giveaways
                     SET is_active = false, is_ended = true, ended_at = CURRENT_TIMESTAMP, winners = $1
                     WHERE giveaway_code = $2`,
                    [winners, giveawayCode]
                );

                return { success: true, winners, participantsCount: participants.length, gameName: giveawayData.game_name };
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('❌ Error ending community giveaway:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * تعليم أن الفائزين أخذوا الرتبة
     */
    async markCommunityGiveawayWinnerRewarded(giveawayCode) {
        try {
            await this.run(
                `UPDATE community_giveaways SET winner_rewarded = true, updated_at = CURRENT_TIMESTAMP WHERE giveaway_code = $1`,
                [giveawayCode]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ Error marking winner rewarded:', error.message);
            return { success: false };
        }
    }

    /**
     * جلب الجيفاواي المجتمعية المنتهية صلاحيتها
     */
    async getExpiredActiveCommunityGiveaways() {
        try {
            return await this.all(
                `SELECT * FROM community_giveaways
                 WHERE is_active = true AND is_ended = false AND ends_at <= CURRENT_TIMESTAMP`
            );
        } catch (error) {
            console.error('❌ Error getting expired community giveaways:', error.message);
            return [];
        }
    }

    /**
     * جلب الجيفاواي المجتمعية النشطة في سيرفر
     */
    async getActiveCommunityGiveaways(guildId) {
        try {
            return await this.all(
                `SELECT * FROM community_giveaways
                 WHERE guild_id = $1 AND is_active = true AND is_ended = false ORDER BY ends_at ASC`,
                [guildId]
            );
        } catch (error) {
            console.error('❌ Error getting active community giveaways:', error.message);
            return [];
        }
    }

    /**
     * جلب جيفاواي المستخدم (اللي أنشأها)
     */
    async getUserCommunityGiveaways(userId) {
        try {
            return await this.all(
                `SELECT * FROM community_giveaways WHERE host_id = $1 ORDER BY created_at DESC`,
                [userId]
            );
        } catch (error) {
            console.error('❌ Error getting user community giveaways:', error.message);
            return [];
        }
    }

    /**
     * جلب الجيفاواي المجتمعية اللي شارك فيها المستخدم
     */
    async getUserParticipatedCommunityGiveaways(userId) {
        try {
            return await this.all(
                `SELECT * FROM community_giveaways WHERE $1 = ANY(participants) ORDER BY created_at DESC`,
                [userId]
            );
        } catch (error) {
            console.error('❌ Error getting user participated community giveaways:', error.message);
            return [];
        }
    }

    /**
     * إعادة فتح جيفاواي مجتمعي
     */
    async reopenCommunityGiveaway(giveawayCode) {
        try {
            await this.run(
                `UPDATE community_giveaways
                 SET is_active = true,
                     is_ended = false,
                     ended_at = NULL,
                     winners = '{}'::text[],
                     winner_rewarded = false,
                     co_de_members = '[]'::jsonb,
                     confirm_count = 0,
                     decline_count = 0,
                     all_responded = false,
                     all_confirmed = false,
                     host_rewarded = false,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE giveaway_code = $1`,
                [giveawayCode]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ Error reopening community giveaway:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * حذف جيفاواي مجتمعي
     */
    async deleteCommunityGiveaway(giveawayCode) {
        try {
            await this.run(`DELETE FROM community_giveaways WHERE giveaway_code = $1`, [giveawayCode]);
            return { success: true };
        } catch (error) {
            console.error('❌ Error deleting community giveaway:', error.message);
            return { success: false };
        }
    }

    /**
     * تحديث رسالة الجيفاواي المجتمعي
     */
    async updateCommunityGiveawayMessage(giveawayCode, newMessageId, newChannelId) {
        try {
            await this.run(
                `UPDATE community_giveaways SET message_id = $1, channel_id = $2, updated_at = CURRENT_TIMESTAMP WHERE giveaway_code = $3`,
                [newMessageId, newChannelId, giveawayCode]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ Error updating community giveaway message:', error.message);
            return { success: false };
        }
    }

    /**
     * إحصائيات الجيفاواي المجتمعية لسيرفر
     */
    async getCommunityGiveawayStats(guildId) {
        try {
            const stats = await this.get(
                `SELECT
                    COUNT(*) as total_giveaways,
                    COUNT(CASE WHEN is_ended = true THEN 1 END) as ended_giveaways,
                    COUNT(CASE WHEN is_active = true THEN 1 END) as active_giveaways,
                    AVG(CARDINALITY(participants)) as avg_participants,
                    MAX(CARDINALITY(participants)) as max_participants
                 FROM community_giveaways
                 WHERE guild_id = $1`,
                [guildId]
            );
            return stats || { total_giveaways: 0, ended_giveaways: 0, active_giveaways: 0, avg_participants: 0, max_participants: 0 };
        } catch (error) {
            console.error('❌ Error getting community giveaway stats:', error.message);
            return null;
        }
    }

    /**
     * جلب الفائزين في جيفاواي مجتمعي
     */
    async getCommunityGiveawayWinners(giveawayCode) {
        try {
            const result = await this.get(
                `SELECT winners, winners_count FROM community_giveaways WHERE giveaway_code = $1`,
                [giveawayCode]
            );
            if (!result) return { winners: [], count: 1 };
            return { winners: result.winners || [], count: result.winners_count || 1 };
        } catch (error) {
            console.error('❌ Error getting community giveaway winners:', error.message);
            return { winners: [], count: 1 };
        }
    }

    /**
     * تحديث الفائزين (للـ reroll)
     */
    async updateCommunityGiveawayWinners(giveawayCode, newWinners) {
        try {
            if (!Array.isArray(newWinners)) newWinners = [newWinners];
            newWinners = newWinners.filter(Boolean);
            newWinners = [...new Set(newWinners)];

            await this.run(
                `UPDATE community_giveaways
                 SET winners = $1::text[],
                     winner_rewarded = false,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE giveaway_code = $2`,
                [newWinners, giveawayCode]
            );
            return { success: true, winners: newWinners };
        } catch (error) {
            console.error('❌ Error updating community giveaway winners:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * إزالة الفائزين
     */
    async removeCommunityGiveawayWinners(giveawayCode) {
        try {
            await this.run(
                `UPDATE community_giveaways
                 SET winners = '{}'::text[],
                     winner_rewarded = false,
                     co_de_members = '[]'::jsonb,
                     confirm_count = 0,
                     decline_count = 0,
                     all_responded = false,
                     all_confirmed = false,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE giveaway_code = $1`,
                [giveawayCode]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ Error removing community giveaway winners:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * التحقق إذا كان المستخدم فائز في جيفاواي مجتمعي
     */
    async isUserCommunityGiveawayWinner(giveawayCode, userId) {
        try {
            const result = await this.get(
                `SELECT winners FROM community_giveaways WHERE giveaway_code = $1`,
                [giveawayCode]
            );
            if (!result || !result.winners) return false;
            return result.winners.includes(userId);
        } catch (error) {
            console.error('❌ Error checking if user is winner:', error.message);
            return false;
        }
    }

    /**
     * تحديث الفائز بفائز جديد (لـ reroll العادي)
     */
    async updateCommunityGiveawayWinner(giveawayCode, newWinnerId) {
        try {
            await this.run(
                `UPDATE community_giveaways
                 SET winners = ARRAY[$1]::text[],
                     winner_rewarded = false,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE giveaway_code = $2`,
                [newWinnerId, giveawayCode]
            );
            return { success: true, winner: newWinnerId };
        } catch (error) {
            console.error('❌ Error updating community giveaway winner:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * تحديث الفائزين المتعددين (لـ reroll متعدد)
     */
    async updateCommunityGiveawayMultipleWinners(giveawayCode, winners) {
        try {
            if (!Array.isArray(winners)) winners = [winners];
            winners = winners.filter(w => w != null);
            winners = [...new Set(winners)];

            await this.run(
                `UPDATE community_giveaways
                 SET winners = $1::text[],
                     winner_rewarded = false,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE giveaway_code = $2`,
                [winners, giveawayCode]
            );
            return { success: true, winners };
        } catch (error) {
            console.error('❌ Error updating multiple winners:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * تحديث حالة فائز في الجيفاواي المجتمعي (Confirm/Decline)
     */
    async updateCommunityGiveawayWinnerStatus(giveawayCode, userId, status) {
        try {
            const client = await this.pool.connect();
            try {
                const giveaway = await client.query(
                    `SELECT * FROM community_giveaways WHERE giveaway_code = $1`,
                    [giveawayCode]
                );
                if (giveaway.rows.length === 0) {
                    return { success: false, error: 'Giveaway not found' };
                }

                const giveawayData = giveaway.rows[0];
                let coDeMembers = [];
                if (giveawayData.co_de_members) {
                    if (typeof giveawayData.co_de_members === 'string') {
                        try { coDeMembers = JSON.parse(giveawayData.co_de_members); } catch { coDeMembers = []; }
                    } else if (Array.isArray(giveawayData.co_de_members)) {
                        coDeMembers = giveawayData.co_de_members;
                    }
                }

                const winners = giveawayData.winners || [];
                if (!winners.includes(userId)) {
                    return { success: false, error: 'Not a winner', code: 'NOT_WINNER' };
                }

                const existingEntry = coDeMembers.find(m => m && m.user_id === userId);
                if (existingEntry) {
                    return { success: false, error: 'Already voted', code: 'ALREADY_VOTED' };
                }

                const newEntry = { user_id: userId, status, responded_at: new Date().toISOString() };
                const updatedMembers = [...coDeMembers, newEntry];
                const confirmCount = updatedMembers.filter(m => m && m.status === 'confirm').length;
                const declineCount = updatedMembers.filter(m => m && m.status === 'decline').length;
                const totalWinners = winners.length;
                const allResponded = (confirmCount + declineCount) === totalWinners;
                const allConfirmed = allResponded && (declineCount === 0);

                await client.query(
                    `UPDATE community_giveaways
                     SET co_de_members = $1::jsonb, confirm_count = $2, decline_count = $3,
                         all_responded = $4, all_confirmed = $5, updated_at = CURRENT_TIMESTAMP
                     WHERE giveaway_code = $6`,
                    [JSON.stringify(updatedMembers), confirmCount, declineCount, allResponded, allConfirmed, giveawayCode]
                );

                return { success: true, data: { confirmCount, declineCount, allResponded, allConfirmed, totalWinners, userId, status } };
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('❌ Error updating winner status:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب حالة تأكيد الجيفاواي المجتمعي
     */
    async getCommunityGiveawayConfirmationStatus(giveawayCode) {
        try {
            const giveaway = await this.get(
                `SELECT winners, co_de_members, confirm_count, decline_count, all_responded, all_confirmed, host_rewarded
                 FROM community_giveaways WHERE giveaway_code = $1`,
                [giveawayCode]
            );
            if (!giveaway) return null;

            let coDeMembers = [];
            if (giveaway.co_de_members) {
                if (typeof giveaway.co_de_members === 'string') {
                    try { coDeMembers = JSON.parse(giveaway.co_de_members); } catch { coDeMembers = []; }
                } else if (Array.isArray(giveaway.co_de_members)) {
                    coDeMembers = giveaway.co_de_members;
                }
            }

            return {
                winners: giveaway.winners || [],
                coDeMembers,
                confirmCount: giveaway.confirm_count || 0,
                declineCount: giveaway.decline_count || 0,
                totalWinners: (giveaway.winners || []).length,
                allResponded: giveaway.all_responded || false,
                allConfirmed: giveaway.all_confirmed || false,
                hostRewarded: giveaway.host_rewarded || false
            };
        } catch (error) {
            console.error('❌ Error getting confirmation status:', error);
            return null;
        }
    }

    /**
     * التحقق من أن كل الفائزين ضغطوا Confirm
     */
    async checkAllCommunityWinnersConfirm(giveawayCode) {
        try {
            const status = await this.getCommunityGiveawayConfirmationStatus(giveawayCode);
            return status ? status.allConfirmed : false;
        } catch (error) {
            console.error('❌ Error checking all winners confirm:', error);
            return false;
        }
    }

    /**
     * منح مكافأة للـ Host
     */
    async rewardCommunityHost(giveawayCode, hostId) {
        try {
            await this.run(
                `UPDATE levels SET xp = xp + 250, sky_coins = sky_coins + 150, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
                [hostId]
            );
            await this.run(
                `UPDATE community_giveaways SET host_rewarded = true, updated_at = CURRENT_TIMESTAMP WHERE giveaway_code = $1`,
                [giveawayCode]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ Error rewarding host:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * التحقق من عدد الجيفاواي النشطة للمستخدم
     */
    async checkUserActiveCommunityGiveaways(userId) {
        try {
            const result = await this.get(
                `SELECT COUNT(*) as count FROM community_giveaways
                 WHERE host_id = $1 AND is_active = true AND is_ended = false`,
                [userId]
            );
            return result ? parseInt(result.count) : 0;
        } catch (error) {
            console.error('❌ Error checking user active community giveaways:', error);
            return 0;
        }
    }

    /**
     * جلب جميع الجيفاواي المجتمعية النشطة لاستعادتها عند تشغيل البوت
     */
    async getActiveCommunityGiveawaysForRestore() {
        try {
            return await this.all(
                `SELECT * FROM community_giveaways
                 WHERE is_active = true AND is_ended = false AND ends_at > CURRENT_TIMESTAMP
                 ORDER BY ends_at ASC`
            );
        } catch (error) {
            console.error('❌ Error getting active community giveaways for restore:', error);
            return [];
        }
    }

    /**
     * جلب جميع الجيفاواي المجتمعية المنتهية لإنهائها
     */
    async getExpiredActiveCommunityGiveawaysForEnd() {
        try {
            return await this.all(
                `SELECT * FROM community_giveaways
                 WHERE is_active = true AND is_ended = false AND ends_at <= CURRENT_TIMESTAMP`
            );
        } catch (error) {
            console.error('❌ Error getting expired community giveaways for end:', error);
            return [];
        }
    }
    
}

// إنشاء وتصدير نسخة واحدة من مدير قاعدة البيانات
const dbManager = new DatabaseManager();
module.exports = dbManager;