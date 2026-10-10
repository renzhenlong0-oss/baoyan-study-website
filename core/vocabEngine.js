/* ============================================================
 * core/vocabEngine.js —— 个人英语词汇中心引擎（v5，纯逻辑，无 DOM）
 *
 * 词条结构（data.vocabCenter.words[]，见 data/vocabDefaults.js newVocabWord）：
 *   id / word / normalizedWord / phonetic / partOfSpeech /
 *   definitions[{text, aiGenerated}] / englishDefinition / exampleSentence /
 *   collocations[] / sourceType / sourceTitle / sourceExcerpt /
 *   examTags[] / domainTags[] / difficulty /
 *   basicMastery{level, updatedAt} —— 基础词义掌握（0-4）
 *   contexts[{library, sense, mastery{level, updatedAt}, addedAt}] ——
 *     专业语境词义【分别追踪】：新语境不从基础词义继承掌握度
 *   status(new|learning|mastered) / errorCount / correctCount /
 *   createdAt / lastReviewedAt / notes / aiGenerated{definitions, example, collocations}
 *
 * 分工原则：外部背词软件（墨墨等）负责通用词间隔复习；
 * 本引擎负责专业词库、语境学习、统计、导入导出。
 * AI 内容只辅助，aiGenerated 标记 + 用户确认后才入库。
 * ============================================================ */

