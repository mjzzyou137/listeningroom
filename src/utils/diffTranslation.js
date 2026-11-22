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
      hasMore: n > 0,
      tokens: modelWords.map((w) => ({
        type: 'missing',
        expected: w
      })),
      modelTokens: modelWords.map((w) => ({ word: w, matched: false }))
    };
  }

  // Semi-global localized dynamic programming alignment:
  // Match: 0 cost
  // Substitution / typo: 2.5 cost
  // Delete extra user word: 2.0 cost
  // Insert missing model word: 1.5 cost
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  const op = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(''));

  for (let j = 0; j <= n; j++) {
    dp[0][j] = j * 1.5;
    op[0][j] = 'insert';
  }
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i * 2.5;
    op[i][0] = 'delete';
  }
  dp[0][0] = 0;

  for (let i = 1; i <= m; i++) {
    const uWord = canonicalWord(userWords[i - 1]);
    for (let j = 1; j <= n; j++) {
      const mWord = canonicalWord(modelWords[j - 1]);
      const isMatch = uWord === mWord;

      const matchCost = isMatch ? 0 : 2.5;
      const costMatch = dp[i - 1][j - 1] + matchCost;
      const costDelete = dp[i - 1][j] + 2.0;
      const costInsert = dp[i][j - 1] + 1.5;

      let minCost = costMatch;
      let bestOp = isMatch ? 'match' : 'sub';

      if (costInsert < minCost) {
        minCost = costInsert;
        bestOp = 'insert';
      }
      if (costDelete < minCost) {
        minCost = costDelete;
        bestOp = 'delete';
      }

      dp[i][j] = minCost;
      op[i][j] = bestOp;
    }
  }

  // Semi-global prefix alignment: user may only have written the first sentence/clause
  let bestJ = n;
  if (m < n * 0.8) {
    let minCost = Infinity;
    for (let j = 1; j <= n; j++) {
      if (dp[m][j] < minCost) {
        minCost = dp[m][j];
        bestJ = j;
      }
    }
  }

  let i = m;
  let j = bestJ;
  const rawTokens = [];
  const modelMatched = new Array(n).fill(false);

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && op[i][j] === 'match') {
      modelMatched[j - 1] = true;
      rawTokens.push({
        type: 'correct',
        word: userWords[i - 1],
        expected: modelWords[j - 1]
      });
      i--;
      j--;
    } else if (i > 0 && j > 0 && op[i][j] === 'sub') {
      rawTokens.push({
        type: 'wrong_word',
        word: userWords[i - 1],
        expected: modelWords[j - 1]
      });
      i--;
      j--;
    } else if (i > 0 && (j === 0 || op[i][j] === 'delete')) {
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

  rawTokens.reverse();

  const correctCount = rawTokens.filter((t) => t.type === 'correct').length;
  const score = Math.min(100, Math.round((correctCount / Math.max(n, 1)) * 100));

  const modelTokens = modelWords.map((w, idx) => ({
    word: w,
    matched: modelMatched[idx]
  }));

  return {
    score,
    totalModelWords: n,
    correctCount,
    userWordCount: m,
    hasMore: bestJ < n,
    bestJ,
    tokens: rawTokens,
    modelTokens
  };
}
