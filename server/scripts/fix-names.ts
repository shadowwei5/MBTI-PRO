import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const u: Record<string,string> = {ABCD:'全能者型',ABFJ:'和谐者型',ABCP:'洒脱者型',ABFP:'悠然者型',ABFD:'温润者型',ESFD:'呵护者型'}
for(const [c,n] of Object.entries(u)) {
  await p.personalityType.update({where:{code:c},data:{name:n}}).catch(()=>{})
  console.log(c+' -> '+n)
}
await p.$disconnect()
