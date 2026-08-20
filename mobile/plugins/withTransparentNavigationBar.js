const { AndroidConfig, withAndroidStyles } = require("expo/config-plugins");

module.exports = function withTransparentNavigationBar(config) {
  return withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(
      config.modResults,
      {
        add: true,
        parent: AndroidConfig.Styles.getAppThemeGroup(),
        name: "android:enforceNavigationBarContrast",
        value: "false",
      },
    );
    return config;
  });
};
