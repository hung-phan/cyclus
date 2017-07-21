const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const CheckerPlugin = require("awesome-typescript-loader").CheckerPlugin;

module.exports = {
  context: __dirname,
  target: "node",
  node: {
    __dirname: true,
    __filename: true
  },
  entry: {
    server: [
      "webpack/hot/poll?1000",
      path.join(__dirname, "src", "index")
    ]
  },
  recordsPath: path.join(__dirname, "tmp", "records.json"),
  output: {
    path: path.join(__dirname, "dist"),
    filename: "[name].js",
    chunkFilename: "[id].js",
    libraryTarget: "commonjs2"
  },
  externals: [
    nodeExternals({
      whitelist: [/^webpack/]
    })
  ],
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
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new CheckerPlugin()
  ]
};