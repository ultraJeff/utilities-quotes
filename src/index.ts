import express from 'express';
import http from 'http';

const app = express();
const PORT = process.env.PORT || 3002;

// Weather service URL
const WEATHER_SERVICE = process.env.WEATHER_SERVICE_URL || 'http://utilities-weather:3001';

interface UtilityRate {
  utility: string;
  baseRate: number;
  unit: string;
  weatherAdjustment: number;
  adjustedRate: number;
  reason: string;
}

interface WeatherData {
  city: string;
  temperature: number;
  conditions: string;
  humidity: number;
}

// Base rates for utilities
const baseRates = {
  electricity: { rate: 0.12, unit: 'kWh' },
  naturalGas: { rate: 1.05, unit: 'therm' },
  water: { rate: 0.004, unit: 'gallon' },
  solar: { rate: 0.08, unit: 'kWh' },
};

// Helper to fetch weather data
function fetchWeather(city: string): Promise<WeatherData> {
  return new Promise((resolve, reject) => {
    http.get(`${WEATHER_SERVICE}/api/weather/${city}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error));
          else resolve(parsed);
        } catch {
          reject(new Error('Invalid response from weather service'));
        }
      });
    }).on('error', reject);
  });
}

// Calculate rate adjustments based on weather
function calculateRates(weather: WeatherData): UtilityRate[] {
  const rates: UtilityRate[] = [];
  const temp = weather.temperature;
  const conditions = weather.conditions.toLowerCase();
  const humidity = weather.humidity;

  // Electricity - higher in extreme temps (AC/heating), lower with good solar conditions
  let elecAdjust = 0;
  let elecReason = 'Standard rate';
  if (temp > 85) {
    elecAdjust = 0.04; // +33% for AC demand
    elecReason = 'High cooling demand due to heat';
  } else if (temp < 40) {
    elecAdjust = 0.03; // +25% for heating
    elecReason = 'Increased heating demand';
  } else if (temp >= 65 && temp <= 75) {
    elecAdjust = -0.02; // -17% mild weather
    elecReason = 'Low HVAC demand - mild weather';
  }
  rates.push({
    utility: 'Electricity',
    baseRate: baseRates.electricity.rate,
    unit: baseRates.electricity.unit,
    weatherAdjustment: elecAdjust,
    adjustedRate: Math.round((baseRates.electricity.rate + elecAdjust) * 1000) / 1000,
    reason: elecReason,
  });

  // Natural Gas - higher in cold weather
  let gasAdjust = 0;
  let gasReason = 'Standard rate';
  if (temp < 32) {
    gasAdjust = 0.45; // +43% extreme cold
    gasReason = 'Peak heating season - extreme cold';
  } else if (temp < 50) {
    gasAdjust = 0.25; // +24% cold
    gasReason = 'Heating demand increased';
  } else if (temp > 80) {
    gasAdjust = -0.15; // -14% hot weather, less gas usage
    gasReason = 'Reduced heating demand';
  }
  rates.push({
    utility: 'Natural Gas',
    baseRate: baseRates.naturalGas.rate,
    unit: baseRates.naturalGas.unit,
    weatherAdjustment: gasAdjust,
    adjustedRate: Math.round((baseRates.naturalGas.rate + gasAdjust) * 100) / 100,
    reason: gasReason,
  });

  // Water - higher in drought/hot conditions
  let waterAdjust = 0;
  let waterReason = 'Standard rate';
  if (humidity < 30 && temp > 80) {
    waterAdjust = 0.002; // +50% drought conditions
    waterReason = 'Drought surcharge - conservation pricing';
  } else if (conditions.includes('rain')) {
    waterAdjust = -0.001; // -25% rainy
    waterReason = 'Reduced irrigation demand';
  }
  rates.push({
    utility: 'Water',
    baseRate: baseRates.water.rate,
    unit: baseRates.water.unit,
    weatherAdjustment: waterAdjust,
    adjustedRate: Math.round((baseRates.water.rate + waterAdjust) * 10000) / 10000,
    reason: waterReason,
  });

  // Solar buyback - higher on sunny days
  let solarAdjust = 0;
  let solarReason = 'Standard buyback rate';
  if (conditions.includes('sunny') || conditions.includes('clear')) {
    solarAdjust = 0.03; // +37% sunny
    solarReason = 'Peak solar production - premium buyback';
  } else if (conditions.includes('cloud') || conditions.includes('overcast')) {
    solarAdjust = -0.02; // -25% cloudy
    solarReason = 'Reduced solar output';
  } else if (conditions.includes('rain') || conditions.includes('storm')) {
    solarAdjust = -0.04; // -50% storms
    solarReason = 'Minimal solar production';
  }
  rates.push({
    utility: 'Solar Buyback',
    baseRate: baseRates.solar.rate,
    unit: baseRates.solar.unit,
    weatherAdjustment: solarAdjust,
    adjustedRate: Math.round((baseRates.solar.rate + solarAdjust) * 1000) / 1000,
    reason: solarReason,
  });

  return rates;
}

app.use(express.json());

// Health endpoints
app.get('/health', (_, res) => res.json({ status: 'healthy' }));
app.get('/ready', (_, res) => res.json({ status: 'ready' }));

// Get base rates (no weather adjustment)
app.get('/api/rates/base', (_, res) => {
  res.json({
    rates: Object.entries(baseRates).map(([name, data]) => ({
      utility: name,
      rate: data.rate,
      unit: data.unit,
    })),
    note: 'Base rates before weather adjustments',
  });
});

// Get rate quote for a specific city
app.get('/api/rates/:city', async (req, res) => {
  try {
    const weather = await fetchWeather(req.params.city);
    const rates = calculateRates(weather);
    
    res.json({
      city: weather.city,
      weather: {
        temperature: weather.temperature,
        conditions: weather.conditions,
        humidity: weather.humidity,
      },
      rates,
      generatedAt: new Date().toISOString(),
      validFor: '1 hour',
    });
  } catch (error) {
    res.status(404).json({ 
      error: 'Could not generate rate quote',
      message: error instanceof Error ? error.message : 'Weather data unavailable',
    });
  }
});

// Get rates for all available cities
app.get('/api/rates', async (_, res) => {
  const cities = ['new-york', 'london', 'tokyo', 'sydney', 'paris'];
  const quotes = [];
  
  for (const city of cities) {
    try {
      const weather = await fetchWeather(city);
      const rates = calculateRates(weather);
      quotes.push({
        city: weather.city,
        weather: {
          temperature: weather.temperature,
          conditions: weather.conditions,
        },
        rates,
      });
    } catch {
      // Skip cities we can't get weather for
    }
  }
  
  res.json({
    quotes,
    generatedAt: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`utilities-quotes service running on port ${PORT}`);
  console.log(`Weather service: ${WEATHER_SERVICE}`);
});
