const fs = require('fs');
const { Neural } = require('@agarimo/neural');
const { initProcessors, getProcessor } = require('@agarimo/languages');
const {
  loadMassive,
  applyInCorpus,
  replaceAcronyms,
  augmentNgrams,
  cleanCorpus,
} = require('./helpers');
const neuralSettings = require('./neural-settings.json');

const DATASET_PATH = './data';

const allLocales = fs
  .readdirSync(DATASET_PATH)
  .filter((file) => file.endsWith('.jsonl'))
  .map((file) => file.replace('.jsonl', ''));

// *********** These are the settings that you can change ********************
// Note: Well, you can also play with hyperparameters located at neural-settings.json
// The list of locales to be executed. If undefined, all locales will be used.
const allowedLocales = undefined; // ['en-US'];
// When None intent is returned, which intent should it be mapped to
const noneIntent = 'general_quirky';
// If true then annot_utt is used, otherwise the normal utt will be used
const useAnnot = true;
// **************************************************************************

const locales = allowedLocales || allLocales;

function measure(net, corpus) {
  let total = 0;
  let good = 0;
  corpus.data.forEach((item) => {
    item.tests.forEach((test) => {
      total += 1;
      const classifications = net.run(test);
      if (classifications[0].intent === 'None' && noneIntent) {
        classifications[0].intent = noneIntent;
      }
      if (classifications[0].intent === item.intent) {
        good += 1;
      }
    });
  });
  console.log(
    `${corpus.locale} - Good ${good} of ${total} Accuracy: ${(
      (good / total) *
      100
    ).toFixed(1)}`
  );
}

(async () => {
  await initProcessors();
  console.log('IMPORTANT: it will take about 2 minutes per language');
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    let corpus = loadMassive(DATASET_PATH, locale);
    corpus.data.forEach((srcItem) => {
      const item = srcItem;
      item.srcUtterances = item.utterances;
      item.srcTests = item.tests;
      if (useAnnot) {
        item.utterances = item.annotUtterances;
        item.tests = item.annotTests;
      }
    });
    applyInCorpus(corpus, replaceAcronyms, [
      'utterances',
      'tests',
      'annotUtterances',
      'annotTests',
    ]);
    const processor = getProcessor(locale);
    applyInCorpus(corpus, (str) => processor(str).join(' '), [
      'utterances',
      'tests',
    ]);
    corpus = cleanCorpus(corpus);
    applyInCorpus(corpus, (str) => augmentNgrams(str), ['utterances', 'tests']);
    const neural = new Neural(neuralSettings);
    neural.train(corpus);
    measure(neural, corpus);
  }
})();
