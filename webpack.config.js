const path = require("path");
const webpack = require("webpack");
const MinifyPlugin = require("babel-minify-webpack-plugin");
const CheckerPlugin = require("awesome-typescript-loader").CheckerPlugin;

module.exports = {
  context: __dirname,
  entry: {
    cyclus: [
      path.join(__dirname, "src", "index")
    ]
  },
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
    loaders: [
      {
        test: /\.(ts|tsx)$/,
        loader: "awesome-typescript-loader"
      }
    ]
  },
  plugins: [
    new CheckerPlugin(),
    new webpack.optimize.AggressiveMergingPlugin(),
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.LoaderOptionsPlugin({
      minimize: true,
      debug: false
    }),
    new MinifyPlugin({}, {
      comments: false
    })
  ]
};