import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cn.codesoulme.chengxian',
  appName: '我靠模拟成仙',
  webDir: 'public',
  // SSR 模式：App 直接拉远端 Next.js 服务。
  // 开发期连模拟器宿主回环；生产期切到公网部署后再改成 https 公网域名。
  server: {
    androidScheme: 'https',
    url: 'http://10.0.2.2:3000',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
