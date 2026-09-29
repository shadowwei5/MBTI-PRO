import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const questions = await prisma.question.findMany({ take: 100 });
  questions.forEach(x => {
    const opt = JSON.parse(x.options || '[]');
    console.log(x.id.toString().padStart(3), x.type.padEnd(10), x.dimension.padEnd(10), 
      'text:', !!x.text, 'textLeft:', !!x.textLeft, 'textRight:', !!x.textRight, 
      'optCount:', opt.length);
  });
  console.log('Total:', questions.length);
}
main().then(() => prisma.$disconnect()).catch(console.error);
