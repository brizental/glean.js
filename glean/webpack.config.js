/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const path = require("path");

const shared = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: { onlyCompileBundledFiles: true }
      },
    ],
  },
  resolve: {
    modules: ["node_modules", "src"],
    extensions: [ ".tsx", ".ts", ".js" ]
  },
};

module.exports = [
  {
    ...shared,
    output: {
      filename: "glean.js",
      path: path.resolve(__dirname, "dist"),
      libraryTarget: "umd",
    },
    entry: path.resolve(__dirname, "./src/index.ts")
  },
  {
    ...shared,
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "platform"),
      libraryTarget: "umd",
    },
    entry: {
      test: path.resolve(__dirname, "./src/platform/test/index.ts"),
      webext: path.resolve(__dirname, "./src/platform/webext/index.ts"),
      // We do not have platform specific stuff for Qt yet, but we want the sample to work.
      qt: path.resolve(__dirname, "./src/platform/test/index.ts"),
    },
  },
];
