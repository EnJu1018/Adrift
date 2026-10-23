# Adrift 漂流足跡

Adrift 是一個結合地圖、情緒日記、好友社交與 Adrift Intelligence 的情緒地圖平台。

這個 repository 管理網站前端與共用後端 API。原生 iOS App 已拆分至獨立的 Private repository：[Adrift-iOS](https://github.com/EnJu1018/Adrift-iOS)，兩個專案各自開發與發佈，仍共用同一套 Backend API。

## 專案結構

```txt
Adrift/
├─ apps/
│  ├─ web/      # React / Vite 網站前端
│  └─ api/      # Node.js / Express / MongoDB 後端 API
├─ docs/        # 架構、API、部署與專案連結
├─ packages/
│  └─ shared/   # 未來共用型別或工具
├─ package.json # npm workspaces 與根目錄 scripts
└─ docker-compose.yml
```

## 快速開始

### 安裝

```bash
npm install
```

### Web

```bash
cd apps/web
npm install
npm run dev
```

或從根目錄執行：

```bash
npm run dev:web
```

### API

```bash
cd apps/api
npm install
npm run dev
```

或從根目錄執行：

```bash
npm run dev:api
```

### 同時啟動 Web + API

```bash
npm run dev
```

### iOS

請另外 clone [Adrift-iOS](https://github.com/EnJu1018/Adrift-iOS)，在該專案開啟 `Adrift.xcodeproj`。iOS 不依賴本 repository 的本機路徑，也不需要先啟動 Web 才能編譯。

## 環境變數

請參考各 app 內的範例檔：

- `apps/web/.env.example`
- `apps/api/.env.example`

不要 commit 真正的 `.env`、`.env.local` 或其他私密設定。

## 主要功能

- 使用者註冊 / 登入，JWT 驗證
- 自訂 `userCode`
- 地圖日記與圖片上傳
- 好友列表與好友邀請
- 公開 / 好友 / 私人可見性
- Adrift Intelligence 智慧洞察
- 與獨立的原生 SwiftUI iOS App 共用 API

## 技術架構

| 區塊 | 技術 |
| --- | --- |
| Web | React, Vite, Mapbox GL JS, Framer Motion |
| API | Node.js, Express, MongoDB Atlas, JWT |
| iOS | SwiftUI, MapKit, URLSession, Keychain |
| AI | Gemini API |

## 文件

- [架構說明](docs/architecture.md)
- [API 說明](docs/api.md)
- [部署說明](docs/deployment.md)
- [iOS 說明](docs/ios.md)

## SEO Checklist

- Submit `https://adrifttw.com/sitemap.xml` to Google Search Console.
- Verify the canonical domain as `https://adrifttw.com/`.
- Request indexing for the homepage, `/about`, `/features/map-diary`, `/features/emotion`, `/features/memories`, and `/privacy`.
- Keep public product copy crawlable as real HTML text, not only images, canvas, or SVG text.
- Do not add a Google Search Console verification code until the real code is issued by Google.

## 開發重點

目前網站版是主要開發重點：

- `apps/web`：網站前端
- `apps/api`：網站後端 API
- iOS App 在 [Adrift-iOS](https://github.com/EnJu1018/Adrift-iOS) 獨立維護，不影響 Web / API build
