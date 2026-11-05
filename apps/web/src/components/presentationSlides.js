export const reviewRows = [
  ['隱私與資料安全', '誰能看到日記？如何保護內容？', '提供私人／好友／公開選項，後端檢查 JWT 與讀取權限。', '按可見範圍授權；本地 Agent 另驗證本人資料與引用。'],
  ['拍照、語音與便利性', '能否拍照，或在不便打字時快速記錄？', '將照片與語音轉文字放入定位日記表單。', '桌面 Web 可附照片；拍照與語音需相容裝置、瀏覽器及權限。'],
  ['產品價值與實用性', '我們自己會想用嗎？平台有何實際幫助？', '把地點、事件、心情與時間連成可回顧的生活記錄。', '透過個人地圖、情緒統計與可追溯來源的對話找回記憶。']
];

export const retrievalFlow = [
  { title: '提問', subtitle: '指定回顧條件', items: ['期間 · 地點 · 心情'] },
  { title: '授權', subtitle: 'JWT 身分驗證', items: ['僅檢索本人日記'] },
  { title: '檢索', subtitle: '共用查詢服務', items: ['臺北日期轉 UTC', '分頁取得證據'] },
  { title: '整理', subtitle: '生成回顧或摘要', items: ['數字由後端計算'] },
  { title: '回源', subtitle: '驗證引用', items: ['ID · 權限 · 版本'] }
];

export const gatewayFlow = [
  { title: 'Web', subtitle: '不直連模型', items: ['Express 授權'] },
  { title: 'VPS', subtitle: '僅 loopback', items: ['Provider 分流'] },
  { title: 'SSH', subtitle: '由家中主動連線', items: ['專用帳號與金鑰'] },
  { title: 'Gateway', subtitle: '家中 Ubuntu', items: ['健康檢查與排隊'] },
  { title: 'Ollama', subtitle: 'GPU 推論', items: ['Qwen3.5 4B'] }
];

export const agentTools = [
  ['search_diaries', '查詢條件與分頁摘錄。'],
  ['get_diary_details', '重新授權後讀取單篇與版本。'],
  ['get_emotion_statistics', '後端計算精確的情緒統計。'],
  ['summarize_diary_timeline', '取得時序樣本與各區間筆數。']
];
