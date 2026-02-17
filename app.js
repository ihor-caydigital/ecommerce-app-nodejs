require('dotenv').config();
const path = require("path");
const fs = require('fs');

const errorController = require("./controllers/error");
const sequelize = require("./util/database");
const Product = require("./models/product");
const User = require("./models/user");
const Cart = require("./models/cart");
const CartItem = require("./models/cart-item");
const Order = require("./models/order");
const OrderItem = require("./models/order-item");
const Coupon = require("./models/coupon");
// const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const express = require("express");
const bodyParser = require("body-parser");

const app = express();

app.set("view engine", "ejs");
app.set("views", "views");

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'})

// app.use(helmet());
app.use(compression());
app.use(morgan('combined', {stream: accessLogStream}));


app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  User.findByPk(1)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch((error) => {
      console.log("Error in App.js, in user retrieval, {}", error);
    });
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);

app.use(errorController.get404);

// One direction is enough
Product.belongsTo(User, { constraints: true, onDelete: "CASCADE" });
User.hasMany(Product);

// One direction is enough
User.hasOne(Cart);
Cart.belongsTo(User);

// Cart can have one coupon
Cart.belongsTo(Coupon, { foreignKey: 'couponId', constraints: false });

// One direction is enough
Cart.belongsToMany(Product, { through: CartItem })
Product.belongsToMany(Cart, { through: CartItem })

// One direction is enough
Order.belongsTo(User);
User.hasMany(Order);

Order.belongsToMany(Product, {through: OrderItem})

sequelize
  // .sync({ force: true })
  .sync()
  .then((result) => {
    return User.findByPk(1);
  })
  .then((user) => {
    if (!user) {
      return User.create({ name: "Lahiru", email: "lahirurc1st@gmail.com" });
    }
    return user;
  })
  .then((user) => {
    return user.createCart();
  })
  .then(cart => { 
    app.listen(process.env.PORT || 5000);
  })
  .catch((error) => console.log("APP error, {}", error));
