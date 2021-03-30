const path = require("path");

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
        loader: "ts-loader"
      }
    ]
  }
};
