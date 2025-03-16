const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production", // Using production mode to avoid CSP errors
  entry: {
    popup: "./src/popup/popup.ts",
    content: "./src/content/content.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "src/manifest.json", to: "manifest.json" },
        { from: "src/popup/popup.html", to: "popup.html" },
        { from: "src/assets", to: "assets", noErrorOnMissing: true },
      ],
    }),
  ],
  // Prevent eval usage in webpack bundle
  devtool: "inline-source-map", // Change from default to inline-source-map
};
