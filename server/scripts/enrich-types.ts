// 为16个传统类型批量写入 traitTags（网络标签）到 DB
import { PrismaClient } from '@prisma/client'
import { join } from 'node:path'

const prisma = new PrismaClient()

// 16型网络特质标签（来自抖音/小红书/B站高频搜索）
const TRAITS: Record<string, string[]> = {
  INTJ: ['紫老头','运筹帷幄','厌蠢症','高冷孤傲','天生战略家','已读不回','社交面具人'],
  INTP: ['药水姐','逻辑鬼才','已读不回','温暖的机器人','闷声干大事','话题终结者','人机'],
  ENTJ: ['大姐头','霸总','天生统帅','卷王','目标导向','掌控全局','效率至上'],
  ENTP: ['骨折眉','杠精','灵魂辩手','点子机器','不杠不舒服','好奇心永动机','三天换一个梦想'],
  INFJ: ['绿老头','高敏感雷达','黑心圣母','安静变革者','人道主义','社交隐身','知世故不世故'],
  INFP: ['小蝴蝶','内耗之王','随时随地emo','文艺青年','柔软又倔强','精神深海鱼','小哭包'],
  ENFJ: ['大剑哥','温暖总指挥','灵魂导师','社交领袖','让每个人看见更好的自己','理想传教士'],
  ENFP: ['快乐小狗','人形弹簧','三分钟热度','气氛组组长','自由精神','永远在追新的可能性'],
  ISTJ: ['蓝老头','行走的规章制度','机器人','背锅的牛','说一不二','秩序捍卫者','老干部'],
  ISFJ: ['小护士','默默守护','细致的观察者','温柔但顽强','老黄牛','可触摸的温暖','妈妈型人格'],
  ESTJ: ['尺子姐','效率至上','卷王之王','干活的爹','标准践行者','组织狂','冷面执行官'],
  ESFJ: ['小蛋糕','社交中心','热心肠','小区热心大妈','端水大师','无微不至','交际花'],
  ISTP: ['电钻哥','动手狂魔','独行侠','冷静实践者','工具精灵','行动中的理性'],
  ISFP: ['小画家','隐形艺术家','温柔叛逆','随性主义者','感官漫游者','活在当下'],
  ESTP: ['墨镜哥','地表最强社牛','冒险实干派','随机应变之王','行动先于思考'],
  ESFP: ['沙锤姐','派对明星','氛围组组长','表演型人格','生命力的绽放','即时快乐主义者'],
}

async function main() {
  console.log('📝 写入 16 型 traitTags...\n')
  for (const [code, tags] of Object.entries(TRAITS)) {
    await prisma.personalityType.update({
      where: { code },
      data: { traitTags: JSON.stringify(tags) },
    })
    console.log(`  ✅ ${code}: ${tags.slice(0,3).join(', ')}...`)
  }
  console.log(`\n✅ 完成! 共 ${Object.keys(TRAITS).length} 个类型`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
