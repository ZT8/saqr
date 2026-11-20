'use strict';
// Multinomial Naive Bayes text classifier (unigrams + bigrams), trained locally at start-up.
// Chosen because it is fast, needs little data, runs fully offline, and is explainable:
// we can show which words pushed a message towards "scam".

const { tokenize } = require('./normalize');

class NaiveBayes {
  constructor() {
    this.reset();
  }

  reset() {
    this.counts = { scam: new Map(), ham: new Map() };
    this.totals = { scam: 0, ham: 0 };
    this.docs = { scam: 0, ham: 0 };
    this.vocab = new Set();
  }

  learn(text, label) {
    if (label !== 'scam' && label !== 'ham') throw new Error('label must be scam|ham');
    this.docs[label]++;
    for (const tok of tokenize(text)) {
      this.counts[label].set(tok, (this.counts[label].get(tok) || 0) + 1);
      this.totals[label]++;
      this.vocab.add(tok);
    }
  }

  train(samples) {
    this.reset();
    for (const s of samples) this.learn(s.text, s.label);
    return this;
  }

  _logLik(tok, label) {
    const c = this.counts[label].get(tok) || 0;
    return Math.log((c + 1) / (this.totals[label] + this.vocab.size));
  }

  /** @returns {{probability:number, topTerms:string[], knownTokens:number}} */
  predict(text) {
    const tokens = tokenize(text);
    const nDocs = this.docs.scam + this.docs.ham || 1;
    let s = Math.log((this.docs.scam || 1) / nDocs);
    let h = Math.log((this.docs.ham || 1) / nDocs);
    const contrib = [];
    let known = 0;
    for (const tok of tokens) {
      if (!this.vocab.has(tok)) continue; // unseen tokens carry no evidence
      known++;
      const ls = this._logLik(tok, 'scam');
      const lh = this._logLik(tok, 'ham');
      s += ls;
      h += lh;
      contrib.push([tok, ls - lh]);
    }
    const diff = Math.max(-50, Math.min(50, s - h));
    let probability = 1 / (1 + Math.exp(-diff));
    // With almost no known vocabulary the model is guessing; pull towards neutral.
    if (known < 2) probability = 0.5 + (probability - 0.5) * 0.3;
    const topTerms = contrib
      .filter(([tok, w]) => w > 0.4 && !tok.includes('_') && !tok.startsWith('__'))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tok]) => tok);
    return { probability, topTerms, knownTokens: known };
  }
}

module.exports = { NaiveBayes };
