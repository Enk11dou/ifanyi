/**
 * AI 双语助手 v6.0 - 输入框伴随模式
 * 紧贴输入框、实时同步、极致便捷
 */
console.log('🚀 AI 双语助手 v6.0 - 伴随模式');

const config = { enabled: true, autoTranslateInput: true, minTextLength: 2 };
let floatingWindow = null;
let floatingToggle = null;
let inputDebounceTimer = null;
let currentBtn = null;

// ==================== 初始化 ====================

async function init() {
    let attempts = 0;
    while ((!window.platformHandler || !window.translationService) && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    if (!window.platformHandler || !window.translationService) {
        console.error('初始化失败');
        return;
    }

    await loadConfig();
    createUI();
    initInputListener();
    initSelectionListener();
    initInputFocusDetection(); // 自动检测输入框焦点

    console.log('🎉 初始化完成!');
}

async function loadConfig() {
    try {
        const result = await chrome.storage.sync.get(['enabled', 'autoTranslateInput']);
        Object.assign(config, result);
    } catch (e) { }
}

// ==================== UI ====================

let companionMode = true;
let lastInputRect = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

function createUI() {
    // 伴随显示框
    const companion = document.createElement('div');
    companion.id = 'bilingual-companion';
    companion.className = 'hidden'; // 默认隐藏
    companion.innerHTML = `
        <div class="bc-bar">
            <span class="bc-icon">🌐</span>
            <div class="bc-content" id="bcContent">
                <span class="bc-text" id="bcOriginal">等待输入...</span>
            </div>
            <button class="bc-btn bc-use" id="bcUse" style="display:none;">使用</button>
            <button class="bc-btn bc-search" id="bcSearch">强制搜索</button>
            <button class="bc-btn bc-page" id="bcPage">翻译全文</button>
            <button class="bc-btn bc-close" id="bcClose">×</button>
        </div>
        <div class="bc-result" id="bcResult" style="display:none;">
            <span class="bc-label">译文：</span>
            <span class="bc-translated" id="bcTranslated"></span>
        </div>
    `;
    document.body.appendChild(companion);
    floatingWindow = companion;

    // 迷你按钮（收起状态）
    const toggle = document.createElement('div');
    toggle.id = 'bilingual-toggle-btn';
    toggle.innerHTML = '🌐';
    toggle.title = '打开翻译助手';
    document.body.appendChild(toggle);
    floatingToggle = toggle;

    // 元素引用
    const bcOriginal = companion.querySelector('#bcOriginal');
    const bcResult = companion.querySelector('#bcResult');
    const bcTranslated = companion.querySelector('#bcTranslated');
    const bcUse = companion.querySelector('#bcUse');
    const bcPage = companion.querySelector('#bcPage');
    const bcClose = companion.querySelector('#bcClose');

    // 拖动功能
    companion.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        const rect = companion.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        companion.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        companion.style.left = (e.clientX - dragOffset.x) + 'px';
        companion.style.top = (e.clientY - dragOffset.y) + 'px';
        companion.style.right = 'auto';
        companion.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        if (companion) companion.style.cursor = '';
    });

    // 监听主输入框内容变化
    let lastValue = '';
    let translateTimer = null;

    setInterval(() => {
        if (!config.enabled || floatingWindow?.classList.contains('hidden')) return;

        const handler = window.platformHandler;
        if (!handler) return;

        const value = handler.getInputValue();
        if (value === lastValue) return;
        lastValue = value;

        // 显示原文
        if (!value?.trim()) {
            bcOriginal.textContent = '等待输入...';
            bcOriginal.className = 'bc-text';
            bcResult.style.display = 'none';
            bcUse.style.display = 'none';
            return;
        }

        // 自适应显示（不截断太多）
        bcOriginal.textContent = value.length > 30 ? value.slice(0, 30) + '...' : value;
        bcOriginal.className = 'bc-text has-content';

        // 检测中文并翻译
        if (window.translationService?.containsChinese(value)) {
            bcOriginal.classList.add('has-chinese');

            clearTimeout(translateTimer);
            translateTimer = setTimeout(async () => {
                try {
                    const translated = await window.translationService.toEnglish(value);
                    if (translated && translated !== value) {
                        bcTranslated.textContent = translated.length > 50 ? translated.slice(0, 50) + '...' : translated;
                        bcResult.style.display = 'flex';
                        bcUse.style.display = 'inline-block';
                        floatingWindow._translated = translated;
                    }
                } catch (e) { }
            }, 500);
        } else {
            bcOriginal.classList.remove('has-chinese');
            bcResult.style.display = 'none';
            bcUse.style.display = 'none';
        }
    }, 300);

    // 使用翻译结果
    bcUse.addEventListener('click', () => {
        if (floatingWindow?._translated) {
            window.platformHandler?.setInputValue(floatingWindow._translated);
            bcResult.style.display = 'none';
            bcUse.style.display = 'none';
        }
    });

    // 强制搜索（提示词注入）
    const bcSearch = companion.querySelector('#bcSearch');
    bcSearch.addEventListener('click', () => {
        injectSearchPrompt();
    });

    // 翻译全文
    bcPage.addEventListener('click', translateAllResponses);

    // 收起
    bcClose.addEventListener('click', hideWindow);

    // 展开
    toggle.addEventListener('click', showWindow);

    // 初始定位
    positionCompanion();
}

