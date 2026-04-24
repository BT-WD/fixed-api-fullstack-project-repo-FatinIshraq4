const { useState, useEffect } = React;

const STOCKS = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN"];


function generateRandomPrices(length = 120, startPrice = 100) {
  const prices = [startPrice];
  for (let i = 1; i < length; i++) {
    const change = (Math.random() - 0.5) * 0.02; // small random change
    const newPrice = prices[i - 1] * (1 + change);
    prices.push(newPrice);
  }
  return prices;
}


function saveDataLocally(data) {
  const timestamp = new Date().toISOString();
  const dataToStore = {
    data,
    timestamp
  };
  localStorage.setItem("stockData", JSON.stringify(dataToStore));
  console.log("Stock data saved to localStorage at", timestamp);
}


function loadDataLocally() {
  const stored = localStorage.getItem("stockData");
  if (!stored) return null;

  const { data, timestamp } = JSON.parse(stored);

  
  const storedDate = new Date(timestamp);
  const today = new Date();
  
  if (storedDate.toDateString() === today.toDateString()) {
    console.log("Using cached data from today");
    return data;
  }

  console.log("Cached data is outdated, will fetch new data");
  return null;
}


function loadFavorites() {
  const stored = localStorage.getItem("favorites");
  return stored ? JSON.parse(stored) : [];
}


function saveFavorites(favs) {
  localStorage.setItem("favorites", JSON.stringify(favs));
}

function getReturns(p) {
  let r = [];
  for (let i = 1; i < p.length; i++) {
    r.push((p[i] - p[i - 1]) / p[i - 1]);
  }
  return r;
}

function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  
  const meanA = a.reduce((s, x) => s + x, 0) / n;
  const meanB = b.reduce((s, x) => s + x, 0) / n;

  let cov = 0, va = 0, vb = 0;

  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }

  return cov / Math.sqrt(va * vb);
}

/* spread + z-score */
function getSpread(a, b) {
  return a.map((v, i) => v - b[i]);
}

function zScore(arr) {
  if (arr.length === 0) return [];
  
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(
    arr.map(x => (x - mean) ** 2).reduce((a, b) => a + b) / arr.length
  );

  if (std === 0) return arr.map(() => 0);
  
  return arr.map(x => (x - mean) / std);
}


