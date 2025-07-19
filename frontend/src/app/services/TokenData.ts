interface TokenCoin {
  name: string;
  symbol: string;
  symbol1: string;
  price: string;
  volume: string;
  liquidity: string;
  mcap: string;
  transactions: string;
  age: string;
  'change-5m': string;
  'change-1h': string;
  'change-6h': string;
  'change-24h': string;
  href: string;
}

interface TokenDataResponse {
  data: TokenCoin[];
}

// New interface for AI analyzer simplified format
interface AIAnalyzerToken {
  id: number;
  symbol: string;
  symbol1: string;
  price: number;
  volume: string;
  marketCap: string;
  change24h: number;
  age: string;
  favorite: boolean;
  potential: number;
  risk: number;
  href: string;
}

interface AIAnalyzerResponse {
  data: AIAnalyzerToken[];
}

export interface FormattedMemecoin {
  id: number;
  symbol: string;
  symbol1: string;
  price: number;
  volume: string;
  marketCap: string;
  change24h: number;
  age: string;
  favorite: boolean;
  potential: number;
  risk: number;
  href: string;
}

// Function to parse price strings, handling various formats
const parsePrice = (priceStr: string | number): number => {
  // If already a number, return it
  if (typeof priceStr === 'number') return priceStr;
  
  // Handle string conversion
  if (!priceStr || priceStr === 'N/A') return 0;
  
  // Remove commas and any non-numeric characters except dots
  const cleaned = String(priceStr).replace(/,/g, '').replace(/[^\d.-]/g, '');
  
  // Parse the cleaned string
  const price = parseFloat(cleaned);
  
  // If parsing fails or results in NaN, return 0
  return isNaN(price) ? 0 : price;
};

// Function to parse percentage change
const parseChange = (changeStr: string | number): number => {
  // If already a number, return it
  if (typeof changeStr === 'number') return changeStr;
  
  if (!changeStr || changeStr === 'N/A') return 0;
  
  // Extract the number and remove the % sign
  const cleaned = String(changeStr).replace(/[^\d.-]/g, '');
  
  // Parse the cleaned string
  const change = parseFloat(cleaned);
  
  // If parsing fails or results in NaN, return 0
  return isNaN(change) ? 0 : change;
};

// Function to determine risk score based on price volatility and other factors
const calculateRisk = (price: number, changeStr: string | number): number => {
  const change = parseChange(changeStr);
  // Higher volatility means higher risk
  const volatilityRisk = Math.min(Math.abs(change), 10);
  // Very low-priced coins are generally riskier
  const priceRisk = price < 0.001 ? 8 : price < 0.01 ? 6 : price < 0.1 ? 5 : 3;
  // Return weighted average
  return Math.min(Math.round((volatilityRisk * 0.6 + priceRisk * 0.4)), 10);
};

// Function to determine potential score
const calculatePotential = (price: number, changeStr: string | number): number => {
  const change = parseChange(changeStr);
  // Coins with positive recent changes have higher potential
  const changePotential = change > 5 ? 8 : change > 0 ? 6 : 4;
  // Low-priced coins have higher potential for big percentage moves
  const pricePotential = price < 0.001 ? 9 : price < 0.01 ? 7 : price < 0.1 ? 6 : 5;
  // Return weighted average
  return Math.min(Math.round((changePotential * 0.5 + pricePotential * 0.5)), 10);
};

// Helper function to parse price strings to numbers
const parseNumericValue = (valueStr: string | number | undefined): number => {
  if (typeof valueStr === 'number') return valueStr;
  if (!valueStr || valueStr === 'N/A') return 0;
  
  // Remove commas, currency symbols, and any non-numeric characters except dots
  const cleaned = String(valueStr).replace(/,/g, '').replace(/[^\d.-]/g, '');
  
  // Parse the cleaned string
  const value = parseFloat(cleaned);
  
  // If parsing fails or results in NaN, return 0
  return isNaN(value) ? 0 : value;
};

// Updated function to process AI analyzer format (simplified)
const processAIAnalyzerData = (data: AIAnalyzerToken[]): FormattedMemecoin[] => {
  return data.map((item) => {
    // Data is already in the right format, just ensure types are correct
    return {
      id: item.id || 0,
      symbol: item.symbol || '',
      symbol1: item.symbol1 || '',
      price: parsePrice(item.price),
      volume: item.volume || 'N/A',
      marketCap: item.marketCap || 'N/A',
      change24h: parseChange(item.change24h),
      age: item.age || 'N/A',
      favorite: false, // Always start as false, frontend handles favorites
      potential: item.potential || 1,
      risk: item.risk || 10, // Default to high risk if not specified
      href: item.href || '#'
    };
  });
};

