require('dotenv').config();
const sequelize = require('./database');
const Coupon = require('../models/coupon');

async function seedCoupons() {
  try {
    await sequelize.sync();
    
    // Create test coupons
    const coupons = [
      {
        code: 'SAVE10',
        discountType: 'percentage',
        discountValue: 10,
        isActive: true,
        expiryDate: new Date('2027-12-31'),
        usageLimit: 100,
        usageCount: 0
      },
      {
        code: 'SAVE20',
        discountType: 'percentage',
        discountValue: 20,
        isActive: true,
        expiryDate: new Date('2027-12-31'),
        usageLimit: 50,
        usageCount: 0
      },
      {
        code: 'FIXED5',
        discountType: 'fixed',
        discountValue: 5.00,
        isActive: true,
        expiryDate: new Date('2027-12-31'),
        usageLimit: null,
        usageCount: 0
      },
      {
        code: 'EXPIRED',
        discountType: 'percentage',
        discountValue: 50,
        isActive: true,
        expiryDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        usageLimit: null,
        usageCount: 0
      },
      {
        code: 'INACTIVE',
        discountType: 'percentage',
        discountValue: 15,
        isActive: false,
        expiryDate: new Date('2027-12-31'),
        usageLimit: null,
        usageCount: 0
      }
    ];
    
    for (const couponData of coupons) {
      const existingCoupon = await Coupon.findOne({ where: { code: couponData.code } });
      if (!existingCoupon) {
        await Coupon.create(couponData);
        console.log(`Created coupon: ${couponData.code}`);
      } else {
        console.log(`Coupon ${couponData.code} already exists`);
      }
    }
    
    console.log('Coupon seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding coupons:', error);
    process.exit(1);
  }
}

seedCoupons();
