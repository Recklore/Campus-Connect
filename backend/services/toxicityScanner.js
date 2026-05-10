const DEFAULT_THRESHOLD = parseFloat(process.env.MODERATION_THRESHOLD || '0.6');
const MODEL_ID = 'Xenova/toxic-bert';

let classifierPromise = null;

const normalizeLabel = (label) => String(label || '').toLowerCase().replace(/[_\s-]+/g, '');

const flattenPredictions = (output) => {
  if (!output) {
    return [];
  }

  if (Array.isArray(output) && Array.isArray(output[0])) {
    return output.flat().filter(Boolean);
  }

  return (Array.isArray(output) ? output : [output]).filter(Boolean);
};

const inferToxicityScore = (output) => {
  const predictions = flattenPredictions(output);

  if (predictions.length === 0) {
    throw new Error('Toxicity model returned no predictions');
  }

  const nonToxicPrediction = predictions.find((prediction) => {
    const label = normalizeLabel(prediction?.label);
    return label.includes('nontoxic') || (label.includes('non') && label.includes('toxic')) || (label.includes('not') && label.includes('toxic'));
  });

  if (nonToxicPrediction) {
    const nonToxicScore = Number(nonToxicPrediction.score) || 0;
    return {
      score: Math.max(0, Math.min(1, 1 - nonToxicScore)),
      label: nonToxicPrediction.label,
    };
  }

  const toxicPrediction = predictions.find((prediction) => {
    const label = normalizeLabel(prediction?.label);
    return label.includes('toxic');
  });

  if (toxicPrediction) {
    return {
      score: Math.max(0, Math.min(1, Number(toxicPrediction.score) || 0)),
      label: toxicPrediction.label,
    };
  }

  const topPrediction = predictions[0];
  return {
    score: Math.max(0, Math.min(1, Number(topPrediction?.score) || 0)),
    label: topPrediction?.label ?? null,
  };
};

const getClassifier = async () => {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      const { env, pipeline } = await import('@huggingface/transformers');

      env.allowLocalModels = true;
      env.allowRemoteModels = true;

      const classifier = await pipeline('text-classification', MODEL_ID);

      env.allowRemoteModels = false;
      return classifier;
    })().catch((error) => {
      classifierPromise = null;
      throw error;
    });
  }

  return classifierPromise;
};

const analyzeText = async (text, options = {}) => {
  const threshold = typeof options.threshold === 'number' ? options.threshold : DEFAULT_THRESHOLD;
  const classifier = await getClassifier();
  const output = await classifier(text);
  const { score, label } = inferToxicityScore(output);

  return {
    score,
    isToxic: score >= threshold,
    threshold,
    provider: 'toxic-bert-local',
    label,
  };
};

module.exports = {
  analyzeText,
};
