const dbManager = require('../Data/database');

class CouponSystem {
    constructor() {
        console.log('🎫 Coupon System initialized (No Commands)');
    }

    // توليد كود كوبون عشوائي: SKY-52523452
    generateCouponCode() {
        const prefix = "SKY";
        const numbers = Math.floor(10000000 + Math.random() * 90000000); // 8 أرقام
        return `${prefix}-${numbers}`;
    }

    // إنشاء كوبون جديد من دروب ليجندري
    async createCouponFromDrop(userId, username, discountPercentage, crateId) {
        try {
            // توليد كود فريد بسيط
            const couponCode = `SKY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // تاريخ الانتهاء
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 14);

            console.log(`🎫 Creating coupon: ${couponCode} (${discountPercentage}%)`);

            // حفظ مباشر بدون تحقق مسبق (الداتابيز راح يمنع التكرار)
            const dbManager = require('../Data/database');

            try {
                await dbManager.run(
                    `INSERT INTO shop_coupons 
                     (coupon_code, user_id, username, discount_percentage, 
                      expires_at, source_drop_type, source_crate_id, is_used) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, false)`,
                    [
                        couponCode, 
                        userId, 
                        username, 
                        discountPercentage,
                        expiresAt.toISOString(),
                        'legendary',
                        crateId
                    ]
                );

                console.log(`✅ Coupon saved: ${couponCode}`);

                return {
                    success: true,
                    couponCode: couponCode,
                    discountPercentage: discountPercentage,
                    expiresAt: expiresAt,
                    validForDays: 14
                };

            } catch (dbError) {
                if (dbError.message.includes('duplicate')) {
                    // إذا اتكرر، نجرب كود جديد
                    console.log(`🔄 Duplicate, trying new code...`);
                    const newCode = `SKY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

                    await dbManager.run(
                        `INSERT INTO shop_coupons 
                         (coupon_code, user_id, username, discount_percentage, 
                          expires_at, source_drop_type, source_crate_id, is_used) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, false)`,
                        [
                            newCode, 
                            userId, 
                            username, 
                            discountPercentage,
                            expiresAt.toISOString(),
                            'legendary',
                            crateId
                        ]
                    );

                    return {
                        success: true,
                        couponCode: newCode,
                        discountPercentage: discountPercentage,
                        expiresAt: expiresAt,
                        validForDays: 14
                    };
                }
                throw dbError;
            }

        } catch (error) {
            console.error('❌ Error creating coupon:', error.message);
            return { success: false, error: error.message };
        }
    }

    // التحقق من صلاحية الكوبون (للاستخدام في الشوب)
    async validateCoupon(userId, couponCode) {
        try {
            const coupon = await dbManager.get(
                `SELECT * FROM shop_coupons 
                 WHERE coupon_code = ? 
                 AND user_id = ?
                 AND is_used = false
                 AND expires_at > CURRENT_TIMESTAMP`,
                [couponCode, userId]
            );

            if (!coupon) {
                return { valid: false, reason: 'Invalid or expired coupon' };
            }

            // الكوبون يشتغل على كل المنتجات إذا كان من legendary
            const applicableToAll = coupon.source_drop_type === 'legendary';

            return {
                valid: true,
                coupon: coupon,
                discountPercentage: coupon.discount_percentage,
                applicableToAllItems: applicableToAll,
                source: coupon.source_drop_type || 'unknown'
            };

        } catch (error) {
            console.error('❌ Error validating coupon:', error);
            return { valid: false, reason: 'System error' };
        }
    }

    // استخدام الكوبون (عند الشراء من الشوب)
    async useCoupon(couponId) {
        try {
            console.log(`🗑️ Deleting coupon ID: ${couponId}`);

            // الحذف النهائي بدل تحديث الحالة
            const result = await dbManager.run(
                `DELETE FROM shop_coupons WHERE id = ?`,
                [couponId]
            );

            if (result.changes > 0) {
                console.log(`✅ Successfully deleted coupon ID: ${couponId}`);
                return { success: true, deleted: true };
            } else {
                console.log(`⚠️ No coupon found with ID: ${couponId}`);
                return { success: false, error: 'Coupon not found' };
            }

        } catch (error) {
            console.error('❌ Error deleting coupon:', error);
            return { success: false, error: error.message };
        }
    }

    // جلب كل كوبونات المستخدم
    async getUserCoupons(userId) {
        try {
            const coupons = await dbManager.all(
                `SELECT * FROM shop_coupons 
                 WHERE user_id = ? 
                 ORDER BY 
                    CASE WHEN is_used = false AND expires_at > CURRENT_TIMESTAMP THEN 1
                         WHEN is_used = false AND expires_at <= CURRENT_TIMESTAMP THEN 2
                         ELSE 3
                    END,
                    expires_at ASC`,
                [userId]
            );

            return coupons;
        } catch (error) {
            console.error('❌ Error getting user coupons:', error);
            return [];
        }
    }

    // جلب كوبونات لم تنته ولم تستخدم
    async getActiveCoupons(userId) {
        try {
            return await dbManager.all(
                `SELECT * FROM shop_coupons 
                 WHERE user_id = ? 
                 AND is_used = false
                 AND expires_at > CURRENT_TIMESTAMP
                 ORDER BY expires_at ASC`,
                [userId]
            );
        } catch (error) {
            console.error('❌ Error getting active coupons:', error);
            return [];
        }
    }

    // جلب كوبونات الـ legendary فقط
    async getLegendaryCoupons(userId) {
        try {
            return await dbManager.all(
                `SELECT * FROM shop_coupons 
                 WHERE user_id = ? 
                 AND source_drop_type = 'legendary'
                 AND is_used = false
                 AND expires_at > CURRENT_TIMESTAMP
                 ORDER BY expires_at ASC`,
                [userId]
            );
        } catch (error) {
            console.error('❌ Error getting legendary coupons:', error);
            return [];
        }
    }

    // عرض معلومات الكوبون
    async getCouponInfo(couponCode) {
        try {
            return await dbManager.get(
                `SELECT * FROM shop_coupons WHERE coupon_code = ?`,
                [couponCode]
            );
        } catch (error) {
            console.error('❌ Error getting coupon info:', error);
            return null;
        }
    }

    // تنظيف الكوبونات المنتهية تلقائياً
    async cleanupExpiredCoupons() {
        try {
            const result = await dbManager.run(
                `DELETE FROM shop_coupons 
                 WHERE expires_at <= CURRENT_TIMESTAMP 
                 AND is_used = false`,
                []
            );

            if (result.changes > 0) {
                console.log(`🧹 Deleted ${result.changes} expired coupons`);
            }

            return { success: true, deleted: result.changes };
        } catch (error) {
            console.error('❌ Error cleaning up coupons:', error);
            return { success: false, error: error.message };
        }
    }

    // إحصاءات الكوبونات للمستخدم
    async getCouponStats(userId) {
        try {
            const coupons = await this.getUserCoupons(userId);
            // الآن coupons تحتوي فقط على الكوبونات النشطة والمنتهية

            const stats = {
                total: coupons.length,
                active: coupons.filter(c => new Date(c.expires_at) > new Date()).length,
                expired: coupons.filter(c => new Date(c.expires_at) <= new Date()).length,
                used: 0, // دائماً صفر لأننا نحذف
                legendary: coupons.filter(c => c.source_drop_type === 'legendary').length
            };

            return stats;
        } catch (error) {
            console.error('❌ Error getting coupon stats:', error);
            return null;
        }
    }

    // توليد نسبة تخفيض عشوائية (بنظام الأوزان)
    generateWeightedDiscount() {
        // نظام عكسي: تخفيض أعلى = فرصة أقل
        const discountTiers = [
            { min: 40, max: 40, weight: 5 },   // 40% فقط - 5% فرصة
            { min: 35, max: 39, weight: 10 },  // 35-39% - 10% فرصة
            { min: 30, max: 34, weight: 15 },  // 30-34% - 15% فرصة
            { min: 25, max: 29, weight: 20 },  // 25-29% - 20% فرصة
            { min: 20, max: 24, weight: 20 },  // 20-24% - 20% فرصة
            { min: 15, max: 19, weight: 15 },  // 15-19% - 15% فرصة
            { min: 10, max: 14, weight: 15 }   // 10-14% - 15% فرصة
        ];

        const totalWeight = discountTiers.reduce((sum, tier) => sum + tier.weight, 0);
        let random = Math.random() * totalWeight;

        for (const tier of discountTiers) {
            if (random < tier.weight) {
                // توليد نسبة عشوائية داخل المدى
                return Math.floor(Math.random() * (tier.max - tier.min + 1)) + tier.min;
            }
            random -= tier.weight;
        }

        // Default 25%
        return 25;
    }

    // دالة مساعدة: حساب الوقت المتبقي للكوبون
    calculateTimeRemaining(expiresAt) {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry - now;

        if (diff <= 0) return 'Expired';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) return `${days} days`;
        if (hours > 0) return `${hours} hours`;
        return 'Less than an hour';
    }

    // دالة مساعدة: الحصول على حالة الكوبون
    getCouponStatus(coupon) {
        const now = new Date();
        const expiresAt = new Date(coupon.expires_at);

        if (coupon.is_used) return 'Used';
        if (expiresAt <= now) return 'Expired';
        return 'Active';
    }

    // دالة الاستخدام الرئيسية: تطبيق الكوبون على منتج
    async applyCouponToItem(userId, itemId, couponCode) {
        try {
            // 1. التحقق من صلاحية الكوبون
            const validation = await this.validateCoupon(userId, couponCode);

            if (!validation.valid) {
                return { success: false, error: validation.reason };
            }

            const coupon = validation.coupon;

            // 2. جلب معلومات المنتج
            const item = await dbManager.getShopItemById(itemId);
            if (!item) {
                return { success: false, error: 'Item not found' };
            }

            // 3. حساب السعر بعد الخصم
            const originalPriceCoins = item.original_price_coins || item.price_coins || 0;
            const originalPriceCrystals = item.original_price_crystals || item.price_crystals || 0;

            const discountedCoins = Math.floor(originalPriceCoins * (1 - coupon.discount_percentage / 100));
            const discountedCrystals = Math.floor(originalPriceCrystals * (1 - coupon.discount_percentage / 100));

            // 4. استخدام الكوبون
            await this.useCoupon(coupon.id);

            console.log(`🛒 ${userId} used coupon ${couponCode} on item ${itemId} (${coupon.discount_percentage}% off)`);

            return {
                success: true,
                originalPrice: {
                    coins: originalPriceCoins,
                    crystals: originalPriceCrystals
                },
                discountedPrice: {
                    coins: discountedCoins,
                    crystals: discountedCrystals
                },
                discount: coupon.discount_percentage,
                saved: {
                    coins: originalPriceCoins - discountedCoins,
                    crystals: originalPriceCrystals - discountedCrystals
                },
                couponCode: coupon.coupon_code,
                couponId: coupon.id
            };

        } catch (error) {
            console.error('❌ Error applying coupon to item:', error);
            return { success: false, error: error.message };
        }
    }

    // دالة للحصول على معلومات كوبونات المستخدم بشكل منظم
    async getUserCouponsFormatted(userId) {
        try {
            const coupons = await this.getUserCoupons(userId);

            return {
                total: coupons.length,
                active: coupons.filter(c => !c.is_used && new Date(c.expires_at) > new Date()),
                used: coupons.filter(c => c.is_used),
                expired: coupons.filter(c => !c.is_used && new Date(c.expires_at) <= new Date()),
                legendary: coupons.filter(c => c.source_drop_type === 'legendary'),
                all: coupons
            };
        } catch (error) {
            console.error('❌ Error getting formatted coupons:', error);
            return {
                total: 0,
                active: [],
                used: [],
                expired: [],
                legendary: [],
                all: []
            };
        }
    }

    // في class CouponSystem، أضف هذه الدوال:

    // دالة لإنشاء كوبون من الـ streak
    async createStreakCoupon(userId, username, streakDay) {
        try {
            // توليد كود الكوبون
            const couponCode = `STREAK-${streakDay}-${Date.now().toString(36).toUpperCase()}`;

            // تاريخ الانتهاء (7 أيام للكوبونات العادية)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            // نسبة تخفيض عشوائية بناءً على الـ streak
            let discountPercentage;
            if (streakDay >= 90) discountPercentage = 35 + Math.floor(Math.random() * 6); // 35-40%
            else if (streakDay >= 60) discountPercentage = 25 + Math.floor(Math.random() * 11); // 25-35%
            else if (streakDay >= 30) discountPercentage = 15 + Math.floor(Math.random() * 11); // 15-25%
            else discountPercentage = 10 + Math.floor(Math.random() * 6); // 10-15%

            // حفظ الكوبون في الداتابيز
            await dbManager.run(
                `INSERT INTO shop_coupons 
                 (coupon_code, user_id, username, discount_percentage, 
                  expires_at, source_drop_type) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    couponCode, 
                    userId, 
                    username, 
                    discountPercentage,
                    expiresAt.toISOString(),
                    `streak_day_${streakDay}`
                ]
            );

            console.log(`🎫 Created streak coupon: ${couponCode} (${discountPercentage}% off) for ${username} - Day ${streakDay}`);

            return {
                success: true,
                type: 'streak_coupon',
                couponCode: couponCode,
                discountPercentage: discountPercentage,
                expiresAt: expiresAt,
                validForDays: 7,
                applicableTo: 'all_items',
                source: `streak_day_${streakDay}`
            };

        } catch (error) {
            console.error('❌ Error creating streak coupon:', error.message);
            return null;
        }
    }

    // دالة للحصول على كوبونات الـ streak
    async getStreakCoupons(userId) {
        try {
            return await dbManager.all(
                `SELECT * FROM shop_coupons 
                 WHERE user_id = ? 
                 AND source_drop_type LIKE 'streak_day_%'
                 AND is_used = false
                 AND expires_at > CURRENT_TIMESTAMP
                 ORDER BY 
                    CAST(SUBSTRING(source_drop_type FROM 'streak_day_([0-9]+)') AS INTEGER) DESC`,
                [userId]
            );
        } catch (error) {
            console.error('❌ Error getting streak coupons:', error);
            return [];
        }
    }
}

// ========== INITIALIZE AND EXPORT ==========

const couponSystem = new CouponSystem();

// تنظيف تلقائي للكوبونات المنتهية كل 24 ساعة
setInterval(async () => {
    await couponSystem.cleanupExpiredCoupons();
}, 24 * 60 * 60 * 1000); // كل 24 ساعة

module.exports = { couponSystem };