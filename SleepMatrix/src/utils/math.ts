export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const squaredDiffs = values.map(val => Math.pow(val - m, 2));
  return Math.sqrt(mean(squaredDiffs));
}

export function min(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.min(...values);
}

export function max(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (p <= 0) return min(values);
  if (p >= 100) return max(values);

  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);

  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    denominatorX += diffX * diffX;
    denominatorY += diffY * diffY;
  }

  const denominator = Math.sqrt(denominatorX * denominatorY);
  return denominator === 0 ? 0 : numerator / denominator;
}

export function spearmanRankCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const ranksX = getRanks(x);
  const ranksY = getRanks(y);

  return pearsonCorrelation(ranksX, ranksY);
}

function getRanks(values: number[]): number[] {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);

  const ranks: number[] = new Array(values.length);
  let i = 0;

  while (i < sorted.length) {
    const currentValue = sorted[i].value;
    const start = i;

    while (i < sorted.length && sorted[i].value === currentValue) {
      i++;
    }

    const end = i - 1;
    const avgRank = (start + end) / 2 + 1;

    for (let j = start; j <= end; j++) {
      ranks[sorted[j].index] = avgRank;
    }
  }

  return ranks;
}

export function pValueForCorrelation(correlation: number, sampleSize: number): number {
  if (sampleSize <= 2 || Math.abs(correlation) >= 1) return 0;

  const tStatistic = correlation * Math.sqrt((sampleSize - 2) / (1 - correlation * correlation));
  const df = sampleSize - 2;

  return 2 * (1 - tDistributionCDF(Math.abs(tStatistic), df));
}

function tDistributionCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;

  return 1 - 0.5 * regularizedIncompleteBeta(x, a, b);
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  const bt = x === 0 || x === 1
    ? 0
    : Math.exp(gammaLn(a + b) - gammaLn(a) - gammaLn(b) + a * Math.log(x) + b * Math.log(1 - x));

  if (x < (a + 1) / (a + b + 2)) {
    return bt * betaContinuedFraction(x, a, b) / a;
  } else {
    return 1 - bt * betaContinuedFraction(1 - x, b, a) / b;
  }
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const maxIterations = 200;
  const epsilon = 3e-16;

  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < epsilon) d = epsilon;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    c = 1 + aa / c;
    if (Math.abs(c) < epsilon) c = epsilon;
    d = 1 / d;
    h *= d * c;

    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    c = 1 + aa / c;
    if (Math.abs(c) < epsilon) c = epsilon;
    d = 1 / d;

    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < epsilon) break;
  }

  return h;
}

function gammaLn(x: number): number {
  const coefficients = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];

  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;

  for (let j = 0; j < coefficients.length; j++) {
    y += 1;
    ser += coefficients[j] / y;
  }

  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

export function partialCorrelation(
  x: number[],
  y: number[],
  controls: number[][]
): number {
  const n = x.length;
  const k = controls.length + 2;

  if (n <= k) return 0;

  const allVariables = [x, y, ...controls];
  const correlationMatrix: number[][] = [];

  for (let i = 0; i < k; i++) {
    correlationMatrix[i] = [];
    for (let j = 0; j < k; j++) {
      correlationMatrix[i][j] = pearsonCorrelation(allVariables[i], allVariables[j]);
    }
  }

  const inv = invertMatrix(correlationMatrix);
  if (!inv) return 0;

  const partialCorr = -inv[0][1] / Math.sqrt(inv[0][0] * inv[1][1]);
  return Math.max(-1, Math.min(1, partialCorr));
}

function invertMatrix(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const augmented: number[][] = matrix.map((row, i) => {
    const identityRow = new Array(n).fill(0);
    identityRow[i] = 1;
    return [...row, ...identityRow];
  });

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }

    if (Math.abs(augmented[maxRow][col]) < 1e-10) return null;

    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    const pivot = augmented[col][col];
    for (let j = col; j < 2 * n; j++) {
      augmented[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row !== col && Math.abs(augmented[row][col]) > 1e-10) {
        const factor = augmented[row][col];
        for (let j = col; j < 2 * n; j++) {
          augmented[row][j] -= factor * augmented[col][j];
        }
      }
    }
  }

  return augmented.map(row => row.slice(n));
}

export function crossCorrelation(
  x: number[],
  y: number[],
  maxLag: number
): Array<{ lag: number; correlation: number }> {
  const results: Array<{ lag: number; correlation: number }> = [];
  const n = x.length;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const xSubset = lag >= 0 ? x.slice(0, n - lag) : x.slice(-lag);
    const ySubset = lag >= 0 ? y.slice(lag) : y.slice(0, n + lag);

    const corr = pearsonCorrelation(xSubset, ySubset);
    results.push({ lag, correlation: corr });
  }

  return results;
}

export function linearInterpolation(
  x: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number
): number {
  if (x0 === x1) return (y0 + y1) / 2;
  return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const minVal = min(values);
  const maxVal = max(values);
  const range = maxVal - minVal;
  if (range === 0) return values.map(() => 0.5);
  return values.map(v => (v - minVal) / range);
}

export function standardize(values: number[]): number[] {
  if (values.length === 0) return [];
  const m = mean(values);
  const s = stdDev(values);
  if (s === 0) return values.map(() => 0);
  return values.map(v => (v - m) / s);
}

export function movingAverage(values: number[], windowSize: number): number[] {
  if (windowSize <= 1 || values.length === 0) return [...values];

  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(values.length, i + halfWindow + 1);
    const window = values.slice(start, end);
    result.push(mean(window));
  }

  return result;
}

export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const meanX = mean(x);
  const meanY = mean(y);
  let sum = 0;

  for (let i = 0; i < x.length; i++) {
    sum += (x[i] - meanX) * (y[i] - meanY);
  }

  return sum / (x.length - 1);
}

export function coefficientOfDetermination(yTrue: number[], yPred: number[]): number {
  if (yTrue.length !== yPred.length || yTrue.length < 2) return 0;

  const ssRes = yTrue.reduce((sum, val, i) => sum + Math.pow(val - yPred[i], 2), 0);
  const meanY = mean(yTrue);
  const ssTot = yTrue.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);

  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
}
