<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { CONTACT_CHANNEL_LINE } from '../config/site'

type Section = { no: string; title: string; body: string[] }
type Doc = { eyebrow: string; title: string; lead: string; sections: Section[] }

const UPDATED = '2026-11-12'

const DOCS: Record<string, Doc> = {
  privacy: {
    eyebrow: 'PRIVACY',
    title: '隐私政策',
    lead: 'MBTI-PRO 是一套用于自我探索的人格测评。本页说明我们会收集哪些数据、为什么收集、保存在哪里，以及你可以怎样行使自己的权利。',
    sections: [
      {
        no: '01', title: '我们收集什么',
        body: [
          '答题数据：40 道题的选择、四维得分、最终类型代码、答题用时、每题停留时间、中断位置。',
          '设备与来源：操作系统、浏览器类型、屏幕尺寸、语言设置，以及链接中的来源参数（UTM）。这些数据用于适配页面与统计流量来源。',
          '兑换与访问：兑换码的核销次数与时间、访问令牌（token）及其最近使用时间。',
          '我们不主动收集姓名、手机号、邮箱、身份证号、精确地理位置、通讯录或生物识别信息。当前首发版本已移除邮箱收集、分享解锁与打赏流程。'
        ]
      },
      {
        no: '02', title: '人格结果属于敏感个人信息',
        body: [
          '人格测评结果反映性格特征，属于敏感个人信息。我们仅在生成测评结果与报告所必需的范围内处理，不用于画像营销。',
          '开始测试前我们会展示简要提示；点击「开始测试」即表示你已阅读并同意本政策对答题数据的处理。不同意时可以退出，不影响浏览公开页面。',
          '我们不会把可识别到你的答题数据出售、出租或提供给任何第三方用于广告投放、招聘筛选或信贷评估。'
        ]
      },
      {
        no: '03', title: '使用目的',
        body: [
          '生成你的测评结果与完整报告；在聚合、去标识化后用于题库校准与完成率统计；核验兑换码、防止滥用与限流；排查站点故障。',
          '本站不提供心理诊断、心理治疗或医疗建议，结果也不构成招聘、升学、婚恋或其他重大决策的依据。'
        ]
      },
      {
        no: '04', title: '存储位置与保留期限',
        body: [
          '答题记录与兑换记录保存在我们自有服务器的 SQLite 数据库中；访问令牌与未完成的答题进度保存在你浏览器的 localStorage 中。',
          '兑换码记录保留至该批次过期后 180 天。测试记录目前用于统计校准，尚未设置自动删除期限；如需删除，可按第 06 节申请人工处理。',
          '清除浏览器缓存或站点数据，即可删除本机的访问令牌与答题进度；此操作不会自动删除服务器上的历史记录。'
        ]
      },
      {
        no: '05', title: '第三方服务',
        body: [
          '站点通过 CDN / HTTPS 服务对外提供访问，该服务会按自身规则处理请求日志与 IP 信息。',
          '网页字体可能由第三方字体服务加载，加载时该服务会收到你的 IP 与浏览器信息；我们正在推进字体本地化以减少对外请求。',
          '购买与售后在小红书平台内完成。我们不接收平台订单中的收货人姓名、手机号或收货地址。'
        ]
      },
      {
        no: '06', title: '你的权利',
        body: [
          '你可以申请查阅、更正或删除与你的兑换码相关联的记录。目前没有自助删除入口，请通过「联系我们」页列出的渠道提交申请。',
          '为核验身份，我们只会要求你提供订单号或兑换码，不会要求提供身份证、人脸信息或完整人格报告。我们将在 15 个工作日内响应。'
        ]
      },
      {
        no: '07', title: '未成年人',
        body: [
          '未满 14 周岁的未成年人应在监护人陪同下阅读本政策并取得监护人同意后再使用付费测评。',
          '我们不会刻意收集与测评无关的未成年人信息；如发现已收集，将按第 06 节删除。'
        ]
      },
      {
        no: '08', title: '政策更新',
        body: [
          '本政策更新后会直接在本页公示并标注生效日期；涉及敏感信息处理方式的重大变更，我们会在测试入口处另行提示。'
        ]
      }
    ]
  },
  terms: {
    eyebrow: 'TERMS',
    title: '用户协议',
    lead: '使用 MBTI-PRO 即表示你已阅读并同意本协议。若不同意，请停止使用本站服务。',
    sections: [
      {
        no: '01', title: '服务性质',
        body: [
          'MBTI-PRO 提供基于 81 型人格体系的自测与文字报告，用于自我探索与娱乐参考，不构成心理诊断、心理治疗、医疗建议或招聘依据。',
          '「81 型」是本项目自建的四维三级分类体系，与 MBTI 官方机构、其商标持有人及相关认证体系无关联，也不代表任何官方认证或学术背书。',
          '测评结果描述的是倾向而非定论，不应作为评价自己或他人的唯一标准。'
        ]
      },
      {
        no: '02', title: '购买与兑换',
        body: [
          '首发版本通过小红书官方店铺以 0.99 元购买数字内容：40 题测试与全部报告内容一次性解锁，不再收取邮箱、分享、打赏或二次付费。',
          '订单成交后由店铺自动发货，交付「一单一码」的兑换码与使用说明。访问 https://mbti-pro.com/?code=兑换码 可自动兑换；也可在首页点击「开始测试」手动输入。',
          '默认每个兑换码最多可在 3 台设备／浏览器兑换，有效期 180 天；次数用尽或过期请通过订单页申请补发，不需要重复付费。',
          '请妥善保管兑换码，不要公开转发或发布。因自行泄露导致的次数耗尽，我们可协助核实但不承诺无条件补发。'
        ]
      },
      {
        no: '03', title: '知识产权',
        body: [
          '本站的题库、81 型分类体系、报告文案、插画、视觉设计与程序代码归项目方所有。你可以为个人非商业目的保存、分享自己的测评结果。',
          '未经许可，不得批量抓取题库或报告内容、转售兑换码、镜像站点、反向工程接口，或将本站内容用于商业培训、 AI 训练数据集与付费咨询包装。'
        ]
      },
      {
        no: '04', title: '用户行为规范',
        body: [
          '不得利用脚本、多账号或自动化工具刷取兑换码、干扰计分、压测接口或绕过访问限制。',
          '不得在本站发布或传播违法信息，不得冒用本站名义向他人收款或发布不实宣传。'
        ]
      },
      {
        no: '05', title: '免责与责任限制',
        body: [
          '我们不对测评结果与实际情况的吻合程度作明示或默示保证，也不对因依赖测评结果作出的决定承担责任。',
          '因服务器故障、网络中断、平台规则变更导致短时无法访问时，我们会通过补发兑换码或延长有效期处理，不要求用户重复付费。',
          '在法律允许范围内，我们对间接损失、数据丢失（含清除浏览器缓存导致的进度丢失）不承担责任。'
        ]
      },
      {
        no: '06', title: '协议变更与争议解决',
        body: [
          '本协议更新后在本页公示生效日期；继续使用视为接受更新后的条款。',
          '本协议适用中华人民共和国法律。因本协议产生的争议，双方应先友好协商；协商不成的，提交服务提供方所在地有管辖权的人民法院处理。'
        ]
      },
      {
        no: '07', title: '联系我们',
        body: [
          '关于兑换、退款、数据权利与侵权投诉，请通过「联系我们」页列出的渠道提交。'
        ]
      }
    ]
  },
  refund: {
    eyebrow: 'REFUND',
    title: '退款说明',
    lead: '本页说明 0.99 元数字内容的退款规则。购买前请确认你已了解虚拟商品的交付方式。',
    sections: [
      {
        no: '01', title: '商品性质',
        body: [
          '本商品为虚拟数字内容：40 题测评与完整报告的访问权，通过兑换码即时交付，不涉及实物物流。',
          '按《消费者权益保护法》关于在线下载或消费者拆封的音像制品、计算机软件等数字化商品的规定，交付完成后原则上不适用七日无理由退货；我们在购买页与商品详情中对此作了提示。'
        ]
      },
      {
        no: '02', title: '可申请退款的情形',
        body: [
          '兑换码未使用且未过期，购买后未开始测评；同一订单重复支付；自动发货失败或发码错误；因本站服务器故障导致无法完成测评且我们无法在合理时间内恢复。',
          '以上情形请在订单页申请售后并提供订单号，客服核实后按小红书平台规则原路退款。'
        ]
      },
      {
        no: '03', title: '通常不予退款的情形',
        body: [
          '兑换码已成功兑换并已查看完整报告后，仅因「结果不喜欢」「觉得不准」提出的退款申请。此类主观感受不构成商品未交付。',
          '因自行公开、转发兑换码导致次数被他人用尽；因清除浏览器缓存导致答题进度丢失（重新输入同一兑换码即可继续，不视为商品故障）。',
          '如你认为属于第 02 节的特殊情形，仍可提交申请，我们会逐单核实，不会以「虚拟商品」为由一概拒绝。'
        ]
      },
      {
        no: '04', title: '申请路径',
        body: [
          '在小红书订单页点击「申请售后」，说明问题并附上订单号。请勿在公开笔记或评论区发布订单号、兑换码等敏感信息。',
          '我们不会要求你提供人格测评结果、身份证照片或站外联系方式来处理退款。'
        ]
      },
      {
        no: '05', title: '处理时效',
        body: [
          '客服在 24 小时内响应；退款到账时间以小红书平台与支付渠道的实际处理为准。',
          '如因平台规则或支付渠道原因延迟，我们会告知进度并保留处理记录。'
        ]
      },
      {
        no: '06', title: '补发优先原则',
        body: [
          '遇到链接打不开、兑换码无效、次数异常等情况，我们优先免费补发新码并停用旧码，不要求用户重复付费。',
          '站点故障期间受影响的用户，可按受影响时长申请延长兑换码有效期。'
        ]
      }
    ]
  },
  contact: {
    eyebrow: 'CONTACT',
    title: '联系我们',
    lead: '如果你在兑换、测评或售后中遇到问题，请通过以下渠道联系我们。',
    sections: [
      {
        no: '01', title: '客服渠道',
        body: [
          '首选：小红书店铺订单页「申请售后」，或店铺客服消息。订单相关问题请务必带上订单号，便于核验。',
          CONTACT_CHANNEL_LINE,
          '我们不通过站外即时通讯工具提供客服，也不会主动私信你索要密码、验证码或付款。'
        ]
      },
      {
        no: '02', title: '响应时效',
        body: [
          '订单与兑换问题：24 小时内响应。数据与隐私权利申请：15 个工作日内响应。',
          '如遇站点故障或集中咨询，我们会在首页与本页公示处理进度。'
        ]
      },
      {
        no: '03', title: '我们不提供的服务',
        body: [
          '本站不提供心理咨询、心理诊断、精神科诊疗、危机干预，也不提供职业测评认证、简历建议或招聘推荐。',
          '如你正经历持续的情绪困扰，请前往正规医疗机构或拨打当地心理援助热线寻求帮助。',
          '本站也不收集验光数据、不提供配镜或任何眼镜相关服务。'
        ]
      },
      {
        no: '04', title: '服务边界与反馈',
        body: [
          '欢迎提交错别字、题目表述不清、移动端显示异常等反馈；这类反馈不属于订单售后，可直接在客服消息中说明。',
          '对于「结果不准确」的反馈，我们会记录并用于题库校准，但不会据此修改你已生成的报告。'
        ]
      }
    ]
  }
}

