import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config({ path: path.resolve(__dirname, '/home/sniffle/sniffle/.env') });

const TWEETS_FILE = 'tweets.json';
export const OUTPUT_FILE = 'ai_analyzer.json';
export const BINANCE_TOKENS = 'binance_tokens.json';

// IO.NET Intelligence API configuration
const IO_INTELLIGENCE_API_KEY = process.env.IOINTEL_API_KEY || '';

// Initialize IO.NET Intelligence API client (OpenAI compatible)
const ioClient = new OpenAI({
  apiKey: IO_INTELLIGENCE_API_KEY,
  baseURL: 'https://api.intelligence.io.solutions/api/v1/',
});

// Track last modification time of binance_tokens.json
let lastBinanceTokensModified = 0;

// Simplified interface matching frontend expectations
interface SimplifiedTokenAnalysis {
  symbol: string;
  symbol1?: string;
  risk: number;                    // 1-10 (10 = highest risk)
  investmentPotential: number;     // 1-10 (10 = highest potential)
  rationale: string;
  
  // Market data for frontend
  price: number;
  volume: string;
  marketCap: string;
  change24h: number;
  age: string;
  href: string;
  
  // Analysis metadata
  lastAnalyzed: string;
}

// Keep the risk assessment functions from the previous version
function parseNumericValue(valueStr: string): number {
  if (!valueStr || valueStr === 'N/A' || valueStr === '-') return 0;
  
  const cleaned = valueStr.toLowerCase().replace(/[,$\s]/g, '');
  let multiplier = 1;
  
  if (cleaned.includes('k')) {
    multiplier = 1000;
  } else if (cleaned.includes('m')) {
    multiplier = 1000000;
  } else if (cleaned.includes('b')) {
    multiplier = 1000000000;
  }
  
  const numStr = cleaned.replace(/[kmb]/g, '');
  const num = parseFloat(numStr);
  
  return isNaN(num) ? 0 : num * multiplier;
}

function parseAge(ageStr: string): number {
  if (!ageStr || ageStr === 'N/A') return Number.MAX_SAFE_INTEGER;
  const match = ageStr.match(/(\d+)(mo|[smhdy])/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    case 'mo': return value * 2592000;
    case 'y': return value * 31536000;
    default: return Number.MAX_SAFE_INTEGER;
  }
}

function assessFundamentalRisk(liquidity: string, volume: string, age: string, change24h: number): number {
  let riskAdjustment = 0;
  
  // Liquidity risk
  const liquidityNum = parseNumericValue(liquidity);
  if (liquidityNum < 10000) riskAdjustment += 3;
  else if (liquidityNum < 50000) riskAdjustment += 2;
  else if (liquidityNum < 100000) riskAdjustment += 1;
  
  // Age risk
  const ageInSeconds = parseAge(age);
  const ageInDays = ageInSeconds / 86400;
  if (ageInDays < 1) riskAdjustment += 3;
  else if (ageInDays < 7) riskAdjustment += 2;
  else if (ageInDays < 30) riskAdjustment += 1;
  
  // Volatility risk
  const absChange = Math.abs(change24h);
  if (absChange > 200) riskAdjustment += 3;
  else if (absChange > 100) riskAdjustment += 2;
  else if (absChange > 50) riskAdjustment += 1;
  
  return riskAdjustment;
}

