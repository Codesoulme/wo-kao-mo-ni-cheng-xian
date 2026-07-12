import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cn.codesoulme.chengxian.test',
  appName: '我靠模拟成仙',
  webDir: 'public',
  // 沉浸版 Phase-Release: cloudflared 内网穿透（端口 3100 → prod server）
  // 2026-07-09 换新快隧道（trycloudflare.com 快隧道每次重启 cloudflared 都会换域名）
  server: {
    androidScheme: 'https',
    url: 'https://superior-quotes-inns-discipline.trycloudflare.com',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;