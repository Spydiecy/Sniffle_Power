import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const backendUrl = 'http://localhost:3001/api/token-data';
    const response = await fetch(backendUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to fetch token data');
    }
    const result = await response.json();
    return NextResponse.json(result, {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('Proxy error fetching token data:', error);
    return NextResponse.json(
      { error: 'Failed to proxy token data', data: [] },
      { status: 500 }
    );
  }
}

// Revalidate every 60 seconds in production