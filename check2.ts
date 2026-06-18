import { db } from './src/lib/db';
async function main() {
  const char = await db.character.findUnique({ where: { id: 'cmqiu8hym0008lspzjgkd6syz' } });
  console.log('isAtChoice:', char?.isAtChoice);
  console.log('age:', char?.age);
  console.log('pendingChoiceJson len:', char?.pendingChoiceJson?.length);
}
main().finally(() => process.exit(0));