/**
 * 智能定位：紧贴输入框上方，不遮挡输入框
 */
function positionCompanion(forceReposition = false) {
    if (!floatingWindow || floatingWindow.classList.contains('hidden')) return;
    if (isDragging) return; // 拖动时不自动定位

    const handler = window.platformHandler;
    if (!handler) return;

    const inputEl = handler.getInputElement();
    if (!inputEl) return;

    const rect = inputEl.getBoundingClientRect();

    // 如果不是强制重定位，检查输入框位置是否变化
    if (!forceReposition && lastInputRect &&
        Math.abs(rect.left - lastInputRect.left) < 5 &&
        Math.abs(rect.top - lastInputRect.top) < 5) {
        return;
    }
    lastInputRect = rect;

    const companionHeight = floatingWindow.offsetHeight || 60;
    const gap = 20; // 与输入框的间距（不紧贴）

    // 计算位置：在输入框上方，保持距离
    let top = rect.top - companionHeight - gap;
    let left = rect.left;
    let width = Math.min(rect.width, 400);

    // 确保不超出屏幕顶部
    if (top < 10) {
        // 如果上方空间不够，尝试放在输入框左侧或右侧
        top = rect.top;
        left = rect.left - width - gap;
        if (left < 10) {
            left = rect.right + gap;
        }
    }

    // 确保不超出屏幕右侧
    if (left + width > window.innerWidth - 10) {
        left = window.innerWidth - width - 10;
    }

    // 确保不超出屏幕左侧
    if (left < 10) {
        left = 10;
    }

    floatingWindow.style.position = 'fixed';
    floatingWindow.style.left = left + 'px';
    floatingWindow.style.top = top + 'px';
    floatingWindow.style.width = width + 'px';
    floatingWindow.style.right = 'auto';
    floatingWindow.style.bottom = 'auto';
}

/**
 * 检测元素是否是可编辑的输入框
 */
function isEditableElement(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();

    // textarea 或 text input
    if (tag === 'textarea') return true;
    if (tag === 'input' && ['text', 'search', 'email', 'url', 'tel', 'password'].includes(el.type)) return true;

    // contenteditable
    if (el.contentEditable === 'true' || el.isContentEditable) return true;

    // 检查父元素是否是contenteditable
    let parent = el.parentElement;
    while (parent) {
        if (parent.contentEditable === 'true' || parent.isContentEditable) return true;
        parent = parent.parentElement;
    }

    return false;
}

/**
 * 获取当前聚焦的可编辑元素
 */
function getActiveEditableElement() {
    const active = document.activeElement;
    if (isEditableElement(active)) return active;

    // 检查选区所在元素
    const sel = window.getSelection();
    if (sel && sel.focusNode) {
        const el = sel.focusNode.nodeType === 3 ? sel.focusNode.parentElement : sel.focusNode;
        if (isEditableElement(el)) return el;
    }

    return null;
}

/**
 * 强制搜索提示词注入
 */