// Simplified analysis function
async function analyzeTokenSimplified(symbol: string, tweets: any[], tokenInfo: any): Promise<SimplifiedTokenAnalysis | null> {
  if (!tokenInfo) {
    console.log(`Token ${symbol} not found in binance_tokens.json. Skipping analysis.`);
    return null;
  }

  const tokenInfoStr = tokenInfo ? `Token Data: ${JSON.stringify(tokenInfo, null, 2)}\n` : '';
  const tweetsText = tweets.map(t => t.text).slice(0, 15).join(' | ');
  
  const simplifiedPrompt = `
MEMECOIN RISK & POTENTIAL ANALYSIS

Token: ${symbol}
${tokenInfoStr}
Social Data: ${tweetsText}

ANALYSIS REQUIREMENTS:
Analyze this memecoin focusing on:
1. Investment risk level (1-10, where 10 = extremely risky)
2. Investment potential (1-10, where 10 = highest potential)
3. Consider liquidity, age, volatility, and community factors

CRITICAL FACTORS:
- Low liquidity (<$50K) = higher risk
- New tokens (<7 days) = higher risk  
- Extreme volatility (>100% daily) = higher risk
- Strong community engagement = higher potential

Respond with ONLY valid JSON:
{
  "symbol": "${symbol}",
  "is_memecoin": boolean,
  "risk": number,
  "potential": number,
  "rationale": "Brief analysis explaining the risk and potential scores"
}`;

  try {
    const response = await ioClient.chat.completions.create({
      model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
      messages: [
        {
          role: 'system',
          content: 'You are a crypto analyst focused on memecoin risk and potential assessment. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: simplifiedPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
      stream: false
    });

    const responseText = response.choices[0]?.message?.content || '';
    
    let text = responseText.replace(/``````/g, '').trim();
    text = text.replace(/([\x00-\x08\x0B\x0C\x0E-\x1F])/g, ' ');
    
    const match = text.match(/\{[\s\S]*?\}/);
    let parsed;
    try {
      parsed = match ? JSON.parse(match[0]) : JSON.parse(text);
    } catch (e) {
      console.error(`Error parsing JSON for ${symbol}:`, e);
      return null;
    }
    
    if (!parsed.is_memecoin) {
      console.log(`Token ${symbol} is not classified as a memecoin. Skipping.`);
      return null;
    }

    // Parse market data
    const parsePrice = (priceStr: string): number => {
      const cleaned = priceStr.replace(/,/g, '').replace(/[^\d.-]/g, '');
      const price = parseFloat(cleaned);
      return isNaN(price) ? 0 : price;
    };
    
    const parseChange = (changeStr: string): number => {
      if (changeStr === 'N/A' || !changeStr) return 0;
      const cleaned = changeStr.replace(/[^\d.-]/g, '');
      const change = parseFloat(cleaned);
      return isNaN(change) ? 0 : change;
    };

    const price = tokenInfo?.price ? parsePrice(tokenInfo.price) : 0;
    const volume = tokenInfo?.volume || 'N/A';
    const marketCap = tokenInfo?.mcap || 'N/A';
    const liquidity = tokenInfo?.liquidity || 'N/A';
    const change24h = tokenInfo?.['change-24h'] ? parseChange(tokenInfo['change-24h']) : 0;
    const age = tokenInfo?.age || 'N/A';

    // Apply fundamental risk adjustments
    const fundamentalRiskAdjustment = assessFundamentalRisk(liquidity, volume, age, change24h);
    const adjustedRisk = Math.min(10, Math.max(1, parsed.risk + fundamentalRiskAdjustment));

    return {
      symbol: parsed.symbol || symbol,
      symbol1: tokenInfo?.symbol1 || '',
      risk: adjustedRisk,
      investmentPotential: parsed.potential || 1,
      rationale: parsed.rationale || 'Analysis completed',
      
      // Market data for frontend
      price,
      volume,
      marketCap,
      change24h,
      age,
      href: tokenInfo?.href || '#',
      
      lastAnalyzed: new Date().toISOString()
    };

  } catch (e: any) {
    console.error(`Analysis error for ${symbol}:`, e);
    if (e.status === 429 || e.code === 429) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }
    return null;
  }
}

// Simplified result writing function
function writeSimplifiedResults(results: SimplifiedTokenAnalysis[], outputFile: string) {
  if (!results.length) {
    const output = {
      data: []
    };
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    return;
  }
  
  // Transform to frontend-compatible format
  const simplifiedResults = results.map((analysis, index) => ({
    id: index + 1,
    symbol: analysis.symbol,
    symbol1: analysis.symbol1 || '',
    price: analysis.price,
    volume: analysis.volume,
    marketCap: analysis.marketCap,
    change24h: analysis.change24h,
    age: analysis.age,
    favorite: false, // Frontend will handle this
    potential: analysis.investmentPotential,
    risk: analysis.risk,
    href: analysis.href
  }));
  
  // Sort by risk (lowest first), then by potential (highest first)
  simplifiedResults.sort((a, b) => {
    if (a.risk !== b.risk) return a.risk - b.risk;
    return b.potential - a.potential;
  });
  
  // Simple output structure
  const output = {
    data: simplifiedResults
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`Written ${simplifiedResults.length} simplified analyses`);
}

// Utility functions
function checkBinanceTokensUpdated(): boolean {
  try {
    if (!fs.existsSync(BINANCE_TOKENS)) return false;
    const stats = fs.statSync(BINANCE_TOKENS);
    const currentModified = stats.mtimeMs;
    if (currentModified > lastBinanceTokensModified) {
      lastBinanceTokensModified = currentModified;
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function getTokenInfo(symbol: string, binanceTokens: any): any {
  if (!binanceTokens?.tokens) return null;
  return binanceTokens.tokens.find((t: any) => t.symbol === symbol) || null;
}

function cleanupAnalysisResults(analysisResults: SimplifiedTokenAnalysis[], binanceTokens: any): SimplifiedTokenAnalysis[] {
  if (!analysisResults.length) return analysisResults;

  console.log('Cleaning up analysis results...');
  
  const availableTokenSymbols = new Set<string>();
  if (binanceTokens && Array.isArray(binanceTokens.tokens)) {
    binanceTokens.tokens.forEach((token: any) => {
      if (token.symbol) {
        availableTokenSymbols.add(token.symbol);
      }
    });
  }

  const initialCount = analysisResults.length;
  const cleanedResults = analysisResults.filter(analysis => 
    availableTokenSymbols.has(analysis.symbol)
  );

  if (cleanedResults.length < initialCount) {
    console.log(`Removed ${initialCount - cleanedResults.length} tokens not in binance_tokens.json`);
    writeSimplifiedResults(cleanedResults, OUTPUT_FILE);
  }

  return cleanedResults;
}

function updateMarketData(analysisResults: SimplifiedTokenAnalysis[], binanceTokens: any): SimplifiedTokenAnalysis[] {
  console.log('Updating market data...');
  
  const parsePrice = (priceStr: string): number => {
    const cleaned = priceStr.replace(/,/g, '').replace(/[^\d.-]/g, '');
    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
  };
  
  const parseChange = (changeStr: string): number => {
    if (changeStr === 'N/A' || !changeStr) return 0;
    const cleaned = changeStr.replace(/[^\d.-]/g, '');
    const change = parseFloat(cleaned);
    return isNaN(change) ? 0 : change;
  };

  const updatedResults = analysisResults.map(analysis => {
    const tokenInfo = getTokenInfo(analysis.symbol, binanceTokens);
    if (tokenInfo) {
      const price = tokenInfo.price ? parsePrice(tokenInfo.price) : 0;
      const change24h = tokenInfo['change-24h'] ? parseChange(tokenInfo['change-24h']) : 0;
      
      // Recalculate risk with updated data
      const fundamentalRiskAdjustment = assessFundamentalRisk(
        tokenInfo.liquidity || 'N/A',
        tokenInfo.volume || 'N/A', 
        tokenInfo.age || 'N/A',
        change24h
      );
      const adjustedRisk = Math.min(10, Math.max(1, analysis.risk + fundamentalRiskAdjustment));
      
      return {
        ...analysis,
        price,
        volume: tokenInfo.volume || analysis.volume,
        marketCap: tokenInfo.mcap || analysis.marketCap,
        change24h,
        age: tokenInfo.age || analysis.age,
        href: tokenInfo.href || analysis.href,
        risk: adjustedRisk,
        lastAnalyzed: new Date().toISOString()
      };
    }
    return analysis;
  });

  return updatedResults;
}

async function main() {
  let tweetsObj: any = {};
  let binanceTokens: any = {};
  
  // Load data files
  try {
    if (!fs.existsSync(TWEETS_FILE)) {
      console.log('tweets.json not found.');
      return;
    }
    tweetsObj = JSON.parse(fs.readFileSync(TWEETS_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading tweets.json:', e);
    return;
  }
  
  try {
    if (fs.existsSync(BINANCE_TOKENS)) {
      binanceTokens = JSON.parse(fs.readFileSync(BINANCE_TOKENS, 'utf8'));
    } else {
      console.log('binance_tokens.json not found.');
      return;
    }
  } catch (e) {
    console.error('Error reading binance_tokens.json:', e);
    return;
  }

  // Load existing results
  let analysisResults: SimplifiedTokenAnalysis[] = [];
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      const fileContent = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      if (Array.isArray(fileContent)) {
        analysisResults = fileContent;
      } else if (Array.isArray(fileContent.data)) {
        analysisResults = fileContent.data.map((item: any) => ({
          symbol: item.symbol,
          symbol1: item.symbol1 || '',
          risk: item.risk,
          investmentPotential: item.potential,
          rationale: 'Existing analysis',
          price: item.price,
          volume: item.volume,
          marketCap: item.marketCap,
          change24h: item.change24h,
          age: item.age,
          href: item.href,
          lastAnalyzed: new Date().toISOString()
        }));
      }
    }
  } catch (e) {
    console.error('Error reading existing results:', e);
    analysisResults = [];
  }

  // Cleanup and update
  analysisResults = cleanupAnalysisResults(analysisResults, binanceTokens);

  try {
    if (fs.existsSync(BINANCE_TOKENS)) {
      const stats = fs.statSync(BINANCE_TOKENS);
      lastBinanceTokensModified = stats.mtimeMs;
    }
  } catch (e) {
    console.error('Error getting binance_tokens.json stats:', e);
  }

  if (analysisResults.length > 0) {
    analysisResults = updateMarketData(analysisResults, binanceTokens);
    writeSimplifiedResults(analysisResults, OUTPUT_FILE);
  }

  // Prepare token queue
  const availableTokens = binanceTokens?.tokens ? 
    new Set(binanceTokens.tokens.map((t: any) => t.symbol)) : 
    new Set();
  
  const tokenQueue = Object.keys(tweetsObj).filter(symbol => availableTokens.has(symbol));
  
  console.log(`Simplified AI Analyzer Started`);
  console.log(`Tokens to analyze: ${tokenQueue.length}`);

  async function processTokensSimplified() {
    while (true) {
      if (checkBinanceTokensUpdated()) {
        console.log('Updating data...');
        try {
          const updatedBinanceTokens = JSON.parse(fs.readFileSync(BINANCE_TOKENS, 'utf8'));
          analysisResults = cleanupAnalysisResults(analysisResults, updatedBinanceTokens);
          analysisResults = updateMarketData(analysisResults, updatedBinanceTokens);
          writeSimplifiedResults(analysisResults, OUTPUT_FILE);
          binanceTokens = updatedBinanceTokens;
        } catch (e) {
          console.error('Error updating data:', e);
        }
      }

      const currentAvailableTokens = binanceTokens?.tokens ? 
        new Set(binanceTokens.tokens.map((t: any) => t.symbol)) : 
        new Set();
      
      const currentTokenQueue = Object.keys(tweetsObj).filter(symbol => 
        currentAvailableTokens.has(symbol)
      );

      for (let i = 0; i < currentTokenQueue.length; i++) {
        const currentSymbol = currentTokenQueue[i];
        try {
          console.log(`[${i + 1}/${currentTokenQueue.length}] Analyzing ${currentSymbol}`);
          
          const tweets = tweetsObj[currentSymbol]?.tweets || [];
          const tokenInfo = getTokenInfo(currentSymbol, binanceTokens);
          
          if (!tokenInfo) {
            console.log(`${currentSymbol} not found. Skipping.`);
            continue;
          }
          
          const analysis = await analyzeTokenSimplified(currentSymbol, tweets, tokenInfo);
          
          if (analysis && analysis.rationale.trim()) {
            const existingIndex = analysisResults.findIndex(a => a.symbol === currentSymbol);
            
            if (existingIndex >= 0) {
              analysisResults[existingIndex] = analysis;
              console.log(`Updated ${currentSymbol} - Risk: ${analysis.risk}/10, Potential: ${analysis.investmentPotential}/10`);
            } else {
              analysisResults.push(analysis);
              console.log(`Added ${currentSymbol} - Risk: ${analysis.risk}/10, Potential: ${analysis.investmentPotential}/10`);
            }
            
            writeSimplifiedResults(analysisResults, OUTPUT_FILE);
          } else {
            console.log(`Skipped ${currentSymbol}: Invalid analysis`);
          }
        } catch (e: any) {
          if (e.message === 'RATE_LIMIT_EXCEEDED') {
            console.log('Rate limit reached. Pausing.');
            return;
          }
          console.error(`Error analyzing ${currentSymbol}:`, e.message);
        }
        
        console.log('Waiting 5 seconds...');
        await new Promise(res => setTimeout(res, 5000));
      }
      
      console.log('Analysis cycle complete. Next cycle in 24 hours.');
      await new Promise(res => setTimeout(res, 24 * 60 * 60 * 1000));
    }
  }

  await processTokensSimplified();
}

setInterval(() => {
  main().catch(console.error);
}, 10000);

main().catch(console.error);