function App() {
  const [selectedPair, setSelectedPair] = useState(null);
  const [baseStock, setBaseStock] = useState("AAPL");
  const [stockData, setStockData] = useState(() => loadDataLocally() || {});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [favorites, setFavorites] = useState(() => loadFavorites() || []);

  
  const generateRandomData = () => {
    setLoading(true);
    setMessage("Getting stock data...");

    const newData = {};

    for (const stock of STOCKS) {
      newData[stock] = generateRandomPrices();
    }

    setStockData(newData);
    saveDataLocally(newData);
    setMessage("Retrieved data for stocks");

    setLoading(false);
  };

  
  const addToFavorites = (pair) => {
    if (!favorites.some(f => f.a === pair.a && f.b === pair.b)) {
      const newFavs = [...favorites, pair];
      setFavorites(newFavs);
      saveFavorites(newFavs);
      setMessage("Added to favorites");
    } else {
      setMessage("Already in favorites");
    }
  };

  
  const removeFromFavorites = (pair) => {
    const newFavs = favorites.filter(f => !(f.a === pair.a && f.b === pair.b));
    setFavorites(newFavs);
    saveFavorites(newFavs);
    setMessage("Removed from favorites");
  };

  
  const hasValidData = STOCKS.every(stock => stockData[stock] && stockData[stock].length > 0);

  
  const matrix = STOCKS.map(a =>
    STOCKS.map(b => {
      if (a === b) return 1;
      if (!stockData[a]?.length || !stockData[b]?.length) return 0;

      return correlation(
        getReturns(stockData[a]),
        getReturns(stockData[b])
      );
    })
  );

  
  let ideas = [];

  for (let i = 0; i < STOCKS.length; i++) {
    for (let j = i + 1; j < STOCKS.length; j++) {
      const a = STOCKS[i];
      const b = STOCKS[j];

      if (stockData[a]?.length && stockData[b]?.length) {
        const corr = correlation(getReturns(stockData[a]), getReturns(stockData[b]));
        ideas.push({ a, b, corr });
      }
    }
  }

  ideas.sort((x, y) => Math.abs(y.corr) - Math.abs(x.corr));
  ideas = ideas.slice(0, 3);

  
  const pairA = selectedPair?.a || "AAPL";
  const pairB = selectedPair?.b || "MSFT";

  let spread = [];
  let z = [];
  let lastZ = 0;
  let signal = "NO DATA - Fetch stock data first";

  if (stockData[pairA]?.length && stockData[pairB]?.length) {
    spread = getSpread(stockData[pairA], stockData[pairB]);
    z = zScore(spread);
    lastZ = z[z.length - 1] || 0;

    signal =
      lastZ > 1.5 ? "SHORT spread (mean revert down)" :
      lastZ < -1.5 ? "LONG spread (mean revert up)" :
      "NO TRADE (normal)";
  }

  const getColor = v =>
    v > 0
      ? `rgba(0,255,0,${Math.min(Math.abs(v), 1)})`
      : `rgba(255,0,0,${Math.min(Math.abs(v), 1)})`;


  return (
    <div className="app">

      <div className="header">
        <h2>Correlation + Pairs Trading Simulator</h2>
        <button 
          onClick={generateRandomData} 
          disabled={loading}
          className="fetch-button"
        >
          {loading ? "Generating..." : "Generate Data"}
        </button>
        {message && <div className="message">{message}</div>}
      </div>

      {!hasValidData && (
        <div className="warning">
          Click "Generate Data" to generate simulated stock data
        </div>
      )}

      {/* TOP IDEAS */}
      {ideas.length > 0 && (
        <div className="ideas">
          {ideas.map((i, idx) => (
            <div key={idx} className="card" onClick={() => setSelectedPair(i)}>
              <div className="bold">{i.a} vs {i.b}</div>
              <div>Corr: {i.corr.toFixed(2)}</div>
              <button onClick={(e) => { e.stopPropagation(); addToFavorites(i); }}>Add to Favorites</button>
            </div>
          ))}
        </div>
      )}

      {/* FAVORITES */}
      {favorites.length > 0 && (
        <div className="ideas">
          <h3>Favorites</h3>
          {favorites.map((f, idx) => (
            <div key={idx} className="card" onClick={() => setSelectedPair(f)}>
              <div className="bold">{f.a} vs {f.b}</div>
              <div>Corr: {f.corr ? f.corr.toFixed(2) : 'N/A'}</div>
              <button onClick={(e) => { e.stopPropagation(); removeFromFavorites(f); }}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid">

        {/* LEFT: HEATMAP */}
        <div className="panel">
          <h3>Correlation Heatmap</h3>

          <div className="heatmap">
            {matrix.map((row, i) => (
              <div key={i} className="row">
                {row.map((val, j) => (
                  <div
                    key={j}
                    className="cell"
                    onClick={() =>
                      setSelectedPair({ a: STOCKS[i], b: STOCKS[j] })
                    }
                    style={{ background: getColor(val) }}
                  >
                    {val.toFixed(1)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: ANALYSIS */}
        <div className="panel">
          <h3>Selected Pair</h3>

          <div className="card big">
            {pairA} vs {pairB}
          </div>

          <div className="card">
            <div className="bold">Signal</div>
            {signal}
          </div>

          <div className="card">
            Z-Score: {lastZ.toFixed(2)}
          </div>

          <div className="card">
            <button onClick={() => addToFavorites({a: pairA, b: pairB, corr: correlation(getReturns(stockData[pairA] || []), getReturns(stockData[pairB] || []))})}>
              Add to Favorites
            </button>
            {favorites.some(f => f.a === pairA && f.b === pairB) && (
              <button onClick={() => removeFromFavorites({a: pairA, b: pairB})}>
                Remove from Favorites
              </button>
            )}
          </div>

          <h4>Spread (visual)</h4>

          <div className="bars">
            {z.slice(-30).map((v, i) => (
              <div
                key={i}
                className="bar"
                style={{
                  height: Math.max(5, 40 + v * 10),
                  background: v > 0 ? "#22c55e" : "#ef4444"
                }}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

