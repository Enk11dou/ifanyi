# 📚 AI 双语助手 - 项目开发文档

> 这个文档用于帮助开发者（和 AI）快速了解项目的架构、功能和开发历史。

---

## 🎯 项目概述

**名称**: AI 双语助手 (ifanyi)  
**仓库**: https://github.com/Enk11dou/ifanyi  
**版本**: v1.0.0  
**类型**: Chrome 浏览器扩展  
**目标用户**: 使用 ChatGPT、Gemini、Claude 的中国用户  

### 核心功能

1. **输入翻译**: 用户在输入框输入中文 → 自动翻译成英文
2. **选中翻译**: 选中AI回答的英文 → 点击按钮翻译成中文
3. **智能保留**: 代码块、公式、URL 完全保留原样，不翻译

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
│   └── claude-handler.js   # Claude 平台适配
│
├── lib/
│   └── translator.js       # 翻译服务：API调用、缓存、智能分割
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
- **智能保留**: 逐行分析，识别代码/公式/URL，只翻译正文
- **缓存**: 内存缓存已翻译内容

### 2. 精细替换 (`content.js` - `replaceInPage`)

- 遍历选中范围内的所有**文本节点**
- 检查每个节点是否在代码/公式元素中
- 只替换需要翻译的节点，完全不动代码
- 统一翻译方向（根据整体内容判断是中→英还是英→中）

### 3. 平台适配 (`*-handler.js`)

每个平台有不同的 DOM 结构，handler 负责：
- `getInputElement()` - 获取输入框元素
- `getInputValue()` - 获取输入框内容
- `setInputValue()` - 设置输入框内容
- `getResponseElements()` - 获取 AI 回答元素

### 4. UI (`content.css`)

- **悬浮按钮**: 右下角 🌐，可拖动
- **悬浮窗口**: 可拖动、可缩放（CSS resize）
- **选中翻译按钮**: 选中文字后出现的 🔄 小按钮
- **深色模式**: 自动适配系统偏好

---

## 📝 开发历史

| 日期 | 版本 | 主要更新 |
|------|------|----------|
| 2026-01-08 | v1.0.0 | 首个正式版本发布 |

### 主要开发过程

1. **基础框架**: 创建 Chrome 扩展结构，实现平台 handler
2. **翻译功能**: 集成 Google Translate，实现输入翻译
3. **选中翻译**: 实现选中文字后显示翻译按钮，弹窗显示结果
4. **智能保留**: 添加代码/公式检测，保留不翻译
5. **精细替换**: 遍历文本节点，只替换正文，不动代码
6. **统一方向**: 根据整体内容判断翻译方向
7. **UI优化**: 紧凑型设计，可拖动、可缩放

---

## 🔑 关键函数

### `translator.js`

```javascript
translateWithStructure(text, from, to)  // 保留结构翻译
shouldPreserveLine(line)                 // 检测行是否应保留
toEnglish(text)                          // 中文→英文
toChinese(text)                          // 英文→中文
```

### `content.js`

```javascript
replaceInPage(original, result)          // 精细替换DOM
isInCodeOrFormula(node)                  // 检测节点是否在代码中
shouldTranslateText(text)                // 检测文本是否需翻译
showTransBtn(x, y, text)                 // 显示翻译按钮
showTranslationPopup(original, result)   // 显示翻译弹窗
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
- [ ] 更多 AI 平台支持

---

## 🐛 已知问题

1. 某些复杂 DOM 结构可能导致替换失败（会 fallback 到弹窗显示）
2. 翻译超长文本时可能较慢

---

## 📦 发布流程

1. 更新 `manifest.json` 中的版本号
2. 更新 `CHANGELOG.md`
3. 提交代码: `git add . && git commit -m "版本信息"`
4. 推送: `git push`
5. 打包: `zip -r ifanyi-vX.X.X.zip ai-bilingual-assistant -x "*.DS_Store"`

---

**最后更新**: 2026-01-09
