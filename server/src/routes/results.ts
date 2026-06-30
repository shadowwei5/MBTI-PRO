import { Router } from 'express'
import { prisma } from '../index.js'
import { calculateScore, type Answers, type QuestionMeta, type AnswerKey } from '../services/scoring.js'
import { getTypeDimensionModules } from '../content/dimension-modules.js'
import { isOrderPaid } from './payment.js'

// 81型人格总结内联（避免types.ts导入链问题）
const TYPE_SUMMARIES: Record<string, string> = {
  INTJ: '脑子里永远在下一盘大棋的紫老头。看起来冷冰冰的，其实心里早就把一百种可能性都推演过了。他不是不会社交，是懒得跟不聪明的人浪费时间——独处的时候才最自在。',
  INTP: '活在自己精神世界里的药水姐。懒散是真的懒散，但脑子转起来比谁都快。为了搞懂一个问题，她能忘了吃饭、忘了睡觉、忘了今天是星期几。社交场合自动开启省电模式，不是社恐，是觉得闲聊太没意思。',
  ENTJ: '出场自带BGM的大姐头，走到哪都想接管局面。雷厉风行是本能，看到低效会血压飙升。不是故意凶——她只是觉得磨叽就是在浪费所有人的生命。跟着她干，累是真累，但事一定能成。',
  ENTP: '抬杠是爱好，不是为了惹你生气。骨折眉毛的快乐源泉是：一个想法撞上另一个想法，然后蹦出第三个谁都没想过的想法。脑子里随时在开头脑风暴，执行到一半就跑去找新点子了——但那个新点子往往是真的好东西。',
  INFJ: '行走的人心扫描仪。绿老头表面温和如春风，看你的第一眼已经把你说不清楚的情绪都读出来了。共情能力拉满，但也因此特别容易累。他心里有一团理想主义的火，烧了很多年都没灭。',
  INFP: '心里住着整个银河系的小蝴蝶。善良到让人担心，在现实世界里容易磕磕碰碰，但在自己的精神世界里是绝对的王。一支笔一个本子就能造出一个宇宙。难过的时候别劝她振作，陪她坐一会儿就好。',
  ENFJ: '正道的光本光。大剑哥自带班主任气质——不是他故意要管你，是他真的看到了你身上连你自己都没发现的潜力。但说真的，你得记住：你不欠任何人的，不需要拯救所有人。',
  ENFP: '走到哪亮到哪的快乐小狗。对什么都好奇，烘焙课上了三节又跑去读哲学史，朋友们早就习惯了。看起来没心没肺的开心果，其实也需要有人认真听他说说话——快乐的人也有不快乐的时候。',
  ISTJ: '秩序就是他的信仰。蓝老头不是不想放松，是他觉得规矩摆在那不遵守就很离谱。说一不二，准时是底线，靠谱是他的出厂设置。跟这样的人共事，你永远不用操心他掉链子。',
  ISFJ: '温柔到骨子里的小护士。她记得所有人的生日、忌口、过敏源，唯独忘了自己也需要被照顾。付出型人格天花板——但她从来不会挂在嘴边说。最让人心疼的是，她习惯了被人需要的感觉，却不好意思需要别人。',
  ESTJ: '尺子姐的字典里没有「差不多」三个字。效率是唯一的信仰，天生的管理岗，能把一团乱麻理出Excel表格。有人说她强势——她不否认，因为她觉得事情本来就该这样做。跟她共事，先把标准对齐，后面的路就好走了。',
  ESFJ: '带伞哥不是怕自己淋雨，是怕身边的人淋雨。操心是他的出厂设置——看到朋友开心，比自己开心还满足。聚会上最忙的那个一定是他：端茶、递纸巾、确认每个人都被照顾到了。有时候也想劝他歇一歇。',
  ISTP: '人狠话不多的电钻哥。能用工具解决的问题，一句废话都懒得多说。冷静得像开了上帝视角，动手能力强到让人觉得他什么都会修。内心的OS永远是：别跟我整虚的，直接说怎么做。',
  ISFP: '审美在线的佛系小画家。对美有一种天然的雷达——她说不清楚为什么好看，但就是知道。不爱出风头，但作品会替她说话。看起来随和好说话，一碰到价值观底线，比谁都倔。',
  ESTP: '墨镜一戴谁都不爱的社牛天花板。行动力爆表，今天想到的事今天就要干——明天？明天再说。别跟他讲理论，他信的是亲身体验。跟他出去玩，永远不会无聊，但可能会破产。',
  ESFP: '天生C位的锤子姐。有她的地方就是派对——不是因为她办了派对，是因为她本身就是。活在当下是人生信条，快乐是会传染的。偶尔让你担心她不够稳重，但你不得不承认：有她在的地方，空气都不一样。',
  ISTD: '沉稳如山的实干手艺人。不慌不忙，什么事到了他手里都能找到妥帖的解法。S系的脚踏实地加上D型的灵活变通——该坚持的时候一步不退，该转弯的时候也不死磕。',
  ISCD: '温柔但不失主见的调和者。不争不抢，但心里那杆秤一直端得平。S系让他扎根现实，C型让他懂得取舍。在所有人吵成一团的时候，他是那个安静听完、然后说出每个人都能接受的方案的人。',
  ISFD: '细腻到骨子里的温暖守护者。S系的务实让她把生活安排得井井有条，F型的共情让她能感受到身边人自己都没察觉到的情绪。被这样的人认真对待过，才知道什么叫被放在心上。',
  ASTD: '效率与温度兼备的行动派。A型的灵活让她在不同场景之间切换自如，D型的弹性让她不会被计划绑死。团队里那个「什么都能干、什么都能干好」的人就是她。',
  ASCD: '八面玲珑的平衡者。四个维度全中——不是没有主见，是真的能从每个角度看问题。什么场景都能适应，唯一的问题是有时候太适应了，忘了自己也可以选一个方向深耕下去。',
  ASFD: '柔软但坚韧的支持者。A型让她不被外界定义，F型让她心里有温度，D型让她行动有分寸。不是那种大声说爱你的人，但你需要的时候，她一定在。',
  ESTD: '雷厉风行但会给人留余地的行动派。E型的能量让她能推动事情，S系的务实让她不会飘，D型的灵活让她不僵化。天生的行动派指挥官——跟她干，痛快。',
  ESCD: '人越多越精神的协调高手。E型让她成为社交核心，C型让她不偏不倚，D型让她把控节奏。聚会组织者、项目推动器，同时能把每个人的情绪都照顾到。',
  ESFD: '像一团永远不灭的篝火。E型的热情、F型的关怀、D型的弹性——温暖，但不灼人。跟她在一起，你会觉得这个世界好像也没那么糟糕。',
  ISCJ: '秩序与务实并存的执行者。S系让他脚踏现实，J系让他严守规则。是那种你永远可以依赖的人——偶尔也允许自己放松一下标准，完美不是唯一选项。',
  ASTJ: '弹性切换的实干规划者。A型让你不被极端定义，S系让你稳扎稳打，J型让你有条不紊。靠得住三个字，就是为他量身定做的。',
  ASCJ: '温柔而有原则的守护者。像一棵大树——给人荫蔽，但不束缚。A型包容、S系可靠、J型坚守，在混乱中他是那个让人安心的坐标。',
  ASFJ: '润物细无声的奉献者。A型的平衡、F型的关怀、J型的秩序——她不在聚光灯下，但每个人回头看都会发现：原来一直是她把一切都安排得那么暖心。',
  ESCJ: '社交场上的可靠后盾。E型活跃、S系务实、J型稳重——热闹归热闹，正经事从不掉链子。朋友圈里那个最靠谱的开心果就是他。',
  IBTP: '安静但脑子转得飞快的战术分析师。I型给他专注力，B型给他平衡视角，T型给他逻辑武器。默默想清楚，再出手——一击必中。他不说话的时候，往往是在算。',
  IBTD: '深思熟虑的弹性战略家。I型让他沉得住气，B型让他不偏激，T型让他讲逻辑，D型让他灵活调整。温水煮青蛙式的制胜者——等你反应过来，他已经赢了。',
  IBTJ: '缜密到让人害怕的规划者。I型独处蓄力、B型全局视角、T型理性判断、J型步步为营。他的Plan B比你的Plan A还周全。跟他对赌，想清楚再说。',
  ABTP: '逻辑与自由并存的思考者。A型灵活、B型均衡、T型分析、P型随性——他是个有趣的理性派。能跟你聊哲学聊到凌晨三点，也能在KTV里最疯。',
  ABTD: '稳重中带着灵活的大局观者。能站在上帝视角看问题，又不会让人觉得高高在上。他知道什么时候该坚持，什么时候该妥协——这种分寸感，很难得。',
  ABTJ: '理性但不冷酷的长期主义者。既有战略眼光又懂人情世故。他定下的目标，很少有半途而废的。不是因为意志力，是因为他真的想清楚了。',
  EBTP: '社交能量充沛的逻辑辩论王。E型让他场上发光，B型让他辩证思考，T型让他有理有据，P型让他随时切换话题。跟他辩论很有意思，但很难赢。',
  EBTD: '气势与弹性兼具的推进者。E型的冲劲加上D型的变通——没有什么困难能困住他，因为他总能找到绕过去的路。不是硬闯，是聪明地绕。',
  EBTJ: '强悍但不僵硬的执行统帅。E型的魄力加上J型的规划——说了就做，做了就做成。不是那种画大饼的人，他给你的时间线，你信就对了。',
  IBCP: '安静洞察一切的观察者。I型内敛、B型中庸、C型兼顾、P型随性——他站在角落，但什么都看见了。不爱说话，一开口往往就是点中要害。',
  IBCD: '中立公正的和平主义者。不偏不倚却让人心服——I型的沉静、B型的均衡、C型的复合、D型的弹性。所有人吵累了回头看他，他已经在喝茶了。',
  IBCJ: '严谨但不刻板的记录者。I型专注、B型平衡、C型全面、J型条理——他整理的东西永远是最清晰明了的。不是强迫症，是真的在乎信息的准确性。',
  ABCP: '全能型的跨界通才。四维灵活度全部拉满——什么都会一点，什么场合都能融入。多才多艺是他最大的标签，但有时候连他自己都不知道：我到底最喜欢什么？',
  ABCD: '什么都会一点、什么都懂一些的通才。不偏激、不极端，像水一样能适应各种环境。但问题也在这——太能适应了，反而搞不清楚自己到底想要什么。',
  ABCJ: '公正有序的组织者。A型的适应、B型的均衡、C型的理性、J型的条理——他的会议记录让所有人挑不出毛病。不是他想卷，是他真的看不下去混乱。',
  EBCP: '气场全开的社交外交官。E型热情、B型全局、C型平衡、P型随性——走到哪都是受欢迎的人。不是他刻意讨好，是他真的对每个人都有好奇心。',
  EBCD: '热情又公正的召集人。E型的能量加上D型的弹性——他能把完全不同的人聚到一起，让每个人都觉得被尊重。不是和稀泥，是真的在听每个人说话。',
  EBCJ: '眼光独到的策展人。既能欣赏多元之美，又有自己精准的判断力。不是什么都觉得好，而是知道什么是真的好。品位这个东西，说有就有，说没有你怎么装都装不出来。',
  IBFP: '用文字和情感构建世界的诗人。I型的深邃、B型的通达、F型的丰沛、P型的自由——他的内心有一座别人看不见的花园。他不会主动邀请你进去，但如果你偶然路过，会被美到说不出话。',
  IBFD: '安静但充满治愈力量的疗愈师。他不说很多话，但他的存在本身就能让身边的人感到平静。你焦虑的时候去找他，不用他说什么，光是在他旁边坐一会儿，心里就踏实了。',
  IBFJ: '沉默而坚定的守护倾听者。不用开口就能让人想倾诉——I型的专注、B型的平衡、F型的关怀、J型的可靠。他说得很少，但每句话都让你觉得：他真的听懂了。',
  ABFP: '灵感永不枯竭的创作者。创意像泉水一样自然涌出来——A型自如、B型多元、F型丰盈、P型随性。不是那种苦思冥想型的艺术家，他是那种洗澡洗到一半突然冲出来找纸笔的人。',
  ABFD: '温暖得恰到好处的陪伴者。你不会觉得他有压力，但他总能在对的时候递上一杯热茶。四个维度全居中——不冷也不热，不远也不近，刚好是你需要的那种温度。',
  ABFJ: '无微不至的养育型关怀者。照顾起人来简直是专业级别——A型包容、B型通达、F型慈爱、J型细致。不是他刻意去做，是他不做就会浑身不舒服。',
  EBFP: '用热情感染全场的鼓舞者。像一个移动的加油站——走到哪燃到哪。E型的能量、B型的多元、F型的温暖、P型的自由。他会在你灰心的时候拍你肩膀说：可以的，再试一次。',
  EBFD: '人见人爱的知心朋友。E型的开朗、F型的共情、D型的弹性——朋友圈永远热热闹闹。不是他人脉广，是跟他在一起真的太舒服了。舒服到你想多待一会儿，再多待一会儿。',
  EBFJ: '无私奉献的温暖担当。E型+F型+J型——社区的和事佬、家庭的粘合剂。总在忙前忙后为别人操心，有时候真想跟他说一句：为自己也活一天吧。',
  INTD: '深邃的战略蓝图家。直觉的远见加上逻辑的严谨加上动态的弹性——他脑子里有一张别人看不到的未来地图。不是算命，是他在别人还在看棋盘的时候已经在算十步之后了。',
  ANTP: '天马行空的机械发明家。脑子里永远转着下一个让世界惊叹的东西——A型灵活、N型跳跃、T型逻辑、P型探索。别人眼里的废铁在他手里就是下一个发明。实验室乱得像台风过境，但他知道每样东西在哪。',
  ANTD: '站在时间线前面看世界的先知者。他总是比别人早半步看到趋势——N型的远见加上D型的弹性。但有时候走太快了，回头一看大家都还在原地。等一等别人，也是一种智慧。',
  ANTJ: '手握蓝图的总设计师。N型的宏观视野、T型的逻辑推演、J型的执行规划——他设计的东西从来不是小打小闹。不是野心大，是他真的看到了更大的可能性。',
  ENTD: '勇往直前的开拓先锋。E型的冲劲、N型的远见、D型的灵活——天生适合走别人没走过的路。不是他不怕，是他觉得怕也要往前走。',
  INCP: '向内探索精神世界的冥想者。他的内心有一片别人走不进去的深海——I型内省、N型抽象、C型兼顾、P型自由。不需要很多人理解他，一两个就够了。',
  INCD: '与古今智慧对话的哲人。I型沉静、N型深刻、C型全面、D型灵活——两千年前的先贤，他读起来像昨天刚聊过天。不是书呆子，是真的在书里找到了活着的答案。',
  INCJ: '以笔为剑的编撰者。I型专注、N型深刻、C型兼顾、J型严谨——他写下的每一个字都经过千锤百炼。不是写得慢，是对自己要求高。',
  ANCP: '在科学和艺术之间自由穿梭的跨界者。文理兼修难不倒他——A型自如、N型创造、C型整合、P型探索。左手公式右手诗，不是装，是真的都喜欢。',
  ANCD: '阅尽千帆后归于平和的智者。说话不多，但每一句都值得记下来——A型通达、N型深远、C型包容、D型圆融。不是老了才这样，是早就想明白了。',
  ANCJ: '不偏不倚的终极裁判者。他的裁决让人心服口服——不是他权力大，是他的判断经得起推敲。每一条结论后面都跟着逻辑和证据。',
  ENCP: '用语言点燃思想的演说家。他的演讲让人想站起来鼓掌——不是口才好，是他说的每句话都是从心里长出来的。E型热情、N型深度、C型全面、P型随性。',
  ENCD: '连接对立面的调解大师。能让死对头坐下来握手言和——E型能量、N型视野、C型平衡、D型弹性。不是和稀泥，是他真的帮双方看到了第三条路。',
  INFD: '温柔而坚定的精神牧者。像一盏在旷野中静静发光的灯——I型深邃、N型远方、F型温暖、D型弹性。他不催你往前走，只是让你知道：有人在前面亮着灯。',
  ANFP: '眼里有星辰大海的理想家。相信世界应该更美好，而且真的愿意为此努力——A型自如、N型浪漫、F型热忱、P型自由。不是傻白甜，是明知不完美还选择相信。',
  ANFD: '耐心浇灌每一颗种子的培育者。不急不躁地等待每一朵花开——A型包容、N型远见、F型关爱、D型弹性。别人都在急着摘果子的时候，他还在弯腰浇水。',
  ANFJ: '温润如玉的人生导师。点拨别人的时候总是恰到好处——A型通达、N型深刻、F型关怀、J型引导。不是好为人师，是你问了他就认真回答。',
  ENFD: '灵魂深处的共鸣知音。和她聊天总能说进心坎里——E型温暖、N型深度、F型共情、D型弹性。不是心理咨询师，但跟她聊完天你会觉得比做了咨询还舒服。',
  ISCP: '低调但靠谱的实干巧匠。I型专注加上S系务实，手艺精湛但不爱显摆。默默把事情做到极致——他不说，但你拿到手里就知道不一样。',
  ASTP: '灵活应变的实战技师。A型适配加上S系落地，什么实际问题到了他手里都能被现场解决。动手能力强到让旁边的人觉得自己是不是少了双手。',
  ASCP: '随心所欲不逾矩的手艺人。A型自如、S系踏实、C型全面、P型自由——做东西既有章法又有灵气。不是那种高调炫耀的人，但你看到他的作品就会服。',
  ASFP: '天生自带聚光灯的表演者。A型灵巧、S系活在当下、F型感染力、P型即兴发挥——有她的地方就不会冷场。不是她在追光，是光在追她。',
  ESCP: '走到哪都是气氛组的行动派。E型热情、S系务实、C型兼顾、P型随性——既能炒热场子也能把事情落地。不是只会玩，是玩着玩着就把活干了。',
  ENCJ: '威严与智慧并重的大法官。E型气场、N型远见、C型平衡、J型决断——他的判断让人信服。不是靠吼，是每一句话都经过了脑子的过滤。',
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
    const unlockToken = typeof req.query.token === 'string' ? req.query.token : ''
    const type = await prisma.personalityType.findUnique({
      where: { code: typeCode.toUpperCase() },
    })
    if (!type) {
      res.status(404).json({ success: false, error: 'Type not found' })
      return
    }
    const paid = unlockToken ? await isOrderPaid(type.code, unlockToken) : false
    const dimModules = paid ? getTypeDimensionModules(type.code) : null

    // Parse JSON fields
    res.json({
      success: true,
      data: {
        code: type.code,
        name: type.name,
        isTraditional: type.isTraditional,
        summary: TYPE_SUMMARIES[type.code] ?? null,
        overview: paid ? type.overview : '',
        population: paid ? type.population : null,
        eiModule: dimModules?.eiModule ?? null,
        snModule: dimModules?.snModule ?? null,
        tfModule: dimModules?.tfModule ?? null,
        pjModule: dimModules?.pjModule ?? null,
        strengths: paid ? JSON.parse(type.strengths) : [],
        growthAreas: paid ? JSON.parse(type.growthAreas) : [],
        careers: paid ? JSON.parse(type.careers) : [],
        suitableFields: paid ? JSON.parse(type.suitableFields) : [],
        celebrities: paid ? JSON.parse(type.celebrities || '[]') : [],
        imageUrl: `/api/images/${type.code}`,
        paid,
      },
    })
  } catch (err) {
    next(err)
  }
})
