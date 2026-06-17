# Adrift 漂流足跡

Adrift 是一個結合地圖、情緒日記、好友社交與 Adrift Intelligence 的情緒地圖平台。

這個 repository 採用 monorepo 結構，網站前端、後端 API 與 iOS App 彼此分開管理，避免 Web 與 iOS 檔案混在一起。

## 專案結構

```txt
Adrift/
├─ apps/
│  ├─ web/      # React / Vite 網站前端
│  ├─ api/      # Node.js / Express / MongoDB 後端 API
│  └─ ios/      # SwiftUI 原生 iOS App
├─ docs/        # 架構、API、部署與 iOS 文件
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

```bash
open apps/ios/Adrift.xcodeproj
```

使用 Xcode 選擇 `Adrift` scheme 後執行。

## 環境變數

請參考各 app 內的範例檔：

- `apps/web/.env.example`
- `apps/api/.env.example`
- `apps/ios/README.md`

不要 commit 真正的 `.env`、`.env.local` 或其他私密設定。

## 主要功能

- 使用者註冊 / 登入，JWT 驗證
- 自訂 `userCode`
- 地圖日記與圖片上傳
- 好友列表與好友邀請
- 公開 / 好友 / 私人可見性
- Adrift Intelligence 智慧洞察
- 原生 SwiftUI iOS App

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

## 開發重點

目前網站版是主要開發重點：

- `apps/web`：網站前端
- `apps/api`：網站後端 API
- `apps/ios`：iOS App 獨立維護，不影響 Web / API build
