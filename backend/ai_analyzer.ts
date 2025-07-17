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

// Function to check if binance_tokens.json was updated
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

// Helper to get token info from binance_tokens.json
function getTokenInfo(symbol: string, binanceTokens: any): any {
  if (!binanceTokens?.tokens) return null;
  return binanceTokens.tokens.find((t: any) => t.symbol === symbol) || null;
}

async function analyzeTokenIOIntelligence(symbol: string, tweets: any[], tokenInfo: any): Promise<TokenAnalysis | null> {
  let tokenInfoStr = '';
  if (tokenInfo) {
    tokenInfoStr = `Token info: ${JSON.stringify(tokenInfo)}\n`;
  }
  // Use up to 20 tweets, and instruct the AI to use market data and name if tweets are insufficient
  const tweetsText = tweets.map(t => t.text).slice(0, 20).join(' | ');
  const prompt = `Determine if the following token is a memecoin. Use the recent tweets below if available. If there is not enough tweet data, use the token's market data and name to make your determination. If it is a memecoin, analyze it for risk (1-10, 10=highest risk), investment potential (1-10, 10=best potential), and an overall score (1-100, 100=best overall). Token symbol: ${symbol}\n${tokenInfoStr}Recent tweets: ${tweetsText}\nRespond ONLY with a single JSON object, no extra text, no code blocks, no explanations. The JSON object MUST have these exact keys: symbol, is_memecoin (boolean), risk, potential, overall, rationale. Example: { "symbol": "${symbol}", "is_memecoin": true, "risk": 5, "potential": 7, "overall": 65, "rationale": "..." }`;
  
  try {
    const response = await ioClient.chat.completions.create({
      model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
      messages: [
        {
          role: 'system',
          content: 'You are a crypto analyst specialized in memecoin analysis. Always respond with valid JSON format only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      stream: false
    });

    const responseText = response.choices[0]?.message?.content || '';
    
    let text = responseText.replace(/```json|```/g, '').trim();
    text = text.replace(/([\x00-\x08\x0B\x0C\x0E-\x1F])/g, ' ');
    const match = text.match(/\{[\s\S]*?\}/);
    let parsed;
    try {
      parsed = match ? JSON.parse(match[0]) : JSON.parse(text);
    } catch (e) {
      console.error(`Error parsing extracted JSON for ${symbol}:`, e, '\nExtracted:', match ? match[0] : text);
      return null;
    }
    if (!parsed.is_memecoin) {
      console.log(`Token ${symbol} is not a memecoin. Skipping.`);
      return null;
    }
    
    // Helper function to parse price strings
    const parsePrice = (priceStr: string): number => {
      const cleaned = priceStr.replace(/,/g, '').replace(/[^\d.-]/g, '');
      const price = parseFloat(cleaned);
      return isNaN(price) ? 0 : price;
    };
    
    // Helper function to parse percentage change
    const parseChange = (changeStr: string): number => {
      if (changeStr === 'N/A') return 0;
      const cleaned = changeStr.replace(/[^\d.-]/g, '');
      const change = parseFloat(cleaned);
      return isNaN(change) ? 0 : change;
    };
    
    return {
      symbol: parsed.symbol || symbol,
      risk: parsed.risk,
      investmentPotential: parsed.potential,
      overall: parsed.overall,
      rationale: parsed.rationale || '',
      // Include market data from tokenInfo if available
      price: tokenInfo?.price ? parsePrice(tokenInfo.price) : 0,
      volume: tokenInfo?.volume || 'N/A',
      marketCap: tokenInfo?.mcap || 'N/A',
      liquidity: tokenInfo?.liquidity || 'N/A',
      change24h: tokenInfo?.['change-24h'] ? parseChange(tokenInfo['change-24h']) : 0,
      age: tokenInfo?.age || 'N/A',
      href: tokenInfo?.href || '#'
    };
  } catch (e: any) {
    console.error(`IO.NET Intelligence API error for ${symbol}:`, e);
    // Handle rate limiting and errors gracefully
    if (e.status === 429 || e.code === 429) {
      console.error(`Rate limit exceeded for ${symbol}. Check your IO.NET quota.`);
      throw new Error('RATE_LIMIT_EXCEEDED');
    }
    return null;
  }
}

interface TokenAnalysis {
  symbol: string;
  risk: number;
  investmentPotential: number;
  overall: number;
  rationale: string;
  // Market data fields
  price?: number;
  volume?: string;
  marketCap?: string;
  liquidity?: string;
  change24h?: number;
  age?: string;
  href?: string;
}

// Helper to write analysis results with best token on top
function writeResultsWithBestToken(results: TokenAnalysis[], outputFile: string) {
  if (!results.length) return;
  // Find the best token by highest overall score
  const best = results.reduce((a, b) => (b.overall > a.overall ? b : a));
  // Prepare output object
  const output = {
    best_token: {
      symbol: best.symbol,
      overall: best.overall,
      rationale: best.rationale
    },
    results
  };
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
}

// Helper function to update market data for existing analyses
function updateMarketData(analysisResults: TokenAnalysis[], binanceTokens: any): TokenAnalysis[] {
  console.log('Updating market data for existing analyses...');
  
  const parsePrice = (priceStr: string): number => {
    const cleaned = priceStr.replace(/,/g, '').replace(/[^\d.-]/g, '');
    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
  };
  
  const parseChange = (changeStr: string): number => {
    if (changeStr === 'N/A') return 0;
    const cleaned = changeStr.replace(/[^\d.-]/g, '');
    const change = parseFloat(cleaned);
    return isNaN(change) ? 0 : change;
  };

  let updatedCount = 0;
  const updatedResults = analysisResults.map(analysis => {
    const tokenInfo = getTokenInfo(analysis.symbol, binanceTokens);
    if (tokenInfo) {
      console.log(`Updated market data for ${analysis.symbol}`);
      updatedCount++;
      return {
        ...analysis,
        price: tokenInfo.price ? parsePrice(tokenInfo.price) : analysis.price || 0,
        volume: tokenInfo.volume || analysis.volume || 'N/A',
        marketCap: tokenInfo.mcap || analysis.marketCap || 'N/A',
        liquidity: tokenInfo.liquidity || analysis.liquidity || 'N/A',
        change24h: tokenInfo['change-24h'] ? parseChange(tokenInfo['change-24h']) : analysis.change24h || 0,
        age: tokenInfo.age || analysis.age || 'N/A',
        href: tokenInfo.href || analysis.href || '#'
      };
    }
    // Return original analysis if token is not found in binance_tokens.json
    return analysis;
  });

  console.log(`Updated market data for ${updatedCount} out of ${analysisResults.length} tokens`);
  return updatedResults;
}

async function main() {
  let tweetsObj: any = {};
  let binanceTokens: any = {};
  try {
    if (!fs.existsSync(TWEETS_FILE)) {
      console.log('tweets.json not found. Nothing to analyze.');
      return;
    }
    tweetsObj = JSON.parse(fs.readFileSync(TWEETS_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading or parsing tweets.json:', e);
    return;
  }
  try {
    if (fs.existsSync(BINANCE_TOKENS)) {
      binanceTokens = JSON.parse(fs.readFileSync(BINANCE_TOKENS, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading or parsing binance_tokens.json:', e);
    binanceTokens = {};
  }

  let analysisResults: TokenAnalysis[] = [];
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      // Read only the results array if best_token is present
      const fileContent = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      if (Array.isArray(fileContent)) {
        analysisResults = fileContent;
      } else if (Array.isArray(fileContent.results)) {
        analysisResults = fileContent.results;
      }
    }
  } catch (e) {
    console.error('Error reading or parsing ai_analyzer.json:', e);
    analysisResults = [];
  }

  // Initialize last modified time for binance_tokens.json
  try {
    if (fs.existsSync(BINANCE_TOKENS)) {
      const stats = fs.statSync(BINANCE_TOKENS);
      lastBinanceTokensModified = stats.mtimeMs;
    }
  } catch (e) {
    console.error('Error getting binance_tokens.json stats:', e);
  }

  // Update market data for existing analyses
  if (analysisResults.length > 0) {
    analysisResults = updateMarketData(analysisResults, binanceTokens);
    writeResultsWithBestToken(analysisResults, OUTPUT_FILE);
    console.log(`Updated market data for ${analysisResults.length} existing analyses`);
  }

  // Create a queue of tokens to analyze (all tokens, every run)
  const tokenQueue = Object.keys(tweetsObj);
  console.log(`Total tokens to analyze: ${tokenQueue.length}`);

  async function processAllTokensEvery24h() {
    while (true) {
      // Check if binance_tokens.json was updated
      if (checkBinanceTokensUpdated()) {
        console.log('Detected binance_tokens.json update. Refreshing market data...');
        try {
          const updatedBinanceTokens = JSON.parse(fs.readFileSync(BINANCE_TOKENS, 'utf8'));
          analysisResults = updateMarketData(analysisResults, updatedBinanceTokens);
          writeResultsWithBestToken(analysisResults, OUTPUT_FILE);
          console.log('Market data updated successfully');
        } catch (e) {
          console.error('Error updating market data:', e);
        }
      }

      for (let i = 0; i < tokenQueue.length; i++) {
        const currentSymbol = tokenQueue[i];
        try {
          console.log(`Analyzing token ${i + 1}/${tokenQueue.length}: ${currentSymbol}`);
          const tweets = tweetsObj[currentSymbol]?.tweets || [];
          const tokenInfo = getTokenInfo(currentSymbol, binanceTokens);
          const analysis = await analyzeTokenIOIntelligence(currentSymbol, tweets, tokenInfo);
          if (analysis && analysis.rationale && analysis.rationale.trim() !== '' && analysis.risk !== -1) {
            // Update or add analysis
            const existingIndex = analysisResults.findIndex(a => a.symbol === currentSymbol);
            if (existingIndex >= 0) {
              analysisResults[existingIndex] = analysis;
              console.log(`Updated analysis for ${currentSymbol}`);
            } else {
              analysisResults.push(analysis);
              console.log(`Added new analysis for ${currentSymbol}`);
            }
            writeResultsWithBestToken(analysisResults, OUTPUT_FILE);
          } else if (!analysis) {
            console.warn(`Skipping ${currentSymbol}: Not a memecoin or no valid analysis returned.`);
          }
        } catch (e: any) {
          if (e.message === 'RATE_LIMIT_EXCEEDED') {
            console.log('Daily rate limit exceeded. Stopping analysis until quota resets.');
            console.log('The analyzer will resume automatically when you restart it after quota reset.');
            return; // Exit the function
          }
          console.error(`Error analyzing token ${currentSymbol}:`, e);
        }
        // Wait 5 seconds between requests
        console.log(`Waiting 5 seconds before next analysis...`);
        await new Promise(res => setTimeout(res, 5 * 1000));
      }
      // After all tokens are processed, wait 24 hours before next full analysis
      console.log('Completed full analysis of all tokens. Waiting 24 hours before next run...');
      await new Promise(res => setTimeout(res, 24 * 60 * 60 * 1000));
    }
  }

  // Start the 24-hour analysis loop
  await processAllTokensEvery24h();
}

main().catch(console.error);
