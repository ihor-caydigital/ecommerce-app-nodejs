const Product = require("../models/product");

exports.getAddProduct = (req, res, next) => {
  res.render("admin/edit-product", {
    pageTitle: "Add Product",
    path: "/admin/add-product",
    editing: false,
  });
};

exports.getEditProduct = (req, res, next) => {
  // const editMode = req.query.edit;
  // if (!editMode){
  //   return res.redirect('/')
  // }
  const productId = req.params.productId;
  req.user.getProducts({ where: {id: productId} })
    .then((products) => {
      const product = products[0];
      if (!product) {
        return res.redirect("/");
      }
      res.render("admin/edit-product", {
        pageTitle: "Add Product",
        path: "/admin/edit-product",
        editing: true,
        product: product,
      });
    })
    .catch((error) => {
      console.log("Error in Admin Controller, getEditProduct: {}", error);
    });
};

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const imageUrl = req.body.imageUrl;
  const description = req.body.description;
  const price = req.body.price;
  const productCategory = req.body.productCategory;
  req.user
    .createProduct({
      title: title,
      price: price,
      imageUrl: imageUrl,
      description: description,
      productCategory: productCategory,
    })
    .then((result) => {
      console.log("Product Created");
      res.redirect("/admin/product-list");
    })
    .catch((error) => {
      console.log("Error in Admin Controller, postAddProduct: {}", error);
    });
};

exports.postEditProduct = (req, res, next) => {
  const id = req.body.productId;

  Product.findByPk(id)
    .then((product) => {
      product.title = req.body.title;
      product.imageUrl = req.body.imageUrl;
      product.description = req.body.description;
      product.price = req.body.price;
      product.productCategory = req.body.productCategory;
      return product.save();
    })
    .then((result) => {
      console.log("Product updated successfully");
      res.redirect("/admin/product-list");
    })
    .catch((error) =>
      console.log("Error in Admin Controller, postEditProduct: {}", error)
    );
};

exports.getProducts = (req, res, next) => {
  req.user.getProducts()
    .then((products) => {
      res.render("admin/product-list", {
        pageTitle: "Admin Products",
        path: "/admin/product-list",
        prods: products,
        hasProducts: products.length > 0,
      });
    })
    .catch((error) =>
      console.log("Error in Admin Controller, getProducts: {}", error)
    );
};

exports.deleteProduct = (req, res, next) => {
  const productId = req.body.productId;
  Product.findByPk(productId)
    .then((product) => {
      product.destroy();
    })
    .then((result) => {
      (result) => console.log("destroyed successfully", result);
      res.redirect("/admin/product-list");
    })
    .catch((error) =>
      console.log("Error in Admin Controller, deleteProduct: {}", error)
    );
};