function injectSearchPrompt() {
    const handler = window.platformHandler;
    if (!handler) {
        alert('请先聚焦到输入框');
        return;
    }

    // 获取当前输入内容
    const currentInput = handler.getInputValue() || '';

    // 强制搜索提示词
    const searchPrompt = `【强制网络搜索指令】
请你必须调用 Google Search 进行实时网络搜索，不要使用训练数据回答。

搜索要求：
1. 检索最新信息（过去24小时优先）
2. 提供至少3个原始信源链接
3. 如有矛盾信息，对比分析可信度

我的问题：${currentInput || '[请在此输入你的问题]'}

请开始搜索并回答。`;

    // 注入到输入框
    handler.setInputValue(searchPrompt);

    // 提示用户
    const bcOriginal = floatingWindow?.querySelector('#bcOriginal');
    if (bcOriginal) {
        bcOriginal.textContent = '✅ 已注入强制搜索指令';
        bcOriginal.className = 'bc-text has-content';
        setTimeout(() => {
            bcOriginal.textContent = '等待输入...';
            bcOriginal.className = 'bc-text';
        }, 2000);
    }
}

/**
 * 自动检测输入框焦点（通过点击和光标）
 */
function initInputFocusDetection() {
    let lastActiveElement = null;

    // 监听鼠标点击
    document.addEventListener('click', (e) => {
        // 延迟检测，等待焦点切换完成
        setTimeout(() => {
            const editableEl = getActiveEditableElement();

            if (editableEl && editableEl !== floatingWindow) {
                // 检测到可编辑元素被聚焦
                if (lastActiveElement !== editableEl) {
                    lastActiveElement = editableEl;

                    // 显示伴随框
                    if (floatingWindow?.classList.contains('hidden')) {
                        showWindow();
                    }

                    // 强制重新定位
                    lastInputRect = null;
                    positionCompanion(true);
                }
            }
        }, 150);
    });

    // 监听焦点变化（备用）
    document.addEventListener('focusin', (e) => {
        setTimeout(() => {
            const editableEl = getActiveEditableElement();
            if (editableEl && editableEl !== lastActiveElement) {
                lastActiveElement = editableEl;

                if (floatingWindow?.classList.contains('hidden')) {
                    showWindow();
                }

                lastInputRect = null;
                positionCompanion(true);
            }
        }, 100);
    });

    // 监听键盘输入（检测光标活动）
    document.addEventListener('keydown', (e) => {
        const editableEl = getActiveEditableElement();
        if (editableEl && floatingWindow?.classList.contains('hidden')) {
            showWindow();
            lastInputRect = null;
            positionCompanion(true);
        }
    });

    // 监听滚动重新定位
    document.addEventListener('scroll', () => {
        positionCompanion(true);
    }, true);

    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        positionCompanion(true);
    });

    // 定期检查位置
    setInterval(() => {
        positionCompanion(false);
    }, 500);
}

function showWindow() {
    floatingWindow?.classList.remove('hidden');
    floatingToggle?.classList.add('hidden');
    positionCompanion(true);
}

function hideWindow() {
    floatingWindow?.classList.add('hidden');
    floatingToggle?.classList.remove('hidden');
}

// ==================== 输入翻译（伴随模式已在createUI中处理）====================

function initInputListener() {
    // 伴随模式下，输入监听已在createUI中实现
    // 这里保留空函数以兼容初始化流程
}

function updateInputDisplay(text) {
    // 伴随模式不需要此函数
}

async function translateInput(text) {
    // 伴随模式不需要此函数
}

function useTranslation() {
    // 伴随模式不需要此函数
}

function hideTranslation() {
    // 伴随模式不需要此函数
}

// ==================== 翻译全文 ====================

