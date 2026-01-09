/**
 * Gemini 平台处理器 - 增强版
 */
const GeminiHandler = {
    name: 'Gemini',

    selectors: {
        input: [
            'rich-textarea .ql-editor[contenteditable="true"]',
            'div.ql-editor[contenteditable="true"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[contenteditable="true"][data-placeholder]',
            '.input-area div[contenteditable="true"]',
            'div[contenteditable="true"]'
        ],
        submitButton: [
            'button[aria-label*="Send"]',
            'button[aria-label*="发送"]',
            'button.send-button',
            'button[data-test-id="send-button"]'
        ],
        aiResponse: '.model-response-text, [class*="model-response"], .response-content, .markdown-content',
        conversationContainer: 'main, .conversation-container'
    },

    getInputElement() {
        for (const sel of this.selectors.input) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    },

    getInputValue() {
        const input = this.getInputElement();
        return input ? (input.textContent || '') : '';
    },

    setInputValue(value) {
        const input = this.getInputElement();
        if (!input) return false;
        input.textContent = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    },

    getSubmitButton() {
        for (const sel of this.selectors.submitButton) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    },

    getConversationContainer() {
        return document.querySelector(this.selectors.conversationContainer) || document.body;
    },

    /**
     * 获取所有AI回答元素
     */
    getResponseElements() {
        return document.querySelectorAll(this.selectors.aiResponse);
    },

    getResponseText(element) {
        if (!element) return '';
        const clone = element.cloneNode(true);
        clone.querySelectorAll('.bilingual-assistant-wrapper').forEach(el => el.remove());
        return clone.textContent || '';
    },

    insertBilingualDisplay(responseElement, originalText, translatedText) {
        if (!responseElement || !responseElement.parentElement) return;

        const existing = responseElement.parentElement.querySelector('.bilingual-assistant-wrapper');
        if (existing) existing.remove();

        const wrapper = document.createElement('div');
        wrapper.className = 'bilingual-assistant-wrapper';
        wrapper.innerHTML = `
            <div class="bilingual-assistant-content">
                <div class="chinese-translation">
                    <div class="translation-header"><span>🇨🇳</span> 中文翻译</div>
                    <div class="translation-text">${this.escapeHtml(translatedText)}</div>
                </div>
                <button class="toggle-original-btn">📖 查看英文原文</button>
                <div class="english-original" style="display:none;">
                    <div class="translation-header"><span>🌐</span> English Original</div>
                    <div class="translation-text">${this.escapeHtml(originalText)}</div>
                </div>
            </div>
        `;

        wrapper.querySelector('.toggle-original-btn').addEventListener('click', function () {
            const eng = wrapper.querySelector('.english-original');
            eng.style.display = eng.style.display === 'none' ? 'block' : 'none';
            this.textContent = eng.style.display === 'none' ? '📖 查看英文原文' : '📖 隐藏英文原文';
        });

        responseElement.parentElement.insertBefore(wrapper, responseElement.nextSibling);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    init(callback) {
        const container = this.getConversationContainer();
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        node.querySelectorAll?.(this.selectors.aiResponse)?.forEach(el => callback(el));
                    }
                }
            }
        });
        observer.observe(container, { childList: true, subtree: true });
    }
};

if (typeof window !== 'undefined') {
    window.platformHandler = GeminiHandler;
}
