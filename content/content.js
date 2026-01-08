/**
 * AI 双语助手 v5.0
 * 保留结构翻译：代码块保留，正文翻译，换行保持
 */
console.log('🚀 AI 双语助手 v5.0');

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

    console.log('🎉 初始化完成!');
}

async function loadConfig() {
    try {
        const result = await chrome.storage.sync.get(['enabled', 'autoTranslateInput']);
        Object.assign(config, result);
    } catch (e) { }
}

// ==================== UI ====================

function createUI() {
    // 悬浮按钮
    const toggle = document.createElement('div');
    toggle.id = 'bilingual-toggle-btn';
    toggle.innerHTML = '🌐';
    toggle.className = 'hidden';

    let dragging = false, moved = false, sx, sy, ix, iy;
    toggle.addEventListener('mousedown', e => {
        dragging = true; moved = false;
        sx = e.clientX; sy = e.clientY;
        const r = toggle.getBoundingClientRect();
        ix = r.left; iy = r.top;
    });
    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        if (Math.abs(e.clientX - sx) > 3 || Math.abs(e.clientY - sy) > 3) moved = true;
        toggle.style.left = (ix + e.clientX - sx) + 'px';
        toggle.style.top = (iy + e.clientY - sy) + 'px';
        toggle.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            if (!moved) showWindow();
        }
    });
    document.body.appendChild(toggle);
    floatingToggle = toggle;

    // 悬浮窗口
    const win = document.createElement('div');
    win.id = 'bilingual-floating-window';
    win.innerHTML = `
        <div class="fl-header">
            <span>🌐 双语助手</span>
            <span class="fl-platform">${window.platformHandler?.name || ''}</span>
            <button class="fl-min">−</button>
        </div>
        <div class="fl-body">
            <div class="fl-status"><span class="fl-dot"></span><span id="flStatus">就绪</span></div>
            <div class="fl-section">
                <div class="fl-label">输入预览</div>
                <div id="flInput" class="fl-input">等待输入...</div>
            </div>
            <div class="fl-section" id="flTransSection" style="display:none;">
                <div class="fl-label">翻译结果</div>
                <div id="flTranslation" class="fl-translation"></div>
                <div class="fl-actions">
                    <button class="fl-use" id="flUse">✓ 使用</button>
                    <button class="fl-cancel" id="flCancel">✕</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(win);
    floatingWindow = win;

    win.querySelector('.fl-min').addEventListener('click', hideWindow);
    win.querySelector('#flUse').addEventListener('click', useTranslation);
    win.querySelector('#flCancel').addEventListener('click', hideTranslation);

    // 整个窗口可拖动（除了resize角）
    let winDrag = false, wsx, wsy, wix, wiy;

    win.addEventListener('mousedown', e => {
        // 不在右下角20px区域（resize区域）
        const rect = win.getBoundingClientRect();
        const inResizeZone = (e.clientX > rect.right - 20) && (e.clientY > rect.bottom - 20);

        if (inResizeZone) return; // 让CSS resize处理
        if (e.target.tagName === 'BUTTON') return;
        if (e.target.closest('.fl-input, .fl-translation')) return; // 允许选择文字

        winDrag = true;
        wsx = e.clientX; wsy = e.clientY;
        wix = rect.left; wiy = rect.top;
        win.style.cursor = 'move';
    });

    document.addEventListener('mousemove', e => {
        if (!winDrag) return;
        win.style.left = (wix + e.clientX - wsx) + 'px';
        win.style.top = (wiy + e.clientY - wsy) + 'px';
        win.style.right = 'auto';
        win.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        winDrag = false;
        if (floatingWindow) floatingWindow.style.cursor = '';
    });
}

function showWindow() {
    floatingWindow?.classList.remove('hidden');
    floatingToggle?.classList.add('hidden');
}

function hideWindow() {
    floatingWindow?.classList.add('hidden');
    floatingToggle?.classList.remove('hidden');
}

// ==================== 输入翻译 ====================

function initInputListener() {
    let lastValue = '';

    setInterval(() => {
        if (!config.enabled) return;
        const handler = window.platformHandler;
        if (!handler) return;

        const value = handler.getInputValue();
        if (value === lastValue) return;
        lastValue = value;

        updateInputDisplay(value);

        if (value && value.trim().length >= config.minTextLength &&
            window.translationService.containsChinese(value)) {
            clearTimeout(inputDebounceTimer);
            inputDebounceTimer = setTimeout(() => translateInput(value), 1000);
        }
    }, 300);
}

function updateInputDisplay(text) {
    if (!floatingWindow || floatingWindow.classList.contains('hidden')) return;

    const input = floatingWindow.querySelector('#flInput');
    const status = floatingWindow.querySelector('#flStatus');

    if (!text?.trim()) {
        input.textContent = '等待输入...';
        input.className = 'fl-input';
        status.textContent = '就绪';
        return;
    }

    input.textContent = text.length > 100 ? text.slice(0, 100) + '...' : text;
    input.className = 'fl-input has-content';

    if (window.translationService.containsChinese(text)) {
        input.classList.add('has-chinese');
        status.textContent = '检测到中文';
    }
}

async function translateInput(text) {
    if (!floatingWindow) return;

    const status = floatingWindow.querySelector('#flStatus');
    const transSection = floatingWindow.querySelector('#flTransSection');
    const transDiv = floatingWindow.querySelector('#flTranslation');

    status.textContent = '翻译中...';

    try {
        // 使用保留结构的翻译
        const result = await window.translationService.translateWithDetails(text, 'zh-CN', 'en');

        if (result.hasTranslation) {
            // 构建带高亮的HTML（保留换行）
            let html = '';
            for (const line of result.lines) {
                const escaped = escapeHtml(line.text);
                if (line.translated) {
                    html += `<div class="line-trans">${escaped}</div>`;
                } else {
                    html += `<div class="line-keep">${escaped || '&nbsp;'}</div>`;
                }
            }

            transDiv.innerHTML = html;
            transSection.style.display = 'block';
            status.textContent = '✅ 完成';
            floatingWindow._translated = result.result;
        } else {
            status.textContent = '无需翻译';
        }
    } catch (e) {
        console.error('翻译失败:', e);
        status.textContent = '❌ 失败';
    }
}

function useTranslation() {
    if (!floatingWindow?._translated) return;
    window.platformHandler?.setInputValue(floatingWindow._translated);
    hideTranslation();
}

function hideTranslation() {
    if (!floatingWindow) return;
    floatingWindow.querySelector('#flTransSection').style.display = 'none';
    floatingWindow._translated = null;
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