async function translateAllResponses() {
    const btn = floatingWindow?.querySelector('#bcPage');
    const bcInput = floatingWindow?.querySelector('#bcInput');

    if (btn) {
        btn.textContent = '⏳';
        btn.disabled = true;
    }

    // 显示状态在输入框
    const originalPlaceholder = bcInput?.placeholder;
    if (bcInput) bcInput.placeholder = '翻译中...';

    try {
        // 获取页面内容元素
        const handler = window.platformHandler;
        let responses;

        if (handler && handler.getResponseElements) {
            responses = handler.getResponseElements();
        }

        // 如果没有找到内容，使用body
        if (!responses || responses.length === 0) {
            responses = [document.body];
        }

        let translatedCount = 0;
        let totalNodes = 0;

        for (const response of responses) {
            // 获取所有文本节点
            const walker = document.createTreeWalker(
                response,
                NodeFilter.SHOW_TEXT,
                null
            );

            const textNodes = [];
            while (walker.nextNode()) {
                textNodes.push(walker.currentNode);
            }

            // 收集需要翻译的节点
            const toTranslate = [];
            for (const node of textNodes) {
                if (isInCodeOrFormula(node)) continue;
                const text = node.textContent.trim();
                if (!text || text.length < 5) continue;
                if (!shouldTranslateText(text)) continue;
                if (window.translationService.isMainlyChinese(text)) continue; // 跳过中文
                if (node.parentElement?.classList?.contains('translated-inline')) continue; // 已翻译

                toTranslate.push({ node, text });
            }

            totalNodes += toTranslate.length;

            // 批量翻译
            if (toTranslate.length > 0) {
                const texts = toTranslate.map(t => t.text);
                const translations = await window.translationService.translateBatch(texts, 'en', 'zh-CN');

                // 替换文本节点
                for (let i = 0; i < toTranslate.length; i++) {
                    const { node, text } = toTranslate[i];
                    const translated = translations[i];

                    if (translated && translated !== text) {
                        const span = document.createElement('span');
                        span.className = 'translated-inline';
                        span.textContent = translated;
                        span.dataset.original = text;
                        span.dataset.translated = translated;
                        span.dataset.state = 'translated';
                        span.title = '点击切换';

                        span.addEventListener('click', function (e) {
                            e.stopPropagation();
                            if (this.dataset.state === 'translated') {
                                this.textContent = this.dataset.original;
                                this.dataset.state = 'original';
                                this.classList.add('showing-original');
                            } else {
                                this.textContent = this.dataset.translated;
                                this.dataset.state = 'translated';
                                this.classList.remove('showing-original');
                            }
                        });

                        try {
                            node.parentNode.replaceChild(span, node);
                            translatedCount++;
                        } catch (e) { }
                    }
                }
            }

            // 更新进度
            if (bcInput) bcInput.placeholder = `翻译中... ${translatedCount}/${totalNodes}`;
        }

        // 完成
        if (bcInput) bcInput.placeholder = `✅ 完成 (${translatedCount}处)`;
        setTimeout(() => {
            if (bcInput) bcInput.placeholder = originalPlaceholder || '输入中文，自动翻译...';
        }, 2000);

        if (btn) {
            btn.textContent = '📄';
            btn.disabled = false;
        }

    } catch (e) {
        console.error('翻译全文失败:', e);
        if (bcInput) bcInput.placeholder = '❌ 翻译失败';
        setTimeout(() => {
            if (bcInput) bcInput.placeholder = originalPlaceholder || '输入中文，自动翻译...';
        }, 2000);

        if (btn) {
            btn.textContent = '📄';
            btn.disabled = false;
        }
    }
}

// ==================== 选中翻译 ====================

let savedRange = null; // 保存选中的范围

function initSelectionListener() {
    document.addEventListener('mouseup', (e) => {
        if (floatingWindow?.contains(e.target)) return;
        if (floatingToggle?.contains(e.target)) return;
        if (currentBtn?.contains(e.target)) return;
        if (e.target.closest?.('.trans-popup')) return;

        setTimeout(() => {
            const sel = window.getSelection();
            const text = sel?.toString().trim();

            if (!text || text.length < 5) {
                removeBtn();
                return;
            }

            try {
                const range = sel.getRangeAt(0);
                savedRange = range.cloneRange(); // 保存范围用于后续替换
                const rects = range.getClientRects();
                if (!rects.length) return;

                const lastRect = rects[rects.length - 1];
                showTransBtn(lastRect.right + 4, lastRect.top + lastRect.height / 2 - 12, text);
            } catch (e) { }
        }, 100);
    });
}

