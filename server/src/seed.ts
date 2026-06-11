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
  textLeft: string | null
  textRight: string | null
  dimension: string
  type: 'likert' | 'objective'
  options: { key: string; label: string }[]
  correctAnswer?: string | null
  sortOrder: number
}

const questions: SeedQuestion[] = [
  // ==================== E_I 维度 - 双极量表 (25题) ====================
  // 左侧=外向E倾向积极描述，右侧=内向I倾向积极描述
  { id: 1, text: '', textLeft: '参加大型聚会后，我感到精力充沛、心情愉悦。', textRight: '参加大型聚会后，我需要独处一段时间来恢复精力。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 1 },
  { id: 2, text: '', textLeft: '我喜欢成为众人关注的焦点。', textRight: '我更喜欢在幕后默默贡献，不习惯成为注意力的中心。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 2 },
  { id: 3, text: '', textLeft: '我习惯边说话边思考，在交流中形成自己的观点。', textRight: '我习惯先在心中理清思路，然后再清晰地表达出来。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 3 },
  { id: 4, text: '', textLeft: '独处太久会让我感到无聊和焦躁不安，渴望与人互动。', textRight: '独处对我来说是恢复精力的重要方式，我很享受独处时光。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 4 },
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
  { id: 18, text: '', textLeft: '在人群中让我感到兴奋和充满活力。', textRight: '在人群中待太久会让我感到被淹没和疲惫。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 18 },
  { id: 19, text: '', textLeft: '我享受认识不同的人，群体社交让我充满能量。', textRight: '我对深度的一对一对话比对群体社交更感兴趣。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 19 },
  { id: 20, text: '', textLeft: '我通过与他人交流来整理和厘清自己的想法。', textRight: '我的内心世界很丰富，常常进行自我对话和反思。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 20 },
  { id: 21, text: '', textLeft: '我经常主动组织聚会或活动，享受把大家聚在一起的乐趣。', textRight: '我更倾向于回应朋友的邀请，而非自己主动发起社交活动。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 21 },
  { id: 22, text: '', textLeft: '我喜欢迅速行动，在实践中不断调整和迭代。', textRight: '比起立刻行动，我习惯先观察分析再做出反应。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 22 },
  { id: 23, text: '', textLeft: '和别人在一起时我感到更有活力，独自一人则容易萎靡。', textRight: '独处的时光对我而言是充电，而不是孤独。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 23 },
  { id: 24, text: '', textLeft: '我通常被认为是一个外向、健谈的人。', textRight: '我认为自己是一个安静、内敛的人。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 24 },
  { id: 25, text: '', textLeft: '我倾向于主动发起对话，带动交流的节奏。', textRight: '比起主动发起对话，我更擅长倾听和回应。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 25 },

  // ==================== S_N 维度 - 双极量表 (25题) ====================
  // 左侧=S实感倾向积极描述，右侧=N直觉倾向积极描述
  { id: 26, text: '', textLeft: '我做事注重细节和具体步骤，相信"眼见为实"。', textRight: '我关注事物背后的整体图景和规律，相信直觉的指引。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 26 },
  { id: 27, text: '', textLeft: '比起抽象理论，我更信任亲身经验和实际案例。', textRight: '我对理论框架有天然的亲近感，喜欢用它们来理解世界。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 27 },
  { id: 28, text: '', textLeft: '我喜欢按照既定的流程和方法来完成任务。', textRight: '我喜欢探索和尝试各种新方法来完成任务。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 28 },
  { id: 29, text: '', textLeft: '我更关注当下正在发生的事，先把眼前的事情做好。', textRight: '我时常思考人生的意义和本质，喜欢追问事物存在和发展的根本原因。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 29 },
  { id: 30, text: '', textLeft: '我善于记住具体的事实、数据和细节信息。', textRight: '我善于把握事物的整体轮廓和发展方向。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 30 },
  { id: 31, text: '', textLeft: '在遇到新问题时，我首先会参考过往的类似经验与做法。', textRight: '在遇到新问题时，我首先会从理论出发思考全新的解决思路。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 31 },
  { id: 32, text: '', textLeft: '我需要清晰具体的指示，不喜欢模棱两可的表述。', textRight: '我喜欢开放性的引导，给我自由发挥和创造的空间。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 32 },
  { id: 33, text: '', textLeft: '我更愿意专注于做好手头的事，一次只做好一件事。', textRight: '我的脑海中常常同时涌现出许多不同的想法，它们相互碰撞产生新的灵感火花。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 33 },
  { id: 34, text: '', textLeft: '做决定时，我主要依据过去的经验和已知的事实。', textRight: '做决定时，我常常相信自己的直觉和对未来的预感。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 34 },
  { id: 35, text: '', textLeft: '我更相信那些有具体成果和实际产出的人。', textRight: '我欣赏那些有宏大愿景和创新想法的人，即使想法还未落地。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 35 },
  { id: 36, text: '', textLeft: '学习新技能时，我更喜欢通过实际操作来掌握。', textRight: '学习新技能时，我喜欢先理解背后的原理和框架再动手。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 36 },
  { id: 37, text: '', textLeft: '我关注日常生活中的具体细节，并能从中获得踏实的满足感。', textRight: '比起日常细节，我更关注事物背后的深层含义和规律。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 37 },
  { id: 38, text: '', textLeft: '描述事物时，我倾向于使用具体、精确的语言。', textRight: '描述事物时，我倾向于使用比喻和意象来传达感受。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 38 },
  { id: 39, text: '', textLeft: '我认为可靠的经验比新颖的想法更有价值。', textRight: '我经常沉浸在对未来可能性的想象中，享受头脑风暴的过程。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 39 },
  { id: 40, text: '', textLeft: '比起思考抽象概念，我更享受接触和操作具体的事物，动手实践让我理解更深。', textRight: '我对抽象的理论和概念充满热情，即使它们不能直接应用于现实生活。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 40 },
  { id: 41, text: '', textLeft: '做重要决定时，我主要依靠详实的分析和客观的数据。', textRight: '做重要决定时，我常常有一种说不清但内心确信的直觉指引。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 41 },
  { id: 42, text: '', textLeft: '我喜欢使用经过验证的可靠方法，避免不必要的风险。', textRight: '我喜欢尝试新的方法，即使旧方法已经行之有效。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 42 },
  { id: 43, text: '', textLeft: '我更看重实际可衡量的成果和执行效率。', textRight: '我善于在不同事物之间发现隐藏的联系和规律。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 43 },
  { id: 44, text: '', textLeft: '我的思维比较务实，倾向于思考可以直接应用的问题。', textRight: '我的大脑似乎有自己的想法，经常自动产生各种新点子和创意联想。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 44 },
  { id: 45, text: '', textLeft: '我更看重现实世界中已经被验证过的知识和技能。', textRight: '我对隐喻、象征和抽象概念有天然的亲近感。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 45 },
  { id: 46, text: '', textLeft: '我相信反复积累的经验比一闪而过的灵感更有价值。', textRight: '我相信灵感和直觉比重复的经验更有价值。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 46 },
  { id: 47, text: '', textLeft: '比起思考遥远的未来，我更关注如何改善现在的生活。', textRight: '比起解决眼前的问题，我更关注长远的愿景和趋势。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 47 },
  { id: 48, text: '', textLeft: '我更喜欢思考与日常生活直接相关的实用问题。', textRight: '我享受思考理论问题，即使它们离日常生活很远。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 48 },
  { id: 49, text: '', textLeft: '人们常说我做事踏实、注重实际操作和落地执行。', textRight: '人们常说我想象力丰富，总能提出原创性的想法。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 49 },
  { id: 50, text: '', textLeft: '我喜欢有一个清晰的执行方案，按部就班地推进工作。', textRight: '比起按部就班地执行计划，我更喜欢探索各种可能性。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 50 },

  // ==================== T_F 维度 - 双极量表 (5题) ====================
  // 左侧=T思考倾向积极描述，右侧=F情感倾向积极描述
  { id: 51, text: '', textLeft: '做决定时，我优先考虑逻辑分析和客观利弊。', textRight: '做决定时，我优先考虑对人的影响和大家的感受。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 51 },
  { id: 52, text: '', textLeft: '我认为公平公正比照顾每个人的感受更加重要。', textRight: '我认为维护人际关系的和谐比遵循抽象的公平原则更为重要。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 52 },
  { id: 53, text: '', textLeft: '在重要决策中，我能够冷静地将个人感情放在一边。', textRight: '在重要决策中，我会充分考虑自己的情感反应，它们包含着重要的信息。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 53 },
  { id: 54, text: '', textLeft: '我倾向于用数据和事实来说服别人，而非诉诸情感。', textRight: '我倾向于用打动人心的故事和情感共鸣来与人沟通。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 54 },
  { id: 55, text: '', textLeft: '团队决策时，我优先考虑效率最高、逻辑最优的方案。', textRight: '团队决策时，我优先照顾大家的感受和关系和谐。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 55 },

  // ==================== P_J 维度 - 双极量表 (25题) ====================
  // 左侧=J判断倾向积极描述，右侧=P感知倾向积极描述
  { id: 56, text: '', textLeft: '我凡事喜欢提前制定计划并按时完成，拖延会让我感到焦虑。', textRight: '我不喜欢过早锁定计划，事情往往在最后一刻自然会有最好的呈现方式。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 56 },
  { id: 57, text: '', textLeft: '我喜欢把事情安排得井井有条，不喜欢临时变动。', textRight: '我喜欢随时根据新情况调整安排，不被既定计划束缚。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 57 },
  { id: 58, text: '', textLeft: '任务完成后，我会感到极大的满足和轻松。', textRight: '任务的探索过程本身比完成它更让我感到充实。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 58 },
  { id: 59, text: '', textLeft: '我倾向于在截止日期之前就完成工作，不拖到最后一刻。', textRight: '适度的截止日期压力能激发我的创造力和最佳表现。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 59 },
  { id: 60, text: '', textLeft: '清晰的时间表和计划让我感到安心和有掌控感。', textRight: '开放自由的时间安排让我感到轻松，可以随心所欲地支配时间。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 60 },
  { id: 61, text: '', textLeft: '我认为遵守规则和约定是重要的品质。', textRight: '我认为规则应该灵活变通，视具体情况而定。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 61 },
  { id: 62, text: '', textLeft: '做决定后我会感到轻松和解脱，悬而未决的状态让我感到不安。', textRight: '我喜欢让事情自然发展到一个合适的时机再做决定，不勉强自己。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 62 },
  { id: 63, text: '', textLeft: '我喜欢列清单，并享受逐一勾选已完成任务的成就感。', textRight: '我喜欢凭感觉行事，而不是被清单和计划所限制。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 63 },
  { id: 64, text: '', textLeft: '对于重要的决定，我希望尽早确定下来而不是一直观望。', textRight: '对于重要的决定，我愿意等待更多信息出现后再做判断。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 64 },
  { id: 65, text: '', textLeft: '我喜欢整理和归类，保持工作和生活环境的整洁有序。', textRight: '我的环境可能看起来有些凌乱，但我在其中感到自在和富有创造力。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 65 },
  { id: 66, text: '', textLeft: '我习惯一次性把事情做完，不喜欢留尾巴。', textRight: '我经常在事情做到一半时发现新的兴趣点，自然地转向下一个方向。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 66 },
  { id: 67, text: '', textLeft: '我很少迟到，并且期望他人也能守时。', textRight: '时间对我来说是弹性的，我更关注当下的体验而非严格遵守时刻表。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 67 },
  { id: 68, text: '', textLeft: '我更喜欢有明确结构和预期的工作环境。', textRight: '我更喜欢自由开放的工作环境，不被过多规则约束。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 68 },
  { id: 69, text: '', textLeft: '我更喜欢按计划有条不紊地推进工作，不喜欢临时改变方向。', textRight: '比起按部就班，我更享受随性发挥和临场应变。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 69 },
  { id: 70, text: '', textLeft: '我希望尽快做出决定以便开始行动。', textRight: '我喜欢保持选择的开放性，不愿过早做出最终决定。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 70 },
  { id: 71, text: '', textLeft: '提前规划和充分准备让我在大多数情况下表现更好。', textRight: '截止日期的压力反而能激发我的最佳表现。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 71 },
  { id: 72, text: '', textLeft: '有了好的计划才能有好的执行结果。', textRight: '计划赶不上变化，所以我更倾向于随机应变。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 72 },
  { id: 73, text: '', textLeft: '我认为规则和流程是提高效率和保障质量的基础。', textRight: '过多的规则和条条框框会让我感到压抑和束缚。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 73 },
  { id: 74, text: '', textLeft: '专注于一件事并将其做到极致是我的工作风格。', textRight: '我喜欢同时推进多件事情，在它们之间自由切换。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 74 },
  { id: 75, text: '', textLeft: '有序的日程安排让我高效并感到充实。', textRight: '我的生活方式比较自由随性，不喜欢被日程表约束。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 75 },
  { id: 76, text: '', textLeft: '果断做出决定是效率的关键，犹豫不决只会浪费时间。', textRight: '比起做完决定，我更喜欢持续探索各种可能性。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 76 },
  { id: 77, text: '', textLeft: '确定了方向后就应该坚定执行，避免频繁变动。', textRight: '我喜欢在工作过程中保持灵活，随时根据情况调整方向。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 77 },
  { id: 78, text: '', textLeft: '有充分准备的计划比即兴发挥更可靠、效果更好。', textRight: '我享受即兴发挥带来的惊喜和乐趣。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 78 },
  { id: 79, text: '', textLeft: '我做决定时依赖理性的分析和预先确定的准则。', textRight: '我倾向于根据当下的感受和情况来做决定。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 79 },
  { id: 80, text: '', textLeft: '稳定的节奏和可预见的结果让我感到舒适和高效。', textRight: '有时候"走一步看一步"是最适合我的方式。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 80 },

  // ==================== T_F 维度 - 客观推理题库 (100题) ====================
  // 每次测试随机选取20题
  ...[
    // === 演绎推理 / 三段论 (10题) ===
    { id: 81, text: '以下哪个推理是正确的？\n如果所有A是B，所有B是C，那么：',
      opts: [{ key: 'A', label: '所有C是A' }, { key: 'B', label: '有些A不是C' }, { key: 'C', label: '所有A是C' }, { key: 'D', label: '有些C不是A' }], ans: 'C' },
    { id: 82, text: '"有些艺术家是诗人，所有诗人都富有想象力。"由此可以推出：',
      opts: [{ key: 'A', label: '有些艺术家富有想象力' }, { key: 'B', label: '所有艺术家富有想象力' }, { key: 'C', label: '富有想象力的人都是诗人' }, { key: 'D', label: '艺术家都不是诗人' }], ans: 'A' },
    { id: 83, text: '如果所有的哺乳动物都是恒温动物，而鲸鱼是哺乳动物，那么以下哪个结论一定正确？',
      opts: [{ key: 'A', label: '鲸鱼不是恒温动物' }, { key: 'B', label: '鲸鱼是恒温动物' }, { key: 'C', label: '鲸鱼可能不是恒温动物' }, { key: 'D', label: '所有恒温动物都是哺乳动物' }], ans: 'B' },
    { id: 84, text: '"所有三角形内角和为180°，这个图形是三角形。"由此可推出：',
      opts: [{ key: 'A', label: '这个图形内角和是180°' }, { key: 'B', label: '内角和180°的图形都是三角形' }, { key: 'C', label: '这个图形可能内角和不是180°' }, { key: 'D', label: '以上都不对' }], ans: 'A' },
    { id: 85, text: '"没有鸟类是哺乳动物，所有麻雀都是鸟类。"以下哪个结论正确？',
      opts: [{ key: 'A', label: '有些麻雀是哺乳动物' }, { key: 'B', label: '没有麻雀是哺乳动物' }, { key: 'C', label: '所有哺乳动物都是麻雀' }, { key: 'D', label: '无法确定麻雀是否是哺乳动物' }], ans: 'B' },
    { id: 86, text: '"所有的花都需要阳光，玫瑰是花。"由此可以推出：',
      opts: [{ key: 'A', label: '玫瑰需要阳光' }, { key: 'B', label: '需要阳光的都是花' }, { key: 'C', label: '玫瑰不需要阳光' }, { key: 'D', label: '花和阳光没有关系' }], ans: 'A' },
    { id: 87, text: '"有些大学生是志愿者，所有志愿者都乐于助人。"以下哪个正确？',
      opts: [{ key: 'A', label: '所有大学生都乐于助人' }, { key: 'B', label: '有些大学生乐于助人' }, { key: 'C', label: '乐于助人的都是志愿者' }, { key: 'D', label: '大学生都不是志愿者' }], ans: 'B' },
    { id: 88, text: '"凡是金属都导电，石墨不是金属。"以下哪个结论正确？',
      opts: [{ key: 'A', label: '石墨一定导电' }, { key: 'B', label: '石墨一定不导电' }, { key: 'C', label: '石墨可能导电也可能不导电' }, { key: 'D', label: '导电的都是金属' }], ans: 'C' },
    { id: 89, text: '"如果一个人是医生，那么他学过医学。小王学过医学。"以下哪个结论正确？',
      opts: [{ key: 'A', label: '小王一定是医生' }, { key: 'B', label: '小王一定不是医生' }, { key: 'C', label: '小王可能是医生' }, { key: 'D', label: '医生不需要学医学' }], ans: 'C' },
    { id: 90, text: '"所有正方形都是矩形，所有矩形都是平行四边形。"以下哪个正确？',
      opts: [{ key: 'A', label: '所有平行四边形都是正方形' }, { key: 'B', label: '所有正方形都是平行四边形' }, { key: 'C', label: '正方形和平行四边形没有关系' }, { key: 'D', label: '所有矩形都是正方形' }], ans: 'B' },

    // === 数字规律 (10题) ===
    { id: 91, text: '一个数列：2, 6, 12, 20, 30, ? 问号处应该是：',
      opts: [{ key: 'A', label: '36' }, { key: 'B', label: '40' }, { key: 'C', label: '42' }, { key: 'D', label: '48' }], ans: 'C' },
    { id: 92, text: '以下哪个数字序列符合"每个数字是前两个数字之和"的规律？（从第三项开始）',
      opts: [{ key: 'A', label: '1, 2, 3, 5, 8' }, { key: 'B', label: '1, 3, 4, 7, 12' }, { key: 'C', label: '2, 3, 5, 9, 14' }, { key: 'D', label: '1, 1, 3, 5, 9' }], ans: 'A' },
    { id: 93, text: '以下哪组数字的排列规律与其他三组不同？',
      opts: [{ key: 'A', label: '2, 4, 8, 16' }, { key: 'B', label: '3, 6, 12, 24' }, { key: 'C', label: '1, 3, 9, 27' }, { key: 'D', label: '5, 10, 20, 40' }], ans: 'C' },
    { id: 94, text: '数列：3, 7, 15, 31, 63, ? 问号处应该是：',
      opts: [{ key: 'A', label: '95' }, { key: 'B', label: '127' }, { key: 'C', label: '102' }, { key: 'D', label: '126' }], ans: 'B' },
    { id: 95, text: '数列：1, 4, 9, 16, 25, ? 问号处应该是：',
      opts: [{ key: 'A', label: '30' }, { key: 'B', label: '34' }, { key: 'C', label: '36' }, { key: 'D', label: '49' }], ans: 'C' },
    { id: 96, text: '数列：1, 1, 2, 3, 5, 8, ? 问号处应该是：',
      opts: [{ key: 'A', label: '10' }, { key: 'B', label: '11' }, { key: 'C', label: '13' }, { key: 'D', label: '12' }], ans: 'C' },
    { id: 97, text: '数列：2, 3, 5, 7, 11, ? 问号处应该是：',
      opts: [{ key: 'A', label: '12' }, { key: 'B', label: '13' }, { key: 'C', label: '14' }, { key: 'D', label: '15' }], ans: 'B' },
    { id: 98, text: '数列：100, 81, 64, 49, 36, ? 问号处应该是：',
      opts: [{ key: 'A', label: '30' }, { key: 'B', label: '25' }, { key: 'C', label: '20' }, { key: 'D', label: '16' }], ans: 'B' },
    { id: 99, text: '数列：3, 8, 13, 18, 23, ? 问号处应该是：',
      opts: [{ key: 'A', label: '25' }, { key: 'B', label: '26' }, { key: 'C', label: '28' }, { key: 'D', label: '27' }], ans: 'C' },
    { id: 100, text: '数列：0, 1, 3, 6, 10, ? 问号处应该是：',
      opts: [{ key: 'A', label: '13' }, { key: 'B', label: '14' }, { key: 'C', label: '15' }, { key: 'D', label: '16' }], ans: 'C' },

    // === 条件推理 / 假言判断 (10题) ===
    { id: 101, text: '"如果下雨，地面就会湿。现在地面是湿的。"以下哪个结论正确？',
      opts: [{ key: 'A', label: '一定下过雨' }, { key: 'B', label: '一定没下过雨' }, { key: 'C', label: '可能下过雨，也可能没下' }, { key: 'D', label: '以上都不对' }], ans: 'C' },
    { id: 102, text: '如果今天下雨，运动会就取消。已知运动会没有取消，那么：',
      opts: [{ key: 'A', label: '今天一定下雨了' }, { key: 'B', label: '今天一定没下雨' }, { key: 'C', label: '今天可能下雨了' }, { key: 'D', label: '无法判断' }], ans: 'B' },
    { id: 103, text: '"如果你努力学习，你就能通过考试。小王没有通过考试。"由此可推出：',
      opts: [{ key: 'A', label: '小王一定没有努力学习' }, { key: 'B', label: '小王一定努力学习了' }, { key: 'C', label: '小王可能努力学习了' }, { key: 'D', label: '通过考试不需要努力学习' }], ans: 'C' },
    { id: 104, text: '"只有在图书馆，我才能专注学习。我现在在图书馆。"由此可推出：',
      opts: [{ key: 'A', label: '我一定在专注学习' }, { key: 'B', label: '我一定不在专注学习' }, { key: 'C', label: '我可能在专注学习' }, { key: 'D', label: '我无法在图书馆专注' }], ans: 'C' },
    { id: 105, text: '"如果他是凶手，他一定在案发现场。他有不在场证明（当时不在现场）。"由此可推出：',
      opts: [{ key: 'A', label: '他一定是凶手' }, { key: 'B', label: '他一定不是凶手' }, { key: 'C', label: '他可能是凶手' }, { key: 'D', label: '无法判断' }], ans: 'B' },
    { id: 106, text: '"如果明天下雨，我就不去爬山。我明天去爬山了。"由此可推出：',
      opts: [{ key: 'A', label: '明天一定下雨了' }, { key: 'B', label: '明天一定没下雨' }, { key: 'C', label: '明天可能下雨了' }, { key: 'D', label: '无法判断' }], ans: 'B' },
    { id: 107, text: '"只要坚持锻炼，身体就会变好。老张身体变好了。"由此可推出：',
      opts: [{ key: 'A', label: '老张一定坚持锻炼了' }, { key: 'B', label: '老张一定没有坚持锻炼' }, { key: 'C', label: '老张可能坚持锻炼了' }, { key: 'D', label: '身体变好与锻炼无关' }], ans: 'C' },
    { id: 108, text: '"要么选A，要么选B。已知没有选A。"由此可推出：',
      opts: [{ key: 'A', label: '一定选了B' }, { key: 'B', label: '一定没选B' }, { key: 'C', label: '可能选了B' }, { key: 'D', label: '无法判断' }], ans: 'A' },
    { id: 109, text: '"如果你想成功，就要付出努力。小李付出了努力。"以下哪个正确？',
      opts: [{ key: 'A', label: '小李一定成功了' }, { key: 'B', label: '小李一定没有成功' }, { key: 'C', label: '小李可能成功也可能没成功' }, { key: 'D', label: '成功不需要付出努力' }], ans: 'C' },
    { id: 110, text: '"如果温度低于0°C，水会结冰。水没有结冰。"由此可推出：',
      opts: [{ key: 'A', label: '温度一定低于0°C' }, { key: 'B', label: '温度一定不低于0°C' }, { key: 'C', label: '温度可能低于0°C' }, { key: 'D', label: '水永远不会结冰' }], ans: 'B' },

    // === 排序推理 (10题) ===
    { id: 111, text: 'A比B高，B比C高，C比D高。以下哪个陈述一定正确？',
      opts: [{ key: 'A', label: 'D不是最矮的' }, { key: 'B', label: 'A是最高的' }, { key: 'C', label: 'B比D高' }, { key: 'D', label: 'C可能比A高' }], ans: 'C' },
    { id: 112, text: '甲、乙、丙三人参加赛跑。甲比乙快，丙不是最慢的。以下哪个陈述一定正确？',
      opts: [{ key: 'A', label: '甲跑得最快' }, { key: 'B', label: '乙跑得最慢' }, { key: 'C', label: '丙不是最快的' }, { key: 'D', label: '丙比乙快' }], ans: 'B' },
    { id: 113, text: '有四个人的身高不同。小张比小李高，小赵比小张矮，小王比小赵高。以下哪个正确？',
      opts: [{ key: 'A', label: '小李一定是最矮的' }, { key: 'B', label: '小张一定是最高的' }, { key: 'C', label: '小张比小赵高' }, { key: 'D', label: '无法比较小张和小王' }], ans: 'C' },
    { id: 114, text: 'A、B、C三人考试。A成绩比B好，C不是最差的。以下哪个一定正确？',
      opts: [{ key: 'A', label: 'A考得最好' }, { key: 'B', label: 'B考得最差' }, { key: 'C', label: 'C比B考得好' }, { key: 'D', label: 'A比C考得好' }], ans: 'B' },
    { id: 115, text: '五个人排队。甲在乙前面，丙在甲后面3个位置，丁在乙前面。以下哪个一定正确？',
      opts: [{ key: 'A', label: '甲排第一' }, { key: 'B', label: '丁在甲前面' }, { key: 'C', label: '丙不在最后' }, { key: 'D', label: '乙在丙后面' }], ans: 'B' },
    { id: 116, text: '小红、小蓝、小绿三人年龄不同。小红比小蓝大，小绿不是最小的。以下哪个一定正确？',
      opts: [{ key: 'A', label: '小红最大' }, { key: 'B', label: '小蓝最小' }, { key: 'C', label: '小绿不是最大的' }, { key: 'D', label: '小绿比小红大' }], ans: 'B' },
    { id: 117, text: 'X、Y、Z 三人的体重各不相同。X比Y重，Z不是最轻的。以下哪个一定正确？',
      opts: [{ key: 'A', label: 'X最重' }, { key: 'B', label: 'Y最轻' }, { key: 'C', label: 'Z比Y重' }, { key: 'D', label: 'Z比X重' }], ans: 'B' },
    { id: 118, text: '甲、乙、丙、丁四人的钱数不同。甲比乙多，丙比甲少，丁比丙多。以下哪个正确？',
      opts: [{ key: 'A', label: '乙一定最少' }, { key: 'B', label: '甲一定最多' }, { key: 'C', label: '甲比丙多' }, { key: 'D', label: '丁一定比甲多' }], ans: 'C' },
    { id: 119, text: 'P说："我比Q高。"Q说："R比我矮。"R说："P不是最高的。"已知只有一人说谎。谁是高最的？',
      opts: [{ key: 'A', label: 'P' }, { key: 'B', label: 'Q' }, { key: 'C', label: 'R' }, { key: 'D', label: '无法确定' }], ans: 'B' },
    { id: 120, text: '四支球队比赛排名。A队排名在B队之上，C队排名低于D队，B队排名高于D队。以下哪个正确？',
      opts: [{ key: 'A', label: 'A队第一' }, { key: 'B', label: 'C队垫底' }, { key: 'C', label: 'B队排名高于C队' }, { key: 'D', label: 'D队排名高于A队' }], ans: 'C' },

    // === 集合计算 / 容斥原理 (8题) ===
    { id: 121, text: '一个班有40人，其中25人喜欢数学，20人喜欢英语，15人两门都喜欢。有多少人两门都不喜欢？',
      opts: [{ key: 'A', label: '5人' }, { key: 'B', label: '10人' }, { key: 'C', label: '15人' }, { key: 'D', label: '无法确定' }], ans: 'B' },
    { id: 122, text: '全集共有50人，30人会游泳，25人会骑车，10人两项都不会。两项都会的有多少人？',
      opts: [{ key: 'A', label: '10人' }, { key: 'B', label: '12人' }, { key: 'C', label: '15人' }, { key: 'D', label: '20人' }], ans: 'C' },
    { id: 123, text: '某班30人，18人参加数学竞赛，15人参加物理竞赛，8人两科都参加。至少参加一科的有多少人？',
      opts: [{ key: 'A', label: '25人' }, { key: 'B', label: '22人' }, { key: 'C', label: '33人' }, { key: 'D', label: '30人' }], ans: 'A' },
    { id: 124, text: '100人接受调查：喜欢猫的45人，喜欢狗的60人，两者都不喜欢的15人。两者都喜欢的有多少人？',
      opts: [{ key: 'A', label: '15人' }, { key: 'B', label: '20人' }, { key: 'C', label: '25人' }, { key: 'D', label: '30人' }], ans: 'B' },
    { id: 125, text: '60人中，订阅A报的30人，订阅B报的25人，至少订阅一种的45人。两种都订阅的有多少人？',
      opts: [{ key: 'A', label: '5人' }, { key: 'B', label: '8人' }, { key: 'C', label: '10人' }, { key: 'D', label: '15人' }], ans: 'C' },
    { id: 126, text: '某班有学生48人，其中27人会打篮球，21人会踢足球，9人两项都会。只含一项的有多少人？',
      opts: [{ key: 'A', label: '27人' }, { key: 'B', label: '30人' }, { key: 'C', label: '36人' }, { key: 'D', label: '39人' }], ans: 'B' },
    { id: 127, text: '共80人，喜欢喝茶的50人，喜欢喝咖啡的40人，两种都喜欢的有15人。喜欢喝茶但不喜欢喝咖啡的有多少人？',
      opts: [{ key: 'A', label: '35人' }, { key: 'B', label: '25人' }, { key: 'C', label: '30人' }, { key: 'D', label: '20人' }], ans: 'A' },
    { id: 128, text: '有35人做了调查：喜欢A的20人，喜欢B的18人，至少喜欢一种的有28人。只喜欢B的有多少人？',
      opts: [{ key: 'A', label: '5人' }, { key: 'B', label: '8人' }, { key: 'C', label: '10人' }, { key: 'D', label: '12人' }], ans: 'B' },

    // === 因果推理 (8题) ===
    { id: 129, text: '一项研究发现：经常喝咖啡的人患心脏病的比例比不喝咖啡的人低30%。由此可以推断：',
      opts: [{ key: 'A', label: '喝咖啡可以预防心脏病' }, { key: 'B', label: '喝咖啡与心脏病发病率存在相关性' }, { key: 'C', label: '不喝咖啡会导致心脏病' }, { key: 'D', label: '心脏病患者不应该喝咖啡' }], ans: 'B' },
    { id: 130, text: '以下哪句话明确表达了因果关系？',
      opts: [{ key: 'A', label: '每次穿这件衣服都会下雨，所以衣服带来雨水' }, { key: 'B', label: '夏天来了，冰淇淋销量上升' }, { key: 'C', label: '经常锻炼的人通常身体更好' }, { key: 'D', label: '温度降到零度以下，所以水结冰了' }], ans: 'D' },
    { id: 131, text: '某城市发现：冰淇淋销量上升时，溺水事件也增多。以下哪个结论最合理？',
      opts: [{ key: 'A', label: '吃冰淇淋导致溺水' }, { key: 'B', label: '溺水导致人们吃冰淇淋' }, { key: 'C', label: '两者可能存在共同原因（夏季高温）' }, { key: 'D', label: '两者完全无关' }], ans: 'C' },
    { id: 132, text: '"每次我洗车之后就会下雨，所以我洗车会导致下雨。"这犯了什么逻辑错误？',
      opts: [{ key: 'A', label: '错误地将时间先后等同于因果关系' }, { key: 'B', label: '以偏概全' }, { key: 'C', label: '循环论证' }, { key: 'D', label: '偷换概念' }], ans: 'A' },
    { id: 133, text: '一项调查发现：养宠物的人幸福指数比不养宠物的人高。以下哪个结论最合理？',
      opts: [{ key: 'A', label: '养宠物一定会让人幸福' }, { key: 'B', label: '养宠物与幸福指数存在相关性' }, { key: 'C', label: '幸福的人才会养宠物' }, { key: 'D', label: '不养宠物的人都不幸福' }], ans: 'B' },
    { id: 134, text: '某药厂实验：A组服药后80%好转，B组不服药后30%好转。由此可以确定：',
      opts: [{ key: 'A', label: '该药一定有效' }, { key: 'B', label: '该药对该病可能有效，需要更多验证' }, { key: 'C', label: '该药一定无效' }, { key: 'D', label: '好转与服药完全无关' }], ans: 'B' },
    { id: 135, text: '研究发现：每天睡眠超过9小时的人比睡7-8小时的人死亡率更高。以下哪个推论最合理？',
      opts: [{ key: 'A', label: '多睡觉会导致死亡' }, { key: 'B', label: '可能有潜在健康问题导致人需要更多睡眠' }, { key: 'C', label: '所有人都应该睡7-8小时' }, { key: 'D', label: '睡眠时长与健康无关' }], ans: 'B' },
    { id: 136, text: '"自从市政府换了新路灯后，犯罪率下降了。所以新路灯减少了犯罪。"这个结论：',
      opts: [{ key: 'A', label: '结论一定正确' }, { key: 'B', label: '结论可能正确，但还有其他可能因素' }, { key: 'C', label: '结论一定错误' }, { key: 'D', label: '新路灯和犯罪率不可能有关系' }], ans: 'B' },

    // === 组合计数 (6题) ===
    { id: 137, text: '某餐厅菜单显示：每份套餐含主食+饮品。主食有米饭/面条2种，饮品有咖啡/茶/果汁3种。一共有多少种不同的套餐组合？',
      opts: [{ key: 'A', label: '5种' }, { key: 'B', label: '6种' }, { key: 'C', label: '8种' }, { key: 'D', label: '9种' }], ans: 'B' },
    { id: 138, text: '从A地到B地有3条路，从B地到C地有4条路。从A经B到C有多少条不同的路线？',
      opts: [{ key: 'A', label: '7条' }, { key: 'B', label: '12条' }, { key: 'C', label: '16条' }, { key: 'D', label: '10条' }], ans: 'B' },
    { id: 139, text: '有3件上衣和4条裤子，每次必须穿1件上衣+1条裤子。一共有多少种搭配方式？',
      opts: [{ key: 'A', label: '7种' }, { key: 'B', label: '10种' }, { key: 'C', label: '12种' }, { key: 'D', label: '16种' }], ans: 'C' },
    { id: 140, text: '一个密码锁需要设置一个3位数（每位可以是0-9）。有多少种可能的组合？',
      opts: [{ key: 'A', label: '30种' }, { key: 'B', label: '100种' }, { key: 'C', label: '1000种' }, { key: 'D', label: '3000种' }], ans: 'C' },
    { id: 141, text: '5个人站成一排拍照。有多少种不同的排列方式？',
      opts: [{ key: 'A', label: '25种' }, { key: 'B', label: '100种' }, { key: 'C', label: '120种' }, { key: 'D', label: '150种' }], ans: 'C' },
    { id: 142, text: '从6名候选人中选出2人担任正副班长（正副有区别）。有多少种选法？',
      opts: [{ key: 'A', label: '12种' }, { key: 'B', label: '15种' }, { key: 'C', label: '30种' }, { key: 'D', label: '36种' }], ans: 'C' },

    // === 基础概率 (6题) ===
    { id: 143, text: '一个口袋里装有3个红球和2个蓝球，从中随机摸出一个球。摸到红球的概率是多少？',
      opts: [{ key: 'A', label: '1/3' }, { key: 'B', label: '2/5' }, { key: 'C', label: '3/5' }, { key: 'D', label: '1/2' }], ans: 'C' },
    { id: 144, text: '投掷一枚均匀的硬币两次，两次都正面朝上的概率是多少？',
      opts: [{ key: 'A', label: '1/2' }, { key: 'B', label: '1/3' }, { key: 'C', label: '1/4' }, { key: 'D', label: '1/8' }], ans: 'C' },
    { id: 145, text: '同时掷两个骰子，点数之和为7的概率是多少？',
      opts: [{ key: 'A', label: '1/6' }, { key: 'B', label: '1/12' }, { key: 'C', label: '1/18' }, { key: 'D', label: '1/36' }], ans: 'A' },
    { id: 146, text: '一个袋子里有5个球，编号1-5。随机取出两个球，编号之和为奇数的概率是多少？',
      opts: [{ key: 'A', label: '1/2' }, { key: 'B', label: '3/5' }, { key: 'C', label: '2/5' }, { key: 'D', label: '3/10' }], ans: 'B' },
    { id: 147, text: '天气预报说"明天下雨的概率是70%"，这意味着什么？',
      opts: [{ key: 'A', label: '明天70%的时间在下雨' }, { key: 'B', label: '在类似气象条件下，有70%的日子下了雨' }, { key: 'C', label: '明天一定会下雨' }, { key: 'D', label: '明天70%的地区会下雨' }], ans: 'B' },
    { id: 148, text: '从一副标准扑克牌（52张，不含大小王）中随机抽一张，抽到红心的概率是多少？',
      opts: [{ key: 'A', label: '1/2' }, { key: 'B', label: '1/4' }, { key: 'C', label: '1/13' }, { key: 'D', label: '1/52' }], ans: 'B' },

    // === 类比推理 (6题) ===
    { id: 149, text: '以下哪个选项与其他三个最不同？',
      opts: [{ key: 'A', label: '苹果' }, { key: 'B', label: '香蕉' }, { key: 'C', label: '橙子' }, { key: 'D', label: '胡萝卜' }], ans: 'D' },
    { id: 150, text: '"医生"之于"医院"，相当于"教师"之于：',
      opts: [{ key: 'A', label: '学生' }, { key: 'B', label: '课本' }, { key: 'C', label: '学校' }, { key: 'D', label: '教室' }], ans: 'C' },
    { id: 151, text: '以下哪组关系与其他三组不同？',
      opts: [{ key: 'A', label: '钢琴-乐器' }, { key: 'B', label: '苹果-水果' }, { key: 'C', label: '汽车-轮子' }, { key: 'D', label: '玫瑰-花卉' }], ans: 'C' },
    { id: 152, text: '"水"之于"渴"，相当于"食物"之于：',
      opts: [{ key: 'A', label: '吃' }, { key: 'B', label: '饿' }, { key: 'C', label: '美味' }, { key: 'D', label: '营养' }], ans: 'B' },
    { id: 153, text: '以下哪个选项与其他三个不属于同一类别？',
      opts: [{ key: 'A', label: '狗' }, { key: 'B', label: '猫' }, { key: 'C', label: '鸟' }, { key: 'D', label: '鱼' }], ans: 'D' },
    { id: 154, text: '"笔"之于"写字"，相当于"相机"之于：',
      opts: [{ key: 'A', label: '照片' }, { key: 'B', label: '拍照' }, { key: 'C', label: '镜头' }, { key: 'D', label: '风景' }], ans: 'B' },

    // === 逻辑谜题 (8题) ===
    { id: 155, text: '有8个外观完全一样的小球，其中1个稍重。用一架天平，至少称几次就一定能找出那个较重的小球？',
      opts: [{ key: 'A', label: '1次' }, { key: 'B', label: '2次' }, { key: 'C', label: '3次' }, { key: 'D', label: '4次' }], ans: 'B' },
    { id: 156, text: '如果昨天是明天的话就好了，那今天就是周五了。请问实际上今天是周几？',
      opts: [{ key: 'A', label: '周三' }, { key: 'B', label: '周四' }, { key: 'C', label: '周五' }, { key: 'D', label: '周日' }], ans: 'A' },
    { id: 157, text: '把一张纸对折一次，再对折一次，然后在角落剪一个小孔。展开后有几个孔？',
      opts: [{ key: 'A', label: '1个' }, { key: 'B', label: '2个' }, { key: 'C', label: '4个' }, { key: 'D', label: '8个' }], ans: 'C' },
    { id: 158, text: '小明今年12岁，爸爸的年龄是他的3倍。5年后，爸爸比小明大多少岁？',
      opts: [{ key: 'A', label: '24岁' }, { key: 'B', label: '29岁' }, { key: 'C', label: '36岁' }, { key: 'D', label: '30岁' }], ans: 'A' },
    { id: 159, text: '一个房间里有3盏灯，门外有3个开关，每个开关控制一盏灯。你只能进房间一次，如何确定哪个开关控制哪盏灯？以下哪种方法可行？',
      opts: [{ key: 'A', label: '先开开关1，5分钟后关掉并开开关2，然后进房间摸灯泡温度' }, { key: 'B', label: '反复开关所有开关，进房间看灯泡闪烁' }, { key: 'C', label: '在门外听声音判断' }, { key: 'D', label: '以上方法都不行' }], ans: 'A' },
    { id: 160, text: '有12个球，其中11个重量相同，1个重量不同（不知轻重）。用天平至少称几次一定能找出那个异常的球？',
      opts: [{ key: 'A', label: '2次' }, { key: 'B', label: '3次' }, { key: 'C', label: '4次' }, { key: 'D', label: '5次' }], ans: 'B' },
    { id: 161, text: '一瓶酒和瓶盖共重1100克，酒比瓶盖重1000克。酒重多少克？',
      opts: [{ key: 'A', label: '1000克' }, { key: 'B', label: '1050克' }, { key: 'C', label: '1025克' }, { key: 'D', label: '1000克' }], ans: 'B' },
    { id: 162, text: '一家人有两个孩子，已知至少有一个女孩。两个孩子都是女孩的概率是多少？',
      opts: [{ key: 'A', label: '1/2' }, { key: 'B', label: '1/3' }, { key: 'C', label: '1/4' }, { key: 'D', label: '2/3' }], ans: 'B' },

    // === 逻辑谬误识别 (6题) ===
    { id: 163, text: '以下论证中，哪一个犯了"循环论证"的逻辑谬误？',
      opts: [{ key: 'A', label: '这个药有效，因为临床试验证明它有效' }, { key: 'B', label: '他一定在说谎，因为他说的话不能信' }, { key: 'C', label: '大家都买这个品牌，所以它一定好' }, { key: 'D', label: '如果下雨我就不去，现在下雨了，所以我不去' }], ans: 'B' },
    { id: 164, text: '"如果让同性恋合法化，接下来就会有人要和动物结婚，社会就会崩溃。"这属于什么逻辑谬误？',
      opts: [{ key: 'A', label: '人身攻击' }, { key: 'B', label: '滑坡谬误' }, { key: 'C', label: '诉诸权威' }, { key: 'D', label: '非黑即白' }], ans: 'B' },
    { id: 165, text: '"这个观点一定是错的，因为提出它的人是个有犯罪前科的人。"这属于什么逻辑谬误？',
      opts: [{ key: 'A', label: '人身攻击（诉诸人身）' }, { key: 'B', label: '循环论证' }, { key: 'C', label: '稻草人谬误' }, { key: 'D', label: '诉诸情感' }], ans: 'A' },
    { id: 166, text: '"既然你不同意我的方案，那你就是想让这个项目失败。"这属于什么逻辑谬误？',
      opts: [{ key: 'A', label: '循环论证' }, { key: 'B', label: '诉诸权威' }, { key: 'C', label: '非黑即白（假二分法）' }, { key: 'D', label: '以偏概全' }], ans: 'C' },
    { id: 167, text: '"我们公司已经这样做十年了，所以不需要改变。"这属于什么逻辑谬误？',
      opts: [{ key: 'A', label: '诉诸传统' }, { key: 'B', label: '诉诸权威' }, { key: 'C', label: '循环论证' }, { key: 'D', label: '因果倒置' }], ans: 'A' },
    { id: 168, text: '"很多成功人士都大学辍学了，所以辍学有助于成功。"这个论证忽视了：',
      opts: [{ key: 'A', label: '成功人士的定义' }, { key: 'B', label: '更多辍学者没有成功的幸存者偏差' }, { key: 'C', label: '大学教育的费用' }, { key: 'D', label: '辍学的法律后果' }], ans: 'B' },

    // === 博弈与策略 (6题) ===
    { id: 169, text: '两个囚徒被分开审讯。如果两人都保持沉默，各判1年；如果两人都坦白，各判3年；如果一个坦白一个沉默，坦白的释放，沉默的判5年。对两人整体最有利的结果是什么？',
      opts: [{ key: 'A', label: '两人都坦白' }, { key: 'B', label: '两人都沉默' }, { key: 'C', label: '一人坦白一人沉默' }, { key: 'D', label: '无所谓，结果一样' }], ans: 'B' },
    { id: 170, text: '你和对手玩一个游戏：各自选择1或2，如果和的奇偶性与你预测的一致，你赢。你预测的是偶数，你选1，对手选2，和是3（奇数）。你赢了吗？',
      opts: [{ key: 'A', label: '赢了' }, { key: 'B', label: '输了' }, { key: 'C', label: '平局' }, { key: 'D', label: '无法判断' }], ans: 'B' },
    { id: 171, text: '在剪刀石头布中，如果对手总是出他上一把赢你的手势（即模仿你上把的手势），你最好的策略是什么？',
      opts: [{ key: 'A', label: '总是出一样的' }, { key: 'B', label: '每次都换不同的' }, { key: 'C', label: '观察并预判对手模式' }, { key: 'D', label: '随机出拳，但注意不形成规律' }], ans: 'D' },
    { id: 172, text: '桌子上有15根火柴，两人轮流取，每次可取1-3根。取走最后一根的人获胜。先手必胜的策略是第一次取几根？',
      opts: [{ key: 'A', label: '1根' }, { key: 'B', label: '2根' }, { key: 'C', label: '3根' }, { key: 'D', label: '先手无法保证必胜' }], ans: 'C' },
    { id: 173, text: '三个海盗分100枚金币，由最年长的海盗提出方案并投票（提方案者也可投票），如果方案获得半数或以上支持就实施，否则提方案者被处死，由下一个最年长的提方案。海盗的优先级：1.活命 2.尽量多拿金币 3.尽量多杀人。最年长的海盗应给自己分多少金币？',
      opts: [{ key: 'A', label: '100枚' }, { key: 'B', label: '99枚' }, { key: 'C', label: '98枚' }, { key: 'D', label: '97枚' }], ans: 'C' },
    { id: 174, text: '龟兔赛跑中，兔子睡觉的教训是：',
      opts: [{ key: 'A', label: '速度快一定赢' }, { key: 'B', label: '速度慢一定输' }, { key: 'C', label: '坚持和策略比天赋更重要' }, { key: 'D', label: '比赛是不公平的' }], ans: 'C' },

    // === 综合推理 (6题) ===
    { id: 175, text: '甲说："我昨天说的是假话。"以下哪个判断正确？',
      opts: [{ key: 'A', label: '甲今天说的是真话' }, { key: 'B', label: '甲今天说的是假话' }, { key: 'C', label: '无法判断甲今天说的是真是假' }, { key: 'D', label: '甲昨天说的和今天说的都是真话' }], ans: 'C' },
    { id: 176, text: '一个村有两种人：骑士永远说真话，无赖永远说假话。你遇到一个村民，他说："我是无赖。"这个村民是：',
      opts: [{ key: 'A', label: '一定是骑士' }, { key: 'B', label: '一定是无赖' }, { key: 'C', label: '可能是骑士也可能是无赖' }, { key: 'D', label: '既不是骑士也不是无赖' }], ans: 'C' },
    { id: 177, text: '某超市的监控拍到小偷戴着帽子和口罩。证人说小偷身高约170-175cm。警察找到三名符合条件的人：甲172cm、乙178cm、丙168cm。谁最可能是小偷？',
      opts: [{ key: 'A', label: '甲' }, { key: 'B', label: '乙' }, { key: 'C', label: '丙' }, { key: 'D', label: '仅凭这些信息无法确定' }], ans: 'D' },
    { id: 178, text: '"所有哲学系的学生都读过柏拉图。张明读过柏拉图。"由此可以推出：',
      opts: [{ key: 'A', label: '张明一定是哲学系学生' }, { key: 'B', label: '张明一定不是哲学系学生' }, { key: 'C', label: '张明可能是哲学系学生' }, { key: 'D', label: '读柏拉图的人都是哲学系学生' }], ans: 'C' },
    { id: 179, text: '两列火车同时从相距300公里的A、B两城相向而行。快车时速80公里，慢车时速60公里。两车相遇时距离A城多少公里？',
      opts: [{ key: 'A', label: '约120公里' }, { key: 'B', label: '约150公里' }, { key: 'C', label: '约171公里' }, { key: 'D', label: '约180公里' }], ans: 'C' },
    { id: 180, text: '以下哪个选项的思考方式与其他三个最不同？',
      opts: [{ key: 'A', label: '根据已有规则推导具体结论' }, { key: 'B', label: '从个例中归纳出一般规律' }, { key: 'C', label: '用已知公式计算未知数值' }, { key: 'D', label: '按照既定流程逐步推理' }], ans: 'B' },
  ].map(({ id, text, opts, ans }) => ({
    id, text, textLeft: null as string | null, textRight: null as string | null, dimension: 'T_F' as const, type: 'objective' as const, options: opts, correctAnswer: ans, sortOrder: id,
  })),
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