const VocabEngine = {

  /* ---------------- 词形规范化与查重 ---------------- */

  /* 规范化：去首尾空格 + 小写（查重忽略大小写/首尾空格；
   * 短语保留内部空格——"take over" 与 "takeover" 是不同词条） */
  normalizeWord: function (w) {
    return String(w == null ? '' : w).trim().toLowerCase().replace(/\s+/g, ' ');
  },

  /* 词条在指定词库中的语境条目 */
  contextOf: function (word, library) {
    return (word.contexts || []).find(function (c) { return c.library === library; }) || null;
  },

  /* 查重键 = 规范化词形 + 词库（同一词在不同词库 = 不同语境，可分别追踪） */
  dedupKey: function (normalized, library) {
    return normalized + '||' + library;
  },

  /* 按词形+词库查找词条；library 为空时只按词形查（返回第一个） */
  findWord: function (normalized, library) {
    var words = this.words();
    if (library) return words.find(function (w) {
      return w.normalizedWord === normalized && VocabEngine.contextOf(w, library);
    }) || null;
    return words.find(function (w) { return w.normalizedWord === normalized; }) || null;
  },

  words: function () {
    return (state.data.vocabCenter && state.data.vocabCenter.words) || [];
  },

  /* 规范化一个词条（旧数据/导入数据可能缺 normalizedWord） */
  ensureNormalized: function (word) {
    if (!word.normalizedWord) word.normalizedWord = this.normalizeWord(word.word);
    return word;
  },

  /* ---------------- 新增 / 更新 ---------------- */

  /* 新增词条：返回 { ok, word, duplicate, error }
   *   duplicate=true 表示同词同词库已存在（不覆盖，由调用方决定合并）；
   *   同词不同词库 → 给已有词条追加一个 context（不重复建词条）。 */
  addWord: function (seed, opts) {
    opts = opts || {};
    var w = seed.id ? seed : newVocabWord(seed);
    w = this.ensureNormalized(w);
    var nw = w.normalizedWord;
    if (!nw || nw.length > VOCAB_LIMITS.word) {
      return { ok: false, error: '词形为空或超过 ' + VOCAB_LIMITS.word + ' 字符' };
    }

    var vc = state.data.vocabCenter;
    if (vc.words.length >= VOCAB_LIMITS.maxWords) {
      return { ok: false, error: '词库已达上限 ' + VOCAB_LIMITS.maxWords + ' 条，请先导出归档后清理' };
    }

    /* 新词的语境归属：seed.library 或 seed.contexts */
    var targetLibs = [];
    if (w.contexts.length) {
      targetLibs = w.contexts.map(function (c) { return c.library; });
    } else if (seed.library) {
      targetLibs = [seed.library];
    }

    /* 同词条（同词形）已存在：按词库合并语境，不建重复词条 */
    var existing = this.findWord(nw);
    var dupLibs = [];
    var newLibs = [];
    if (existing && !opts.forceDuplicate) {
      targetLibs.forEach(function (lib) {
        if (VocabEngine.contextOf(existing, lib)) dupLibs.push(lib);
        else newLibs.push(lib);
      });
      /* 全部词库都已存在 → 纯重复 */
      if (targetLibs.length && newLibs.length === 0) {
        return { ok: true, word: existing, duplicate: true };
      }
      /* 部分新词库 → 在已有词条上追加语境（同一单词不同词义可分别追踪；
         已有语境原样保留，绝不覆盖） */
      newLibs.forEach(function (lib) {
        existing.contexts.push({
          library: lib,
          sense: String(seed.sense || ''),
          mastery: { level: 0, updatedAt: null },
          addedAt: new Date().toISOString()
        });
      });
      /* 合并时补充空的基础字段（不覆盖已有内容） */
      this._fillEmptyFields(existing, w);
      saveData();
      return { ok: true, word: existing, duplicate: dupLibs.length > 0, mergedContexts: newLibs };
    }

    /* seed.library 形式的导入/录入 → 生成对应语境条目（专业词义追踪起点） */
    if (!w.contexts.length && targetLibs.length) {
      w.contexts = targetLibs.map(function (lib) {
        return {
          library: lib,
          sense: String(seed.sense || ''),
          mastery: { level: 0, updatedAt: null },
          addedAt: new Date().toISOString()
        };
      });
    }

    vc.words.push(w);
    saveData();
    return { ok: true, word: w, duplicate: false };
  },

  /* 合并词条时只补空字段，绝不覆盖用户已有内容（防外部数据覆盖） */
  _fillEmptyFields: function (target, source) {
    ['phonetic', 'partOfSpeech', 'englishDefinition', 'exampleSentence',
     'sourceTitle', 'sourceExcerpt', 'notes'].forEach(function (k) {
      if (!target[k] && source[k]) target[k] = source[k];
    });
    if (!target.definitions.length && source.definitions.length) {
      target.definitions = source.definitions;
      target.aiGenerated.definitions = source.aiGenerated.definitions;
    }
    ['examTags', 'domainTags', 'collocations'].forEach(function (k) {
      source[k].forEach(function (v) { if (target[k].indexOf(v) === -1) target[k].push(v); });
    });
  },

  /* 删除词条 */
  deleteWord: function (id) {
    var vc = state.data.vocabCenter;
    var before = vc.words.length;
    vc.words = vc.words.filter(function (w) { return w.id !== id; });
    if (vc.words.length !== before) { saveData(); return true; }
    return false;
  },

  /* 更新词条（整体替换字段；返回 false 未找到） */
  updateWord: function (id, patch) {
    var w = this.words().find(function (x) { return x.id === id; });
    if (!w) return false;
    for (var k in patch) w[k] = patch[k];
    this.ensureNormalized(w);
    saveData();
    return true;
  },

  /* ---------------- 筛选 ---------------- */

  /* opts: { library, examTag, domainTag, status, sourceType, search, sort }
   * 返回新数组，不修改原数据 */
  listWords: function (opts) {
    opts = opts || {};
    var q = (opts.search || '').trim().toLowerCase();
    var out = this.words().filter(function (w) {
      if (opts.library && !VocabEngine.contextOf(w, opts.library)) return false;
      if (opts.examTag && w.examTags.indexOf(opts.examTag) === -1) return false;
      if (opts.domainTag && w.domainTags.indexOf(opts.domainTag) === -1) return false;
      if (opts.status && w.status !== opts.status) return false;
      if (opts.sourceType && w.sourceType !== opts.sourceType) return false;
      if (q && w.normalizedWord.indexOf(q) === -1 &&
          w.definitions.join(' ').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    if (opts.sort === 'word') {
      out.sort(function (a, b) { return a.normalizedWord < b.normalizedWord ? -1 : 1; });
    } else {
      out.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    }
    return out;
  },

  /* ---------------- 复习调度与练习记录 ---------------- */

  /* 是否到期应复习：status 决定间隔（new=当天，learning=1天，mastered=3天） */
  isDue: function (word, dateStr) {
    if (!word.lastReviewedAt) return true;   // 从未复习过 = 待复习
    var interval = VOCAB_REVIEW_INTERVALS[word.status] != null ? VOCAB_REVIEW_INTERVALS[word.status] : 1;
    return diffDays(dateStr || todayStr(), word.lastReviewedAt.slice(0, 10)) >= interval;
  },

  /* 复习积压：到期未复习的词条 */
  dueWords: function (opts) {
    opts = opts || {};
    var d = opts.dateStr || todayStr();
    return this.words().filter(function (w) {
      if (opts.library && !VocabEngine.contextOf(w, opts.library)) return false;
      return VocabEngine.isDue(w, d);
    });
  },

  /* 错词：错误次数多于正确次数 */
  wrongWords: function (opts) {
    opts = opts || {};
    return this.words().filter(function (w) {
      if (opts.library && !VocabEngine.contextOf(w, opts.library)) return false;
      return w.errorCount > w.correctCount;
    });
  },

  /* 记录一次复习结果。
   * opts: { library, correct, mode }
   *  - 指定词库：更新该词库语境的 mastery（专业语境分别追踪，
   *    基础词义已掌握不会让新语境自动变掌握）
   *  - 未指定：更新基础 mastery（基础词义复习，如墨墨同步后的确认复习）
   * 正确：correctCount+1、掌握度+1（≤4）；错误：errorCount+1、掌握度-1（≥0）
   * status 依据基础掌握度：≥3 → mastered；≥1 → learning；否则 new */
  recordReview: function (wordId, opts) {
    opts = opts || {};
    var w = this.words().find(function (x) { return x.id === wordId; });
    if (!w) return { ok: false, error: '词条不存在' };

    var correct = !!opts.correct;
    var now = new Date().toISOString();
    if (correct) {
      w.correctCount++;
      if (opts.library) {
        var ctx = this.contextOf(w, opts.library);
        if (ctx) ctx.mastery.level = Math.min(4, ctx.mastery.level + 1), ctx.mastery.updatedAt = now;
      } else {
        w.basicMastery.level = Math.min(4, w.basicMastery.level + 1);
        w.basicMastery.updatedAt = now;
      }
    } else {
      w.errorCount++;
      if (opts.library) {
        var ctxE = this.contextOf(w, opts.library);
        if (ctxE) ctxE.mastery.level = Math.max(0, ctxE.mastery.level - 1), ctxE.mastery.updatedAt = now;
      } else {
        w.basicMastery.level = Math.max(0, w.basicMastery.level - 1);
        w.basicMastery.updatedAt = now;
      }
    }
    w.status = w.basicMastery.level >= 3 ? 'mastered'
      : (w.basicMastery.level >= 1 ? 'learning' : 'new');
    w.lastReviewedAt = now;
    saveData();
    return { ok: true, word: w };
  },

  /* 记一次练习会话到每日日志（时间预算联动） */
  logSession: function (dateStr, patch) {
    var vc = state.data.vocabCenter;
    var log = vc.dailyLog[dateStr] || { minutes: 0, newWords: 0, reviewedWords: 0, errors: 0 };
    for (var k in patch) log[k] = Number(patch[k]) || 0;
    vc.dailyLog[dateStr] = log;
    saveData();
    return log;
  },

  getDailyLog: function (dateStr) {
    var vc = state.data.vocabCenter;
    return vc.dailyLog[dateStr] || { minutes: 0, newWords: 0, reviewedWords: 0, errors: 0 };
  },

  /* ---------------- 每日学习计划（时间预算 20–25 分钟联动） ---------------- */

  /* 本周（dateStr 所在周）已新增词数 */
  addedThisWeek: function (dateStr, library) {
    var d = dateStr || todayStr();
    var weekStart = parseDate(d);
    weekStart.setDate(weekStart.getDate() - (weekdayOf(d) - 1));
    var ws = fmtISODate(weekStart);
    return this.words().filter(function (w) {
      var cd = String(w.createdAt || '').slice(0, 10);
      if (cd < ws) return false;
      if (library && !VocabEngine.contextOf(w, library)) return false;
      return true;
    }).length;
  },

  /* 每日词汇计划：
   *  - 复习估算 0.5 分钟/词，新词 1 分钟/词
   *  - 每周新增目标按天折算，扣掉本周已新增的量
   *  - 积压多时优先复习：超过 backlogReduceAt 新词减半，超过 backlogPauseAt 暂停新增
   *  - 总时长不超过每日预算上限（20–25 分钟，可改）
   * 返回 { due, baseNew, adjustedNew, minutes, budgetMin, budgetMax, backlogPaused, backlogReduced, byLibrary } */
  computeDailyPlan: function (dateStr) {
    var d = dateStr || todayStr();
    var s = state.data.vocabCenter.settings;
    var due = this.dueWords({ dateStr: d });
    var plan = {
      date: d,
      dueCount: due.length,
      dueMinutes: Math.round(due.length * 0.5 * 10) / 10,
      budgetMin: s.dailyBudget.min,
      budgetMax: s.dailyBudget.max,
      backlogPaused: false,
      backlogReduced: false,
      byLibrary: {}
    };

    if (s.reviewFirst) {
      if (due.length >= s.backlogPauseAt) plan.backlogPaused = true;
      else if (due.length >= s.backlogReduceAt) plan.backlogReduced = true;
    }

    /* 各词库每日新增目标 = 周目标 / 7（按本周剩余量收敛），积压时减半/暂停 */
    var totalNew = 0;
    VOCAB_LIBRARIES.forEach(function (lib) {
      var cfg = s.libraries[lib.key] || {};
      var weekly = Number(cfg.weeklyNew) || 0;
      var added = VocabEngine.addedThisWeek(d, lib.key);
      var remaining = Math.max(0, weekly - added);
      var base = Math.min(Math.ceil(weekly / 7), remaining);
      var adj = plan.backlogPaused ? 0 : (plan.backlogReduced ? Math.floor(base / 2) : base);
      plan.byLibrary[lib.key] = { baseNew: base, adjustedNew: adj, addedThisWeek: added, weeklyNew: weekly };
      totalNew += adj;
    });

    /* 时间预算封顶：新词按需削减到预算上限内 */
    var availNewMin = Math.max(0, plan.budgetMax - plan.dueMinutes);
    var trimmedNew = Math.max(0, Math.min(totalNew, Math.floor(availNewMin)));
    plan.newWords = trimmedNew;
    plan.newMinutes = trimmedNew;
    plan.minutes = Math.round((plan.dueMinutes + plan.newMinutes) * 10) / 10;
    /* 新词削减后按比例分配到词库（保持配置比例） */
    if (totalNew > trimmedNew && totalNew > 0) {
      VOCAB_LIBRARIES.forEach(function (lib) {
        plan.byLibrary[lib.key].adjustedNew = Math.floor(plan.byLibrary[lib.key].adjustedNew * trimmedNew / totalNew);
      });
    }
    return plan;
  },

  /* ---------------- 学习统计 ---------------- */

  /* 返回 { total, byLibrary, backlog, activity } */
  computeStats: function () {
    var words = this.words();
    var byLibrary = {};
    VOCAB_LIBRARIES.forEach(function (l) { byLibrary[l.key] = emptyLibStats(l.key); });

    var backlog = 0, errSum = 0, corrSum = 0;
    words.forEach(function (w) {
      var errRate = (w.errorCount + w.correctCount) ? w.errorCount / (w.errorCount + w.correctCount) : 0;
      if (VocabEngine.isDue(w, todayStr())) backlog++;
      (w.contexts || []).forEach(function (ctx) {
        if (!byLibrary[ctx.library]) byLibrary[ctx.library] = emptyLibStats(ctx.library);
        var st = byLibrary[ctx.library];
        st.total++;
        if (w.status === 'mastered') st.mastered++;
        else if (w.status === 'learning') st.learning++;
        else st.newCount++;
        st.basicMasterySum += w.basicMastery.level;
        st.ctxMasterySum += ctx.mastery.level;
        st.errRateSum += errRate;
        if (VocabEngine.isDue(w, todayStr())) st.due++;
        /* 语境词义未掌握但基础已掌握 → 语境弱项（专业语境新词义待学） */
        if (w.basicMastery.level >= 3 && ctx.mastery.level < 3) st.contextWeak++;
      });
      if (!w.contexts.length) {
        var st0 = byLibrary.general_advanced || emptyLibStats('general_advanced');
        st0.total++; st0.basicMasterySum += w.basicMastery.level; st0.errRateSum += errRate;
        if (VocabEngine.isDue(w, todayStr())) st0.due++;
        byLibrary.general_advanced = st0;
      }
    });

    var weekStart = parseDate(todayStr());
    weekStart.setDate(weekStart.getDate() - 6);
    var ws = fmtISODate(weekStart);
    var added7 = words.filter(function (w) { return String(w.createdAt || '').slice(0, 10) >= ws; }).length;

    var vc = state.data.vocabCenter;
    var minutes7 = 0, reviewed7 = 0;
    for (var i = 0; i < 7; i++) {
      var dd = parseDate(todayStr()); dd.setDate(dd.getDate() - i);
      var log = vc.dailyLog[fmtISODate(dd)];
      if (log) { minutes7 += Number(log.minutes || 0); reviewed7 += Number(log.reviewedWords || 0); }
    }

    Object.keys(byLibrary).forEach(function (k) {
      var st = byLibrary[k];
      st.basicMasteryAvg = st.total ? Math.round(st.basicMasterySum / st.total * 10) / 10 : 0;
      st.ctxMasteryAvg = st.total ? Math.round(st.ctxMasterySum / st.total * 10) / 10 : 0;
      st.errorRate = st.total ? Math.round(st.errRateSum / st.total * 1000) / 1000 : 0;
      delete st.basicMasterySum; delete st.ctxMasterySum; delete st.errRateSum;
    });

    return {
      total: words.length,
      byLibrary: byLibrary,
      backlog: backlog,
      activity: { added7d: added7, reviewed7d: reviewed7, minutes7d: Math.round(minutes7) },
      settings: state.data.vocabCenter.settings
    };
  },

  /* ---------------- CSV / JSON 导入 ---------------- */

  /* 标准 CSV 列（导出与导入共用；library 列为词库 key，可空=通用进阶） */
  csvColumns: function () {
    return ['word', 'library', 'phonetic', 'partOfSpeech', 'definitions', 'englishDefinition',
      'exampleSentence', 'collocations', 'sourceType', 'sourceTitle', 'sourceExcerpt',
      'examTags', 'domainTags', 'difficulty', 'basicMastery', 'notes'];
  },

  /* RFC4180 简易解析：引号转义/内嵌逗号与换行 */
  parseCsv: function (text) {
    var rows = [];
    var row = [], field = '', inQ = false;
    var s = String(text || '').replace(/^﻿/, '');   // 去 BOM
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (inQ) {
        if (ch === '"') {
          if (s[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += ch;
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else field += ch;
    }
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  },

  /* CSV 转义 */
  csvEscape: function (v) {
    var s = String(v == null ? '' : v);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  },

  /* CSV 行 → 词条种子（按表头映射，表头不区分大小写；
   * 支持简易格式：word,definitions 两列，以及 Anki Front/Back/Tags、墨墨 word/definition） */
  _rowToSeed: function (headers, row) {
    var seed = { definitions: [], examTags: [], domainTags: [], collocations: [] };
    headers.forEach(function (h, idx) {
      h = String(h || '').trim().toLowerCase();
      var v = (row[idx] != null ? String(row[idx]) : '').trim();
      if (!v) return;
      if (h === 'word' || h === 'front') seed.word = v;
      else if (h === 'library') seed.library = v;
      else if (h === 'phonetic') seed.phonetic = v;
      else if (h === 'partofspeech' || h === 'part_of_speech') seed.partOfSpeech = v;
      else if (h === 'definitions') seed.definitions = v.split(';').map(function (x) { return x.trim(); }).filter(Boolean);
      else if (h === 'definition' || h === 'back') seed.definitions = [v];
      else if (h === 'tags') seed.domainTags = v.split(/[\s,]+/).map(function (x) { return x.trim(); }).filter(Boolean);
      else if (h === 'englishDefinition') seed.englishDefinition = v;
      else if (h === 'exampleSentence') seed.exampleSentence = v;
      else if (h === 'collocations') seed.collocations = v.split('|').map(function (x) { return x.trim(); }).filter(Boolean);
      else if (h === 'sourcetype') seed.sourceType = v;
      else if (h === 'sourcetitle') seed.sourceTitle = v;
      else if (h === 'sourceexcerpt') seed.sourceExcerpt = v;
      else if (h === 'examtags') seed.examTags = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      else if (h === 'domaintags') seed.domainTags = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      else if (h === 'difficulty') seed.difficulty = Number(v) || 3;
      else if (h === 'basicmastery') seed.basicMastery = Number(v) || 0;
      else if (h === 'notes') seed.notes = v;
    });
    return seed;
  },

  /* 解析导入内容：{ ok, items, errors }
   * 每项 { seed, status: 'new'|'duplicate'|'error', reasons[] }
   * 查重规则：规范化词形（忽略大小写/首尾空格）+ 词库；
   * 同一文件内重复行也标记为 duplicate。
   * 解析阶段不写入任何数据（先预览，用户确认后才 applyImport）。 */
  previewImport: function (rawRows) {
    var items = [];
    var seenInBatch = {};
    rawRows.forEach(function (seed) {
      var nw = VocabEngine.normalizeWord(seed.word);
      var lib = seed.library || 'general_advanced';
      var reasons = [];
      if (!nw) reasons.push('缺少单词');
      if (VOCAB_LIBRARY_KEYS.indexOf(lib) === -1) reasons.push('未知词库 "' + lib + '"（可用：' + VOCAB_LIBRARY_KEYS.join('/') + '）');
      if (reasons.length) { items.push({ seed: seed, status: 'error', reasons: reasons }); return; }
      seed.library = lib;
      var key = VocabEngine.dedupKey(nw, lib);
      var exist = VocabEngine.findWord(nw, lib);
      if (!exist && seenInBatch[key]) exist = { word: nw };   // 文件内重复行
      if (!exist) seenInBatch[key] = true;
      items.push({
        seed: seed,
        status: exist ? 'duplicate' : 'new',
        reasons: exist ? ['重复：' + nw + '（本文件或词库中已存在）'] : []
      });
    });
    var counts = { new: 0, duplicate: 0, error: 0 };
    items.forEach(function (it) { counts[it.status]++; });
    return { ok: true, items: items, counts: counts };
  },

  /* 解析 CSV 文本为行（含表头映射与基本校验） */
  parseImportCsv: function (text) {
    var rows = this.parseCsv(text);
    if (!rows.length) return { ok: false, error: '文件为空' };
    var header = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
    if (header.indexOf('word') === -1 && header.indexOf('front') === -1) {
      return { ok: false, error: '缺少 word 列（表头示例：word,library,definitions,...）' };
    }
    /* 跳过全空行；有内容但缺 word 的行保留 → 预览标记为错误（给用户明确提示） */
    var seeds = rows.slice(1)
      .filter(function (r) { return r.some(function (cell) { return String(cell).trim() !== ''; }); })
      .map(function (r) { return VocabEngine._rowToSeed(header, r); });
    return this.previewImport(seeds);
  },

  /* 解析 JSON 文本（支持本引擎导出的 {words:[...]} 或裸数组） */
  parseImportJson: function (text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) {
      return { ok: false, error: 'JSON 解析失败：' + e.message };
    }
    var arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.words) ? obj.words : null);
    if (!arr) return { ok: false, error: 'JSON 中未找到词条数组（words）' };
    var seeds = arr.filter(function (w) { return w && typeof w === 'object'; }).map(function (w) {
      return {
        word: w.word, library: w.library || (w.contexts && w.contexts[0] && w.contexts[0].library),
        phonetic: w.phonetic, partOfSpeech: w.partOfSpeech,
        definitions: (w.definitions || []).map(function (d) { return typeof d === 'string' ? d : d.text; }),
        englishDefinition: w.englishDefinition, exampleSentence: w.exampleSentence,
        collocations: w.collocations || [], sourceType: w.sourceType,
        sourceTitle: w.sourceTitle, sourceExcerpt: w.sourceExcerpt,
        examTags: w.examTags || [], domainTags: w.domainTags || [],
        difficulty: w.difficulty, basicMastery: w.basicMastery && w.basicMastery.level,
        notes: w.notes
      };
    });
    return this.previewImport(seeds);
  },

  /* 确认导入：只写入 status='new' 的条目（重复跳过，绝不覆盖已有掌握记录）。
   * 返回 { added, skippedDuplicate, skippedError } */
  applyImport: function (previewItems) {
    var added = 0, skippedDup = 0, skippedErr = 0;
    previewItems.forEach(function (it) {
      if (it.status === 'error') { skippedErr++; return; }
      if (it.status === 'duplicate') { skippedDup++; return; }
      var r = VocabEngine.addWord(it.seed);
      if (r.ok && !r.duplicate) added++;
      else if (r.ok && r.duplicate) skippedDup++;   // 应用时再次查重兜底
      else skippedErr++;
    });
    return { added: added, skippedDuplicate: skippedDup, skippedError: skippedErr };
  },

  /* ---------------- CSV / JSON 导出 ---------------- */

  /* 词条 → 标准 CSV 行（字段完整往返） */
  wordToCsvRow: function (w, library) {
    var ctx = library ? this.contextOf(w, library) : null;
    return [
      w.word,
      library || (w.contexts.length ? w.contexts[0].library : 'general_advanced'),
      w.phonetic, w.partOfSpeech,
      w.definitions.map(function (d) { return d.text; }).join(';'),
      w.englishDefinition, w.exampleSentence,
      (w.collocations || []).join('|'),
      w.sourceType, w.sourceTitle, w.sourceExcerpt,
      (w.examTags || []).join(','), (w.domainTags || []).join(','),
      w.difficulty, w.basicMastery.level, w.notes
    ].map(function (v) { return VocabEngine.csvEscape(v); });
  },

  /* 导出 CSV：template = 'standard'（全字段，可再导入）| 'anki'（Front/Back/Tags）| 'momo'（word/释义） */
  buildCsv: function (words, opts) {
    opts = opts || {};
    var tpl = opts.template || 'standard';
    var lines;
    if (tpl === 'anki') {
      lines = ['Front,Back,Tags'];
      words.forEach(function (w) {
        var back = [w.phonetic, w.partOfSpeech, w.definitions.map(function (d) { return d.text; }).join('；'),
          w.exampleSentence].filter(Boolean).join('\n');
        var tags = (w.examTags || []).concat(w.domainTags || []).join(' ');
        lines.push([w.word, back, tags].map(function (v) { return VocabEngine.csvEscape(v); }).join(','));
      });
    } else if (tpl === 'momo') {
      lines = ['word,definition'];
      words.forEach(function (w) {
        lines.push([w.word, w.definitions.map(function (d) { return d.text; }).join('；')]
          .map(function (v) { return VocabEngine.csvEscape(v); }).join(','));
      });
    } else {
      lines = [this.csvColumns().join(',')];
      words.forEach(function (w) { lines.push(VocabEngine.wordToCsvRow(w, opts.library).join(',')); });
    }
    /* 前置 BOM：Excel/墨墨 打开中文不乱码 */
    return '﻿' + lines.join('\r\n');
  },

  /* 导出 JSON：完整字段（含 mastery/contexts/统计字段），可无损往返 */
  buildJson: function (words) {
    return JSON.stringify({
      format: 'study-planner-vocab',
      version: 1,
      exportedAt: new Date().toISOString(),
      words: words.map(function (w) { return clone(w); })
    }, null, 2);
  }
};

function emptyLibStats(key) {
  var lib = VOCAB_LIBRARIES.find(function (l) { return l.key === key; });
  return {
    key: key,
    label: lib ? lib.label : key,
    total: 0, newCount: 0, learning: 0, mastered: 0,
    due: 0, contextWeak: 0,
    basicMasterySum: 0, ctxMasterySum: 0, errRateSum: 0,
    basicMasteryAvg: 0, ctxMasteryAvg: 0, errorRate: 0
  };
}
