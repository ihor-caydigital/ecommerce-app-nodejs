const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const Order = sequelize.define('order', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  couponCode: {
    type: Sequelize.STRING,
    allowNull: true
  },
  discountAmount: {
    type: Sequelize.DOUBLE,
    allowNull: true,
    defaultValue: 0
  },
  totalAmount: {
    type: Sequelize.DOUBLE,
    allowNull: true,
    defaultValue: 0
  }
})

module.exports = Order;