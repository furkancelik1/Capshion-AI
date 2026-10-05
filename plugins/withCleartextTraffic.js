const { withAndroidManifest } = require('@expo/config-plugins');

// Yerel geliştirmede http://10.0.2.2:3000 backend'ine erişim için gerekli.
// Production build'de (EAS_BUILD_PROFILE=production) API HTTPS olduğundan açılmaz.
module.exports = function withCleartextTraffic(config) {
  if (process.env.EAS_BUILD_PROFILE === 'production') return config;

  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];

    if (!application) {
      throw new Error('withCleartextTraffic: AndroidManifest.xml application node bulunamadı');
    }

    application.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });
};
