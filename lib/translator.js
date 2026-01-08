/**
 * 翻译服务 v5.0
 * 保留结构翻译：逐行分析，只翻译正文，保持换行格式
 */
class TranslationService {
    constructor() {
        this.cache = new Map();
    }

    containsChinese(text) {
        return /[\u4e00-\u9fa5]/.test(text);
    }

    isMainlyChinese(text) {
        const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        return cn / text.length > 0.3;
    }

    /**
     * 检测一行是否应该保留不翻译
     */
    shouldPreserveLine(line) {
        const t = line.trim();
        if (!t) return true; // 空行保留

        // 代码块标记
        if (/^```/.test(t) || /```$/.test(t)) return true;

        // 行内代码（整行都是代码）
        if (/^`[^`]+`$/.test(t)) return true;

        // LaTeX 公式
        if (/^\$\$/.test(t) || /\$\$$/.test(t)) return true;
        if (/^\$[^$]+\$$/.test(t)) return true;
        if (/^\\[a-z]+/i.test(t)) return true;

        // URL
        if (/^https?:\/\//i.test(t)) return true;

        // 代码特征
        if (/^(import|from|export|require|def |class |function |const |let |var |if |else|elif|for |while |return |try:|except|catch|finally|public |private |void |int |string )/.test(t)) return true;

        // 注释
        if (/^\s*(\/\/|#|\/\*|\*|<!--|-->)/.test(t)) return true;

        // 赋值语句
        if (/^[a-zA-Z_]\w*\s*=\s*.+/.test(t) && !this.containsChinese(t)) return true;

        // 函数调用（无中文）
        if (/^[a-zA-Z_]\w*\s*\(/.test(t) && !this.containsChinese(t)) return true;

        // 纯符号/数字行
        if (/^[\d\s\+\-\*\/\=\.\,\;\:\(\)\[\]\{\}\<\>\&\%\#\@\$\^\~\`\\|\'\"!?]+$/.test(t)) return true;

        // 缩进的代码行（4空格或tab开头，无中文）
        if (/^(\s{4}|\t)/.test(line) && !this.containsChinese(line)) return true;

        return false;
    }

    /**
     * 保留结构翻译：逐行处理
     * 返回: { result: string, hasTranslation: boolean, lines: [{text, translated, original?}] }
     */
    async translateWithStructure(text, from, to) {
        const lines = text.split('\n');
        const results = [];
        let hasTranslation = false;
        let inCodeBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 检测代码块开始/结束
            if (line.trim().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                results.push({ text: line, translated: false });
                continue;
            }

            // 在代码块内，保留原样
            if (inCodeBlock) {
                results.push({ text: line, translated: false });
                continue;
            }

            // 检查该行是否应该保留
            if (this.shouldPreserveLine(line)) {
                results.push({ text: line, translated: false });
                continue;
            }

            // 需要翻译的行
            try {
                const translated = await this.translateText(line, from, to);
                if (translated && translated !== line) {
                    results.push({
                        text: translated,
                        translated: true,
                        original: line
                    });
                    hasTranslation = true;
                } else {
                    results.push({ text: line, translated: false });
                }
            } catch (e) {
                results.push({ text: line, translated: false });
            }
        }

        // 重建文本，保持换行
        const resultText = results.map(r => r.text).join('\n');

        return {
            result: resultText,
            hasTranslation,
            lines: results
        };
    }

    /**
     * 通过 background 执行单行翻译
     */
    async translateText(text, from, to) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: 'translate', text, from, to },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (response?.success) {
                        resolve(response.result);
                    } else {
                        reject(new Error(response?.error || '翻译失败'));
                    }
                }
            );
        });
    }

    /**
     * 中文转英文（保留结构）
     */
    async toEnglish(text) {
        if (!this.containsChinese(text)) return text;

        const key = `zh2en:${text}`;
        if (this.cache.has(key)) return this.cache.get(key);

        try {
            const result = await this.translateWithStructure(text, 'zh-CN', 'en');
            this.cache.set(key, result.result);
            return result.result;
        } catch (e) {
            console.error('翻译失败:', e);
            return text;
        }
    }

    /**
     * 英文转中文（保留结构）
     */
    async toChinese(text) {
        if (!text || this.isMainlyChinese(text)) return text;

        const key = `en2zh:${text}`;
        if (this.cache.has(key)) return this.cache.get(key);

        try {
            const result = await this.translateWithStructure(text, 'en', 'zh-CN');
            this.cache.set(key, result.result);
            return result.result;
        } catch (e) {
            console.error('翻译失败:', e);
            return text;
        }
    }

    /**
     * 带详细信息的翻译（用于高亮显示）
     */
    async translateWithDetails(text, from, to) {
        return await this.translateWithStructure(text, from, to);
    }

    clearCache() { this.cache.clear(); }
    getCacheStats() { return { size: this.cache.size }; }
}

const translationService = new TranslationService();
if (typeof window !== 'undefined') {
    window.translationService = translationService;
}