const route = useRoute()
const doc = computed(() => DOCS[String(route.meta.doc || 'privacy')] || DOCS.privacy)
const NAV = [
  { to: '/privacy', label: '隐私政策' },
  { to: '/terms', label: '用户协议' },
  { to: '/refund', label: '退款说明' },
  { to: '/contact', label: '联系我们' }
]
</script>

<template>
  <div class="legal">
    <header class="head">
      <RouterLink to="/" class="h-l">MBTI — PRO</RouterLink>
      <span>PERSONALITY ARCHIVE / LEGAL</span>
      <span class="h-r">81-TYPE</span>
    </header>

    <main>
      <p class="eyebrow">LEGAL / {{ doc.eyebrow }}</p>
      <h1>{{ doc.title }}</h1>
      <p class="updated">生效日期：{{ UPDATED }} · 版本 1.0</p>
      <p class="lead">{{ doc.lead }}</p>

      <section v-for="s in doc.sections" :key="s.no" class="sec">
        <div class="sec-no">{{ s.no }}</div>
        <div class="sec-body">
          <h2>{{ s.title }}</h2>
          <p v-for="(p, i) in s.body" :key="i">{{ p }}</p>
        </div>
      </section>

      <nav class="legal-nav">
        <RouterLink v-for="n in NAV" :key="n.to" :to="n.to">{{ n.label }}</RouterLink>
      </nav>
      <RouterLink to="/" class="back">← 返回首页</RouterLink>
    </main>

    <footer>
      <span>MBTI-PRO / 81-TYPE PERSONALITY ARCHIVE</span>
      <span>结果仅供自我探索，不用于临床诊断或招聘决策</span>
    </footer>
  </div>