// Legacy function to process old token format (kept for backward compatibility)
const processLegacyTokenData = (data: any[]): FormattedMemecoin[] => {
  return data.map((item, index) => {
    // Helper function to ensure price is a number
    const ensureNumber = (value: any): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };
    
    // Helper function to ensure change is a number
    const ensureChangeNumber = (value: any): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const cleaned = value.replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };
    
    // Handle legacy format - try to map old structure to new
    const price = ensureNumber(item.price);
    const change24h = ensureChangeNumber(item.change24h || item['change-24h']);
    
    return {
      id: index + 1,
      symbol: item.symbol || '',
      symbol1: item.symbol1 || '',
      price: price,
      volume: item.volume || 'N/A',
      marketCap: item.marketCap || item.mcap || 'N/A',
      change24h: change24h,
      age: item.age || 'N/A',
      favorite: false,
      // Use AI scores if available, otherwise calculate
      potential: item.investmentPotential || item.potential || calculatePotential(price, change24h),
      risk: item.risk || calculateRisk(price, change24h),
      href: item.href || '#'
    };
  });
};

// Smart processing function that detects format and processes accordingly
const processTokenData = (data: any[]): FormattedMemecoin[] => {
  if (!data || data.length === 0) return [];
  
  // Check if this looks like AI analyzer format (has id, potential, risk fields)
  const firstItem = data[0];
  const isAIFormat = firstItem && 
    typeof firstItem.id === 'number' && 
    typeof firstItem.potential === 'number' && 
    typeof firstItem.risk === 'number';
  
  console.log('Detected format:', isAIFormat ? 'AI Analyzer' : 'Legacy');
  
  if (isAIFormat) {
    return processAIAnalyzerData(data as AIAnalyzerToken[]);
  } else {
    return processLegacyTokenData(data);
  }
};

export const fetchTokenData = async (forceRefresh: boolean = false): Promise<FormattedMemecoin[]> => {
  try {
    console.log('Fetching token data at:', new Date().toISOString());
    
    // More aggressive cache busting
    const cacheBuster = `_=${Date.now()}&r=${Math.random()}${forceRefresh ? '&force=1' : ''}`;
    const url = `/api/token-data?${cacheBuster}`;
    
    console.log('Fetch URL:', url);
    
    const response = await fetch(url, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.warn('API request failed, using fallback data');
      return [];
    }
    
    const raw = await response.json();
    console.log('Raw response structure:', {
      hasData: Array.isArray(raw.data),
      hasResults: Array.isArray(raw.results),
      dataLength: raw.data?.length || 0,
      resultsLength: raw.results?.length || 0,
      firstItem: raw.data?.[0] || raw.results?.[0] || 'none'
    });
    
    // Support multiple response formats
    let tokens: any[] = [];
    
    if (Array.isArray(raw.data)) {
      tokens = raw.data;
    } else if (Array.isArray(raw.results)) {
      tokens = raw.results;
    } else if (Array.isArray(raw)) {
      tokens = raw; // Direct array response
    }
    
    console.log('Tokens found:', tokens.length);
    
    if (!tokens.length) {
      console.warn('No token data found in API response');
      return [];
    }
    
    const processed = processTokenData(tokens);
    console.log('Processed tokens:', processed.length);
    console.log('Sample processed token:', processed[0]);
    
    return processed;
  } catch (error) {
    console.error('Error fetching Token data:', error);
    return [];
  }
};

// Function to force cache invalidation
export const invalidateTokenCache = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/revalidate', { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Cache invalidation failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Cache invalidation result:', result);
    return true;
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
    return false;
  }
};

// Utility function to validate token data format
export const validateTokenData = (data: any[]): { isValid: boolean, format: string, errors: string[] } => {
  const errors: string[] = [];
  
  if (!Array.isArray(data)) {
    errors.push('Data is not an array');
    return { isValid: false, format: 'unknown', errors };
  }
  
  if (data.length === 0) {
    return { isValid: true, format: 'empty', errors };
  }
  
  const firstItem = data[0];
  
  // Check for AI analyzer format
  if (firstItem.id !== undefined && firstItem.potential !== undefined && firstItem.risk !== undefined) {
    const requiredFields = ['id', 'symbol', 'price', 'volume', 'marketCap', 'change24h', 'age', 'potential', 'risk', 'href'];
    const missingFields = requiredFields.filter(field => firstItem[field] === undefined);
    
    if (missingFields.length > 0) {
      errors.push(`Missing AI format fields: ${missingFields.join(', ')}`);
    }
    
    return { 
      isValid: missingFields.length === 0, 
      format: 'AI Analyzer', 
      errors 
    };
  }
  
  // Check for legacy format
  if (firstItem.symbol !== undefined) {
    return { isValid: true, format: 'Legacy', errors };
  }
  
  errors.push('Unknown data format');
  return { isValid: false, format: 'unknown', errors };
};
