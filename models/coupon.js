const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const Coupon = sequelize.define('coupon', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  code: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  discountType: {
    type: Sequelize.ENUM('percentage', 'fixed'),
    allowNull: false,
    defaultValue: 'percentage'
  },
  discountValue: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false
  },
  expiryDate: {
    type: Sequelize.DATE,
    allowNull: true
  },
  usageLimit: {
    type: Sequelize.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  usageCount: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
});

module.exports = Coupon;
