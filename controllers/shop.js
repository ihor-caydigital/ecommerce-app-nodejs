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
  req.user.getCart({ include: [{ model: Coupon, as: 'coupon' }] })
    .then(cart => {
      return cart.getProducts()
        .then(products => {
          let subtotal = 0;
          products.forEach(p => {
            subtotal += p.price * p.cartItem.quantity;
          });
          
          let discount = 0;
          let total = subtotal;
          const coupon = cart.coupon;
          
          if (coupon) {
            if (coupon.discountType === 'percentage') {
              discount = (subtotal * coupon.discountValue) / 100;
            } else if (coupon.discountType === 'fixed') {
              discount = parseFloat(coupon.discountValue);
            }
            total = Math.max(0, subtotal - discount);
          }
          
          res.render("shop/cart", {
            pageTitle: "Cart",
            path: "/shop/cart",
            products: products,
            subtotal: subtotal.toFixed(2),
            discount: discount.toFixed(2),
            total: total.toFixed(2),
            coupon: coupon,
            couponMessage: req.query.couponMessage || null,
            couponError: req.query.couponError || null
          });
        })
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
  req.user
    .getCart({ include: [{ model: Coupon, as: 'coupon' }] })
    .then(cart => {
      fetchedCart = cart;
      appliedCoupon = cart.coupon;
      return cart.getProducts();
    })
    .then(products => {
      return req.user
        .createOrder()
        .then(order => {
          return order.addProducts(
            products.map(product => {
              product.orderItem = { quantity: product.cartItem.quantity };
              return product;
            })
          );
        })
        .catch(err => console.log(err));
    })
    .then(result => {
      // Increment coupon usage count if a coupon was applied
      if (appliedCoupon) {
        return appliedCoupon.update({ usageCount: appliedCoupon.usageCount + 1 })
          .then(() => fetchedCart.update({ couponId: null }))
          .then(() => fetchedCart.setProducts(null));
      }
      return fetchedCart.setProducts(null);
    })
    .then(result => {
      res.redirect('/orders');
    })
    .catch(err => console.log(err));
};

exports.postApplyCoupon = (req, res, next) => {
  const couponCode = req.body.couponCode;
  
  if (!couponCode || couponCode.trim() === '') {
    return res.redirect('/cart?couponError=' + encodeURIComponent('Please enter a coupon code'));
  }
  
  let fetchedCart;
  req.user.getCart()
    .then(cart => {
      fetchedCart = cart;
      return Coupon.findOne({ where: { code: couponCode.toUpperCase() } });
    })
    .then(coupon => {
      if (!coupon) {
        return res.redirect('/cart?couponError=' + encodeURIComponent('Invalid coupon code'));
      }
      
      if (!coupon.isActive) {
        return res.redirect('/cart?couponError=' + encodeURIComponent('This coupon is no longer active'));
      }
      
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        return res.redirect('/cart?couponError=' + encodeURIComponent('This coupon has expired'));
      }
      
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return res.redirect('/cart?couponError=' + encodeURIComponent('This coupon has reached its usage limit'));
      }
      
      return fetchedCart.update({ couponId: coupon.id })
        .then(() => {
          res.redirect('/cart?couponMessage=' + encodeURIComponent('Coupon applied successfully!'));
        });
    })
    .catch(error => {
      console.log('Error in postApplyCoupon:', error);
      res.redirect('/cart?couponError=' + encodeURIComponent('Error applying coupon'));
    });
};

exports.postRemoveCoupon = (req, res, next) => {
  req.user.getCart()
    .then(cart => {
      return cart.update({ couponId: null });
    })
    .then(() => {
      res.redirect('/cart?couponMessage=' + encodeURIComponent('Coupon removed'));
    })
    .catch(error => {
      console.log('Error in postRemoveCoupon:', error);
      res.redirect('/cart');
    });
};



