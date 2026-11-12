(function() {
  var style = document.createElement('style')
  style.textContent = ".pinned-overlay { position: fixed; left: 50%; transform: translateX(-50%); top: 80px; z-index: 999999; font-family: 'Microsoft YaHei UI'; font-weight: 900; font-size: 72px; color: #fff; text-align: center; text-shadow: 3px 3px 8px rgba(0,0,0,0.9); background: rgba(0,0,0,0.55); padding: 24px 48px; border-radius: 16px; line-height: 1.4; white-space: pre-line; } .pinned-badge { position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%); z-index: 999999; font-family: 'Microsoft YaHei UI'; font-weight: 700; font-size: 32px; color: #fff; background: rgba(0,0,0,0.7); padding: 16px 40px; border-radius: 50px; }"
  document.head.appendChild(style)
  
  var overlay = document.createElement('div')
  overlay.id = 'pinned-overlay'
  overlay.className = 'pinned-overlay'
  document.body.appendChild(overlay)
  
  var badge = document.createElement('div')
  badge.id = 'pinned-badge'
  badge.className = 'pinned-badge'
  badge.textContent = 'MBTI-PRO 81 Types Test · Free'
  document.body.appendChild(badge)
  
  var texts = [
    { t: 0, text: 'Too Simple\nMBTI 16 Types' },
    { t: 5000, text: 'Real People\nIn Between' },
    { t: 12000, text: 'MBTI-PRO\n81 Type System' },
    { t: 20000, text: 'Test on Homepage\n100% Free' },
    { t: 28000, text: '100 Questions\nFull Profile' },
    { t: 38000, text: 'Not Just 4 Letters\nComplete Portrait' },
    { t: 52000, text: 'Email → Poster\nFree PDF Report' },
    { t: 68000, text: 'Test for Free\nDiscover Your 81 Type' }
  ]
  
  var startTime = Date.now()
  function update() {
    var now = Date.now() - startTime
    var current = texts.filter(function(item) { return item.t <= now }).pop()
    overlay.textContent = current ? current.text : ''
    if (now < 80000) requestAnimationFrame(update)
  }
  update()
})()
