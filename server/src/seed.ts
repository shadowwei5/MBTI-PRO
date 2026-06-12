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
  { id: 19, text: '', textLeft: '我享受认识不同的人，群体社交让我充满能量。', textRight: '我对深度的一对一对话比对群体社交更感兴趣。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 19 },
  { id: 20, text: '', textLeft: '我通过与他人交流来整理和厘清自己的想法。', textRight: '我的内心世界很丰富，常常进行自我对话和反思。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 20 },
  { id: 21, text: '', textLeft: '我经常主动组织聚会或活动，享受把大家聚在一起的乐趣。', textRight: '我更倾向于回应朋友的邀请，而非自己主动发起社交活动。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 21 },
  { id: 22, text: '', textLeft: '我喜欢迅速行动，在实践中不断调整和迭代。', textRight: '比起立刻行动，我习惯先观察分析再做出反应。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 22 },
  { id: 24, text: '', textLeft: '我通常被认为是一个外向、健谈的人。', textRight: '我认为自己是一个安静、内敛的人。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 24 },
  { id: 25, text: '', textLeft: '我倾向于主动发起对话，带动交流的节奏。', textRight: '比起主动发起对话，我更擅长倾听和回应。', dimension: 'E_I', type: 'likert', options: bipolarOptions, sortOrder: 25 },

  // ==================== S_N 维度 - 双极量表 (25题) ====================
  // 左侧=S实感倾向积极描述，右侧=N直觉倾向积极描述
  { id: 26, text: '', textLeft: '我做事注重细节和具体步骤，相信"眼见为实"。', textRight: '我关注事物背后的整体图景和规律，相信直觉的指引。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 26 },
  { id: 27, text: '', textLeft: '比起抽象理论，我更信任亲身经验和实际案例。', textRight: '我对理论框架有天然的亲近感，喜欢用它们来理解世界。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 27 },
  { id: 28, text: '', textLeft: '我喜欢按照既定的流程和方法来完成任务。', textRight: '我喜欢探索和尝试各种新方法来完成任务。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 28 },
  { id: 29, text: '', textLeft: '我更关注当下正在发生的事，先把眼前的事情做好。', textRight: '我时常思考人生的意义和本质，喜欢追问事物存在和发展的根本原因。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 29 },
  { id: 30, text: '', textLeft: '我善于记住具体的事实、数据和细节信息。', textRight: '我善于把握事物的整体轮廓和发展方向。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 30 },
  { id: 32, text: '', textLeft: '我需要清晰具体的指示，不喜欢模棱两可的表述。', textRight: '我喜欢开放性的引导，给我自由发挥和创造的空间。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 32 },
  { id: 33, text: '', textLeft: '我更愿意专注于做好手头的事，一次只做好一件事。', textRight: '我的脑海中常常同时涌现出许多不同的想法，它们相互碰撞产生新的灵感火花。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 33 },
  { id: 34, text: '', textLeft: '做决定时，我主要依据过去的经验和已知的事实。', textRight: '做决定时，我常常相信自己的直觉和对未来的预感。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 34 },
  { id: 35, text: '', textLeft: '我更相信那些有具体成果和实际产出的人。', textRight: '我欣赏那些有宏大愿景和创新想法的人，即使想法还未落地。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 35 },
  { id: 36, text: '', textLeft: '学习新技能时，我更喜欢通过实际操作来掌握。', textRight: '学习新技能时，我喜欢先理解背后的原理和框架再动手。', dimension: 'S_N', type: 'likert', options: bipolarOptions, sortOrder: 36 },
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

  // ==================== T_F 维度 - 双极量表 (共10题) ====================
  // 左侧=T思考倾向积极描述，右侧=F情感倾向积极描述
  { id: 51, text: '', textLeft: '做决定时，我优先考虑逻辑分析和客观利弊。', textRight: '做决定时，我优先考虑对人的影响和大家的感受。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 51 },
  { id: 52, text: '', textLeft: '我认为公平公正比照顾每个人的感受更加重要。', textRight: '我认为维护人际关系的和谐比遵循抽象的公平原则更为重要。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 52 },
  { id: 53, text: '', textLeft: '在重要决策中，我能够冷静地将个人感情放在一边。', textRight: '在重要决策中，我会充分考虑自己的情感反应，它们包含着重要的信息。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 53 },
  { id: 54, text: '', textLeft: '我倾向于用数据和事实来说服别人，而非诉诸情感。', textRight: '我倾向于用打动人心的故事和情感共鸣来与人沟通。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 54 },
  // ==================== P_J 维度 - 双极量表 (25题) ====================
  // 左侧=J判断倾向积极描述，右侧=P感知倾向积极描述
  { id: 56, text: '', textLeft: '我凡事喜欢提前制定计划并按时完成，拖延会让我感到焦虑。', textRight: '我不喜欢过早锁定计划，事情往往在最后一刻自然会有最好的呈现方式。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 61 },
  { id: 57, text: '', textLeft: '我喜欢把事情安排得井井有条，不喜欢临时变动。', textRight: '我喜欢随时根据新情况调整安排，不被既定计划束缚。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 62 },
  { id: 58, text: '', textLeft: '任务完成后，我会感到极大的满足和轻松。', textRight: '任务的探索过程本身比完成它更让我感到充实。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 63 },
  { id: 59, text: '', textLeft: '我倾向于在截止日期之前就完成工作，不拖到最后一刻。', textRight: '适度的截止日期压力能激发我的创造力和最佳表现。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 64 },
  { id: 60, text: '', textLeft: '清晰的时间表和计划让我感到安心和有掌控感。', textRight: '开放自由的时间安排让我感到轻松，可以随心所欲地支配时间。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 65 },
  { id: 61, text: '', textLeft: '我认为遵守规则和约定是重要的品质。', textRight: '我认为规则应该灵活变通，视具体情况而定。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 66 },
  { id: 62, text: '', textLeft: '做决定后我会感到轻松和解脱，悬而未决的状态让我感到不安。', textRight: '我喜欢让事情自然发展到一个合适的时机再做决定，不勉强自己。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 67 },
  { id: 63, text: '', textLeft: '我喜欢列清单，并享受逐一勾选已完成任务的成就感。', textRight: '我喜欢凭感觉行事，而不是被清单和计划所限制。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 68 },
  { id: 64, text: '', textLeft: '对于重要的决定，我希望尽早确定下来而不是一直观望。', textRight: '对于重要的决定，我愿意等待更多信息出现后再做判断。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 69 },
  { id: 65, text: '', textLeft: '我喜欢整理和归类，保持工作和生活环境的整洁有序。', textRight: '我的环境可能看起来有些凌乱，但我在其中感到自在和富有创造力。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 70 },
  { id: 66, text: '', textLeft: '我习惯一次性把事情做完，不喜欢留尾巴。', textRight: '我经常在事情做到一半时发现新的兴趣点，自然地转向下一个方向。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 71 },
  { id: 67, text: '', textLeft: '我很少迟到，并且期望他人也能守时。', textRight: '时间对我来说是弹性的，我更关注当下的体验而非严格遵守时刻表。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 72 },
  { id: 68, text: '', textLeft: '我更喜欢有明确结构和预期的工作环境。', textRight: '我更喜欢自由开放的工作环境，不被过多规则约束。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 73 },
  { id: 71, text: '', textLeft: '提前规划和充分准备让我在大多数情况下表现更好。', textRight: '截止日期的压力反而能激发我的最佳表现。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 76 },
  { id: 72, text: '', textLeft: '有了好的计划才能有好的执行结果。', textRight: '计划赶不上变化，所以我更倾向于随机应变。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 77 },
  { id: 73, text: '', textLeft: '我认为规则和流程是提高效率和保障质量的基础。', textRight: '过多的规则和条条框框会让我感到压抑和束缚。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 78 },
  { id: 74, text: '', textLeft: '专注于一件事并将其做到极致是我的工作风格。', textRight: '我喜欢同时推进多件事情，在它们之间自由切换。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 79 },
  { id: 75, text: '', textLeft: '有序的日程安排让我高效并感到充实。', textRight: '我的生活方式比较自由随性，不喜欢被日程表约束。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 80 },
  { id: 76, text: '', textLeft: '果断做出决定是效率的关键，犹豫不决只会浪费时间。', textRight: '比起做完决定，我更喜欢持续探索各种可能性。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 81 },
  { id: 77, text: '', textLeft: '确定了方向后就应该坚定执行，避免频繁变动。', textRight: '我喜欢在工作过程中保持灵活，随时根据情况调整方向。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 82 },
  { id: 78, text: '', textLeft: '有充分准备的计划比即兴发挥更可靠、效果更好。', textRight: '我享受即兴发挥带来的惊喜和乐趣。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 83 },
  { id: 79, text: '', textLeft: '我做决定时依赖理性的分析和预先确定的准则。', textRight: '我倾向于根据当下的感受和情况来做决定。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 84 },
  { id: 80, text: '', textLeft: '稳定的节奏和可预见的结果让我感到舒适和高效。', textRight: '有时候"走一步看一步"是最适合我的方式。', dimension: 'P_J', type: 'likert', options: bipolarOptions, sortOrder: 85 },

  { id: 82, text: '', textLeft: '朋友向我倾诉烦恼时，我倾向于先分析问题并提供解决方案。', textRight: '朋友向我倾诉烦恼时，我倾向于先共情和接纳对方的情绪。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 55 },
  { id: 84, text: '', textLeft: '在争论中，我更在意谁的观点更正确、更站得住脚。', textRight: '在争论中，我更在意双方的感受是否受到了尊重。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 56 },
  { id: 86, text: '', textLeft: '面对批评时，我首先分析对方的批评内容是否客观合理。', textRight: '面对批评时，我首先感受到的是对方的语气和态度是否友善。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 57 },
  { id: 87, text: '', textLeft: '我更欣赏能力强、思路清晰但性格偏冷淡的同事。', textRight: '我更欣赏能力一般但温暖友善、乐于助人的同事。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 58 },
  { id: 89, text: '', textLeft: '我认为一个好的决定首先应该经得起逻辑推敲。', textRight: '我认为一个好的决定首先应该与自己的核心价值观一致。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 59 },
  { id: 90, text: '', textLeft: '在团队中，我更愿意指出问题所在，推动改进和优化。', textRight: '在团队中，我更愿意维护和谐的氛围，给每个人以鼓励和支持。', dimension: 'T_F', type: 'likert', options: bipolarOptions, sortOrder: 60 },

  // ==================== T_F 维度 - 客观推理题库 (20题池) ====================
  // 每次测试随机选取10题
  ...[
    // === 演绎推理 (2题) ===
    { id: 91, text: '"有些艺术家是诗人，所有诗人都富有想象力。"由此可以推出：',
      opts: [{ key: 'A', label: '有些艺术家富有想象力' }, { key: 'B', label: '所有艺术家富有想象力' }, { key: 'C', label: '富有想象力的人都是诗人' }, { key: 'D', label: '艺术家都不是诗人' }], ans: 'A' },
    { id: 92, text: '"凡是金属都导电，石墨不是金属。"以下哪个结论正确？',
      opts: [{ key: 'A', label: '石墨一定导电' }, { key: 'B', label: '石墨一定不导电' }, { key: 'C', label: '石墨可能导电也可能不导电' }, { key: 'D', label: '导电的都是金属' }], ans: 'C' },

    // === 数字规律 (2题) ===
    { id: 93, text: '数列：1, 4, 9, 16, 25, ? 问号处应该是：',
      opts: [{ key: 'A', label: '30' }, { key: 'B', label: '34' }, { key: 'C', label: '36' }, { key: 'D', label: '49' }], ans: 'C' },
    { id: 94, text: '数列：2, 3, 5, 7, 11, ? 问号处应该是：',
      opts: [{ key: 'A', label: '12' }, { key: 'B', label: '13' }, { key: 'C', label: '14' }, { key: 'D', label: '15' }], ans: 'B' },

    // === 条件推理 (2题) ===
    { id: 95, text: '如果今天下雨，运动会就取消。已知运动会没有取消，那么：',
      opts: [{ key: 'A', label: '今天一定下雨了' }, { key: 'B', label: '今天一定没下雨' }, { key: 'C', label: '今天可能下雨了' }, { key: 'D', label: '无法判断' }], ans: 'B' },
    { id: 96, text: '"如果温度低于0°C，水会结冰。水没有结冰。"由此可推出：',
      opts: [{ key: 'A', label: '温度一定低于0°C' }, { key: 'B', label: '温度一定不低于0°C' }, { key: 'C', label: '温度可能低于0°C' }, { key: 'D', label: '水永远不会结冰' }], ans: 'B' },

    // === 排序推理 (2题) ===
    { id: 97, text: 'A比B高，B比C高，C比D高。以下哪个陈述一定正确？',
      opts: [{ key: 'A', label: 'D不是最矮的' }, { key: 'B', label: 'A是最高的' }, { key: 'C', label: 'B比D高' }, { key: 'D', label: 'C可能比A高' }], ans: 'C' },
    { id: 98, text: '四支球队比赛排名。A队排名在B队之上，C队排名低于D队，B队排名高于D队。以下哪个正确？',
      opts: [{ key: 'A', label: 'A队第一' }, { key: 'B', label: 'C队垫底' }, { key: 'C', label: 'B队排名高于C队' }, { key: 'D', label: 'D队排名高于A队' }], ans: 'C' },

    // === 因果推理 (2题) ===
    { id: 99, text: '一项研究发现：经常喝咖啡的人患心脏病的比例比不喝咖啡的人低30%。由此可以推断：',
      opts: [{ key: 'A', label: '喝咖啡可以预防心脏病' }, { key: 'B', label: '喝咖啡与心脏病发病率存在相关性' }, { key: 'C', label: '不喝咖啡会导致心脏病' }, { key: 'D', label: '心脏病患者不应该喝咖啡' }], ans: 'B' },
    { id: 100, text: '"每次我洗车之后就会下雨，所以我洗车会导致下雨。"这犯了什么逻辑错误？',
      opts: [{ key: 'A', label: '错误地将时间先后等同于因果关系' }, { key: 'B', label: '以偏概全' }, { key: 'C', label: '循环论证' }, { key: 'D', label: '偷换概念' }], ans: 'A' },

    // === 组合计数 (2题) ===
    { id: 101, text: '有3件上衣和4条裤子，每次必须穿1件上衣+1条裤子。一共有多少种搭配方式？',
      opts: [{ key: 'A', label: '7种' }, { key: 'B', label: '10种' }, { key: 'C', label: '12种' }, { key: 'D', label: '16种' }], ans: 'C' },
    { id: 102, text: '从6名候选人中选出2人担任正副班长（正副有区别）。有多少种选法？',
      opts: [{ key: 'A', label: '12种' }, { key: 'B', label: '15种' }, { key: 'C', label: '30种' }, { key: 'D', label: '36种' }], ans: 'C' },

    // === 基础概率 (2题) ===
    { id: 103, text: '投掷一枚均匀的硬币两次，两次都正面朝上的概率是多少？',
      opts: [{ key: 'A', label: '1/2' }, { key: 'B', label: '1/3' }, { key: 'C', label: '1/4' }, { key: 'D', label: '1/8' }], ans: 'C' },
    { id: 104, text: '一个袋子里有5个球，编号1-5。随机取出两个球，编号之和为奇数的概率是多少？',
      opts: [{ key: 'A', label: '1/2' }, { key: 'B', label: '3/5' }, { key: 'C', label: '2/5' }, { key: 'D', label: '3/10' }], ans: 'B' },

    // === 逻辑谬误识别 (2题) ===
    { id: 105, text: '某城市数据显示：冰淇淋销量越高的月份，溺水死亡人数也越高。以下哪个结论最合理？',
      opts: [{ key: 'A', label: '吃冰淇淋会增加溺水风险' }, { key: 'B', label: '溺水的人更爱吃冰淇淋' }, { key: 'C', label: '两者可能都与夏季高温有关，不一定是因果关系' }, { key: 'D', label: '应该禁止在泳池边售卖冰淇淋' }], ans: 'C' },
    { id: 106, text: '"很多成功人士都大学辍学了，所以辍学有助于成功。"这个论证忽视了：',
      opts: [{ key: 'A', label: '成功人士的定义' }, { key: 'B', label: '更多辍学者没有成功的幸存者偏差' }, { key: 'C', label: '大学教育的费用' }, { key: 'D', label: '辍学的法律后果' }], ans: 'B' },

    // === 逻辑谜题 (2题) ===
    { id: 107, text: '有8个外观完全一样的小球，其中1个稍重。用一架天平，至少称几次就一定能找出那个较重的小球？',
      opts: [{ key: 'A', label: '1次' }, { key: 'B', label: '2次' }, { key: 'C', label: '3次' }, { key: 'D', label: '4次' }], ans: 'B' },
    { id: 108, text: '一家人有两个孩子，已知至少有一个女孩。两个孩子都是女孩的概率是多少？',
      opts: [{ key: 'A', label: '1/2' }, { key: 'B', label: '1/3' }, { key: 'C', label: '1/4' }, { key: 'D', label: '2/3' }], ans: 'B' },

    // === 博弈与综合 (2题) ===
    { id: 109, text: '两个囚徒被分开审讯。如果两人都保持沉默，各判1年；如果两人都坦白，各判3年；如果一个坦白一个沉默，坦白的释放，沉默的判5年。对两人整体最有利的结果是什么？',
      opts: [{ key: 'A', label: '两人都坦白' }, { key: 'B', label: '两人都沉默' }, { key: 'C', label: '一人坦白一人沉默' }, { key: 'D', label: '无所谓，结果一样' }], ans: 'B' },
    { id: 110, text: '以下哪个选项的思考方式与其他三个最不同？',
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
