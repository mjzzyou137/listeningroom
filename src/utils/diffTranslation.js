/**
 * Utility to compare user translation with model answer
 * Provides word-by-word diff with LCS (Longest Common Subsequence)
 */

const NUM_WORDS = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
  '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen', '14': 'fourteen',
  '15': 'fifteen', '16': 'sixteen', '17': 'seventeen', '18': 'eighteen', '19': 'nineteen',
  '20': 'twenty', '21': 'twenty-one', '22': 'twenty-two', '23': 'twenty-three', '24': 'twenty-four',
  '25': 'twenty-five', '26': 'twenty-six', '27': 'twenty-seven', '28': 'twenty-eight', '29': 'twenty-nine',
  '30': 'thirty', '35': 'thirty-five', '40': 'forty', '45': 'forty-five', '47': 'forty-seven',
  '50': 'fifty', '72': 'seventy-two', '75': 'seventy-five'
};

const CONTRACTIONS = {
  'cant': 'cannot',
  'dont': 'donot',
  'im': 'iam',
  'isnt': 'isnot',
  'arent': 'arenot',
  'wasnt': 'wasnot',
  'werent': 'werenot',
  'wont': 'willnot',
  'didnt': 'didnot',
  'doesnt': 'doesnot',
  'youre': 'youare',
  'theyre': 'theyare',
  'were': 'weare',
  'hes': 'heis',
  'shes': 'sheis',
  'its': 'itis',
  'thats': 'thatis',
  'havent': 'havenot',
  'hasnt': 'hasnot',
  'couldnt': 'couldnot',
  'wouldnt': 'wouldnot',
  'ill': 'iwill',
  'youll': 'youwill',
  'theyll': 'theywill',
  'shell': 'shewill',
  'hell': 'hewill'
};

export function normalizeWord(w) {
  if (!w) return '';
  return w.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function canonicalWord(w) {
  const norm = normalizeWord(w);
  if (!norm) return '';
  if (NUM_WORDS[norm]) return NUM_WORDS[norm].replace(/[^a-z0-9]/g, '');
  return CONTRACTIONS[norm] || norm;
}

export function diffTranslation(userText, modelText) {
  const userWords = (userText || '').trim().split(/\s+/).filter(Boolean);
  const modelWords = (modelText || '').trim().split(/\s+/).filter(Boolean);

  const m = userWords.length;
  const n = modelWords.length;

  if (m === 0) {
    return {
      score: 0,
      totalModelWords: n,
      correctCount: 0,
      userWordCount: 0,
      userTokens: [],
      modelTokens: modelWords.map((w) => ({ word: w, matched: false })),
      tokens: modelWords.map((w) => ({
        type: 'missing',
        expected: w
      }))
    };
  }

  // LCS Matrix
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (canonicalWord(userWords[i]) === canonicalWord(modelWords[j])) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const rawTokens = [];
  const modelMatched = new Array(n).fill(false);

  while (i > 0 && j > 0) {
    if (canonicalWord(userWords[i - 1]) === canonicalWord(modelWords[j - 1])) {
      modelMatched[j - 1] = true;
      rawTokens.push({
        type: 'correct',
        word: userWords[i - 1],
        expected: modelWords[j - 1]
      });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      rawTokens.push({
        type: 'incorrect',
        word: userWords[i - 1]
      });
      i--;
    } else {
      rawTokens.push({
        type: 'missing',
        expected: modelWords[j - 1]
      });
      j--;
    }
  }

  while (i > 0) {
    rawTokens.push({ type: 'incorrect', word: userWords[i - 1] });
    i--;
  }
  while (j > 0) {
    rawTokens.push({ type: 'missing', expected: modelWords[j - 1] });
    j--;
  }

  rawTokens.reverse();

  // Merge adjacent incorrect and missing into a paired wrong_word
  const tokens = [];
  for (let k = 0; k < rawTokens.length; k++) {
    const cur = rawTokens[k];
    const nxt = rawTokens[k + 1];
    if (cur.type === 'incorrect' && nxt && nxt.type === 'missing') {
      tokens.push({
        type: 'wrong_word',
        word: cur.word,
        expected: nxt.expected
      });
      k++;
    } else if (cur.type === 'missing' && nxt && nxt.type === 'incorrect') {
      tokens.push({
        type: 'wrong_word',
        word: nxt.word,
        expected: cur.expected
      });
      k++;
    } else {
      tokens.push(cur);
    }
  }

  const userTokens = tokens
    .filter((t) => t.word !== undefined)
    .map((t) => ({
      word: t.word,
      type: t.type,
      isCorrect: t.type === 'correct',
      expected: t.expected || null
    }));

  const modelTokens = modelWords.map((w, idx) => ({
    word: w,
    matched: modelMatched[idx]
  }));

  const correctCount = dp[m][n];
  const score = Math.min(100, Math.round((correctCount / Math.max(n, 1)) * 100));

  return {
    score,
    totalModelWords: n,
    correctCount,
    userWordCount: m,
    userTokens,
    modelTokens,
    tokens
  };
}
