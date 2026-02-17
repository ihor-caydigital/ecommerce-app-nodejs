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
    type: Sequelize.DOUBLE,
    allowNull: false
  },
  expirationDate: {
    type: Sequelize.DATE,
    allowNull: true
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
});

module.exports = Coupon;
