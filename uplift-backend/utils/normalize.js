// uplift-backend/utils/normalize.js
function normalize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "") // remove punctuation
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w)) // remove stopwords
    .map(stem);
}

const STOPWORDS = new Set([
  "the","and","but","that","this","with","for","you","are","was","were","how",
  "can","all","just","then","they","their","she","him","her","his","its","our",
  "not","too","very","when","what","why","who","whom","where","your","from","had"
]);

// Basic stemmer: converts "discomforts" -> "discomfort", "depressed" -> "depress"
function stem(word) {
  return word.replace(/(ing|ed|s)$/i, "");
}

module.exports = { normalize };
