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
  req.user.getCart()
    .then(cart => {
      return cart.getProducts()
        .then(products => {
          // Calculate subtotal
          const subtotal = products.reduce((sum, p) => {
            return sum + (p.price * p.cartItem.quantity);
          }, 0);

          // Get applied coupon if any
          if (cart.couponId) {
            return Coupon.findByPk(cart.couponId)
              .then(coupon => {
                let discount = 0;
                let discountedTotal = subtotal;

                if (coupon && coupon.isActive) {
                  // Check if coupon is expired
                  if (!coupon.expirationDate || new Date(coupon.expirationDate) >= new Date()) {
                    if (coupon.discountType === 'percentage') {
                      discount = (subtotal * coupon.discountValue) / 100;
                    } else {
                      discount = coupon.discountValue;
                    }
                    discountedTotal = Math.max(0, subtotal - discount);
                  }
                }

                res.render("shop/cart", {
                  pageTitle: "Cart",
                  path: "/shop/cart",
                  products: products,
                  subtotal: subtotal.toFixed(2),
                  discount: discount.toFixed(2),
                  total: discountedTotal.toFixed(2),
                  appliedCoupon: coupon,
                  couponError: null
                });
              });
          } else {
            res.render("shop/cart", {
              pageTitle: "Cart",
              path: "/shop/cart",
              products: products,
              subtotal: subtotal.toFixed(2),
              discount: '0.00',
              total: subtotal.toFixed(2),
              appliedCoupon: null,
              couponError: null
            });
          }
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
  req.user
    .getCart()
    .then(cart => {
      fetchedCart = cart;
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
      return fetchedCart.setProducts(null);
    })
    .then(result => {
      // Clear coupon when order is placed
      return fetchedCart.update({ couponId: null });
    })
    .then(result => {
      res.redirect('/orders');
    })
    .catch(err => console.log(err));
};

exports.postApplyCoupon = (req, res, next) => {
  const couponCode = req.body.couponCode;
  
  // Helper function to render cart with error
  const renderCartWithError = (cart, errorMessage) => {
    return cart.getProducts()
      .then(products => {
        const subtotal = products.reduce((sum, p) => {
          return sum + (p.price * p.cartItem.quantity);
        }, 0);
        
        res.render("shop/cart", {
          pageTitle: "Cart",
          path: "/shop/cart",
          products: products,
          subtotal: subtotal.toFixed(2),
          discount: '0.00',
          total: subtotal.toFixed(2),
          appliedCoupon: null,
          couponError: errorMessage
        });
      });
  };

  if (!couponCode) {
    return req.user.getCart()
      .then(cart => renderCartWithError(cart, "Please enter a coupon code"))
      .catch(error => console.log(error));
  }

  Coupon.findOne({ where: { code: couponCode.toUpperCase() } })
    .then(coupon => {
      if (!coupon) {
        return req.user.getCart()
          .then(cart => renderCartWithError(cart, "Invalid coupon code"));
      }

      if (!coupon.isActive) {
        return req.user.getCart()
          .then(cart => renderCartWithError(cart, "This coupon is no longer active"));
      }

      if (coupon.expirationDate && new Date(coupon.expirationDate) < new Date()) {
        return req.user.getCart()
          .then(cart => renderCartWithError(cart, "This coupon has expired"));
      }

      // Apply coupon
      return req.user.getCart()
        .then(cart => {
          return cart.update({ couponId: coupon.id })
            .then(() => {
              res.redirect('/cart');
            });
        });
    })
    .catch(error => console.log(error));
};

exports.postRemoveCoupon = (req, res, next) => {
  req.user.getCart()
    .then(cart => {
      return cart.update({ couponId: null });
    })
    .then(() => {
      res.redirect('/cart');
    })
    .catch(error => console.log(error));
};
