# 📚 AI 双语助手 - 项目开发文档

> 这个文档用于帮助开发者（和 AI）快速了解项目的架构、功能和开发历史。

---

## 🎯 项目概述

**名称**: AI 双语助手 (ifanyi)  
**仓库**: https://github.com/Enk11dou/ifanyi  
**版本**: v1.1.0  
**类型**: Chrome 浏览器扩展  
**目标用户**: 需要网页翻译的中国用户  

### 核心功能

1. **选中翻译**: 选中任意网页英文 → 点击按钮翻译成中文
2. **翻译全文**: 一键翻译页面所有内容
3. **输入翻译**: 在AI平台输入中文 → 自动翻译成英文
4. **智能保留**: 代码块、公式、URL 完全保留原样，不翻译

### 支持范围

- ✅ **所有网站** - 选中翻译、翻译全文
- ✅ **ChatGPT** - 输入翻译 + 选中翻译
- ✅ **Gemini** - 输入翻译 + 选中翻译
- ✅ **Claude** - 输入翻译 + 选中翻译

---

## 🏗️ 项目架构

```
ai-bilingual-assistant/
├── manifest.json           # Chrome 扩展配置
│
├── background/
│   └── background.js       # 后台服务：处理翻译API请求（绕过CSP）
│
├── content/
│   ├── content.js          # 主逻辑：UI、事件、翻译触发
│   ├── content.css         # UI样式：悬浮窗、按钮、弹窗
│   ├── chatgpt-handler.js  # ChatGPT 平台适配
│   ├── gemini-handler.js   # Gemini 平台适配
│   ├── claude-handler.js   # Claude 平台适配
│   └── generic-handler.js  # 通用网站处理器（所有其他网站）
│
├── lib/
│   └── translator.js       # 翻译服务：批量翻译、并发、缓存
│
├── popup/                  # 点击扩展图标的弹出菜单
├── options/                # 扩展设置页面
└── icons/                  # 扩展图标
```

---

## 🔧 核心技术实现

### 1. 翻译服务 (`lib/translator.js`)

- **引擎**: Google Translate API
- **调用方式**: 通过 `background.js` 发起请求（避免网站 CSP 限制）
- **批量翻译**: 合并多个文本为一次API请求
- **并发翻译**: 同时发起5个请求加速
- **请求去重**: 相同文本不重复请求
- **智能缓存**: 已翻译内容直接返回

### 2. 精细替换 (`content.js` - `replaceInPage`)

- 遍历选中范围内的所有**文本节点**
- 检查每个节点是否在代码/公式元素中
- 只替换需要翻译的节点，完全不动代码
- 统一翻译方向（根据整体内容判断是中→英还是英→中）

### 3. 翻译全文 (`content.js` - `translateAllResponses`)

- 获取页面所有内容元素
- 遍历所有文本节点
- 批量翻译非代码内容
- 显示实时进度

### 4. 平台适配 (`*-handler.js`)

每个平台有不同的 DOM 结构，handler 负责：
- `getInputElement()` - 获取输入框元素
- `getInputValue()` - 获取输入框内容
- `setInputValue()` - 设置输入框内容
- `getResponseElements()` - 获取内容元素

### 5. UI (`content.css`)

- **悬浮按钮**: 右下角 🌐，可拖动
- **悬浮窗口**: 可拖动、可缩放（CSS resize）
- **翻译全文按钮**: 悬浮窗内的主要操作
- **选中翻译按钮**: 选中文字后出现的 🔄 小按钮
- **深色模式**: 自动适配系统偏好

---

## 📝 开发历史

| 日期 | 版本 | 主要更新 |
|------|------|----------|
| 2026-01-09 | v1.1.0 | 支持所有网站、翻译全文、速度优化 |
| 2026-01-08 | v1.0.0 | 首个正式版本发布 |

---

## 🔑 关键函数

### `translator.js`

```javascript
translateBatch(texts, from, to)           // 批量翻译
translateConcurrent(items, from, to)      // 并发翻译
translateWithStructure(text, from, to)    // 保留结构翻译
shouldPreserveLine(line)                  // 检测行是否应保留
```

### `content.js`

```javascript
translateAllResponses()                   // 翻译页面全文
replaceInPage(original, result)           // 精细替换DOM
isInCodeOrFormula(node)                   // 检测节点是否在代码中
shouldTranslateText(text)                 // 检测文本是否需翻译
```

### `background.js`

```javascript
// 监听翻译请求，调用 Google Translate API
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'translate') { ... }
})
```

---

## 🚀 未来计划

- [ ] 支持更多翻译引擎 (DeepL, Azure, OpenAI)
- [ ] 快捷键支持 (Alt+T 翻译选中)
- [ ] 双语对照模式
- [ ] 翻译历史记录
- [ ] 术语表/词汇本

---

## 🐛 已知问题

1. 某些复杂 DOM 结构可能导致替换失败（会 fallback 到弹窗显示）
2. 翻译超长文本时仍需要一定时间

---

## 📦 发布流程

1. 更新 `manifest.json` 中的版本号
2. 更新 `CHANGELOG.md`
3. 更新 `DEV_NOTES.md`
4. 提交代码: `git add . && git commit -m "版本信息"`
5. 推送: `git push`
6. 打包: `zip -r ifanyi-vX.X.X.zip ai-bilingual-assistant -x "*.DS_Store"`

---

**最后更新**: 2026-01-09
