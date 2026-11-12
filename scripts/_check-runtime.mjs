import { getCelebrityProfiles } from '../server/src/content/types.ts';
import { getCelebrityField } from '../server/src/content/celebrity-fields.ts';

const CODES = ['INTP', 'ENFP', 'ESTJ', 'ABCD', 'IBTJ', 'ISCP', 'ANTJ', 'EBTD', 'ISFJ'];
for (const c of CODES) {
  const rows = getCelebrityProfiles(c);
  console.log(`\n${c}`);
  for (const r of rows) console.log(`  ${r.name.padEnd(12, '　')} ${r.field}`);
}


console.log('\n身份抽查：曾国藩 =', getCelebrityField('曾国藩'), '｜ 罗翔 =', getCelebrityField('罗翔'));
