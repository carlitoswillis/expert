// Seed the active store with a few demo sources so a fresh checkout has
// something to search. Safe to run repeatedly (appends rows).
//
//   npm run seed

const store = require('../store');

const SAMPLES = [
  {
    title: 'Monadology',
    authors: 'Gottfried Wilhelm Leibniz',
    published: '1714',
    url: 'https://www.gutenberg.org/ebooks/17147',
    content:
      'The monad, of which we shall here speak, is nothing but a simple substance '
      + 'which enters into compounds. By simple is meant without parts. Each monad '
      + 'mirrors the whole universe from its own point of view. Leibniz argues for a '
      + 'pre-established harmony among substances.',
  },
  {
    title: 'The Concept of Mind',
    authors: 'Gilbert Ryle',
    published: '1949',
    url: '',
    content:
      'The dogma of the Ghost in the Machine. I shall argue that the official doctrine '
      + 'of mind as a separate, non-physical substance rests on a category mistake. '
      + 'Mental conduct words do not name occult inner episodes.',
  },
  {
    title: 'Computing Machinery and Intelligence',
    authors: 'Alan M. Turing',
    published: '1950',
    url: 'https://academic.oup.com/mind/article/LIX/236/433/986238',
    content:
      'I propose to consider the question, "Can machines think?" This should begin with '
      + 'definitions of the meaning of the terms machine and think. The imitation game '
      + 'replaces the question. We may hope that machines will eventually compete with '
      + 'men in all purely intellectual fields.',
  },
];

(async () => {
  for (const sample of SAMPLES) {
    // eslint-disable-next-line no-await-in-loop
    const row = await store.create({
      ...sample,
      fileName: `${sample.title}.pdf`,
      created: new Date().toDateString(),
    });
    console.log(`seeded #${row.id}: ${row.title}`);
  }
  console.log(`done (store: ${store.driver})`);
  if (store.pool) await store.pool.end();
})();