</template>

<style scoped>
.legal {
  --paper: #F2EDE3;
  --ink: #1E1D1A;
  --accent: #A63D2C;
  --muted: #6F685D;
  --rule: #D2C8B8;
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.head {
  display: flex; justify-content: space-between; align-items: baseline;
  max-width: 1080px; margin: 0 auto; padding: 44px 40px 18px;
  border-bottom: 1px solid var(--rule);
  font-family: 'DM Mono', 'SF Mono', Consolas, 'Roboto Mono', monospace;
  font-size: 12px; letter-spacing: .16em; color: var(--muted);
}
.head a { color: var(--ink); text-decoration: none; font-weight: 600; letter-spacing: .24em; }
.head .h-r { color: var(--accent); }
main { max-width: 1080px; margin: 0 auto; padding: 72px 40px 100px; }
.eyebrow {
  font-family: 'DM Mono', 'SF Mono', Consolas, 'Roboto Mono', monospace;
  font-size: 13px; letter-spacing: .2em; color: var(--accent);
}
h1 {
  font-family: 'Playfair Display', 'Songti SC', 'STSong', SimSun, 'Noto Serif CJK SC', 'Source Han Serif SC', serif;
  font-size: clamp(48px, 7vw, 76px); font-weight: 500;
  line-height: 1.2; margin: 28px 0 18px;
}
.updated { font-size: 14px; color: var(--muted); letter-spacing: .04em; }
.lead {
  font-size: 19px; line-height: 1.95; max-width: 780px;
  margin: 42px 0 0; color: #3A3833;
}
.sec {
  display: grid; grid-template-columns: 90px 1fr; gap: 32px;
  border-top: 1px solid var(--rule); margin-top: 56px; padding-top: 30px;
}
.sec-no {
  font-family: 'DM Mono', 'SF Mono', Consolas, 'Roboto Mono', monospace;
  font-size: 15px; letter-spacing: .12em; color: var(--accent); padding-top: 8px;
}
h2 {
  font-family: 'Playfair Display', 'Songti SC', 'STSong', SimSun, 'Noto Serif CJK SC', 'Source Han Serif SC', serif;
  font-size: 27px; font-weight: 500; margin: 0 0 22px;
}
.sec-body p { font-size: 16px; line-height: 2; color: #3A3833; margin: 0 0 14px; }
.legal-nav {
  display: flex; flex-wrap: wrap; gap: 12px 28px;
  border-top: 1px solid var(--rule); margin-top: 72px; padding-top: 26px;
}
.legal-nav a { font-size: 14px; color: var(--muted); text-decoration: none; letter-spacing: .04em; }
.legal-nav a:hover { color: var(--accent); }
.legal-nav a.router-link-active { color: var(--accent); }
.back {
  display: inline-block; margin-top: 46px; font-size: 15px;
  color: var(--ink); text-decoration: none; letter-spacing: .06em;
}
.back:hover { color: var(--accent); }
footer {
  display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;
  max-width: 1080px; margin: 0 auto; padding: 24px 40px 40px;
  border-top: 1px solid var(--rule);
  font-family: 'DM Mono', 'SF Mono', Consolas, 'Roboto Mono', monospace;
  font-size: 11px; letter-spacing: .04em; color: var(--muted);
}
@media (max-width: 640px) {
  .head { padding: 28px 22px 16px; font-size: 10px; }
  .head span:nth-child(2) { display: none; }
  main { padding: 48px 22px 72px; }
  .lead { font-size: 17px; }
  .sec { grid-template-columns: 1fr; gap: 12px; margin-top: 44px; padding-top: 24px; }
  .sec-no { padding-top: 0; }
  .sec-body p { font-size: 15px; }
  footer { padding: 20px 22px 32px; flex-direction: column; }
}
</style>
