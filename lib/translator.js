/**
 * 翻译服务 v6.0
 * 批量翻译 + 并发请求，大幅提升速度
 */
class TranslationService {
    constructor() {
        this.cache = new Map();
        this.pendingRequests = new Map(); // 防止重复请求
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
        if (!t) return true;
        if (/^```/.test(t) || /```$/.test(t)) return true;
        if (/^`[^`]+`$/.test(t)) return true;
        if (/^\$\$/.test(t) || /\$\$$/.test(t)) return true;
        if (/^\$[^$]+\$$/.test(t)) return true;
        if (/^\\[a-z]+/i.test(t)) return true;
        if (/^https?:\/\//i.test(t)) return true;
        if (/^(import|from|export|require|def |class |function |const |let |var |if |else|elif|for |while |return |try:|except|catch|finally|public |private |void |int |string )/.test(t)) return true;
        if (/^\s*(\/\/|#|\/\*|\*|<!--|-->)/.test(t)) return true;
        if (/^[a-zA-Z_]\w*\s*=\s*.+/.test(t) && !this.containsChinese(t)) return true;
        if (/^[a-zA-Z_]\w*\s*\(/.test(t) && !this.containsChinese(t)) return true;
        if (/^[\d\s\+\-\*\/\=\.\,\;\:\(\)\[\]\{\}\<\>\&\%\#\@\$\^\~\`\\|\'\"!?]+$/.test(t)) return true;
        if (/^(\s{4}|\t)/.test(line) && !this.containsChinese(line)) return true;
        return false;
    }

    /**
     * 批量翻译（一次API请求翻译多个文本）
     */
    async translateBatch(texts, from, to) {
        if (!texts.length) return [];

        // 用特殊分隔符合并文本
        const separator = '\n§§§\n';
        const combined = texts.join(separator);

        try {
            const translated = await this.translateText(combined, from, to);
            return translated.split(separator).map(t => t.trim());
        } catch (e) {
            // 批量失败则逐个翻译
            console.warn('批量翻译失败，改用逐个翻译');
            return Promise.all(texts.map(t => this.translateText(t, from, to).catch(() => t)));
        }
    }

    /**
     * 并发翻译多个文本（速度更快）
     */
    async translateConcurrent(items, from, to, maxConcurrent = 5) {
        const results = new Array(items.length);
        let index = 0;

        const worker = async () => {
            while (index < items.length) {
                const i = index++;
                const { text, needTranslate } = items[i];

                if (!needTranslate) {
                    results[i] = { text, translated: false };
                    continue;
                }

                try {
                    const translated = await this.translateText(text, from, to);
                    results[i] = {
                        text: translated || text,
                        translated: translated && translated !== text,
                        original: text
                    };
                } catch (e) {
                    results[i] = { text, translated: false };
                }
            }
        };

        // 启动多个并发worker
        await Promise.all(Array(Math.min(maxConcurrent, items.length)).fill().map(worker));
        return results;
    }

    /**
     * 保留结构翻译（优化版：批量 + 并发）
     */
    async translateWithStructure(text, from, to) {
        const lines = text.split('\n');
        let inCodeBlock = false;

        // 第一轮：标记哪些行需要翻译
        const items = lines.map(line => {
            if (line.trim().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                return { text: line, needTranslate: false };
            }
            if (inCodeBlock || this.shouldPreserveLine(line)) {
                return { text: line, needTranslate: false };
            }
            return { text: line, needTranslate: true };
        });

        // 收集需要翻译的行
        const toTranslate = items.filter(i => i.needTranslate).map(i => i.text);

        if (toTranslate.length === 0) {
            return {
                result: text,
                hasTranslation: false,
                lines: items.map(i => ({ text: i.text, translated: false }))
            };
        }

        // 批量翻译
        let translated;
        if (toTranslate.length <= 10) {
            // 少量文本用批量翻译
            translated = await this.translateBatch(toTranslate, from, to);
        } else {
            // 大量文本用并发翻译
            const concurrentItems = toTranslate.map(text => ({ text, needTranslate: true }));
            const results = await this.translateConcurrent(concurrentItems, from, to);
            translated = results.map(r => r.text);
        }

        // 合并结果
        let translateIndex = 0;
        const results = items.map(item => {
            if (item.needTranslate) {
                const trans = translated[translateIndex++] || item.text;
                return {
                    text: trans,
                    translated: trans !== item.text,
                    original: item.text
                };
            }
            return { text: item.text, translated: false };
        });

        return {
            result: results.map(r => r.text).join('\n'),
            hasTranslation: results.some(r => r.translated),
            lines: results
        };
    }

    /**
     * 通过 background 执行单行翻译（带缓存和去重）
     */
    async translateText(text, from, to) {
        const key = `${from}:${to}:${text}`;

        // 检查缓存
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        // 检查是否有正在进行的相同请求
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key);
        }

        // 发起新请求
        const promise = new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: 'translate', text, from, to },
                (response) => {
                    this.pendingRequests.delete(key);
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (response?.success) {
                        this.cache.set(key, response.result);
                        resolve(response.result);
                    } else {
                        reject(new Error(response?.error || '翻译失败'));
                    }
                }
            );
        });

        this.pendingRequests.set(key, promise);
        return promise;
    }

    async toEnglish(text) {
        if (!this.containsChinese(text)) return text;
        return this.translateText(text, 'zh-CN', 'en');
    }

    async toChinese(text) {
        if (!text || this.isMainlyChinese(text)) return text;
        return this.translateText(text, 'en', 'zh-CN');
    }

    async translateWithDetails(text, from, to) {
        return this.translateWithStructure(text, from, to);
    }

    clearCache() { this.cache.clear(); }
    getCacheStats() { return { size: this.cache.size }; }
}

const translationService = new TranslationService();
if (typeof window !== 'undefined') {
    window.translationService = translationService;
}
