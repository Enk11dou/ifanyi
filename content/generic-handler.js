/**
 * 通用网站处理器
 * 适用于所有非AI专用平台的网站
 */
const GenericHandler = {
    name: '通用',

    selectors: {
        // 通用输入框选择器
        input: [
            'textarea',
            'input[type="text"]',
            '[contenteditable="true"]'
        ],
        // 通用内容选择器
        content: [
            'article',
            'main',
            '.content',
            '.post',
            '.article',
            '#content',
            '#main'
        ]
    },

    getInputElement() {
        // 获取当前聚焦的输入元素
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' ||
            active.tagName === 'INPUT' ||
            active.contentEditable === 'true')) {
            return active;
        }

        for (const sel of this.selectors.input) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    },

    getInputValue() {
        const input = this.getInputElement();
        if (!input) return '';

        if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
            return input.value || '';
        }
        return input.textContent || '';
    },

    setInputValue(value) {
        const input = this.getInputElement();
        if (!input) return false;

        if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            input.textContent = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return true;
    },

    getSubmitButton() {
        return null; // 通用模式不自动提交
    },

    getConversationContainer() {
        return document.body;
    },

    /**
     * 获取页面主要内容区域
     */
    getResponseElements() {
        // 尝试找到主要内容区域
        for (const sel of this.selectors.content) {
            const els = document.querySelectorAll(sel);
            if (els.length > 0) return els;
        }
        // 如果找不到，返回body作为fallback
        return [document.body];
    },

    getResponseText(element) {
        return element?.textContent || '';
    },

    insertBilingualDisplay() {
        // 通用模式不使用双语显示
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    init() {
        // 通用模式不需要observer
    }
};

if (typeof window !== 'undefined') {
    window.platformHandler = GenericHandler;
}
