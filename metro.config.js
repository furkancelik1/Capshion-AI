process.env.EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK = "1";

const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = config;
