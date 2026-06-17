import { PrismaClient } from '@prisma/client'
import { buildTypeContent, handCraftedTypes, generateAllTypeCodes } from './content/types.js'

const prisma = new PrismaClient()

const bipolarOptions = [
  { key: 'A', label: '非常认同左侧/上方' },
  { key: 'B', label: '认同左侧/上方' },
  { key: 'C', label: '中立' },
  { key: 'D', label: '认同右侧/下方' },
  { key: 'E', label: '非常认同右侧/下方' },
]

interface SeedQuestion {
  id: number
  text: string
  textLeft?: string | null
  textRight?: string | null
  dimension: string
  type: 'likert' | 'objective'
  options: { key: string; label: string }[]
  correctAnswer?: string | null
  sortOrder: number
}

const questions: SeedQuestion[] = [
  // ═══════════════════════════════════════════════════════════
  // E_I 维度 - 双极量表 (25题, id 1-25)
  // 左侧=E外向倾向, 右侧=I内向倾向
  // ═══════════════════════════════════════════════════════════
  { id: 1, text: '', textLeft: '参加大型聚会后，我感到精力充沛、心情愉悦。', textRight: '参加大型聚会后，我需要独处一段时间来恢复精力。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 1 },
  { id: 2, text: '', textLeft: '我喜欢成为众人关注的焦点。', textRight: '我更喜欢在幕后默默贡献，不习惯成为注意力的中心。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 2 },
  { id: 3, text: '', textLeft: '我习惯边说话边思考，在交流中形成自己的观点。', textRight: '我习惯先在心中理清思路，然后再清晰地表达出来。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 3 },
  { id: 4, text: '', textLeft: '太长时间独处会让我能量不足，与人互动能让我重新充电。', textRight: '独处对我来说是恢复精力的重要方式，我很享受独处时光。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 4 },
  { id: 5, text: '', textLeft: '结识新朋友对我来说是一件自然且愉快的事。', textRight: '与少数知心好友深度相处比认识很多新朋友更让我满足。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 5 },
  { id: 6, text: '', textLeft: '在团队讨论中，我通常是发言最多的人之一。', textRight: '在团队讨论中，我更多是倾听和观察，深思熟虑后再发言。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 6 },
  { id: 7, text: '', textLeft: '遇到问题时，我倾向于立刻找人讨论交流。', textRight: '遇到问题时，我倾向于先独自思考，想清楚后再与人交流。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 7 },
  { id: 8, text: '', textLeft: '我的社交圈子很广，认识各行各业的人。', textRight: '我的社交圈子小而精，都是我能深入交流的挚友。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 8 },
  { id: 9, text: '', textLeft: '电话或语音沟通比文字沟通让我觉得更直接、更自在。', textRight: '文字沟通比电话或语音让我更自在，可以字斟句酌。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 9 },
  { id: 10, text: '', textLeft: '在新的集体环境中，我能很快打开话匣子融入其中。', textRight: '在新的集体环境中，我倾向于先观察，等熟悉后才慢慢融入。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 10 },
  { id: 11, text: '', textLeft: '周末我更愿意出门参加活动，而不是待在家里。', textRight: '周末我更愿意在家里安静地度过，做自己喜欢的事情。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 11 },
  { id: 12, text: '', textLeft: '比起独自工作，我在团队协作中效率更高、更有动力。', textRight: '比起团队协作，我独自工作时效率更高、更加专注。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 12 },
  { id: 13, text: '', textLeft: '我喜欢在热闹的环境中工作或学习，背景噪音让我更专注。', textRight: '我需要安静的环境才能集中精力工作和学习。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 13 },
  { id: 14, text: '', textLeft: '我喜欢参与多种不同类型的社交活动，日程通常排得比较充实。', textRight: '我倾向于把时间和精力留给少数几件真正重要的事，避免精力分散。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 14 },
  { id: 15, text: '', textLeft: '长时间独处后我会渴望与人交流，从外界获取能量。', textRight: '长时间的社交活动后，我需要独处来恢复精力。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 15 },
  { id: 16, text: '', textLeft: '想到什么就说什么，即使想法还不太成熟也没关系。', textRight: '做重要决定之前，我需要安静地思考和反复权衡。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 16 },
  { id: 17, text: '', textLeft: '口头表达让我感觉更直接，能更快与人建立联系。', textRight: '我更擅长用文字准确地表达自己的想法。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 17 },
  { id: 18, text: '', textLeft: '在人群中让我感到兴奋和充满活力。', textRight: '在人群中待太久后，我需要独处来恢复内心的宁静与平衡。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 18 },
  { id: 19, text: '', textLeft: '我经常主动组织聚会或活动，享受把大家聚在一起的乐趣。', textRight: '我更倾向于回应朋友的邀请，而非自己主动发起社交活动。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 19 },
  { id: 20, text: '', textLeft: '我通过与他人交流来整理和厘清自己的想法。', textRight: '我的内心世界很丰富，常常进行自我对话和反思。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 20 },
  { id: 21, text: '', textLeft: '在重要的职业决策上，我会广泛咨询多方意见后再做决定。', textRight: '在重要的职业决策上，我更多地依靠自己的独立判断和深层思考。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 21 },
  { id: 22, text: '', textLeft: '我喜欢迅速行动，在实践中不断调整和迭代。', textRight: '比起立刻行动，我习惯先观察分析再做出反应。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 22 },
  { id: 23, text: '', textLeft: '在社交场合中，我通常是那个主动打破沉默、开启话题的人。', textRight: '在社交场合中，我更喜欢等待别人先开口，然后自然地加入对话。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 23 },
  { id: 24, text: '', textLeft: '我通常被认为是一个外向、健谈的人。', textRight: '我认为自己是一个安静、内敛的人。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 24 },
  { id: 25, text: '', textLeft: '我倾向于主动发起对话，带动交流的节奏。', textRight: '比起主动发起对话，我更擅长倾听和回应。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 25 },

  // ═══════════════════════════════════════════════════════════
  // S_N 维度 - 双极量表 (25题, id 26-50)
  // 左侧=S实感倾向, 右侧=N直觉倾向
  // ═══════════════════════════════════════════════════════════
  { id: 26, text: '', textLeft: '我做事注重细节和具体步骤，相信"眼见为实"。', textRight: '我关注事物背后的整体图景和规律，相信直觉的指引。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 26 },
  { id: 27, text: '', textLeft: '比起抽象理论，我更信任亲身经验和实际案例。', textRight: '我对理论框架有天然的亲近感，喜欢用它们来理解世界。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 27 },
  { id: 28, text: '', textLeft: '我喜欢按照既定的流程和方法来完成任务。', textRight: '我喜欢探索和尝试各种新方法来完成任务。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 28 },
  { id: 29, text: '', textLeft: '我更关注当下正在发生的事，先把眼前的事情做好。', textRight: '我时常思考人生的意义和本质，喜欢追问事物存在和发展的根本原因。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 29 },
  { id: 30, text: '', textLeft: '我善于记住具体的事实、数据和细节信息。', textRight: '我善于把握事物的整体轮廓和发展方向。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 30 },
  { id: 31, text: '', textLeft: '比起关注事物之间的抽象联系，我更关注事物本身的具体属性。', textRight: '比起关注单个事物的具体细节，我更关注事物之间的内在联系和整体规律。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 31 },
  { id: 32, text: '', textLeft: '我需要清晰具体的指示，不喜欢模棱两可的表述。', textRight: '我喜欢开放性的引导，给我自由发挥和创造的空间。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 32 },
  { id: 33, text: '', textLeft: '我更愿意专注于做好手头的事，一次只做好一件事。', textRight: '我的脑海中常常同时涌现出许多不同的想法，它们相互碰撞产生新的灵感火花。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 33 },
  { id: 34, text: '', textLeft: '做决定时，我主要依据过去的经验和已知的事实。', textRight: '做决定时，我常常相信自己的直觉和对未来的预感。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 34 },
  { id: 35, text: '', textLeft: '我更相信那些有具体成果和实际产出的人。', textRight: '我欣赏那些有宏大愿景和创新想法的人，即使想法还未落地。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 35 },
  { id: 36, text: '', textLeft: '学习新技能时，我更喜欢通过实际操作来掌握。', textRight: '学习新技能时，我喜欢先理解背后的原理和框架再动手。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 36 },
  { id: 37, text: '', textLeft: '在选择餐厅时，我倾向于选择去过且体验良好的老店。', textRight: '在选择餐厅时，我总是想尝试没去过的新店，即使有踩雷的风险。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 37 },
  { id: 38, text: '', textLeft: '描述事物时，我倾向于使用具体、精确的语言。', textRight: '描述事物时，我倾向于使用比喻和意象来传达感受。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 38 },
  { id: 39, text: '', textLeft: '我认为可靠的经验比新颖的想法更有价值。', textRight: '我经常沉浸在对未来可能性的想象中，享受头脑风暴的过程。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 39 },
  { id: 40, text: '', textLeft: '我的记忆像是照片——能清晰地回忆起具体场景、细节和事实。', textRight: '我的记忆像是印象派画——更多记住整体感觉和核心意义，细节可能随时间模糊。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 40 },
  { id: 41, text: '', textLeft: '看一部电影时，我更关注剧情是否合理、细节是否真实可信。', textRight: '看一部电影时，我更关注它传达的主题思想、象征意义和情感共鸣。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 41 },
  { id: 42, text: '', textLeft: '我喜欢使用经过验证的可靠方法，避免不必要的风险。', textRight: '我喜欢尝试新的方法，即使旧方法已经行之有效。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 42 },
  { id: 43, text: '', textLeft: '我更看重实际可衡量的成果和执行效率。', textRight: '我善于在不同事物之间发现隐藏的联系和规律。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 43 },
  { id: 44, text: '', textLeft: '我的思维比较务实，倾向于思考可以直接应用的问题。', textRight: '我的大脑似乎有自己的想法，经常自动产生各种新点子和创意联想。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 44 },
  { id: 45, text: '', textLeft: '在旅行中，我更喜欢按照攻略逐一打卡经典景点，感受当地的具体风貌。', textRight: '在旅行中，我更喜欢随意漫步，感受城市的整体氛围和意外的惊喜。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 45 },
  { id: 46, text: '', textLeft: '我相信反复积累的经验比一闪而过的灵感更有价值。', textRight: '我相信灵感和直觉比重复的经验更有价值。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 46 },
  { id: 47, text: '', textLeft: '比起思考遥远的未来，我更关注如何改善现在的生活。', textRight: '比起解决眼前的问题，我更关注长远的愿景和趋势。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 47 },
  { id: 48, text: '', textLeft: '在阅读新闻时，我更关注事件的具体经过和事实数据。', textRight: '在阅读新闻时，我更关注事件背后的深层原因和未来可能的影响。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 48 },
  { id: 49, text: '', textLeft: '人们常说我做事踏实、注重实际操作和落地执行。', textRight: '人们常说我想象力丰富，总能提出原创性的想法。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 49 },
  { id: 50, text: '', textLeft: '假如我是一位老师，我会更愿意教授以事实和实操为主的课程。', textRight: '假如我是一位老师，我会更愿意教授以理论和概念思辨为主的课程。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 50 },

  // ═══════════════════════════════════════════════════════════
  // P_J 维度 - 双极量表 (25题, id 51-75)
  // 左侧=J判断倾向, 右侧=P感知倾向
  // ═══════════════════════════════════════════════════════════
  { id: 51, text: '', textLeft: '我凡事喜欢提前制定计划并按时完成，拖延会让我感到焦虑。', textRight: '我不喜欢过早锁定计划，事情往往在最后一刻自然会有最好的呈现方式。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 51 },
  { id: 52, text: '', textLeft: '我喜欢把事情安排得井井有条，不喜欢临时变动。', textRight: '我喜欢随时根据新情况调整安排，不被既定计划束缚。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 52 },
  { id: 53, text: '', textLeft: '任务完成后，我会感到极大的满足和轻松。', textRight: '任务的探索过程本身比完成它更让我感到充实。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 53 },
  { id: 54, text: '', textLeft: '清晰的时间表和计划让我感到安心和有掌控感。', textRight: '开放自由的时间安排让我感到轻松，可以随心所欲地支配时间。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 54 },
  { id: 55, text: '', textLeft: '我认为遵守规则和约定是重要的品质。', textRight: '我认为规则应该灵活变通，视具体情况而定。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 55 },
  { id: 56, text: '', textLeft: '做决定后我会感到轻松和解脱，悬而未决的状态让我感到不安。', textRight: '我喜欢让事情自然发展到一个合适的时机再做决定，不勉强自己。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 56 },
  { id: 57, text: '', textLeft: '我喜欢列清单，并享受逐一勾选已完成任务的成就感。', textRight: '我喜欢凭感觉行事，而不是被清单和计划所限制。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 57 },
  { id: 58, text: '', textLeft: '对于重要的决定，我希望尽早确定下来而不是一直观望。', textRight: '对于重要的决定，我愿意等待更多信息出现后再做判断。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 58 },
  { id: 59, text: '', textLeft: '我喜欢整理和归类，保持工作和生活环境的整洁有序。', textRight: '我的环境可能看起来有些凌乱，但我在其中感到自在和富有创造力。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 59 },
  { id: 60, text: '', textLeft: '我习惯一次性把事情做完，不喜欢留尾巴。', textRight: '我经常在事情做到一半时发现新的兴趣点，自然地转向下一个方向。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 60 },
  { id: 61, text: '', textLeft: '我很少迟到，并且期望他人也能守时。', textRight: '时间对我来说是弹性的，我更关注当下的体验而非严格遵守时刻表。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 61 },
  { id: 62, text: '', textLeft: '我更喜欢有明确结构和预期的工作环境。', textRight: '我更喜欢自由开放的工作环境，不被过多规则约束。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 62 },
  { id: 63, text: '', textLeft: '在开始一个大项目时，我会先把任务拆分成具体的步骤再动手。', textRight: '在开始一个大项目时，我会先跳进去做起来，在过程中理出头绪。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 63 },
  { id: 64, text: '', textLeft: '有了好的计划才能有好的执行结果。', textRight: '计划赶不上变化，所以我更倾向于随机应变。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 64 },
  { id: 65, text: '', textLeft: '专注于一件事并将其做到极致是我的工作风格。', textRight: '我喜欢同时推进多件事情，在它们之间自由切换。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 65 },
  { id: 66, text: '', textLeft: '果断做出决定是效率的关键，犹豫不决只会浪费时间。', textRight: '比起做完决定，我更喜欢持续探索各种可能性。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 66 },
  { id: 67, text: '', textLeft: '确定了方向后就应该坚定执行，避免频繁变动。', textRight: '我喜欢在工作过程中保持灵活，随时根据情况调整方向。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 67 },
  { id: 68, text: '', textLeft: '稳定的节奏和可预见的结果让我感到舒适和高效。', textRight: '有时候"走一步看一步"是最适合我的方式。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 68 },
  { id: 69, text: '', textLeft: '对于日常生活琐事（如购物、家务），我喜欢有固定的习惯和流程。', textRight: '对于日常生活琐事，我倾向于随心所欲，不喜欢被固定的习惯束缚。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 69 },
  { id: 70, text: '', textLeft: '出门旅行前，我会制定详细的行程表和备选方案。', textRight: '出门旅行前，我只会订好交通和住宿，剩下的到了再说。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 70 },
  { id: 71, text: '', textLeft: '收到一项新任务时，我首先关心的是截止日期和交付标准。', textRight: '收到一项新任务时，我首先关心的是任务本身是否有趣和值得探索。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 71 },
  { id: 72, text: '', textLeft: '我认为工作和生活应该有清晰的边界和固定的节奏。', textRight: '我喜欢工作和生活自然交融，不刻意区分边界，随性而为。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 72 },
  { id: 73, text: '', textLeft: '桌面或电脑文件的整理对我而言是必须定期做的事情。', textRight: '我的桌面或电脑文件可能看起来很乱，但我总能找到需要的东西。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 73 },
  { id: 74, text: '', textLeft: '当别人临时改变约定好的计划时，我会感到明显的困扰。', textRight: '当别人临时改变计划时，我觉得没什么，顺势调整就好。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 74 },
  { id: 75, text: '', textLeft: '我习惯在购物前列好清单并按清单购买，不喜欢临时起意。', textRight: '我习惯逛到哪买到哪，享受临时发现好东西的惊喜。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 75 },

  // ═══════════════════════════════════════════════════════════
  // T_F 维度 - 主观双极量表 (15题, id 76-90)
  // 左侧=T思考倾向, 右侧=F情感倾向
  // ═══════════════════════════════════════════════════════════
  { id: 76, text: '', textLeft: '做决定时，我优先考虑逻辑分析和客观利弊。', textRight: '做决定时，我优先考虑对人的影响和大家的感受。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 76 },
  { id: 77, text: '', textLeft: '我认为公平公正比照顾每个人的感受更加重要。', textRight: '我认为维护人际关系的和谐比遵循抽象的公平原则更为重要。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 77 },
  { id: 78, text: '', textLeft: '在重要决策中，我能够冷静地将个人感情放在一边。', textRight: '在重要决策中，我会充分考虑自己的情感反应，它们包含着重要的信息。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 78 },
  { id: 79, text: '', textLeft: '我倾向于用数据和事实来说服别人，而非诉诸情感。', textRight: '我倾向于用打动人心的故事和情感共鸣来与人沟通。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 79 },
  { id: 80, text: '', textLeft: '朋友向我倾诉烦恼时，我倾向于先分析问题并提供解决方案。', textRight: '朋友向我倾诉烦恼时，我倾向于先共情和接纳对方的情绪。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 80 },
  { id: 81, text: '', textLeft: '在争论中，我更在意谁的观点更正确、更站得住脚。', textRight: '在争论中，我更在意双方的感受是否受到了尊重。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 81 },
  { id: 82, text: '', textLeft: '面对批评时，我首先分析对方的批评内容是否客观合理。', textRight: '面对批评时，我首先感受到的是对方的语气和态度是否友善。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 82 },
  { id: 83, text: '', textLeft: '我更欣赏能力强、思路清晰但性格偏冷淡的同事。', textRight: '我更欣赏能力一般但温暖友善、乐于助人的同事。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 83 },
  { id: 84, text: '', textLeft: '我认为一个好的决定首先应该经得起逻辑推敲。', textRight: '我认为一个好的决定首先应该与自己的核心价值观一致。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 84 },
  { id: 85, text: '', textLeft: '在团队中，我更愿意指出问题所在，推动改进和优化。', textRight: '在团队中，我更愿意维护和谐的氛围，给每个人以鼓励和支持。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 85 },
  { id: 86, text: '', textLeft: '在购买一件昂贵的物品时，我更看重性能参数和性价比。', textRight: '在购买一件昂贵的物品时，我更看重它是否让我觉得"就是它了"的感觉。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 86 },
  { id: 87, text: '', textLeft: '在处理涉及情感的问题（如安慰朋友）时，我仍倾向于用理性的方式来分析情况。', textRight: '在处理涉及情感的问题时，我会完全切换到感受模式，先照顾情绪再谈解决。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 87 },
  { id: 88, text: '', textLeft: '在选择职业时，薪资、发展前景和客观条件是我最重要的考量。', textRight: '在选择职业时，是否热爱这份工作、是否符合我的价值观是最重要的考量。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 88 },
  { id: 89, text: '', textLeft: '我认为一个好的领导者应该首先确保团队高效达成目标。', textRight: '我认为一个好的领导者应该首先关心团队成员的成长和幸福感。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 89 },
  { id: 90, text: '', textLeft: '在安排一次家庭聚会时，我首先考虑的是流程、预算和时间效率。', textRight: '在安排一次家庭聚会时，我首先考虑的是大家是否开心、氛围是否温馨。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 90 },

  // ═══════════════════════════════════════════════════════════
  // T_F 维度 - 客观推理题 (10题, id 91-100)
  // 测试逻辑推理能力, 答对+2 答错-2 超时未答-2 未答无超时0
  // ═══════════════════════════════════════════════════════════

  // 演绎推理
  { id: 91, text: '"有些艺术家是诗人，所有诗人都富有想象力。"由此可以推出：',
    options: [{ key: 'A', label: '有些艺术家富有想象力' }, { key: 'B', label: '所有艺术家富有想象力' }, { key: 'C', label: '富有想象力的人都是诗人' }, { key: 'D', label: '艺术家都不是诗人' }], dimension: 'T_F', type: 'objective', correctAnswer: 'A', sortOrder: 91 },
  { id: 92, text: '"凡是金属都导电，石墨不是金属。"以下哪个结论正确？',
    options: [{ key: 'A', label: '石墨一定导电' }, { key: 'B', label: '石墨一定不导电' }, { key: 'C', label: '石墨可能导电也可能不导电' }, { key: 'D', label: '导电的都是金属' }], dimension: 'T_F', type: 'objective', correctAnswer: 'C', sortOrder: 92 },

  // 数字规律
  { id: 93, text: '数列：1, 4, 9, 16, 25, ? 问号处应该是：',
    options: [{ key: 'A', label: '30' }, { key: 'B', label: '34' }, { key: 'C', label: '36' }, { key: 'D', label: '49' }], dimension: 'T_F', type: 'objective', correctAnswer: 'C', sortOrder: 93 },
  { id: 94, text: '数列：2, 3, 5, 7, 11, ? 问号处应该是：',
    options: [{ key: 'A', label: '12' }, { key: 'B', label: '13' }, { key: 'C', label: '14' }, { key: 'D', label: '15' }], dimension: 'T_F', type: 'objective', correctAnswer: 'B', sortOrder: 94 },

  // 条件推理
  { id: 95, text: '如果今天下雨，运动会就取消。已知运动会没有取消，那么：',
    options: [{ key: 'A', label: '今天一定下雨了' }, { key: 'B', label: '今天一定没下雨' }, { key: 'C', label: '今天可能下雨了' }, { key: 'D', label: '无法判断' }], dimension: 'T_F', type: 'objective', correctAnswer: 'B', sortOrder: 95 },
  { id: 96, text: '"如果温度低于0°C，水会结冰。水没有结冰。"由此可推出：',
    options: [{ key: 'A', label: '温度一定低于0°C' }, { key: 'B', label: '温度一定不低于0°C' }, { key: 'C', label: '温度可能低于0°C' }, { key: 'D', label: '水永远不会结冰' }], dimension: 'T_F', type: 'objective', correctAnswer: 'B', sortOrder: 96 },

  // 排序推理
  { id: 97, text: 'A比B高，B比C高，C比D高。以下哪个陈述一定正确？',
    options: [{ key: 'A', label: 'D不是最矮的' }, { key: 'B', label: 'A是最高的' }, { key: 'C', label: 'B比D高' }, { key: 'D', label: 'C可能比A高' }], dimension: 'T_F', type: 'objective', correctAnswer: 'C', sortOrder: 97 },

  // 因果推理
  { id: 98, text: '一项研究发现：经常喝咖啡的人患心脏病的比例比不喝咖啡的人低30%。由此可以推断：',
    options: [{ key: 'A', label: '喝咖啡可以预防心脏病' }, { key: 'B', label: '喝咖啡与心脏病发病率存在相关性' }, { key: 'C', label: '不喝咖啡会导致心脏病' }, { key: 'D', label: '心脏病患者不应该喝咖啡' }], dimension: 'T_F', type: 'objective', correctAnswer: 'B', sortOrder: 98 },
  { id: 99, text: '某城市数据显示：冰淇淋销量越高的月份，溺水死亡人数也越高。以下哪个结论最合理？',
    options: [{ key: 'A', label: '吃冰淇淋会增加溺水风险' }, { key: 'B', label: '溺水的人更爱吃冰淇淋' }, { key: 'C', label: '两者可能都与夏季高温有关，不一定是因果关系' }, { key: 'D', label: '应该禁止在泳池边售卖冰淇淋' }], dimension: 'T_F', type: 'objective', correctAnswer: 'C', sortOrder: 99 },

  // 逻辑谬误识别
  { id: 100, text: '"很多成功人士都大学辍学了，所以辍学有助于成功。"这个论证忽视了：',
    options: [{ key: 'A', label: '成功人士的定义' }, { key: 'B', label: '更多辍学者没有成功的幸存者偏差' }, { key: 'C', label: '大学教育的费用' }, { key: 'D', label: '辍学的法律后果' }], dimension: 'T_F', type: 'objective', correctAnswer: 'B', sortOrder: 100 },
]

async function main() {
  console.log('Seeding MBTI-PRO database...')

  await prisma.testRecord.deleteMany()
  await prisma.question.deleteMany()
  await prisma.personalityType.deleteMany()

  // Insert questions
  for (const q of questions) {
    await prisma.question.create({
      data: { ...q, options: JSON.stringify(q.options) },
    })
  }
  console.log(`  ✓ ${questions.length} questions inserted`)
  console.log(`    E_I: ${questions.filter(q => q.dimension === 'E_I').length} (likert)`)
  console.log(`    S_N: ${questions.filter(q => q.dimension === 'S_N').length} (likert)`)
  console.log(`    P_J: ${questions.filter(q => q.dimension === 'P_J').length} (likert)`)
  console.log(`    T_F: ${questions.filter(q => q.dimension === 'T_F' && q.type === 'likert').length} (likert) + ${questions.filter(q => q.dimension === 'T_F' && q.type === 'objective').length} (objective)`)

  // Hand-crafted types (4 traditional types with premium content)
  const handCraftedCodes = new Set(handCraftedTypes.map(t => t.code))
  for (const t of handCraftedTypes) {
    await prisma.personalityType.create({
      data: {
        ...t,
        strengths: JSON.stringify(t.strengths),
        growthAreas: JSON.stringify(t.growthAreas),
        careers: JSON.stringify(t.careers),
        suitableFields: JSON.stringify(t.suitableFields),
        celebrities: JSON.stringify(t.celebrities),
      },
    })
  }
  console.log(`  ✓ ${handCraftedTypes.length} hand-crafted types`)

  // Auto-generate remaining 77 types
  const allCodes = generateAllTypeCodes()
  let autoCount = 0
  for (const code of allCodes) {
    if (handCraftedCodes.has(code)) continue
    const t = buildTypeContent(code)
    await prisma.personalityType.create({
      data: {
        ...t,
        strengths: JSON.stringify(t.strengths),
        growthAreas: JSON.stringify(t.growthAreas),
        careers: JSON.stringify(t.careers),
        suitableFields: JSON.stringify(t.suitableFields),
        celebrities: JSON.stringify(t.celebrities),
      },
    })
    autoCount++
  }
  console.log(`  ✓ ${autoCount} auto-generated types`)
  console.log(`  ✓ Total: ${handCraftedTypes.length + autoCount} / 81`)

  console.log('Seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
