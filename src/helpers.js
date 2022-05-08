const fs = require('fs');
const path = require('path');

function replaceAcronyms(str) {
  const tokens = str.split(' ');
  let tokenIndex = 0;
  const result = [];
  while (tokenIndex < tokens.length) {
    if (
      tokens[tokenIndex] &&
      tokens[tokenIndex].length === 2 &&
      tokens[tokenIndex].endsWith('.')
    ) {
      let acronym = '';
      while (
        tokens[tokenIndex] &&
        tokens[tokenIndex].length === 2 &&
        tokens[tokenIndex].endsWith('.')
      ) {
        acronym += tokens[tokenIndex][0].toUpperCase();
        tokenIndex += 1;
      }
      result.push(acronym);
    } else {
      result.push(tokens[tokenIndex]);
      tokenIndex += 1;
    }
  }
  return result.join(' ');
}

function loadMassive(DATASET_PATH, locale) {
  const fileName = path.join(DATASET_PATH, `${locale}.jsonl`);
  if (!fs.existsSync(fileName)) {
    throw new Error(`File ${fileName} does not exist`);
  }
  const result = {
    name: `Corpus ${locale}`,
    locale,
    stats: {
      intents: 0,
      utterances: 0,
      tests: 0,
    },
    data: [],
  };
  const intentsByName = {};
  const items = fs
    .readFileSync(fileName, 'utf-8')
    .split(/\r?\n/)
    .map((item) => JSON.parse(item));
  items.forEach((item) => {
    if (['train', 'test'].includes(item.partition)) {
      let intent = intentsByName[item.intent];
      if (!intent) {
        intent = {
          intent: item.intent,
          scenario: item.scenario,
          utterances: [],
          tests: [],
          annotUtterances: [],
          annotTests: [],
        };
        intentsByName[item.intent] = intent;
        result.stats.intents += 1;
        result.data.push(intent);
      }
      if (item.partition === 'train') {
        intent.utterances.push(item.utt);
        intent.annotUtterances.push(item.annot_utt);
        result.stats.utterances += 1;
      } else {
        intent.tests.push(item.utt);
        intent.annotTests.push(item.annot_utt);
        result.stats.tests += 1;
      }
    }
  });
  return result;
}

function applyInCorpus(corpus, fn, srcFieldNames) {
  const fieldNames = Array.isArray(srcFieldNames)
    ? srcFieldNames
    : [srcFieldNames];
  corpus.data.forEach((intent) => {
    fieldNames.forEach((fieldName) => {
      // eslint-disable-next-line no-param-reassign
      intent[fieldName] = intent[fieldName].map((str) => fn(str));
    });
  });
  return corpus;
}

function augmentNgrams(input) {
  if (typeof input === 'string') {
    return augmentNgrams(input.split(' ')).join(' ');
  }
  const tokens = input;
  const ngrams = [];
  for (let i = 1; i < tokens.length; i += 1) {
    ngrams.push(`${tokens[i - 1]}_${tokens[i]}`);
  }
  for (let i = 2; i < tokens.length; i += 1) {
    ngrams.push(`${tokens[i - 2]}_${tokens[i]}`);
  }
  return [...tokens, ...ngrams];
}

function calculateHash(str) {
  return str.split(' ').sort().join('_');
}

function cleanCorpus(corpus) {
  const result = {
    name: corpus.name,
    locale: corpus.locale,
    data: [],
  };
  const intentsByName = {};
  const hashes = {};
  corpus.data.forEach((item) => {
    const newIntent = { ...item };
    newIntent.utterances = [];
    result.data.push(newIntent);
    intentsByName[item.intent] = newIntent;
    for (let i = 0; i < item.utterances.length; i += 1) {
      const hash = calculateHash(item.utterances[i]);
      if (!hashes[hash]) {
        hashes[hash] = {};
      }
      if (!hashes[hash][item.intent]) {
        hashes[hash][item.intent] = [];
      }
      hashes[hash][item.intent].push(item.utterances[i]);
    }
  });
  Object.keys(hashes).forEach((hash) => {
    if (Object.keys(hashes[hash]).length === 1) {
      const intentName = Object.keys(hashes[hash])[0];
      const intent = intentsByName[intentName];
      const utterance = hashes[hash][intentName][0];
      if (utterance.length > 2) {
        intent.utterances.push(utterance);
      }
    }
  });
  return result;
}

module.exports = {
  loadMassive,
  replaceAcronyms,
  applyInCorpus,
  augmentNgrams,
  cleanCorpus,
};
