const Product = require("../models/product");
const Cart = require("../models/cart");
const Coupon = require("../models/coupon");

const ERROR_PREFIX = "In shop controller, ";

exports.getProducts = (req, res, next) => {
  Product.findAll()
    .then((products) => {
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "Products List",
        path: "/shop/product-list",
        hasProducts: products.length > 0,
      });
    })
    .catch((error) => {
      console.log("In shop controller, fetchAll: {}", error);
    });
};

exports.getProduct = (req, res, next) => {
  const productId = req.params.productId;
  Product.findByPk(productId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((error) => console.log("{} getProduct, {}", ERROR_PREFIX, error));
};

exports.getIndex = (req, res, next) => {
  const category = req.query.category;
  const allowedCategories = ['Fruits', 'Vegetables', 'Other'];
  let whereClause = {};
  
  if (category && category !== 'All' && allowedCategories.includes(category)) {
    whereClause = { productCategory: category };
  }
  
  Product.findAll({ where: whereClause })
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        hasProducts: products.length > 0,
        selectedCategory: category || 'All',
      });
    })
    .catch((error) => {
      console.log("In shop controller, fetchAll: {}", error);
    });
};

exports.getCart = (req, res, next) => {
  let fetchedCart;
  let appliedCoupon = null;
  
  req.user.getCart({ include: [{ model: Coupon, as: 'appliedCoupon' }] })
    .then(cart => {
      fetchedCart = cart;
      appliedCoupon = cart.appliedCoupon;
      return cart.getProducts();
    })
    .then(products => {
      // Calculate subtotal
      const subtotal = products.reduce((sum, p) => {
        return sum + (p.price * p.cartItem.quantity);
      }, 0);
      
      // Calculate discount
      let discount = 0;
      if (appliedCoupon) {
        if (appliedCoupon.discountType === 'percentage') {
          discount = (subtotal * appliedCoupon.discountValue) / 100;
        } else if (appliedCoupon.discountType === 'fixed') {
          discount = appliedCoupon.discountValue;
        }
      }
      
      // Calculate total
      const total = Math.max(0, subtotal - discount);
      
      res.render("shop/cart", {
        pageTitle: "Cart",
        path: "/shop/cart",
        products: products,
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        total: total.toFixed(2),
        appliedCoupon: appliedCoupon,
        couponMessage: req.session?.couponMessage || null,
        couponError: req.session?.couponError || null
      });
      
      // Clear session messages
      if (req.session) {
        req.session.couponMessage = null;
        req.session.couponError = null;
      }
    })
    .catch(error => { console.log('Error in shop controller, getCart {}', error) });
};

exports.postCart = (req, res, next) => {
  const productId = req.body.productId;
  let fetchedCart;
  let newQuantity = 1;

  req.user.getCart()
    .then(cart => {
      fetchedCart = cart;
      return cart.getProducts({ where: { id: productId } })
    })
    .then(products => {
      let product;
      if (products.length > 0) {
        product = products[0];
      }
      if (product) {
        newQuantity = product.cartItem.quantity + 1;
        return product;
      }
      return Product.findByPk(productId);
    })
    .then(product => {
      return fetchedCart.addProduct(product, {
        through: { quantity: newQuantity }
      })
    })
    .then(() => {
      res.redirect("/cart");
    })
    .catch(error => console.log(error));
  
};

exports.postCartDeleteProduct = (req, res, next) => {
  const productId = req.body.productId;
  req.user.getCart()
    .then(cart => {
      return cart.getProducts({ where: { id: productId } })
    })
    .then(products => {
      const product = products[0];
      return product.cartItem.destroy();
    })
    .then(result => {
      res.redirect("/cart");
    })
    .catch(error => console.log(error));
};

exports.getOrders = (req, res, next) => {
  req.user
    .getOrders({include: ['products']})
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => console.log(err));
};

