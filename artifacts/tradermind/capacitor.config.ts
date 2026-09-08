import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.tradermind.os',
  appName: 'TraderMind OS',
  webDir: 'dist/capacitor',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    buildOptions: {
      releaseType: 'APK',
    },
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
