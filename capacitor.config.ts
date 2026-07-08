import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cn.codesoulme.chengxian.test',
  appName: '我靠模拟成仙·测试版',
  webDir: 'public',
  // 沉浸版 Phase-Release: cloudflared 内网穿透（端口 3010）
  server: {
    androidScheme: 'https',
    url: 'https://landscape-existence-discussion-migration.trycloudflare.com',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;