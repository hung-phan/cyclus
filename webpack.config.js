const path = require("path");
const webpack = require("webpack");
const MinifyPlugin = require("uglifyjs-webpack-plugin");
const { CheckerPlugin } = require("awesome-typescript-loader");

module.exports = {
  context: __dirname,
  entry: {
    cyclus: [
      path.join(__dirname, "src", "index")
    ]
  },
  mode: "production",
  devtool: false,
  output: {
    path: path.join(__dirname, "dist", "browser"),
    filename: "[name].js",
    chunkFilename: "[id].js",
    libraryTarget: "umd"
  },
  externals: [],
  resolve: {
    extensions: [".ts", ".js"],
    modules: [path.resolve("./src"), "node_modules"]
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        loader: "awesome-typescript-loader"
      }
    ]
  },
  plugins: [
    new CheckerPlugin(),
    new webpack.LoaderOptionsPlugin({
      minimize: true,
      debug: false
    }),
    new MinifyPlugin({
      cache: true,
      parallel: true,
      sourceMap: true
    })
  ]
};