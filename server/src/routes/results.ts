import { Router } from 'express'
import { prisma } from '../index.js'
import { calculateScore, type Answers, type QuestionMeta, type AnswerKey } from '../services/scoring.js'
import { getTypeDimensionModules } from '../content/dimension-modules.js'

// 81型人格总结内联（避免types.ts导入链问题）
const TYPE_SUMMARIES: Record<string, string> = {
  INTJ: '头脑里永远在下一盘大棋的紫老头。表面冷若冰霜，内心有一套精密运行的战略系统。讨厌无效社交，享受独处时的深度思考，对笨蛋容忍度为零。',
  INTP: '活在自己精神世界里的药水姐，懒散外表下藏着超算级别的逻辑引擎。能为了搞懂一个问题忘记吃饭睡觉，社交场合自动开启省电模式。',
  ENTJ: '出场自带BGM的大姐头，走到哪都想接管局面。雷厉风行是本能，看到低效会血压飙升。不是故意凶，只是觉得磨叽就是在浪费生命。',
  ENTP: '抬杠是爱好不是目的，骨折眉毛的快乐源泉是观念碰撞。脑子里随时蹦出十个新点子，执行到第三个就跑去追下一个，辩论场上所向披靡。',
  INFJ: '行走的人心扫描仪，绿老头一眼看穿你的伪装。表面温和如春风，内心有永不熄灭的理想主义火炬。共情能力拉满但自己累到内耗。',
  INFP: '心里住着整个银河系的小蝴蝶，善良到让人心疼。在现实世界容易受伤，但在精神世界里是绝对的王。一支笔一个本子就能造出一整个宇宙。',
  ENFJ: '正道的光本光，大剑哥自带班主任气质。不用开口就能让人想跟他走。看到别人潜力比看到自己成就还开心，但记得你不需要拯救所有人。',
  ENFP: '行走的小太阳快乐小狗，能给任何场合注入快乐能量。好奇心旺盛到像打地鼠，今天学烘焙明天研究哲学。社交万金油，内心也需要被理解。',
  ISTJ: '秩序战神蓝老头，靠一己之力维护世界的正常运转。说一不二是标配，内心OS：规矩摆在那为什么不遵守？稳如老狗说的就是你。',
  ISFJ: '温柔到骨子里的小护士，默默记得所有人的生日和忌口。付出型人格天花板，照顾别人是本能。唯一的bug是忘了自己也需要被照顾。',
  ESTJ: '尺子姐的字典里没有差不多三个字，效率是唯一的信仰。天生的管理岗，能把一团乱麻理出Excel表格。有人说你强势，你只是觉得事情本该如此。',
  ESFJ: '带伞哥不是怕淋雨，是怕身边的人淋雨。社交场上的主心骨，聚会里的气氛组。操心是出厂设置，看到朋友开心比自己开心还满足。',
  ISTP: '人狠话不多的电钻哥，能用工具解决的问题绝不废话。冷静得像开了上帝视角看人间，动手能力MAX。内心OS：别整虚的，直接说怎么做。',
  ISFP: '审美在线的佛系小画家，对美有一种天然的雷达。不爱出风头但作品会替自己说话。看起来随和好说话，触碰到价值观底线时比谁都倔。',
  ESTP: '墨镜一戴谁都不爱的社牛天花板，走到哪都是全场焦点。行动力爆表喜欢刺激，今天想到的事今天就要干。别跟他讲理论，他信的是亲身体验。',
  ESFP: '天生C位的锤子姐，有她的地方就是派对现场。活在当下是人生信条，快乐是会传染的。虽然有时让人担心不够稳重，但你带来的快乐千金不换。',
  ISTD: '沉稳如山的实干手艺人。既有S系的脚踏实地，又多了D型的灵活变通。不慌不忙，什么事到了你手里都能找到妥帖的解法。',
  ISCD: '温柔但不失主见的调和者。S系让你扎根现实，C型让你懂得取舍。不争不抢但心里有杆秤，是身边人最安心的存在。',
  ISFD: '细腻入微的温暖守护者。S系的务实加上F型的共情，让你能在照顾别人的同时也把事情安排得明明白白。',
  ASTD: '效率与温度兼备的行动派。A型的灵活让你在不同场景切换自如，D型的弹性让你不被计划绑死。团队里最靠谱的多面手。',
  ASCD: '八面玲珑的极致平衡者。A+B+C+D四维全中，什么场景都能适应，但别忘了找个方向深耕。',
  ASFD: '柔软但坚韧的支持者。A型让你不被外界定义，F型让你心中有爱，D型让你行动有度。你是那种无声但强大的存在。',
  ESTD: '雷厉风行但会给人留余地。E型的能量+S型的务实+D型的灵活，让你既能推动事情又能照顾人情。天生的行动派指挥官。',
  ESCD: '人越多越精神的协调高手。E型让你成为社交核心，C型让你不偏不倚，D型让你把控节奏。聚会组织者和项目推动器。',
  ESFD: '活力四射的温暖担当。E型的热情+F型的关怀+D型的弹性，让你像一团永远不灭的篝火，温暖但不灼人。',
  ISCJ: '秩序与务实并存的执行者。S系的脚踏实地加上J系的规则意识，让你成为最可靠的依靠。偶尔也要允许自己放松一下标准。',
  ASTJ: '弹性切换的实干规划者。A型让你不被极端定义，S系让你稳扎稳打，J型让你有条不紊。靠得住的代名词。',
  ASCJ: '温柔而有原则的守护者。A型让你包容万物，S系让你务实可靠，J型让你坚守底线。你像一棵大树，给人荫蔽但不束缚。',
  ASFJ: '润物细无声的奉献者。A型的平衡+F型的关怀+J型的秩序，让你在不声不响中把一切都安排得暖心又妥帖。',
  ESCJ: '社交场上的可靠后盾。E型的活跃+S系的务实+J系的稳重，热闹归热闹，正经事从不掉链子。朋友圈里最靠谱的开心果。',
  IBTP: '安静但脑子转得飞快的战术分析师。I型给你专注力，B型给你平衡视角，T型给你逻辑武器。默默想清楚再出手，一击必中。',
  IBTD: '深思熟虑的弹性战略家。I型让你沉得住气，B型让你不偏激，T型让你讲逻辑，D型让你灵活调整。温水煮青蛙式的制胜者。',
  IBTJ: '缜密到可怕的规划者。I型独处蓄力+B型全局视角+T型理性判断+J型步步为营。你的Plan B比别人的Plan A还靠谱。',
  ABTP: '逻辑与自由并存的思考者。A型的灵活切换+B型的均衡认知+T型的分析力+P型的随性探索，让你成为一个有趣的理性派。',
  ABTD: '稳重中带着灵活策略的大局观者。能站在上帝视角看问题，又不失行动的温度。',
  ABTJ: '理性但不冷酷的长期主义者。A型+B型+T型+J型的组合，让你既有战略眼光又懂人情世故。你定下的目标很少半途而废。',
  EBTP: '社交能量充沛的逻辑辩论王。E型让你场上发光，B型让你辩证思考，T型让你有理有据，P型让你随时切换话题。',
  EBTD: '气势与弹性兼具的推进者。E型的冲劲+D型的变通，你不会被任何困难困住，总能找到绕过去的路。',
  EBTJ: '强悍但不僵硬的执行统帅。E型的魄力+J型的规划，你是那种说了就做、做了就能做成的人。团队里最可靠的发动机。',
  IBCP: '安静洞察一切的观察者。I型的内敛+B型的中庸+C型的兼顾+P型的随性，像一个站在角落却看透全局的智者。',
  IBCD: '中立公正的和平主义者。I型的沉静+B型的均衡+C型的复合+D型的弹性，你是最理想的和事佬，不偏不倚却让人心服。',
  IBCJ: '严谨但不刻板的记录者。I型的专注+B型的平衡+C型的全面+J型的条理，你整理的东西永远是最清晰明了的。',
  ABCP: '全能型的跨界通才。A+B+C+P四维灵活度拉满，什么都会一点、什么场合都能融入。多才多艺是你最大的标签。',
  ABCD: '万中无一的终极整合者。四维全部居中，最大优势是包容万象，最大挑战是找到真正的热爱。',
  ABCJ: '公正有序的组织者。A型的适应+B型的均衡+C型的理性+J型的条理，你的会议纪要让所有人挑不出毛病。',
  EBCP: '气场全开的社交外交官。E型的热情+B型的全局+C型的平衡+P型的随性，走到哪都是受欢迎的人。',
  EBCD: '热情又公正的召集人。E型的能量+D型的弹性，你能把完全不同的人聚到一起并让每个人都觉得被尊重。',
  EBCJ: '眼光独到的策展人。E型+B型+C型+J型的组合，你既能欣赏多元之美又有自己精准的判断力，品味一流。',
  IBFP: '用文字和情感构建世界的诗人。I型的深邃+B型的通达+F型的丰沛+P型的自由，你的内心有一座别人看不见的花园。',
  IBFD: '安静但充满治愈力量的疗愈师。I型+B型+F型+D型的组合，你不说很多话，但你的存在本身就能让身边的人感到平静。',
  IBFJ: '沉默而坚定的守护倾听者。I型的专注+B型的平衡+F型的关怀+J型的可靠，你是那种不用开口就能让人想倾诉的对象。',
  ABFP: '灵感永不枯竭的创作者。A型的自如+B型的多元+F型的丰盈+P型的随性，你的创意像泉水一样自然涌出。',
  ABFD: '温暖得恰到好处的陪伴者。A型+B型+F型+D型全居中，你不会让人感到压力，却总能在对的时候递上一杯热茶。',
  ABFJ: '无微不至的养育型关怀者。A型的包容+B型的通达+F型的慈爱+J型的细致，你照顾起人来简直是专业级别。',
  EBFP: '用热情感染全场的鼓舞者。E型的能量+B型的多元+F型的温暖+P型的自由，像一个移动的加油站，走到哪燃到哪。',
  EBFD: '人见人爱的知心朋友。E型的开朗+F型的共情+D型的弹性，你的朋友圈永远热热闹闹，因为跟你在一起真的很舒服。',
  EBFJ: '无私奉献的温暖担当。E型+F型+J型的组合让你成为社区和家庭的黏合剂，总是在为别人忙前忙后。',
  INTD: '深邃的战略蓝图家。直觉的远见+逻辑的严谨+动态的弹性，你的大脑里有一张别人看不到的未来地图。',
  ANTP: '天马行空的机械发明家。A型灵活+N型跳跃+T型逻辑+P型探索，脑子里永远转着下一个让世界惊叹的发明。',
  ANTD: '站在时间线前面看世界的先知者。N型的远见+D型的弹性，你总是比别人早半步看到趋势，但也要有耐心等别人追上。',
  ANTJ: '手握蓝图的总设计师。N型的宏观视野+T型的逻辑推演+J型的执行规划，你设计的东西从来不是小打小闹。',
  ENTD: '勇往直前的开拓先锋。E型的冲劲+N型的远见+D型的灵活，你天生适合走别人没走过的路。',
  INCP: '向内探索精神世界的冥想者。I型的内省+N型的抽象+C型的兼顾+P型的自由，你的内心有一片宁静的深海。',
  INCD: '与古今智慧对话的哲人。I型的沉静+N型的深刻+C型的全面+D型的灵活，你对话的人可能是两千年前的先贤。',
  INCJ: '以笔为剑的编撰者。I型的专注+N型的深刻+C型的兼顾+J型的严谨，你写下的每一个字都经过千锤百炼。',
  ANCP: '在科学和艺术之间自由穿梭的跨界者。A型的自如+N型的创造+C型的整合+P型的探索，文理兼修难不倒你。',
  ANCD: '阅尽千帆后归于平和的智者。A型的通达+N型的深远+C型的包容+D型的圆融，你说话不多，但每一句都值得记下来。',
  ANCJ: '不偏不倚的终极裁判者。A型+N型+C型+J型的组合让你成为最公正的判断者，你的裁决让人心服口服。',
  ENCP: '用语言点燃思想的演说家。E型的热情+N型的深度+C型的全面+P型的随性，你的演讲让人想站起来鼓掌。',
  ENCD: '连接对立面的调解大师。E型的能量+N型的视野+C型的平衡+D型的弹性，你能让死对头坐下来握手言和。',
  INFD: '温柔而坚定的精神牧者。I型的深邃+N型的远方+F型的温暖+D型的弹性，像一盏在旷野中静静发光的灯。',
  ANFP: '眼里有星辰大海的理想家。A型的自如+N型的浪漫+F型的热忱+P型的自由，你相信世界应该更美好并愿意为此努力。',
  ANFD: '耐心浇灌每一颗种子的培育者。A型的包容+N型的远见+F型的关爱+D型的弹性，你不急不躁地等待每一朵花开。',
  ANFJ: '温润如玉的人生导师。A型的通达+N型的深刻+F型的关怀+J型的引导，点拨别人的时候总是恰到好处。',
  ENFD: '灵魂深处的共鸣知音。E型的温暖+N型的深度+F型的共情+D型的弹性，和你聊天总能说进心坎里。',
  ISCP: '低调但靠谱的实干巧匠。I型专注+S系务实+C型兼顾+P型随性，手艺精湛但不爱显摆，默默把事做到极致。',
  ASTP: '灵活应变的实战技师。A型适配上S系落地+P型探索，什么问题到你手里都能现场解决，动手能力让人服气。',
  ASCP: '随心所欲不逾矩的手艺人。A型自如+S系踏实+C型全面+P型自由，做东西既有章法又有灵气，人狠话不多。',
  ASFP: '天生自带聚光灯的表演者。A型灵巧+S系活在当下+F型感染力+P型即兴发挥，有你的地方就不会冷场。',
  ESCP: '走到哪都是气氛组的行动派。E型热情+S系务实+C型兼顾+P型随性，既能炒热场子也能把事情落地。',
  ENCJ: '威严与智慧并重的大法官。E型气场+N型远见+C型平衡+J型决断，你的判断让人信服，你的公正不偏不倚。',
}

