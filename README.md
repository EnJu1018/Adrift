# 🌊 Adrift

> A map-based social diary where emotions drift across the world.

Adrift 是一個結合 **地圖、日記與社交** 的 Web 應用，讓使用者可以在真實地點記錄當下心情，並與好友分享生活軌跡。

---

## 🧠 專案概念

在 Adrift 中，每一則日記不只是文字，而是：

- 📍 一個地點
- 🕰 一段時間
- 💭 一種情緒
- 📷 一個當下

所有記錄都會被「釘在地圖上」，形成個人與他人的情緒地圖。

---

## ✨ 目前功能（MVP）

### 🔐 使用者系統

- 使用者註冊 / 登入（JWT）
- 自訂使用者 ID（userCode）
- userCode 唯一性驗證
- 密碼加密（bcrypt）

### 📍 地圖日記系統

- 新增日記（含 GPS 定位）
- 日記內容包含：
  - 文字
  - 心情（type + intensity）
  - 圖片（可選）
  - 地點（lat / lng）
  - 可見性（private / friends / public）
- 地圖顯示日記 marker
- 點擊 marker 查看內容

### 👥 好友社交系統

- 透過 userCode 搜尋使用者
- 發送好友邀請
- 接受 / 拒絕好友邀請
- 好友列表
- 可查看好友的日記（friends 權限）

### 🔒 權限控制

| visibility | 說明 |
|------------|------|
| `private` | 僅本人可見 |
| `friends` | 好友可見 |
| `public` | 所有人可見 |

### 🎨 UI / UX

- 深色主題（Dark Mode）
- glassmorphism（玻璃擬態）
- 基本動畫（Framer Motion）
- 表單驗證與錯誤提示

---

## 🛠 技術架構

| 層級 | 技術 |
|------|------|
| Frontend | React / Next.js、Mapbox GL JS、Framer Motion |
| Backend | Node.js + Express |
| Database | MongoDB（Geo Index） |
| Auth | JWT |

---

## 🗃 資料結構（簡化）

### User

```json
{
  "_id": "",
  "name": "",
  "email": "",
  "passwordHash": "",
  "userCode": "",
  "friends": [],
  "friendRequests": []
}
```

---

## 🌍 API 概覽

所有 API 回傳格式統一：

```json
// ✅ 成功
{ "success": true, "message": "訊息", "data": {} }

// ❌ 錯誤
{ "success": false, "message": "錯誤訊息" }
```

> 除 `/auth/register` 與 `/auth/login` 外，所有 API 皆須帶入 `Authorization: Bearer TOKEN`

---

## 🔐 Auth

### `POST /auth/register`

```json
{
  "name": "使用者名稱",
  "email": "test@example.com",
  "password": "123456",
  "userCode": "arren_123"
}
```

> `userCode` 必須唯一，密碼至少 6 字元

### `POST /auth/login`

```json
{ "email": "test@example.com", "password": "123456" }
```

回傳 `token` 與 `user` 物件。

### `GET /auth/me`

回傳目前登入使用者資訊。

---

## 📍 Diary

### `POST /diaries`

```json
{
  "content": "今天很開心",
  "mood": { "type": "happy", "intensity": 4 },
  "location": { "lat": 24.123, "lng": 120.123 },
  "visibility": "public"
}
```

### `GET /diaries?lat=&lng=&radius=`

| 參數 | 說明 |
|------|------|
| `lat` | 緯度 |
| `lng` | 經度 |
| `radius` | 搜尋範圍（公尺） |

### `GET /diaries/public`

取得所有公開日記。

### `GET /diaries/:id`

取得單一日記。

### `DELETE /diaries/:id`

刪除指定日記（需為本人）。

---

## 👥 Friends

### `GET /users/search?userCode=arren_123`

透過 userCode 搜尋使用者。

### `POST /friends/request`

```json
{ "targetUserId": "user_id" }
```

### `GET /friends/requests`

查看收到的好友邀請。

### `POST /friends/requests/:id/accept`

接受好友邀請。

### `POST /friends/requests/:id/reject`

拒絕好友邀請。

### `GET /friends`

取得好友列表。

---

## ⚠️ HTTP 狀態碼

| 狀態碼 | 說明 |
|--------|------|
| 200 | 成功 |
| 400 | 請求錯誤 |
| 401 | 未授權 |
| 404 | 找不到資源 |
| 409 | 資料衝突 |
| 500 | 伺服器錯誤 |

---

## 🚀 啟動方式

**Backend**

```bash
cd backend
npm install
npm run dev
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

---

## 🔐 環境變數

建立 `.env`：

```env
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret
MAPBOX_TOKEN=your_mapbox_token
```

---

## 📌 專案現況

**已完成**

- ✅ 使用者系統
- ✅ 地圖日記功能
- ✅ 好友系統
- ✅ 權限控制

**🚧 未來規劃**

- 🕰 回憶系統（On this day）
- 🌍 附近日記探索
- 💭 情緒熱力圖
- 🧑‍🤝‍🧑 匿名日記模式
- 🔔 通知系統
- 📊 情緒分析

---

## 🎯 專案目標

> Adrift 不只是日記 App，而是：
> 一個將「情緒與記憶」映射到真實世界地圖上的社交平台。