exports.postOrder = (req, res, next) => {
  let fetchedCart;
  let appliedCoupon = null;
  let subtotal = 0;
  let discountAmount = 0;
  
  req.user
    .getCart({ include: [{ model: Coupon, as: 'appliedCoupon' }] })
    .then(cart => {
      fetchedCart = cart;
      appliedCoupon = cart.appliedCoupon;
      return cart.getProducts();
    })
    .then(products => {
      // Calculate subtotal
      subtotal = products.reduce((sum, p) => {
        return sum + (p.price * p.cartItem.quantity);
      }, 0);
      
      // Calculate discount
      if (appliedCoupon) {
        if (appliedCoupon.discountType === 'percentage') {
          discountAmount = (subtotal * appliedCoupon.discountValue) / 100;
        } else if (appliedCoupon.discountType === 'fixed') {
          discountAmount = appliedCoupon.discountValue;
        }
      }
      
      const totalAmount = Math.max(0, subtotal - discountAmount);
      
      return req.user
        .createOrder({
          couponCode: appliedCoupon ? appliedCoupon.code : null,
          discountAmount: discountAmount,
          totalAmount: totalAmount
        })
        .then(order => {
          return order.addProducts(
            products.map(product => {
              product.orderItem = { quantity: product.cartItem.quantity };
              return product;
            })
          );
        })
        .then(() => {
          // Increment coupon usage count if a coupon was applied
          if (appliedCoupon) {
            appliedCoupon.usageCount += 1;
            return appliedCoupon.save();
          }
        })
        .catch(err => console.log(err));
    })
    .then(result => {
      // Clear cart items and coupon
      return fetchedCart.setProducts(null);
    })
    .then(result => {
      // Clear applied coupon from cart
      fetchedCart.appliedCouponId = null;
      return fetchedCart.save();
    })
    .then(result => {
      res.redirect('/orders');
    })
    .catch(err => console.log(err));
};

exports.postApplyCoupon = (req, res, next) => {
  const couponCode = req.body.couponCode;
  
  if (!couponCode || couponCode.trim() === '') {
    if (req.session) {
      req.session.couponError = 'Please enter a coupon code';
    }
    return res.redirect('/cart');
  }
  
  Coupon.findOne({ where: { code: couponCode.toUpperCase() } })
    .then(coupon => {
      if (!coupon) {
        if (req.session) {
          req.session.couponError = 'Invalid coupon code';
        }
        return res.redirect('/cart');
      }
      
      if (!coupon.isActive) {
        if (req.session) {
          req.session.couponError = 'This coupon is no longer active';
        }
        return res.redirect('/cart');
      }
      
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        if (req.session) {
          req.session.couponError = 'This coupon has expired';
        }
        return res.redirect('/cart');
      }
      
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        if (req.session) {
          req.session.couponError = 'This coupon has reached its usage limit';
        }
        return res.redirect('/cart');
      }
      
      // Apply coupon to cart
      return req.user.getCart()
        .then(cart => {
          cart.appliedCouponId = coupon.id;
          return cart.save();
        })
        .then(() => {
          if (req.session) {
            req.session.couponMessage = `Coupon "${coupon.code}" applied successfully!`;
          }
          res.redirect('/cart');
        });
    })
    .catch(error => {
      console.log('Error in shop controller, postApplyCoupon {}', error);
      if (req.session) {
        req.session.couponError = 'An error occurred while applying the coupon';
      }
      res.redirect('/cart');
    });
};

exports.postRemoveCoupon = (req, res, next) => {
  req.user.getCart()
    .then(cart => {
      cart.appliedCouponId = null;
      return cart.save();
    })
    .then(() => {
      if (req.session) {
        req.session.couponMessage = 'Coupon removed successfully';
      }
      res.redirect('/cart');
    })
    .catch(error => {
      console.log('Error in shop controller, postRemoveCoupon {}', error);
      res.redirect('/cart');
    });
};