export const resultRoutes = Router()

// POST /api/results/score - compute scores from answers (server-authoritative)
resultRoutes.post('/score', async (req, res, next) => {
  try {
    const body = req.body as {
      answers?: Record<string, string>
      questionIds?: number[]
      duration?: number
      timedOut?: Record<string, boolean>
    } | undefined
    if (!body || typeof body.answers !== 'object' || body.answers === null) {
      res.status(400).json({ success: false, error: 'answers (object) required' })
      return
    }

    const VALID_KEYS = new Set<AnswerKey>(['A', 'B', 'C', 'D', 'E'])
    const answers: Answers = {}
    for (const [k, v] of Object.entries(body.answers)) {
      const id = Number(k)
      if (!Number.isInteger(id) || id <= 0) continue
      if (typeof v !== 'string' || !VALID_KEYS.has(v as AnswerKey)) continue
      answers[id] = v as AnswerKey
    }

    // If client supplies questionIds, score only those (matches the actual quiz the user took).
    // Otherwise fall back to all questions in DB.
    const idFilter = Array.isArray(body.questionIds)
      ? body.questionIds.filter((n): n is number => Number.isInteger(n) && n > 0)
      : null

    const rows = await prisma.question.findMany({
      where: idFilter && idFilter.length > 0 ? { id: { in: idFilter } } : undefined,
      select: { id: true, dimension: true, type: true, correctAnswer: true },
    })
    const questions: QuestionMeta[] = rows.map(r => ({
      id: r.id,
      dimension: r.dimension as QuestionMeta['dimension'],
      type: r.type as QuestionMeta['type'],
      correctAnswer: r.correctAnswer ?? null,
    }))

    // Parse timedOut: convert string-number keys to number keys
    const timedOut: Record<number, boolean> = {}
    if (body.timedOut && typeof body.timedOut === 'object') {
      for (const [k, v] of Object.entries(body.timedOut)) {
        const id = Number(k)
        if (Number.isInteger(id) && id > 0) timedOut[id] = !!v
      }
    }

    const result = calculateScore(answers, questions, timedOut)

    res.json({
      success: true,
      data: {
        typeCode: result.typeCode,
        scores: result.scores,
        chars: result.chars,
        confidence: result.confidence,
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/results - list all personality types (for homepage grid)
resultRoutes.get('/', async (_req, res, next) => {
  try {
    const types = await prisma.personalityType.findMany({
      select: {
        code: true,
        name: true,
        isTraditional: true,
        population: true,
        celebrities: true,
      },
      orderBy: { code: 'asc' },
    })
    res.json({
      success: true,
      data: types.map(t => ({
        ...t,
        celebrities: JSON.parse(t.celebrities || '[]'),
        imageUrl: `/api/images/${t.code}`,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/results/:typeCode/summary - compact result for listing
resultRoutes.get('/:typeCode/summary', async (req, res, next) => {
  try {
    const { typeCode } = req.params
    const type = await prisma.personalityType.findUnique({
      where: { code: typeCode.toUpperCase() },
      select: { code: true, name: true, isTraditional: true, overview: true },
    })
    if (!type) {
      res.status(404).json({ success: false, error: 'Type not found' })
      return
    }
    res.json({ success: true, data: type })
  } catch (err) {
    next(err)
  }
})

// GET /api/results/:typeCode - get personality type description
resultRoutes.get('/:typeCode', async (req, res, next) => {
  try {
    const { typeCode } = req.params
    const type = await prisma.personalityType.findUnique({
      where: { code: typeCode.toUpperCase() },
    })
    if (!type) {
      res.status(404).json({ success: false, error: 'Type not found' })
      return
    }
    // 使用81型独立维度模块（覆盖DB中的旧值，确保81型全部有独立文案）
    const dimModules = getTypeDimensionModules(type.code)

    // Parse JSON fields
    res.json({
      success: true,
      data: {
        ...type,
        summary: TYPE_SUMMARIES[type.code] ?? null,
        eiModule: dimModules.eiModule,
        snModule: dimModules.snModule,
        tfModule: dimModules.tfModule,
        pjModule: dimModules.pjModule,
        strengths: JSON.parse(type.strengths),
        growthAreas: JSON.parse(type.growthAreas),
        careers: JSON.parse(type.careers),
        suitableFields: JSON.parse(type.suitableFields),
        celebrities: JSON.parse(type.celebrities || '[]'),
        imageUrl: `/api/images/${type.code}`,
      },
    })
  } catch (err) {
    next(err)
  }
})
