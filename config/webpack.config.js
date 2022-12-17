'use strict';

const {merge} = require('webpack-merge');

const common = require('./webpack.common.js');
const PATHS = require('./paths');

// Merge webpack configuration files
const config = (env, argv) =>
	merge(common, {
		resolve: {
			fallback: {
				"stream": require.resolve('stream-browserify'),
			},
		},
		entry: {
			content: PATHS.src + '/content.js',
			remote_wallet: PATHS.src + '/remote_wallet.js',
			background_request: PATHS.src + '/background_request.js',
		},
		devtool: argv.mode === 'production' ? false : 'source-map',
	});

module.exports = config;
