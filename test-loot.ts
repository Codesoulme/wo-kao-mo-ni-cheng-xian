import { sanitizeLootName } from './src/lib/xianxia/display';

const inputs = ['山匪头目的储物袋', '王铁匠的铁锤', '从鬼间传人处夺取的令牌'];
for (const inp of inputs) {
  console.log(JSON.stringify(inp), '->', JSON.stringify(sanitizeLootName(inp)));
}