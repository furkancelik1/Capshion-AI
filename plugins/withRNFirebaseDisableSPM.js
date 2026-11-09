const { withPodfile } = require('@expo/config-plugins');

// react-native-firebase v26+ Firebase'i iOS'ta SPM ile çözüyor; bu,
// expo-build-properties'teki `useFrameworks: "static"` ile birlikte
// "SPM + static linkage is not supported" hatasıyla pod install'ı durduruyor.
// Çözüm (RNFB'nin kendi önerisi): SPM'i kapatıp Firebase'i CocoaPods ile kurmak.
const LINE = '$RNFirebaseDisableSPM = true';

function addDisableSPM(contents) {
  if (contents.includes(LINE)) return contents;
  return `${LINE} # withRNFirebaseDisableSPM\n${contents}`;
}

module.exports = function withRNFirebaseDisableSPM(config) {
  return withPodfile(config, (config) => {
    config.modResults.contents = addDisableSPM(config.modResults.contents);
    return config;
  });
};
module.exports.addDisableSPM = addDisableSPM;