function showTransBtn(x, y, text) {
    removeBtn();

    const btn = document.createElement('div');
    btn.className = 'sel-btn';
    btn.innerHTML = '🔄';
    btn.title = '翻译（保留格式）';
    btn.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:9999999;`;

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await doTranslate(text, btn);
    });

    document.body.appendChild(btn);
    currentBtn = btn;
}

function removeBtn() {
    currentBtn?.remove();
    currentBtn = null;
}

async function doTranslate(text, btn) {
    btn.innerHTML = '⏳';
    btn.classList.add('loading');

    try {
        const isChinese = window.translationService.isMainlyChinese(text);
        const from = isChinese ? 'zh-CN' : 'en';
        const to = isChinese ? 'en' : 'zh-CN';

        // 使用保留结构的翻译
        const result = await window.translationService.translateWithDetails(text, from, to);

        if (result.hasTranslation) {
            // 默认直接替换DOM
            const success = replaceInPage(text, result);
            if (success) {
                removeBtn();
            } else {
                // 替换失败则显示弹窗
                showTranslationPopup(text, result, btn);
            }
        } else {
            btn.innerHTML = '=';
            setTimeout(removeBtn, 1500);
        }
    } catch (e) {
        btn.innerHTML = '❌';
        setTimeout(removeBtn, 2000);
    }
}

/**
 * 检查节点是否在代码/公式元素中
 */
function isInCodeOrFormula(node) {
    let el = node.nodeType === 3 ? node.parentElement : node;
    while (el && el !== document.body) {
        const tag = el.tagName?.toLowerCase();
        const cls = el.className?.toLowerCase() || '';

        // 代码元素
        if (['code', 'pre', 'kbd', 'samp', 'var', 'tt'].includes(tag)) return true;
        if (cls.includes('code') || cls.includes('highlight') || cls.includes('hljs') || cls.includes('prism')) return true;

        // 公式元素
        if (['math', 'svg', 'mjx-container'].includes(tag)) return true;
        if (cls.includes('math') || cls.includes('katex') || cls.includes('latex') || cls.includes('mathjax')) return true;

        el = el.parentElement;
    }
    return false;
}

/**
 * 检查文本是否需要翻译
 */
function shouldTranslateText(text) {
    const t = text.trim();
    if (!t || t.length < 3) return false;

    // 纯符号/数字
    if (/^[\d\s\+\-\*\/\=\.\,\;\:\(\)\[\]\{\}\<\>\&\%\#\@\$\^\~\`\\|\'\"!?]+$/.test(t)) return false;

    // URL
    if (/^https?:\/\//i.test(t)) return false;

    // 代码关键字
    if (/^(import|export|from|def|class|function|const|let|var|if|else|for|while|return)\s/.test(t)) return false;

    return true;
}

/**
 * 精细替换：只替换需要翻译的文本节点
 */
async function replaceInPage(original, result) {
    if (!savedRange) {
        console.error('没有保存的选择范围');
        return false;
    }

    // 先根据整体内容判断翻译方向
    const overallIsChinese = window.translationService.isMainlyChinese(original);
    const targetLang = overallIsChinese ? 'en' : 'zh';
    console.log('[翻译方向] 整体是中文:', overallIsChinese, '→ 目标语言:', targetLang);

    try {
        // 获取选中范围内的所有文本节点
        const textNodes = [];
        const walker = document.createTreeWalker(
            savedRange.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (savedRange.intersectsNode(node)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            }
        );

        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        if (textNodes.length === 0) {
            // 如果没有找到文本节点，尝试直接处理
            const container = savedRange.commonAncestorContainer;
            if (container.nodeType === 3) {
                textNodes.push(container);
            }
        }

        let replacedCount = 0;

        // 遍历每个文本节点
        for (const textNode of textNodes) {
            // 跳过代码/公式中的节点
            if (isInCodeOrFormula(textNode)) {
                console.log('[跳过] 在代码/公式中:', textNode.textContent.slice(0, 20));
                continue;
            }

            const text = textNode.textContent;

            // 检查是否需要翻译
            if (!shouldTranslateText(text)) {
                console.log('[跳过] 不需翻译:', text.slice(0, 20));
                continue;
            }

            // 如果目标是英文，只翻译中文内容
            // 如果目标是中文，只翻译英文内容
            const nodeIsChinese = window.translationService.containsChinese(text);
            if (targetLang === 'en' && !nodeIsChinese) {
                console.log('[跳过] 已是英文:', text.slice(0, 20));
                continue;
            }
            if (targetLang === 'zh' && nodeIsChinese) {
                console.log('[跳过] 已是中文:', text.slice(0, 20));
                continue;
            }

            // 翻译这个文本节点（统一方向）
            try {
                const translated = targetLang === 'en'
                    ? await window.translationService.toEnglish(text)
                    : await window.translationService.toChinese(text);

                if (translated && translated !== text) {
                    // 创建可切换的span
                    const span = document.createElement('span');
                    span.className = 'translated-inline';
                    span.textContent = translated;
                    span.dataset.original = text;
                    span.dataset.translated = translated;
                    span.dataset.state = 'translated';
                    span.title = '点击切换';

                    span.addEventListener('click', function (e) {
                        e.stopPropagation();
                        if (this.dataset.state === 'translated') {
                            this.textContent = this.dataset.original;
                            this.dataset.state = 'original';
                            this.classList.add('showing-original');
                        } else {
                            this.textContent = this.dataset.translated;
                            this.dataset.state = 'translated';
                            this.classList.remove('showing-original');
                        }
                    });

                    // 替换文本节点
                    textNode.parentNode.replaceChild(span, textNode);
                    replacedCount++;
                    console.log('[替换] 成功:', text.slice(0, 20), '->', translated.slice(0, 20));
                }
            } catch (e) {
                console.error('[替换] 翻译失败:', e);
            }
        }

        // 清除选择
        window.getSelection()?.removeAllRanges();
        savedRange = null;

        return replacedCount > 0;
    } catch (e) {
        console.error('DOM替换失败:', e);
        return false;
    }
}

/**
 * 显示翻译结果弹窗（保留结构，高亮显示）
 */
function showTranslationPopup(original, result, btn) {
    removeBtn();

    // 构建带高亮的内容
    let contentHtml = '';
    for (const line of result.lines) {
        const escaped = escapeHtml(line.text);
        if (line.translated) {
            contentHtml += `<div class="popup-line trans">${escaped}</div>`;
        } else {
            contentHtml += `<div class="popup-line keep">${escaped || '&nbsp;'}</div>`;
        }
    }

    const popup = document.createElement('div');
    popup.className = 'trans-popup';
    popup.innerHTML = `
        <div class="popup-header">
            <span>翻译结果</span>
            <span class="popup-hint">🟢已翻译 🟡保留</span>
            <button class="popup-close">✕</button>
        </div>
        <div class="popup-content">${contentHtml}</div>
        <div class="popup-footer">
            <button class="popup-replace">✓ 替换原文</button>
            <button class="popup-copy">📋 复制</button>
        </div>
    `;

    // 定位
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        popup.style.left = Math.max(10, rect.left + window.scrollX) + 'px';
        popup.style.top = rect.bottom + window.scrollY + 8 + 'px';
    }

    // 替换原文按钮
    popup.querySelector('.popup-replace').onclick = () => {
        const success = replaceInPage(original, result);
        if (success) {
            popup.remove();
        } else {
            popup.querySelector('.popup-replace').textContent = '❌ 替换失败';
        }
    };

    popup.querySelector('.popup-copy').onclick = () => {
        navigator.clipboard.writeText(result.result);
        popup.querySelector('.popup-copy').textContent = '✓ 已复制';
    };

    popup.querySelector('.popup-close').onclick = () => popup.remove();

    // 点击外部关闭
    setTimeout(() => {
        const handler = (e) => {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('mousedown', handler);
            }
        };
        document.addEventListener('mousedown', handler);
    }, 200);

    document.body.appendChild(popup);
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

// ==================== 消息 ====================

chrome.runtime.onMessage.addListener((req, sender, res) => {
    if (req.action === 'getStatus') {
        res({ enabled: config.enabled, platform: window.platformHandler?.name });
    } else if (req.action === 'toggleEnabled') {
        config.enabled = req.enabled;
        res({ success: true });
    } else if (req.action === 'clearCache') {
        window.translationService?.clearCache();
        res({ success: true });
    }
    return true;
});

// ==================== 启动 ====================

setTimeout(init, 800);
