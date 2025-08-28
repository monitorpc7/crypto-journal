from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, date
import aiohttp
import asyncio
import pandas as pd
from enum import Enum

# --- Environment and Configuration ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Supabase Connection ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    raise Exception("Supabase URL and Key must be set in the environment variables.")

supabase: Client = create_client(url, key)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Enums and Models
class TradeType(str, Enum):
    LONG = "Long"
    SHORT = "Short"

class CryptoTrade(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pair: str  # e.g., BTC/USDT, ETH/USDT
    entry_price: float
    exit_price: Optional[float] = None
    usd_amount: float  # Amount in USD invested
    quantity: float  # Calculated automatically
    trade_date: date
    pnl: Optional[float] = None
    strategy: str
    trade_type: TradeType
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    notes: Optional[str] = None
    image_data: Optional[str] = None  # base64 encoded image
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CryptoTradeCreate(BaseModel):
    pair: str
    entry_price: float
    exit_price: Optional[float] = None
    usd_amount: float
    trade_date: date
    pnl: Optional[float] = None
    strategy: str
    trade_type: TradeType
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    notes: Optional[str] = None
    image_data: Optional[str] = None

class CryptoTradeUpdate(BaseModel):
    pair: Optional[str] = None
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    usd_amount: Optional[float] = None
    trade_date: Optional[date] = None
    pnl: Optional[float] = None
    strategy: Optional[str] = None
    trade_type: Optional[TradeType] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    notes: Optional[str] = None
    image_data: Optional[str] = None

class CryptoTradeResponse(BaseModel):
    trades: List[CryptoTrade]
    total: int
    page: int
    limit: int
    total_pages: int

class TickerData(BaseModel):
    symbol: str
    lastPrice: str
    priceChange: str
    priceChangePercent: str
    highPrice: str
    lowPrice: str
    volume: str

# MEXC API Integration
async def fetch_mexc_ticker(symbol: str = None):
    """Fetch 24h ticker data from MEXC API"""
    url = "https://api.mexc.com/api/v3/ticker/24hr"
    params = {}
    if symbol:
        params["symbol"] = symbol.replace("/", "")  # Convert BTC/USDT to BTCUSDT
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data
                else:
                    return None
    except Exception as e:
        print(f"Error fetching MEXC data: {e}")
        return None

# --- Helper Functions ---
def calculate_quantity(usd_amount: float, entry_price: float) -> float:
    return usd_amount / entry_price if entry_price > 0 else 0

def calculate_pnl(trade_type: str, entry_price: float, exit_price: float, quantity: float) -> Optional[float]:
    if not all([trade_type, entry_price, exit_price, quantity]):
        return None
    if trade_type == TradeType.LONG:
        return (exit_price - entry_price) * quantity
    else:  # SHORT
        return (entry_price - exit_price) * quantity

# --- Crypto Trade Routes (Supabase) ---
@api_router.post("/trades", response_model=CryptoTrade)
async def create_trade(trade: CryptoTradeCreate):
    quantity = calculate_quantity(trade.usd_amount, trade.entry_price)
    pnl = calculate_pnl(trade.trade_type, trade.entry_price, trade.exit_price, quantity)

    trade_obj = CryptoTrade(
        **trade.dict(),
        quantity=quantity,
        pnl=pnl,
    )

    trade_data = trade_obj.dict()
    # Convert date/datetime to ISO format strings for Supabase (Postgres)
    trade_data['trade_date'] = trade_data['trade_date'].isoformat()
    trade_data['created_at'] = trade_data['created_at'].isoformat()
    trade_data['updated_at'] = trade_data['updated_at'].isoformat()
    
    try:
        response = supabase.table('crypto_trades').insert(trade_data).execute()
        if response.data:
            return CryptoTrade(**response.data[0])
        else:
            raise HTTPException(status_code=500, detail=f"Failed to create trade: {response.error.message if response.error else 'Unknown error'}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@api_router.get("/trades", response_model=CryptoTradeResponse)
async def get_trades(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    strategy: Optional[str] = Query(None),
    trade_type: Optional[TradeType] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    sort_order: Optional[str] = Query("desc")
):
    try:
        query = supabase.table('crypto_trades').select("*", count="exact")

        if search:
            query = query.ilike('pair', f'%{search}%')
        if strategy:
            query = query.ilike('strategy', f'%{strategy}%')
        if trade_type:
            query = query.eq('trade_type', trade_type)

        # Sorting
        is_ascending = sort_order == "asc"
        query = query.order(sort_by, ascending=is_ascending)

        # Pagination
        start_index = (page - 1) * limit
        end_index = start_index + limit - 1
        query = query.range(start_index, end_index)

        response = query.execute()
        
        if response.error:
             raise HTTPException(status_code=500, detail=f"Failed to fetch trades: {response.error.message}")

        total_records = response.count or 0
        total_pages = (total_records + limit - 1) // limit

        return CryptoTradeResponse(
            trades=[CryptoTrade(**trade) for trade in response.data],
            total=total_records,
            page=page,
            limit=limit,
            total_pages=total_pages
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@api_router.get("/trades/{trade_id}", response_model=CryptoTrade)
async def get_trade(trade_id: str):
    try:
        response = supabase.table('crypto_trades').select("*").eq('id', trade_id).single().execute()
        if response.data:
            return CryptoTrade(**response.data)
        else:
             raise HTTPException(status_code=404, detail=f"Trade not found: {response.error.message if response.error else ''}")
    except Exception as e:
        # The supabase client might raise an exception if zero or more than one row is found
        if "PostgrestError" in str(e) and "JSON object requested, but multiple rows returned" in str(e):
             raise HTTPException(status_code=500, detail="Multiple trades found with the same ID.")
        if "PostgrestError" in str(e) and "JSON object requested, but no rows returned" in str(e):
             raise HTTPException(status_code=404, detail="Trade not found.")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@api_router.put("/trades/{trade_id}", response_model=CryptoTrade)
async def update_trade(trade_id: str, trade_update: CryptoTradeUpdate):
    update_data = {k: v for k, v in trade_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided.")

    # If critical fields change, we may need to recalculate P&L and quantity
    if any(f in update_data for f in ["usd_amount", "entry_price", "exit_price", "trade_type"]):
        # Fetch existing trade to get values for recalculation
        get_response = supabase.table('crypto_trades').select("*").eq('id', trade_id).single().execute()
        if not get_response.data:
            raise HTTPException(status_code=404, detail="Trade not found for update.")
        
        existing_trade = CryptoTrade(**get_response.data)
        
        new_usd = update_data.get("usd_amount", existing_trade.usd_amount)
        new_entry = update_data.get("entry_price", existing_trade.entry_price)
        new_exit = update_data.get("exit_price", existing_trade.exit_price)
        new_type = update_data.get("trade_type", existing_trade.trade_type)
        
        new_quantity = calculate_quantity(new_usd, new_entry)
        update_data["quantity"] = new_quantity
        update_data["pnl"] = calculate_pnl(new_type, new_entry, new_exit, new_quantity)

    try:
        response = supabase.table('crypto_trades').update(update_data).eq('id', trade_id).execute()
        if response.data:
            return CryptoTrade(**response.data[0])
        else:
            raise HTTPException(status_code=404, detail=f"Trade not found or failed to update: {response.error.message if response.error else ''}")
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@api_router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str):
    try:
        response = supabase.table('crypto_trades').delete().eq('id', trade_id).execute()
        if response.data:
            return {"message": "Trade deleted successfully"}
        else:
            # Supabase delete returns empty data on success, but also on not found.
            # We can check if it existed first, but for now, this is simpler.
            return {"message": "Trade deleted successfully or was not found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@api_router.get("/trades/stats/summary")
async def get_trade_stats():
    try:
        # Fetch all trades with a P&L value to perform stats
        response = supabase.table('crypto_trades').select('pnl, usd_amount').not_.is_('pnl', 'null').execute()
        if response.error:
            raise HTTPException(status_code=500, detail=f"Failed to fetch trades for stats: {response.error.message}")

        if not response.data:
            return {"total_trades": 0, "total_pnl": 0, "total_invested": 0, "winning_trades": 0, "losing_trades": 0, "win_rate": 0, "avg_pnl": 0, "roi": 0}

        df = pd.DataFrame(response.data)
        
        total_trades = len(df)
        total_pnl = df['pnl'].sum()
        total_invested = df['usd_amount'].sum()
        winning_trades = df[df['pnl'] > 0]['pnl'].count()
        losing_trades = df[df['pnl'] < 0]['pnl'].count()
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        avg_pnl = df['pnl'].mean()
        roi = (total_pnl / total_invested * 100) if total_invested > 0 else 0

        return {
            "total_trades": int(total_trades),
            "total_pnl": round(float(total_pnl), 2),
            "total_invested": round(float(total_invested), 2),
            "winning_trades": int(winning_trades),
            "losing_trades": int(losing_trades),
            "win_rate": round(float(win_rate), 2),
            "avg_pnl": round(float(avg_pnl), 2),
            "roi": round(float(roi), 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during stats calculation: {str(e)}")

# MEXC API Routes
@api_router.get("/mexc/ticker")
async def get_mexc_ticker(symbols: str = Query(..., description="Comma-separated crypto pairs (e.g., BTC/USDT,ETH/USDT)")):
    """Get 24h ticker data for specified crypto pairs from MEXC"""
    pairs = [s.strip() for s in symbols.split(",")]
    tickers = []
    
    for pair in pairs:
        ticker_data = await fetch_mexc_ticker(pair)
        if ticker_data:
            # Handle both single ticker and list response
            if isinstance(ticker_data, list):
                for ticker in ticker_data:
                    if ticker.get("symbol") == pair.replace("/", ""):
                        tickers.append({
                            "symbol": pair,
                            "lastPrice": float(ticker.get("lastPrice", 0)),
                            "priceChange": float(ticker.get("priceChange", 0)),
                            "priceChangePercent": float(ticker.get("priceChangePercent", 0)),
                            "highPrice": float(ticker.get("highPrice", 0)),
                            "lowPrice": float(ticker.get("lowPrice", 0)),
                            "volume": float(ticker.get("volume", 0))
                        })
                        break
            else:
                tickers.append({
                    "symbol": pair,
                    "lastPrice": float(ticker_data.get("lastPrice", 0)),
                    "priceChange": float(ticker_data.get("priceChange", 0)),
                    "priceChangePercent": float(ticker_data.get("priceChangePercent", 0)),
                    "highPrice": float(ticker_data.get("highPrice", 0)),
                    "lowPrice": float(ticker_data.get("lowPrice", 0)),
                    "volume": float(ticker_data.get("volume", 0))
                })
    
    return {"tickers": tickers}

@api_router.get("/mexc/popular-pairs")
async def get_popular_pairs():
    """Get popular crypto pairs for the dashboard"""
    popular_pairs = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "ADA/USDT", "SOL/USDT", "MATIC/USDT", "DOT/USDT", "AVAX/USDT"]
    symbols_param = ",".join(popular_pairs)
    
    result = await get_mexc_ticker(symbols_param)
    return result

# --- App Configuration ---
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Legacy root endpoint for testing
@api_router.get("/")
async def root():
    return {"message": "Crypto Trading Journal API"}
